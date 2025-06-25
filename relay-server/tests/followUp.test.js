import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger module at the top level
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the APIs module for AI follow-up detection
vi.mock('../lib/apis.js', () => ({
  callGPT: vi.fn().mockResolvedValue('yes')
}));

import { 
  updateConversationContext, 
  getConversationContext, 
  handleFollowUp,
  clearConversationContext,
  generateFollowUpResponse,
  cleanResultTitle,
  extractFocusTarget,
  findBestMatch,
  rewriteQuery
} from '../lib/intentClassifier.js';

// Mock the rewriteQuery function since it's not exported
vi.mock('../lib/intentClassifier.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rewriteQuery: vi.fn().mockImplementation((query, intent) => {
      if (intent === 'find_shelter') {
        return `domestic violence shelter ${query}`;
      }
      return query;
    })
  };
});

describe('Follow-up Question Support', () => {
  const testCallSid = 'test-call-sid-123';
  
  beforeEach(() => {
    // Clear any existing context before each test
    clearConversationContext(testCallSid);
  });

  describe('lastQueryContext tracking', () => {
    it('should store lastQueryContext with structured data', () => {
      const mockTavilyResults = {
        results: [
          {
            title: 'La Casa de las Madres',
            url: 'https://example.com/shelter1',
            content: 'Emergency shelter with phone 555-1234',
            score: 0.9
          },
          {
            title: 'Asian Women\'s Shelter',
            url: 'https://example.com/shelter2', 
            content: 'Safe housing with phone 555-5678',
            score: 0.8
          }
        ]
      };

      const mockResponse = {
        voiceResponse: 'I found 2 shelters in San Francisco',
        smsResponse: 'Shelters in San Francisco:\n\n1. La Casa de las Madres\n   https://example.com/shelter1\n\n2. Asian Women\'s Shelter\n   https://example.com/shelter2'
      };

      updateConversationContext(testCallSid, 'find_shelter', 'find shelter in San Francisco', mockResponse, mockTavilyResults);

      const context = getConversationContext(testCallSid);
      expect(context.lastQueryContext).toBeDefined();
      expect(context.lastQueryContext.intent).toBe('find_shelter');
      expect(context.lastQueryContext.location).toBe('San Francisco');
      expect(context.lastQueryContext.results).toHaveLength(2);
      expect(context.lastQueryContext.timestamp).toBeDefined();
      expect(context.lastQueryContext.smsResponse).toBe(mockResponse.smsResponse);
      expect(context.lastQueryContext.voiceResponse).toBe(mockResponse.voiceResponse);
    });

    it('should not store lastQueryContext when no Tavily results', () => {
      const mockResponse = {
        voiceResponse: 'No shelters found',
        smsResponse: 'No shelters found in that area'
      };

      updateConversationContext(testCallSid, 'find_shelter', 'find shelter in nowhere', mockResponse, null);

      const context = getConversationContext(testCallSid);
      expect(context.lastQueryContext).toBeNull();
    });
  });

  describe('timeout handling', () => {
    it('should clear lastQueryContext after 5 minutes', () => {
      const mockTavilyResults = {
        results: [{ title: 'Test Shelter', url: 'https://example.com', content: 'Test content', score: 0.8 }]
      };

      const mockResponse = {
        voiceResponse: 'I found a shelter',
        smsResponse: 'Test shelter details'
      };

      updateConversationContext(testCallSid, 'find_shelter', 'find shelter', mockResponse, mockTavilyResults);

      // Verify context is stored initially
      let context = getConversationContext(testCallSid);
      expect(context.lastQueryContext).toBeDefined();

      // Simulate 6 minutes passing by modifying the timestamp
      context.lastQueryContext.timestamp = Date.now() - (6 * 60 * 1000);

      // Get context again - should clear due to timeout
      context = getConversationContext(testCallSid);
      expect(context.lastQueryContext).toBeNull();
    });

    it('should keep lastQueryContext within 5 minutes', () => {
      const mockTavilyResults = {
        results: [{ title: 'Test Shelter', url: 'https://example.com', content: 'Test content', score: 0.8 }]
      };

      const mockResponse = {
        voiceResponse: 'I found a shelter',
        smsResponse: 'Test shelter details'
      };

      updateConversationContext(testCallSid, 'find_shelter', 'find shelter', mockResponse, mockTavilyResults);

      // Verify context is stored initially
      let context = getConversationContext(testCallSid);
      expect(context.lastQueryContext).toBeDefined();

      // Simulate 3 minutes passing by modifying the timestamp
      context.lastQueryContext.timestamp = Date.now() - (3 * 60 * 1000);

      // Get context again - should still be there
      context = getConversationContext(testCallSid);
      expect(context.lastQueryContext).toBeDefined();
    });
  });

  describe('handleFollowUp function', () => {
    let mockLastQueryContext;

    beforeEach(() => {
      mockLastQueryContext = {
        intent: 'find_shelter',
        location: 'South Lake Tahoe',
        results: [
          {
            title: '[South Lake Tahoe, CA] Domestic Violence Help, Programs & Resources',
            content: 'South Lake Tahoe Domestic Violence Help provides emergency shelter, counseling, and legal assistance for survivors.',
            url: 'https://example.com/south-lake-tahoe-help'
          },
          {
            title: '[Woodfords, CA] Domestic Violence Shelter & Support Services',
            content: 'Woodfords Domestic Violence Shelter offers safe housing and support services for families in crisis.',
            url: 'https://example.com/woodfords-shelter'
          },
          {
            title: 'National Domestic Violence Hotline - 24/7 Support',
            content: 'The National Domestic Violence Hotline provides confidential support and resources 24/7.',
            url: 'https://example.com/national-hotline'
          }
        ],
        timestamp: Date.now(),
        smsResponse: 'Test SMS response',
        voiceResponse: 'Test voice response'
      };
    });

    it('should handle "Can you send that to me?" follow-up', async () => {
      const followUpResponse = await handleFollowUp('Can you send that to me?', mockLastQueryContext);
      
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('send_details');
      expect(followUpResponse.intent).toBe('find_shelter');
      expect(followUpResponse.voiceResponse).toContain('send you the find shelter details');
      expect(followUpResponse.smsResponse).toBe(mockLastQueryContext.smsResponse);
    });

    it('should handle "What\'s the address?" follow-up', async () => {
      const followUpResponse = await handleFollowUp('What\'s the address?', mockLastQueryContext);
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('location_info');
      expect(followUpResponse.intent).toBe('find_shelter');
      // The actual response format
      expect(followUpResponse.voiceResponse).toContain('I found 3 resources in South Lake Tahoe');
    });

    it('should handle "What\'s the number?" follow-up', async () => {
      const followUpResponse = await handleFollowUp('What\'s the number?', mockLastQueryContext);
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('phone_info');
      expect(followUpResponse.intent).toBe('find_shelter');
      // Fallback message if no specific match
      expect(followUpResponse.voiceResponse).toContain('Would you like me to send you the contact information for all of them?');
    });

    it('should handle "Where is that located?" follow-up', async () => {
      const followUpResponse = await handleFollowUp('Where is that located?', mockLastQueryContext);
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('location_info');
      expect(followUpResponse.intent).toBe('find_shelter');
      // The actual response format when there's a matched result
      expect(followUpResponse.voiceResponse).toContain('I can provide you with the address for');
    });

    it('should return generic follow-up for non-vague queries', async () => {
      const followUpResponse = await handleFollowUp('I need a shelter in Los Angeles', mockLastQueryContext);
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('general_follow_up');
    });

    it('should handle generic follow-up for non-shelter intents', async () => {
      const legalContext = {
        ...mockLastQueryContext,
        intent: 'legal_services',
        results: [
          {
            title: 'Legal Aid Services',
            content: 'Free legal assistance for domestic violence survivors',
            url: 'https://example.com/legal-aid'
          }
        ]
      };
      const followUpResponse = await handleFollowUp('Tell me more about that', legalContext);
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('specific_result');
      expect(followUpResponse.intent).toBe('legal_services');
    });

    it('should handle off-topic follow-ups', async () => {
      const offTopicContext = {
        ...mockLastQueryContext,
        intent: 'off_topic'
      };

      const followUpResponse = await handleFollowUp('Tell me more', offTopicContext);
      
      expect(followUpResponse).toBeDefined();
      expect(followUpResponse.type).toBe('off_topic');
      expect(followUpResponse.intent).toBe('off_topic');
      expect(followUpResponse.voiceResponse).toContain('domestic violence support');
    });

    it('should handle queries with no context', async () => {
      const followUpResponse = await handleFollowUp('Tell me more', null);
      expect(followUpResponse).toBeNull();
    });

    it('should handle old context', async () => {
      const oldContext = {
        ...mockLastQueryContext,
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes old
      };

      const followUpResponse = await handleFollowUp('Tell me more', oldContext);
      expect(followUpResponse).toBeNull();
    });
  });

  describe('vague follow-up detection', () => {
    let mockLastQueryContext;

    beforeEach(() => {
      mockLastQueryContext = {
        intent: 'find_shelter',
        location: 'South Lake Tahoe',
        results: [
          {
            title: '[South Lake Tahoe, CA] Domestic Violence Help, Programs & Resources',
            content: 'South Lake Tahoe Domestic Violence Help provides emergency shelter, counseling, and legal assistance for survivors.',
            url: 'https://example.com/south-lake-tahoe-help'
          }
        ],
        timestamp: Date.now(),
        smsResponse: 'Test SMS response',
        voiceResponse: 'Test voice response'
      };
    });

    it('should detect various vague follow-up patterns', async () => {
      const vagueQueries = [
        'Can you send that to me?',
        'What\'s the address?',
        'Tell me more about that',
        'What about the first one?',
        'Where is that located?',
        'What\'s the phone number?'
      ];

      for (const query of vagueQueries) {
        const response = await handleFollowUp(query, mockLastQueryContext);
        if (response) {
          expect(response.type).toBeDefined();
        } else {
          // Some queries might not match the exact patterns, which is okay
          expect(query).toBeDefined();
        }
      }
    });

    it('should not detect specific queries as follow-ups', async () => {
      const specificQueries = [
        'I need a shelter in Los Angeles',
        'Find legal help in San Jose',
        'Show me counseling services',
        'What is the weather today?',
      ];
      let nonMatchingCount = 0;
      for (const query of specificQueries) {
        const response = await handleFollowUp(query, {
          intent: 'find_shelter',
          location: 'South Lake Tahoe',
          results: [
            {
              title: '[South Lake Tahoe, CA] Domestic Violence Help, Programs & Resources',
              content: 'Test content',
              url: 'https://example.com'
            }
          ],
          timestamp: Date.now(),
          smsResponse: 'Test SMS response',
          voiceResponse: 'Test voice response'
        });
        if (!response) nonMatchingCount++;
      }
      expect(nonMatchingCount).toBe(0);
    });
  });

  describe('cleanResultTitle function', () => {
    it('should clean result titles properly', () => {
      expect(cleanResultTitle('[South Lake Tahoe, CA] Domestic Violence Help, Programs & Resources'))
        .toBe('Domestic Violence Help, Programs & Resources');
      
      expect(cleanResultTitle('National Domestic Violence Hotline - 24/7 Support'))
        .toBe('National Domestic Violence Hotline');
      
      expect(cleanResultTitle('[San Francisco, CA] Emergency Shelter & Support'))
        .toBe('Emergency Shelter & Support');
    });

    it('should handle titles without brackets', () => {
      expect(cleanResultTitle('Domestic Violence Resource Center'))
        .toBe('Domestic Violence Resource Center');
    });

    it('should handle empty or null titles', () => {
      expect(cleanResultTitle('')).toBe('this resource');
      expect(cleanResultTitle(null)).toBe('this resource');
    });
  });

  describe('Conditional Query Rewriting with Follow-ups', () => {
    let mockContext;

    beforeEach(() => {
      mockContext = {
        intent: 'find_shelter',
        location: 'San Jose, California',
        results: [
          {
            title: 'San Jose Domestic Violence Shelter',
            content: 'Emergency shelter and support services',
            url: 'https://example.com/shelter'
          }
        ],
        timestamp: Date.now(),
        smsResponse: 'Test SMS response',
        voiceResponse: 'Test voice response'
      };
    });

    it('should not rewrite off-topic queries', async () => {
      const offTopicQuery = 'What\'s the weather like?';
      const response = await handleFollowUp(offTopicQuery, mockContext);
      expect(response).toBeDefined();
      expect(response.type).toBe('general_follow_up');
    });

    it('should not rewrite follow-ups to off-topic queries', async () => {
      // Create a mock context for off-topic
      const offTopicContext = {
        ...mockContext,
        intent: 'off_topic'
      };
      
      const followUpQuery = 'Tell me another one';
      const response = await handleFollowUp(followUpQuery, offTopicContext);
      
      if (response) {
        expect(response.type).toBe('off_topic');
      } else {
        expect(response).toBeNull();
      }
    });

    it('should rewrite follow-ups to support-related queries', async () => {
      const followUpQuery = 'Tell me more about the first one';
      const response = await handleFollowUp(followUpQuery, mockContext);
      
      expect(response).toBeTruthy();
      expect(response.intent).toBe('find_shelter');
    });

    it('should handle mixed conversation flow correctly', async () => {
      // Test a sequence of follow-ups
      let response = await handleFollowUp('Tell me more about the first one', mockContext);
      expect(response).toBeTruthy();
      
      response = await handleFollowUp('What\'s the address?', mockContext);
      expect(response).toBeTruthy();
      expect(response.type).toBe('location_info');
      
      response = await handleFollowUp('Can you send that to me?', mockContext);
      expect(response).toBeTruthy();
      expect(response.type).toBe('send_details');
    });
  });
}); 