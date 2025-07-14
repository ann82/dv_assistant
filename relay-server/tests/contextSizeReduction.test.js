import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateConversationContext, getConversationContext, clearConversationContext } from '../lib/intentClassifier.js';

describe('Conversation Context Size Reduction', () => {
  const testCallSid = 'test-call-123';
  
  beforeEach(() => {
    clearConversationContext(testCallSid);
  });
  
  afterEach(() => {
    clearConversationContext(testCallSid);
  });

  it('should store only essential information from Tavily results', () => {
    // Mock large Tavily results
    const largeTavilyResults = {
      results: [
        {
          title: 'Test Shelter 1',
          url: 'https://example.com/shelter1',
          score: 0.9,
          content: 'A'.repeat(5000), // Very large content
          extracted_phone_numbers: ['555-1234'],
          extracted_addresses: ['123 Main St'],
          raw_content: 'B'.repeat(10000) // Even larger raw content
        },
        {
          title: 'Test Shelter 2',
          url: 'https://example.com/shelter2',
          score: 0.8,
          content: 'C'.repeat(3000),
          extracted_phone_numbers: ['555-5678'],
          extracted_addresses: ['456 Oak Ave'],
          raw_content: 'D'.repeat(8000)
        }
      ]
    };

    const response = {
      smsResponse: 'Test response',
      voiceResponse: 'Test voice response'
    };

    // Update context with large results
    updateConversationContext(testCallSid, 'find_shelter', 'test query', response, largeTavilyResults);
    
    // Get the context
    const context = getConversationContext(testCallSid);
    
    // Verify context exists
    expect(context).toBeTruthy();
    expect(context.lastQueryContext).toBeTruthy();
    expect(context.lastQueryContext.results).toBeTruthy();
    
    // Verify only essential information is stored
    const storedResults = context.lastQueryContext.results;
    expect(storedResults).toHaveLength(2);
    
    // Check first result
    const firstResult = storedResults[0];
    expect(firstResult.title).toBe('Test Shelter 1');
    expect(firstResult.url).toBe('https://example.com/shelter1');
    expect(firstResult.score).toBe(0.9);
    expect(firstResult.content).toHaveLength(203); // 200 chars + '...'
    expect(firstResult.content.endsWith('...')).toBe(true);
    expect(firstResult.phoneNumbers).toEqual(['555-1234']);
    expect(firstResult.addresses).toEqual(['123 Main St']);
    
    // Verify large content was truncated
    expect(firstResult.content).not.toBe('A'.repeat(5000));
    
    // Check that raw_content is not stored
    expect(firstResult.raw_content).toBeUndefined();
    
    // Verify result count is stored
    expect(context.lastQueryContext.resultCount).toBe(2);
    
    // Log context size for verification
    const contextSize = JSON.stringify(context.lastQueryContext).length;
    console.log(`Context size: ${contextSize} characters`);
    
    // Context should be significantly smaller than the original data
    const originalSize = JSON.stringify(largeTavilyResults).length;
    console.log(`Original size: ${originalSize} characters`);
    console.log(`Size reduction: ${((originalSize - contextSize) / originalSize * 100).toFixed(1)}%`);
    
    expect(contextSize).toBeLessThan(originalSize * 0.3); // Should be at least 70% smaller
  });

  it('should handle empty or null Tavily results gracefully', () => {
    const response = {
      smsResponse: 'Test response',
      voiceResponse: 'Test voice response'
    };

    // Test with null results
    updateConversationContext(testCallSid, 'find_shelter', 'test query', response, null);
    let context = getConversationContext(testCallSid);
    expect(context.lastQueryContext.results).toEqual([]);
    expect(context.lastQueryContext.resultCount).toBe(0);

    // Test with empty results
    updateConversationContext(testCallSid, 'find_shelter', 'test query', response, { results: [] });
    context = getConversationContext(testCallSid);
    expect(context.lastQueryContext.results).toEqual([]);
    expect(context.lastQueryContext.resultCount).toBe(0);
  });

  it('should limit results to top 3', () => {
    const manyResults = {
      results: Array.from({ length: 10 }, (_, i) => ({
        title: `Shelter ${i + 1}`,
        url: `https://example.com/shelter${i + 1}`,
        score: 0.9 - (i * 0.1),
        content: `Content for shelter ${i + 1}`,
        extracted_phone_numbers: [`555-${1000 + i}`],
        extracted_addresses: [`${100 + i} Main St`]
      }))
    };

    const response = {
      smsResponse: 'Test response',
      voiceResponse: 'Test voice response'
    };

    updateConversationContext(testCallSid, 'find_shelter', 'test query', response, manyResults);
    
    const context = getConversationContext(testCallSid);
    expect(context.lastQueryContext.results).toHaveLength(3);
    expect(context.lastQueryContext.resultCount).toBe(10);
    
    // Verify only top 3 results are stored
    expect(context.lastQueryContext.results[0].title).toBe('Shelter 1');
    expect(context.lastQueryContext.results[1].title).toBe('Shelter 2');
    expect(context.lastQueryContext.results[2].title).toBe('Shelter 3');
  });
}); 