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

// Mock fetch
global.fetch = vi.fn();

describe('Query Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process query through Tavily when results are good', async () => {
    // Mock intent classification
    const { getIntent, rewriteQuery } = await import('../lib/intentClassifier.js');
    getIntent.mockResolvedValue('find_shelter');
    rewriteQuery.mockReturnValue('domestic violence shelter near me');

    // Mock Tavily response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            title: 'Local Shelter',
            summary: 'Emergency shelter services',
            url: 'https://example.com'
          }
        ]
      })
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
    expect(result.response).toContain('Local Shelter');
    expect(result.response).toContain('1-800-799-7233');

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
    rewriteQuery.mockReturnValue('domestic violence shelter near me');

    // Mock Tavily response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            title: 'Unrelated Result',
            summary: 'Not relevant',
            url: 'https://example.com'
          }
        ]
      })
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
    rewriteQuery.mockReturnValue('domestic violence shelter near me');

    // Mock empty Tavily response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: []
      })
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
    rewriteQuery.mockReturnValue('domestic violence shelter near me');

    // Mock Tavily error
    global.fetch.mockResolvedValue({
      ok: false,
      statusText: 'API Error'
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
}); 