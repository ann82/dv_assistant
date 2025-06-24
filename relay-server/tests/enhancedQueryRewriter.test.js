import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  rewriteQuery, 
  testQueryRewriting, 
  cleanConversationalFillers,
  extractLocationFromQuery,
  detectLocationWithGeocoding
} from '../lib/enhancedQueryRewriter.js';

// Mock the enhanced location detector
vi.mock('../lib/enhancedLocationDetector.js', () => ({
  detectUSLocation: vi.fn(),
  extractLocationFromQuery: vi.fn(),
  detectLocationWithGeocoding: vi.fn()
}));

import { detectLocationWithGeocoding as mockDetectLocation } from '../lib/enhancedLocationDetector.js';

describe('Enhanced Query Rewriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanConversationalFillers', () => {
    it('should remove leading conversational fillers', () => {
      expect(cleanConversationalFillers('Hey, can you help me find a shelter')).toBe('find a shelter');
      expect(cleanConversationalFillers('Hi, I need help in San Francisco')).toBe('I need help in San Francisco');
      expect(cleanConversationalFillers('Hello, I\'m looking for shelter')).toBe('I\'m looking for shelter');
    });

    it('should remove multiple consecutive fillers', () => {
      expect(cleanConversationalFillers('Hey, hi, can you help me find shelter')).toBe('find shelter');
      expect(cleanConversationalFillers('Hello, excuse me, I need assistance')).toBe('I need assistance');
    });

    it('should handle fillers with punctuation', () => {
      expect(cleanConversationalFillers('Hey! Can you help me?')).toBe('Can you help me?');
      expect(cleanConversationalFillers('Hi, I need help.')).toBe('I need help.');
      expect(cleanConversationalFillers('Hello... I need shelter')).toBe('I need shelter');
    });

    it('should not remove fillers in the middle of sentences', () => {
      expect(cleanConversationalFillers('I need help in San Francisco')).toBe('I need help in San Francisco');
      expect(cleanConversationalFillers('Can you find shelter near me')).toBe('Can you find shelter near me');
    });

    it('should return original string if all content is removed as fillers', () => {
      expect(cleanConversationalFillers('Hey hi hello')).toBe('Hey hi hello');
      expect(cleanConversationalFillers('Can you help me')).toBe('Can you help me');
    });

    it('should handle edge cases', () => {
      expect(cleanConversationalFillers('')).toBe('');
      expect(cleanConversationalFillers(null)).toBe(null);
      expect(cleanConversationalFillers(undefined)).toBe(undefined);
    });
  });

  describe('extractLocationFromQuery', () => {
    it('should extract locations with various prepositions', () => {
      expect(extractLocationFromQuery('find shelter in San Francisco')).toEqual({
        location: 'San Francisco',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('shelter near Oakland')).toEqual({
        location: 'Oakland',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('help around New York')).toEqual({
        location: 'New York',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('services at 94102')).toEqual({
        location: '94102',
        scope: 'unknown',
        isUS: null
      });
    });

    it('should extract non-US locations', () => {
      expect(extractLocationFromQuery('shelter in Mumbai, India')).toEqual({
        location: 'Mumbai, India',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('help near Toronto, Canada')).toEqual({
        location: 'Toronto, Canada',
        scope: 'unknown',
        isUS: null
      });
    });

    it('should handle complex location patterns', () => {
      expect(extractLocationFromQuery('domestic violence shelter within San Francisco, CA')).toEqual({
        location: 'San Francisco, CA',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('emergency housing close to New York City')).toEqual({
        location: 'New York City',
        scope: 'unknown',
        isUS: null
      });
    });

    it('should return null for queries without locations', () => {
      expect(extractLocationFromQuery('I need help')).toEqual({
        location: null,
        scope: 'non-US'
      });
      expect(extractLocationFromQuery('')).toEqual({
        location: null,
        scope: 'non-US'
      });
    });
  });

  describe('rewriteQuery', () => {
    it('should rewrite US location queries with shelter terms', async () => {
      mockDetectLocation.mockResolvedValue({
        location: 'San Francisco',
        scope: 'US',
        isUS: true
      });

      const result = await rewriteQuery('Hey, I need help in San Francisco');
      
      expect(result).toBe('domestic violence shelter near San Francisco site:org OR site:gov -site:wikipedia.org -filetype:pdf');
    });

    it('should preserve existing shelter terms in US locations', async () => {
      mockDetectLocation.mockResolvedValue({
        location: 'Oakland',
        scope: 'US',
        isUS: true
      });

      const result = await rewriteQuery('Hi, I need shelter in Oakland');
      
      expect(result).toBe('I need shelter in Oakland near Oakland site:org OR site:gov -site:wikipedia.org -filetype:pdf');
    });

    it('should handle non-US locations without US-specific enhancements', async () => {
      mockDetectLocation.mockResolvedValue({
        location: 'London',
        scope: 'non-US',
        isUS: false
      });

      const result = await rewriteQuery('Hello, I need shelter in London');
      
      expect(result).toBe('I need shelter in London');
    });

    it('should handle queries without locations', async () => {
      mockDetectLocation.mockResolvedValue({
        location: null,
        scope: 'non-US'
      });

      const result = await rewriteQuery('I need help');
      
      expect(result).toBe('I need help');
    });

    it('should handle edge cases', async () => {
      mockDetectLocation.mockResolvedValue({
        location: null,
        scope: 'non-US'
      });

      expect(await rewriteQuery('')).toBe('');
      expect(await rewriteQuery(null)).toBe(null);
      expect(await rewriteQuery(undefined)).toBe(undefined);
    });

    it('should log the rewriting process', async () => {
      mockDetectLocation.mockResolvedValue({
        location: 'San Francisco',
        scope: 'US',
        isUS: true
      });

      const result = await rewriteQuery('Hey, help me in San Francisco', 'find_shelter', 'test-call-sid');
      
      expect(result).toContain('domestic violence shelter near San Francisco');
      expect(result).toContain('site:org OR site:gov');
    });
  });

  describe('testQueryRewriting', () => {
    it('should work as an alias for rewriteQuery', async () => {
      mockDetectLocation.mockResolvedValue({
        location: 'San Francisco',
        scope: 'US',
        isUS: true
      });

      const result = await testQueryRewriting('Hey, help me in San Francisco');
      
      expect(result).toContain('domestic violence shelter near San Francisco');
    });
  });

  describe('Integration with Location Detection', () => {
    it('should handle geocoding failures gracefully', async () => {
      // Mock geocoding failure
      mockDetectLocation.mockRejectedValue(new Error('Geocoding failed'));

      // Should still return a reasonable result
      const result = await rewriteQuery('I need help in San Francisco');
      expect(typeof result).toBe('string');
    });

    it('should handle complex location scenarios', async () => {
      mockDetectLocation.mockResolvedValue({
        location: 'New York City, NY',
        scope: 'US',
        isUS: true,
        geocodeData: {
          country: 'United States',
          countryCode: 'us',
          state: 'New York',
          city: 'New York City'
        }
      });

      const result = await rewriteQuery('Excuse me, can you find shelter near New York City, NY?');
      
      expect(result).toContain('domestic violence shelter near New York City, NY');
      expect(result).toContain('site:org OR site:gov');
    });
  });
}); 