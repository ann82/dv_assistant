import twilio from 'twilio';
import { config } from './config.js';
import { AudioService } from '../services/audioService.js';

// Standalone validation function
export const validateTwilioRequest = (req, res, next) => {
  try {
    // Log all headers for debugging
    console.log('All Headers:', req.headers);
    console.log('Raw Body:', req.body);
    
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = 'https://' + req.get('host') + req.originalUrl;
    const params = req.body || {};

    // Log request details for debugging
    console.log('Twilio Request:', {
      signature: twilioSignature,
      url,
      params,
      method: req.method,
      originalUrl: req.originalUrl,
      protocol: req.protocol,
      headers: req.headers,
      body: req.body
    });

    // For testing purposes, allow requests without signature in development
    if (process.env.NODE_ENV === 'development' && !twilioSignature) {
      console.log('Development mode: Bypassing Twilio signature validation');
      return next();
    }

    if (!twilioSignature) {
      console.log('No Twilio signature found');
      return res.status(403).send('No Twilio signature');
    }

    if (twilio.validateRequest(
      config.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      params
    )) {
      next();
    } else {
      console.log('Invalid Twilio signature');
      res.status(403).send('Invalid Twilio request');
    }
  } catch (error) {
    console.error('Error validating Twilio request:', error);
    res.status(500).send('Error validating request');
  }
};

/**
 * Handles Twilio voice and messaging interactions
 */
export class TwilioHandler {
  constructor(accountSid, authToken, phoneNumber) {
    this.client = twilio(accountSid, authToken);
    this.authToken = authToken;
    this.phoneNumber = phoneNumber;
    this.activeCalls = new Map();
    this.messageHistory = new Map();
    this.audioService = new AudioService();
    console.log('TwilioHandler initialized with account SID:', accountSid.slice(0, 3) + '...');
  }

  /**
   * Validates and handles incoming voice calls
   */
  async handleIncomingCall(req, res) {
    try {
      console.log('Received incoming call request:', {
        headers: req.headers,
        body: req.body,
        url: req.url,
        method: req.method,
        rawBody: req.rawBody
      });
      
      const { CallSid, From } = req.body;
      
      // Validate required parameters
      if (!CallSid || !From) {
        const error = 'Missing required parameters: CallSid or From';
        console.error(error);
        res.status(400).send(error);
        return;
      }
      
      console.log(`Processing call from ${From} (SID: ${CallSid})`);
      
      // Store call information
      this.activeCalls.set(CallSid, {
        from: From,
        startTime: new Date(),
        status: 'in-progress'
      });

      const twiml = new twilio.twiml.VoiceResponse();
      
      // Configure speech recognition
      const gather = twiml.gather({
        input: 'speech',
        action: '/twilio/voice/process',
        method: 'POST',
        language: 'en-US',
        speechTimeout: 'auto'
      });
      
      gather.say('Welcome to Harbor AI. How can I help you today?');

      // Fallback for no input
      twiml.say('Sorry, I didn\'t catch that. Goodbye!');
      twiml.hangup();

      const twimlResponse = twiml.toString();
      console.log('Sending TwiML response:', twimlResponse);
      
      this.sendTwiMLResponse(res, twimlResponse);
    } catch (error) {
      this.handleError(res, 'Error handling incoming call', error);
    }
  }

  /**
   * Processes speech input from voice calls
   */
  async handleCallProcessing(req, res) {
    try {
      const { CallSid, SpeechResult } = req.body;
      const twiml = new twilio.twiml.VoiceResponse();
      
      // Validate required parameters
      if (!CallSid) {
        throw new Error('Missing CallSid in request');
      }

      if (!SpeechResult) {
        console.log(`No speech detected for call ${CallSid}, requesting retry`);
        twiml.say('I didn\'t catch that. Could you please repeat?');
        twiml.redirect('/twilio/voice');
        this.sendTwiMLResponse(res, twiml.toString());
        return;
      }

      console.log(`Processing speech for call ${CallSid}:`, SpeechResult);
      
      const aiResponse = await this.processWithAI(SpeechResult);
      
      twiml.say(aiResponse);
      twiml.redirect('/twilio/voice');

      this.sendTwiMLResponse(res, twiml.toString());
    } catch (error) {
      this.handleError(res, 'Error processing call input', error);
    }
  }

  /**
   * Handles incoming SMS messages
   */
  async handleIncomingMessage(req, res) {
    try {
      const { Body, From, MessageSid } = req.body;
      
      // Validate required parameters
      if (!Body || !From || !MessageSid) {
        throw new Error('Missing required message parameters');
      }

      console.log(`Processing message from ${From}:`, Body);
      
      // Store incoming message
      this.storeMessage(From, MessageSid, Body, 'incoming');

      // Process and send response
      const aiResponse = await this.processWithAI(Body);
      
      await this.client.messages.create({
        body: aiResponse,
        from: this.phoneNumber,
        to: From
      });

      // Store outgoing message
      this.storeMessage(From, MessageSid, aiResponse, 'outgoing');

      res.status(200).send('Message processed successfully');
    } catch (error) {
      this.handleError(res, 'Error handling incoming message', error);
    }
  }

  // Helper methods
  
  /**
   * Stores a message in the history
   */
  storeMessage(from, sid, body, direction) {
    if (!this.messageHistory.has(from)) {
      this.messageHistory.set(from, []);
    }
    
    this.messageHistory.get(from).push({
      sid,
      body,
      timestamp: new Date(),
      direction
    });
  }

  /**
   * Sends a TwiML response
   */
  sendTwiMLResponse(res, twiml) {
    res.type('text/xml');
    res.send(twiml);
  }

  /**
   * Handles errors consistently
   */
  handleError(res, message, error) {
    console.error(message + ':', error);
    res.status(500).send(message);
  }

  /**
   * Processes input with AI (placeholder)
   */
  async processWithAI(input) {
    // Use AudioService to get GPT reply
    try {
      const gptReply = await this.audioService.getGptReply(input);
      return gptReply.text || gptReply;
    } catch (error) {
      console.error('Error in processWithAI:', error);
      return 'Sorry, I was unable to process your request.';
    }
  }
} 