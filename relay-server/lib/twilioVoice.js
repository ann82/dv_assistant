import { WebSocket as RealWebSocket } from 'ws';
import { config } from './config.js';
import { ResponseGenerator } from './response.js';
import twilio from 'twilio';
import { TwilioWebSocketServer } from '../websocketServer.js';
import logger from './logger.js';
import { getConversationContext } from './intentClassifier.js';
import { AudioService } from '../services/audioService.js';
import path from 'path';
import fs from 'fs/promises';

// Get validateRequest from twilio package
const { validateRequest: twilioValidateRequest } = twilio;

// Constants for better maintainability
const CALL_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  IN_PROGRESS: 'in-progress'
};

const ERROR_MESSAGES = {
  INVALID_REQUEST: 'Invalid Twilio request',
  PROCESSING_ERROR: 'Error processing call',
  STATUS_ERROR: 'Error processing call status'
};

const HTTP_STATUS = {
  OK: 200,
  FORBIDDEN: 403,
  SERVER_ERROR: 500
};

export class TwilioVoiceHandler {
  constructor(accountSid, authToken, phoneNumber, validateRequest = twilioValidateRequest, WebSocketClass = RealWebSocket, VoiceResponseClass = twilio.twiml.VoiceResponse) {
    // Handle test environment where credentials might not be available
    if (process.env.NODE_ENV === 'test') {
      this.accountSid = accountSid || 'ACtest123456789';
      this.authToken = authToken || 'test_auth_token';
      this.phoneNumber = phoneNumber || '+1234567890';
    } else {
      // Production environment - validate credentials
      if (!accountSid || !accountSid.startsWith('AC')) {
        throw new Error('accountSid must start with AC');
      }
      if (!authToken) {
        throw new Error('authToken is required');
      }
      if (!phoneNumber) {
        throw new Error('phoneNumber is required');
      }
      this.accountSid = accountSid;
      this.authToken = authToken;
      this.phoneNumber = phoneNumber;
    }
    
    this.activeCalls = new Map(); // Track active calls
    this.validateRequest = validateRequest;
    this.WebSocketClass = WebSocketClass;
    this.twilioClient = twilio(this.accountSid, this.authToken);
    this.processingRequests = new Map(); // Track processing requests
    this.VoiceResponseClass = VoiceResponseClass;
    this.wsServer = null; // Initialize as null, will be set later via setWebSocketServer
    
    // Initialize AudioService for OpenAI TTS
    this.audioService = new AudioService();
    
    // Schedule periodic cleanup of old audio files
    this.scheduleAudioCleanup();
  }

  setWebSocketServer(wsServer) {
    // Accept the WebSocket server instance directly instead of creating a new one
    this.wsServer = wsServer;
  }

  async handleIncomingCall(req) {
    try {
      // Set longer timeout for Twilio requests
      req.setTimeout(30000); // 30 seconds timeout
      
      // Log request headers for debugging
      logger.info('Twilio Request Headers:', {
        headers: req.headers,
        body: req.body,
        url: req.originalUrl,
        protocol: req.protocol,
        host: req.get('host'),
        method: req.method
      });

      // Validate request
      if (!this.validateTwilioRequest(req)) {
        logger.error('Invalid Twilio request:', {
          headers: req.headers,
          body: req.body,
          url: req.originalUrl,
          method: req.method
        });
        const twiml = new this.VoiceResponseClass();
        twiml.say('Invalid request. Please try again.');
        return twiml;
      }

      // Generate welcome message using OpenAI TTS
      const welcomeMessage = 'Welcome to the Domestic Violence Support Assistant. I can help you find shelter homes and resources in your area. How can I help you today?';
      const twiml = await this.generateTTSBasedTwiML(welcomeMessage, true);
      
      return twiml;
    } catch (error) {
      logger.error('Error handling incoming call:', {
        error: error.message,
        stack: error.stack,
        headers: req.headers,
        body: req.body
      });
      
      // Return error TwiML using fallback Polly
      const twiml = new this.VoiceResponseClass();
      twiml.say('I encountered an error. Please try again later.');
      return twiml;
    }
  }

  async handleSpeechInput(req) {
    try {
      const speechResult = req.body.SpeechResult;
      const callSid = req.body.CallSid;
      logger.info('Received speech input:', { speechResult, callSid });

      // Preprocess speech input
      const cleanedSpeechResult = this.preprocessSpeech(speechResult);
      
      // Process the speech input
      const processResult = await this.processSpeechInput(cleanedSpeechResult, callSid);
      
      // Extract response and flags from processResult
      const response = typeof processResult === 'string' ? processResult : processResult.response;
      const shouldEndCall = typeof processResult === 'object' && processResult.shouldEndCall;
      const shouldRedirectToConsent = typeof processResult === 'object' && processResult.shouldRedirectToConsent;
      
      // Handle consent redirect
      if (shouldRedirectToConsent) {
        logger.info('Redirecting to consent endpoint:', { callSid, speechResult });
        const twiml = new this.VoiceResponseClass();
        twiml.say(response);
        twiml.redirect('/twilio/consent');
        return twiml;
      }
      
      // Generate TwiML response using OpenAI TTS
      const twiml = await this.generateTTSBasedTwiML(response, !shouldEndCall);
      
      // Only add gather if we don't want to end the call
      if (!shouldEndCall) {
        // If no speech is detected, repeat the prompt
        const noSpeechMessage = "I didn't hear anything. Please let me know if you need more information about these resources or if you'd like to search for resources in a different location.";
        const noSpeechTwiml = await this.generateTTSBasedTwiML(noSpeechMessage, true);
        // Note: The gather is already included in the main response, so we just return it
      }
      
      return twiml;
    } catch (error) {
      logger.error('Error handling speech input:', {
        error: error.message,
        stack: error.stack,
        speechResult: req.body.SpeechResult
      });
      
      // Return error TwiML using fallback Polly
      const twiml = new this.VoiceResponseClass();
      twiml.say('I encountered an error processing your speech. Please try again.');
      
      // Add gather to continue after error
      const gather = twiml.gather({
        input: 'speech',
        action: '/twilio/voice/process',
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: 'true',
        language: 'en-US',
        speechRecognitionLanguage: 'en-US',
        profanityFilter: 'false',
        interimSpeechResultsCallback: '/twilio/voice/interim',
        interimSpeechResultsCallbackMethod: 'POST'
      });
      
      return twiml;
    }
  }

