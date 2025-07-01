import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwilioVoiceHandler } from '../lib/twilioVoice.js';

// Mock AudioService
vi.mock('../services/audioService.js', () => ({
  AudioService: vi.fn().mockImplementation(() => ({
    generateTTS: vi.fn().mockResolvedValue({
      text: 'Test message',
      fileName: 'test123.mp3',
      filePath: '/path/to/test123.mp3',
      cached: false
    })
  }))
}));

describe('TTS Integration Tests', () => {
  let twilioVoiceHandler;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create TwilioVoiceHandler instance for testing
    twilioVoiceHandler = new TwilioVoiceHandler(
      'ACtest123456789',
      'test_auth_token',
      '+1234567890'
    );
  });

  describe('generateTTSBasedTwiML', () => {
    it('should generate TwiML with Play element instead of Say', async () => {
      const text = 'Hello, this is a test message';
      const result = await twilioVoiceHandler.generateTTSBasedTwiML(text, true);

      // Should contain Play element
      expect(result).toContain('<Play>');
      expect(result).toContain('test123.mp3');
      
      // Should not contain Say element
      expect(result).not.toContain('<Say>');
      expect(result).not.toContain('Polly.Amy');
      
      // Should contain Gather element when shouldGather is true
      expect(result).toContain('<Gather');
    });

    it('should not include Gather element when shouldGather is false', async () => {
      const text = 'Hello, this is a test message';
      const result = await twilioVoiceHandler.generateTTSBasedTwiML(text, false);

      // Should contain Play element
      expect(result).toContain('<Play>');
      
      // Should not contain Gather element
      expect(result).not.toContain('<Gather');
    });

    it('should fallback to Polly when TTS fails', async () => {
      // Mock TTS failure
      twilioVoiceHandler.audioService.generateTTS = vi.fn().mockRejectedValue(new Error('TTS failed'));
      
      const text = 'Hello, this is a test message';
      const result = await twilioVoiceHandler.generateTTSBasedTwiML(text, true);

      // Should fallback to Polly
      expect(result).toContain('<Say voice="Polly.Amy">');
      expect(result).not.toContain('<Play>');
    });
  });

  describe('handleIncomingCall', () => {
    it('should use TTS for welcome message', async () => {
      const mockReq = {
        setTimeout: vi.fn(),
        headers: {},
        body: {},
        originalUrl: '/test',
        protocol: 'https',
        get: vi.fn().mockReturnValue('test.com'),
        method: 'POST'
      };

      // Mock validateTwilioRequest to return true
      twilioVoiceHandler.validateTwilioRequest = vi.fn().mockReturnValue(true);

      const result = await twilioVoiceHandler.handleIncomingCall(mockReq);

      // Should contain Play element for welcome message
      expect(result).toContain('<Play>');
      expect(result).toContain('Welcome to the Domestic Violence Support Assistant');
    });
  });
}); 