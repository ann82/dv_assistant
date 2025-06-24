import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getIntent, 
  intentHandlers, 
  rewriteQuery, 
  updateConversationContext, 
  getConversationContext, 
  clearConversationContext 
} from '../lib/intentClassifier.js';

// Mock OpenAI
vi.mock('openai', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  };
  
  return {
    OpenAI: vi.fn().mockImplementation(() => mockOpenAI)
  };
});

// Mock the enhanced location detector
vi.mock('../lib/enhancedLocationDetector.js', () => ({
  detectLocationWithGeocoding: vi.fn().mockResolvedValue({
    location: 'San Jose, California',
    isUS: true
  })
}));

describe('Intent Classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear conversation contexts between tests
    clearConversationContext('test-call-sid');
  });

  describe('getIntent', () => {
    it('should classify shelter-related queries correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            function_call: {
              arguments: JSON.stringify({ intent: 'find_shelter' })
            }
          }
        }]
      };

      const { OpenAI } = await import('openai');
      const openaiInstance = new OpenAI();
      openaiInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const intent = await getIntent('I need shelter');
      expect(intent).toBe('find_shelter');
    });

    it('should classify legal services queries correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            function_call: {
              arguments: JSON.stringify({ intent: 'legal_services' })
            }
          }
        }]
      };

      const { OpenAI } = await import('openai');
      const openaiInstance = new OpenAI();
      openaiInstance.chat.completions.create.mockResolvedValue(mockResponse);

      const intent = await getIntent('I need legal help');
      expect(intent).toBe('legal_services');
    });

    it('should handle API errors gracefully', async () => {
      const { OpenAI } = await import('openai');
      const openaiInstance = new OpenAI();
      openaiInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const intent = await getIntent('I need help');
      expect(intent).toBe('general_information');
    });
  });

  describe('intentHandlers', () => {
    it('should return correct response types for each intent', async () => {
      expect(await intentHandlers.find_shelter('test')).toBe('shelter_search');
      expect(await intentHandlers.legal_services('test')).toBe('legal_resource_search');
      expect(await intentHandlers.counseling_services('test')).toBe('counseling_resource_search');
      expect(await intentHandlers.emergency_help('test')).toBe('emergency_response');
      expect(await intentHandlers.general_information('test')).toBe('information_search');
      expect(await intentHandlers.other_resources('test')).toBe('resource_search');
    });
  });

  describe('Conversation Context', () => {
    it('should update and retrieve conversation context', () => {
      const callSid = 'test-call-sid';
      const intent = 'find_shelter';
      const query = 'find shelter near me';
      const response = 'Here are some shelters...';

      updateConversationContext(callSid, intent, query, response);
      const context = getConversationContext(callSid);

      expect(context).toBeDefined();
      expect(context.lastIntent).toBe(intent);
      expect(context.lastQuery).toBe(query);
      expect(context.lastResponse).toBe(response);
      expect(context.history).toHaveLength(1);
    });

    it('should maintain conversation history', () => {
      const callSid = 'test-call-sid';
      
      // Add multiple interactions
      updateConversationContext(callSid, 'find_shelter', 'find shelter', 'response 1');
      updateConversationContext(callSid, 'legal_services', 'legal help', 'response 2');
      updateConversationContext(callSid, 'counseling_services', 'counseling', 'response 3');
      updateConversationContext(callSid, 'emergency_help', 'emergency', 'response 4');
      updateConversationContext(callSid, 'general_information', 'info', 'response 5');
      updateConversationContext(callSid, 'other_resources', 'resources', 'response 6');

      const context = getConversationContext(callSid);
      expect(context.history).toHaveLength(5); // Should keep only last 5
      expect(context.history[0].intent).toBe('legal_services'); // First one should be oldest
      expect(context.lastIntent).toBe('other_resources'); // Last one should be most recent
    });

    it('should clear conversation context', () => {
      const callSid = 'test-call-sid';
      updateConversationContext(callSid, 'find_shelter', 'test', 'response');
      
      clearConversationContext(callSid);
      const context = getConversationContext(callSid);
      expect(context).toBeNull();
    });
  });

  describe('rewriteQuery', () => {
    it('should add domestic violence context to queries', async () => {
      const result = await rewriteQuery('find shelter near me', 'find_shelter');
      expect(result).toContain('find shelter near me near San Jose, California site:org OR site:gov -site:wikipedia.org -filetype:pdf');
    });

    it('should handle follow-up questions with context', async () => {
      const followUpQuery = 'Tell me more about the first one';
      const callSid = 'test-call-sid';
      // Test follow-up
      const result = await rewriteQuery(followUpQuery, 'legal_services', callSid);
      expect(result).toContain('San Jose, California');
    });

    it('should add intent-specific terms', async () => {
      const shelterResult = await rewriteQuery('need housing', 'find_shelter');
      expect(shelterResult).toContain('domestic violence shelter');

      const legalResult = await rewriteQuery('need legal help', 'legal_services');
      expect(legalResult).toContain('legal');
    });

    it('should preserve location information', async () => {
      const result = await rewriteQuery('find help in San Jose, California', 'find_shelter');
      expect(result).toContain('San Jose, California');
    });

    it('should handle case-insensitive matching', async () => {
      const result = await rewriteQuery('DOMESTIC VIOLENCE shelter', 'find_shelter');
      expect(result).toContain('DOMESTIC VIOLENCE shelter');
      expect(result).toContain('site:org OR site:gov');
    });
  });
}); 