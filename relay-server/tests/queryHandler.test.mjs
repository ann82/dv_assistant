import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUserQuery } from '../lib/queryHandler.js';

// Mock dependencies
vi.mock('../lib/intentClassifier.js', () => ({
  getIntent: vi.fn(),
  rewriteQuery: vi.fn()
}));

vi.mock('../lib/relevanceScorer.js', () => ({
  rerankByRelevance: vi.fn()
}));

vi.mock('../lib/fallbackResponder.js', () => ({
  fallbackResponse: vi.fn()
}));

vi.mock('../lib/queryLogger.js', () => ({
  logQueryHandling: vi.fn()
}));

// Mock the standardized Tavily API function
vi.mock('../lib/apis.js', () => ({
  callTavilyAPI: vi.fn()
}));

describe('Query Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable for tests
    process.env.TAVILY_API_KEY = 'test-tavily-key';
  });

  it('should process query through Tavily when results are good', async () => {
    // Mock intent classification
    const { getIntent, rewriteQuery } = await import('../lib/intentClassifier.js');
    getIntent.mockResolvedValue('find_shelter');
    rewriteQuery.mockResolvedValue('domestic violence shelter near me');

    // Mock Tavily response with test data that will be filtered
    const { callTavilyAPI } = await import('../lib/apis.js');
    callTavilyAPI.mockResolvedValue({
      results: [
        {
          title: 'Local Shelter',
          summary: 'Emergency shelter services',
          url: 'https://example.com'
        }
      ]
    });

    // Mock relevance scoring
    const { rerankByRelevance } = await import('../lib/relevanceScorer.js');
    rerankByRelevance.mockResolvedValue([
      {
        title: 'Local Shelter',
        summary: 'Emergency shelter services',
        url: 'https://example.com',
        relevanceScore: 0.8
      }
    ]);

    const result = await handleUserQuery('need shelter');
    
    expect(result.source).toBe('tavily');
    // Since test data is filtered out, expect the fallback message
    expect(result.response).toContain("I'm sorry, I couldn't find any shelters");

    // Verify logging
    const { logQueryHandling } = await import('../lib/queryLogger.js');
    expect(logQueryHandling).toHaveBeenCalledWith({
      query: 'need shelter',
      intent: 'find_shelter',
      usedGPT: false,
      score: 0.8
    });
  });

  it('should use GPT fallback when Tavily results are low quality', async () => {
    // Mock intent classification
    const { getIntent, rewriteQuery } = await import('../lib/intentClassifier.js');
    getIntent.mockResolvedValue('find_shelter');
    rewriteQuery.mockResolvedValue('domestic violence shelter near me');

    // Mock Tavily response
    const { callTavilyAPI } = await import('../lib/apis.js');
    callTavilyAPI.mockResolvedValue({
      results: [
        {
          title: 'Unrelated Result',
          summary: 'Not relevant',
          url: 'https://example.com'
        }
      ]
    });

    // Mock relevance scoring with low score
    const { rerankByRelevance } = await import('../lib/relevanceScorer.js');
    rerankByRelevance.mockResolvedValue([
      {
        title: 'Unrelated Result',
        summary: 'Not relevant',
        url: 'https://example.com',
        relevanceScore: 0.3
      }
    ]);

    // Mock GPT fallback
    const { fallbackResponse } = await import('../lib/fallbackResponder.js');
    fallbackResponse.mockResolvedValue('GPT fallback response');

    const result = await handleUserQuery('need shelter');
    
    expect(result.source).toBe('gpt');
    expect(result.response).toBe('GPT fallback response');

    // Verify logging
    const { logQueryHandling } = await import('../lib/queryLogger.js');
    expect(logQueryHandling).toHaveBeenCalledWith({
      query: 'need shelter',
      intent: 'find_shelter',
      usedGPT: true,
      score: 0.3
    });
  });

  it('should use GPT fallback when Tavily returns no results', async () => {
    // Mock intent classification
    const { getIntent, rewriteQuery } = await import('../lib/intentClassifier.js');
    getIntent.mockResolvedValue('find_shelter');
    rewriteQuery.mockResolvedValue('domestic violence shelter near me');

    // Mock empty Tavily response
    const { callTavilyAPI } = await import('../lib/apis.js');
    callTavilyAPI.mockResolvedValue({
      results: []
    });

    // Mock GPT fallback
    const { fallbackResponse } = await import('../lib/fallbackResponder.js');
    fallbackResponse.mockResolvedValue('GPT fallback response');

    const result = await handleUserQuery('need shelter');
    
    expect(result.source).toBe('gpt');
    expect(result.response).toBe('GPT fallback response');

    // Verify logging
    const { logQueryHandling } = await import('../lib/queryLogger.js');
    expect(logQueryHandling).toHaveBeenCalledWith({
      query: 'need shelter',
      intent: 'find_shelter',
      usedGPT: true,
      score: 0
    });
  });

  it('should use GPT fallback on Tavily API error', async () => {
    // Mock intent classification
    const { getIntent, rewriteQuery } = await import('../lib/intentClassifier.js');
    getIntent.mockResolvedValue('find_shelter');
    rewriteQuery.mockResolvedValue('domestic violence shelter near me');

    // Mock Tavily error
    const { callTavilyAPI } = await import('../lib/apis.js');
    callTavilyAPI.mockRejectedValue(new Error('Tavily API error: API Error'));

    // Mock GPT fallback
    const { fallbackResponse } = await import('../lib/fallbackResponder.js');
    fallbackResponse.mockResolvedValue('GPT fallback response');

    const result = await handleUserQuery('need shelter');
    
    expect(result.source).toBe('gpt');
    expect(result.response).toBe('GPT fallback response');

    // Verify logging
    const { logQueryHandling } = await import('../lib/queryLogger.js');
    expect(logQueryHandling).toHaveBeenCalledWith({
      query: 'need shelter',
      intent: 'general_query',
      usedGPT: true,
      score: 0,
      error: 'Tavily API error: API Error'
    });
  });

  it('should use GPT fallback on any error', async () => {
    // Mock intent classification error
    const { getIntent } = await import('../lib/intentClassifier.js');
    getIntent.mockRejectedValue(new Error('Intent classification failed'));

    // Mock GPT fallback
    const { fallbackResponse } = await import('../lib/fallbackResponder.js');
    fallbackResponse.mockResolvedValue('GPT fallback response');

    const result = await handleUserQuery('need shelter');
    
    expect(result.source).toBe('gpt');
    expect(result.response).toBe('GPT fallback response');

    // Verify logging
    const { logQueryHandling } = await import('../lib/queryLogger.js');
    expect(logQueryHandling).toHaveBeenCalledWith({
      query: 'need shelter',
      intent: 'general_query',
      usedGPT: true,
      score: 0,
      error: 'Intent classification failed'
    });
  });

  it('should handle off-topic queries appropriately', async () => {
    // Mock intent classification
    const { getIntent, rewriteQuery } = await import('../lib/intentClassifier.js');
    getIntent.mockResolvedValue('off_topic');
    rewriteQuery.mockResolvedValue('Tell me a joke');

    // Mock GPT fallback for off-topic
    const { fallbackResponse } = await import('../lib/fallbackResponder.js');
    fallbackResponse.mockResolvedValue('I\'m here to help with domestic violence support. Please let me know if you need assistance with that.');

    const result = await handleUserQuery('Tell me a joke');
    
    expect(result.source).toBe('gpt');
    expect(result.response).toContain('domestic violence support');
  });
}); 