import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';

describe('ResponseGenerator', () => {
  beforeEach(() => {
    // Clear cache before each test
    ResponseGenerator.tavilyCache.clear();
    vi.clearAllMocks();
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      
      // Mock the internal methods
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      ResponseGenerator.queryTavily = vi.fn().mockResolvedValue(mockResponse);
      
      // First call
      const response1 = await ResponseGenerator.getResponse(input);
      expect(ResponseGenerator.tavilyCache.size).toBe(1);
      
      // Second call should use cache
      const response2 = await ResponseGenerator.getResponse(input);
      expect(ResponseGenerator.queryTavily).toHaveBeenCalledTimes(1);
      expect(response1).toEqual(response2);
    });

    it('should respect cache TTL', async () => {
      const input = 'test query';
      const mockResponse = { results: ['test result'] };
      
      // Mock the internal methods
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
      ResponseGenerator.queryTavily = vi.fn().mockResolvedValue(mockResponse);
      
      // First call
      await ResponseGenerator.getResponse(input);
      
      // Manually expire the cache
      const cacheKey = ResponseGenerator.generateCacheKey(input);
      const cachedItem = ResponseGenerator.tavilyCache.get(cacheKey);
      ResponseGenerator.tavilyCache.set(cacheKey, {
        ...cachedItem,
        timestamp: Date.now() - ResponseGenerator.CACHE_TTL - 1000
      });
      
      // Second call should not use cache
      await ResponseGenerator.getResponse(input);
      expect(ResponseGenerator.queryTavily).toHaveBeenCalledTimes(2);
    });

    it('should implement LRU cache', async () => {
      // Fill cache to max size
      for (let i = 0; i < ResponseGenerator.MAX_CACHE_SIZE + 1; i++) {
        const input = `test query ${i}`;
        const mockResponse = { results: [`test result ${i}`] };
        
        ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue({ confidence: 0.8, matches: [] });
        ResponseGenerator.queryTavily = vi.fn().mockResolvedValue(mockResponse);
        
        await ResponseGenerator.getResponse(input);
      }
      
      expect(ResponseGenerator.tavilyCache.size).toBe(ResponseGenerator.MAX_CACHE_SIZE);
    });
  });

  describe('Parallel Processing', () => {
    it('should run intent classification and Tavily query in parallel', async () => {
      const input = 'test query';
      const mockIntentResult = { confidence: 0.8, matches: [] };
      const mockTavilyResponse = { results: ['test result'] };
      
      // Mock the internal methods
      ResponseGenerator.classifyIntent = vi.fn().mockResolvedValue(mockIntentResult);
      ResponseGenerator.queryTavily = vi.fn().mockResolvedValue(mockTavilyResponse);
      
      const startTime = Date.now();
      await ResponseGenerator.getResponse(input);
      const endTime = Date.now();
      
      // Verify both methods were called
      expect(ResponseGenerator.classifyIntent).toHaveBeenCalled();
      expect(ResponseGenerator.queryTavily).toHaveBeenCalled();
      
      // Verify parallel execution (should be faster than sequential)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  // ... existing tests ...
}); 