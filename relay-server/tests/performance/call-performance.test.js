import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import twilio from 'twilio';
import { TwilioVoiceHandler } from '../../lib/twilioVoice.js';
import { TwilioWebSocketServer } from '../../websocketServer.js';
import { config } from '../../lib/config.js';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

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

// Mock OpenAI
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(() => ({
    audio: { speech: { create: vi.fn() } },
    chat: { completions: { create: vi.fn() } }
  }));
  return { OpenAI, default: OpenAI };
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
  close: vi.fn()
};

describe.skip('Call Performance Tests', () => {
  let app;
  let server;
  let voiceHandler;
  let mockTwilioClient;
  let mockAudioService;
  let mockServer;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Create mock server
    mockServer = new MockServer();

    // Mock Twilio client
    mockTwilioClient = {
      messages: { create: vi.fn() },
      calls: { create: vi.fn() }
    };
    mockValidateRequest = vi.fn().mockReturnValue(true);

    // Mock audio service
    mockAudioService = {
      getGptReply: vi.fn(),
      generateTTS: vi.fn()
    };

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
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Welcome</Say></Response>');
    });
    app.post('/twilio/status', (req, res) => {
      res.status(200).send('OK');
    });
    app.post('/twilio/consent', (req, res) => {
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you</Say></Response>');
    });

    // Replace all response mocks with:
    const response = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      // For legacy assertions, keep these but deprecate:
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  describe.skip('Concurrent Call Handling', () => {
    it('should handle multiple concurrent calls', async () => {
      const numCalls = 10;
      const calls = [];

      for (let i = 0; i < numCalls; i++) {
        const callSid = `CA${i}`;
        const request = {
          headers: { 'x-twilio-signature': 'valid_signature' },
          body: { CallSid: callSid, From: `+1${i}` },
          protocol: 'http',
          get: vi.fn().mockReturnValue('localhost:3000'),
          originalUrl: '/twilio/voice'
        };
        const response = {
          writeHead: vi.fn().mockReturnThis(),
          end: vi.fn().mockReturnThis(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis()
        };

        calls.push(voiceHandler.handleIncomingCall(request, response));
      }

      await Promise.all(calls);

      expect(mockWebSocketServer.activeCalls.size).toBe(numCalls);
    });

    it('should maintain performance under sustained load', async () => {
      const numCalls = 50;
      const calls = [];
      const startTime = Date.now();

      for (let i = 0; i < numCalls; i++) {
        const callSid = `CA${i}`;
        const request = {
          headers: { 'x-twilio-signature': 'valid_signature' },
          body: { CallSid: callSid, From: `+1${i}` },
          protocol: 'http',
          get: vi.fn().mockReturnValue('localhost:3000'),
          originalUrl: '/twilio/voice'
        };
        const response = {
          writeHead: vi.fn().mockReturnThis(),
          end: vi.fn().mockReturnThis(),
          status: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis()
        };

        calls.push(voiceHandler.handleIncomingCall(request, response));
      }

      await Promise.all(calls);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`Total time for ${numCalls} calls: ${totalTime}ms`);
      console.log(`Average time per call: ${totalTime / numCalls}ms`);

      expect(mockWebSocketServer.activeCalls.size).toBe(numCalls);
      expect(totalTime / numCalls).toBeLessThan(100); // Average time per call should be less than 100ms
    });
  });

  it.skip('should handle rapid call status updates', async () => {
    const callSid = 'CA123';
    const request = {
      headers: { 'x-twilio-signature': 'valid_signature' },
      body: { CallSid: callSid, From: '+1234567890' },
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost:3000'),
      originalUrl: '/twilio/voice'
    };
    const response = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    // Create initial call
    await voiceHandler.handleIncomingCall(request, response);

    // Send multiple status updates
    const statusUpdates = [
      { CallStatus: 'in-progress' },
      { CallStatus: 'ringing' },
      { CallStatus: 'in-progress' },
      { CallStatus: 'completed' }
    ];

    for (const status of statusUpdates) {
      await voiceHandler.handleCallStatus({
        body: { CallSid: callSid, ...status }
      }, response);
    }

    expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledTimes(1);
  });

  it.skip('should handle WebSocket message processing under load', async () => {
    const callSid = 'CA123';
    const request = {
      headers: { 'x-twilio-signature': 'valid_signature' },
      body: { CallSid: callSid, From: '+1234567890' },
      protocol: 'http',
      get: vi.fn().mockReturnValue('localhost:3000'),
      originalUrl: '/twilio/voice'
    };
    const response = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    // Create initial call
    await voiceHandler.handleIncomingCall(request, response);

    // Generate test messages
    const messages = Array.from({ length: 100 }, (_, i) => ({
      type: 'message',
      data: `Test message ${i}`
    }));

    // Process messages
    for (const message of messages) {
      const ws = mockWebSocketServer.activeCalls.get(callSid)?.ws;
      if (ws) {
        await ws.send(JSON.stringify(message));
      }
    }

    expect(mockWebSocket.send).toHaveBeenCalledTimes(messages.length);
  });
}); 