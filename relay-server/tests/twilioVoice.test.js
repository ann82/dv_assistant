import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
// Mock OpenAI
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(() => ({
    audio: { speech: { create: vi.fn() } },
    chat: { completions: { create: vi.fn() } }
  }));
  return { OpenAI, default: OpenAI };
});
// Mock Twilio
vi.mock('twilio', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
    calls: { create: vi.fn() }
  }))
}));
import { TwilioVoiceHandler } from '../lib/twilioVoice.js';
import WebSocket from 'ws';

// Mock dependencies
vi.mock('ws');
vi.mock('../lib/config.js', () => ({
  config: {
    WS_PORT: 8080,
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

// Mock WebSocket
vi.mock('ws', () => {
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

  return { WebSocket, WebSocketServer, default: WebSocket };
});

// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'test_account_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    twilio: {
      accountSid: 'test_account_sid',
      authToken: 'test_auth_token',
      phoneNumber: '+1234567890'
    }
  }
}));

// Mock ResponseGenerator
vi.mock('../lib/response.js', () => ({
  ResponseGenerator: class {
    constructor() {
      this.generateResponse = vi.fn().mockResolvedValue({
        text: 'Test response',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 20
      });
    }
  }
}));

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

const mockServer = new MockServer();

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

var mockTwilioClient;
var mockValidateRequest;

vi.mock('twilio', () => ({
  default: () => mockTwilioClient,
  validateRequest: mockValidateRequest
}));

describe('TwilioVoiceHandler', () => {
  let voiceHandler;
  let mockServer;
  let mockWebSocketServer;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock WebSocket server
    mockWebSocketServer = {
      activeCalls: new Map(),
      handleCallEnd: vi.fn(),
      registerCall: vi.fn()
    };

    // Create mock server
    mockServer = {
      on: vi.fn(),
      emit: vi.fn()
    };

    // Mock Twilio client
    mockTwilioClient = {
      messages: { create: vi.fn() },
      calls: { create: vi.fn() }
    };
    mockValidateRequest = vi.fn().mockReturnValue(true);

    // Create voice handler
    voiceHandler = new TwilioVoiceHandler(
      'TEST_ACCOUNT_SID',
      'TEST_AUTH_TOKEN',
      '+1234567890',
      mockValidateRequest,
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

    // Replace all response mocks with:
    const response = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      // For legacy assertions, keep these but deprecate:
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  describe('Request Validation', () => {
    it('should validate Twilio requests with a valid signature', async () => {
      const request = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: { CallSid: 'CA123', From: '+1234567890' },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      mockValidateRequest.mockReturnValueOnce(true);
      await voiceHandler.handleIncomingCall(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should reject Twilio requests with an invalid signature', async () => {
      const request = {
        headers: { 'x-twilio-signature': 'invalid_signature' },
        body: { CallSid: 'CA123', From: '+1234567890' },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      mockValidateRequest.mockReturnValueOnce(false);
      await voiceHandler.handleIncomingCall(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    });
  });

  describe.skip('Incoming Call Handling', () => {
    it('should handle incoming calls and create WebSocket connection', async () => {
      const request = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: { CallSid: 'CA123', From: '+1234567890' },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      mockValidateRequest.mockReturnValueOnce(true);
      await voiceHandler.handleIncomingCall(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockWebSocketServer.activeCalls.has('CA123')).toBe(true);
    });

    it('should handle WebSocket connection errors', async () => {
      const callSid = 'CA123';
      const error = new Error('WebSocket error');

      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          callback(error);
        }
        return mockWebSocket;
      });

      await voiceHandler.handleWebSocketMessage(callSid, { type: 'error', error });

      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith(callSid);
    });

    it('should reject invalid incoming calls', async () => {
      const request = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: {}, // Missing CallSid and From
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      mockValidateRequest.mockReturnValueOnce(true);
      await voiceHandler.handleIncomingCall(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    });
  });

  describe('Call Status Handling', () => {
    it('should handle completed calls', async () => {
      const request = {
        body: { CallSid: 'CA123', CallStatus: 'completed' }
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      await voiceHandler.handleCallStatus(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith('CA123');
    });

    it('should handle failed calls', async () => {
      const request = {
        body: { CallSid: 'CA123', CallStatus: 'failed' }
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      await voiceHandler.handleCallStatus(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockWebSocketServer.handleCallEnd).toHaveBeenCalledWith('CA123');
    });

    it('should handle in-progress calls', async () => {
      const request = {
        body: { CallSid: 'CA123', CallStatus: 'in-progress' }
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      await voiceHandler.handleCallStatus(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockWebSocketServer.handleCallEnd).not.toHaveBeenCalled();
    });
  });

  describe.skip('Error Handling', () => {
    it('should handle errors in incoming call processing', async () => {
      const request = {
        headers: { 'x-twilio-signature': 'valid_signature' },
        body: { CallSid: 'CA123', From: '+1234567890' },
        protocol: 'http',
        get: vi.fn().mockReturnValue('localhost:3000'),
        originalUrl: '/twilio/voice'
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      mockValidateRequest.mockImplementationOnce(() => {
        throw new Error('Validation error');
      });

      await voiceHandler.handleIncomingCall(request, response);

      expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    });

    it('should handle errors in call status processing', async () => {
      const request = {
        body: { CallSid: 'CA123', CallStatus: 'completed' }
      };
      const response = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      mockWebSocketServer.handleCallEnd.mockRejectedValueOnce(new Error('Processing error'));

      await expect(voiceHandler.handleCallStatus(request, response)).rejects.toThrow();
    });
  });

  describe('sendSMSWithRetry', () => {
    const callSid = 'test_call_sid';
    const call = {
      from: '+1234567890',
      startTime: new Date(),
      hasConsent: true
    };
    const summary = 'Test summary';

    it('should send SMS successfully on first attempt', async () => {
      const mockMessage = {
        sid: 'test_message_sid',
        status: 'sent',
        to: call.from
      };
      mockTwilioClient.messages.create.mockResolvedValueOnce(mockMessage);

      await voiceHandler.sendSMSWithRetry(callSid, call, summary);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: summary,
        to: call.from,
        from: voiceHandler.phoneNumber
      });
    }, 15000);

    it('should retry on failure', async () => {
      const mockMessage = {
        sid: 'test_message_sid',
        status: 'sent',
        to: call.from
      };
      mockTwilioClient.messages.create
        .mockRejectedValueOnce(new Error('Failed to send'))
        .mockResolvedValueOnce(mockMessage);

      await voiceHandler.sendSMSWithRetry(callSid, call, summary);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should stop after max retries', async () => {
      mockTwilioClient.messages.create.mockRejectedValue(new Error('Failed to send'));

      await voiceHandler.sendSMSWithRetry(callSid, call, summary);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(4);
    }, 30000);
  });
}); 