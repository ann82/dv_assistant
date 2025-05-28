import { WebSocket } from 'ws';
import { config } from './config.js';
import { ResponseGenerator } from './response.js';

export class TwilioVoiceHandler {
  constructor(accountSid, authToken, phoneNumber) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.phoneNumber = phoneNumber;
    this.activeCalls = new Map(); // Track active calls
  }

  async handleIncomingCall(req, res) {
    try {
      // Validate Twilio request
      if (!this.validateTwilioRequest(req)) {
        return res.status(403).send('Invalid Twilio request');
      }

      const callSid = req.body.CallSid;
      console.log(`📞 Incoming call from ${req.body.From} (CallSid: ${callSid})`);

      // Create WebSocket connection to relay server
      const ws = new WebSocket(`ws://localhost:${config.WS_PORT}?type=phone`);
      
      // Store WebSocket connection
      this.activeCalls.set(callSid, {
        ws,
        from: req.body.From,
        startTime: new Date()
      });

      // Handle WebSocket events
      ws.on('open', () => {
        console.log(`WebSocket connected for call ${callSid}`);
      });

      ws.on('message', async (data) => {
        try {
          const event = JSON.parse(data);
          if (event.type === 'response.text') {
            // Convert text to speech using Twilio
            const twiml = this.generateTwiML(event.text);
            res.type('text/xml');
            res.send(twiml);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket closed for call ${callSid}`);
        this.activeCalls.delete(callSid);
      });

      // Initial TwiML response
      const twiml = this.generateTwiML(
        'Welcome to the Domestic Violence Support Assistant. How can I help you today?'
      );
      res.type('text/xml');
      res.send(twiml);

    } catch (error) {
      console.error('Error handling incoming call:', error);
      res.status(500).send('Error processing call');
    }
  }

  async handleCallStatus(req, res) {
    try {
      const callSid = req.body.CallSid;
      const callStatus = req.body.CallStatus;

      console.log(`Call ${callSid} status: ${callStatus}`);

      // Clean up when call ends
      if (callStatus === 'completed' || callStatus === 'failed') {
        const call = this.activeCalls.get(callSid);
        if (call) {
          call.ws.close();
          this.activeCalls.delete(callSid);
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling call status:', error);
      res.status(500).send('Error processing call status');
    }
  }

  validateTwilioRequest(req) {
    // TODO: Implement proper Twilio request validation
    // For now, just check if it's a POST request
    return req.method === 'POST';
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
} 