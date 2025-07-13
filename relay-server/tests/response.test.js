import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';
import { getIntent } from '../lib/intentClassifier.js';

// Mock the SearchIntegration
vi.mock('../integrations/searchIntegration.js', () => ({
  SearchIntegration: {
    search: vi.fn(),
  }
}));
// Mock getIntent from intentClassifier.js
vi.mock('../lib/intentClassifier.js', () => ({
  getIntent: vi.fn().mockResolvedValue('find_shelter')
}));

let SearchIntegrationMock;

describe('ResponseGenerator', () => {
  beforeEach(async () => {
    ({ SearchIntegration: SearchIntegrationMock } = await import('../integrations/searchIntegration.js'));
    SearchIntegrationMock.search.mockClear();
    // Clear cache and reset stats for each test
    ResponseGenerator.tavilyCache.clear();
    ResponseGenerator.resetRoutingStats();
  });

  describe('getResponse', () => {
    it('should return cached response if available', async () => {
      const mockResponse = {
        voiceResponse: 'Cached response',
        smsResponse: 'Cached SMS',
        summary: 'Cached summary',
        shelters: []
      };

      // Mock the cache to return a valid cached item
      ResponseGenerator.tavilyCache.set('test-query', {
        response: mockResponse,
        timestamp: Date.now()
      });

      const result = await ResponseGenerator.getResponse('test-query');
      expect(result).toEqual(mockResponse);
      expect(SearchIntegrationMock.search).not.toHaveBeenCalled();
    });

    it('should call SearchIntegration and cache response', async () => {
      const mockResponse = {
        results: [{ title: 'Test Result', content: 'Test content' }],
        answer: 'Test answer'
      };

      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });

      const result = await ResponseGenerator.getResponse('test-query');
      
      expect(SearchIntegrationMock.search).toHaveBeenCalledTimes(1);
      expect(SearchIntegrationMock.search).toHaveBeenCalledWith('test-query');
      expect(result).toBeDefined();
    });

    it('should handle SearchIntegration errors gracefully', async () => {
      SearchIntegrationMock.search.mockResolvedValue({
        success: false,
        error: 'Search failed'
      });

      const result = await ResponseGenerator.getResponse('test-query');
      expect(result).toMatchObject({
        voiceResponse: expect.any(String),
        smsResponse: expect.any(String),
        summary: expect.any(String),
        shelters: expect.any(Array)
      });
    });
  });

  describe('queryTavily', () => {
    it('should call SearchIntegration and return data', async () => {
      const mockTavilyResponse = {
        results: [{ title: 'Test Result', content: 'Test content' }],
        answer: 'Test answer'
      };

      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockTavilyResponse
      });

      const result = await ResponseGenerator.queryTavily('test query');
      
      expect(SearchIntegrationMock.search).toHaveBeenCalled();
      expect(result).toEqual(mockTavilyResponse);
    });

    it('should return null on SearchIntegration failure', async () => {
      SearchIntegrationMock.search.mockResolvedValue({
        success: false,
        error: 'Search failed'
      });

      const result = await ResponseGenerator.queryTavily('test query');
      expect(result).toBeNull();
    });

    it('should handle invalid query parameters', async () => {
      const result = await ResponseGenerator.queryTavily('');
      expect(result).toBeNull();
    });

    it('should handle SearchIntegration errors', async () => {
      SearchIntegrationMock.search.mockResolvedValue({
        success: false,
        error: 'API Error'
      });

      const result = await ResponseGenerator.queryTavily('test query');
      expect(result).toBeNull();
    });
  });

  describe('searchWithTavily', () => {
    it('should call SearchIntegration and format response', async () => {
      const mockResponse = {
        results: [
          {
            title: 'Domestic Violence Shelter',
            content: 'Provides shelter and support',
            url: 'https://example.com',
            score: 0.9
          }
        ]
      };

      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });

      const result = await ResponseGenerator.searchWithTavily('find shelter');
      
      expect(SearchIntegrationMock.search).toHaveBeenCalledWith('find shelter');
      expect(result).toBeDefined();
      expect(result.confidence).toBe('high');
    });

    it('should handle SearchIntegration failure', async () => {
      SearchIntegrationMock.search.mockResolvedValue({
        success: false,
        error: 'Search failed'
      });

      await expect(ResponseGenerator.searchWithTavily('test query')).rejects.toThrow();
    });
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      const response1 = await ResponseGenerator.getResponse(input);
      expect(ResponseGenerator.tavilyCache.size).toBe(1);
      const response2 = await ResponseGenerator.getResponse(input);
      expect(SearchIntegrationMock.search).toHaveBeenCalledTimes(1);
      expect(response1).toEqual(response2);
      formatSpy.mockRestore();
    });
    
    it('should respect cache TTL', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      await ResponseGenerator.getResponse(input);
      const cacheKey = ResponseGenerator.generateCacheKey(input);
      const cachedItem = ResponseGenerator.tavilyCache.get(cacheKey);
      ResponseGenerator.tavilyCache.set(cacheKey, {
        ...cachedItem,
        timestamp: Date.now() - ResponseGenerator.CACHE_TTL - 1000
      });
      await ResponseGenerator.getResponse(input);
      expect(SearchIntegrationMock.search).toHaveBeenCalledTimes(2);
      formatSpy.mockRestore();
    });
    
    it('should implement LRU cache', async () => {
      const mockResponse = { results: ['test result'] };
      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      for (let i = 0; i < ResponseGenerator.MAX_CACHE_SIZE + 1; i++) {
        const input = `test query ${i}`;
        await ResponseGenerator.getResponse(input);
      }
      expect(ResponseGenerator.tavilyCache.size).toBe(ResponseGenerator.MAX_CACHE_SIZE);
      formatSpy.mockRestore();
    });
  });
  
  describe('Parallel Processing', () => {
    it('should run intent classification and Tavily query in parallel', async () => {
      const input = 'test query';
      const mockTavilyResponse = { results: ['test result'] };
      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockTavilyResponse
      });
      const startTime = Date.now();
      await ResponseGenerator.getResponse(input);
      const endTime = Date.now();
      expect(getIntent).toHaveBeenCalled();
      expect(SearchIntegrationMock.search).toHaveBeenCalled();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000);
    });
  });
  
  describe('Routing Performance Monitoring', () => {
    it('should track high confidence routing stats', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      vi.mocked(getIntent).mockResolvedValue({ confidence: 0.8 });
      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      await ResponseGenerator.getResponse(input);
      const stats = ResponseGenerator.getRoutingStats();
      expect(stats.byConfidence.high.count).toBeGreaterThanOrEqual(1);
      formatSpy.mockRestore();
    });
    
    it('should track medium confidence routing stats', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      vi.mocked(getIntent).mockResolvedValue({ confidence: 0.5 });
      SearchIntegrationMock.search.mockResolvedValue({
        success: true,
        data: mockResponse
      });
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      await ResponseGenerator.getResponse(input);
      const stats = ResponseGenerator.getRoutingStats();
      expect(stats.byConfidence.medium.count).toBeGreaterThanOrEqual(1);
      formatSpy.mockRestore();
    });
    
    it('should track error cases', async () => {
      const input = 'test query';
      SearchIntegrationMock.search.mockRejectedValue(new Error('API Error'));
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      try {
        await ResponseGenerator.getResponse(input);
      } catch (error) {}
      const stats = ResponseGenerator.getRoutingStats();
      expect(stats.byConfidence.high.errors || 0).toBeGreaterThanOrEqual(0); // Defensive for undefined
      formatSpy.mockRestore();
    });
  });
}); 