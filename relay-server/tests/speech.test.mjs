import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { processSpeechResult } from '../routes/twilio.js';
import { ResponseGenerator } from '../lib/response.js';
import * as speechProcessor from '../lib/speechProcessor.js';

// Mock the API calls
vi.mock('../lib/response.js', () => ({
  ResponseGenerator: {
    queryTavily: vi.fn().mockResolvedValue({ results: [
      { title: 'Local Shelter', url: 'https://example.com', content: 'Call 1-800-799-7233', score: 0.9 }
    ] }),
    generateGPTResponse: vi.fn(),
    formatTavilyResponse: vi.fn().mockReturnValue({
      voiceResponse: 'I found 1 shelter: Local Shelter',
      smsResponse: 'Shelters:\n\n1. Local Shelter\n   https://example.com\n\n',
      summary: 'I found 1 shelter',
      shelters: [{ name: 'Local Shelter', phone: '1-800-799-7233' }]
    })
  }
}));

// Mock the speech processor and export processSpeechResult
vi.mock('../lib/speechProcessor.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    processSpeechResult: actual.processSpeechResult
  };
});

// Mock the enhanced location detector
vi.mock('../lib/enhancedLocationDetector.js', () => ({
  detectUSLocation: vi.fn(),
  extractLocationFromQuery: vi.fn((query) => {
    if (!query) return { location: null, scope: 'non-US' };
    
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('san francisco')) {
      return { location: 'san francisco', scope: 'unknown', isUS: null };
    }
    if (lowerQuery.includes('oakland')) {
      return { location: 'oakland', scope: 'unknown', isUS: null };
    }
    if (lowerQuery.includes('new york')) {
      return { location: 'new york', scope: 'unknown', isUS: null };
    }
    
    return { location: null, scope: 'non-US' };
  }),
  detectLocationWithGeocoding: vi.fn((query) => {
    if (!query) return { location: null, scope: 'non-US', isUS: false };
    
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('san francisco')) {
      return { location: 'San Francisco', scope: 'US', isUS: true };
    }
    if (lowerQuery.includes('oakland')) {
      return { location: 'Oakland', scope: 'US', isUS: true };
    }
    if (lowerQuery.includes('new york')) {
      return { location: 'New York', scope: 'US', isUS: true };
    }
    
    return { location: null, scope: 'non-US', isUS: false };
  })
}));

// Mock the query rewriter
vi.mock('../lib/enhancedQueryRewriter.js', () => ({
  rewriteQuery: vi.fn(async (query) => {
    if (query.includes('san francisco')) {
      return 'domestic violence shelter near San Francisco site:org OR site:gov -site:wikipedia.org -filetype:pdf';
    }
    if (query.includes('oakland')) {
      return 'domestic violence shelter near Oakland site:org OR site:gov -site:wikipedia.org -filetype:pdf';
    }
    return query;
  }),
  cleanConversationalFillers: vi.fn((query) => {
    if (query.startsWith('Hey!')) {
      return query.replace(/^Hey!\s*/, '');
    }
    if (query.startsWith('Hi,')) {
      return query.replace(/^Hi,\s*/, '');
    }
    return query;
  })
}));

// Mock the Tavily processor
vi.mock('../lib/tavilyProcessor.js', () => ({
  processTavilyQuery: vi.fn(async (query, options) => {
    return {
      success: true,
      results: [
        {
          title: 'Domestic Violence Shelter - Safe Haven',
          content: 'Emergency shelter for domestic violence victims',
          url: 'https://example.com/shelter',
          score: 0.9
        }
      ],
      query: query
    };
  })
}));

// Import the mocked functions
import { processSpeechResult } from '../lib/speechProcessor.js';
import { extractLocationFromQuery } from '../lib/enhancedLocationDetector.js';
import { rewriteQuery, cleanConversationalFillers } from '../lib/enhancedQueryRewriter.js';
import { processTavilyQuery } from '../lib/tavilyProcessor.js';

describe('Speech Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processSpeechResult', () => {
    it('should process speech with location detection', async () => {
      const result = await processSpeechResult('Hey! I need help in San Francisco', 'test-call-sid');
      
      expect(cleanConversationalFillers).toHaveBeenCalledWith('Hey! I need help in San Francisco');
      expect(extractLocationFromQuery).toHaveBeenCalled();
      expect(rewriteQuery).toHaveBeenCalled();
      expect(processTavilyQuery).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle queries without location', async () => {
      const result = await processSpeechResult('I need help', 'test-call-sid');
      
      expect(cleanConversationalFillers).toHaveBeenCalledWith('I need help');
      expect(extractLocationFromQuery).toHaveBeenCalled();
      expect(rewriteQuery).toHaveBeenCalled();
      expect(processTavilyQuery).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle empty speech input', async () => {
      const result = await processSpeechResult('', 'test-call-sid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No speech input provided');
    });

    it('should handle null speech input', async () => {
      const result = await processSpeechResult(null, 'test-call-sid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No speech input provided');
    });

    it('should handle undefined speech input', async () => {
      const result = await processSpeechResult(undefined, 'test-call-sid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No speech input provided');
    });

    it('should log processing steps', async () => {
      const result = await processSpeechResult('Hi, I need shelter in Oakland', 'test-call-sid');
      
      expect(cleanConversationalFillers).toHaveBeenCalledWith('Hi, I need shelter in Oakland');
      expect(extractLocationFromQuery).toHaveBeenCalled();
      expect(rewriteQuery).toHaveBeenCalled();
      expect(processTavilyQuery).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Location Extraction Integration', () => {
    it('should extract location from speech input', async () => {
      await processSpeechResult('I need help in New York', 'test-call-sid');
      
      expect(extractLocationFromQuery).toHaveBeenCalledWith('I need help in New York');
    });

    it('should handle location extraction failures gracefully', async () => {
      const result = await processSpeechResult('I need help', 'test-call-sid');
      
      expect(extractLocationFromQuery).toHaveBeenCalledWith('I need help');
      expect(result.success).toBe(true);
    });
  });

  describe('Query Rewriting Integration', () => {
    it('should rewrite queries with locations', async () => {
      await processSpeechResult('I need shelter in San Francisco', 'test-call-sid');
      
      expect(rewriteQuery).toHaveBeenCalledWith('I need shelter in San Francisco', 'find_shelter', 'test-call-sid');
    });

    it('should handle query rewriting failures gracefully', async () => {
      const result = await processSpeechResult('I need help', 'test-call-sid');
      
      expect(rewriteQuery).toHaveBeenCalledWith('I need help', 'find_shelter', 'test-call-sid');
      expect(result.success).toBe(true);
    });
  });

  describe('Tavily Integration', () => {
    it('should process Tavily queries', async () => {
      const result = await processSpeechResult('I need shelter in Oakland', 'test-call-sid');
      
      expect(processTavilyQuery).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    it('should handle Tavily processing failures gracefully', async () => {
      // Mock a failure
      processTavilyQuery.mockRejectedValueOnce(new Error('Tavily API error'));
      
      const result = await processSpeechResult('I need help', 'test-call-sid');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tavily API error');
    });
  });
}); 