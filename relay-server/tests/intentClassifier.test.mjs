import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getIntent, 
  intentHandlers, 
  rewriteQuery, 
  updateConversationContext, 
  getConversationContext, 
  clearConversationContext,
  generateFollowUpResponse
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
  }),
  extractLocationFromQuery: vi.fn().mockReturnValue('San Jose, California')
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
      // Mock OpenAI API to throw an error
      const { OpenAI } = await import('openai');
      const openaiInstance = new OpenAI();
      openaiInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const intent = await getIntent('I need help');
      expect(intent).toBe('off_topic'); // "I need help" without context is off-topic
    });

    it('should classify "thank you" as end_conversation intent', async () => {
      const intent1 = await getIntent('thank you');
      expect(intent1).toBe('end_conversation');

      const intent2 = await getIntent('thanks');
      expect(intent2).toBe('end_conversation');

      const intent3 = await getIntent('thank you so much');
      expect(intent3).toBe('end_conversation');

      const intent4 = await getIntent('thanks for your help');
      expect(intent4).toBe('end_conversation');
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
      expect(result).toContain('"domestic violence shelter" near San Jose, California');
      expect(result).toContain('"shelter name" "address" "phone number"');
      expect(result).toContain('site:.org OR site:.gov');
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
      expect(shelterResult).toContain('"domestic violence shelter"');

      const legalResult = await rewriteQuery('need legal help', 'legal_services');
      expect(legalResult).toContain('legal');
    });

    it('should preserve location information', async () => {
      const result = await rewriteQuery('find help in San Jose, California', 'find_shelter');
      expect(result).toContain('San Jose, California');
    });

    it('should handle case-insensitive matching', async () => {
      const result = await rewriteQuery('DOMESTIC VIOLENCE shelter', 'find_shelter');
      expect(result).toContain('"domestic violence shelter"');
      expect(result).toContain('site:.org OR site:.gov');
    });
  });

  describe('Off-topic Detection', () => {
    it('should classify medical queries as off-topic', async () => {
      const medicalQueries = [
        'Can you give me the chemo? Detail about it.',
        'I need information about cancer treatment',
        'What are the symptoms of diabetes?',
        'Tell me about chemotherapy',
        'I need a prescription refill'
      ];

      for (const query of medicalQueries) {
        const intent = await getIntent(query);
        expect(intent).toBe('off_topic');
      }
    });

    it('should classify entertainment queries as off-topic', async () => {
      const entertainmentQueries = [
        'Tell me a joke',
        'What\'s the weather like?',
        'Who won the game?',
        'Play some music',
        'What movie should I watch?'
      ];

      for (const query of entertainmentQueries) {
        const intent = await getIntent(query);
        expect(intent).toBe('off_topic');
      }
    });

    it('should still classify domestic violence queries correctly', async () => {
      const domesticViolenceQueries = [
        'I need shelter',
        'Help with legal services',
        'I need counseling',
        'Emergency help',
        'Domestic violence resources'
      ];

      for (const query of domesticViolenceQueries) {
        const intent = await getIntent(query);
        expect(intent).not.toBe('off_topic');
      }
    });
  });

  describe('Follow-up Question Handling', () => {
    it('should handle "last one" follow-up questions correctly', async () => {
      const callSid = 'test-call-sid';
      const mockResults = [
        { 
          title: 'First Shelter - Domestic Violence Support Center',
          content: 'This shelter provides emergency housing and support services.',
          url: 'https://example1.org'
        },
        { 
          title: 'Second Shelter - Emergency Housing',
          content: 'Emergency housing for domestic violence survivors.',
          url: 'https://example2.org'
        },
        { 
          title: 'Third Shelter - Crisis Intervention Center',
          content: 'Crisis intervention and emergency shelter services.',
          url: 'https://example3.org'
        }
      ];
      
      updateConversationContext(callSid, 'find_shelter', 'find shelter', 'response', { results: mockResults });
      
      const followUpQuery = 'Tell me more about the last one';
      const result = await generateFollowUpResponse(followUpQuery, getConversationContext(callSid).lastQueryContext);
      
      expect(result).toBeDefined();
      expect(result.focusTarget).toBe('Third Shelter - Crisis Intervention Center');
    });

    it('should handle "first one" follow-up questions correctly', async () => {
      const callSid = 'test-call-sid';
      const mockResults = [
        { 
          title: 'First Shelter - Domestic Violence Support Center',
          content: 'This shelter provides emergency housing and support services.',
          url: 'https://example1.org'
        },
        { 
          title: 'Second Shelter - Emergency Housing',
          content: 'Emergency housing for domestic violence survivors.',
          url: 'https://example2.org'
        }
      ];
      
      updateConversationContext(callSid, 'find_shelter', 'find shelter', 'response', { results: mockResults });
      
      const followUpQuery = 'Tell me more about the first one';
      const result = await generateFollowUpResponse(followUpQuery, getConversationContext(callSid).lastQueryContext);
      
      expect(result).toBeDefined();
      expect(result.focusTarget).toBe('First Shelter - Domestic Violence Support Center');
    });
  });

  describe('"Near Me" Query Classification', () => {
    it('should classify "resources near me" as other_resources intent', async () => {
      const intent = await getIntent('resources near me');
      expect(intent).toBe('other_resources');
    });

    it('should classify "help near me" as other_resources intent', async () => {
      const intent = await getIntent('help near me');
      expect(intent).toBe('other_resources');
    });

    it('should classify "shelter near me" as find_shelter intent', async () => {
      const intent = await getIntent('shelter near me');
      expect(intent).toBe('find_shelter');
    });

    it('should classify "legal help near me" as legal_services intent', async () => {
      const intent = await getIntent('legal help near me');
      expect(intent).toBe('legal_services');
    });

    it('should classify "counseling near me" as counseling_services intent', async () => {
      const intent = await getIntent('counseling near me');
      expect(intent).toBe('counseling_services');
    });

    it('should classify "services near me" as other_resources intent', async () => {
      const intent = await getIntent('services near me');
      expect(intent).toBe('other_resources');
    });

    it('should classify "near me" with different proximity words', async () => {
      const testCases = [
        { query: 'shelter nearby', expected: 'find_shelter' },
        { query: 'help around me', expected: 'other_resources' },
        { query: 'resources close to me', expected: 'other_resources' },
        { query: 'legal services my location', expected: 'legal_services' },
        { query: 'counseling here', expected: 'counseling_services' },
        { query: 'support current location', expected: 'other_resources' }
      ];

      for (const { query, expected } of testCases) {
        const intent = await getIntent(query);
        expect(intent).toBe(expected);
      }
    });

    it('should classify "near me" queries in different word orders', async () => {
      const testCases = [
        { query: 'near me shelter', expected: 'find_shelter' },
        { query: 'nearby help', expected: 'other_resources' },
        { query: 'around me resources', expected: 'other_resources' },
        { query: 'my location legal services', expected: 'legal_services' },
        { query: 'here counseling', expected: 'counseling_services' },
        { query: 'current location support', expected: 'other_resources' }
      ];

      for (const { query, expected } of testCases) {
        const intent = await getIntent(query);
        expect(intent).toBe(expected);
      }
    });
  });
}); 