  async processSpeechInput(speechResult, callSid = null) {
    const requestId = Math.random().toString(36).substring(7);

    try {
      logger.info('Processing speech input:', {
        requestId,
        callSid,
        speechResult,
        requestType: 'twilio',
        timestamp: new Date().toISOString()
      });

      // Import required functions
      const { getIntent, getConversationContext, rewriteQuery, updateConversationContext, handleFollowUp, cleanResultTitle, manageConversationFlow, shouldAttemptReengagement, generateReengagementMessage } = await import('../lib/intentClassifier.js');
      const { extractLocation, generateLocationPrompt } = await import('../lib/speechProcessor.js');
      const { callTavilyAPI } = await import('../lib/apis.js');
      const { ResponseGenerator } = await import('../lib/response.js');
      
      // Get conversation context FIRST
      const context = callSid ? getConversationContext(callSid) : null;
      logger.info('Retrieved conversation context:', {
        requestId,
        callSid,
        hasContext: !!context,
        lastIntent: context?.lastIntent,
        lastQuery: context?.lastQuery,
        historyLength: context?.history?.length,
        hasLastQueryContext: !!context?.lastQueryContext,
        fullContext: context
      });

      // Check for follow-up questions BEFORE intent classification
      const followUpResponse = context?.lastQueryContext ? await handleFollowUp(speechResult, context.lastQueryContext) : null;
      
      logger.info('Follow-up question check (before intent classification):', {
        requestId,
        callSid,
        isFollowUp: !!followUpResponse,
        followUpType: followUpResponse?.type,
        speechResult,
        lastIntent: context?.lastIntent,
        hasLastQueryContext: !!context?.lastQueryContext
      });

      // If this is a follow-up question, handle it directly and skip intent classification
      if (followUpResponse) {
        logger.info('Processing follow-up question (bypassing intent classification):', {
          requestId,
          callSid,
          speechResult,
          followUpType: followUpResponse.type,
          lastIntent: context.lastIntent,
          matchedResult: followUpResponse.matchedResult ? cleanResultTitle(followUpResponse.matchedResult.title) : null
        });

        // Update conversation context with follow-up response and focus tracking
        if (callSid) {
          updateConversationContext(callSid, context.lastIntent || 'general_information', speechResult, {
            voiceResponse: followUpResponse.voiceResponse,
            smsResponse: followUpResponse.smsResponse
          }, null, followUpResponse.matchedResult);
          logger.info('Updated conversation context for follow-up:', {
            requestId,
            callSid,
            intent: context.lastIntent || 'general_information',
            followUpType: followUpResponse.type,
            focusResultTitle: followUpResponse.matchedResult ? cleanResultTitle(followUpResponse.matchedResult.title) : null
          });
        }

        return followUpResponse.voiceResponse;
      }

      // Only classify intent if it's not a follow-up question
      const intent = await getIntent(speechResult);
      logger.info('Classified intent:', {
        requestId,
        callSid,
        intent,
        speechResult
      });

      // Check if this might be a consent response that wasn't caught by the route handler
      const lowerSpeech = speechResult.toLowerCase();
      const consentKeywords = ['yes', 'no', 'agree', 'disagree', 'ok', 'okay', 'sure', 'nope'];
      const isConsentResponse = consentKeywords.some(keyword => lowerSpeech.includes(keyword));
      const lastResponse = callSid ? this.activeCalls.get(callSid)?.lastResponse : null;
      const wasAskingForConsent = lastResponse && (
        lastResponse.includes('text message') || 
        lastResponse.includes('summary') || 
        lastResponse.includes('yes or no') ||
        lastResponse.includes('receive a summary')
      );
      
      // If this looks like a consent response, redirect to consent endpoint
      if (isConsentResponse && wasAskingForConsent) {
        logger.info('Detected consent response in processSpeechInput, redirecting to consent endpoint:', {
          requestId,
          callSid,
          speechResult,
          lastResponse
        });
        return {
          response: "Redirecting to consent endpoint",
          shouldRedirectToConsent: true
        };
      }

      // Manage conversation flow based on intent
      const conversationFlow = manageConversationFlow(intent, speechResult, context);
      logger.info('Conversation flow management:', {
        requestId,
        callSid,
        intent,
        shouldContinue: conversationFlow.shouldContinue,
        shouldEndCall: conversationFlow.shouldEndCall,
        shouldReengage: conversationFlow.shouldReengage,
        redirectionMessage: conversationFlow.redirectionMessage
      });

      // Handle conversation end
      if (conversationFlow.shouldEndCall) {
        logger.info('Ending conversation based on intent:', {
          requestId,
          callSid,
          intent,
          speechResult
        });
        return {
          response: conversationFlow.redirectionMessage,
          shouldEndCall: true
        };
      }

      // Handle SMS consent request
      if (conversationFlow.redirectionMessage && 
          conversationFlow.redirectionMessage.includes('summary') && 
          conversationFlow.redirectionMessage.includes('text message')) {
        logger.info('Requesting SMS consent:', {
          requestId,
          callSid,
          intent,
          speechResult
        });
        return {
          response: conversationFlow.redirectionMessage,
          shouldRedirectToConsent: true
        };
      }

      // Handle re-engagement attempts
      if (conversationFlow.shouldReengage) {
        logger.info('Re-engaging conversation:', {
          requestId,
          callSid,
          intent,
          speechResult
        });
        return conversationFlow.redirectionMessage;
      }

      // Handle off-topic redirection
      if (conversationFlow.redirectionMessage && intent === 'off_topic') {
        logger.info('Redirecting off-topic conversation:', {
          requestId,
          callSid,
          intent,
          speechResult
        });
        return conversationFlow.redirectionMessage;
      }

      // Check for re-engagement based on context
      if (context && shouldAttemptReengagement(context)) {
        const reengagementMessage = generateReengagementMessage(context);
        logger.info('Attempting re-engagement based on context:', {
          requestId,
          callSid,
          intent,
          speechResult,
          reengagementMessage
        });
        return reengagementMessage;
      }

      // Handle different intents appropriately
      logger.info('Processing intent:', {
        requestId,
        callSid,
        intent,
        speechResult
      });

      // For general information requests, don't require location
      if (intent === 'general_information') {
        // Rewrite query for general information search
        const rewrittenQuery = await rewriteQuery(speechResult, intent, callSid);
        logger.info('Rewritten query for general information:', {
          requestId,
          callSid,
          originalQuery: speechResult,
          rewrittenQuery,
          intent
        });

        // Ensure we have a valid query for Tavily
        if (!rewrittenQuery || typeof rewrittenQuery !== 'string' || rewrittenQuery.trim() === '') {
          logger.error('Invalid rewritten query for general information:', {
            requestId,
            callSid,
            originalQuery: speechResult,
            rewrittenQuery,
            intent
          });
          return "I'm sorry, I couldn't process your request. Please try rephrasing your question.";
        }

        // Call Tavily API for general information
        logger.info('Calling Tavily API for general information:', {
          requestId,
          callSid,
          query: rewrittenQuery
        });
        const tavilyResponse = await callTavilyAPI(rewrittenQuery);

        // Format response for voice
        const formattedResponse = ResponseGenerator.formatTavilyResponse(tavilyResponse, 'twilio');
        
        // Update conversation context
        if (callSid) {
          updateConversationContext(callSid, intent, rewrittenQuery, formattedResponse, tavilyResponse);
        }

        return formattedResponse.voiceResponse;
      }

      // For resource-related intents (shelter, legal, counseling), extract location
      if (intent === 'find_shelter' || intent === 'legal_services' || intent === 'counseling_services' || intent === 'other_resources') {
        // Extract location from speech using enhanced location detector
        const { extractLocationFromQuery, detectUSLocation } = await import('./enhancedLocationDetector.js');
        const locationInfo = extractLocationFromQuery(speechResult);
        
        logger.info('Extracted location info:', {
          requestId,
          callSid,
          locationInfo,
          originalSpeech: speechResult
        });

        // Check for incomplete location queries
        if (locationInfo.scope === 'incomplete') {
          logger.info('Incomplete location query detected, asking for specific location:', {
            requestId,
            callSid,
            speechResult
          });
          return "I'd be happy to help you find shelter. Could you please tell me which city or area you're looking for? For example, you could say 'near San Francisco' or 'in New York'.";
        }

        if (!locationInfo.location) {
          logger.info('No location found in speech, generating prompt:', {
            requestId,
            callSid,
            speechResult
          });
          return generateLocationPrompt();
        }

        // Enhanced: Check if location is US or not
        const usLocationInfo = await detectUSLocation(locationInfo.location);
        if (usLocationInfo && usLocationInfo.isUS === false) {
          logger.info('Non-US location detected, informing user:', { 
            location: locationInfo.location, 
            callSid,
            requestId
          });
          return "I'm sorry, we are currently available only for US cities.";
        }

        // Rewrite query with context
        const rewrittenQuery = await rewriteQuery(speechResult, intent, callSid);
        logger.info('Rewritten query:', {
          requestId,
          callSid,
          originalQuery: speechResult,
          rewrittenQuery,
          intent
        });

        // Ensure we have a valid query for Tavily
        if (!rewrittenQuery || typeof rewrittenQuery !== 'string' || rewrittenQuery.trim() === '') {
          logger.error('Invalid rewritten query for resource search:', {
            requestId,
            callSid,
            originalQuery: speechResult,
            rewrittenQuery,
            intent,
            locationInfo
          });
          return "I'm sorry, I couldn't process your request. Please try rephrasing your question with a specific location.";
        }

        // Call Tavily API with rewritten query
        logger.info('Calling Tavily API:', {
          requestId,
          callSid,
          query: rewrittenQuery
        });
        const tavilyResponse = await callTavilyAPI(rewrittenQuery);

        logger.info('Received Tavily API response:', {
          requestId,
          callSid,
          responseLength: tavilyResponse?.length,
          hasResults: !!tavilyResponse?.results,
          resultCount: tavilyResponse?.results?.length,
          firstResultTitle: tavilyResponse?.results?.[0]?.title,
          firstResultUrl: tavilyResponse?.results?.[0]?.url
        });

        // Format response for voice
        const formattedResponse = ResponseGenerator.formatTavilyResponse(tavilyResponse, 'twilio');
        logger.info('Formatted response:', {
          requestId,
          callSid,
          responseLength: formattedResponse.voiceResponse.length,
          responsePreview: formattedResponse.voiceResponse.substring(0, 100) + '...'
        });

        // Update conversation context
        if (callSid) {
          updateConversationContext(callSid, intent, rewrittenQuery, formattedResponse, tavilyResponse);
          logger.info('Updated conversation context:', {
            requestId,
            callSid,
            intent,
            queryLength: rewrittenQuery.length,
            responseLength: formattedResponse.voiceResponse.length,
            hasTavilyResults: !!tavilyResponse?.results,
            resultCount: tavilyResponse?.results?.length || 0
          });
        }

        return formattedResponse.voiceResponse;
      }

      // For emergency help, provide immediate assistance
      if (intent === 'emergency_help') {
        return "This is an emergency situation. Please call 911 immediately. You can also call the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance. They are available 24/7 and can help you with safety planning and emergency resources.";
      }

      // Default fallback for unknown intents
      return "I'm sorry, I didn't understand your request. Could you please rephrase that or ask for help finding shelters, legal services, or general information about domestic violence?";
    } catch (error) {
      logger.error('Error processing speech input:', {
        error: error.message,
        stack: error.stack,
        speechResult
      });
      return "I'm sorry, I encountered an error processing your request. Please try again.";
    }
  }

