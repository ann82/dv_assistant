import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock WebSocket
vi.mock('ws', () => {
  const WebSocketMock = vi.fn().mockImplementation(() => {
    const handlers = {};
    const ws = {
      on: vi.fn((event, callback) => {
        handlers[event] = callback;
        return ws;
      }),
      send: vi.fn(),
      close: vi.fn(),
      // Helper methods for testing
      _trigger: (event, data) => {
        if (handlers[event]) {
          handlers[event](data);
        }
      },
      _getHandlers: () => handlers
    };
    return ws;
  });
  return { WebSocket: WebSocketMock };
});

// Patch config.WS_PORT for test predictability
import * as configModule from '../relay-server/lib/config.js';
configModule.config.WS_PORT = 8081;

console.log('[TEST] About to reset modules and import TwilioVoiceHandler');
vi.resetModules();

// Import after mocks so they use the mocked modules
import { TwilioVoiceHandler } from '../relay-server/lib/twilioVoice.js';
import { WebSocket } from 'ws';

describe('TwilioVoiceHandler', () => {
  let handler;
  let mockReq;
  let mockRes;
  let mockValidateRequest;
  let mockWsInstance;
  let mockWebSocketConstructor;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create mock validateRequest function
    mockValidateRequest = vi.fn((authToken, signature, url, params) => {
      // eslint-disable-next-line no-console
      console.log('[MOCK] validateRequest called with:', { authToken, signature, url, params });
      return signature === 'valid-signature';
    });
    
    // Create a mock WebSocket constructor
    mockWsInstance = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      _getHandlers: () => ({})
    };
    mockWebSocketConstructor = vi.fn(() => mockWsInstance);
    
    handler = new TwilioVoiceHandler('TEST_ACCOUNT_SID', 'token', '+1234567890', mockValidateRequest, mockWebSocketConstructor);
    mockReq = {
      headers: { 'x-twilio-signature': 'valid-signature' },
      protocol: 'https',
      get: (h) => (h === 'host' ? 'localhost:3000' : ''),
      originalUrl: '/twilio/voice',
      body: { 
        CallSid: 'CA123',
        From: '+1987654321',
        CallStatus: 'in-progress'
      }
    };
    mockRes = {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      // For legacy assertions, keep these but deprecate:
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis()
    };
  });

  describe('Request Validation', () => {
    it('should validate Twilio requests with a valid signature', () => {
      const result = handler.validateTwilioRequest(mockReq);
      expect(result).toBe(true);
      expect(mockValidateRequest).toHaveBeenCalledWith(
        'token',
        'valid-signature',
        'https://localhost:3000/twilio/voice',
        mockReq.body
      );
    });

    it('should reject Twilio requests with an invalid signature', () => {
      mockReq.headers['x-twilio-signature'] = 'invalid-signature';
      expect(handler.validateTwilioRequest(mockReq)).toBe(false);
    });

    it('should reject Twilio requests with no signature', () => {
      delete mockReq.headers['x-twilio-signature'];
      expect(handler.validateTwilioRequest(mockReq)).toBe(false);
    });
  });

  describe.skip('Incoming Call Handling', () => {
    it('should handle incoming calls and create WebSocket connection', async () => {
      mockValidateRequest.mockReturnValue(true);
      mockReq.headers['x-twilio-signature'] = 'valid-signature';
      await handler.handleIncomingCall(mockReq, mockRes);
      expect(mockWebSocketConstructor).toHaveBeenCalledWith('ws://localhost:8081?type=phone');
      expect(mockWsInstance.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWsInstance.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWsInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWsInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
      expect(mockRes.send.mock.calls[0][0]).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(mockRes.send.mock.calls[0][0]).toContain('<Response>');
    });

    it('should handle WebSocket messages correctly', async () => {
      mockValidateRequest.mockReturnValue(true);
      mockReq.headers['x-twilio-signature'] = 'valid-signature';
      await handler.handleIncomingCall(mockReq, mockRes);
      const messageCall = mockWsInstance.on.mock.calls.find(call => call[0] === 'message');
      expect(messageCall).toBeDefined();
      const messageHandler = messageCall[1];
      expect(typeof messageHandler).toBe('function');
      const messageData = JSON.stringify({
        type: 'response.text',
        text: 'Test response'
      });
      messageHandler(messageData);
      expect(mockRes.send).toHaveBeenCalled();
      const lastCall = mockRes.send.mock.calls[mockRes.send.mock.calls.length - 1][0];
      expect(lastCall).toContain('Test response');
    });

    it('should handle WebSocket connection errors', async () => {
      mockValidateRequest.mockReturnValue(true);
      mockReq.headers['x-twilio-signature'] = 'valid-signature';
      await handler.handleIncomingCall(mockReq, mockRes);
      const errorCall = mockWsInstance.on.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();
      const errorHandler = errorCall[1];
      expect(typeof errorHandler).toBe('function');
      errorHandler(new Error('WebSocket error'));
      expect(mockRes.status).not.toHaveBeenCalledWith(500);
    });

    it('should reject invalid incoming calls', async () => {
      mockReq.headers['x-twilio-signature'] = 'invalid-signature';
      await handler.handleIncomingCall(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid Twilio request');
    });
  });

  describe.skip('Call Status Handling', () => {
    it('should handle completed calls', async () => {
      mockReq.body.CallStatus = 'completed';
      await handler.handleCallStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
    });

    it('should handle failed calls', async () => {
      mockReq.body.CallStatus = 'failed';
      await handler.handleCallStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
    });

    it('should handle in-progress calls', async () => {
      mockReq.body.CallStatus = 'in-progress';
      await handler.handleCallStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('OK');
    });
  });

  describe.skip('Error Handling', () => {
    it('should handle errors in incoming call processing', async () => {
      mockReq.body = null; // This will cause an error after validation
      mockReq.headers['x-twilio-signature'] = 'invalid-signature'; // Make validation fail
      await handler.handleIncomingCall(mockReq, mockRes);
      // Since validation fails, expect 403
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith('Invalid Twilio request');
    });

    it('should handle errors in call status processing', async () => {
      mockReq.body = null; // This will cause an error
      await handler.handleCallStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith('Error processing call status');
    });
  });

  describe('TwiML Generation', () => {
    it('should generate valid TwiML with proper XML escaping', () => {
      const text = 'Hello & World <test>';
      const twiml = handler.generateTwiML(text);
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('&amp;');
      expect(twiml).toContain('&lt;');
      expect(twiml).toContain('&gt;');
    });

    it('should include Gather verb with speech input', () => {
      const twiml = handler.generateTwiML('test');
      expect(twiml).toContain('<Gather');
      expect(twiml).toContain('input="speech"');
      expect(twiml).toContain('speechTimeout="auto"');
      expect(twiml).toContain('speechModel="phone_call"');
    });
  });
}); 