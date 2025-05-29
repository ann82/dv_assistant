import { AudioService } from '../services/audioService.js';
import fs from 'fs/promises';
import path from 'path';

const audioService = new AudioService();

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