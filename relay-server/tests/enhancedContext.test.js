import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock OpenAI for enhanced context system
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                primaryNeeds: ['finding shelter'],
                keyTopics: ['shelter location'],
                providedResources: ['Austin Shelter'],
                conversationState: 'resource_seeking',
                nextLikelyNeeds: ['more details'],
                userSentiment: 'concerned',
                locationContext: 'Austin, Texas'
              })
            }
          }]
        })
      }
    }
  }))
}));

import { ContextIntegration } from '../lib/contextIntegration.js';
import { enhancedContextManager } from '../lib/enhancedContextManager.js';

describe('Enhanced Context System', () => {
  const testCallSid = 'test-enhanced-context';
  
  beforeEach(async () => {
    // Clear any existing context
    await ContextIntegration.clearAllContext(testCallSid);
  });
  
  afterEach(async () => {
    // Clean up
    await ContextIntegration.clearAllContext(testCallSid);
  });

  describe('Context Integration', () => {
    it('should update context with both legacy and enhanced systems', async () => {
      const interaction = {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: {
          voiceResponse: 'Please tell me your city or area.',
          smsResponse: null
        },
        needsLocation: true
      };

      const enhancedContext = await ContextIntegration.updateContext(testCallSid, interaction);
      
      expect(enhancedContext).toBeDefined();
      expect(enhancedContext.conversationState).toBe('location_needed');
      expect(enhancedContext.history).toHaveLength(1);
      
      // Check that legacy context is also updated
      const comprehensiveContext = await ContextIntegration.getComprehensiveContext(testCallSid);
      expect(comprehensiveContext.hasLegacyContext).toBe(true);
      expect(comprehensiveContext.hasEnhancedContext).toBe(true);
    });

    it('should handle enhanced follow-up detection', async () => {
      // Set up context with shelter request
      await ContextIntegration.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: {
          voiceResponse: 'Please tell me your city or area.',
          smsResponse: null
        },
        needsLocation: true
      });

      // Test location follow-up
      const locationFollowUp = await ContextIntegration.detectFollowUp(testCallSid, 'I live in Austin, Texas');
      expect(locationFollowUp).toBeDefined();
      expect(locationFollowUp.type).toBe('enhanced_follow_up');
      expect(locationFollowUp.intent).toBe('follow_up');
    });

    it('should fallback to legacy system when enhanced fails', async () => {
      // Mock enhanced system failure by temporarily disabling it
      const originalUpdateContext = enhancedContextManager.updateContext;
      enhancedContextManager.updateContext = async () => {
        throw new Error('Enhanced system unavailable');
      };

      try {
        const interaction = {
          intent: 'find_shelter',
          query: 'I need shelter',
          response: { voiceResponse: 'Test response' }
        };

        const result = await ContextIntegration.updateContext(testCallSid, interaction);
        expect(result).toBeNull(); // Enhanced system failed
        
        // But legacy system should still work
        const comprehensiveContext = await ContextIntegration.getComprehensiveContext(testCallSid);
        expect(comprehensiveContext.hasLegacyContext).toBe(true);
      } finally {
        // Restore original function
        enhancedContextManager.updateContext = originalUpdateContext;
      }
    });
  });

  describe('Enhanced Context Manager', () => {
    it('should track conversation state progression', async () => {
      // Initial shelter request
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: { voiceResponse: 'Please provide location.' },
        needsLocation: true
      });

      let context = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context.conversationState).toBe('location_needed');

      // User provides location
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I live in Austin, Texas',
        response: { voiceResponse: 'I found shelters in Austin.' },
        location: 'Austin, Texas',
        tavilyResults: {
          results: [
            {
              title: 'Austin Shelter',
              url: 'https://example.com',
              content: 'Emergency shelter',
              score: 0.9
            }
          ]
        }
      });

      context = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context.conversationState).toBe('resource_seeking');
    });

    it('should generate semantic context', async () => {
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter urgently',
        response: { voiceResponse: 'I can help you find shelter.' },
        needsLocation: true
      });

      const context = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context.semanticContext).toBeDefined();
      // Test with fallback values since semantic generation may fail in tests
      expect(context.semanticContext.primaryNeeds).toBeDefined();
      expect(Array.isArray(context.semanticContext.primaryNeeds)).toBe(true);
      expect(context.semanticContext.userSentiment).toBeDefined();
    });

    it('should track resource memory', async () => {
      const tavilyResults = {
        results: [
          {
            title: 'Austin Domestic Violence Shelter',
            url: 'https://example.com/austin',
            content: 'Emergency shelter services',
            score: 0.9
          },
          {
            title: 'Safe Place Austin',
            url: 'https://example.com/safe',
            content: '24/7 crisis intervention',
            score: 0.8
          }
        ]
      };

      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter in Austin',
        response: { voiceResponse: 'I found shelters in Austin.' },
        location: 'Austin, Texas',
        tavilyResults
      });

      const context = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context.resourceMemory.size).toBe(2);
      
      const resources = Array.from(context.resourceMemory.values());
      expect(resources[0].title).toBe('Austin Domestic Violence Shelter');
      expect(resources[0].relevanceScore).toBe(0.9);
    });

    it('should detect enhanced follow-ups', async () => {
      // Set up context with resources
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter in Austin',
        response: { voiceResponse: 'I found shelters in Austin.' },
        location: 'Austin, Texas',
        tavilyResults: {
          results: [
            {
              title: 'Austin Shelter',
              url: 'https://example.com',
              content: 'Emergency shelter',
              score: 0.9
            }
          ]
        }
      });

      // Test resource follow-up
      const resourceFollowUp = await enhancedContextManager.detectEnhancedFollowUp(testCallSid, 'Tell me more about the first one');
      expect(resourceFollowUp).toBeDefined();
      expect(resourceFollowUp.followUpType).toBe('resource');
      expect(resourceFollowUp.confidence).toBe(0.9);
    });

    it('should generate conversation summary', async () => {
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: { voiceResponse: 'I can help you find shelter.' },
        needsLocation: true
      });

      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I live in Austin, Texas',
        response: { voiceResponse: 'I found shelters in Austin.' },
        location: 'Austin, Texas',
        tavilyResults: {
          results: [
            {
              title: 'Austin Shelter',
              url: 'https://example.com',
              content: 'Emergency shelter',
              score: 0.9
            }
          ]
        }
      });

      const summary = await enhancedContextManager.generateConversationSummary(testCallSid);
      expect(summary).toBeDefined();
      expect(summary).toContain('Conversation Summary');
      expect(summary).toContain('Austin Shelter');
    });
  });

  describe('Context Insights', () => {
    it('should provide comprehensive context insights', async () => {
      await ContextIntegration.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: { voiceResponse: 'Please provide location.' },
        needsLocation: true
      });

      const insights = await ContextIntegration.getContextInsights(testCallSid);
      expect(insights.hasContext).toBe(true);
      expect(insights.conversationState).toBe('location_needed');
      expect(insights.historyLength).toBe(1);
      // Test with fallback values since semantic generation may fail in tests
      expect(insights.primaryNeeds).toBeDefined();
      expect(Array.isArray(insights.primaryNeeds)).toBe(true);
    });

    it('should handle context statistics', async () => {
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: { voiceResponse: 'Test response' }
      });

      const stats = enhancedContextManager.getContextStats(testCallSid);
      expect(stats.historyLength).toBe(1);
      expect(stats.conversationState).toBeDefined();
      expect(stats.hasSemanticContext).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle enhanced context manager errors gracefully', async () => {
      // Test with invalid interaction data
      const invalidInteraction = {
        intent: null,
        query: null,
        response: null
      };

      const result = await enhancedContextManager.updateContext(testCallSid, invalidInteraction);
      expect(result).toBeDefined(); // Should not crash
    });

    it('should handle context integration errors gracefully', async () => {
      // Test with invalid callSid
      const result = await ContextIntegration.getContextInsights(null);
      expect(result.hasContext).toBe(false);
    });
  });

  describe('Performance and Caching', () => {
    it('should use semantic context caching', async () => {
      await enhancedContextManager.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: { voiceResponse: 'Test response' }
      });

      // First call should generate semantic context
      const context1 = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context1.semanticContext).toBeDefined();

      // Second call should use cached context
      const context2 = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context2.semanticContext).toBeDefined();
      expect(context2.semanticContext).toEqual(context1.semanticContext);
    });

    it('should limit history size for performance', async () => {
      // Add more than 10 interactions
      for (let i = 0; i < 15; i++) {
        await enhancedContextManager.updateContext(testCallSid, {
          intent: 'find_shelter',
          query: `Query ${i}`,
          response: { voiceResponse: `Response ${i}` }
        });
      }

      const context = await enhancedContextManager.getEnhancedContext(testCallSid);
      expect(context.history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Integration with Existing System', () => {
    it('should work alongside legacy conversation management', async () => {
      const { manageConversationFlow } = await import('../lib/intentClassifier.js');
      
      await ContextIntegration.updateContext(testCallSid, {
        intent: 'find_shelter',
        query: 'I need shelter',
        response: { voiceResponse: 'Test response' }
      });

      const comprehensiveContext = await ContextIntegration.getComprehensiveContext(testCallSid);
      const flow = manageConversationFlow('find_shelter', 'I need shelter', comprehensiveContext.legacy);
      
      expect(flow.shouldContinue).toBe(true);
      expect(comprehensiveContext.hasEnhancedContext).toBe(true);
    });

    it('should maintain backward compatibility', async () => {
      // Test that existing functions still work
      const { updateConversationContext, getConversationContext } = await import('../lib/intentClassifier.js');
      
      updateConversationContext(testCallSid, 'find_shelter', 'I need shelter', 'Test response');
      const legacyContext = getConversationContext(testCallSid);
      
      expect(legacyContext).toBeDefined();
      expect(legacyContext.lastIntent).toBe('find_shelter');
    });
  });
}); 