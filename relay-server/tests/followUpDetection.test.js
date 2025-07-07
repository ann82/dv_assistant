import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getIntent, handleFollowUp, updateConversationContext, getConversationContext, clearConversationContext } from '../lib/intentClassifier.js';

describe('Follow-up Detection Fix', () => {
  const testCallSid = 'test-call-sid-followup-fix';
  
  beforeEach(() => {
    // Clear any existing context
    clearConversationContext(testCallSid);
  });
  
  afterEach(() => {
    // Clean up
    clearConversationContext(testCallSid);
  });

  it('should not classify follow-up questions as off-topic', async () => {
    // First, set up a conversation context with a previous search
    const mockTavilyResults = {
      results: [
        {
          title: 'Domestic Violence Shelter - San Francisco',
          url: 'https://example.com/shelter1',
          content: 'A safe haven for domestic violence survivors in San Francisco.',
          score: 0.8
        },
        {
          title: 'Women\'s Crisis Center',
          url: 'https://example.com/shelter2', 
          content: 'Emergency shelter and support services for women in crisis.',
          score: 0.7
        }
      ]
    };

    // Simulate a previous search
    updateConversationContext(
      testCallSid,
      'find_shelter',
      'find shelters in San Francisco',
      { voiceResponse: 'I found 2 shelters in San Francisco.', smsResponse: 'Shelter details...' },
      mockTavilyResults
    );

    // Test various follow-up questions that should NOT be classified as off-topic
    const followUpQueries = [
      'tell me more about the first one',
      'what about the second one', 
      'can you send that to me',
      'where is that located',
      'what is the phone number',
      'more details',
      'the first result',
      'that shelter',
      'this one',
      'it'
    ];

    for (const query of followUpQueries) {
      // Check if it's detected as a follow-up
      const context = getConversationContext(testCallSid);
      const followUpResponse = await handleFollowUp(query, context.lastQueryContext);
      
      expect(followUpResponse).not.toBeNull();
      expect(followUpResponse.type).toBeDefined();
      
      
    }
  });

  it('should classify non-follow-up questions correctly', async () => {
    // Test queries that should be classified as off-topic (not follow-ups)
    const offTopicQueries = [
      'what is the weather like',
      'tell me a joke',
      'how are you doing',
      'what time is it',
      'do you like sports'
    ];

    for (const query of offTopicQueries) {
      const intent = await getIntent(query);
      expect(intent).toBe('off_topic');
      
    }
  });

  it('should handle mixed conversation flow correctly', async () => {
    // Set up context
    const mockTavilyResults = {
      results: [
        {
          title: 'Domestic Violence Shelter - Oakland',
          url: 'https://example.com/shelter3',
          content: 'Emergency shelter in Oakland.',
          score: 0.8
        }
      ]
    };

    updateConversationContext(
      testCallSid,
      'find_shelter', 
      'find shelters in Oakland',
      { voiceResponse: 'I found 1 shelter in Oakland.', smsResponse: 'Shelter details...' },
      mockTavilyResults
    );

    // Test a follow-up question
    const context = getConversationContext(testCallSid);
    const followUpResponse = await handleFollowUp('tell me more about that one', context.lastQueryContext);
    
    expect(followUpResponse).not.toBeNull();
    expect(followUpResponse.intent).toBe('find_shelter'); // Should inherit the previous intent
    expect(followUpResponse.type).toBe('specific_result');
    
    
  });

  it('should handle context timeout correctly', async () => {
    // Set up context with old timestamp
    const oldContext = {
      intent: 'find_shelter',
      query: 'find shelters in San Francisco',
      results: [{ title: 'Test Shelter', url: 'https://test.com', content: 'Test content', score: 0.8 }],
      timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago (older than 5-minute timeout)
      location: 'San Francisco'
    };

    // This should return null due to timeout
    const followUpResponse = await handleFollowUp('tell me more about that one', oldContext);
    expect(followUpResponse).toBeNull();
    
    
  });

  it('should detect pet-related follow-up questions correctly', async () => {
    // First, set up a conversation context with a previous search
    const mockTavilyResults = {
      results: [
        {
          title: 'Domestic Violence Shelter - San Francisco',
          url: 'https://example.com/shelter1',
          content: 'A safe haven for domestic violence survivors in San Francisco.',
          score: 0.8
        },
        {
          title: 'Women\'s Crisis Center',
          url: 'https://example.com/shelter2', 
          content: 'Emergency shelter and support services for women in crisis.',
          score: 0.7
        }
      ]
    };

    // Simulate a previous search
    updateConversationContext(
      testCallSid,
      'find_shelter',
      'find shelters in San Francisco',
      { voiceResponse: 'I found 2 shelters in San Francisco.', smsResponse: 'Shelter details...' },
      mockTavilyResults
    );

    // Test pet-related follow-up questions that should be detected
    const petFollowUpQueries = [
      'You be able to let me know if they use shelters. I love dogs.',
      'Do they allow pets?',
      'Can I bring my dog?',
      'Are pets allowed?',
      'I love dogs, can they take pets?',
      'What about pets?',
      'Do they accept animals?',
      'Can they take my cat?',
      'I have a dog, will they allow it?',
      'Pet policy?'
    ];

    for (const query of petFollowUpQueries) {
      const followUpResponse = await handleFollowUp(query, getConversationContext(testCallSid).lastQueryContext);
      
      expect(followUpResponse).not.toBeNull();
      expect(followUpResponse.type).toBe('pet_policy');
      expect(followUpResponse.intent).toBe('find_shelter');
      expect(followUpResponse.voiceResponse).toContain('pet');
      expect(followUpResponse.voiceResponse).toContain('call');
    }
  });
}); 