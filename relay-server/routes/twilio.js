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

// Function to fetch and log Twilio call details
async function logTwilioCallDetails(callSid) {
  try {
    // Fetch call details
    const call = await twilioClient.calls(callSid).fetch();
    logger.info('Twilio Call Details:', {
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
      logger.info('Call Recordings:', recordings.map(r => ({
        sid: r.sid,
        duration: r.duration,
        status: r.status,
        uri: r.uri
      })));
    }

    // Fetch call logs using the correct API
    const logs = await twilioClient.calls(callSid).fetch();
    logger.info('Call Logs:', {
      timestamp: new Date().toISOString(),
      status: logs.status,
      duration: logs.duration,
      errorCode: logs.errorCode,
      errorMessage: logs.errorMessage,
      answeredBy: logs.answeredBy,
      parentCallSid: logs.parentCallSid
    });

  } catch (error) {
    logger.error('Error fetching Twilio call details:', error);
    // Log additional error details for debugging
    if (error.code) {
      logger.error('Twilio Error Code:', error.code);
    }
    if (error.moreInfo) {
      logger.error('Twilio Error Info:', error.moreInfo);
    }
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
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;
    logger.info('Processing speech result:', { callSid: CallSid, speechResult: SpeechResult, confidence: Confidence });

    // Process the speech result and generate response
    const response = await processSpeechResult(SpeechResult);
    
    const twiml = new twilio.twiml.VoiceResponse();
    
    // First say the response
    twiml.say(response);
    
    // Add a pause to let the user process the information
    twiml.pause({ length: 1 });
    
    // Then gather the next input
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
    logger.error('Error processing speech:', error);
    res.status(500).send('Error processing speech');
  }
});

async function processSpeechResult(speechResult) {
  try {
    logger.info('Starting speech processing for:', speechResult);
    
    // Check if we need to search for resources
    const needsResourceSearch = speechResult.toLowerCase().includes('find') || 
                              speechResult.toLowerCase().includes('search') ||
                              speechResult.toLowerCase().includes('near') ||
                              speechResult.toLowerCase().includes('location');
    
    let response;
    if (needsResourceSearch) {
      logger.info('Resource search needed, calling Tavily API');
      const tavilyResponse = await callTavilyAPI(speechResult);
      logger.info('Tavily API response:', tavilyResponse);
      
      // Format Tavily response
      response = formatTavilyResponse(tavilyResponse);
    } else {
      logger.info('No resource search needed, using GPT for general response');
      const gptResponse = await callGPT(speechResult);
      logger.info('GPT response:', gptResponse);
      
      response = gptResponse.text;
    }

    return response;
  } catch (error) {
    logger.error('Error in processSpeechResult:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again.';
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
      logger.warn(`[Request ${requestId}] Missing required parameters:`, {
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
      logger.warn(`[Request ${requestId}] Invalid phone number format:`, {
        phoneNumber: From,
        timestamp: new Date().toISOString()
      });
      return res.status(400).send('Invalid phone number format');
    }

    // Validate speech result
    if (SpeechResult.length < 1 || SpeechResult.length > 1000) {
      logger.warn(`[Request ${requestId}] Invalid speech result length:`, {
        length: SpeechResult.length,
        timestamp: new Date().toISOString()
      });
      return res.status(400).send('Invalid speech result');
    }

    logger.info(`[Request ${requestId}] Processing consent response:`, {
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

    logger.info(`[Request ${requestId}] Consent analysis:`, {
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

        logger.info(`[Request ${requestId}] Consent status updated:`, {
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
        logger.warn(`[Request ${requestId}] No active call found for consent response:`, {
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
    logger.info(`[Request ${requestId}] Sending TwiML response:`, {
      length: twimlString.length,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });

    res.type('text/xml');
    res.send(twimlString);
  } catch (error) {
    logger.error(`[Request ${requestId}] Error handling consent:`, {
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