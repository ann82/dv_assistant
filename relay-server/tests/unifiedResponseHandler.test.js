import { describe, it, expect, vi } from 'vitest';

// Remove all top-level imports of UnifiedResponseHandler and handler/config modules

// Helper: default mocks for config, logger, refactoringConfig, response, simplified, hybrid
const defaultMocks = () => {
  vi.doMock('../lib/config.js', () => ({
    config: {
      GPT35_MODEL: 'gpt-3.5-turbo',
      OPENAI_API_KEY: 'test-key'
    }
  }));
  vi.doMock('../lib/logger.js', () => ({
    default: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
  }));
  vi.doMock('../lib/refactoringConfig.js', () => ({
    getActiveHandler: vi.fn().mockReturnValue('hybrid'),
    getHandlerClassName: vi.fn().mockReturnValue('HybridResponseHandler'),
    getHandlerImportPath: vi.fn().mockReturnValue('./hybridResponseHandler.js'),
    isFeatureEnabled: vi.fn().mockReturnValue(true)
  }));
  vi.doMock('../lib/response.js', () => ({
    ResponseGenerator: {
      getResponse: vi.fn().mockResolvedValue({
        success: true,
        source: 'legacy',
        voiceResponse: 'Legacy response',
        webResponse: 'Legacy response'
      }),
      getCacheStats: vi.fn().mockReturnValue({ size: 10, hits: 5, misses: 5 })
    }
  }));
  vi.doMock('../lib/simplifiedResponseHandler.js', () => ({
    SimplifiedResponseHandler: {
      getResponse: vi.fn().mockResolvedValue({
        success: true,
        source: 'ai_simplified',
        voiceResponse: 'Simplified response',
        webResponse: 'Simplified response'
      }),
      getCacheStats: vi.fn().mockReturnValue({ size: 5, hits: 2, misses: 3 })
    }
  }));
  vi.doMock('../lib/hybridResponseHandler.js', () => ({
    HybridResponseHandler: {
      getResponse: vi.fn().mockResolvedValue({
        success: true,
        source: 'tavily_hybrid',
        voiceResponse: 'Hybrid response',
        webResponse: 'Hybrid response'
      }),
      getCacheStats: vi.fn().mockReturnValue({ size: 8, hits: 4, misses: 4 })
    }
  }));
};

