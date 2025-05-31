import { vi, describe, it, expect, beforeEach } from 'vitest';
// Mock OpenAI
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(() => ({
    audio: { speech: { create: vi.fn() } },
    chat: { completions: { create: vi.fn() } }
  }));
  return { OpenAI, default: OpenAI };
});
// Mock Twilio
vi.mock('twilio', () => {
  class VoiceResponse {
    constructor() {
      this.say = vi.fn();
      this.play = vi.fn();
      this.gather = vi.fn().mockReturnValue({
        say: vi.fn(),
        play: vi.fn(),
        pause: vi.fn()
      });
      this.pause = vi.fn();
      this.connect = vi.fn().mockReturnValue({
        stream: vi.fn()
      });
      this.toString = vi.fn().mockReturnValue('<Response></Response>');
    }
  }

  const twilio = vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
    calls: { create: vi.fn() }
  }));

  twilio.twiml = { VoiceResponse };
  twilio.validateRequest = vi.fn().mockReturnValue(true);

  return {
    default: twilio,
    twiml: { VoiceResponse },
    validateRequest: vi.fn().mockReturnValue(true)
  };
});
// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'TEST_ACCOUNT_SID',
    TWILIO_AUTH_TOKEN: 'TEST_AUTH_TOKEN',
    OPENAI_API_KEY: 'sk-test-key',
    twilio: {
      accountSid: 'TEST_ACCOUNT_SID',
      authToken: 'TEST_AUTH_TOKEN',
      phoneNumber: '+1234567890'
    }
  }
}));

import { handleTwilioWebhook } from '../routes/twilio.js';

describe('Twilio Route Handler', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

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
      },
      get: vi.fn((header) => {
        if (header === 'host') return 'localhost:3000';
        return undefined;
      })
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

    // Mock global.wss
    global.wss = {
      registerCall: vi.fn(),
      getClient: vi.fn().mockReturnValue({ send: vi.fn() }),
      audioService: {
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
      }
    };
  });

  describe('Basic Functionality', () => {
    it('should handle transcription requests', async () => {
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should handle missing transcription', async () => {
      mockReq.body.SpeechResult = '';
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CallSid', async () => {
      delete mockReq.body.CallSid;
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should handle WebSocket server errors', async () => {
      global.wss.getClient.mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('WebSocket error'))
      });

      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });
  });
}); 