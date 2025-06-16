import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { processSpeechResult, generateSpeechHash } from '../routes/twilio.js';
import { callTavilyAPI, callGPT } from '../lib/apis.js';
import { extractLocationFromSpeech, generateLocationPrompt } from '../lib/speechProcessor.js';

// Mock the API calls
vi.mock('../lib/apis.js', () => ({
  callTavilyAPI: vi.fn().mockResolvedValue({ results: ['shelter info'] }),
  callGPT: vi.fn()
}));

describe('Speech Processing', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('generateSpeechHash', () => {
    it('should generate consistent hashes for same input', () => {
      const callSid = 'CA123';
      const speechResult = 'test speech';
      const hash1 = generateSpeechHash(callSid, speechResult);
      const hash2 = generateSpeechHash(callSid, speechResult);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const callSid = 'CA123';
      const hash1 = generateSpeechHash(callSid, 'test speech 1');
      const hash2 = generateSpeechHash(callSid, 'test speech 2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('processSpeechResult', () => {
    it('should call Tavily API for resource-related queries', async () => {
      const mockTavilyResponse = { results: ['shelter info'] };
      callTavilyAPI.mockResolvedValue(mockTavilyResponse);

      const result = await processSpeechResult('CA123', 'I need help finding a shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledWith('I need help finding a shelter');
      expect(callGPT).not.toHaveBeenCalled();
      expect(result).toBe(mockTavilyResponse);
    });

    it('should call GPT for general queries', async () => {
      const mockGPTResponse = { text: 'general response' };
      callGPT.mockResolvedValue(mockGPTResponse);

      const result = await processSpeechResult('CA123', 'How are you today?', 0.9);
      expect(callGPT).toHaveBeenCalledWith('How are you today?');
      expect(callTavilyAPI).not.toHaveBeenCalled();
      expect(result).toBe('general response');
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      callTavilyAPI.mockRejectedValue(error);

      await expect(processSpeechResult('CA123', 'find shelter', 0.9))
        .rejects
        .toThrow('API Error');
    });

    it('should not process duplicate speech results', async () => {
      // First call
      await processSpeechResult('CA123', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(1);

      // Reset mock
      callTavilyAPI.mockClear();

      // Second call with same input
      await processSpeechResult('CA123', 'find shelter', 0.9);
      expect(callTavilyAPI).not.toHaveBeenCalled();
    });

    it('should process same speech result for different callSids', async () => {
      // First call
      await processSpeechResult('CA123', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(1);

      // Reset mock
      callTavilyAPI.mockClear();

      // Second call with same speech but different callSid
      await processSpeechResult('CA456', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(1);
    });

    it('should handle empty speech results', async () => {
      await expect(processSpeechResult('CA123', '', 0.9))
        .resolves
        .toBe('general response');
    });

    it('should handle null speech results', async () => {
      await expect(processSpeechResult('CA123', null, 0.9))
        .rejects
        .toThrow();
    });
  });

  describe('Location Extraction', () => {
    it('should extract location from speech with "in" pattern', () => {
      const speech = 'I need help finding a shelter in San Francisco, California';
      const location = extractLocationFromSpeech(speech);
      expect(location).toBe('San Francisco, California');
    });

    it('should extract location from speech with "find shelters in" pattern', () => {
      const speech = 'find shelters in Oakland, California';
      const location = extractLocationFromSpeech(speech);
      expect(location).toBe('Oakland, California');
    });

    it('should return null when no location is found', () => {
      const speech = 'I need help finding a shelter';
      const location = extractLocationFromSpeech(speech);
      expect(location).toBeNull();
    });
  });

  describe('Location Prompt Generation', () => {
    it('should return a prompt asking for location', () => {
      const prompt = generateLocationPrompt();
      expect(prompt).toContain('location');
      expect(prompt).toContain('city');
      expect(prompt).toContain('area');
    });

    it('should return different prompts on multiple calls', () => {
      const prompt1 = generateLocationPrompt();
      const prompt2 = generateLocationPrompt();
      expect(prompt1).not.toBe(prompt2);
    });
  });
}); 