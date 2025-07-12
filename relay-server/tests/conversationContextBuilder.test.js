import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildConversationContext, injectConversationContext, getEnhancedVoiceInstructions } from '../lib/conversationContextBuilder.js';
import { updateConversationContext, clearConversationContext } from '../lib/intentClassifier.js';

describe('Conversation Context Builder', () => {
  const testCallSid = 'test-call-123';
  
  beforeEach(() => {
    // Clear any existing context
    clearConversationContext(testCallSid);
  });

  afterEach(() => {
    // Clean up after each test
    clearConversationContext(testCallSid);
  });

  describe('buildConversationContext', () => {
    it('should return default message when no context exists', () => {
      const context = buildConversationContext(testCallSid);
      expect(context).toBe('No previous conversation context available.');
    });

    it('should build context with conversation history', () => {
      // Add some conversation history
      updateConversationContext(testCallSid, 'find_shelter', 'find shelter in San Francisco', 'Here are some shelters...');
      updateConversationContext(testCallSid, 'legal_services', 'need legal help', 'Here is legal information...');
      
      const context = buildConversationContext(testCallSid);
      
      expect(context).toContain('Recent Conversation History');
      expect(context).toContain('find shelter');
      expect(context).toContain('legal help');
    });

    it('should include location context', () => {
      // Mock Tavily results with location
      const mockResponse = {
        voiceResponse: 'Found shelters in San Francisco',
        smsResponse: 'Shelters in SF'
      };
      
      updateConversationContext(testCallSid, 'find_shelter', 'find shelter in San Francisco', mockResponse, {
        results: [{ content: 'San Francisco shelter information' }]
      });
      
      const context = buildConversationContext(testCallSid);
      
      expect(context).toContain('Current Location');
      expect(context).toContain('San Francisco');
    });

    it('should detect family concerns', () => {
      const mockResponse = {
        voiceResponse: 'Found pet-friendly shelters',
        smsResponse: 'Pet-friendly shelters'
      };
      
      updateConversationContext(testCallSid, 'find_shelter', 'find shelter with pets', mockResponse, {
        results: [{ content: 'This shelter accepts pets and children' }]
      });
      
      const context = buildConversationContext(testCallSid);
      
      expect(context).toContain('Family Concerns');
      expect(context).toContain('pets');
      expect(context).toContain('children');
    });

    it('should include language preference', () => {
      updateConversationContext(testCallSid, 'find_shelter', 'find shelter', 'Shelter info');
      
      const context = buildConversationContext(testCallSid, '', 'es-ES');
      
      expect(context).toContain('Language Preference');
      expect(context).toContain('Spanish');
    });

    it('should detect emotional tone', () => {
      const mockResponse = {
        voiceResponse: 'Emergency shelter information',
        smsResponse: 'Emergency shelters'
      };
      
      updateConversationContext(testCallSid, 'emergency_help', 'need emergency help', mockResponse, {
        results: [{ content: 'This is an urgent emergency situation requiring immediate assistance' }]
      });
      
      const context = buildConversationContext(testCallSid);
      
      expect(context).toContain('Emotional Tone');
      expect(context).toContain('urgent');
    });
  });

  describe('injectConversationContext', () => {
    it('should replace template placeholder with context', () => {
      const template = '======== CONVERSATION CONTEXT ========\n{{conversation_context}}\n======== END ========';
      
      updateConversationContext(testCallSid, 'find_shelter', 'test query', 'test response');
      
      const result = injectConversationContext(template, testCallSid);
      
      expect(result).not.toContain('{{conversation_context}}');
      expect(result).toContain('Recent Conversation History');
      expect(result).toContain('======== END ========');
    });

    it('should handle missing context gracefully', () => {
      const template = '======== CONVERSATION CONTEXT ========\n{{conversation_context}}\n======== END ========';
      
      const result = injectConversationContext(template, 'non-existent-call');
      
      expect(result).not.toContain('{{conversation_context}}');
      expect(result).toContain('No previous conversation context available');
    });
  });

  describe('getEnhancedVoiceInstructions', () => {
    it('should return enhanced instructions with context', async () => {
      updateConversationContext(testCallSid, 'find_shelter', 'find shelter in Austin', 'Shelter info');
      
      const instructions = await getEnhancedVoiceInstructions(testCallSid, 'find shelter', 'en-US');
      
      expect(instructions).toContain('======== CONVERSATION CONTEXT ========');
      expect(instructions).toContain('Recent Conversation History');
      expect(instructions).toContain('======== SAFETY & EMERGENCY PROTOCOLS ========');
    });

    it('should handle errors gracefully', async () => {
      const instructions = await getEnhancedVoiceInstructions('invalid-call-sid', 'test query', 'en-US');
      
      expect(instructions).toContain('======== CONVERSATION CONTEXT ========');
      expect(instructions).toContain('No previous conversation context available');
    });
  });
}); 