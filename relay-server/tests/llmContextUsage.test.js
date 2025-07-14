import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateConversationContext, clearConversationContext } from '../lib/intentClassifier.js';
import { createLLMPromptWithMinimalContext, createLLMPromptWithOptimizedContext, detectFollowUpType } from '../lib/llmContextUsage.js';

describe('LLM Context Usage', () => {
  const testCallSid = 'test-call-456';
  
  beforeEach(() => {
    clearConversationContext(testCallSid);
  });
  
  afterEach(() => {
    clearConversationContext(testCallSid);
  });

  it('should create LLM prompt with minimal context for new conversation', () => {
    const { systemPrompt, userMessage } = createLLMPromptWithMinimalContext(testCallSid, 'Hello');
    
    expect(systemPrompt).toContain('You are a helpful assistant for domestic violence support');
    expect(userMessage).toBe('Hello');
  });

  it('should create LLM prompt with context after conversation', () => {
    // Simulate a conversation
    const tavilyResults = {
      results: [
        {
          title: 'Safe Haven Shelter',
          url: 'https://example.com/safehaven',
          score: 0.92,
          content: 'Safe Haven provides emergency housing for survivors of domestic violence in Austin, Texas.',
          extracted_phone_numbers: ['555-1234'],
          extracted_addresses: ['123 Main St, Austin, TX']
        }
      ]
    };

    updateConversationContext(testCallSid, 'find_shelter', 'I need a shelter in Austin', {}, tavilyResults);
    
    const { systemPrompt, userMessage } = createLLMPromptWithMinimalContext(testCallSid, 'Tell me more about the first shelter');
    
    expect(systemPrompt).toContain('Last Intent: find_shelter');
    expect(systemPrompt).toContain('Location: Austin');
    expect(systemPrompt).toContain('Safe Haven Shelter');
    expect(systemPrompt).toContain('555-1234');
    expect(userMessage).toBe('Tell me more about the first shelter');
  });

  it('should create optimized context prompt with enhanced features', () => {
    // Simulate a conversation with family concerns
    const tavilyResults = {
      results: [
        {
          title: 'Pet-Friendly Shelter',
          url: 'https://example.com/petshelter',
          score: 0.88,
          content: 'This shelter accepts pets and provides pet care services for families fleeing domestic violence.',
          extracted_phone_numbers: ['555-5678'],
          extracted_addresses: ['456 Oak Ave, Austin, TX']
        }
      ]
    };

    updateConversationContext(testCallSid, 'find_shelter', 'I need a shelter that accepts pets', {}, tavilyResults);
    
    const { systemPrompt, userMessage, context } = createLLMPromptWithOptimizedContext(testCallSid, 'Do they have space for my dog?');
    
    expect(systemPrompt).toContain('Family Concerns: pets');
    expect(context.familyConcerns).toContain('pets');
    expect(userMessage).toBe('Do they have space for my dog?');
  });

  it('should detect follow-up types correctly', () => {
    // Set up context with results
    const tavilyResults = {
      results: [
        {
          title: 'Safe Haven Shelter',
          url: 'https://example.com/safehaven',
          score: 0.92,
          content: 'Emergency housing for survivors',
          extracted_phone_numbers: ['555-1234'],
          extracted_addresses: ['123 Main St, Austin, TX']
        }
      ]
    };

    updateConversationContext(testCallSid, 'find_shelter', 'I need a shelter in Austin', {}, tavilyResults);
    
    // Test different follow-up types
    expect(detectFollowUpType(testCallSid, 'Tell me more about Safe Haven')).toBe('resource_details');
    expect(detectFollowUpType(testCallSid, 'What about shelters nearby?')).toBe('resource_details'); // "shelter" triggers resource_details
    expect(detectFollowUpType(testCallSid, 'What about counseling services?')).toBe('general_followup');
    expect(detectFollowUpType(testCallSid, 'I need legal help')).toBe('new_query');
  });

  it('should handle context size efficiently', () => {
    // Simulate large results being stored
    const largeResults = {
      results: [
        {
          title: 'Test Shelter',
          url: 'https://example.com/test',
          score: 0.9,
          content: 'A'.repeat(1000), // Large content
          extracted_phone_numbers: ['555-1234'],
          extracted_addresses: ['123 Test St']
        }
      ]
    };

    updateConversationContext(testCallSid, 'find_shelter', 'Test query', {}, largeResults);
    
    const { systemPrompt, userMessage, context } = createLLMPromptWithOptimizedContext(testCallSid, 'Follow up question');
    
    // Context should be reasonably sized
    const contextSize = JSON.stringify(context).length;
    console.log(`Context size: ${contextSize} characters`);
    
    expect(contextSize).toBeLessThan(5000); // Should be under 5KB
    expect(contextSize).toBeGreaterThan(0); // Should have some content
    expect(userMessage).toBe('Follow up question');
  });
}); 