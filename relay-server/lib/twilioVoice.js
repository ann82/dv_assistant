import { WebSocket as RealWebSocket } from 'ws';
import { config } from './config.js';
import { ResponseGenerator } from './response.js';
import { validateRequest as twilioValidateRequest } from 'twilio';

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
  constructor(accountSid, authToken, phoneNumber, validateRequest = twilioValidateRequest, WebSocketClass = RealWebSocket) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.phoneNumber = phoneNumber;
    this.activeCalls = new Map(); // Track active calls
    this.validateRequest = validateRequest;
    this.WebSocketClass = WebSocketClass;
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
        throw new Error('Failed to create WebSocket connection');
      }

      this.setupWebSocketHandlers(ws, CallSid, res);
      
      // Initial TwiML response
      const twiml = this.generateTwiML(
        'Welcome to the Domestic Violence Support Assistant. How can I help you today?'
      );
      this.sendTwiMLResponse(res, twiml);

    } catch (error) {
      console.error('Error handling incoming call:', error);
      this.sendErrorResponse(res, HTTP_STATUS.SERVER_ERROR, ERROR_MESSAGES.PROCESSING_ERROR);
    }
  }

  async handleCallStatus(req, res) {
    try {
      const { CallSid, CallStatus } = req.body;
      console.log(`Call ${CallSid} status: ${CallStatus}`);

      if (CallStatus === CALL_STATUS.COMPLETED || CallStatus === CALL_STATUS.FAILED) {
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
          const twiml = this.generateTwiML(event.text);
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

  generateTwiML(text) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${this.escapeXML(text)}</Say>
  <Gather input="speech" action="/twilio/voice" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`;
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
    res.type('text/xml');
    res.send(twiml);
  }

  sendErrorResponse(res, status, message) {
    res.status(status).send(message);
  }

  sendSuccessResponse(res) {
    res.status(HTTP_STATUS.OK).send('OK');
  }
} 