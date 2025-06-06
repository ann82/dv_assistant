import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { processSpeechResult, generateSpeechHash } from '../routes/twilio.js';
import { callTavilyAPI, callGPT } from '../lib/apis.js';

// Mock the API calls
vi.mock('../lib/apis.js', () => ({
  default: {},
  callTavilyAPI: vi.fn(),
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
      const mockResponse = { results: ['shelter info'] };
      callTavilyAPI.mockResolvedValue(mockResponse);

      // First call
      await processSpeechResult('CA123', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(1);

      // Second call with same input
      await processSpeechResult('CA123', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should process same speech result for different callSids', async () => {
      const mockResponse = { results: ['shelter info'] };
      callTavilyAPI.mockResolvedValue(mockResponse);

      // First call
      await processSpeechResult('CA123', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(1);

      // Second call with same speech but different callSid
      await processSpeechResult('CA456', 'find shelter', 0.9);
      expect(callTavilyAPI).toHaveBeenCalledTimes(2);
    });

    it('should handle empty speech results', async () => {
      await expect(processSpeechResult('CA123', '', 0.9))
        .rejects
        .toThrow();
    });

    it('should handle null speech results', async () => {
      await expect(processSpeechResult('CA123', null, 0.9))
        .rejects
        .toThrow();
    });
  });
}); 