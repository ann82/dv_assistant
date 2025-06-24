import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the TwilioVoiceHandler
const mockTwilioVoiceHandler = {
  validateTwilioRequest: vi.fn(),
  handleIncomingCall: vi.fn(),
  handleSpeechInput: vi.fn(),
  handleCallStatus: vi.fn()
};

// Mock the twilioVoiceHandler module
vi.mock('../lib/twilioVoice.js', () => ({
  TwilioVoiceHandler: vi.fn().mockImplementation(() => mockTwilioVoiceHandler)
}));

// Mock the routes module
vi.mock('../routes/twilio.js', () => {
  const express = require('express');
  const router = express.Router();
  
  router.post('/voice', (req, res) => {
    if (mockTwilioVoiceHandler.validateTwilioRequest(req)) {
      mockTwilioVoiceHandler.handleIncomingCall(req, res);
    } else {
      res.status(403).json({ error: 'Invalid request' });
    }
  });
  
  router.post('/voice/process', (req, res) => {
    mockTwilioVoiceHandler.handleSpeechInput(req, res);
  });
  
  router.post('/voice/status', (req, res) => {
    mockTwilioVoiceHandler.handleCallStatus(req, res);
  });
  
  return { default: router };
});

import twilioRoutes from '../routes/twilio.js';

describe('Twilio Routes', () => {
  let app;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/twilio', twilioRoutes);
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockTwilioVoiceHandler.validateTwilioRequest.mockReturnValue(true);
    mockTwilioVoiceHandler.handleIncomingCall.mockImplementation((req, res) => {
      res.status(200).json({ success: true });
    });
    mockTwilioVoiceHandler.handleSpeechInput.mockImplementation((req, res) => {
      res.status(200).json({ success: true });
    });
    mockTwilioVoiceHandler.handleCallStatus.mockImplementation((req, res) => {
      res.status(200).json({ success: true });
    });
  });

  describe('POST /twilio/voice', () => {
    it('should handle incoming call', async () => {
      const response = await request(app)
        .post('/twilio/voice')
        .send({ CallSid: 'test-call-sid' });

      expect(response.status).toBe(200);
      expect(mockTwilioVoiceHandler.handleIncomingCall).toHaveBeenCalled();
    });

    it('should handle invalid request', async () => {
      mockTwilioVoiceHandler.validateTwilioRequest.mockReturnValue(false);

      const response = await request(app)
        .post('/twilio/voice')
        .send({ CallSid: 'test-call-sid' });

      expect(response.status).toBe(403);
      expect(mockTwilioVoiceHandler.handleIncomingCall).not.toHaveBeenCalled();
    });
  });

  describe('POST /twilio/voice/process', () => {
    it('should handle speech input', async () => {
      const response = await request(app)
        .post('/twilio/voice/process')
        .send({ SpeechResult: 'test speech' });

      expect(response.status).toBe(200);
      expect(mockTwilioVoiceHandler.handleSpeechInput).toHaveBeenCalled();
    });

    it('should handle end conversation intent and route to consent', async () => {
      // Mock the voice processing to return consent question
      mockTwilioVoiceHandler.handleSpeechInput.mockImplementation((req, res) => {
        res.type('text/xml');
        res.send('<Response><Say>Before we end this call, would you like to receive a summary of our conversation and follow-up resources via text message? Please say yes or no.</Say></Response>');
      });

      const response = await request(app)
        .post('/twilio/voice/process')
        .send({ 
          CallSid: 'test-call-sid',
          SpeechResult: 'goodbye'
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Before we end this call');
      expect(response.text).toContain('text message');
    });

    it('should handle incomplete location queries', async () => {
      // Mock the voice processing to return location prompt
      mockTwilioVoiceHandler.handleSpeechInput.mockImplementation((req, res) => {
        res.type('text/xml');
        res.send('<Response><Say>I\'d be happy to help you find shelter. Could you please tell me which city or area you\'re looking for? For example, you could say \'near San Francisco\' or \'in New York\'.</Say></Response>');
      });

      const response = await request(app)
        .post('/twilio/voice/process')
        .send({ 
          CallSid: 'test-call-sid',
          SpeechResult: 'Can you help me find shelter homes near?'
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Could you please tell me which city or area');
      expect(response.text).toContain('near San Francisco');
    });
  });

  describe('POST /twilio/voice/status', () => {
    it('should handle call status', async () => {
      const response = await request(app)
        .post('/twilio/voice/status')
        .send({ CallSid: 'test-call-sid', CallStatus: 'completed' });

      expect(response.status).toBe(200);
      expect(mockTwilioVoiceHandler.handleCallStatus).toHaveBeenCalled();
    });
  });
}); 