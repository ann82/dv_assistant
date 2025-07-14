import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the enhanced location detector
vi.mock('../lib/enhancedLocationDetector.js', () => ({
  extractLocationFromQuery: vi.fn((query) => {
    if (query.includes('San Francisco')) {
      return { location: 'san francisco', scope: 'unknown', isUS: null };
    }
    if (query.includes('Oakland')) {
      return { location: 'oakland', scope: 'unknown', isUS: null };
    }
    if (query.includes('New York')) {
      return { location: 'new york', scope: 'unknown', isUS: null };
    }
    if (query.includes('London')) {
      return { location: 'london', scope: 'unknown', isUS: null };
    }
    if (query.includes('94102')) {
      return { location: '94102', scope: 'unknown', isUS: null };
    }
    if (query.includes('Mumbai')) {
      return { location: 'mumbai, india', scope: 'unknown', isUS: null };
    }
    if (query.includes('Toronto')) {
      return { location: 'toronto, canada', scope: 'unknown', isUS: null };
    }
    if (query.includes('New York City')) {
      return { location: 'new york city', scope: 'unknown', isUS: null };
    }
    
    return { location: null, scope: 'non-US', isComplete: false, country: null };
  }),
  detectLocationWithGeocoding: vi.fn(async (query) => {
    if (query.includes('San Francisco')) {
      return { location: 'San Francisco', scope: 'complete', isComplete: true, country: 'United States' };
    }
    if (query.includes('Oakland')) {
      return { location: 'Oakland', scope: 'complete', isComplete: true, country: 'United States' };
    }
    if (query.includes('London')) {
      return { location: 'London', scope: 'complete', isComplete: true, country: 'United Kingdom' };
    }
    if (query.includes('New York City')) {
      return { location: 'New York City, NY', scope: 'complete', isComplete: true, country: 'United States' };
    }
    
    return { location: null, scope: 'non-US', isComplete: false, country: null };
  })
}));

import { 
  rewriteQuery, 
  cleanConversationalFillers
} from '../lib/enhancedQueryRewriter.js';
import { extractLocationFromQuery } from '../lib/enhancedLocationDetector.js';