  async handleCallStatus(req, res) {
    try {
      const { CallSid, CallStatus } = req.body;
      logger.info(`Call ${CallSid} status: ${CallStatus}`);

      if (CallStatus === CALL_STATUS.COMPLETED || CallStatus === CALL_STATUS.FAILED) {
        if (this.wsServer) {
          await this.wsServer.handleCallEnd(CallSid);
        }
        await this.cleanupCall(CallSid);
        this.processingRequests.delete(CallSid);
      }

      this.sendSuccessResponse(res);
    } catch (error) {
      logger.error('Error handling call status:', error);
      this.sendErrorResponse(res, HTTP_STATUS.SERVER_ERROR, ERROR_MESSAGES.STATUS_ERROR);
    }
  }

  validateTwilioRequest(req) {
    try {
      // Log validation attempt with full details
      logger.info('Validating Twilio request:', {
        signature: req.headers['x-twilio-signature'],
        url: req.protocol + '://' + req.get('host') + req.originalUrl,
        body: req.body,
        headers: req.headers,
        method: req.method,
        host: req.get('host'),
        originalUrl: req.originalUrl,
        clientUa: req.headers['user-agent'],
        srcIp: req.ip
      });

      // Check if we have the required credentials
      if (!this.accountSid || !this.authToken) {
        logger.error('Missing Twilio credentials:', {
          hasAccountSid: !!this.accountSid,
          hasAuthToken: !!this.authToken,
          accountSid: this.accountSid ? 'present' : 'missing',
          authToken: this.authToken ? 'present' : 'missing'
        });
        return false;
      }

      // Check if we have the signature header
      const signature = req.headers['x-twilio-signature'];
      if (!signature) {
        logger.error('Missing Twilio signature header:', {
          headers: req.headers
        });
        return false;
      }

      // Get the full URL - handle Railway's proxy setup
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const url = `${protocol}://${host}${req.originalUrl}`;
      
      // Log the exact values being used for validation
      logger.info('Twilio validation parameters:', {
        authToken: this.authToken ? 'present' : 'missing',
        signature,
        url,
        body: req.body || {},
        method: req.method,
        protocol,
        host,
        originalUrl: req.originalUrl
      });

      // Validate the request
      const isValid = twilio.validateRequest(
        this.authToken,
        signature,
        url,
        req.body || {}
      );

      logger.info('Twilio request validation result:', {
        isValid,
        url,
        signature,
        hasBody: !!req.body,
        method: req.method,
        protocol,
        host
      });

      if (!isValid) {
        logger.error('Twilio request validation failed:', {
          url,
          signature,
          hasBody: !!req.body,
          method: req.method,
          headers: req.headers,
          protocol,
          host
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating Twilio request:', {
        error: error.message,
        stack: error.stack,
        headers: req.headers,
        body: req.body,
        url: req.originalUrl,
        method: req.method,
        protocol: req.protocol,
        host: req.get('host')
      });
      return false;
    }
  }

  async createWebSocketConnection(callSid, from, res) {
    try {
      // Get the WebSocket URL from environment variable or construct it
      const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
      const wsHost = process.env.RAILWAY_STATIC_URL || process.env.WS_HOST || 'localhost';
      const wsPort = process.env.WS_PORT || config.WS_PORT;
      const wsUrl = `${wsProtocol}://${wsHost}${wsPort ? ':' + wsPort : ''}?type=phone`;
      
      logger.info('Creating WebSocket connection:', {
        url: wsUrl,
        callSid,
        from
      });

      const ws = new this.WebSocketClass(wsUrl);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== RealWebSocket.OPEN) {
          logger.error(`WebSocket connection timeout for call ${callSid}`, {
            url: wsUrl,
            readyState: ws.readyState
          });
          ws.terminate();
          if (res) {
            const twiml = this.generateTwiML("I'm having trouble connecting. Please try again in a moment.", true);
            this.sendTwiMLResponse(res, twiml);
          }
        }
      }, 60000);

