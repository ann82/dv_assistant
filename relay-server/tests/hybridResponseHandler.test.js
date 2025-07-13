import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Remove the top-level import of HybridResponseHandler
// import { HybridResponseHandler } from '../lib/hybridResponseHandler.js';

let HybridResponseHandler;

// Mock dependencies
vi.mock('../lib/config.js', () => ({
  config: {
    GPT35_MODEL: 'gpt-3.5-turbo',
    OPENAI_API_KEY: 'test-key'
  }
}));

vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../integrations/openaiIntegration.js', () => ({
  OpenAIIntegration: vi.fn().mockImplementation(() => ({
    createChatCompletion: vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: 'test AI response'
        }
      }]
    })
  }))
}));

vi.mock('../integrations/searchIntegration.js', () => ({
  SearchIntegration: {
    search: vi.fn().mockResolvedValue({
      results: [
        {
          title: 'Test Domestic Violence Shelter',
          content: 'A safe place for victims. Phone: 555-123-4567. Visit us at www.testshelter.org',
          url: 'https://testshelter.org',
          score: 0.8
        },
        {
          title: 'Another Domestic Violence Shelter',
          content: 'Shelter for emergencies. Phone: 555-987-6543. Visit us at www.anothershelter.org',
          url: 'https://anothershelter.org',
          score: 0.7
        }
      ]
    })
  }
}));

vi.mock('../lib/queryCache.js', () => ({
  gptCache: {
    get: vi.fn(),
    set: vi.fn(),
    getStats: vi.fn().mockReturnValue({ size: 0, hits: 0, misses: 0 })
  }
}));

