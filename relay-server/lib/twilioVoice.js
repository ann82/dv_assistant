import { WebSocket as RealWebSocket } from 'ws';
import { config } from './config.js';
import { ResponseGenerator } from './ResponseGenerator.js';
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
    if (!accountSid.startsWith('AC')) {
      throw new Error('accountSid must start with AC');
    }
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.phoneNumber = phoneNumber;
    this.activeCalls = new Map(); // Track active calls
    this.validateRequest = validateRequest;
    this.WebSocketClass = WebSocketClass;
    this.twilioClient = twilio(accountSid, authToken);
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

  async handleIncomingCall(req, res) {
    try {
      if (!this.validateTwilioRequest(req)) {
        return this.sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.INVALID_REQUEST);
      }

      const { CallSid, From } = req.body || {};
      if (!CallSid || !From) {
        return this.sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.INVALID_REQUEST);
      }

      // Check if we're already processing this call
      if (this.processingRequests.has(CallSid)) {
        logger.info(`Duplicate request for call ${CallSid}, ignoring`);
        return this.sendSuccessResponse(res);
      }

      logger.info(`📞 Incoming call from ${From} (CallSid: ${CallSid})`);

      // Mark call as being processed
      this.processingRequests.set(CallSid, true);

      const ws = await this.createWebSocketConnection(CallSid, From, res);
      if (!ws) {
        this.processingRequests.delete(CallSid);
        return this.sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.INVALID_REQUEST);
      }

      this.setupWebSocketHandlers(ws, CallSid, res);
      
      // Initial TwiML response with consent request
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Welcome to the Domestic Violence Support Assistant. I'm here to help you today.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Amy">Would you like to receive a summary of our conversation and follow-up resources via text message after the call? Please say yes or no.</Say>
  <Gather input="speech" action="/twilio/consent" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`;

      await this.sendTwiMLResponse(res, twiml);

    } catch (error) {
      logger.error('Error handling incoming call:', error);
      this.sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.INVALID_REQUEST);
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
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    const params = req.body || {};
    
    if (!twilioSignature) return false;
    
    logger.debug('[REAL] validateTwilioRequest calling validateRequest:', {authToken: this.authToken, twilioSignature, url, params});
    return this.validateRequest(
      this.authToken,
      twilioSignature,
      url,
      params
    );
  }

  async createWebSocketConnection(callSid, from, res) {
    try {
      const ws = new this.WebSocketClass(`ws://localhost:${config.WS_PORT}?type=phone`);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== RealWebSocket.OPEN) {
          logger.error(`WebSocket connection timeout for call ${callSid}`);
          ws.terminate();
          if (res) {
            const twiml = this.generateTwiML("I'm having trouble connecting. Please try again in a moment.", true);
            this.sendTwiMLResponse(res, twiml);
          }
        }
      }, 60000); // Increased to 60 seconds

      ws.on('open', () => {
        logger.info(`WebSocket connected for call ${callSid}`);
        clearTimeout(connectionTimeout);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for call ${callSid}:`, error);
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
      logger.error('Error creating WebSocket connection:', error);
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
    const RESPONSE_TIMEOUT = 90000; // Increased to 90 seconds for response generation
    const SPEECH_TIMEOUT = 15000; // Increased to 15 seconds for speech input
    const CONNECTION_TIMEOUT = 60000; // Increased to 60 seconds for WebSocket connection
    const ACTIVITY_CHECK_INTERVAL = 30000; // Check for activity every 30 seconds

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
      res.set('Content-Type', 'text/xml');
      await new Promise((resolve, reject) => {
        res.send(twiml, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      logger.error('Error sending TwiML response:', error);
      throw error;
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
}