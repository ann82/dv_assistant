import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processSpeechResult } from '../routes/twilio.js';
import { callTavilyAPI, callGPT } from '../lib/apis.js';
import { extractLocation, generateLocationPrompt } from '../lib/speechProcessor.js';

// Mock the API calls
vi.mock('../lib/apis.js', () => ({
  callTavilyAPI: vi.fn().mockResolvedValue({ results: [
    { title: 'Local Shelter', url: 'https://example.com', content: 'Call 1-800-799-7233', score: 0.9 }
  ] }),
  callGPT: vi.fn()
}));

describe('Speech Processing', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('processSpeechResult', () => {
    it('should call Tavily API for resource-related queries and return formatted response', async () => {
      const result = await processSpeechResult('CA123', 'I need help finding a shelter', 0.9);
      expect(result).toHaveProperty('voiceResponse');
      expect(result.voiceResponse).toContain('I found');
    });

    it('should return a location prompt for general queries with no location', async () => {
      const result = await processSpeechResult('CA123', 'How are you today?', 0.9);
      expect(typeof result).toBe('string');
      expect(result).toContain('location');
    });

    it('should handle API errors gracefully', async () => {
      callTavilyAPI.mockRejectedValueOnce(new Error('API Error'));
      await expect(processSpeechResult('CA123', 'find shelter', 0.9))
        .rejects
        .toThrow('API Error');
    });

    it('should handle empty speech results', async () => {
      const result = await processSpeechResult('CA123', '', 0.9);
      expect(typeof result).toBe('string');
      expect(result).toContain('location');
    });

    it('should handle null speech results', async () => {
      const result = await processSpeechResult('CA123', null, 0.9);
      expect(typeof result).toBe('string');
      expect(result).toContain('location');
    });
  });

  describe('Location Extraction', () => {
    it('should extract location from "I need shelter in San Francisco"', async () => {
      // If pattern fails, mock callGPT to return the location
      callGPT.mockResolvedValueOnce({ text: 'San Francisco' });
      const speech = "I need shelter in San Francisco";
      const location = await extractLocation(speech);
      expect(location).toBe('San Francisco');
    });

    it('should extract location from "homeless me a Tahoe"', async () => {
      callGPT.mockResolvedValueOnce({ text: 'Tahoe' });
      const speech = "homeless me a Tahoe";
      const location = await extractLocation(speech);
      expect(location).toBe('Tahoe');
    });

    it('should return null for speech without location', async () => {
      callGPT.mockResolvedValueOnce({ text: 'none' });
      const speech = "I need help";
      const location = await extractLocation(speech);
      expect(location).toBeNull();
    });
  });

  describe('Location Prompt Generation', () => {
    it('should return a prompt asking for location', () => {
      const prompt = generateLocationPrompt();
      expect(prompt).toContain('location');
      expect(prompt).toContain('city');
    });

    it('should return different prompts on multiple calls', () => {
      const prompt1 = generateLocationPrompt();
      const prompt2 = generateLocationPrompt();
      expect(prompt1).not.toBe(prompt2);
    });
  });
}); 