      ws.on('open', () => {
        logger.info(`WebSocket connected for call ${callSid}`, {
          url: wsUrl
        });
        clearTimeout(connectionTimeout);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for call ${callSid}:`, {
          error: error.message,
          url: wsUrl
        });
        clearTimeout(connectionTimeout);
        if (res) {
          const twiml = this.generateTwiML("I encountered an error. Please try again.", true);
          this.sendTwiMLResponse(res, twiml);
        }
      });

      this.activeCalls.set(callSid, {
        ws,
        from,
        startTime: new Date(),
        retryCount: 0,
        lastActivity: Date.now(),
        timeouts: new Set()
      });

      return ws;
    } catch (error) {
      logger.error('Error creating WebSocket connection:', {
        error: error.message,
        stack: error.stack,
        callSid,
        from
      });
      if (res) {
        const twiml = this.generateTwiML("I'm having trouble connecting. Please try again.", true);
        this.sendTwiMLResponse(res, twiml);
      }
      return null;
    }
  }

  setupWebSocketHandlers(ws, callSid, res) {
    // Use call-specific state management to prevent race conditions
    const call = this.activeCalls.get(callSid);
    if (!call) {
      logger.error(`No call found for ${callSid} in setupWebSocketHandlers`);
      return;
    }

    // Initialize call-specific state
    call.responseTimeout = null;
    call.isResponding = false;
    call.lastRequestId = null;
    call.retryCount = 0;
    call.pendingRequests = new Set();
    
    const MAX_RETRIES = 3;
    const RESPONSE_TIMEOUT = 30000; // 30 seconds
    const CONNECTION_TIMEOUT = 30000; // 30 seconds
    const ACTIVITY_CHECK_INTERVAL = 15000; // 15 seconds

    // Set up activity monitoring
    const activityCheck = setInterval(() => {
      const currentCall = this.activeCalls.get(callSid);
      if (currentCall) {
        const timeSinceLastActivity = Date.now() - currentCall.lastActivity;
        if (timeSinceLastActivity > CONNECTION_TIMEOUT) {
          logger.error(`No activity detected for call ${callSid} for ${timeSinceLastActivity}ms`);
          clearInterval(activityCheck);
          this.handleCallTimeout(callSid, res);
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Store the interval in the call's timeouts set
    currentCall.timeouts.add(activityCheck);

    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data);
        if (event.type === 'response.text') {
          const currentCall = this.activeCalls.get(callSid);
          if (!currentCall) {
            logger.error(`No call found for ${callSid} in message handler`);
            return;
          }

          // Update last activity time
          currentCall.lastActivity = Date.now();

          // Generate unique request ID with timestamp to prevent collisions
          const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          
          // Check for duplicate requests with better collision detection
          if (event.requestId === currentCall.lastRequestId && currentCall.isResponding) {
            logger.info(`Duplicate response request for call ${callSid}, ignoring`, {
              requestId: event.requestId,
              isResponding: currentCall.isResponding
            });
            return;
          }

          // Track this request
          currentCall.lastRequestId = event.requestId;
          currentCall.pendingRequests.add(requestId);
          currentCall.isResponding = true;
          
          // Clear any existing timeout
          if (currentCall.responseTimeout) {
            clearTimeout(currentCall.responseTimeout);
          }

          // Set a timeout for the response
          currentCall.responseTimeout = setTimeout(() => {
            if (currentCall.isResponding) {
              logger.error(`Response timeout for call ${callSid}`, {
                requestId,
                retryCount: currentCall.retryCount,
                pendingRequests: currentCall.pendingRequests.size
              });
              
              if (currentCall.retryCount < MAX_RETRIES) {
                currentCall.retryCount++;
                logger.info(`Retrying response for call ${callSid} (attempt ${currentCall.retryCount}/${MAX_RETRIES})`);
                const twiml = this.generateTwiML("I'm still processing your request. Please hold on.", true);
                this.sendTwiMLResponse(res, twiml);
              } else {
                logger.error(`Max retries reached for call ${callSid}`);
                this.handleCallTimeout(callSid, res);
              }
            }
          }, RESPONSE_TIMEOUT);

          // Store the timeout in the call's timeouts set
          currentCall.timeouts.add(currentCall.responseTimeout);

          // Process the response with proper error handling
          const response = event.text;
          if (response) {
            try {
              // Update conversation context BEFORE processing to ensure follow-up detection works
              const context = getConversationContext(callSid);
              if (context) {
                logger.info('Processing response with context:', {
                  callSid,
                  requestId,
                  hasContext: !!context,
                  lastIntent: context.lastIntent,
                  hasLastQueryContext: !!context.lastQueryContext
                });
              }

              // Process the speech input
              const processedResponse = await this.processSpeechInput(response, callSid);
              
              // Clear response state
              currentCall.isResponding = false;
              currentCall.retryCount = 0;
              currentCall.pendingRequests.delete(requestId);
              
              if (currentCall.responseTimeout) {
                clearTimeout(currentCall.responseTimeout);
                currentCall.responseTimeout = null;
              }

              // Generate TwiML response
              const twiml = await this.generateTTSBasedTwiML(processedResponse, true);

              await this.sendTwiMLResponse(res, twiml);
              
              logger.info('Successfully processed and sent response:', {
                callSid,
                requestId,
                responseLength: processedResponse.length,
                pendingRequests: currentCall.pendingRequests.size
              });

            } catch (error) {
              logger.error('Error processing response:', {
                callSid,
                requestId,
                error: error.message,
                stack: error.stack
              });
              
              // Clear response state on error
              currentCall.isResponding = false;
              currentCall.pendingRequests.delete(requestId);
              
              if (currentCall.responseTimeout) {
                clearTimeout(currentCall.responseTimeout);
                currentCall.responseTimeout = null;
              }

              // Send error response
              const errorTwiml = this.generateTwiML("I'm sorry, I encountered an error processing your request. Please try again.", true);
              await this.sendTwiMLResponse(res, errorTwiml);
            }
          } else {
            logger.warn('Empty response received for call:', {
              callSid,
              requestId,
              event
            });
            
            // Clear response state
            currentCall.isResponding = false;
            currentCall.pendingRequests.delete(requestId);
            
            if (currentCall.responseTimeout) {
              clearTimeout(currentCall.responseTimeout);
              currentCall.responseTimeout = null;
            }
          }
        }
      } catch (error) {
        logger.error(`Error processing WebSocket message for call ${callSid}:`, error);
        this.handleCallError(callSid, res, error);
      }
    });

    ws.on('close', () => {
      logger.info(`WebSocket connection closed for call ${callSid}`);
      this.cleanupCall(callSid);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for call ${callSid}:`, error);
      this.handleCallError(callSid, res, error);
    });
  }

  async handleCallTimeout(callSid, res) {
    logger.error(`Call timeout for ${callSid}`);
    const twiml = await this.generateTTSBasedTwiML("I'm having trouble processing your request. Please try again.", true);
    await this.sendTwiMLResponse(res, twiml);
    this.cleanupCall(callSid);
  }

  async handleCallError(callSid, res, error) {
    logger.error(`Call error for ${callSid}:`, error);
    const twiml = await this.generateTTSBasedTwiML("I encountered an error. Please try again.", true);
    await this.sendTwiMLResponse(res, twiml);
    this.cleanupCall(callSid);
  }

  async cleanupCall(callSid) {
    const call = this.activeCalls.get(callSid);
    if (call) {
      try {
        // Clear all timeouts
        call.timeouts.forEach(timeout => {
          if (typeof timeout === 'number') {
            clearTimeout(timeout);
          } else if (typeof timeout === 'object') {
            clearInterval(timeout);
          }
        });
        call.timeouts.clear();

        // Close WebSocket connection
        if (call.ws) {
          call.ws.close();
        }

        // Remove from active calls
        this.activeCalls.delete(callSid);
        
        logger.info(`Cleaned up call ${callSid}`);
      } catch (error) {
        logger.error(`Error cleaning up call ${callSid}:`, error);
      }
    }
  }

  generateTwiML(text, shouldGather = true) {
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${this.escapeXML(text)}</Say>`;

    // Only add Gather if we expect a response
    if (shouldGather) {
      twiml += `
  <Gather input="speech" action="/twilio/voice/process" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>`;
    }

    twiml += `
</Response>`;

    return twiml;
  }

  /**
   * Generate TTS audio using OpenAI and create TwiML with Play instead of Say
   * @param {string} text - Text to convert to speech
   * @param {boolean} shouldGather - Whether to add Gather element
   * @returns {Promise<string>} TwiML response with Play element
   */
  async generateTTSBasedTwiML(text, shouldGather = true) {
    try {
      logger.info('Generating TTS-based TwiML for text:', { 
        textLength: text.length,
        textPreview: text.substring(0, 100) + '...'
      });

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, config.TTS_TIMEOUT + 2000); // Add 2s buffer for TwiML generation

      try {
        // Generate TTS audio using OpenAI with timeout
        const ttsResult = await Promise.race([
          this.audioService.generateTTS(text),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TTS timeout')), config.TTS_TIMEOUT + 2000)
          )
        ]);
        
        clearTimeout(timeoutId);
        
        // Create audio URL for Twilio
        const audioUrl = `/audio/${ttsResult.fileName}`;
        
        logger.info('TTS audio generated successfully:', {
          fileName: ttsResult.fileName,
          audioUrl,
          cached: ttsResult.cached
        });

        // Generate TwiML with Play instead of Say
        let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>`;

        // Only add Gather if we expect a response
        if (shouldGather) {
          twiml += `
  <Gather input="speech" action="/twilio/voice/process" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"
          speechRecognitionLanguage="en-US"
          profanityFilter="false"
          interimSpeechResultsCallback="/twilio/voice/interim"
          interimSpeechResultsCallbackMethod="POST"/>`;
        }

        twiml += `
</Response>`;

        return twiml;
      } catch (ttsError) {
        clearTimeout(timeoutId);
        logger.error('TTS generation failed, falling back to Polly:', {
          error: ttsError.message,
          text: text.substring(0, 100) + '...'
        });
        
        // Fallback to Polly if TTS fails
        return this.generateTwiML(text, shouldGather);
      }
    } catch (error) {
      logger.error('Error generating TTS-based TwiML:', error);
      
      // Fallback to Polly if TTS fails
      logger.info('Falling back to Polly TTS due to error');
      return this.generateTwiML(text, shouldGather);
    }
  }

  escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async sendTwiMLResponse(res, twiml) {
    try {
      // Ensure twiml is a string
      const twimlString = typeof twiml === 'string' ? twiml : twiml.toString();
      
      // Set headers
      res.set('Content-Type', 'text/xml');
      
      // Send response
      return res.send(twimlString);
    } catch (error) {
      logger.error('Error sending TwiML response:', {
        error: error.message,
        stack: error.stack,
        twimlType: typeof twiml
      });
      
      // Send error response
      const errorTwiml = new this.VoiceResponseClass();
      errorTwiml.say('We encountered an error. Please try again later.');
      return res.status(500).send(errorTwiml.toString());
    }
  }

  sendErrorResponse(res, status, message) {
    res.writeHead(status, {
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(message)
    });
    res.end(message);
  }

  sendSuccessResponse(res) {
    res.writeHead(HTTP_STATUS.OK, {
      'Content-Type': 'text/plain',
      'Content-Length': 2
    });
    res.end('OK');
  }

  async handleCallStatusUpdate(callSid, status) {
    logger.info(`[Call ${callSid}] Status update received:`, {
      status,
      timestamp: new Date().toISOString(),
      activeCalls: this.activeCalls.size,
      memoryUsage: process.memoryUsage()
    });
    
    if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer') {
      try {
        // Validate call exists and has required data
        const call = this.activeCalls.get(callSid);
        if (!call) {
          logger.warn(`[Call ${callSid}] No active call data found`);
          return;
        }

        // Enhanced validation
        if (!call.from) {
          logger.warn(`[Call ${callSid}] No phone number found for call`);
          return;
        }

        if (!call.startTime) {
          logger.warn(`[Call ${callSid}] No start time recorded for call`);
          return;
        }

        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(call.from)) {
          logger.warn(`[Call ${callSid}] Invalid phone number format: ${call.from}`);
          return;
        }

        logger.info(`[Call ${callSid}] Processing call end:`, {
          status,
          hasConsent: call.hasConsent,
          from: call.from,
          startTime: call.startTime,
          duration: Date.now() - call.startTime,
        });

        // Send SMS if consent was given
        if (call.hasConsent) {
          const summary = await this.generateCallSummary(callSid, call);
          await this.sendSMSWithRetry(callSid, call, summary);
        }

        // Clean up call data
        await this.cleanupCall(callSid);
      } catch (error) {
        logger.error(`[Call ${callSid}] Error in handleCallStatusUpdate:`, error);
      }
    }
  }

  async sendSMSWithRetry(callSid, call, summary, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000;

    try {
      logger.info(`[Call ${callSid}] Attempting to send SMS (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      
      const message = await this.twilioClient.messages.create({
        body: summary,
        to: call.from,
        from: this.phoneNumber
      });

      // Verify SMS was sent successfully
      if (message.sid) {
        logger.info(`[Call ${callSid}] SMS sent successfully:`, {
          messageSid: message.sid,
          status: message.status,
          to: message.to,
          timestamp: new Date().toISOString(),
          attempt: retryCount + 1
        });

        // Store SMS details for tracking
        call.smsSent = {
          messageSid: message.sid,
          timestamp: new Date().toISOString(),
          status: message.status,
          attempts: retryCount + 1
        };
        this.activeCalls.set(callSid, call);
      } else {
        throw new Error('SMS SID not received');
      }
    } catch (smsError) {
      logger.error(`[Call ${callSid}] Error sending SMS:`, {
        error: smsError.message,
        code: smsError.code,
        status: smsError.status,
        timestamp: new Date().toISOString(),
        attempt: retryCount + 1
      });

      // Store SMS error for tracking
      call.smsError = {
        message: smsError.message,
        code: smsError.code,
        timestamp: new Date().toISOString(),
        attempts: retryCount + 1
      };
      this.activeCalls.set(callSid, call);

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        logger.info(`[Call ${callSid}] Retrying SMS in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.sendSMSWithRetry(callSid, call, summary, retryCount + 1);
      } else {
        logger.error(`[Call ${callSid}] Max retry attempts reached for SMS`);
      }
    }
  }

  async generateCallSummary(callSid, call) {
    try {
      // Check if WebSocket server is available
      if (!this.wsServer) {
        logger.warn(`[Call ${callSid}] WebSocket server not available, generating basic summary`);
        return `Call Summary:\n\nThank you for calling the Domestic Violence Support Assistant. We discussed resources and support options. If you need further assistance, please call back anytime.`;
      }
      
      const summary = await this.wsServer.handleCallEnd(callSid);
      if (!summary) {
        throw new Error('No summary generated');
      }
      return `Call Summary:\n\n${summary}`;
    } catch (error) {
      logger.error(`[Call ${callSid}] Error generating call summary:`, error);
      return 'Unable to generate call summary. Please contact support for assistance.';
    }
  }

  handleCallEnd(callSid) {
    try {
      const call = this.activeCalls.get(callSid);
      if (call) {
        logger.info('Handling call end', { callSid });
        
        // Clear all timeouts
        call.timeouts.forEach(timeout => clearTimeout(timeout));
        
        // Close WebSocket if it's still open
        if (call.ws && call.ws.readyState === RealWebSocket.OPEN) {
          call.ws.close();
        }
        
        // Remove from active calls
        this.activeCalls.delete(callSid);
      }
    } catch (error) {
      logger.error('Error handling call end:', {
        error: error.message,
        callSid
      });
    }
  }

  /**
   * Preprocess speech input to improve recognition accuracy
   * @param {string} speechResult - Raw speech result from Twilio
   * @returns {string} Cleaned speech result
   */
  preprocessSpeech(speechResult) {
    if (!speechResult || typeof speechResult !== 'string') {
      return speechResult;
    }

    let cleaned = speechResult.trim();

    // Remove common speech recognition artifacts
    const artifacts = [
      /\[inaudible\]/gi,
      /\[unintelligible\]/gi,
      /\[background noise\]/gi,
      /\[music\]/gi,
      /\[silence\]/gi,
      /\[crosstalk\]/gi,
      /\[laughter\]/gi,
      /\[applause\]/gi,
      /\[phone ringing\]/gi,
      /\[beep\]/gi,
      /\[static\]/gi
    ];

    artifacts.forEach(artifact => {
      cleaned = cleaned.replace(artifact, '');
    });

    // Fix common speech recognition errors
    const corrections = {
      'domestic violence': 'domestic violence',
      'domestic abuse': 'domestic abuse',
      'shelter home': 'shelter',
      'shelter homes': 'shelters',
      'help me find': 'find',
      'I need help finding': 'find',
      'I want to find': 'find',
      'can you help me find': 'find',
      'looking for': 'find',
      'search for': 'find',
      'near me': 'near me',
      'close to me': 'near me',
      'in my area': 'near me',
      'around here': 'near me'
    };

    Object.entries(corrections).forEach(([incorrect, correct]) => {
      const regex = new RegExp(incorrect, 'gi');
      cleaned = cleaned.replace(regex, correct);
    });

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If the cleaned result is too short or seems garbled, try to extract key words
    if (cleaned.length < 3 || this.isGarbled(cleaned)) {
      const keyWords = this.extractKeyWords(speechResult);
      if (keyWords.length > 0) {
        cleaned = keyWords.join(' ');
      }
    }

    logger.info('Speech preprocessing:', {
      original: speechResult,
      cleaned: cleaned,
      length: cleaned.length
    });

    return cleaned;
  }

  /**
   * Check if speech result appears to be garbled
   * @param {string} speech - Speech text to check
   * @returns {boolean} True if speech appears garbled
   */
  isGarbled(speech) {
    if (!speech || speech.length < 3) return true;

    // Check for excessive special characters
    const specialCharRatio = (speech.match(/[^a-zA-Z0-9\s]/g) || []).length / speech.length;
    if (specialCharRatio > 0.3) return true;

    // Check for repeated characters (common in garbled speech)
    const repeatedChars = speech.match(/(.)\1{3,}/g);
    if (repeatedChars && repeatedChars.length > 0) return true;

    // Check for very short words that might be artifacts
    const words = speech.split(/\s+/);
    const shortWords = words.filter(word => word.length <= 2);
    if (shortWords.length > words.length * 0.5) return true;

    return false;
  }

  /**
   * Extract key words from potentially garbled speech
   * @param {string} speech - Speech text to extract from
   * @returns {Array} Array of key words
   */
  extractKeyWords(speech) {
    const keyWords = [];
    
    // Common domestic violence related keywords
    const keywords = [
      'shelter', 'help', 'domestic', 'violence', 'abuse', 'safe', 'home',
      'find', 'near', 'me', 'location', 'area', 'city', 'state',
      'emergency', 'crisis', 'hotline', 'support', 'resource', 'service'
    ];

    const words = speech.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '');
      if (keywords.includes(cleanWord) && !keyWords.includes(cleanWord)) {
        keyWords.push(cleanWord);
      }
    });

    return keyWords;
  }

  /**
   * Clean up old audio files to prevent disk space issues
   * @param {number} maxAge - Maximum age of files in milliseconds (default: 24 hours)
   */
  async cleanupOldAudioFiles(maxAge = 24 * 60 * 60 * 1000) {
    try {
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      const files = await fs.readdir(audioDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.mp3')) {
          const filePath = path.join(audioDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            cleanedCount++;
            logger.info('Cleaned up old audio file:', { file });
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old audio files`);
      }
    } catch (error) {
      logger.error('Error cleaning up old audio files:', error);
    }
  }

  /**
   * Schedule periodic cleanup of old audio files
   */
  scheduleAudioCleanup() {
    // Clean up every 6 hours
    setInterval(() => {
      this.cleanupOldAudioFiles();
    }, 6 * 60 * 60 * 1000);
    
    logger.info('Scheduled audio file cleanup every 6 hours');
  }
}