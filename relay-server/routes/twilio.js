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
import { getLanguageConfig } from '../lib/languageConfig.js';
import { addTranscriptionEntry } from './speech-monitor.js';
import { validateTranscription, generateRepromptMessage } from '../lib/transcriptionValidator.js';
import { geocodingIntegration } from '../integrations/geocodingIntegration.js';

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

// ============================================================================
// TWILIO VOICE PROCESSING ENDPOINT
// ============================================================================
// This is the main endpoint that processes voice calls from Twilio
// Handles both new calls and speech input from existing calls

/**
 * Handle incoming Twilio voice calls
 * This is the main entry point for Twilio voice webhooks
 * 
 * @route POST /twilio/voice
 * @param {Object} req.body.CallSid - Twilio call SID
 * @param {Object} req.body.From - Caller phone number
 * @param {Object} req.body.To - Called phone number
 * @returns {string} TwiML response for Twilio
 */
router.post('/voice', async (req, res) => {
  const { CallSid, From, To } = req.body;
  if (!CallSid || !From || !To) {
    return res.status(400).json({ error: 'Missing required fields: CallSid, From, and To are required.' });
  }

  const requestId = Math.random().toString(36).substring(7);
  const languageCode = req.body.Language || 'en-US';
  const voice = getLanguageConfig(languageCode)?.voice || 'nova';
  
  logger.info('🎯 VOICE CALL INITIATED', {
    requestId,
    CallSid,
    From,
    To,
    languageCode,
    voice,
    timestamp: new Date().toISOString()
  });

  try {
    // Get the full configurable welcome message from language config
    const welcomeMessage = getLanguageConfig(languageCode)?.prompts?.welcome || 
                          'Hello, and thank you for reaching out. I\'m here to listen and help you find the support and resources you need.';
    
    logger.info('🎯 VOICE CALL - Using welcome message', {
      requestId,
      CallSid,
      welcomeMessageLength: welcomeMessage.length,
      welcomeMessage: welcomeMessage.substring(0, 100) + '...',
      voice,
      timestamp: new Date().toISOString()
    });

    // Generate TTS-based TwiML for the welcome message
    const metadata = {
      requestId,
      callSid: CallSid,
      text: welcomeMessage,
      voice,
      isWelcomeMessage: true,
      timestamp: new Date().toISOString()
    };

    const twiml = await handlerManager.generateTTSBasedTwiML(welcomeMessage, true, languageCode, metadata);
    
    logger.info('🎯 VOICE CALL - Welcome message generated', {
      requestId,
      CallSid,
      twimlLength: twiml?.length || 0,
      voice,
      timestamp: new Date().toISOString()
    });

    res.type('text/xml');
    const twimlString = typeof twiml === 'object' && twiml.toString ? twiml.toString() : twiml;
    res.send(twimlString);

  } catch (error) {
    logger.error('🎯 VOICE CALL - Error generating welcome message', {
      requestId,
      CallSid,
      error: error.message,
      stack: error.stack,
      voice,
      timestamp: new Date().toISOString()
    });

    // Fallback to simple TwiML if TTS generation fails
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${welcomeMessage}</Say>
  <Gather input="speech" action="/twilio/voice/process" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="${languageCode}"/>
</Response>`;
    
    res.type('text/xml');
    res.send(fallbackTwiml);
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
  console.log('=== ROUTE HANDLER CALLED ===', { 
    CallSid: req.body.CallSid, 
    SpeechResult: req.body.SpeechResult,
    timestamp: new Date().toISOString()
  });
  
  const requestId = Math.random().toString(36).substring(7);
  const { CallSid, SpeechResult } = req.body;
  
  // Get voice from language configuration instead of request body
  const languageCode = req.body.Language || 'en-US';
  const voice = getLanguageConfig(languageCode)?.voice || 'nova';
  let cleanedSpeechResult = ''; // Initialize outside try block

  // Enhanced speech transcription logging
  logger.info('🔊 SPEECH TRANSCRIPTION DEBUG - Incoming request', {
    requestId,
    CallSid,
    rawSpeechResult: SpeechResult,
    speechResultLength: SpeechResult?.length || 0,
    speechResultType: typeof SpeechResult,
    voice,
    languageCode,
    confidence: req.body.SpeechResultConfidence,
    speechModel: req.body.SpeechModel,
    enhanced: req.body.Enhanced,
    speechTimeout: req.body.SpeechTimeout,
    // Log all Twilio speech-related parameters
    twilioSpeechParams: {
      SpeechResult: req.body.SpeechResult,
      SpeechResultConfidence: req.body.SpeechResultConfidence,
      SpeechModel: req.body.SpeechModel,
      Enhanced: req.body.Enhanced,
      SpeechTimeout: req.body.SpeechTimeout,
      Language: req.body.Language,
      From: req.body.From,
      To: req.body.To
    },
    timestamp: new Date().toISOString()
  });

  // Send immediate acknowledgment to prevent 499 errors
  res.set('Connection', 'keep-alive');
  res.set('Keep-Alive', 'timeout=15');
  
  // Set a timeout for this specific request - optimized for faster response
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
  }, 8000); // Reduced to 8 seconds for faster response
  
  try {
    // NEW: Return 400 if required fields are missing
    if (!CallSid || !SpeechResult) {
      logger.error('Missing required parameters:', { CallSid, SpeechResult });
      clearTimeout(requestTimeout);
      return res.status(400).json({ error: 'Missing required fields: CallSid and SpeechResult are required.' });
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
    
    // Clean and process speech result
    const originalSpeech = SpeechResult || '';
    const speechConfidence = parseFloat(req.body.SpeechResultConfidence) || null;
    
    // Validate and correct transcription errors
    const validationResult = validateTranscription(originalSpeech, speechConfidence, CallSid);
    cleanedSpeechResult = validationResult.corrected;
    
    // Add to speech monitor for real-time tracking
    addTranscriptionEntry({
      rawSpeechResult: originalSpeech,
      cleanedSpeechResult: cleanedSpeechResult,
      CallSid,
      confidence: speechConfidence,
      speechModel: req.body.SpeechModel,
      enhanced: req.body.Enhanced,
      languageCode,
      voice,
      requestId,
      validationResult: validationResult
    });
    
    logger.info('🔊 SPEECH TRANSCRIPTION DEBUG - Processing', {
      requestId,
      CallSid,
      originalSpeech,
      originalLength: originalSpeech.length,
      cleanedSpeech: cleanedSpeechResult,
      cleanedLength: cleanedSpeechResult.length,
      wasTrimmed: originalSpeech !== cleanedSpeechResult,
      isEmpty: !cleanedSpeechResult,
      confidence: speechConfidence,
      confidenceLevel: validationResult.confidenceLevel,
      hasErrors: validationResult.hasErrors,
      corrections: validationResult.corrections.length,
      shouldReprompt: validationResult.shouldReprompt,
      voice,
      timestamp: new Date().toISOString()
    });

    // Handle very low confidence transcriptions by asking for clarification
    if (validationResult.shouldReprompt) {
      logger.info('🔊 SPEECH TRANSCRIPTION DEBUG - Very low confidence, asking for clarification', {
        requestId,
        CallSid,
        originalSpeech,
        confidence: speechConfidence,
        timestamp: new Date().toISOString()
      });

      const repromptMessage = generateRepromptMessage(originalSpeech, speechConfidence);
      const repromptTwiml = new twilio.twiml.VoiceResponse();
      repromptTwiml.say(repromptMessage);
      repromptTwiml.gather({
        input: 'speech',
        action: '/twilio/voice/process',
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: 'true',
        language: languageCode
      });

      clearTimeout(requestTimeout);
      res.type('text/xml');
      return res.send(repromptTwiml.toString());
    }

    // Check if this is a consent response (yes/no to SMS question)
    const lowerSpeech = cleanedSpeechResult.toLowerCase();
    const consentKeywords = ['yes', 'no', 'agree', 'disagree', 'ok', 'okay', 'sure', 'nope'];
    
    // Before calling processSpeechResult
    logger.info('Calling processSpeechResult', {
      requestId,
      CallSid,
      text: cleanedSpeechResult,
      voice
    });

    // Process the speech input with timeout handling - reduced for Twilio compatibility
    const processedResponse = await Promise.race([
      twilioController.processSpeechResult(CallSid, cleanedSpeechResult, requestId, 'twilio'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), 10000)
      )
    ]);

    logger.info('🔊 SPEECH TRANSCRIPTION DEBUG - Processing response', {
      requestId,
      CallSid,
      inputSpeech: cleanedSpeechResult,
      inputLength: cleanedSpeechResult.length,
      responseType: typeof processedResponse,
      response: processedResponse,
      responseLength: typeof processedResponse === 'string' ? processedResponse.length : 'N/A',
      voice,
      timestamp: new Date().toISOString()
    });
    
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
      const metadata = {
        requestId,
        callSid: CallSid,
        text: cleanedSpeechResult,
        voice,
        responseLength: response.length,
        shouldEndCall,
        timestamp: new Date().toISOString()
      };
      
      twiml = await Promise.race([
        handlerManager.generateTTSBasedTwiML(response, !shouldEndCall, null, metadata),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TwiML generation timeout')), 12000)
        )
      ]);
    } catch (ttsError) {
      logger.error('TTS generation failed, using fallback:', {
        error: ttsError.message,
        requestId,
        CallSid,
        responseLength: response.length,
        voice
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
    
    // Before sending TwiML
    logger.info('Sending TwiML response', {
      requestId,
      CallSid,
      text: cleanedSpeechResult,
      voice,
      twiml: twiml
    });

    res.type('text/xml');
    // Convert TwiML object to string if it's an object
    const twimlString = typeof twiml === 'object' && twiml.toString ? twiml.toString() : twiml;
    res.send(twimlString);
    
    logger.info('Successfully processed speech:', { 
      requestId, 
      CallSid, 
      text: cleanedSpeechResult,
      voice,
      responseLength: response.length,
      shouldEndCall,
      twimlLength: twiml?.length || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    clearTimeout(requestTimeout);
    logger.error('Error processing speech:', {
      error: error.message,
      stack: error.stack,
      requestId,
      CallSid: req.body.CallSid,
      text: cleanedSpeechResult,
      voice,
      timestamp: new Date().toISOString()
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
    // Convert TwiML object to string if it's an object
    const errorTwimlString = typeof errorTwiml === 'object' && errorTwiml.toString ? errorTwiml.toString() : errorTwiml;
    res.send(errorTwimlString);
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