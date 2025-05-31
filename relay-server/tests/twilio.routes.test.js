import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import twilio from 'twilio';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock OpenAI
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(() => ({
    audio: { speech: { create: vi.fn() } },
    chat: { completions: { create: vi.fn() } }
  }));
  return { OpenAI, default: OpenAI };
});

// Mock dependencies
vi.mock('twilio');
vi.mock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'test_account_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    twilio: {
      accountSid: 'test_account_sid',
      authToken: 'test_auth_token',
      phoneNumber: '+1234567890'
    }
  }
}));

// Mock WebSocket server
let mockWebSocketServer;
const mockServer = {
  on: vi.fn((event, callback) => {
    if (event === 'upgrade') {
      // Store the callback for later use
      mockServer.upgradeCallback = callback;
    }
    return mockServer;
  }),
  emit: vi.fn(),
  listeners: vi.fn().mockReturnValue([]),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  once: vi.fn(),
  addListener: vi.fn(),
  upgradeCallback: null
};

// Mock Twilio client
const mockTwilioClient = {
  messages: {
    create: vi.fn().mockResolvedValue({ sid: 'test_message_sid', status: 'sent' })
  },
  calls: vi.fn().mockReturnValue({
    fetch: vi.fn()
  })
};

// Mock the twilio module
vi.mock('twilio', () => ({
  default: () => mockTwilioClient
}));

// Mock validateTwilioRequest to always call next()
vi.mock('../lib/twilio.js', () => ({
  validateTwilioRequest: (req, res, next) => next()
}));

describe('Twilio Routes', () => {
  let app;
  let router;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    // Initialize mockWebSocketServer before using it
    mockWebSocketServer = {
      activeCalls: new Map(),
      registerCall: vi.fn(),
      handleCallEnd: vi.fn()
    };
    mockWebSocketServer.activeCalls.clear();

    // Mock global WebSocket server
    global.wss = mockWebSocketServer;
  });

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    router = (await import('../src/routes/twilio.js')).default;
    app.use('/twilio', router);
  });

  describe('POST /twilio/consent', () => {
    const validConsentRequest = {
      CallSid: 'test_call_sid',
      From: '+1234567890',
      SpeechResult: 'yes'
    };

    it('should handle valid consent request', async () => {
      const response = await request(app)
        .post('/twilio/consent')
        .send(validConsentRequest);

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain('Thank you. You will receive a summary and resources after the call.');
    });

    it('should handle opt-out response', async () => {
      const response = await request(app)
        .post('/twilio/consent')
        .send({
          ...validConsentRequest,
          SpeechResult: 'no'
        });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain('Understood. You will not receive any follow-up messages.');
    });

    it('should handle unclear response', async () => {
      const response = await request(app)
        .post('/twilio/consent')
        .send({
          ...validConsentRequest,
          SpeechResult: 'maybe'
        });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain('I didn\'t quite understand');
    });

    it('should validate required parameters', async () => {
      const response = await request(app)
        .post('/twilio/consent')
        .send({});

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing required parameters');
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/twilio/consent')
        .send({
          ...validConsentRequest,
          From: 'invalid-phone'
        });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid phone number format');
    });

    it('should validate speech result length', async () => {
      const response = await request(app)
        .post('/twilio/consent')
        .send({
          ...validConsentRequest,
          SpeechResult: 'a'.repeat(1001)
        });

      expect(response.status).toBe(400);
      expect(response.text).toBe('Invalid speech result');
    });
  });

  describe('POST /twilio/status', () => {
    const validStatusRequest = {
      CallSid: 'test_call_sid',
      CallStatus: 'completed'
    };

    beforeEach(() => {
      mockWebSocketServer.activeCalls.set('test_call_sid', {
        from: '+1234567890',
        startTime: new Date(),
        hasConsent: true
      });
      mockTwilioClient.messages.create.mockReset().mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent'
      });
    });

    it('should handle completed call status', async () => {
      mockWebSocketServer.handleCallEnd.mockResolvedValue('Test summary');

      const response = await request(app)
        .post('/twilio/status')
        .send(validStatusRequest);

      expect(response.status).toBe(200);
      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith('test_call_sid');
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        to: '+1234567890',
        from: '+1234567890',
        body: 'Call Summary:\n\nTest summary'
      });
    });

    it('should not send SMS if consent not given', async () => {
      mockWebSocketServer.activeCalls.set('test_call_sid', {
        from: '+1234567890',
        startTime: new Date(),
        hasConsent: false
      });

      const response = await request(app)
        .post('/twilio/status')
        .send(validStatusRequest);

      expect(response.status).toBe(200);
      expect(mockTwilioClient.messages.create).not.toHaveBeenCalled();
    });

    it('should handle missing parameters', async () => {
      const response = await request(app)
        .post('/twilio/status')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /twilio/sms', () => {
    const validSmsRequest = {
      From: '+1234567890',
      Body: 'yes'
    };

    it('should handle consent message', async () => {
      const response = await request(app)
        .post('/twilio/sms')
        .send(validSmsRequest);

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain('Thank you for your consent');
    });

    it('should handle opt-out message', async () => {
      const response = await request(app)
        .post('/twilio/sms')
        .send({
          ...validSmsRequest,
          Body: 'stop'
        });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain('unsubscribed');
    });

    it('should handle unclear message', async () => {
      const response = await request(app)
        .post('/twilio/sms')
        .send({
          ...validSmsRequest,
          Body: 'maybe'
        });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/xml');
      expect(response.text).toContain('Would you like to receive follow-up messages');
    });
  });
}); 