import express from 'express';
import { config } from '../lib/config.js';
import twilio from 'twilio';
import { validateTwilioRequest } from '../lib/twilio.js';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import { TwilioVoiceHandler } from '../lib/twilioVoice.js';
import logger from '../lib/logger.js';
import { callTavilyAPI, callGPT } from '../lib/apis.js';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Initialize Twilio client with environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  logger.error('Twilio credentials not found in environment variables');
  throw new Error('Twilio credentials not found in environment variables');
}

const twilioClient = twilio(accountSid, authToken);
logger.info('Twilio client initialized successfully');

const twilioVoiceHandler = new TwilioVoiceHandler(
  config.TWILIO_ACCOUNT_SID,
  config.TWILIO_AUTH_TOKEN,
  config.TWILIO_PHONE_NUMBER
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

// Add after other global variables
const processedSpeechResults = new Map();

// Add this function before processSpeechResult
export function generateSpeechHash(callSid, speechResult) {
  return createHash('md5')
    .update(`${callSid}:${speechResult}`)
    .digest('hex');
}

// Function to fetch and log Twilio call details
async function fetchCallDetails(callSid) {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const call = await client.calls(callSid).fetch();
    logger.info('Call details:', {
      callSid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime
    });
    return call;
  } catch (error) {
    logger.error('Error fetching call details:', error);
    return null;
  }
}

// Clean up audio files
async function cleanupAudioFile(audioPath) {
  try {
    if (fsSync.existsSync(audioPath)) {
      await fs.unlink(audioPath);
      logger.info('Cleaned up audio file:', audioPath);
    }
  } catch (error) {
    logger.error('Error cleaning up audio file:', error);
  }
}

// Apply validation to all Twilio routes
router.use(validateTwilioRequest);

// Log when the router is initialized
logger.info('Initializing Twilio routes');

// Test route to verify logging
router.get('/test', (req, res) => {
  logger.info('Test route hit');
  res.json({ message: 'Test route working' });
});

// Log all incoming requests
router.use((req, res, next) => {
  logger.info('Incoming Twilio request:', {
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
});

router.post('/voice', async (req, res) => {
  try {
    logger.info('Processing voice request:', req.body);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Welcome to the Domestic Violence Support Assistant. How can I help you today?');
    twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US'
    });

    logger.info('Sending TwiML response:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error processing voice request:', error);
    res.status(500).send('Error processing request');
  }
});

router.post('/voice/process', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const { CallSid, From, SpeechResult, Confidence } = req.body;

    logger.info('Incoming Twilio request:', {
      requestId,
      method: req.method,
      path: req.path,
      headers: req.headers
    });

    logger.info('Processing speech result:', {
      requestId,
      callSid: CallSid,
      speechResult: SpeechResult,
      confidence: Confidence
    });

    // Process the speech result and generate response
    const response = await processSpeechResult(CallSid, SpeechResult, Confidence);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(response);

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

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error processing request:', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).send('Error processing request');
  }
});

// Function to process speech results
export async function processSpeechResult(callSid, speechResult, confidence) {
  try {
    logger.info('Processing speech result:', {
      callSid,
      speechResult,
      confidence
    });

    // Generate hash for this speech result
    const speechHash = generateSpeechHash(callSid, speechResult);

    // Check if we've already processed this exact speech result
    if (processedSpeechResults.has(speechHash)) {
      logger.info('Skipping duplicate speech result:', {
        callSid,
        speechResult,
        hash: speechHash
      });
      return;
    }

    // Store the hash to prevent duplicate processing
    processedSpeechResults.set(speechHash, Date.now());

    // Clean up old entries (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [hash, timestamp] of processedSpeechResults.entries()) {
      if (timestamp < fiveMinutesAgo) {
        processedSpeechResults.delete(hash);
      }
    }

    // Check if we need to search for resources
    const resourceKeywords = ['shelter', 'help', 'resource', 'service', 'support', 'assistance'];
    const needsResourceSearch = resourceKeywords.some(keyword => 
      speechResult.toLowerCase().includes(keyword)
    );

    if (needsResourceSearch) {
      logger.info('Resource search needed, calling Tavily API');
      const searchResult = await callTavilyAPI(speechResult);
      return searchResult;
    } else {
      logger.info('General response needed, calling GPT');
      const gptResponse = await callGPT(speechResult);
      return gptResponse.text;
    }
  } catch (error) {
    logger.error('Error in processSpeechResult:', error);
    throw error;
  }
}

function formatTavilyResponse(tavilyResponse) {
  // TODO: Implement proper formatting of Tavily response
  return `I found some resources that might help:
1. Safe House of Santa Clara County - 24/7 hotline: 408-279-2962
2. Next Door Solutions - Domestic violence services: 408-279-2962
3. Community Solutions - Emergency shelter: 408-278-2160

Would you like more information about any of these resources?`;
}

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
    logger.error('Error handling call status update:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle call recordings
router.post('/recording', (req, res) => {
  try {
    const recordingSid = req.body.RecordingSid;
    const recordingUrl = req.body.RecordingUrl;
    const callSid = req.body.CallSid;

    logger.info(`Recording completed for call ${callSid}`);
    logger.info(`Recording SID: ${recordingSid}`);
    logger.info(`Recording URL: ${recordingUrl}`);

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling recording:', error);
    res.status(500).send('Error processing recording');
  }
});

// Handle incoming SMS messages
router.post('/sms', async (req, res) => {
  try {
    const { From, Body } = req.body;
    logger.info('Received SMS:', { from: From, body: Body });

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
    logger.error('Error handling SMS:', error);
    res.status(500).send('Error processing SMS');
  }
});

// Handle consent response
router.post('/consent', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    logger.info(`[Request ${requestId}] Processing consent request:`, {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      memoryUsage: process.memoryUsage()
    });

    const { CallSid, From, SpeechResult } = req.body;
    
    // Enhanced validation
    if (!CallSid || !From || !SpeechResult) {
      logger.warn(`
```
export { processSpeechResult };
export default router;