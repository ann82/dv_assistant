import express from 'express';
import { config } from '../lib/config.js';
import twilio from 'twilio';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
// Legacy TwilioVoiceHandler import removed - now using HandlerManager
import logger from '../lib/logger.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';
import { OpenAIIntegration } from '../integrations/openaiIntegration.js';
import { createHash } from 'crypto';
import pkg from 'twilio/lib/twiml/VoiceResponse.js';
const { VoiceResponse } = pkg;
// Legacy intent classifier imports removed - now using HandlerManager

import { v4 as uuidv4 } from 'uuid';
// Legacy speech processor and filter config imports removed - now using HandlerManager
import { UnifiedResponseHandler } from '../lib/unifiedResponseHandler.js';
import { welcomeMessage } from '../lib/conversationConfig.js';
// Remove circular import - handlerManager will be injected
import { createTwilioController } from '../controllers/twilioController.js';
import { validateRequest, rateLimiter } from '../middleware/validation.js';
import { enhancedRequestLogger, enhancedErrorLogger, performanceLogger } from '../middleware/logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a factory function to create the router with injected dependencies
function createTwilioRouter(handlerManager) {
  logger.info('Creating Twilio router...');
  const router = express.Router();
  
  // Create the Twilio controller with injected handlerManager
  logger.info('Creating Twilio controller...');
  const twilioController = createTwilioController(handlerManager);
  logger.info('Twilio controller created successfully');

// Initialize TwilioVoiceHandler
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Skip credential check in test environment
if (process.env.NODE_ENV !== 'test') {
  if (!accountSid || !authToken || !phoneNumber) {
    logger.warn('Twilio credentials not found in environment variables, but continuing anyway');
    // Don't throw error, just log warning
  }
}

// Remove old TwilioVoiceHandler initialization and related logic
// const twilioVoiceHandler = new TwilioVoiceHandler(accountSid, authToken, phoneNumber);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
logger.info('Twilio client initialized successfully');

// Store WebSocket server instance
let wsServer = null;

// Add a setter for the WebSocket server
router.setWebSocketServer = (server, mockServer) => {
  wsServer = server;
  // Always set the WebSocket server in the voice handler
  // twilioVoiceHandler.setWebSocketServer(server); // This line is no longer needed
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

// Cache for Tavily API responses
const tavilyCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_SIZE = 1000; // Maximum number of cached responses

// Speech recognition configuration constants
const SPEECH_CONFIG = {
  TIMEOUT: 'auto', // Let Twilio handle timeout automatically
  MODEL: 'phone_call',
  ENHANCED: 'true',
  LANGUAGE: 'en-US',
  SPEECH_RECOGNITION_LANGUAGE: 'en-US',
  PROFANITY_FILTER: 'false',
  SPEECH_TIMEOUT: 'auto',
  INTERIM_SPEECH_RESULTS_CALLBACK: '/twilio/voice/interim'
};

// Function to fetch and log Twilio call details


// Apply enhanced middleware to all routes
router.use(enhancedRequestLogger);
router.use(performanceLogger(2000)); // Log requests taking longer than 2 seconds
router.use(rateLimiter);

// Apply validation to all Twilio routes - moved after twilioVoiceHandler initialization
// Temporarily disabled to fix timeout issues
// router.use(twilioVoiceHandler.validateTwilioRequest.bind(twilioVoiceHandler));

// Log when the router is initialized
logger.info('Initializing Twilio routes with enhanced logging');

// Add a simple test route to verify router mounting
router.get('/test', (req, res) => {
  res.json({ message: 'Twilio router is working', timestamp: new Date().toISOString() });
});

// ============================================================================
// TWILIO VOICE PROCESSING ENDPOINT
// ============================================================================
// This is the main endpoint that processes voice calls from Twilio
// Handles both new calls and speech input from existing calls

/**
 * Main endpoint for processing voice calls from Twilio
 * Handles both new calls and speech input from existing calls
 * 
 * @route POST /twilio/voice
 * @param {Object} req.body.CallSid - Twilio call SID
 * @param {Object} req.body.SpeechResult - Transcribed speech (if available)
 * @returns {string} TwiML response for Twilio
 */
router.post('/voice', validateRequest('twilioVoice'), async (req, res) => {
  try {
    // Use HandlerManager to process the voice call
    const result = await handlerManager.processVoiceCall(req);
    if (result && result.data && result.data.twiml) {
      res.type('text/xml');
      res.send(result.data.twiml);
    } else if (result && result.twiml) {
      res.type('text/xml');
      res.send(result.twiml);
    } else {
      res.status(500).send('No TwiML response generated');
    }
  } catch (error) {
    logger.error('Error in /twilio/voice:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Endpoint for processing speech input from Twilio
 * This is called when Twilio sends transcribed speech back to the server
 * 
 * @route POST /twilio/voice/process
 * @param {Object} req.body.CallSid - Twilio call SID
 * @param {Object} req.body.SpeechResult - Transcribed speech text
 * @returns {string} TwiML response for Twilio
 */
router.post('/voice/process', validateRequest('twilioVoice'), async (req, res) => {
  // Send immediate acknowledgment to prevent 499 errors
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=15');
  
  // Set a timeout for this specific request - reduced for Twilio compatibility
  const requestTimeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.error('Voice process request timeout:', {
        CallSid: req.body.CallSid,
        SpeechResult: req.body.SpeechResult?.substring(0, 100)
      });
      res.status(408).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">I'm sorry, the request is taking too long. Please try again.</Say>
  <Gather input="speech" action="/twilio/voice/process" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`);
    }
  }, 12000); // Reduced to 12 seconds for Twilio compatibility
  
  try {
    const { CallSid, SpeechResult } = req.body;
    
    if (!CallSid || !SpeechResult) {
      logger.error('Missing required parameters:', { CallSid, SpeechResult });
      clearTimeout(requestTimeout);
      const twiml = await handlerManager.generateTTSBasedTwiML("I didn't catch that. Could you please repeat?", true);
      res.type('text/xml');
      return res.send(twiml);
    }
    
    logger.info('Processing speech:', { CallSid, SpeechResult });
    
    // Ensure call is initialized in voice handler (in case it wasn't initialized in voice endpoint)
    if (!handlerManager.activeCalls.has(CallSid)) {
      handlerManager.activeCalls.set(CallSid, {
        from: req.body.From || 'unknown',
        startTime: Date.now(),
        hasConsent: false,
        conversationHistory: [],
        timeouts: new Set(),
        lastActivity: Date.now()
      });
      logger.info('Initialized call in voice handler during speech processing:', { CallSid, from: req.body.From });
    }
    
    // Preprocess speech input to improve recognition accuracy
    const cleanedSpeechResult = handlerManager.preprocessSpeech(SpeechResult);
    logger.info('Cleaned speech result:', { CallSid, original: SpeechResult, cleaned: cleanedSpeechResult });
    
    // Check if this is a consent response (yes/no to SMS question)
    const lowerSpeech = cleanedSpeechResult.toLowerCase();
    const consentKeywords = ['yes', 'no', 'agree', 'disagree', 'ok', 'okay', 'sure', 'nope'];
    
    // Process the speech input with timeout handling - reduced for Twilio compatibility
    const processedResponse = await Promise.race([
      handlerManager.processSpeechInput(cleanedSpeechResult, CallSid),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), 10000)
      )
    ]);
    
    // Clear the request timeout since we got a response
    clearTimeout(requestTimeout);
    
    // Extract response and flags from processResult (similar to handleSpeechInput)
    const response = typeof processedResponse === 'string' ? processedResponse : processedResponse.response;
    const shouldEndCall = typeof processedResponse === 'object' && processedResponse.shouldEndCall;
    const shouldRedirectToConsent = typeof processedResponse === 'object' && processedResponse.shouldRedirectToConsent;
    
    // Handle consent redirect
    if (shouldRedirectToConsent) {
      logger.info('Redirecting to consent endpoint:', { CallSid, SpeechResult: cleanedSpeechResult });
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(response);
      twiml.redirect('/twilio/consent');
      res.type('text/xml');
      return res.send(twiml.toString());
    }
    
    // Generate TwiML response with timeout handling
    let twiml;
    try {
      twiml = await Promise.race([
        handlerManager.generateTTSBasedTwiML(response, !shouldEndCall),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TwiML generation timeout')), 12000)
        )
      ]);
    } catch (ttsError) {
      logger.error('TTS generation failed, using fallback:', {
        error: ttsError.message,
        CallSid,
        responseLength: response.length
      });
      
      // Quick fallback to Polly TTS to prevent 499 errors
      const fallbackTwiml = new twilio.twiml.VoiceResponse();
      fallbackTwiml.say(response);
      
      if (!shouldEndCall) {
        fallbackTwiml.gather({
          input: 'speech',
          action: '/twilio/voice/process',
          method: 'POST',
          speechTimeout: 'auto',
          speechModel: 'phone_call',
          enhanced: 'true',
          language: 'en-US'
        });
      }
      
      twiml = fallbackTwiml.toString();
    }
    
    res.type('text/xml');
    res.send(twiml);
    
    logger.info('Successfully processed speech:', { CallSid, responseLength: response.length });
    
  } catch (error) {
    clearTimeout(requestTimeout);
    logger.error('Error processing speech:', {
      error: error.message,
      stack: error.stack,
      CallSid: req.body.CallSid
    });
    
    // Send error response
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">I'm sorry, I encountered an error processing your request. Please try again.</Say>
  <Gather input="speech" action="/twilio/voice/process" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`;
    
    res.type('text/xml');
    res.send(errorTwiml);
  }
});

/**
 * Endpoint for handling interim speech results
 * This helps improve speech recognition accuracy by providing real-time feedback
 * 
 * @route POST /twilio/voice/interim
 * @param {Object} req.body.CallSid - Twilio call SID
 * @param {Object} req.body.SpeechResult - Interim transcribed speech text
 * @returns {string} Empty TwiML response (no action needed for interim results)
 */
router.post('/voice/interim', validateRequest('twilioVoice'), async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
      await twilioController.handleInterimSpeech(CallSid, SpeechResult, res);
});



router.post('/status', validateRequest('callStatus'), async (req, res) => {
  const { CallSid, CallStatus } = req.body;
      await twilioController.handleCallStatus(CallSid, CallStatus, res);
});

router.post('/recording', validateRequest('recording'), (req, res) => {
  const { RecordingSid, RecordingUrl, CallSid } = req.body;
      twilioController.handleRecording(RecordingSid, RecordingUrl, CallSid, res);
});

router.post('/sms', validateRequest('twilioSMS'), async (req, res) => {
  const { From, Body } = req.body;
      await twilioController.handleSMS(From, Body, res);
});

// ============================================================================
// CONSENT AND SMS FUNCTIONALITY
// ============================================================================
// These endpoints handle user consent for SMS follow-up messages

/**
 * Handles user consent for receiving SMS follow-up messages
 * This endpoint is called when the system asks if the user wants a summary via text
 * 
 * @route POST /twilio/consent
 * @param {Object} req.body.CallSid - Twilio call SID
 * @param {Object} req.body.SpeechResult - User's consent response (yes/no)
 * @returns {string} TwiML response confirming consent and ending call
 */
router.post('/consent', validateRequest('twilioVoice'), async (req, res) => {
  const { CallSid, SpeechResult } = req.body;
      await twilioController.handleConsent(CallSid, SpeechResult, res);
});

// ============================================================================
// WEB-BASED FUNCTIONALITY
// ============================================================================
// These endpoints handle requests from web browsers and other web clients
// They provide the same core functionality as Twilio voice calls but for web use

/**
 * Web route handler for processing speech input from web clients
 * This endpoint allows web applications to send speech results for processing
 * without requiring a phone call through Twilio
 * 
 * @route POST /twilio/web/process
 * @param {Object} req.body.speechResult - The transcribed speech text from web client
 * @returns {Object} JSON response with processed results
 */
router.post('/web/process', validateRequest('webSpeech'), async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  logger.info('=== Starting new web process request ===', {
    requestId,
    timestamp: new Date().toISOString(),
    url: req.originalUrl,
    method: req.method
  });

  try {
    const { speechResult } = req.body;

    if (!speechResult) {
      logger.error('Missing speech result:', { 
        requestId,
        body: req.body
      });
      return res.status(400).json({ error: 'Missing speech result' });
    }

    // Process the speech result as web request (same logic as Twilio but for web clients)
    const response = await twilioController.processSpeechResult(null, speechResult, requestId, 'web');
    
    res.json({ response });
  } catch (error) {
    logger.error('Error processing web request:', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Error processing request' });
  }
});

  // Add method to get active calls count for health monitoring
  router.getActiveCallsCount = () => {
    return handlerManager ? handlerManager.activeCalls.size : 0;
  };

  // Add method to get WebSocket server for health monitoring
  router.getWebSocketServer = () => {
    return wsServer;
  };

  logger.info('Twilio router creation completed, returning router');
  return router;
}

// Export the factory function
export default createTwilioRouter;