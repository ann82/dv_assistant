import { WebSocket as RealWebSocket } from 'ws';
import { config } from './config.js';
import { ResponseGenerator } from './response.js';
import twilio from 'twilio';
import { TwilioWebSocketServer } from '../websocketServer.js';

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

      console.log(`📞 Incoming call from ${From} (CallSid: ${CallSid})`);

      const ws = await this.createWebSocketConnection(CallSid, From);
      if (!ws) {
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

      this.sendTwiMLResponse(res, twiml);

    } catch (error) {
      console.error('Error handling incoming call:', error);
      this.sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  async handleCallStatus(req, res) {
    try {
      const { CallSid, CallStatus } = req.body;
      console.log(`Call ${CallSid} status: ${CallStatus}`);

      if (CallStatus === CALL_STATUS.COMPLETED || CallStatus === CALL_STATUS.FAILED) {
        if (this.wsServer) {
          await this.wsServer.handleCallEnd(CallSid);
        }
        await this.cleanupCall(CallSid);
      }

      this.sendSuccessResponse(res);
    } catch (error) {
      console.error('Error handling call status:', error);
      this.sendErrorResponse(res, HTTP_STATUS.SERVER_ERROR, ERROR_MESSAGES.STATUS_ERROR);
    }
  }

  validateTwilioRequest(req) {
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    const params = req.body || {};
    
    if (!twilioSignature) return false;
    
    console.log('[REAL] validateTwilioRequest calling validateRequest:', {authToken: this.authToken, twilioSignature, url, params});
    return this.validateRequest(
      this.authToken,
      twilioSignature,
      url,
      params
    );
  }

  async createWebSocketConnection(callSid, from) {
    try {
      const ws = new this.WebSocketClass(`ws://localhost:${config.WS_PORT}?type=phone`);
      
      this.activeCalls.set(callSid, {
        ws,
        from,
        startTime: new Date()
      });

      return ws;
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      return null;
    }
  }

  setupWebSocketHandlers(ws, callSid, res) {
    ws.on('open', () => {
      console.log(`WebSocket connected for call ${callSid}`);
    });

    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data);
        if (event.type === 'response.text') {
          // Don't gather input if the response indicates the end of conversation
          const shouldGather = !event.text.toLowerCase().includes('goodbye') && 
                             !event.text.toLowerCase().includes('take care') &&
                             !event.text.toLowerCase().includes('bye');
          
          const twiml = this.generateTwiML(event.text, shouldGather);
          this.sendTwiMLResponse(res, twiml);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket closed for call ${callSid}`);
      this.activeCalls.delete(callSid);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for call ${callSid}:`, error);
      this.activeCalls.delete(callSid);
    });
  }

  async cleanupCall(callSid) {
    const call = this.activeCalls.get(callSid);
    if (call) {
      try {
        call.ws.close();
      } catch (error) {
        console.error(`Error closing WebSocket for call ${callSid}:`, error);
      }
      this.activeCalls.delete(callSid);
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

  sendTwiMLResponse(res, twiml) {
    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Content-Length': Buffer.byteLength(twiml)
    });
    res.end(twiml);
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
    console.log(`[Call ${callSid}] Status update received:`, {
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
          console.warn(`[Call ${callSid}] No active call data found`);
          return;
        }

        // Enhanced validation
        if (!call.from) {
          console.warn(`[Call ${callSid}] No phone number found for call`);
          return;
        }

        if (!call.startTime) {
          console.warn(`[Call ${callSid}] No start time recorded for call`);
          return;
        }

        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(call.from)) {
          console.warn(`[Call ${callSid}] Invalid phone number format: ${call.from}`);
          return;
        }

        console.log(`[Call ${callSid}] Processing call end:`, {
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
        console.error(`[Call ${callSid}] Error in handleCallStatusUpdate:`, error);
      }
    }
  }

  async sendSMSWithRetry(callSid, call, summary, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000;

    try {
      console.log(`[Call ${callSid}] Attempting to send SMS (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      
      const message = await this.twilioClient.messages.create({
        body: summary,
        to: call.from,
        from: this.phoneNumber
      });

      // Verify SMS was sent successfully
      if (message.sid) {
        console.log(`[Call ${callSid}] SMS sent successfully:`, {
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
      console.error(`[Call ${callSid}] Error sending SMS:`, {
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
        console.log(`[Call ${callSid}] Retrying SMS in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.sendSMSWithRetry(callSid, call, summary, retryCount + 1);
      } else {
        console.error(`[Call ${callSid}] Max retry attempts reached for SMS`);
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
      console.error(`[Call ${callSid}] Error generating call summary:`, error);
      return 'Unable to generate call summary. Please contact support for assistance.';
    }
  }
}