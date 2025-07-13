import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimplifiedResponseHandler } from '../lib/simplifiedResponseHandler.js';

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
          content: 'This is a test AI response with helpful information about domestic violence resources.'
        }
      }]
    })
  }))
}));

vi.mock('../lib/queryCache.js', () => ({
  gptCache: {
    get: vi.fn(),
    set: vi.fn(),
    getStats: vi.fn().mockReturnValue({ size: 0, hits: 0, misses: 0 })
  }
}));

describe('SimplifiedResponseHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getResponse', () => {
    it('should generate AI response for new query', async () => {
      const input = 'I need help finding a shelter';
      const context = { location: 'Austin, TX' };
      
      const response = await SimplifiedResponseHandler.getResponse(input, context, 'web');
      
      expect(response.success).toBe(true);
      expect(response.source).toBe('ai_simplified');
      expect(response.voiceResponse).toContain('test AI response');
      expect(response.webResponse).toContain('test AI response');
      expect(response.smsResponse).toBeDefined();
    });

    it('should use cached response when available', async () => {
      const input = 'I need help finding a shelter';
      const cachedResponse = {
        success: true,
        source: 'ai_simplified',
        voiceResponse: 'Cached response',
        webResponse: 'Cached response'
      };
      
      const { gptCache } = await import('../lib/queryCache.js');
      gptCache.get.mockReturnValue(cachedResponse);
      
      const response = await SimplifiedResponseHandler.getResponse(input, {}, 'web');
      
      expect(response).toEqual(cachedResponse);
      expect(gptCache.get).toHaveBeenCalledWith(input.toLowerCase().trim());
    });

    it('should handle errors gracefully', async () => {
      const { OpenAIIntegration } = await import('../integrations/openaiIntegration.js');
      OpenAIIntegration.mockImplementation(() => ({
        createChatCompletion: vi.fn().mockRejectedValue(new Error('API Error'))
      }));
      
      const input = 'I need help';
      const response = await SimplifiedResponseHandler.getResponse(input, {}, 'web');
      
      expect(response.success).toBe(false);
      expect(response.source).toBe('fallback');
      expect(response.voiceResponse).toContain('1-800-799-7233');
    });
  });

  describe('buildConversationContext', () => {
    it('should build context from conversation data', () => {
      const context = {
        location: 'Austin, TX',
        lastQuery: 'I need shelter',
        lastIntent: 'find_shelter',
        results: [{ title: 'Test Shelter' }],
        needsLocation: false
      };
      
      const result = SimplifiedResponseHandler.buildConversationContext(context);
      
      expect(result).toContain('Location: Austin, TX');
      expect(result).toContain('Last query: "I need shelter"');
      expect(result).toContain('Last intent: find_shelter');
      expect(result).toContain('Previous results: 1 items found');
    });

    it('should handle empty context', () => {
      const result = SimplifiedResponseHandler.buildConversationContext({});
      expect(result).toBe('This is a new conversation.');
    });

    it('should handle null context', () => {
      const result = SimplifiedResponseHandler.buildConversationContext(null);
      expect(result).toBe('This is a new conversation.');
    });
  });

  describe('formatResponse', () => {
    it('should format voice response correctly', () => {
      const aiResponse = 'This is a helpful response about shelters.';
      const context = { location: 'Austin' };
      
      const response = SimplifiedResponseHandler.formatResponse(aiResponse, 'voice', context);
      
      expect(response.voiceResponse).toBe(aiResponse);
      expect(response.smsResponse).toBeDefined();
      expect(response.summary).toBeDefined();
      expect(response.conversationContext).toEqual(context);
    });

    it('should format web response correctly', () => {
      const aiResponse = 'This is a helpful response about shelters.';
      const context = { location: 'Austin' };
      
      const response = SimplifiedResponseHandler.formatResponse(aiResponse, 'web', context);
      
      expect(response.webResponse).toBe(aiResponse);
      expect(response.voiceResponse).toBe(aiResponse);
      expect(response.smsResponse).toBeDefined();
      expect(response.conversationContext).toEqual(context);
    });
  });

  describe('createSMSResponse', () => {
    it('should create SMS-friendly response', () => {
      const aiResponse = 'Hello! Thank you for reaching out. I can help you find shelters in your area. Here are some options...';
      
      const smsResponse = SimplifiedResponseHandler.createSMSResponse(aiResponse);
      
      expect(smsResponse).not.toContain('Hello!');
      expect(smsResponse).not.toContain('Thank you for reaching out');
      expect(smsResponse.length).toBeLessThanOrEqual(160);
    });

    it('should truncate long responses', () => {
      const longResponse = 'A'.repeat(200);
      
      const smsResponse = SimplifiedResponseHandler.createSMSResponse(longResponse);
      
      expect(smsResponse.length).toBeLessThanOrEqual(160);
      expect(smsResponse).toContain('...');
    });

    it('should provide fallback for empty response', () => {
      const smsResponse = SimplifiedResponseHandler.createSMSResponse('');
      
      expect(smsResponse).toContain('1-800-799-7233');
    });
  });

  describe('isEmergencyQuery', () => {
    it('should detect emergency keywords', () => {
      const emergencyQueries = [
        'I want to kill myself',
        'I have a weapon',
        'I am in immediate danger',
        'This is an emergency',
        'I am unsafe right now'
      ];
      
      emergencyQueries.forEach(query => {
        expect(SimplifiedResponseHandler.isEmergencyQuery(query)).toBe(true);
      });
    });

    it('should not flag normal queries as emergency', () => {
      const normalQueries = [
        'I need help finding a shelter',
        'What are my legal options?',
        'I need counseling services',
        'How do I recognize abuse?'
      ];
      
      normalQueries.forEach(query => {
        expect(SimplifiedResponseHandler.isEmergencyQuery(query)).toBe(false);
      });
    });

    it('should handle null/empty input', () => {
      expect(SimplifiedResponseHandler.isEmergencyQuery(null)).toBe(false);
      expect(SimplifiedResponseHandler.isEmergencyQuery('')).toBe(false);
      expect(SimplifiedResponseHandler.isEmergencyQuery(undefined)).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should get cached response', async () => {
      const input = 'test query';
      const { gptCache } = await import('../lib/queryCache.js');
      
      SimplifiedResponseHandler.getCachedResponse(input);
      
      expect(gptCache.get).toHaveBeenCalledWith(input.toLowerCase().trim());
    });

    it('should cache response', async () => {
      const input = 'test query';
      const response = { success: true };
      const { gptCache } = await import('../lib/queryCache.js');
      
      SimplifiedResponseHandler.cacheResponse(input, response);
      
      expect(gptCache.set).toHaveBeenCalledWith(
        input.toLowerCase().trim(),
        response,
        3600000
      );
    });

    it('should get cache stats', async () => {
      const { gptCache } = await import('../lib/queryCache.js');
      
      SimplifiedResponseHandler.getCacheStats();
      
      expect(gptCache.getStats).toHaveBeenCalled();
    });
  });
}); 