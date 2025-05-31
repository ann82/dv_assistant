import { AudioService } from '../services/audioService.js';
import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import twilio from 'twilio';

const audioService = new AudioService();
const router = express.Router();

// Create Twilio client instance
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || 'test_account_sid',
  process.env.TWILIO_AUTH_TOKEN || 'test_auth_token'
);

export async function handleTwilioWebhook(req, res, next) {
  try {
    const { CallSid, SpeechResult, RecordingUrl, RecordingSid } = req.body;

    if (!CallSid) {
      return res.status(400).json({ error: 'Missing CallSid' });
    }

    if (!SpeechResult) {
      return res.status(400).json({ error: 'No transcription provided' });
    }

    // Process transcription
    let transcription;
    try {
      transcription = await audioService.transcribeWithWhisper(SpeechResult);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to process transcription' });
    }
    
    // Get GPT response
    let gptResponse;
    try {
      gptResponse = await audioService.getGptReply(transcription);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to get GPT response' });
    }
    
    // Generate TTS
    let ttsResult;
    try {
      ttsResult = await audioService.generateTTS(gptResponse.text);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to generate audio response' });
    }
    
    // Verify audio file exists and has content
    try {
      const stats = await fs.stat(ttsResult.fullPath);
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
    } catch (error) {
      return res.status(500).json({ error: 'Audio file not found or empty' });
    }

    // Try to send response to WebSocket client
    try {
      const client = global.wsServer?.getClient(CallSid);
      if (client) {
        await client.send(JSON.stringify({
          type: 'response',
          text: gptResponse.text,
          audioPath: ttsResult.audioPath
        }));
      }
    } catch (error) {
      console.error('Failed to send response to client:', error);
      return res.status(500).json({ error: 'Failed to send response to client' });
    }

    // Send response
    return res.status(200).json({
      success: true,
      transcription,
      response: gptResponse.text,
      audioPath: ttsResult.audioPath,
      model: gptResponse.model,
      tokens: {
        input: gptResponse.inputTokens,
        output: gptResponse.outputTokens
      }
    });

  } catch (error) {
    console.error('Error in Twilio webhook:', error);
    next(error);
  }
}

export function handleConsent(req, res) {
  const { CallSid, From, SpeechResult } = req.body;

  if (!CallSid || !From || !SpeechResult) {
    return res.status(400).send('Missing required parameters');
  }

  if (!/^\+[1-9]\d{1,14}$/.test(From)) {
    return res.status(400).send('Invalid phone number format');
  }

  if (SpeechResult.length > 1000) {
    return res.status(400).send('Invalid speech result');
  }

  const response = SpeechResult.toLowerCase();
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (response === 'yes') {
    twiml += '<Say>Thank you. You will receive a summary and resources after the call.</Say>';
  } else if (response === 'no') {
    twiml += '<Say>Understood. You will not receive any follow-up messages.</Say>';
  } else {
    twiml += '<Say>I didn\'t quite understand. Would you like to receive a summary and resources after the call? Please say yes or no.</Say>';
  }

  twiml += '</Response>';
  res.type('text/xml').send(twiml);
}

export async function handleStatus(req, res) {
  const { CallSid, CallStatus } = req.body;

  if (!CallSid || !CallStatus) {
    return res.status(400).send('Missing required parameters');
  }

  if (CallStatus === 'completed') {
    const call = global.wss.activeCalls.get(CallSid);
    if (call && call.hasConsent) {
      try {
        const summary = await global.wss.handleCallEnd(CallSid);
        // Send SMS with summary
        await twilioClient.messages.create({
          body: `Call Summary:\n\n${summary}`,
          to: call.from,
          from: process.env.TWILIO_PHONE_NUMBER || '+1234567890'
        });
        return res.status(200).send();
      } catch (error) {
        console.error('Error handling call end:', error);
        return res.status(500).send('Error handling call end');
      }
    }
  }

  return res.status(200).send();
}

export function handleSMS(req, res) {
  const { From, Body } = req.body;

  if (!From || !Body) {
    return res.status(400).send('Missing required parameters');
  }

  const response = Body.toLowerCase();
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (response === 'yes') {
    twiml += '<Message>Thank you for your consent. You will receive updates and resources.</Message>';
  } else if (response === 'stop') {
    twiml += '<Message>You have been unsubscribed from further messages.</Message>';
  } else {
    twiml += '<Message>Would you like to receive follow-up messages? Please reply with yes or stop.</Message>';
  }

  twiml += '</Response>';
  res.type('text/xml').send(twiml);
}

router.post('/webhook', handleTwilioWebhook);
router.post('/consent', handleConsent);
router.post('/status', handleStatus);
router.post('/sms', handleSMS);

export default router; 