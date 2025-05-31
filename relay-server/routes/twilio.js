import express from 'express';
import { config } from '../lib/config.js';
import twilio from 'twilio';
import { validateTwilioRequest } from '../lib/twilio.js';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import { TwilioVoiceHandler } from '../lib/twilioVoice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
const twilioVoiceHandler = new TwilioVoiceHandler(
  config.twilio.accountSid,
  config.twilio.authToken,
  config.twilio.phoneNumber
);

// Store WebSocket server instance
let wsServer = null;

// Add a setter for the WebSocket server
router.setWebSocketServer = (server, mockServer) => {
  wsServer = server;
  if (mockServer) {
    twilioVoiceHandler.setWebSocketServer(mockServer);
  }
};

// Get the global WebSocket server instance
const getWebSocketServer = () => {
  if (!global.wss) {
    throw new Error('WebSocket server or audio service not initialized');
  }
  return global.wss;
};

// Function to fetch and log Twilio call details
async function logTwilioCallDetails(callSid) {
  try {
    // Fetch call details
    const call = await twilioClient.calls(callSid).fetch();
    console.log('Twilio Call Details:', {
      sid: call.sid,
      status: call.status,
      direction: call.direction,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      price: call.price,
      priceUnit: call.priceUnit
    });

    // Fetch call recordings
    const recordings = await twilioClient.recordings.list({ callSid });
    if (recordings.length > 0) {
      console.log('Call Recordings:', recordings.map(r => ({
        sid: r.sid,
        duration: r.duration,
        status: r.status,
        uri: r.uri
      })));
    }

    // Fetch call logs using the correct API
    const logs = await twilioClient.calls(callSid).fetch();
    console.log('Call Logs:', {
      timestamp: new Date().toISOString(),
      status: logs.status,
      duration: logs.duration,
      errorCode: logs.errorCode,
      errorMessage: logs.errorMessage,
      answeredBy: logs.answeredBy,
      parentCallSid: logs.parentCallSid
    });

  } catch (error) {
    console.error('Error fetching Twilio call details:', error);
    // Log additional error details for debugging
    if (error.code) {
      console.error('Twilio Error Code:', error.code);
    }
    if (error.moreInfo) {
      console.error('Twilio Error Info:', error.moreInfo);
    }
  }
}

// Clean up audio files
async function cleanupAudioFile(audioPath) {
  try {
    if (fsSync.existsSync(audioPath)) {
      await fs.unlink(audioPath);
      console.log('Cleaned up audio file:', audioPath);
    }
  } catch (error) {
    console.error('Error cleaning up audio file:', error);
  }
}

// Apply validation to all Twilio routes
router.use(validateTwilioRequest);

router.post('/voice', (req, res) => {
  try {
    console.log('Voice Route - Request Body:', req.body);
    console.log('Voice Route - CallSid:', req.body.CallSid);
    
    // Log Twilio call details when call starts
    logTwilioCallDetails(req.body.CallSid);
    
    const domain = req.get('host');
    const twiml = new twilio.twiml.VoiceResponse();

    // Add welcome message
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'Welcome to the Domestic Violence Support Assistant. I\'m here to help you.');

    // Add a pause to let the user respond
    twiml.pause({ length: 1 });

    // Configure speech recognition
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US'
    });

    // Add a prompt for the user
    gather.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How can I help you today?');

    // Register the call with WebSocket server
    const wss = getWebSocketServer();
    wss.registerCall(req.body.CallSid);

    // Start media stream
    const connect = twiml.connect();
    connect.stream({
      url: `wss://${domain}/twilio-stream`,
      track: 'inbound_track'
    });

    const twimlString = twiml.toString();
    console.log('Generated TwiML:', twimlString);
    
    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    console.error('Error in Twilio voice route:', error);
    res.status(500).send('Error processing voice request');
  }
});

// Handle call status updates
router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus } = req.body;
    
    if (!CallSid || !CallStatus) {
      return res.status(400).send('Missing required parameters');
    }

    await twilioVoiceHandler.handleCallStatusUpdate(CallSid, CallStatus);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling call status update:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle call recordings
