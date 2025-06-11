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
import { v4 as uuidv4 } from 'uuid';

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

// Cache for Tavily API responses
const tavilyCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_SIZE = 1000; // Maximum number of cached responses

const SPEECH_TIMEOUT = '30'; // Standardized speech timeout in seconds

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
      speechTimeout: SPEECH_TIMEOUT,
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
      speechTimeout: SPEECH_TIMEOUT,
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

// Helper function to determine request type
function getRequestType(req) {
  // Check if it's a Twilio request
  if (req.body.CallSid || req.body.From || req.headers['x-twilio-signature']) {
    return 'twilio';
  }
  
  // Check if it's a web request
  if (req.headers['user-agent'] && !req.headers['x-twilio-signature']) {
    return 'web';
  }

  // Default to web if we can't determine
  return 'web';
}

// Web route handler
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

    // Process the speech result as web request
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

// Helper function to extract location from speech
function extractLocationFromSpeech(speechResult) {
  logger.info('Extracting location from speech:', { speechResult });

  // Common patterns for location mentions
  const locationPatterns = [
    /(?:in|near|around|close to|at)\s+([^,.]+?)(?:\s+and|\s+area|\s+county|$)/i,  // "in San Francisco"
    /(?:find|looking for|search for|need|help me find)\s+(?:shelters?|homes?|help|resources?)\s+(?:in|near|around|close to|at)\s+([^,.]+?)(?:\s+and|\s+area|\s+county|$)/i,  // "find shelters in San Francisco"
    /(?:shelters?|homes?|help|resources?)\s+(?:in|near|around|close to|at)\s+([^,.]+?)(?:\s+and|\s+area|\s+county|$)/i,  // "shelters in San Francisco"
    /(?:I am|I'm|I live in|I'm in)\s+([^,.]+?)(?:\s+and|\s+area|\s+county|$)/i,  // "I am in San Francisco"
    /(?:location|area|city|town)\s+(?:is|are)\s+([^,.]+?)(?:\s+and|\s+area|\s+county|$)/i,  // "my location is San Francisco"
    /(?:can you|could you|please)\s+(?:help|find|search for)\s+(?:me|us)?\s+(?:some|any)?\s+(?:shelters?|homes?|help|resources?)\s+(?:in|near|around|close to|at)\s+([^,.]+?)(?:\s+and|\s+area|\s+county|$)/i  // "can you help me find some shelters near San Jose"
  ];

  // Try each pattern
  for (const pattern of locationPatterns) {
    const match = speechResult.match(pattern);
    if (match && match[1]) {
      // Remove leading articles like 'the'
      const location = match[1].trim().replace(/^the\s+/i, '');
      logger.info('Location extracted:', { location, pattern: pattern.toString() });
      return location;
    }
  }

  logger.info('No location found in speech input');
  return null;
}

