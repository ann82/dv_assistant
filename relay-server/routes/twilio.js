import express from 'express';
import { config, validateTwilioRequest, TwilioVoiceHandler, logger, callTavilyAPI, callGPT, getIntent, intentHandlers, rewriteQuery, generateSpeechHash } from '../lib/index.js';
import twilio from 'twilio';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { VoiceResponse } from 'twilio/lib/twiml/VoiceResponse.js';

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
  if (!wsServer) {
    throw new Error('WebSocket server not initialized');
  }
  return wsServer;
};

// Add after other global variables
const processedSpeechResults = new Map();
const callContexts = new Map();

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
      speechTimeout: '15',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: '30'
    });

    logger.info('Sending TwiML response:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error processing voice request:', error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("I'm having trouble processing your request. Please try again.");
    twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: '15',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: '30'
    });
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

router.post('/voice/process', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const { CallSid, From, SpeechResult, Confidence } = req.body;

    if (!CallSid || !From) {
      logger.error('Missing required parameters:', { CallSid, From });
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say("I'm having trouble processing your request. Please try again.");
      twiml.gather({
        input: 'speech',
        action: '/twilio/voice/process',
        method: 'POST',
        speechTimeout: '15',
        speechModel: 'phone_call',
        enhanced: 'true',
        language: 'en-US',
        timeout: '30'
      });
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

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

    const response = await processSpeechResult(CallSid, SpeechResult);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(response);

    twiml.pause({ length: 1 });

    const gather = twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: '15',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: '30'
    });

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error processing request:', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("I'm having trouble processing your request. Please try again.");
    twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: '15',
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: '30'
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

async function processSpeechResult(callSid, speechResult) {
  try {
    // Generate hash to prevent duplicate processing
    const hash = generateSpeechHash(callSid, speechResult);
    
    // Check if we've already processed this speech result
    if (processedSpeechResults.has(hash)) {
      logger.info('Duplicate speech result detected, skipping processing');
      return null;
    }

    // Store the hash with timestamp
    processedSpeechResults.set(hash, Date.now());

    // Clean up old entries (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, timestamp] of processedSpeechResults.entries()) {
      if (timestamp < fiveMinutesAgo) {
        processedSpeechResults.delete(key);
      }
    }

    // Get intent and rewrite query
    const intent = await getIntent(speechResult);
    const rewrittenQuery = rewriteQuery(speechResult, intent);
    
    logger.info('Intent classification result:', { 
      original: speechResult,
      rewritten: rewrittenQuery,
      intent 
    });

    // Route based on intent
    const responseType = await intentHandlers[intent](rewrittenQuery);
    
    if (responseType === 'shelter_search' || responseType === 'resource_search') {
      logger.info('Resource search needed, calling Tavily API');
      const searchResult = await callTavilyAPI(rewrittenQuery);
      return searchResult;
    } else {
      logger.info('General response needed, calling GPT');
      const gptResponse = await callGPT(rewrittenQuery);
      return gptResponse.text;
    }
  } catch (error) {
    logger.error('Error processing speech result:', error);
    throw error;
  }
}

function formatTavilyResponse(tavilyResponse) {
  return `I found some resources that might help:
1. Safe House of Santa Clara County - 24/7 hotline: 408-279-2962
2. Next Door Solutions - Domestic violence services: 408-279-2962
3. Community Solutions - Emergency shelter: 408-278-2160

Would you like more information about any of these resources?`;
}

router.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus } = req.body;
    
    if (!CallSid || !CallStatus) {
      logger.error('Missing required parameters in status update:', { CallSid, CallStatus });
      return res.status(400).send('Missing required parameters');
    }

    logger.info(`Processing call status update:`, {
      CallSid,
      CallStatus,
      timestamp: new Date().toISOString()
    });

    await twilioVoiceHandler.handleCallStatusUpdate(CallSid, CallStatus);
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling call status update:', error);
    res.status(200).send('OK');
  }
});

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

router.post('/sms', async (req, res) => {
  try {
    const { From, Body } = req.body;
    logger.info('Received SMS:', { from: From, body: Body });

    const twiml = new twilio.twiml.MessagingResponse();
    
    const consentKeywords = ['yes', 'agree', 'consent', 'ok', 'okay', 'sure'];
    const isConsentMessage = consentKeywords.some(keyword => 
      Body.toLowerCase().includes(keyword)
    );

    const optOutKeywords = ['stop', 'unsubscribe', 'opt out', 'cancel'];
    const isOptOutMessage = optOutKeywords.some(keyword => 
      Body.toLowerCase().includes(keyword)
    );

    if (isOptOutMessage) {
      twiml.message('You have been unsubscribed from follow-up messages. You will no longer receive SMS updates.');
    } else if (isConsentMessage) {
      twiml.message('Thank you for your consent. You will receive follow-up messages about your call summary and support resources.');
    } else {
      twiml.message('Thank you for your message. Would you like to receive follow-up messages about your call summary and support resources? Please reply with "yes" to consent.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error handling SMS:', error);
    res.status(500).send('Error processing SMS');
  }
});

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
    
    if (!CallSid || !From || !SpeechResult) {
      logger.warn(`[Request ${requestId}] Missing required parameters`);
      return res.status(400).send('Missing required parameters');
    }

    const consentKeywords = ['yes', 'agree', 'consent', 'ok', 'okay', 'sure'];
    const isConsent = consentKeywords.some(keyword => 
      SpeechResult.toLowerCase().includes(keyword)
    );

    const twiml = new twilio.twiml.VoiceResponse();
    
    if (isConsent) {
      twiml.say('Thank you for your consent. You will receive follow-up messages about your call summary and support resources.');
    } else {
      twiml.say('I understand you do not wish to receive follow-up messages. You will not receive any SMS updates.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error(`[Request ${requestId}] Error processing consent:`, error);
    res.status(500).send('Error processing consent');
  }
});

export async function handleIncomingCall(req, res) {
  try {
    const callSid = req.body.CallSid;
    const from = req.body.From;
    
    const context = {
      phoneNumber: from,
      requestType: 'phone',
      lastShelterSearch: null
    };

    const twiml = new VoiceResponse();
    
    const gather = twiml.gather({
      input: 'speech',
      action: `/twilio/speech/${callSid}`,
      method: 'POST',
      speechTimeout: 'auto',
      enhanced: true,
      speechModel: 'phone_call'
    });

    gather.say('Hello, I can help you find domestic violence shelters and resources. What would you like to know?');

    twiml.redirect(`/twilio/speech/${callSid}`);

    res.type('text/xml');
    res.send(twiml.toString());

    callContexts.set(callSid, context);

  } catch (error) {
    logger.error('Error handling incoming call:', error);
    res.status(500).send('Error processing call');
  }
}

export default router;