router.post('/recording', (req, res) => {
  try {
    const recordingSid = req.body.RecordingSid;
    const recordingUrl = req.body.RecordingUrl;
    const callSid = req.body.CallSid;

    console.log(`Recording completed for call ${callSid}`);
    console.log(`Recording SID: ${recordingSid}`);
    console.log(`Recording URL: ${recordingUrl}`);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling recording:', error);
    res.status(500).send('Error processing recording');
  }
});

// Refactored handler for /voice/process
export async function handleTwilioWebhook(req, res) {
  try {
    console.log('Processing speech result:', {
      callSid: req.body.CallSid,
      speechResult: req.body.SpeechResult,
      confidence: req.body.Confidence
    });

    const wss = getWebSocketServer();
    if (!wss || !wss.audioService) {
      throw new Error('WebSocket server or audio service not initialized');
    }

    const twiml = new twilio.twiml.VoiceResponse();
    // Get GPT response for the speech result
    console.log('Getting GPT response...');
    const gptResponse = await wss.audioService.getGptReply(req.body.SpeechResult);
    console.log('GPT Response:', gptResponse);

    if (!gptResponse || !gptResponse.text) {
      throw new Error('Invalid GPT response');
    }

    // Truncate response if it's too long (Twilio has a limit)
    const maxResponseLength = 1000; // Adjust this value based on testing
    let truncatedText = gptResponse.text;
    if (truncatedText.length > maxResponseLength) {
      // First, try to find the last complete resource entry
      const resourceMatches = truncatedText.match(/\d+\.\s+\*\*[^*]+\*\*:.*?(?=\n\n|\d+\.\s+\*\*|$)/gs);
      if (resourceMatches) {
        // Find the last complete resource that fits within the limit
        let totalLength = 0;
        let lastCompleteResource = '';
        for (const resource of resourceMatches) {
          if (totalLength + resource.length <= maxResponseLength) {
            totalLength += resource.length;
            lastCompleteResource = resource;
          } else {
            break;
          }
        }
        // If we found a complete resource, use it
        if (lastCompleteResource) {
          const lastResourceIndex = truncatedText.lastIndexOf(lastCompleteResource) + lastCompleteResource.length;
          truncatedText = truncatedText.substring(0, lastResourceIndex);
        } else {
          // If no complete resource fits, find the last complete sentence
          const lastPeriod = truncatedText.substring(0, maxResponseLength).lastIndexOf('.');
          if (lastPeriod > 0) {
            truncatedText = truncatedText.substring(0, lastPeriod + 1);
          } else {
            // If no period found, find the last space
            const lastSpace = truncatedText.substring(0, maxResponseLength).lastIndexOf(' ');
            if (lastSpace > 0) {
              truncatedText = truncatedText.substring(0, lastSpace) + '...';
            } else {
              truncatedText = truncatedText.substring(0, maxResponseLength) + '...';
            }
          }
        }
      } else {
        // If no resource pattern found, fall back to sentence-based truncation
        const lastPeriod = truncatedText.substring(0, maxResponseLength).lastIndexOf('.');
        if (lastPeriod > 0) {
          truncatedText = truncatedText.substring(0, lastPeriod + 1);
        } else {
          const lastSpace = truncatedText.substring(0, maxResponseLength).lastIndexOf(' ');
          if (lastSpace > 0) {
            truncatedText = truncatedText.substring(0, lastSpace) + '...';
          } else {
            truncatedText = truncatedText.substring(0, maxResponseLength) + '...';
          }
        }
      }
    }

    // Generate TTS for the response
    console.log('Generating TTS...');
    const ttsResponse = await wss.audioService.generateTTS(truncatedText);
    console.log('TTS Response:', ttsResponse);

    if (!ttsResponse || !ttsResponse.audioPath) {
      throw new Error('Invalid TTS response');
    }

    // Get the full URL for the audio file
    const domain = req.get('host');
    const audioUrl = `https://${domain}${ttsResponse.audioPath}`;
    console.log('Audio URL:', audioUrl);

    // Verify the audio file exists and is completely written
    console.log('Verifying audio file...');
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second

    while (retryCount < maxRetries) {
      try {
        // Check if file exists
        if (!fsSync.existsSync(ttsResponse.fullPath)) {
          throw new Error('Audio file not found: ' + ttsResponse.fullPath);
        }
        // Get file stats
        const stats = await fs.stat(ttsResponse.fullPath);
        // Verify file size is greater than 0
        if (stats.size === 0) {
          throw new Error('Audio file is empty');
        }
        // Verify file is not being written to
        const initialSize = stats.size;
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        const finalSize = (await fs.stat(ttsResponse.fullPath)).size;
        if (initialSize !== finalSize) {
          throw new Error('Audio file is still being written');
        }
        console.log('Audio file verified:', {
          path: ttsResponse.fullPath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
        // File is ready, break the retry loop
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error('Failed to verify audio file after retries:', error);
          throw error;
        }
        console.log(`Retry ${retryCount}/${maxRetries} - Waiting for audio file to be ready...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // First play the response
    twiml.play(audioUrl);
    // Add a pause to let the user respond
    twiml.pause({ length: 2 });
    // Then set up the next gather
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: 10
    });
    gather.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How else can I help you?');
    const twimlString = twiml.toString();
    console.log('Generated TwiML:', twimlString);
    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    console.error('Error processing speech result:', error);
    console.error('Error stack:', error.stack);
    // Generate error TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'I apologize, but I encountered an error. Please try again.');
    // Add a pause
    twiml.pause({ length: 1 });
    // Set up the next gather
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US'
    });
    gather.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How can I help you?');
    const twimlString = twiml.toString();
    console.log('Error TwiML:', twimlString);
    res.type('text/xml');
    res.send(twimlString);
  }
}

// Attach the named handler to the router
router.post('/voice/process', handleTwilioWebhook);

// Handle incoming SMS messages
router.post('/sms', async (req, res) => {
  try {
    const { From, Body } = req.body;
    console.log('Received SMS:', { from: From, body: Body });

    const twiml = new twilio.twiml.MessagingResponse();
    
    // Check if this is a consent message
    const consentKeywords = ['yes', 'agree', 'consent', 'ok', 'okay', 'sure'];
    const isConsentMessage = consentKeywords.some(keyword => 
      Body.toLowerCase().includes(keyword)
    );

    // Check if this is an opt-out message
    const optOutKeywords = ['stop', 'unsubscribe', 'opt out', 'cancel'];
    const isOptOutMessage = optOutKeywords.some(keyword => 
      Body.toLowerCase().includes(keyword)
    );

    if (isOptOutMessage) {
      // Handle opt-out
      twiml.message('You have been unsubscribed from follow-up messages. You will no longer receive SMS updates.');
      // TODO: Update user's consent status in database
    } else if (isConsentMessage) {
      // Handle consent
      twiml.message('Thank you for your consent. You will receive follow-up messages about your call summary and support resources.');
      // TODO: Update user's consent status in database
    } else {
      // Default response without assuming consent
      twiml.message('Thank you for your message. Would you like to receive follow-up messages about your call summary and support resources? Please reply with "yes" to consent.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling SMS:', error);
    res.status(500).send('Error processing SMS');
  }
});

// Handle consent response
router.post('/consent', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[Request ${requestId}] Processing consent request:`, {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      memoryUsage: process.memoryUsage()
    });

    const { CallSid, From, SpeechResult } = req.body;
    
    // Enhanced validation
    if (!CallSid || !From || !SpeechResult) {
      console.warn(`[Request ${requestId}] Missing required parameters:`, {
        callSid: CallSid,
        from: From,
        hasSpeechResult: !!SpeechResult,
        timestamp: new Date().toISOString()
      });
      return res.status(400).send('Missing required parameters');
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(From)) {
      console.warn(`[Request ${requestId}] Invalid phone number format:`, {
        phoneNumber: From,
        timestamp: new Date().toISOString()
      });
      return res.status(400).send('Invalid phone number format');
    }

    // Validate speech result
    if (SpeechResult.length < 1 || SpeechResult.length > 1000) {
      console.warn(`[Request ${requestId}] Invalid speech result length:`, {
        length: SpeechResult.length,
        timestamp: new Date().toISOString()
      });
      return res.status(400).send('Invalid speech result');
    }

    console.log(`[Request ${requestId}] Processing consent response:`, {
      callSid: CallSid,
      from: From,
      speechResult: SpeechResult,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime
    });

    const twiml = new twilio.twiml.VoiceResponse();
    
    // Enhanced keyword matching with confidence scores
    const consentKeywords = [
      { word: 'yes', score: 1.0 },
      { word: 'yeah', score: 0.9 },
      { word: 'sure', score: 0.8 },
      { word: 'okay', score: 0.8 },
      { word: 'ok', score: 0.7 },
      { word: 'agree', score: 0.9 },
      { word: 'please', score: 0.6 },
      { word: 'go ahead', score: 0.8 }
    ];
    
    const optOutKeywords = [
      { word: 'no', score: 1.0 },
      { word: 'nope', score: 0.9 },
      { word: 'don\'t', score: 0.8 },
      { word: 'stop', score: 0.9 },
      { word: 'cancel', score: 0.8 },
      { word: 'opt out', score: 1.0 }
    ];
    
    // Calculate consent score
    const consentScore = consentKeywords.reduce((max, { word, score }) => {
      const match = SpeechResult.toLowerCase().includes(word);
      return match ? Math.max(max, score) : max;
    }, 0);

    const optOutScore = optOutKeywords.reduce((max, { word, score }) => {
      const match = SpeechResult.toLowerCase().includes(word);
      return match ? Math.max(max, score) : max;
    }, 0);

    const isConsent = consentScore > optOutScore && consentScore >= 0.7;
    const isOptOut = optOutScore > consentScore && optOutScore >= 0.7;

    console.log(`[Request ${requestId}] Consent analysis:`, {
      consentScore,
      optOutScore,
      isConsent,
      isOptOut,
      timestamp: new Date().toISOString()
    });

    // Store consent status with enhanced logging
    const wss = getWebSocketServer();
    if (wss) {
      const call = wss.activeCalls.get(CallSid);
      if (call) {
        const previousConsent = call.hasConsent;
        call.hasConsent = isConsent;
        call.consentTimestamp = new Date().toISOString();
        call.consentResponse = SpeechResult;
        call.consentScores = {
          consent: consentScore,
          optOut: optOutScore
        };
        wss.activeCalls.set(CallSid, call);

        console.log(`[Request ${requestId}] Consent status updated:`, {
          callSid: CallSid,
          from: From,
          previousConsent,
          newConsent: isConsent,
          timestamp: call.consentTimestamp,
          response: SpeechResult,
          scores: call.consentScores,
          processingTime: Date.now() - startTime
        });
      } else {
        console.warn(`[Request ${requestId}] No active call found for consent response:`, {
          callSid: CallSid,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Acknowledge consent decision with appropriate message
    if (isConsent) {
      twiml.say({
        voice: 'Polly.Amy',
        language: 'en-US'
      }, 'Thank you. You will receive a summary and resources after the call.');
    } else if (isOptOut) {
      twiml.say({
        voice: 'Polly.Amy',
        language: 'en-US'
      }, 'Understood. You will not receive any follow-up messages.');
    } else {
      // Handle unclear response
      twiml.say({
        voice: 'Polly.Amy',
        language: 'en-US'
      }, 'I didn\'t quite understand. For your privacy, I\'ll assume you don\'t want follow-up messages. You can always call back if you change your mind.');
    }

    // Add a pause
    twiml.pause({ length: 1 });

    // Continue with the main conversation
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, 'How can I help you today?');

    // Set up the next gather for the main conversation
    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US'
    });

    const twimlString = twiml.toString();
    console.log(`[Request ${requestId}] Sending TwiML response:`, {
      length: twimlString.length,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    console.error(`[Request ${requestId}] Error handling consent:`, {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      memoryUsage: process.memoryUsage()
    });
    res.status(500).send('Error processing consent');
  }
});

export default router; 