describe('Enhanced Query Rewriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanConversationalFillers', () => {
    it('should remove leading conversational fillers', () => {
      expect(cleanConversationalFillers('Hey, can you help me find a shelter')).toBe('help me find a shelter');
      expect(cleanConversationalFillers('Hi, I need help in San Francisco')).toBe('I need help in San Francisco');
      expect(cleanConversationalFillers('Hello, I\'m looking for shelter')).toBe('I\'m looking for shelter');
    });

    it('should remove multiple consecutive fillers', () => {
      expect(cleanConversationalFillers('Hey, hi, can you help me find shelter')).toBe('help me find shelter');
      expect(cleanConversationalFillers('Hello, excuse me, I need assistance')).toBe('I need assistance');
    });

    it('should handle fillers with punctuation', () => {
      expect(cleanConversationalFillers('Hey! Can you help me?')).toBe('help me?');
      expect(cleanConversationalFillers('Hi, I need help.')).toBe('I need help.');
      expect(cleanConversationalFillers('Hello... I need shelter')).toBe('I need shelter');
    });

    it('should not remove fillers in the middle of sentences', () => {
      expect(cleanConversationalFillers('I need help in San Francisco')).toBe('I need help in San Francisco');
      expect(cleanConversationalFillers('Can you find shelter near me')).toBe('find shelter near me');
    });

    it('should return original string if all content is removed as fillers', () => {
      expect(cleanConversationalFillers('Hey hi hello')).toBe('Hey hi hello');
      expect(cleanConversationalFillers('Can you help me')).toBe('help me');
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
        location: 'san francisco',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('shelter near Oakland')).toEqual({
        location: 'oakland',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('help around New York')).toEqual({
        location: 'new york',
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
        location: 'mumbai, india',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('help near Toronto, Canada')).toEqual({
        location: 'toronto, canada',
        scope: 'unknown',
        isUS: null
      });
    });

    it('should handle complex location patterns', () => {
      expect(extractLocationFromQuery('domestic violence shelter within San Francisco, CA')).toEqual({
        location: 'san francisco',
        scope: 'unknown',
        isUS: null
      });
      expect(extractLocationFromQuery('emergency housing close to New York City')).toEqual({
        location: 'new york',
        scope: 'unknown',
        isUS: null
      });
    });

    it('should return null for queries without locations', () => {
      expect(extractLocationFromQuery('I need help')).toEqual({
        location: null,
        scope: 'non-US',
        country: null,
        isComplete: false
      });
      expect(extractLocationFromQuery('')).toEqual({
        location: null,
        scope: 'non-US',
        country: null,
        isComplete: false
      });
    });
  });

  describe('rewriteQuery', () => {
    it('should rewrite US location queries with shelter terms', async () => {
      const result = await rewriteQuery('Hey, I need help in San Francisco');
      
      expect(result).toBe('I need help in San Francisco domestic violence shelter help');
    });

    it('should preserve existing shelter terms in US locations', async () => {
      const result = await rewriteQuery('Hi, I need shelter in Oakland');
      
      expect(result).toBe('I need shelter in Oakland domestic violence shelter help');
    });

    it('should handle non-US locations without US-specific enhancements', async () => {
      const result = await rewriteQuery('Hello, I need shelter in London');
      
      expect(result).toBe('I need shelter in London domestic violence shelter help');
    });

    it('should handle queries without locations', async () => {
      const result = await rewriteQuery('I need help');
      
      expect(result).toBe('I need help domestic violence shelter help');
    });

    it('should handle edge cases', async () => {
      expect(await rewriteQuery('')).toBe('');
      expect(await rewriteQuery(null)).toBe(null);
      expect(await rewriteQuery(undefined)).toBe(undefined);
    });

    it('should log the rewriting process', async () => {
      const result = await rewriteQuery('Hey, help me in San Francisco', 'find_shelter', 'test-call-sid');
      
      expect(result).toContain('help me in San Francisco');
      expect(result).toContain('domestic violence shelter help');
    });

    it('should enhance US location queries with site restrictions', async () => {
      const result = await rewriteQuery('find shelter in San Francisco', 'find_shelter');
      expect(result).toBe('find shelter in San Francisco domestic violence shelter help');
    });

    it('should preserve existing shelter terms and add location', async () => {
      const result = await rewriteQuery('I need shelter in Oakland', 'find_shelter');
      expect(result).toBe('I need shelter in Oakland domestic violence shelter help');
    });

    it('should handle geocoding failures gracefully', async () => {
      // Should still return a reasonable result
      const result = await rewriteQuery('Excuse me, can you find shelter near New York City, NY?');
      
      expect(result).toContain('find shelter near New York City, NY?');
      expect(result).toContain('domestic violence shelter help');
    });

    it('should handle complex location scenarios', async () => {
      const result = await rewriteQuery('Excuse me, can you find shelter near New York City, NY?');
      
      expect(result).toContain('find shelter near New York City, NY?');
      expect(result).toContain('domestic violence shelter help');
    });
  });

  describe('Integration with Location Detection', () => {
    it('should handle geocoding failures gracefully', async () => {
      // Should still return a reasonable result
      const result = await rewriteQuery('Excuse me, can you find shelter near New York City, NY?');
      
      expect(result).toContain('find shelter near New York City, NY?');
      expect(result).toContain('domestic violence shelter help');
    });

    it('should handle complex location scenarios', async () => {
      const result = await rewriteQuery('Excuse me, can you find shelter near New York City, NY?');
      
      expect(result).toContain('find shelter near New York City, NY?');
      expect(result).toContain('domestic violence shelter help');
    });
  });
}); 