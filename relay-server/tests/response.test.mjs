import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI Integration
vi.mock('../integrations/openaiIntegration.js', () => ({
  OpenAIIntegration: vi.fn().mockImplementation(() => ({
    createChatCompletion: vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Test response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }),
    createTTS: vi.fn().mockResolvedValue(Buffer.from('test audio')),
    transcribeAudio: vi.fn().mockResolvedValue('Test transcription'),
    createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
  }))
}));

// Mock Search Integration
vi.mock('../integrations/searchIntegration.js', () => ({
  SearchIntegration: {
    search: vi.fn().mockResolvedValue({
      success: true,
      data: { results: ['test result'] }
    })
  }
}));

// Mock Intent Classifier
vi.mock('../lib/intentClassifier.js', () => ({
  getIntent: vi.fn().mockResolvedValue('find_shelter')
}));

describe('ResponseGenerator', () => {
  let ResponseGenerator;
  let SearchIntegrationMock;
  let getIntentMock;

  beforeEach(async () => {
    ({ ResponseGenerator } = await import('../lib/response.js'));
    ({ SearchIntegration: SearchIntegrationMock } = await import('../integrations/searchIntegration.js'));
    ({ getIntent: getIntentMock } = await import('../lib/intentClassifier.js'));
    SearchIntegrationMock.search.mockClear();
    getIntentMock.mockClear();
    ResponseGenerator.tavilyCache.clear();
    ResponseGenerator.resetRoutingStats();
  });

  describe('Caching', () => {
    it('should cache responses', async () => {
      const input = 'test query';
      const mockResponse = { success: true, data: { results: ['test result'] } };
      SearchIntegrationMock.search.mockResolvedValue(mockResponse);
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
      const mockResponse = { success: true, data: { results: ['test result'] } };
      SearchIntegrationMock.search.mockResolvedValue(mockResponse);
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
      const mockResponse = { success: true, data: { results: ['test result'] } };
      SearchIntegrationMock.search.mockResolvedValue(mockResponse);
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
      const mockTavilyResponse = { success: true, data: { results: ['test result'] } };
      SearchIntegrationMock.search.mockResolvedValue(mockTavilyResponse);
      const startTime = Date.now();
      await ResponseGenerator.getResponse(input);
      const endTime = Date.now();
      expect(getIntentMock).toHaveBeenCalled();
      expect(SearchIntegrationMock.search).toHaveBeenCalled();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000);
    });
  });
}); 