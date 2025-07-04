import express from 'express';
import { config } from '../lib/config.js';
import twilio from 'twilio';
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
import { getIntent, intentHandlers, rewriteQuery, updateConversationContext, getConversationContext } from '../lib/intentClassifier.js';
import { generateSpeechHash } from '../lib/utils.js';
import { v4 as uuidv4 } from 'uuid';
import { extractLocation, generateLocationPrompt } from '../lib/speechProcessor.js';
import { filterConfig, matchesPattern, cleanTitle } from '../lib/filterConfig.js';
import { ResponseGenerator } from '../lib/response.js';
import { welcomeMessage } from '../lib/conversationConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Initialize TwilioVoiceHandler
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Skip credential check in test environment
if (process.env.NODE_ENV !== 'test') {
  if (!accountSid || !authToken || !phoneNumber) {
    logger.error('Twilio credentials not found in environment variables');
    throw new Error('Twilio credentials not found in environment variables');
  }
}

const twilioVoiceHandler = new TwilioVoiceHandler(accountSid, authToken, phoneNumber);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
logger.info('Twilio client initialized successfully');

// Store WebSocket server instance
let wsServer = null;

// Add a setter for the WebSocket server
router.setWebSocketServer = (server, mockServer) => {
  wsServer = server;
  // Always set the WebSocket server in the voice handler
  twilioVoiceHandler.setWebSocketServer(server);
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

// Apply validation to all Twilio routes - moved after twilioVoiceHandler initialization
// Temporarily disabled to fix timeout issues
// router.use(twilioVoiceHandler.validateTwilioRequest.bind(twilioVoiceHandler));

// Log when the router is initialized
logger.info('Initializing Twilio routes');

// Log all incoming requests
router.use((req, res, next) => {
  logger.info('Incoming Twilio request:', {
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
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
router.post('/voice', async (req, res) => {
  logger.info('Received voice call request');
  
  try {
    // Check if this is a new call or speech input
    const { CallSid, SpeechResult } = req.body;
    
    if (SpeechResult) {
      // This is speech input from an existing call - redirect to process endpoint
      logger.info('Processing speech input:', { CallSid, SpeechResult });
      
      // For speech input, redirect to the process endpoint
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.redirect('/twilio/voice/process');
      res.type('text/xml');
      res.send(twiml.toString());
    } else {
      // This is a new call - provide welcome message
      logger.info('Processing new call:', { CallSid });
      
      // Initialize call in both WebSocket server and voice handler
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.registerCall(CallSid, req.body.From || 'unknown');
      }
      
      // Initialize call in voice handler
      if (!twilioVoiceHandler.activeCalls.has(CallSid)) {
        twilioVoiceHandler.activeCalls.set(CallSid, {
          from: req.body.From || 'unknown',
          startTime: Date.now(),
          hasConsent: false,
          conversationHistory: [],
          timeouts: new Set(),
          lastActivity: Date.now()
        });
        logger.info('Initialized call in voice handler:', { CallSid, from: req.body.From });
      }
      
      // Generate welcome message using conversation config
      const twiml = await twilioVoiceHandler.generateTTSBasedTwiML(welcomeMessage, true);
      
      res.type('text/xml');
      res.send(twiml);
    }
    
  } catch (error) {
    logger.error('Error in voice endpoint:', error);
    
    // Fallback response
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("I'm sorry, there was an error. Please try again.");
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Helper function to handle SMS consent logic
async function handleSMSConsent(CallSid, SpeechResult, res) {
  logger.info('Handling SMS consent:', { CallSid, SpeechResult });
  
  const call = twilioVoiceHandler.activeCalls.get(CallSid);
  if (!call) {
    logger.error(`No active call found for CallSid: ${CallSid}`);
    const twiml = await twilioVoiceHandler.generateTTSBasedTwiML("I'm sorry, I encountered an error. The call will now end.", false);
    const twimlResponse = new twilio.twiml.VoiceResponse();
    const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
    if (audioUrl) {
      twimlResponse.play(audioUrl);
    }
    twimlResponse.hangup();
    res.type('text/xml');
    return res.send(twimlResponse.toString());
  }

  // Process consent response (check if user said "yes")
  const hasConsent = SpeechResult.toLowerCase().includes('yes');
  call.hasConsent = hasConsent;
  twilioVoiceHandler.activeCalls.set(CallSid, call);

  // Generate and send summary if consent was given
  if (hasConsent) {
    const summary = await twilioVoiceHandler.generateCallSummary(CallSid, call);
    await twilioVoiceHandler.sendSMSWithRetry(CallSid, call, summary);
  }

  // End the call with appropriate message
  const finalMessage = hasConsent ? 
    "Thank you. You will receive a text message with the summary and resources shortly." :
    "Thank you for reaching out. You're not alone, and help is always available. Take care and stay safe.";
  
  const twiml = await twilioVoiceHandler.generateTTSBasedTwiML(finalMessage, false);
  
  // Create a new TwiML response with hangup
  const twimlResponse = new twilio.twiml.VoiceResponse();
  const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
  if (audioUrl) {
    twimlResponse.play(audioUrl);
  }
  twimlResponse.hangup();

  res.type('text/xml');
  res.send(twimlResponse.toString());

  // Clean up call data
  await twilioVoiceHandler.cleanupCall(CallSid);
}

/**
 * Endpoint for processing speech input from Twilio
 * This is called when Twilio sends transcribed speech back to the server
 * 
 * @route POST /twilio/voice/process
 * @param {Object} req.body.CallSid - Twilio call SID
 * @param {Object} req.body.SpeechResult - Transcribed speech text
 * @returns {string} TwiML response for Twilio
 */
router.post('/voice/process', async (req, res) => {
  logger.info('Received speech processing request');
  
  // Set a timeout for this specific request - reduced from 90s to 45s
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
  }, 45000); // Reduced from 90s to 45s
  
  try {
    const { CallSid, SpeechResult } = req.body;
    
    if (!CallSid || !SpeechResult) {
      logger.error('Missing required parameters:', { CallSid, SpeechResult });
      clearTimeout(requestTimeout);
      const twiml = await twilioVoiceHandler.generateTTSBasedTwiML("I didn't catch that. Could you please repeat?", true);
      res.type('text/xml');
      return res.send(twiml);
    }
    
    logger.info('Processing speech:', { CallSid, SpeechResult });
    
    // Ensure call is initialized in voice handler (in case it wasn't initialized in voice endpoint)
    if (!twilioVoiceHandler.activeCalls.has(CallSid)) {
      twilioVoiceHandler.activeCalls.set(CallSid, {
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
    const cleanedSpeechResult = twilioVoiceHandler.preprocessSpeech(SpeechResult);
    logger.info('Cleaned speech result:', { CallSid, original: SpeechResult, cleaned: cleanedSpeechResult });
    
    // Check if this is a consent response (yes/no to SMS question)
    const lowerSpeech = cleanedSpeechResult.toLowerCase();
    const consentKeywords = ['yes', 'no', 'agree', 'disagree', 'ok', 'okay', 'sure', 'nope'];
    
    // Process the speech input with timeout handling - reduced from 60s to 30s
    const processedResponse = await Promise.race([
      twilioVoiceHandler.processSpeechInput(cleanedSpeechResult, CallSid),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), 30000)
      )
    ]);
    
    // Clear the request timeout since we got a response
    clearTimeout(requestTimeout);
    
    // Generate TwiML response with timeout handling
    const twiml = await Promise.race([
      twilioVoiceHandler.generateTTSBasedTwiML(processedResponse, true),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TwiML generation timeout')), 15000)
      )
    ]);
    
    res.type('text/xml');
    res.send(twiml);
    
    logger.info('Successfully processed speech:', { CallSid, responseLength: processedResponse.length });
    
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
router.post('/voice/interim', async (req, res) => {
  try {
    const { CallSid, SpeechResult } = req.body;
    
    if (CallSid && SpeechResult) {
      logger.info('Received interim speech result:', { CallSid, SpeechResult });
      
      // Store interim result for potential use in final processing
      const call = twilioVoiceHandler.activeCalls.get(CallSid);
      if (call) {
        call.interimSpeechResult = SpeechResult;
        twilioVoiceHandler.activeCalls.set(CallSid, call);
      }
    }
    
    // Return empty TwiML response for interim results
    const twiml = new twilio.twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
    
  } catch (error) {
    logger.error('Error handling interim speech result:', error);
    
    // Return empty TwiML response even on error
    const twiml = new twilio.twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Helper function to determine request type (web vs Twilio)
// This helps route requests to appropriate handlers based on their source
function getRequestType(req) {
  // Check if it's a Twilio request (has Twilio-specific headers or body fields)
  if (req.body.CallSid || req.body.From || req.headers['x-twilio-signature']) {
    return 'twilio';
  }
  
  // Check if it's a web request (has user-agent but no Twilio signature)
  if (req.headers['user-agent'] && !req.headers['x-twilio-signature']) {
    return 'web';
  }

  // Default to web if we can't determine the source
  return 'web';
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

    // Clear conversation context when call ends
    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
      clearConversationContext(CallSid);
      logger.info('Cleared conversation context for ended call:', {
        CallSid,
        CallStatus
      });
    }

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
router.post('/consent', async (req, res) => {
  try {
    const { CallSid, SpeechResult } = req.body;
    logger.info('Processing consent response:', { CallSid, SpeechResult });

    if (!CallSid || !SpeechResult) {
      logger.error('Missing required parameters in consent response');
      return res.status(400).send('Missing required parameters');
    }

    const call = twilioVoiceHandler.activeCalls.get(CallSid);
    if (!call) {
      logger.error(`No active call found for CallSid: ${CallSid}`);
      const twiml = await twilioVoiceHandler.generateTTSBasedTwiML("I'm sorry, I encountered an error. The call will now end.", false);
      const twimlResponse = new twilio.twiml.VoiceResponse();
      const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
      if (audioUrl) {
        twimlResponse.play(audioUrl);
      }
      twimlResponse.hangup();
      res.type('text/xml');
      return res.send(twimlResponse.toString());
    }

    // Process consent response (check if user said "yes")
    const hasConsent = SpeechResult.toLowerCase().includes('yes');
    call.hasConsent = hasConsent;
    twilioVoiceHandler.activeCalls.set(CallSid, call);

    // Generate and send summary if consent was given
    if (hasConsent) {
      const summary = await twilioVoiceHandler.generateCallSummary(CallSid, call);
      await twilioVoiceHandler.sendSMSWithRetry(CallSid, call, summary);
    }

    // End the call with appropriate message
    const finalMessage = hasConsent ? 
      "Thank you. You will receive a text message with the summary and resources shortly." :
      "Thank you for reaching out. You're not alone, and help is always available. Take care and stay safe.";
    
    const twiml = await twilioVoiceHandler.generateTTSBasedTwiML(finalMessage, false);
    
    // Create a new TwiML response with hangup
    const twimlResponse = new twilio.twiml.VoiceResponse();
    const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
    if (audioUrl) {
      twimlResponse.play(audioUrl);
    }
    twimlResponse.hangup();

    res.type('text/xml');
    res.send(twimlResponse.toString());

    // Clean up call data
    await twilioVoiceHandler.cleanupCall(CallSid);
  } catch (error) {
    logger.error('Error processing consent response:', error);
    const twiml = await twilioVoiceHandler.generateTTSBasedTwiML("I'm sorry, I encountered an error. The call will now end.", false);
    const twimlResponse = new twilio.twiml.VoiceResponse();
    const audioUrl = twiml.match(/<Play>([^<]+)<\/Play>/)?.[1];
    if (audioUrl) {
      twimlResponse.play(audioUrl);
    }
    twimlResponse.hangup();
    res.type('text/xml');
    res.send(twimlResponse.toString());
  }
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
router.post('/web/process', async (req, res) => {
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
    const response = await processSpeechResult(null, speechResult, requestId, 'web');
    
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

// ============================================================================
// CORE PROCESSING FUNCTION
// ============================================================================
// This function handles the main logic for processing speech input
// It works for both web-based requests and Twilio voice calls

/**
 * Main process function that routes to appropriate handler based on request type
 * This is the core function that processes speech input and returns formatted responses
 * 
 * @param {string} callSid - Twilio call SID (null for web requests)
 * @param {string} speechResult - The transcribed speech text to process
 * @param {string} requestId - Unique identifier for this request
 * @param {string} requestType - Type of request ('web' or 'twilio')
 * @returns {Object|string} Formatted response appropriate for the request type
 */
export async function processSpeechResult(callSid, speechResult, requestId, requestType = 'web') {
  logger.info('Processing speech result:', {
    requestId,
    callSid,
    speechResult,
    requestType,
    timestamp: new Date().toISOString()
  });

  try {
    // Get conversation context FIRST (for follow-up questions)
    const context = callSid ? getConversationContext(callSid) : null;
    logger.info('Retrieved conversation context:', {
      requestId,
      callSid,
      hasContext: !!context,
      lastIntent: context?.lastIntent,
      hasLastQueryContext: !!context?.lastQueryContext,
      needsLocation: context?.lastQueryContext?.needsLocation || false
    });

    // Check for follow-up questions BEFORE intent classification
    const followUpResponse = context?.lastQueryContext ? await handleFollowUp(speechResult, context.lastQueryContext) : null;
    
    logger.info('Follow-up question check:', {
      requestId,
      callSid,
      isFollowUp: !!followUpResponse,
      followUpType: followUpResponse?.type,
      speechResult,
      lastIntent: context?.lastIntent
    });

    // If this is a follow-up question, handle it directly
    if (followUpResponse) {
      logger.info('Processing follow-up response:', {
        requestId,
        callSid,
        followUpType: followUpResponse.type,
        hasResults: !!followUpResponse.results,
        resultCount: followUpResponse.results?.length || 0
      });

      // Update conversation context with follow-up response
      if (callSid) {
        updateConversationContext(callSid, followUpResponse.intent || context?.lastIntent || 'general_information', speechResult, {
          voiceResponse: followUpResponse.voiceResponse,
          smsResponse: followUpResponse.smsResponse
        }, followUpResponse.results && followUpResponse.results.length > 0 ? { results: followUpResponse.results } : null);
      }

      // Return appropriate format based on request type
      if (requestType === 'web') {
        return followUpResponse.voiceResponse || followUpResponse.smsResponse || 'No response available';
      }
      return followUpResponse.voiceResponse || followUpResponse.smsResponse || 'No response available';
    }

    // Get intent classification (only if not a follow-up)
    const intent = await getIntent(speechResult);
    logger.info('Classified intent:', {
      requestId,
      callSid,
      intent,
      speechResult
    });

    // Extract location from speech input
    const location = await extractLocation(speechResult);
    logger.info('Extracted location:', {
      requestId,
      callSid,
      location,
      originalSpeech: speechResult
    });

    if (!location) {
      logger.info('No location found in speech, generating prompt:', {
        requestId,
        callSid,
        speechResult
      });
      return generateLocationPrompt();
    }

    // Rewrite query with context for better search results
    const rewrittenQuery = await rewriteQuery(speechResult, intent, callSid);
    logger.info('Rewritten query:', {
      requestId,
      callSid,
      originalQuery: speechResult,
      rewrittenQuery,
      intent
    });

    // Defensive check and logging before Tavily API call
    logger.info('Type and value of rewrittenQuery before Tavily:', {
      type: typeof rewrittenQuery,
      value: rewrittenQuery
    });
    if (typeof rewrittenQuery !== 'string') {
      logger.error('rewrittenQuery is not a string, attempting to convert or throw error', {
        rewrittenQuery
      });
      if (rewrittenQuery && typeof rewrittenQuery.toString === 'function') {
        rewrittenQuery = rewrittenQuery.toString();
      } else {
        throw new Error('rewrittenQuery must be a string');
      }
    }
    // Call Tavily API with rewritten query
    logger.info('Calling Tavily API:', {
      requestId,
      callSid,
      query: rewrittenQuery
    });
    const tavilyResponse = await ResponseGenerator.queryTavily(rewrittenQuery);

    logger.info('Received Tavily API response:', {
      requestId,
      callSid,
      responseLength: tavilyResponse?.length,
      hasResults: !!tavilyResponse?.results,
      resultCount: tavilyResponse?.results?.length,
      firstResultTitle: tavilyResponse?.results?.[0]?.title,
      firstResultUrl: tavilyResponse?.results?.[0]?.url
    });

    // Format response based on request type (web vs Twilio have different formats)
    const formattedResponse = ResponseGenerator.formatTavilyResponse(tavilyResponse, requestType, rewrittenQuery, 3);
    logger.info('Formatted response:', {
      requestId,
      callSid,
      responseType: typeof formattedResponse,
      responseLength: typeof formattedResponse === 'string' ? formattedResponse.length : JSON.stringify(formattedResponse).length,
      responsePreview: typeof formattedResponse === 'string' ? 
        (formattedResponse.substring(0, 100) + '...') : 
        JSON.stringify(formattedResponse).substring(0, 100) + '...'
    });

    // Update conversation context for follow-up questions
    if (callSid) {
      updateConversationContext(callSid, intent, rewrittenQuery, formattedResponse, tavilyResponse);
      logger.info('Updated conversation context:', {
        requestId,
        callSid,
        intent,
        queryLength: rewrittenQuery.length,
        responseLength: formattedResponse.length,
        hasTavilyResults: !!tavilyResponse?.results,
        resultCount: tavilyResponse?.results?.length || 0
      });
    }

    // Return appropriate format based on request type
    if (requestType === 'web') {
      return formattedResponse;
    }
    return formattedResponse;
  } catch (error) {
    logger.error('Error processing speech result:', {
      requestId,
      callSid,
      error: error.message,
      stack: error.stack,
      speechResult
    });
    throw error;
  }
}

// Add method to get active calls count for health monitoring
router.getActiveCallsCount = () => {
  return twilioVoiceHandler ? twilioVoiceHandler.activeCalls.size : 0;
};

// Add method to get WebSocket server for health monitoring
router.getWebSocketServer = () => {
  return wsServer;
};

export default router;