import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIntent, intentHandlers, rewriteQuery } from '../lib/intentClassifier.js';

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
      expect(result).toBe('general_query');
    });

    it('should return general_query when no function call is returned', async () => {
      const mockResponse = {
        choices: [{
          message: {}
        }]
      };

      const openai = (await import('openai')).OpenAI;
      openai.mock.results[0].value.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await getIntent('test query');
      expect(result).toBe('general_query');
    });
  });

  describe('intentHandlers', () => {
    it('should return correct response types for each intent', async () => {
      expect(await intentHandlers.find_shelter('test')).toBe('shelter_search');
      expect(await intentHandlers.get_information('test')).toBe('information_search');
      expect(await intentHandlers.get_support_resource('test')).toBe('resource_search');
      expect(await intentHandlers.get_contact_details('test')).toBe('contact_search');
      expect(await intentHandlers.general_query('test')).toBe('general_response');
    });
  });

  describe('rewriteQuery', () => {
    it('should add domestic violence to shelter queries', () => {
      const result = rewriteQuery('find shelter near me', 'find_shelter');
      expect(result).toBe('domestic violence find shelter near me safe housing');
    });

    it('should add domestic violence to resource queries', () => {
      const result = rewriteQuery('need help with housing', 'get_support_resource');
      expect(result).toBe('domestic violence need help with housing');
    });

    it('should add support hotline to contact queries', () => {
      const result = rewriteQuery('how can I reach someone', 'get_contact_details');
      expect(result).toBe('how can I reach someone support hotline');
    });

    it('should not modify queries that already contain the terms', () => {
      const result = rewriteQuery('domestic violence shelter near me', 'find_shelter');
      expect(result).toBe('domestic violence shelter near me');
    });

    it('should not modify general queries', () => {
      const result = rewriteQuery('what is domestic violence', 'general_query');
      expect(result).toBe('what is domestic violence');
    });

    it('should handle case-insensitive matching', () => {
      const result = rewriteQuery('DOMESTIC VIOLENCE shelter', 'find_shelter');
      expect(result).toBe('DOMESTIC VIOLENCE shelter');
    });
  });
}); 