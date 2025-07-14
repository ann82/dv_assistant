import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TtsService } from '../services/tts/TtsService.js';
import { SearchService } from '../services/search/SearchService.js';
import { ContextService } from '../services/context/ContextService.js';
import { ServiceManager } from '../services/ServiceManager.js';
import { TTSIntegration } from '../integrations/ttsIntegration.js';

// Mock TTSIntegration
vi.mock('../integrations/ttsIntegration.js', () => ({
  TTSIntegration: {
    generateTTS: vi.fn(),
    isHealthy: vi.fn().mockResolvedValue(true)
  }
}));

// Mock fetch for SearchService
global.fetch = vi.fn();

describe('Phase 2: Service Layer Refactoring', () => {
  
  describe('TtsService', () => {
    let ttsService;
    
    beforeEach(() => {
      ttsService = new TtsService({
        enabled: true,
        timeout: 5000,
        cache: { enabled: false }
      });
    });
    
    afterEach(async () => {
      if (ttsService) {
        await ttsService.cleanup();
      }
    });
    
    it('should initialize TTS service', async () => {
      await ttsService.initialize();
      expect(ttsService.config.enabled).toBe(true);
    });
    
    it('should generate speech from text', async () => {
      await ttsService.initialize();
      
      // Mock TTSIntegration response
      TTSIntegration.generateTTS.mockResolvedValueOnce({
        audioUrl: '/audio/test.mp3',
        provider: 'stub',
        text: 'Hello, world!'
      });
      
      const result = await ttsService.generateSpeech('Hello, world!');
      
      expect(result.success).toBe(true);
      expect(result.data.audioUrl).toBeDefined();
      expect(result.data.provider).toBe('stub');
      expect(TTSIntegration.generateTTS).toHaveBeenCalledWith('Hello, world!', expect.any(Object), undefined);
    });
    
    it('should handle empty text', async () => {
      await ttsService.initialize();
      
      const result = await ttsService.generateSpeech('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Text is required');
    });
    
    it('should check health status', async () => {
      await ttsService.initialize();
      
      const health = await ttsService.isHealthy();
      expect(health).toBe(true);
      expect(TTSIntegration.isHealthy).toHaveBeenCalled();
    });
    
    it('should get service status', () => {
      const status = ttsService.getStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.openai.available).toBe(true); // Now using TTSIntegration
      expect(status.polly.available).toBe(false);
    });
  });
  
  describe('SearchService', () => {
    let searchService;
    
    beforeEach(() => {
      searchService = new SearchService({
        apiKey: 'test-key',
        maxResults: 5,
        searchDepth: 'basic',
        cacheEnabled: false
      });
    });
    
    afterEach(async () => {
      if (searchService) {
        await searchService.cleanup();
      }
    });
    
    it('should initialize search service', async () => {
      await searchService.initialize();
      expect(searchService.config.apiKey).toBe('test-key');
    });
    
    it('should perform search', async () => {
      await searchService.initialize();
      
      // Mock successful Tavily response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            {
              title: 'Test Result',
              url: 'https://example.com',
              content: 'This is a test result with enough content to pass the length filter. It is over 50 characters long.',
              source: 'test'
            }
          ]
        })
      });
      
      const result = await searchService.search('domestic violence shelters');
      
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].title).toBe('Test Result');
    });
    
    it('should handle search errors', async () => {
      await searchService.initialize();
      
      // Mock failed Tavily response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ message: 'Invalid API key' })
      });
      
      const result = await searchService.search('test query');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tavily API error');
    });
    
    it('should build DV search queries', () => {
      const query = searchService.buildDvSearchQuery('San Francisco', {
        pets: true,
        children: true
      });
      
      expect(query).toContain('domestic violence');
      expect(query).toContain('San Francisco');
      expect(query).toContain('pet friendly');
      expect(query).toContain('children families');
    });
    
    it('should check health status', async () => {
      await searchService.initialize();
      
      // Mock health check response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      const health = await searchService.isHealthy();
      expect(health).toBe(true);
    });
  });
  
  describe('ContextService', () => {
    let contextService;
    const testCallSid = 'test-call-sid-123';
    
    beforeEach(() => {
      contextService = new ContextService({
        conversationTimeout: 5 * 60 * 1000, // 5 minutes for tests
        maxHistoryItems: 5
      });
    });
    
    afterEach(async () => {
      if (contextService) {
        await contextService.clearConversationContext(testCallSid);
        await contextService.cleanup();
      }
    });
    
    it('should initialize context service', async () => {
      await contextService.initialize();
      expect(contextService.storageDir).toBe('./cache/contexts');
    });
    
    it('should create and retrieve conversation context', async () => {
      await contextService.initialize();
      
      const update = {
        location: 'San Francisco, CA',
        familyConcerns: 'Has children and pets',
        interaction: {
          query: 'I need help finding a shelter',
          intent: 'find_shelter',
          response: 'I can help you find shelters in your area.'
        }
      };
      
      const context = await contextService.updateConversationContext(testCallSid, update);
      
      expect(context.success).toBe(true);
      expect(context.data.location).toBe('San Francisco, CA');
      expect(context.data.familyConcerns).toBe('Has children and pets');
      expect(context.data.history).toHaveLength(1);
    });
    
    it('should retrieve existing context', async () => {
      await contextService.initialize();
      
      // First, create context
      await contextService.updateConversationContext(testCallSid, {
        location: 'San Francisco, CA'
      });
      
      // Then retrieve it
      const context = await contextService.getConversationContext(testCallSid);
      
      expect(context).toBeDefined();
      expect(context.location).toBe('San Francisco, CA');
    });
    
    it('should build context summary', async () => {
      await contextService.initialize();
      
      const updateResult = await contextService.updateConversationContext(testCallSid, {
        location: 'San Francisco, CA',
        familyConcerns: 'Has children',
        interaction: {
          query: 'I need help',
          intent: 'find_shelter'
        }
      });
      const context = updateResult.data;
      expect(context).toBeDefined();
      
      const summary = await contextService.buildContextSummary(testCallSid);
      
      expect(summary.hasContext).toBe(true);
      expect(summary.contextParts).toBeGreaterThan(0);
      expect(summary.location).toBe('San Francisco, CA');
    });
    
    it('should build instructions with context', async () => {
      await contextService.initialize();
      
      const updateResult = await contextService.updateConversationContext(testCallSid, {
        location: 'San Francisco, CA',
        familyConcerns: 'Has children'
      });
      const context = updateResult.data;
      expect(context).toBeDefined();
      
      const baseInstructions = 'You are a helpful assistant.';
      const enhancedInstructions = await contextService.buildInstructionsWithContext(
        testCallSid, 
        baseInstructions
      );
      
      expect(enhancedInstructions).toContain(baseInstructions);
      expect(enhancedInstructions).toContain('San Francisco');
      expect(enhancedInstructions).toContain('children');
    });
    
    it('should clear context', async () => {
      await contextService.initialize();
      
      // Create context
      await contextService.updateConversationContext(testCallSid, {
        location: 'San Francisco, CA'
      });
      
      // Clear it
      await contextService.clearConversationContext(testCallSid);
      
      // Verify it's gone
      const context = await contextService.getConversationContext(testCallSid);
      expect(context).toBeNull();
    });
    
    it('should handle expired contexts', async () => {
      await contextService.initialize();
      
      // Create context with old timestamp
      const oldContext = {
        callSid: testCallSid,
        timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        history: [],
        location: 'San Francisco, CA'
      };
      
      contextService.contexts.set(testCallSid, oldContext);
      
      // Try to retrieve it
      const context = await contextService.getConversationContext(testCallSid);
      expect(context).toBeNull();
    });
    
    it('should get context statistics', () => {
      const stats = contextService.getContextStats();
      
      expect(stats.totalContexts).toBeDefined();
      expect(stats.activeContexts).toBeDefined();
      expect(stats.expiredContexts).toBeDefined();
    });
  });
  
  describe('ServiceManager', () => {
    let serviceManager;
    
    beforeEach(() => {
      serviceManager = new ServiceManager();
    });
    
    afterEach(async () => {
      if (serviceManager) {
        await serviceManager.cleanup();
      }
    });
    
    it('should initialize all services', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      expect(serviceManager.initialized).toBe(true);
      expect(serviceManager.services.size).toBe(4);
      expect(serviceManager.services.has('context')).toBe(true);
      expect(serviceManager.services.has('search')).toBe(true);
      expect(serviceManager.services.has('tts')).toBe(true);
      expect(serviceManager.services.has('audio')).toBe(true);
    });
    
    it('should get service by name', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      const contextService = serviceManager.getService('context');
      const searchService = serviceManager.getService('search');
      const ttsService = serviceManager.getService('tts');
      const audioService = serviceManager.getService('audio');
      
      expect(contextService).toBeDefined();
      expect(searchService).toBeDefined();
      expect(ttsService).toBeDefined();
      expect(audioService).toBeDefined();
    });
    
    it('should throw error for non-existent service', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      expect(() => {
        serviceManager.getService('non-existent');
      }).toThrow('Service \'non-existent\' not found');
    });
    
    it('should throw error when not initialized', () => {
      expect(() => {
        serviceManager.getService('context');
      }).toThrow('ServiceManager not initialized');
    });
    
    it('should get all services', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      const allServices = serviceManager.getAllServices();
      
      expect(allServices.size).toBe(4);
      expect(allServices.has('context')).toBe(true);
      expect(allServices.has('search')).toBe(true);
      expect(allServices.has('tts')).toBe(true);
      expect(allServices.has('audio')).toBe(true);
    });
    
    it('should check health status', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      const health = await serviceManager.isHealthy();
      expect(typeof health).toBe('boolean');
    });
    
    it('should get service statistics', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      const stats = serviceManager.getServiceStats();
      
      expect(stats.totalServices).toBe(4);
      expect(stats.initialized).toBe(true);
      expect(stats.services).toBeDefined();
    });
    
    it('should validate dependencies', async () => {
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
      
      const validation = serviceManager.validateDependencies();
      
      expect(validation.valid).toBe(true);
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });
  
  describe('Service Integration', () => {
    let serviceManager;
    
    beforeEach(async () => {
      serviceManager = new ServiceManager();
      
      // Mock successful service initialization
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [] })
      });
      
      await serviceManager.initialize();
    });
    
    afterEach(async () => {
      if (serviceManager) {
        await serviceManager.cleanup();
      }
    });
    
    it('should integrate all services together', async () => {
      const contextService = serviceManager.getService('context');
      const searchService = serviceManager.getService('search');
      const ttsService = serviceManager.getService('tts');
      
      // Test context service
      const testCallSid = 'integration-test-call';
      await contextService.updateConversationContext(testCallSid, {
        location: 'San Francisco, CA'
      });
      
      const context = await contextService.getConversationContext(testCallSid);
      expect(context.location).toBe('San Francisco, CA');
      
      // Test search service
      const searchResult = await searchService.search('domestic violence shelters San Francisco');
      expect(searchResult.success).toBe(true);
      
      // Mock TTSIntegration response for TTS service test
      TTSIntegration.generateTTS.mockResolvedValueOnce({
        audioUrl: '/audio/integration-test.mp3',
        provider: 'stub',
        text: 'Hello, I can help you find shelters.'
      });
      
      // Test TTS service
      const ttsResult = await ttsService.generateSpeech('Hello, I can help you find shelters.');
      expect(ttsResult.success).toBe(true);
      
      // Clean up
      await contextService.clearConversationContext(testCallSid);
    });
    
    it('should handle service dependencies correctly', async () => {
      // All services should be available
      expect(serviceManager.getService('context')).toBeDefined();
      expect(serviceManager.getService('search')).toBeDefined();
      expect(serviceManager.getService('tts')).toBeDefined();
      
      // Services should be properly initialized
      const contextService = serviceManager.getService('context');
      const searchService = serviceManager.getService('search');
      const ttsService = serviceManager.getService('tts');
      
      expect(contextService.constructor.name).toBe('ContextService');
      expect(searchService.constructor.name).toBe('SearchService');
      expect(ttsService.constructor.name).toBe('TtsService');
    });
  });
}); 