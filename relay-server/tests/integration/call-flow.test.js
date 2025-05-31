import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import { TwilioVoiceHandler } from '../../lib/twilioVoice.js';
import { TwilioWebSocketServer } from '../../websocketServer.js';
import WebSocket from 'ws';

var mockTwilioClient;
var mockValidateRequest;

vi.mock('twilio', () => {
  return {
    default: vi.fn().mockReturnValue(mockTwilioClient),
    validateRequest: mockValidateRequest
  };
});

vi.mock('../../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'TEST_ACCOUNT_SID',
    TWILIO_AUTH_TOKEN: 'TEST_AUTH_TOKEN',
    TWILIO_PHONE_NUMBER: '+1234567890',
    twilio: {
      accountSid: 'TEST_ACCOUNT_SID',
      authToken: 'TEST_AUTH_TOKEN',
      phoneNumber: '+1234567890'
    },
    WS_PORT: 8080,
    OPENAI_API_KEY: 'test_api_key'
  }
}));

vi.mock('ws', async (importOriginal) => {
  const actual = await importOriginal();
  const WebSocket = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn()
  }));

  const WebSocketServer = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    handleUpgrade: vi.fn()
  }));

  return {
    ...actual,
    WebSocket,
    WebSocketServer,
    default: WebSocket
  };
});

// Create mock server
class MockServer extends EventEmitter {
  constructor() {
    super();
    this.on = vi.fn().mockImplementation((event, callback) => {
      super.on(event, callback);
      return this;
    });
    this.emit = vi.fn().mockImplementation((event, ...args) => {
      super.emit(event, ...args);
      return this;
    });
  }
}

// Mock WebSocket server
const mockWebSocketServer = {
  on: vi.fn(),
  emit: vi.fn(),
  handleUpgrade: vi.fn(),
  activeCalls: new Map(),
  handleCallEnd: vi.fn(),
  registerCall: vi.fn((callSid, callData) => {
    mockWebSocketServer.activeCalls.set(callSid, callData);
  })
};

// Mock WebSocket
const mockWebSocket = {
  on: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1 // OPEN
};

describe.skip('Call Flow Integration Tests', () => {
  let app;
  let voiceHandler;
  let mockServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketServer.activeCalls.clear();

    mockTwilioClient = {
      messages: { create: vi.fn() },
      calls: { create: vi.fn() }
    };
    mockValidateRequest = vi.fn().mockReturnValue(true);

    // Create Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Create mock server
    mockServer = new MockServer();

    // Create voice handler
    voiceHandler = new TwilioVoiceHandler(
      'TEST_ACCOUNT_SID',
      'TEST_AUTH_TOKEN',
      '+1234567890',
      vi.fn().mockReturnValue(true),
      WebSocket,
      mockServer
    );

    // Set WebSocket server
    voiceHandler.wsServer = mockWebSocketServer;

    // Mock WebSocket connection success
    mockWebSocket.on.mockImplementation((event, callback) => {
      if (event === 'open') {
        callback();
      }
      return mockWebSocket;
    });

    // Mock WebSocket server upgrade
    mockServer.on.mockImplementation((event, callback) => {
      if (event === 'upgrade') {
        callback({ url: '/twilio-stream' }, {}, {});
      }
      return mockServer;
    });

    // Add handleWebSocketMessage method for tests
    voiceHandler.handleWebSocketMessage = vi.fn().mockImplementation(async (callSid, message) => {
      const call = mockWebSocketServer.activeCalls.get(callSid);
      if (call && call.ws) {
        await call.ws.send(JSON.stringify(message));
      }
    });

    // Patch createWebSocketConnection to register in activeCalls
    voiceHandler.createWebSocketConnection = vi.fn().mockImplementation(async (callSid, from) => {
      const ws = mockWebSocket;
      mockWebSocketServer.activeCalls.set(callSid, { ws, from, startTime: new Date() });
      return ws;
    });

    // Setup routes
    app.post('/twilio/voice', (req, res) => {
      res.writeHead(200, expect.any(Object)).end('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Welcome</Say></Response>');
    });
    app.post('/twilio/status', (req, res) => {
      res.writeHead(200, expect.any(Object)).end('OK');
    });
    app.post('/twilio/consent', (req, res) => {
      res.writeHead(200, expect.any(Object)).end('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you</Say></Response>');
    });
  });

  describe.skip('Complete Call Flow', () => {
    it('should handle complete call flow with consent', async () => {
      const callSid = 'test_call_sid';
      const from = '+1234567890';

      // Initial call
      const callRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: { CallSid: callSid, From: from },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const callResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleIncomingCall(callRequest, callResponse);
      expect(callResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Consent response
      const consentRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: {
          CallSid: callSid,
          SpeechResult: 'yes',
          From: from
        },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/consent'
      };
      const consentResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleConsent(consentRequest, consentResponse);
      expect(consentResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Call status update
      const statusRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: {
          CallSid: callSid,
          CallStatus: 'completed'
        },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/status'
      };
      const statusResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleCallStatus(statusRequest, statusResponse);
      expect(statusResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(statusResponse.end).toHaveBeenCalledWith(expect.any(Object));
      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith(callSid);
    });

    it('should handle complete call flow without consent', async () => {
      const callSid = 'test_call_sid';
      const from = '+1234567890';

      // Initial call
      const callRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: { CallSid: callSid, From: from },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const callResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleIncomingCall(callRequest, callResponse);
      expect(callResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Consent response
      const consentRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: {
          CallSid: callSid,
          SpeechResult: 'no',
          From: from
        },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/consent'
      };
      const consentResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleConsent(consentRequest, consentResponse);
      expect(consentResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Call status update
      const statusRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: {
          CallSid: callSid,
          CallStatus: 'completed'
        },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/status'
      };
      const statusResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleCallStatus(statusRequest, statusResponse);
      expect(statusResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(statusResponse.end).toHaveBeenCalledWith(expect.any(Object));
      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith(callSid);
    });

    it('should handle call failure gracefully', async () => {
      const callSid = 'test_call_sid';
      const from = '+1234567890';

      // Initial call
      const callRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: { CallSid: callSid, From: from },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const callResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleIncomingCall(callRequest, callResponse);
      expect(callResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      // Call status update (failed)
      const statusRequest = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: {
          CallSid: callSid,
          CallStatus: 'failed'
        },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/status'
      };
      const statusResponse = {
        writeHead: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
      };

      await voiceHandler.handleCallStatus(statusRequest, statusResponse);
      expect(statusResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(statusResponse.end).toHaveBeenCalledWith(expect.any(Object));
      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith(callSid);
    });
  });
}); 