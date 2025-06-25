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
      // Mock OpenAI API to throw an error
      const { OpenAI } = await import('openai');
      const openaiInstance = new OpenAI();
      openaiInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const intent = await getIntent('I need help');
      expect(intent).toBe('off_topic'); // "I need help" without context is off-topic
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
      // Mock lastQueryContext with sample results
      const lastQueryContext = {
        intent: 'general_information',
        location: 'San Jose, California',
        results: [
          {
            title: 'First Shelter - Domestic Violence Support Center',
            content: 'This shelter provides emergency housing, counseling services, and legal assistance for domestic violence survivors. They offer 24/7 hotline support and family services including childcare.',
            url: 'https://example1.org',
            score: 0.9
          },
          {
            title: 'Second Shelter - Safe Haven for Families',
            content: 'Safe Haven provides transitional housing, support groups, and employment assistance. They specialize in helping families with children and offer transportation assistance.',
            url: 'https://example2.org',
            score: 0.8
          },
          {
            title: 'Third Shelter - Crisis Intervention Center',
            content: 'This crisis center offers emergency shelter, safety planning, and advocacy services. They provide 24/7 crisis intervention and have partnerships with local law enforcement.',
            url: 'https://example3.org',
            score: 0.7
          }
        ],
        timestamp: Date.now()
      };

      // Test "last one" follow-up
      const followUpResponse = await generateFollowUpResponse('Can you tell me more about the last one?', lastQueryContext);
      
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('specific_result');
      expect(followUpResponse.intent).toBe('general_information');
      expect(followUpResponse.voiceResponse).toContain('Third Shelter');
      expect(followUpResponse.voiceResponse).toContain('emergency shelter');
      expect(followUpResponse.voiceResponse).toContain('safety planning');
      expect(followUpResponse.voiceResponse).toContain('advocacy services');
    });

    it('should handle "first one" follow-up questions correctly', async () => {
      const lastQueryContext = {
        intent: 'find_shelter',
        location: 'San Jose, California',
        results: [
          {
            title: 'First Shelter - Domestic Violence Support Center',
            content: 'This shelter provides emergency housing, counseling services, and legal assistance for domestic violence survivors. They offer 24/7 hotline support and family services including childcare.',
            url: 'https://example1.org',
            score: 0.9
          },
          {
            title: 'Second Shelter - Safe Haven for Families',
            content: 'Safe Haven provides transitional housing, support groups, and employment assistance.',
            url: 'https://example2.org',
            score: 0.8
          }
        ],
        timestamp: Date.now()
      };

      // Test "first one" follow-up
      const followUpResponse = await generateFollowUpResponse('Tell me more about the first one', lastQueryContext);
      
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('specific_result');
      expect(followUpResponse.voiceResponse).toContain('First Shelter');
      expect(followUpResponse.voiceResponse).toContain('counseling services');
      expect(followUpResponse.voiceResponse).toContain('legal assistance');
      expect(followUpResponse.voiceResponse).toContain('family services');
    });
  });
}); 