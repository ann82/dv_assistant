var audioServiceMocks = {
  transcribeWithWhisper: undefined,
  getGptReply: undefined,
  generateTTS: undefined
};

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { handleTwilioWebhook } from '../src/routes/twilio.js';
import { AudioService } from '../src/services/audioService.js';
import fs from 'fs/promises';
import path from 'path';

vi.mock('../src/services/audioService.js', () => ({
  AudioService: vi.fn().mockImplementation(() => audioServiceMocks)
}));

// Mock config
vi.mock('../src/lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    TWILIO_AUTH_TOKEN: 'test-auth-token'
  }
}));

// Mock Twilio client
vi.mock('twilio', () => {
  const mockTwilioClient = {
    calls: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue({
        sid: 'test-call-sid',
        status: 'in-progress',
        duration: '0'
      })
    }),
    recordings: {
      list: vi.fn().mockResolvedValue([])
    }
  };
  return vi.fn().mockReturnValue(mockTwilioClient);
});

// Mock fs promises
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

// Mock global WebSocket server
global.wss = {
  registerCall: vi.fn()
};

describe('Twilio Route Handler', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let audioService;

  beforeEach(() => {
    vi.clearAllMocks();
    audioServiceMocks.transcribeWithWhisper = vi.fn().mockResolvedValue('test transcription');
    audioServiceMocks.getGptReply = vi.fn().mockResolvedValue({
      text: 'test response',
      model: 'gpt-4',
      inputTokens: 10,
      outputTokens: 20
    });
    audioServiceMocks.generateTTS = vi.fn().mockResolvedValue({
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

    // Get AudioService instance
    audioService = new AudioService();
  });

  describe('Transcription Handling', () => {
    it('should handle transcription requests', async () => {
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(audioServiceMocks.transcribeWithWhisper).toHaveBeenCalledWith('test speech result');
      expect(audioServiceMocks.getGptReply).toHaveBeenCalledWith('test transcription');
      expect(audioServiceMocks.generateTTS).toHaveBeenCalledWith('test response');
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

      expect(audioServiceMocks.generateTTS).toHaveBeenCalledWith('test response');
      expect(fs.stat).toHaveBeenCalledWith('/path/to/test.mp3');
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        audioPath: '/audio/test.mp3'
      }));
    });

    it('should handle TTS generation errors', async () => {
      audioServiceMocks.generateTTS.mockRejectedValueOnce(new Error('TTS generation failed'));
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
      audioServiceMocks.transcribeWithWhisper.mockRejectedValueOnce(new Error('Transcription failed'));
      await handleTwilioWebhook(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to process transcription'
      });
    });

    it('should handle GPT response errors', async () => {
      audioServiceMocks.getGptReply.mockRejectedValueOnce(new Error('GPT response failed'));
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

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });
}); 