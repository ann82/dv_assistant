// Set environment variables before any imports
process.env.OPENAI_API_KEY = 'test-api-key';

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock OpenAI before any imports that might use it
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(({ apiKey }) => ({
    apiKey,
    audio: { 
      speech: { 
        create: vi.fn().mockResolvedValue({
          text: 'test response',
          audio: Buffer.from('test audio data')
        })
      }
    },
    chat: { 
      completions: { 
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'test response'
            }
          }]
        })
      }
    }
  }));
  return { OpenAI, default: OpenAI };
});

// Unified Twilio mock
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
    calls: {
      fetch: vi.fn().mockResolvedValue({
        sid: 'test-call-sid',
        status: 'in-progress',
        duration: '0'
      })
    },
    messages: { create: vi.fn() },
    recordings: {
      list: vi.fn().mockResolvedValue([])
    }
  }));
  twilio.twiml = { VoiceResponse };
  twilio.validateRequest = vi.fn().mockReturnValue(true);
  return {
    default: twilio,
    twiml: { VoiceResponse },
    validateRequest: vi.fn().mockReturnValue(true)
  };
});

import { handleTwilioWebhook } from '../relay-server/routes/twilio.js';
import { AudioService } from '../relay-server/services/audioService.js';
import fs from 'fs/promises';
import path from 'path';
import * as fsPromises from 'fs/promises';

// Mock config
vi.mock('../relay-server/lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    twilio: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'test-auth-token',
      phoneNumber: '+1234567890'
    }
  }
}));

// Mock AudioService
vi.mock('../relay-server/services/audioService.js', () => ({
  AudioService: vi.fn().mockImplementation(() => ({
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
  }))
}));

// Mock fs/promises
vi.mock('fs/promises', () => {
  const stat = vi.fn().mockImplementation((path) => {
    if (path === '/path/to/test.mp3') {
      return Promise.resolve({ size: 1024 });
    }
    return Promise.reject(new Error('File not found'));
  });
  const access = vi.fn();
  const writeFile = vi.fn();
  return {
    stat,
    access,
    writeFile,
    default: { stat, access, writeFile }
  };
});

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn().mockImplementation((path) => path === '/path/to/test.mp3'),
  default: {
    existsSync: vi.fn().mockImplementation((path) => path === '/path/to/test.mp3')
  }
}));

// Use the mocked fs.promises.stat for assertions
const fs = fsPromises;

describe('Twilio Route Handler', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let audioService;

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

    // Create mock AudioService instance with spy functions
    audioService = {
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

    // Mock global.wss with all required methods and audioService
    global.wss = {
      registerCall: vi.fn(),
      getClient: vi.fn().mockReturnValue({ send: vi.fn() }),
      audioService
    };
  });

  describe('Transcription Handling', () => {
    it('should handle transcription requests', async () => {
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(audioService.getGptReply).toHaveBeenCalled();
      expect(audioService.generateTTS).toHaveBeenCalled();
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

  describe('TTS Generation', () => {
    it('should generate and verify TTS audio', async () => {
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(audioService.generateTTS).toHaveBeenCalled();
      expect(fs.stat).toHaveBeenCalled();
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should handle TTS generation errors', async () => {
      audioService.generateTTS.mockRejectedValueOnce(new Error('TTS generation failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should handle missing audio file', async () => {
      fs.stat.mockRejectedValueOnce(new Error('File not found'));
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

    it('should handle transcription errors', async () => {
      audioService.transcribeWithWhisper.mockRejectedValueOnce(new Error('Transcription failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should handle GPT response errors', async () => {
      audioService.getGptReply.mockRejectedValueOnce(new Error('GPT response failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
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

      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(mockRes.send).toHaveBeenCalled();
    });
  });
}); 