describe('UnifiedResponseHandler', () => {
  it('should route to hybrid handler by default', async () => {
    vi.resetModules();
    defaultMocks();
    const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
    const { HybridResponseHandler } = await import('../lib/hybridResponseHandler.js');
    const input = 'I need help finding a shelter';
    const context = { location: 'Austin, TX' };
    const response = await UnifiedResponseHandler.getResponse(input, context, 'web');
    expect(HybridResponseHandler.getResponse).toHaveBeenCalledWith(input, context, 'web', {});
    expect(response.success).toBe(true);
    expect(response.source).toBe('tavily_hybrid');
    expect(response.unifiedMetadata.activeHandler).toBe('hybrid');
    vi.resetModules();
  });

  it('should route to simplified handler when configured', async () => {
    vi.resetModules();
    defaultMocks();
    vi.doMock('../lib/refactoringConfig.js', () => ({
      getActiveHandler: vi.fn().mockReturnValue('simplified'),
      getHandlerClassName: vi.fn().mockReturnValue('SimplifiedResponseHandler'),
      getHandlerImportPath: vi.fn().mockReturnValue('./simplifiedResponseHandler.js'),
      isFeatureEnabled: vi.fn().mockReturnValue(true)
    }));
    const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
    const { SimplifiedResponseHandler } = await import('../lib/simplifiedResponseHandler.js');
    const input = 'I need help finding a shelter';
    const context = { location: 'Austin, TX' };
    const response = await UnifiedResponseHandler.getResponse(input, context, 'web');
    expect(SimplifiedResponseHandler.getResponse).toHaveBeenCalledWith(input, context, 'web', {});
    expect(response.success).toBe(true);
    expect(response.source).toBe('ai_simplified');
    expect(response.unifiedMetadata.activeHandler).toBe('simplified');
    vi.resetModules();
  });

  it('should route to legacy handler when configured', async () => {
    vi.resetModules();
    defaultMocks();
    vi.doMock('../lib/refactoringConfig.js', () => ({
      getActiveHandler: vi.fn().mockReturnValue('legacy'),
      getHandlerClassName: vi.fn().mockReturnValue('ResponseGenerator'),
      getHandlerImportPath: vi.fn().mockReturnValue('./response.js'),
      isFeatureEnabled: vi.fn().mockReturnValue(true)
    }));
    const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
    const { ResponseGenerator } = await import('../lib/response.js');
    const input = 'I need help finding a shelter';
    const context = { location: 'Austin, TX' };
    const options = { maxResults: 5, voice: 'nova' };
    const response = await UnifiedResponseHandler.getResponse(input, context, 'web', options);
    expect(ResponseGenerator.getResponse).toHaveBeenCalledWith(
      input, context, 'web', 5, 'nova', undefined, undefined
    );
    expect(response.success).toBe(true);
    expect(response.source).toBe('legacy');
    expect(response.unifiedMetadata.activeHandler).toBe('legacy');
    vi.resetModules();
  });

  it('should add unified metadata to response', async () => {
    vi.resetModules();
    defaultMocks();
    const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
    const input = 'I need help finding a shelter';
    const context = { location: 'Austin, TX' };
    const response = await UnifiedResponseHandler.getResponse(input, context, 'web');
    expect(response.unifiedMetadata).toBeDefined();
    expect(response.unifiedMetadata.activeHandler).toBe('hybrid');
    expect(response.unifiedMetadata.responseTime).toMatch(/\d+ms/);
    expect(response.unifiedMetadata.timestamp).toBeDefined();
    expect(response.unifiedMetadata.refactoringPhase).toBeDefined();
    expect(response.unifiedMetadata.featureFlags).toBeDefined();
    vi.resetModules();
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      vi.resetModules();
      defaultMocks();
      vi.doMock('../lib/hybridResponseHandler.js', () => ({
        HybridResponseHandler: {
          getResponse: vi.fn().mockImplementation(() => { throw new Error('Handler failed'); }),
          getCacheStats: vi.fn().mockReturnValue({ size: 8, hits: 4, misses: 4 })
        }
      }));
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const input = 'I need help finding a shelter';
      const response = await UnifiedResponseHandler.getResponse(input, {}, 'web');
      expect(response.success).toBe(false);
      expect(response.source).toBe('unified_fallback');
      expect(response.voiceResponse).toContain('1-800-799-7233');
      vi.resetModules();
    });
  });

  describe('getRefactoringPhase', () => {
    it('should return correct phase for simplified handler', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { getActiveHandler, isFeatureEnabled } = await import('../lib/refactoringConfig.js');
      
      getActiveHandler.mockReturnValue('simplified');
      isFeatureEnabled.mockImplementation((flag) => {
        if (flag === 'SIMPLIFIED_INTENT_CLASSIFICATION') return false;
        return true;
      });
      
      const phase = UnifiedResponseHandler.getRefactoringPhase();
      expect(phase).toBe('PHASE_1_PROOF_OF_CONCEPT');
      vi.resetModules();
    });

    it('should return correct phase for hybrid handler', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { getActiveHandler } = await import('../lib/refactoringConfig.js');
      getActiveHandler.mockReturnValue('hybrid');
      
      const phase = UnifiedResponseHandler.getRefactoringPhase();
      expect(phase).toBe('PHASE_2_GRADUAL_MIGRATION');
      vi.resetModules();
    });

    it('should return correct phase for simplified with full features', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { getActiveHandler, isFeatureEnabled } = await import('../lib/refactoringConfig.js');
      
      getActiveHandler.mockReturnValue('simplified');
      isFeatureEnabled.mockImplementation((flag) => {
        if (flag === 'SIMPLIFIED_INTENT_CLASSIFICATION') return true;
        return true;
      });
      
      const phase = UnifiedResponseHandler.getRefactoringPhase();
      expect(phase).toBe('PHASE_3_FULL_SIMPLIFICATION');
      vi.resetModules();
    });
  });

  describe('getActiveFeatureFlags', () => {
    it('should return active feature flags', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { isFeatureEnabled } = await import('../lib/refactoringConfig.js');
      isFeatureEnabled.mockImplementation((flag) => {
        const flags = {
          SIMPLIFIED_INTENT_CLASSIFICATION: true,
          SIMPLIFIED_QUERY_REWRITING: false,
          SIMPLIFIED_RESPONSE_ROUTING: true,
          SIMPLIFIED_CONVERSATION_CONTEXT: true,
          EMERGENCY_DETECTION: true,
          CACHING_ENABLED: false,
          FALLBACK_ENABLED: true
        };
        return flags[flag] || false;
      });
      
      const flags = UnifiedResponseHandler.getActiveFeatureFlags();
      
      expect(flags.SIMPLIFIED_INTENT_CLASSIFICATION).toBe(true);
      expect(flags.SIMPLIFIED_QUERY_REWRITING).toBe(false);
      expect(flags.SIMPLIFIED_RESPONSE_ROUTING).toBe(true);
      expect(flags.CACHING_ENABLED).toBe(false);
      vi.resetModules();
    });
  });

  describe('getHandlerStats', () => {
    it('should return handler statistics', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { getActiveHandler, getHandlerClassName, getHandlerImportPath } = await import('../lib/refactoringConfig.js');
      
      getActiveHandler.mockReturnValue('hybrid');
      getHandlerClassName.mockReturnValue('HybridResponseHandler');
      getHandlerImportPath.mockReturnValue('./hybridResponseHandler.js');
      
      const stats = UnifiedResponseHandler.getHandlerStats();
      
      expect(stats.activeHandler).toBe('hybrid');
      expect(stats.handlerClassName).toBe('HybridResponseHandler');
      expect(stats.handlerImportPath).toBe('./hybridResponseHandler.js');
      expect(stats.availableHandlers).toEqual(['legacy', 'simplified', 'hybrid']);
      vi.resetModules();
    });
  });

  describe('getCacheStats', () => {
    it('should return combined cache statistics', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const stats = UnifiedResponseHandler.getCacheStats();
      
      expect(stats.legacy).toEqual({ size: 10, hits: 5, misses: 5 });
      expect(stats.simplified).toEqual({ size: 5, hits: 2, misses: 3 });
      expect(stats.hybrid).toEqual({ size: 8, hits: 4, misses: 4 });
      vi.resetModules();
    });

    it('should handle missing cache stats methods', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { ResponseGenerator } = await import('../lib/response.js');
      ResponseGenerator.getCacheStats = undefined;
      
      const stats = UnifiedResponseHandler.getCacheStats();
      
      expect(stats.legacy).toBeNull();
      expect(stats.simplified).toBeDefined();
      expect(stats.hybrid).toBeDefined();
      vi.resetModules();
    });
  });

  describe('testAllHandlers', () => {
    it('should test all handlers with same input', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const input = 'I need help finding a shelter';
      const context = { location: 'Austin, TX' };
      
      const results = await UnifiedResponseHandler.testAllHandlers(input, context, 'web');
      
      expect(results.input).toBe(input);
      expect(results.context).toEqual(context);
      expect(results.requestType).toBe('web');
      expect(results.timestamp).toBeDefined();
      expect(results.handlers.legacy.success).toBe(true);
      expect(results.handlers.simplified.success).toBe(true);
      expect(results.handlers.hybrid.success).toBe(true);
      vi.resetModules();
    });

    it('should handle handler failures gracefully', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const { HybridResponseHandler } = await import('../lib/hybridResponseHandler.js');
      HybridResponseHandler.getResponse.mockRejectedValue(new Error('Hybrid failed'));
      
      const input = 'I need help finding a shelter';
      const results = await UnifiedResponseHandler.testAllHandlers(input, {}, 'web');
      
      expect(results.handlers.legacy.success).toBe(true);
      expect(results.handlers.simplified.success).toBe(true);
      expect(results.handlers.hybrid.success).toBe(false);
      expect(results.handlers.hybrid.error).toBe('Hybrid failed');
      vi.resetModules();
    });
  });

  describe('compareResponseQuality', () => {
    it('should compare response quality between handlers', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const testResults = {
        input: 'I need help finding a shelter',
        handlers: {
          legacy: {
            success: true,
            responseTime: 1500,
            response: {
              voiceResponse: 'Legacy response',
              webResponse: 'Legacy response',
              smsResponse: 'Legacy SMS'
            }
          },
          simplified: {
            success: true,
            responseTime: 800,
            response: {
              voiceResponse: 'Simplified response',
              webResponse: 'Simplified response',
              smsResponse: 'Simplified SMS'
            }
          },
          hybrid: {
            success: false,
            responseTime: 0,
            error: 'Failed'
          }
        }
      };
      
      const comparison = await UnifiedResponseHandler.compareResponseQuality(testResults);
      
      expect(comparison.input).toBe(testResults.input);
      expect(comparison.metrics.responseTime.legacy).toBe(1500);
      expect(comparison.metrics.responseTime.simplified).toBe(800);
      expect(comparison.metrics.responseTime.hybrid).toBeUndefined();
      expect(comparison.metrics.fastestHandler).toBe('simplified');
      expect(comparison.metrics.successRate.legacy).toBe(true);
      expect(comparison.metrics.successRate.hybrid).toBe(false);
      vi.resetModules();
    });
  });

  describe('getPerformanceRecommendations', () => {
    it('should provide performance recommendations', async () => {
      vi.resetModules();
      defaultMocks();
      const { UnifiedResponseHandler } = await import('../lib/unifiedResponseHandler.js');
      const testResults = {
        handlers: {
          legacy: {
            success: true,
            responseTime: 6000, // Slow
            response: {}
          },
          simplified: {
            success: true,
            responseTime: 800, // Fast
            response: {}
          },
          hybrid: {
            success: false,
            responseTime: 0,
            error: 'Failed'
          }
        }
      };
      
      const recommendations = await UnifiedResponseHandler.getPerformanceRecommendations(testResults);
      
      expect(recommendations.recommendations).toHaveLength(3);
      
      const performanceRec = recommendations.recommendations.find(r => r.type === 'performance');
      expect(performanceRec.handler).toBe('legacy');
      expect(performanceRec.issue).toBe('Slow response time');
      
      const reliabilityRec = recommendations.recommendations.find(r => r.type === 'reliability');
      expect(reliabilityRec.handlers).toContain('hybrid');
      
      const optimizationRec = recommendations.recommendations.find(r => r.type === 'optimization');
      expect(optimizationRec.handler).toBe('simplified');
      vi.resetModules();
    });
  });
}); 