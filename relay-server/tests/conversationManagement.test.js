import { describe, it, expect, beforeEach } from 'vitest';
import { 
  manageConversationFlow, 
  shouldAttemptReengagement, 
  generateReengagementMessage 
} from '../lib/intentClassifier.js';

describe('Conversation Management', () => {
  beforeEach(() => {
    // Clear any test data
  });

  describe('manageConversationFlow', () => {
    it('should handle null context gracefully', () => {
      const result = manageConversationFlow('find_shelter', 'I need shelter', null);
      
      expect(result).toEqual({
        shouldContinue: true,
        shouldEndCall: false,
        shouldReengage: false,
        redirectionMessage: null,
        confidence: 0.5
      });
    });

    it('should handle undefined context gracefully', () => {
      const result = manageConversationFlow('find_shelter', 'I need shelter', undefined);
      
      expect(result).toEqual({
        shouldContinue: true,
        shouldEndCall: false,
        shouldReengage: false,
        redirectionMessage: null,
        confidence: 0.5
      });
    });

    it('should handle empty context object', () => {
      const result = manageConversationFlow('find_shelter', 'I need shelter', {});
      
      expect(result).toEqual({
        shouldContinue: true,
        shouldEndCall: false,
        shouldReengage: false,
        redirectionMessage: null,
        confidence: 0.5
      });
    });

    it('should use context confidence when available', () => {
      const context = { confidence: 0.8 };
      const result = manageConversationFlow('find_shelter', 'I need shelter', context);
      
      expect(result.confidence).toBe(0.8);
    });

    it('should handle off-topic intent with conversation end request', () => {
      const result = manageConversationFlow('off_topic', 'goodbye, I need to go', {});
      
      expect(result.shouldEndCall).toBe(false);
      expect(result.shouldContinue).toBe(false);
      expect(result.redirectionMessage).toContain('Before we end this call');
    });

    it('should handle off-topic intent with re-engagement attempt', () => {
      const result = manageConversationFlow('off_topic', 'I need help with domestic violence', {});
      
      expect(result.shouldReengage).toBe(true);
      expect(result.shouldContinue).toBe(true);
      expect(result.redirectionMessage).toContain('domestic violence support');
    });

    it('should handle off-topic intent with general redirection', () => {
      const result = manageConversationFlow('off_topic', 'What\'s the weather like?', {});
      
      expect(result.shouldContinue).toBe(true);
      expect(result.redirectionMessage).toContain('domestic violence support');
    });

    it('should handle end conversation intent', () => {
      const result = manageConversationFlow('end_conversation', 'end the call', {});
      
      expect(result.shouldEndCall).toBe(false);
      expect(result.shouldContinue).toBe(false);
      expect(result.redirectionMessage).toContain('Before we end this call');
    });

    it('should handle emergency help intent with high priority', () => {
      const result = manageConversationFlow('emergency_help', 'I need help now', {});
      
      expect(result.shouldContinue).toBe(true);
      expect(result.priority).toBe('high');
      expect(result.redirectionMessage).toBe(null);
    });

    it('should continue conversation for regular intents', () => {
      const result = manageConversationFlow('find_shelter', 'I need shelter', {});
      
      expect(result.shouldContinue).toBe(true);
      expect(result.shouldEndCall).toBe(false);
      expect(result.shouldReengage).toBe(false);
      expect(result.redirectionMessage).toBe(null);
    });
  });

  describe('shouldAttemptReengagement', () => {
    it('should return false for null context', () => {
      const result = shouldAttemptReengagement(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined context', () => {
      const result = shouldAttemptReengagement(undefined);
      expect(result).toBe(false);
    });

    it('should return false for context without history', () => {
      const result = shouldAttemptReengagement({});
      expect(result).toBe(false);
    });

    it('should return false for context with non-array history', () => {
      const result = shouldAttemptReengagement({ history: 'not an array' });
      expect(result).toBe(false);
    });

    it('should return false for context with empty history', () => {
      const result = shouldAttemptReengagement({ history: [] });
      expect(result).toBe(false);
    });

    it('should return false for context with only one off-topic interaction', () => {
      const context = {
        history: [
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() }
        ]
      };
      const result = shouldAttemptReengagement(context);
      expect(result).toBe(false);
    });

    it('should return true for context with multiple off-topic interactions', () => {
      const context = {
        history: [
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'tell me a joke', timestamp: new Date().toISOString() }
        ]
      };
      const result = shouldAttemptReengagement(context);
      expect(result).toBe(true);
    });

    it('should return true for context with mixed intents but multiple off-topic', () => {
      const context = {
        history: [
          { intent: 'find_shelter', query: 'need shelter', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'tell me a joke', timestamp: new Date().toISOString() }
        ]
      };
      const result = shouldAttemptReengagement(context);
      expect(result).toBe(true);
    });

    it('should return false for context with mostly relevant intents', () => {
      const context = {
        history: [
          { intent: 'find_shelter', query: 'need shelter', timestamp: new Date().toISOString() },
          { intent: 'legal_services', query: 'need legal help', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() }
        ]
      };
      const result = shouldAttemptReengagement(context);
      expect(result).toBe(false);
    });
  });

  describe('generateReengagementMessage', () => {
    it('should return a valid re-engagement message', () => {
      const context = {
        history: [
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'tell me a joke', timestamp: new Date().toISOString() }
        ]
      };
      const message = generateReengagementMessage(context);
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('domestic violence');
    });

    it('should return different messages on multiple calls', () => {
      const context = {
        history: [
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'tell me a joke', timestamp: new Date().toISOString() }
        ]
      };
      
      const messages = new Set();
      for (let i = 0; i < 10; i++) {
        messages.add(generateReengagementMessage(context));
      }
      
      // Should have multiple different messages (though not guaranteed due to randomness)
      expect(messages.size).toBeGreaterThan(1);
    });

    it('should handle null context', () => {
      const message = generateReengagementMessage(null);
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('domestic violence');
    });

    it('should handle undefined context', () => {
      const message = generateReengagementMessage(undefined);
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('domestic violence');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete conversation flow with null context', () => {
      const intent = 'find_shelter';
      const query = 'I need shelter in Washington DC';
      const context = null;
      
      const flow = manageConversationFlow(intent, query, context);
      const shouldReengage = shouldAttemptReengagement(context);
      const reengagementMessage = generateReengagementMessage(context);
      
      expect(flow.shouldContinue).toBe(true);
      expect(flow.confidence).toBe(0.5);
      expect(shouldReengage).toBe(false);
      expect(typeof reengagementMessage).toBe('string');
    });

    it('should handle off-topic conversation flow', () => {
      const intent = 'off_topic';
      const query = 'What\'s the weather like?';
      const context = {
        history: [
          { intent: 'off_topic', query: 'tell me a joke', timestamp: new Date().toISOString() },
          { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() }
        ]
      };
      
      const flow = manageConversationFlow(intent, query, context);
      const shouldReengage = shouldAttemptReengagement(context);
      const reengagementMessage = generateReengagementMessage(context);
      
      expect(flow.shouldContinue).toBe(true);
      expect(flow.redirectionMessage).toContain('domestic violence');
      expect(shouldReengage).toBe(true);
      expect(typeof reengagementMessage).toBe('string');
    });
  });
}); 