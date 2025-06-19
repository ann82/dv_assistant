import { WebSocket as RealWebSocket } from 'ws';
import { config } from './config.js';
import { ResponseGenerator } from '../dist/ResponseGenerator.js';
import twilio from 'twilio';
import { TwilioWebSocketServer } from '../websocketServer.js';
import logger from './logger.js';

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
  constructor(accountSid, authToken, phoneNumber, validateRequest = twilioValidateRequest, WebSocketClass = RealWebSocket, server) {
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
    if (server) {
      this.wsServer = new TwilioWebSocketServer(server);
    } else {
      this.wsServer = null;
    }
  }

  setWebSocketServer(server) {
    this.wsServer = new TwilioWebSocketServer(server);
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
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Invalid request. Please try again.');
        return twiml;
      }

      // Generate welcome message
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Welcome to the Domestic Violence Support Assistant. I can help you find shelter homes and resources in your area. How can I help you today?');
      
      // Add gather for speech input
      const gather = twiml.gather({
        input: 'speech',
        action: '/twilio/voice',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      return twiml;
    } catch (error) {
      logger.error('Error handling incoming call:', {
        error: error.message,
        stack: error.stack,
        headers: req.headers,
        body: req.body
      });
      
      // Return error TwiML
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('I encountered an error. Please try again later.');
      return twiml;
    }
  }

  async handleSpeechInput(req) {
    try {
      const speechResult = req.body.SpeechResult;
      logger.info('Received speech input:', { speechResult });

      // Process the speech input
      const response = await this.processSpeechInput(speechResult);
      
      // Generate TwiML response with gather to continue conversation
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(response);
      
      // Add gather to continue the conversation
      const gather = twiml.gather({
        input: 'speech',
        action: '/twilio/voice',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      // If no speech is detected, repeat the prompt
      twiml.say("I didn't hear anything. Please let me know if you need more information about these resources or if you'd like to search for resources in a different location.");
      twiml.redirect('/twilio/voice');
      
      return twiml;
    } catch (error) {
      logger.error('Error handling speech input:', {
        error: error.message,
        stack: error.stack,
        speechResult: req.body.SpeechResult
      });
      
      // Return error TwiML
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('I encountered an error processing your speech. Please try again.');
      
      // Add gather to continue after error
      const gather = twiml.gather({
        input: 'speech',
        action: '/twilio/voice',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US'
      });
      
      return twiml;
    }
  }

  async processSpeechInput(speechResult) {
    try {
      const requestId = Math.random().toString(36).substring(7);
      const callSid = null; // For voice calls, we don't have a callSid in this context
      
      logger.info('Processing speech input:', {
        requestId,
        callSid,
        speechResult,
        requestType: 'twilio',
        timestamp: new Date().toISOString()
      });

      // Import required functions
      const { getIntent, getConversationContext, rewriteQuery, updateConversationContext } = await import('../lib/intentClassifier.js');
      const { extractLocationFromSpeech, generateLocationPrompt } = await import('../lib/speechProcessor.js');
      const { callTavilyAPI } = await import('../lib/apis.js');
      const { formatTavilyResponse } = await import('../routes/twilio.js');
      
      // Get intent classification
      const intent = await getIntent(speechResult);
      logger.info('Classified intent:', {
        requestId,
        callSid,
        intent,
        speechResult
      });

      // Get conversation context
      const context = callSid ? getConversationContext(callSid) : null;
      logger.info('Retrieved conversation context:', {
        requestId,
        callSid,
        hasContext: !!context,
        lastIntent: context?.lastIntent
      });

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

      // Rewrite query with context
      const rewrittenQuery = rewriteQuery(speechResult, intent, callSid);
      logger.info('Rewritten query:', {
        requestId,
        callSid,
        originalQuery: speechResult,
        rewrittenQuery,
        intent
      });

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
      const formattedResponse = formatTavilyResponse(tavilyResponse, 'twilio');
      logger.info('Formatted response:', {
        requestId,
        callSid,
        responseLength: formattedResponse.length,
        responsePreview: formattedResponse.substring(0, 100) + '...'
      });

      // Update conversation context
      if (callSid) {
        updateConversationContext(callSid, intent, rewrittenQuery, formattedResponse);
        logger.info('Updated conversation context:', {
          requestId,
          callSid,
          intent,
          queryLength: rewrittenQuery.length,
          responseLength: formattedResponse.length
        });
      }

      return formattedResponse;
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
    let responseTimeout;
    let isResponding = false;
    let lastRequestId = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RESPONSE_TIMEOUT = 30000; // Reduced from 90s to 30s
    const SPEECH_TIMEOUT = 10000; // Reduced from 15s to 10s
    const CONNECTION_TIMEOUT = 30000; // Reduced from 60s to 30s
    const ACTIVITY_CHECK_INTERVAL = 15000; // Reduced from 30s to 15s

    // Set up activity monitoring
    const activityCheck = setInterval(() => {
      const call = this.activeCalls.get(callSid);
      if (call) {
        const timeSinceLastActivity = Date.now() - call.lastActivity;
        if (timeSinceLastActivity > CONNECTION_TIMEOUT) {
          logger.error(`No activity detected for call ${callSid} for ${timeSinceLastActivity}ms`);
          clearInterval(activityCheck);
          this.handleCallTimeout(callSid, res);
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Store the interval in the call's timeouts set
    const call = this.activeCalls.get(callSid);
    if (call) {
      call.timeouts.add(activityCheck);
    }

    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data);
        if (event.type === 'response.text') {
          // Update last activity time
          const call = this.activeCalls.get(callSid);
          if (call) {
            call.lastActivity = Date.now();
          }

          // Check for duplicate requests
          if (event.requestId === lastRequestId) {
            logger.info(`Duplicate response request for call ${callSid}, ignoring`);
            return;
          }
          lastRequestId = event.requestId;

          isResponding = true;
          
          // Clear any existing timeout
          if (responseTimeout) {
            clearTimeout(responseTimeout);
          }

          // Set a timeout for the response
          responseTimeout = setTimeout(() => {
            if (isResponding) {
              logger.error(`Response timeout for call ${callSid}`);
              if (retryCount < MAX_RETRIES) {
                retryCount++;
                logger.info(`Retrying response for call ${callSid} (attempt ${retryCount}/${MAX_RETRIES})`);
                const twiml = this.generateTwiML("I'm still processing your request. Please hold on.", true);
                this.sendTwiMLResponse(res, twiml);
              } else {
                logger.error(`Max retries reached for call ${callSid}`);
                this.handleCallTimeout(callSid, res);
              }
            }
          }, RESPONSE_TIMEOUT);

          // Store the timeout in the call's timeouts set
          if (call) {
            call.timeouts.add(responseTimeout);
          }

          // Process the response
          const response = event.text;
          if (response) {
            isResponding = false;
            clearTimeout(responseTimeout);
            retryCount = 0;

            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${response}</Say>
  <Pause length="1"/>
  <Gather input="speech" action="/twilio/voice" method="POST" 
          speechTimeout="${SPEECH_TIMEOUT}" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`;

            await this.sendTwiMLResponse(res, twiml);
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
    const twiml = this.generateTwiML("I'm having trouble processing your request. Please try again.", true);
    await this.sendTwiMLResponse(res, twiml);
    this.cleanupCall(callSid);
  }

  async handleCallError(callSid, res, error) {
    logger.error(`Call error for ${callSid}:`, error);
    const twiml = this.generateTwiML("I encountered an error. Please try again.", true);
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
  <Gather input="speech" action="/twilio/voice" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>`;
    }

    twiml += `
</Response>`;

    return twiml;
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
      const errorTwiml = new twilio.twiml.VoiceResponse();
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

        // Ask for consent before ending the call
        if (!call.hasConsent) {
          const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Before we end this call, would you like to receive a summary of our conversation and follow-up resources via text message? Please say yes or no.</Say>
  <Gather input="speech" action="/twilio/consent" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`;

          await this.sendTwiMLResponse(res, twiml);
          return; // Wait for consent response before proceeding
        }

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
}