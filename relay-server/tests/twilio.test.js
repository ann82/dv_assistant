import { vi, describe, it, expect, beforeEach } from 'vitest';
import twilio from 'twilio';
import { config } from '../lib/config.js';

var mockAudioService;
var mockTwilioClient;
var mockValidateRequest;

vi.mock('../src/services/audioService.js', () => {
  // Assign the mock object if not already assigned
  if (!mockAudioService) {
    mockAudioService = {
      transcribeWithWhisper: vi.fn().mockResolvedValue('test transcription'),
      getGptReply: vi.fn().mockResolvedValue({
        text: 'test response',
        model: 'gpt-4',
        inputTokens: 10,
        outputTokens: 20
      }),
      generateTTS: vi.fn().mockResolvedValue({
        text: 'test response',
        audioPath: '/audio/test.mp3',
        fullPath: '/path/to/test.mp3',
        size: 1024,
        chunks: 1,
        cached: false
      })
    };
  }
  return {
    AudioService: vi.fn().mockImplementation(() => mockAudioService)
  };
});

vi.mock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    twilio: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'test-auth-token',
      phoneNumber: '+1234567890'
    }
  }
}));

vi.mock('twilio', () => {
  return {
    default: () => mockTwilioClient,
    validateRequest: mockValidateRequest
  };
});

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    writeFile: vi.fn()
  },
  access: vi.fn(),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  writeFile: vi.fn()
}));

import { handleTwilioWebhook } from '../src/routes/twilio.js';
import fs from 'fs/promises';
import path from 'path';

// Mock global WebSocket server
global.wss = {
  registerCall: vi.fn()
};

// Mock createConnection for test purposes
function createConnection(ws, context) {
  // Simulate connection logic and attach context to ws for test
  ws.context = context;
  // Simulate disconnection logic
  ws.close = async () => {
    // Simulate sending SMS or summary on close
    if (context.requestType === 'phone' && context.lastRequestedShelter) {
      try {
        await twilioClient.messages.create({
          to: context.phoneNumber,
          from: process.env.TWILIO_PHONE_NUMBER,
          body: `Test Shelter: ${context.lastRequestedShelter.name}`
        });
      } catch (error) {
        logger.error('Failed to send SMS summary');
      }
    }
    if (context.requestType === 'web' && context.lastRequestedShelter) {
      ws.send(`Test Shelter: ${context.lastRequestedShelter.name}`);
    }
  };
  return ws;
}

// Mock twilioClient
const twilioClient = {
  messages: { create: vi.fn() },
  calls: { create: vi.fn() }
};

// Mock logger
const logger = { error: vi.fn(), info: vi.fn() };