// Generate a prompt asking for location
function generateLocationPrompt() {
  const prompts = [
    "I need to know your location to find nearby resources. Could you please tell me your city or area? For example, you could say San Francisco, Oakland, or San Jose.",
    "To help you find local resources, I need to know where you are. Please tell me your city or area, like San Mateo, Santa Clara, or any other city in the Bay Area.",
    "I can help you find resources in your area. Could you please tell me which city you're in? For example, you could say San Francisco, San Jose, or any other city nearby.",
    "To find the closest resources to you, I need to know your location. Please tell me your city or area, such as Oakland, San Mateo, or any other city in the region."
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

// Handler for Twilio voice calls
async function processTwilioRequest(speechResult, requestId) {
  try {
    logger.info('Processing Twilio request:', {
      requestId,
      speechResult
    });

    // Extract location from speech input
    const location = extractLocationFromSpeech(speechResult);

    if (!location) {
      logger.info('No location specified in speech input:', {
        requestId,
        speechResult
      });
      return await generateLocationPrompt();
    }

    // Call Tavily API with location-specific query
    const query = `domestic violence shelters and resources in ${location}`;
    const tavilyResponse = await callTavilyAPI(query);
    logger.info('Tavily API response:', {
      requestId,
      location,
      response: tavilyResponse
    });

    // Format the response
    const formattedResponse = formatTavilyResponse(tavilyResponse, 'twilio');
    logger.info('Formatted response:', {
      requestId,
      response: formattedResponse
    });

    return formattedResponse;
  } catch (error) {
    logger.error('Error processing Twilio request:', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Main process function that routes to appropriate handler
async function processSpeechResult(callSid, speechResult, requestId, requestType = 'web') {
  logger.info('Processing speech result:', {
    requestId,
    callSid,
    speechResult,
    requestType,
    timestamp: new Date().toISOString()
  });

  try {
    // Extract location from speech
    const location = extractLocationFromSpeech(speechResult);
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

    // Construct query for Tavily API
    const query = `Find domestic violence shelters and resources near ${location}`;
    logger.info('Constructed Tavily query:', {
      requestId,
      callSid,
      query,
      location
    });

    // Call Tavily API
    logger.info('Calling Tavily API:', {
      requestId,
      callSid,
      query
    });
    const tavilyResponse = await callTavilyAPI(query);
    logger.info('Received Tavily API response:', {
      requestId,
      callSid,
      responseLength: tavilyResponse?.length,
      hasResults: !!tavilyResponse?.results,
      resultCount: tavilyResponse?.results?.length,
      firstResultTitle: tavilyResponse?.results?.[0]?.title,
      firstResultUrl: tavilyResponse?.results?.[0]?.url
    });

    // Format response based on request type
    const formattedResponse = formatTavilyResponse(tavilyResponse, requestType);
    logger.info('Formatted response:', {
      requestId,
      callSid,
      responseLength: formattedResponse.length,
      responsePreview: formattedResponse.substring(0, 100) + '...'
    });

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

const formatTavilyResponse = (tavilyResponse, requestType) => {
  logger.info('Starting Tavily response formatting:', {
    requestType,
    hasResponse: !!tavilyResponse,
    hasResults: !!tavilyResponse?.results,
    resultCount: tavilyResponse?.results?.length
  });

  try {
    if (!tavilyResponse || !tavilyResponse.results || tavilyResponse.results.length === 0) {
      logger.warn('No results found in Tavily response:', {
        response: tavilyResponse,
        requestType
      });
      return "I'm sorry, I couldn't find any specific resources for that location. Would you like me to search for resources in a different location?";
    }

    logger.info('Processing Tavily results:', {
      requestType,
      resultCount: tavilyResponse.results.length,
      firstResultTitle: tavilyResponse.results[0]?.title,
      firstResultUrl: tavilyResponse.results[0]?.url
    });

    const results = tavilyResponse.results.slice(0, 3); // Only use first 3 results
    let formattedResponse = "I found some resources that might help:\n\n";

    results.forEach((result, index) => {
      logger.debug('Formatting result:', {
        index,
        title: result.title,
        url: result.url,
        contentLength: result.content?.length
      });

      // Extract organization name and location from title
      const titleParts = result.title?.split('|') || result.title?.split('-') || [result.title];
      const orgName = titleParts[0]?.trim() || 'Unknown Organization';
      
      // Extract phone number if present
      const phoneMatch = result.content?.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
      const phoneNumber = phoneMatch ? phoneMatch[0] : null;

      // Extract coverage area if present
      const coverageMatch = result.content?.match(/Coverage Area:?\s*([^.]+)/i);
      const coverageArea = coverageMatch ? coverageMatch[1].trim() : null;

      // Extract service description (first sentence)
      const serviceMatch = result.content?.match(/^([^.]*)/);
      const serviceDescription = serviceMatch ? serviceMatch[1].trim() : null;

      formattedResponse += `${index + 1}. ${orgName}\n`;
      
      if (serviceDescription) {
        formattedResponse += `   ${serviceDescription}\n`;
      }
      
      if (phoneNumber) {
        formattedResponse += `   Phone: ${phoneNumber}\n`;
      }
      
      if (coverageArea) {
        formattedResponse += `   Coverage: ${coverageArea}\n`;
      }
      
      formattedResponse += '\n';
    });

    formattedResponse += "Would you like more information about any of these resources?";
    
    logger.info('Formatted response:', {
      requestType,
      responseLength: formattedResponse.length,
      responsePreview: formattedResponse.substring(0, 100) + '...'
    });

    return formattedResponse;
  } catch (error) {
    logger.error('Error formatting Tavily response:', {
      error: error.message,
      stack: error.stack,
      requestType,
      response: tavilyResponse
    });
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

// Export functions for testing
export {
  formatTavilyResponse,
  extractLocationFromSpeech,
  generateLocationPrompt
};

// Handle incoming voice calls
router.post('/voice/process', async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4();
  const callSid = req.body.CallSid;
  
  logger.info('Received voice call request:', {
    requestId,
    callSid,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Handle request abort
  req.on('aborted', () => {
    logger.warn('Request aborted by client:', {
      requestId,
      callSid,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    });
  });

  try {
    // Validate request
    if (!req.body || !req.body.CallSid) {
      logger.error('Invalid request body:', {
        requestId,
        body: req.body,
        duration: Date.now() - startTime
      });
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say("I'm having trouble processing your request. Please try again.");
      twiml.gather({
        input: 'speech',
        action: '/twilio/voice/process',
        method: 'POST',
        speechTimeout: SPEECH_TIMEOUT,
        speechModel: 'phone_call',
        enhanced: 'true',
        language: 'en-US',
        timeout: '30'
      });
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // Check if this is a new call
    const isNewCall = !req.body.SpeechResult;
    
    if (isNewCall) {
      logger.info('New call received, generating welcome prompt:', {
        requestId,
        callSid,
        duration: Date.now() - startTime
      });
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(generateWelcomePrompt());
      twiml.gather({
        input: 'speech',
        action: '/twilio/voice/process',
        method: 'POST',
        speechTimeout: SPEECH_TIMEOUT,
        speechModel: 'phone_call',
        enhanced: 'true',
        language: 'en-US',
        timeout: '30'
      });
      res.type('text/xml');
      return res.send(twiml.toString());
    }

    // Process speech result
    const processStartTime = Date.now();
    logger.info('Processing speech result:', {
      requestId,
      callSid,
      speechResult: req.body.SpeechResult,
      duration: processStartTime - startTime
    });

    const response = await processSpeechResult(
      req.body.CallSid,
      req.body.SpeechResult,
      requestId,
      'twilio'
    );

    const processEndTime = Date.now();
    logger.info('Speech processing completed:', {
      requestId,
      callSid,
      responseLength: response.length,
      responsePreview: response.substring(0, 100) + '...',
      processingDuration: processEndTime - processStartTime,
      totalDuration: processEndTime - startTime
    });

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(response);
    twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: SPEECH_TIMEOUT,
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: '30'
    });
    res.type('text/xml');
    res.send(twiml.toString());

    logger.info('Response sent to client:', {
      requestId,
      callSid,
      totalDuration: Date.now() - startTime
    });
  } catch (error) {
    logger.error('Error processing voice call:', {
      requestId,
      callSid,
      error: error.message,
      stack: error.stack,
      body: req.body,
      duration: Date.now() - startTime
    });

    // Send a user-friendly error response
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("I'm sorry, I'm having trouble processing your request. Please try again.");
    twiml.gather({
      input: 'speech',
      action: '/twilio/voice/process',
      method: 'POST',
      speechTimeout: SPEECH_TIMEOUT,
      speechModel: 'phone_call',
      enhanced: 'true',
      language: 'en-US',
      timeout: '30'
    });
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

export default router;