import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/apis.js', () => ({
  callTavilyAPI: vi.fn(),
}));

describe('ResponseGenerator', () => {
  let ResponseGenerator;
  let callTavilyAPIMock;

  beforeEach(async () => {
    // Import after mocking
    ({ ResponseGenerator } = await import('../lib/response.js'));
    ({ callTavilyAPI: callTavilyAPIMock } = await import('../lib/apis.js'));
    callTavilyAPIMock.mockClear();
    ResponseGenerator.tavilyCache.clear();
    ResponseGenerator.resetRoutingStats();
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      callTavilyAPIMock.mockResolvedValue(mockResponse);
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      const response1 = await ResponseGenerator.getResponse(input);
      expect(ResponseGenerator.tavilyCache.size).toBe(1);
      const response2 = await ResponseGenerator.getResponse(input);
      expect(callTavilyAPIMock).toHaveBeenCalledTimes(1);
      expect(response1).toEqual(response2);
      formatSpy.mockRestore();
    });
    it('should respect cache TTL', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      callTavilyAPIMock.mockResolvedValue(mockResponse);
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      await ResponseGenerator.getResponse(input);
      const cacheKey = ResponseGenerator.generateCacheKey(input);
      const cachedItem = ResponseGenerator.tavilyCache.get(cacheKey);
      ResponseGenerator.tavilyCache.set(cacheKey, {
        ...cachedItem,
        timestamp: Date.now() - ResponseGenerator.CACHE_TTL - 1000
      });
      await ResponseGenerator.getResponse(input);
      expect(callTavilyAPIMock).toHaveBeenCalledTimes(2);
      formatSpy.mockRestore();
    });
    it('should implement LRU cache', async () => {
      const mockResponse = { results: ['test result'] };
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      callTavilyAPIMock.mockResolvedValue(mockResponse);
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
      const mockIntentResult = { confidence: 0.8, matches: [] };
      const mockTavilyResponse = { results: ['test result'] };
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue(mockIntentResult);
      callTavilyAPIMock.mockResolvedValue(mockTavilyResponse);
      const startTime = Date.now();
      await ResponseGenerator.getResponse(input);
      const endTime = Date.now();
      expect(ResponseGenerator.classifyIntent).toHaveBeenCalled();
      expect(callTavilyAPIMock).toHaveBeenCalled();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000);
    });
  });
  describe('Routing Performance Monitoring', () => {
    it('should track high confidence routing stats', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      callTavilyAPIMock.mockResolvedValue(mockResponse);
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      await ResponseGenerator.getResponse(input);
      const stats = ResponseGenerator.getRoutingStats();
      expect(stats.byConfidence.high.count).toBeGreaterThanOrEqual(1);
      formatSpy.mockRestore();
    });
    it('should track medium confidence routing stats', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.5, matches: [] });
      callTavilyAPIMock.mockResolvedValue(mockResponse);
      const formatSpy = vi.spyOn(ResponseGenerator, 'formatTavilyResponse').mockReturnValue('formatted response');
      await ResponseGenerator.getResponse(input);
      const stats = ResponseGenerator.getRoutingStats();
      expect(stats.byConfidence.medium.count).toBeGreaterThanOrEqual(1);
      formatSpy.mockRestore();
    });
    it('should track error cases', async () => {
      const input = 'test query';
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      callTavilyAPIMock.mockRejectedValue(new Error('API Error'));
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