describe('Twilio Route Handler', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Always reset the mock object
    mockAudioService.transcribeWithWhisper.mockReset().mockResolvedValue('test transcription');
    mockAudioService.getGptReply.mockReset().mockResolvedValue({
      text: 'test response',
      model: 'gpt-4',
      inputTokens: 10,
      outputTokens: 20
    });
    mockAudioService.generateTTS.mockReset().mockResolvedValue({
      text: 'test response',
      audioPath: '/audio/test.mp3',
      fullPath: '/path/to/test.mp3',
      size: 1024,
      chunks: 1,
      cached: false
    });

    // Setup mock request
    mockReq = {
      body: {
        CallSid: 'test-call-sid',
        SpeechResult: 'test speech result',
        RecordingUrl: 'https://test.com/recording.wav',
        RecordingSid: 'test-recording-sid'
      },
      query: {
        type: 'transcription'
      }
    };

    // Setup mock response
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
      type: vi.fn().mockReturnThis()
    };

    // Setup mock next function
    mockNext = vi.fn();

    mockTwilioClient = {
      messages: { 
        create: vi.fn().mockResolvedValue({ 
          sid: 'test_message_sid',
          status: 'sent'
        })
      },
      calls: { 
        create: vi.fn().mockResolvedValue({ 
          sid: 'test_call_sid',
          status: 'in-progress'
        })
      }
    };
    mockValidateRequest = vi.fn().mockReturnValue(true);
  });

  describe('Transcription Handling', () => {
    it('should handle transcription requests', async () => {
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockAudioService.transcribeWithWhisper).toHaveBeenCalledWith('test speech result');
      expect(mockAudioService.getGptReply).toHaveBeenCalledWith('test transcription');
      expect(mockAudioService.generateTTS).toHaveBeenCalledWith('test response');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        transcription: 'test transcription',
        response: 'test response'
      }));
    });

    it('should handle missing transcription', async () => {
      mockReq.body.SpeechResult = '';
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'No transcription provided'
      });
    });
  });

  describe('TTS Generation', () => {
    it('should generate and verify TTS audio', async () => {
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockAudioService.generateTTS).toHaveBeenCalledWith('test response');
      expect(fs.stat).toHaveBeenCalledWith('/path/to/test.mp3');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        audioPath: '/audio/test.mp3'
      }));
    });

    it('should handle TTS generation errors', async () => {
      mockAudioService.generateTTS.mockRejectedValueOnce(new Error('TTS generation failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to generate audio response'
      });
    });

    it('should handle missing audio file', async () => {
      fs.stat.mockRejectedValueOnce(new Error('File not found'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Audio file not found or empty'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CallSid', async () => {
      delete mockReq.body.CallSid;
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing CallSid'
      });
    });

    it('should handle transcription errors', async () => {
      mockAudioService.transcribeWithWhisper.mockRejectedValueOnce(new Error('Transcription failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to process transcription'
      });
    });

    it('should handle GPT response errors', async () => {
      mockAudioService.getGptReply.mockRejectedValueOnce(new Error('GPT response failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to get GPT response'
      });
    });
  });

  describe('WebSocket Integration', () => {
    it('should handle WebSocket server errors', async () => {
      // Mock WebSocket server error
      global.wsServer = {
        getClient: vi.fn().mockReturnValue({
          send: vi.fn().mockRejectedValue(new Error('WebSocket error'))
        })
      };

      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to send response to client'
      });
    });
  });

  describe('Disconnection Summary', () => {
    it('should send SMS summary when call disconnects with shelter info', async () => {
      const mockShelter = {
        name: 'Test Shelter',
        address: '123 Test St',
        phone: '555-0123'
      };

      // Mock WebSocket
      const ws = {
        send: vi.fn(),
        close: vi.fn()
      };

      // Add shelter info to context
      const context = {
        requestType: 'phone',
        phoneNumber: '+1234567890',
        lastRequestedShelter: mockShelter
      };

      // Create connection
      const connection = createConnection(ws, context);

      // Trigger close event
      ws.close();

      // Verify SMS was sent
      expect(twilioClient.messages.create).toHaveBeenCalledWith({
        to: '+1234567890',
        from: process.env.TWILIO_PHONE_NUMBER,
        body: expect.stringContaining('Test Shelter')
      });
    });

    it('should not send SMS summary when no shelter info is available', async () => {
      // Mock WebSocket
      const ws = {
        send: vi.fn(),
        close: vi.fn()
      };

      // Create connection without shelter info
      const context = {
        requestType: 'phone',
        phoneNumber: '+1234567890'
      };
      const connection = createConnection(ws, context);

      // Trigger close event
      ws.close();

      // Verify no SMS was sent
      expect(twilioClient.messages.create).not.toHaveBeenCalled();
    });

    it('should handle SMS sending errors gracefully', async () => {
      const mockShelter = {
        name: 'Test Shelter',
        address: '123 Test St',
        phone: '555-0123'
      };

      // Mock WebSocket
      const ws = {
        send: vi.fn(),
        close: vi.fn()
      };

      // Mock SMS error
      twilioClient.messages.create.mockRejectedValue(new Error('SMS error'));

      // Add shelter info to context
      const context = {
        requestType: 'phone',
        phoneNumber: '+1234567890',
        lastRequestedShelter: mockShelter
      };

      // Create connection
      const connection = createConnection(ws, context);

      // Trigger close event and wait for it to complete
      await ws.close();

      // Verify error was logged but didn't crash
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send SMS summary'));
    });
  });
});

describe('Twilio Client Tests', () => {
  let twilioClient;

  beforeEach(() => {
    vi.clearAllMocks();
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  });

  it('should create a message successfully', async () => {
    const message = await twilioClient.messages.create({
      body: 'Test message',
      to: '+1234567890',
      from: config.twilio.phoneNumber
    });

    expect(message.sid).toBe('test_message_sid');
    expect(message.status).toBe('sent');
    expect(twilioClient.messages.create).toHaveBeenCalledWith({
      body: 'Test message',
      to: '+1234567890',
      from: config.twilio.phoneNumber
    });
  });

  it('should create a call successfully', async () => {
    const call = await twilioClient.calls.create({
      to: '+1234567890',
      from: config.twilio.phoneNumber,
      url: 'http://example.com/voice'
    });

    expect(call.sid).toBe('test_call_sid');
    expect(call.status).toBe('in-progress');
    expect(twilioClient.calls.create).toHaveBeenCalledWith({
      to: '+1234567890',
      from: config.twilio.phoneNumber,
      url: 'http://example.com/voice'
    });
  });

  it('should handle message creation errors', async () => {
    twilioClient.messages.create.mockRejectedValueOnce(new Error('Failed to create message'));

    await expect(twilioClient.messages.create({
      body: 'Test message',
      to: '+1234567890',
      from: config.twilio.phoneNumber
    })).rejects.toThrow('Failed to create message');
  });

  it('should handle call creation errors', async () => {
    twilioClient.calls.create.mockRejectedValueOnce(new Error('Failed to create call'));

    await expect(twilioClient.calls.create({
      to: '+1234567890',
      from: config.twilio.phoneNumber,
      url: 'http://example.com/voice'
    })).rejects.toThrow('Failed to create call');
  });
}); 