describe('HybridResponseHandler', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import after mocks are set up
    ({ HybridResponseHandler } = await import('../lib/hybridResponseHandler.js'));
    
    // Explicitly reset the mocks to ensure clean state
    const { OpenAIIntegration } = await import('../integrations/openaiIntegration.js');
    const { SearchIntegration } = await import('../integrations/searchIntegration.js');
    
    // Reset OpenAI mock
    OpenAIIntegration.mockClear();
    OpenAIIntegration.mockImplementation(() => ({
      createChatCompletion: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'test AI response'
          }
        }]
      })
    }));
    
    // Reset SearchIntegration mock
    SearchIntegration.search.mockClear();
    SearchIntegration.search.mockResolvedValue({
      results: [
        {
          title: 'Test Domestic Violence Shelter',
          content: 'A safe place for victims. Phone: 555-123-4567. Visit us at www.testshelter.org',
          url: 'https://testshelter.org',
          score: 0.8
        },
        {
          title: 'Another Domestic Violence Shelter',
          content: 'Shelter for emergencies. Phone: 555-987-6543. Visit us at www.anothershelter.org',
          url: 'https://anothershelter.org',
          score: 0.7
        }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isShelterSearch', () => {
    it('should identify shelter searches', () => {
      const shelterQueries = [
        'I need to find a shelter near me',
        'Looking for domestic violence shelter in Austin',
        'Search for safe house around here',
        'Need emergency housing in my area',
        'Find shelter close to me'
      ];
      
      shelterQueries.forEach(query => {
        expect(HybridResponseHandler.isShelterSearch(query)).toBe(true);
      });
    });

    it('should not identify non-shelter queries', () => {
      const nonShelterQueries = [
        'I need legal help',
        'What is domestic violence?',
        'How do I recognize abuse?',
        'I need counseling services',
        'What are my rights?'
      ];
      
      nonShelterQueries.forEach(query => {
        expect(HybridResponseHandler.isShelterSearch(query)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(HybridResponseHandler.isShelterSearch('')).toBe(false);
      expect(HybridResponseHandler.isShelterSearch(null)).toBe(false);
      expect(HybridResponseHandler.isShelterSearch(undefined)).toBe(false);
    });
  });

  describe('getResponse', () => {
    it('should use Tavily for shelter searches', async () => {
      const input = 'I need to find a shelter near me';
      const context = { location: 'Austin, TX' };
      
      const response = await HybridResponseHandler.getResponse(input, context, 'web');
      
      expect(response.success).toBe(true);
      expect(response.source).toBe('tavily_hybrid');
      expect(response.results).toHaveLength(2);
      expect(response.voiceResponse).toContain('I found 2 shelters');
    });

    it('should use AI for conversational queries', async () => {
      const input = 'I need legal help with a restraining order';
      const context = { location: 'Austin, TX' };
      
      const response = await HybridResponseHandler.getResponse(input, context, 'web');
      
      expect(response.success).toBe(true);
      expect(response.source).toBe('ai_hybrid');
      expect(response.webResponse).toContain('test AI response');
    });

    it('should use cached response when available', async () => {
      const input = 'I need help finding a shelter';
      const cachedResponse = {
        success: true,
        source: 'tavily_hybrid',
        voiceResponse: 'Cached response',
        webResponse: 'Cached response'
      };
      
      const { gptCache } = await import('../lib/queryCache.js');
      gptCache.get.mockReturnValue(cachedResponse);
      
      const response = await HybridResponseHandler.getResponse(input, {}, 'web');
      
      expect(response).toEqual(cachedResponse);
    });

    it('should handle errors gracefully', async () => {
      const { SearchIntegration } = await import('../integrations/searchIntegration.js');
      SearchIntegration.search.mockRejectedValue(new Error('Search failed'));
      
      const input = 'I need to find a shelter near me';
      const response = await HybridResponseHandler.getResponse(input, {}, 'web');
      
      // Should fallback to AI response (which is a fallback, so success: false)
      expect(response.success).toBe(false);
      expect(response.source).toBe('fallback');
    });
  });

  describe('extractLocation', () => {
    it('should extract location from context first', () => {
      const input = 'I need help';
      const context = { location: 'Austin, TX' };
      
      const location = HybridResponseHandler.extractLocation(input, context);
      
      expect(location).toBe('Austin, TX');
    });

    it('should extract location from query patterns', () => {
      const queries = [
        { input: 'I need shelter in Austin, TX', expected: 'Austin, TX' },
        { input: 'Find shelter near Dallas', expected: 'Dallas' },
        { input: 'Looking for help at Houston', expected: 'Houston' }
      ];
      
      queries.forEach(({ input, expected }) => {
        const location = HybridResponseHandler.extractLocation(input, {});
        expect(location).toBe(expected);
      });
    });

    it('should return null when no location found', () => {
      const input = 'I need help';
      const location = HybridResponseHandler.extractLocation(input, {});
      
      expect(location).toBeNull();
    });
  });

  describe('buildShelterSearchQuery', () => {
    it('should build query with location', () => {
      const input = 'I need shelter';
      const location = 'Austin, TX';
      
      const query = HybridResponseHandler.buildShelterSearchQuery(input, location);
      
      expect(query).toContain('domestic violence shelter');
      expect(query).toContain('Austin, TX');
      expect(query).toContain('shelter name');
      expect(query).toContain('site:org OR site:gov');
    });

    it('should build query without location', () => {
      const input = 'I need shelter';
      
      const query = HybridResponseHandler.buildShelterSearchQuery(input, null);
      
      expect(query).toContain('domestic violence shelter');
      expect(query).not.toContain('Austin, TX');
    });
  });

  describe('isRelevantShelter', () => {
    it('should identify relevant shelters', () => {
      const relevantShelter = {
        title: 'Domestic Violence Shelter',
        content: 'Safe place for victims. Call 555-123-4567',
        url: 'https://shelter.org'
      };
      
      expect(HybridResponseHandler.isRelevantShelter(relevantShelter)).toBe(true);
    });

    it('should reject irrelevant results', () => {
      const irrelevantResult = {
        title: 'Weather Report',
        content: 'Today\'s weather is sunny',
        url: 'https://weather.com'
      };
      
      expect(HybridResponseHandler.isRelevantShelter(irrelevantResult)).toBe(false);
    });

    it('should handle missing data', () => {
      expect(HybridResponseHandler.isRelevantShelter(null)).toBe(false);
      expect(HybridResponseHandler.isRelevantShelter({})).toBe(false);
      expect(HybridResponseHandler.isRelevantShelter({ title: 'Test' })).toBe(false);
    });
  });

  describe('formatShelterResponse', () => {
    it('should format voice response correctly', () => {
      const searchResult = {
        results: [
          {
            title: 'Test Shelter',
            content: 'Phone: 555-123-4567',
            score: 0.8
          }
        ]
      };
      
      const response = HybridResponseHandler.formatShelterResponse(
        searchResult, 
        'I need shelter', 
        { location: 'Austin' }, 
        'voice'
      );
      
      expect(response.voiceResponse).toContain('I found 1 shelter');
      expect(response.voiceResponse).toContain('Test Shelter');
      expect(response.voiceResponse).toContain('555-123-4567');
    });

    it('should format web response correctly', () => {
      const searchResult = {
        results: [
          {
            title: 'Test Shelter',
            content: 'Phone: 555-123-4567',
            score: 0.8
          }
        ]
      };
      
      const response = HybridResponseHandler.formatShelterResponse(
        searchResult, 
        'I need shelter', 
        { location: 'Austin' }, 
        'web'
      );
      
      expect(response.webResponse).toContain('I found 1 shelter');
      expect(response.webResponse).toContain('<strong>');
      expect(response.webResponse).toContain('555-123-4567');
    });

    it('should handle empty results', () => {
      const searchResult = { results: [] };
      
      const response = HybridResponseHandler.formatShelterResponse(
        searchResult, 
        'I need shelter', 
        { location: 'Austin' }, 
        'voice'
      );
      
      expect(response.voiceResponse).toContain('I wasn\'t able to find shelters');
      expect(response.voiceResponse).toContain('1-800-799-7233');
    });
  });

  describe('formatAIResponse', () => {
    it('should format AI response correctly', () => {
      const aiResponse = 'This is a helpful AI response about legal options.';
      const context = { location: 'Austin' };
      
      const response = HybridResponseHandler.formatAIResponse(aiResponse, 'web', context);
      
      expect(response.webResponse).toBe(aiResponse);
      expect(response.voiceResponse).toBe(aiResponse);
      expect(response.smsResponse).toBeDefined();
      expect(response.conversationContext).toEqual(context);
    });
  });

  describe('utility methods', () => {
    it('should clean titles correctly', () => {
      expect(HybridResponseHandler.cleanTitle('Test Shelter (24/7)')).toBe('Test Shelter 247');
      expect(HybridResponseHandler.cleanTitle('')).toBe('');
      expect(HybridResponseHandler.cleanTitle(null)).toBe('');
    });

    it('should extract phone numbers', () => {
      expect(HybridResponseHandler.extractPhone('Call us at 555-123-4567')).toBe('555-123-4567');
      expect(HybridResponseHandler.extractPhone('Phone: 555.123.4567')).toBe('555.123.4567');
      expect(HybridResponseHandler.extractPhone('No phone here')).toBeNull();
      expect(HybridResponseHandler.extractPhone('')).toBeNull();
    });

    it('should create SMS response from AI', () => {
      const aiResponse = 'Hello! Thank you for reaching out. I can help you with legal options.';
      
      const smsResponse = HybridResponseHandler.createSMSResponseFromAI(aiResponse);
      
      expect(smsResponse).not.toContain('Hello!');
      expect(smsResponse).not.toContain('Thank you for reaching out');
      expect(smsResponse.length).toBeLessThanOrEqual(160);
    });
  });

  describe('cache management', () => {
    it('should get cached response', async () => {
      const input = 'test query';
      const { gptCache } = await import('../lib/queryCache.js');
      
      HybridResponseHandler.getCachedResponse(input);
      
      expect(gptCache.get).toHaveBeenCalledWith(input.toLowerCase().trim());
    });

    it('should cache response', async () => {
      const input = 'test query';
      const response = { success: true };
      const { gptCache } = await import('../lib/queryCache.js');
      
      HybridResponseHandler.cacheResponse(input, response);
      
      expect(gptCache.set).toHaveBeenCalledWith(
        input.toLowerCase().trim(),
        response,
        3600000
      );
    });

    it('should get cache stats', async () => {
      const { gptCache } = await import('../lib/queryCache.js');
      
      HybridResponseHandler.getCacheStats();
      
      expect(gptCache.getStats).toHaveBeenCalled();
    });
  });
}); 