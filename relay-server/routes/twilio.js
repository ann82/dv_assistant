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
import pkg from 'twilio/lib/twiml/VoiceResponse.js';
const { VoiceResponse } = pkg;
import { getIntent, intentHandlers, rewriteQuery } from '../lib/intentClassifier.js';
import { generateSpeechHash } from '../lib/utils.js';

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
  logger.info('--- /twilio/voice endpoint hit ---');
  logger.info('Request body:', req.body);
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
    res.write(twiml.toString());
    res.end();
    logger.info('--- /twilio/voice endpoint response sent ---');
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
    logger.info('--- /twilio/voice endpoint error response sent ---');
  }
});

router.post('/voice/process', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  logger.info('=== Starting new voice process request ===', {
    requestId,
    timestamp: new Date().toISOString(),
    url: req.originalUrl,
    method: req.method
  });

  try {
    logger.info('Raw request body:', {
      requestId,
      body: req.body,
      headers: req.headers,
      query: req.query
    });

    const { CallSid, From, SpeechResult, Confidence } = req.body;

    // Validate all required parameters
    if (!CallSid || !From || !SpeechResult) {
      logger.error('Missing required parameters:', { 
        requestId,
        CallSid, 
        From, 
        SpeechResult,
        hasConfidence: !!Confidence,
        rawBody: req.body
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
      return;
    }

    // Process the speech result
    const response = await processSpeechResult(CallSid, SpeechResult, requestId);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(response);
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

    logger.info('=== Completed voice process request ===', {
      requestId,
      duration: Date.now() - startTime
    });
  } catch (error) {
    logger.error('Error processing voice request:', {
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

async function processSpeechResult(callSid, speechResult, requestId) {
  try {
    logger.info('Processing speech result:', {
      requestId,
      callSid,
      speechResult
    });

    // Call Tavily API to get relevant resources
    const tavilyResponse = await callTavilyAPI(speechResult);
    logger.info('Tavily API response:', {
      requestId,
      response: tavilyResponse
    });

    // Format the response
    const formattedResponse = formatTavilyResponse(tavilyResponse);
    logger.info('Formatted response:', {
      requestId,
      response: formattedResponse
    });

    return formattedResponse;
  } catch (error) {
    logger.error('Error processing speech result:', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export const formatTavilyResponse = (tavilyResponse) => {
  try {
    if (!tavilyResponse || !tavilyResponse.results || tavilyResponse.results.length === 0) {
      return "I'm sorry, I couldn't find any specific resources for that location. Would you like me to search for resources in a different location?";
    }

    const results = tavilyResponse.results.slice(0, 3); // Only use first 3 results
    let formattedResponse = "I found some resources that might help:\n\n";

    results.forEach((result, index) => {
      // Extract organization name from title
      const orgName = result.title?.split('|')[0]?.trim() || 
                     result.title?.split('-')[0]?.trim() || 
                     'Unknown Organization';

      // Extract phone number if present
      const phoneMatch = result.content?.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
      const phoneNumber = phoneMatch ? phoneMatch[0] : null;

      // Extract location/coverage area if present
      const coverageMatch = result.content?.match(/Coverage Area:?\s*([^.]+)/i);
      const coverageArea = coverageMatch ? coverageMatch[1].trim() : null;

      formattedResponse += `${index + 1}. ${orgName}\n`;
      if (phoneNumber) {
        formattedResponse += `   Phone: ${phoneNumber}\n`;
      }
      if (coverageArea) {
        formattedResponse += `   Coverage: ${coverageArea}\n`;
      }
      formattedResponse += '\n';
    });

    formattedResponse += "Would you like more information about any of these resources?";
    return formattedResponse;
  } catch (error) {
    logger.error('Error formatting Tavily response:', error);
    return "I'm sorry, I'm having trouble formatting the search results. Please try asking your question again.";
  }
};

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