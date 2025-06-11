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
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
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

      const openai = (await import('openai')).OpenAI;
      openai.mock.results[0].value.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await getIntent('I need a shelter near me');
      expect(result).toBe('find_shelter');
    });

    it('should handle errors gracefully', async () => {
      const openai = (await import('openai')).OpenAI;
      openai.mock.results[0].value.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await getIntent('test query');
      expect(result).toBe('general_information');
    });

    it('should return general_information when no function call is returned', async () => {
      const mockResponse = {
        choices: [{
          message: {}
        }]
      };

      const openai = (await import('openai')).OpenAI;
      openai.mock.results[0].value.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await getIntent('test query');
      expect(result).toBe('general_information');
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
    it('should add domestic violence context to queries', () => {
      const result = rewriteQuery('find shelter near me', 'find_shelter');
      expect(result).toContain('domestic violence');
    });

    it('should handle follow-up questions with context', () => {
      const callSid = 'test-call-sid';
      const initialQuery = 'find shelter in Santa Clara';
      const followUpQuery = 'what about legal services there?';

      // Set up context
      updateConversationContext(callSid, 'find_shelter', initialQuery, 'response');
      
      // Test follow-up
      const result = rewriteQuery(followUpQuery, 'legal_services', callSid);
      expect(result).toContain('Santa Clara');
      expect(result).toContain('legal');
    });

    it('should add intent-specific terms', () => {
      const shelterResult = rewriteQuery('need housing', 'find_shelter');
      expect(shelterResult).toContain('emergency shelter safe housing');

      const legalResult = rewriteQuery('need legal help', 'legal_services');
      expect(legalResult).toContain('legal aid attorney services');
      expect(legalResult).toContain('restraining order protection');

      const counselingResult = rewriteQuery('need support', 'counseling_services');
      expect(counselingResult).toContain('counseling therapy support group');

      const emergencyResult = rewriteQuery('need help now', 'emergency_help');
      expect(emergencyResult).toContain('emergency urgent');
      expect(emergencyResult).toContain('24/7 hotline immediate assistance');
    });

    it('should preserve location information', () => {
      const result = rewriteQuery('find help in San Jose, California', 'find_shelter');
      expect(result).toContain('San Jose, California');
    });

    it('should handle case-insensitive matching', () => {
      const result = rewriteQuery('DOMESTIC VIOLENCE shelter', 'find_shelter');
      expect(result).toBe('DOMESTIC VIOLENCE shelter');
    });
  });
}); 