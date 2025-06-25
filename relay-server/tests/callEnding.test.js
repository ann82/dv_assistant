import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TwilioVoiceHandler } from '../lib/twilioVoice.js';
import { getIntent, manageConversationFlow, clearConversationContext } from '../lib/intentClassifier.js';

describe('Call Ending Functionality', () => {
  let twilioHandler;

  beforeEach(() => {
    twilioHandler = new TwilioVoiceHandler(
      'test_account_sid',
      'test_auth_token',
      '+1234567890'
    );
  });

  afterEach(() => {
    clearConversationContext('test-call-sid');
  });

  describe('Goodbye Intent Detection', () => {
    it('should detect goodbye intent correctly', async () => {
      const goodbyePhrases = [
        'goodbye',
        'bye',
        'end call',
        'hang up',
        'thank you goodbye',
        'that\'s all goodbye'
      ];

      for (const phrase of goodbyePhrases) {
        const intent = await getIntent(phrase);
        const flow = manageConversationFlow(intent, phrase);
        
        expect(intent).toBe('end_conversation');
        expect(flow.shouldEndCall).toBe(true);
        expect(flow.redirectionMessage).toContain('Take care');
      }
    });

    it('should not detect goodbye intent for other phrases', async () => {
      const nonGoodbyePhrases = [
        'hello',
        'help me',
        'find shelter',
        'legal services',
        'thank you for the information'
      ];

      for (const phrase of nonGoodbyePhrases) {
        const intent = await getIntent(phrase);
        const flow = manageConversationFlow(intent, phrase);
        
        expect(intent).not.toBe('end_conversation');
        expect(flow.shouldEndCall).toBeFalsy();
      }
    });
  });

  // Helper to mock Express response and capture sent TwiML
  function createMockRes() {
    let sent = '';
    return {
      set: () => {},
      send: (twiml) => { sent = typeof twiml === 'string' ? twiml : twiml.toString(); },
      getSent: () => sent
    };
  }

  describe('TwiML Generation for Call Ending', () => {
    it('should generate TwiML without gather when shouldEndCall is true', async () => {
      const mockReq = {
        body: {
          SpeechResult: 'goodbye',
          CallSid: 'test-call-sid'
        }
      };
      const mockRes = createMockRes();
      await twilioHandler.handleSpeechInput(mockReq, mockRes);
      const twimlString = mockRes.getSent();

      // Should contain the goodbye message
      expect(twimlString).toContain('Take care');
      // Should NOT contain gather element (which would continue the call)
      expect(twimlString).not.toContain('<Gather');
      // Should end with </Response>
      expect(twimlString).toContain('</Response>');
    });

    it('should generate TwiML with gather for regular responses', async () => {
      const mockReq = {
        body: {
          SpeechResult: 'find shelter in New York',
          CallSid: 'test-call-sid'
        }
      };
      const mockRes = createMockRes();
      await twilioHandler.handleSpeechInput(mockReq, mockRes);
      const twimlString = mockRes.getSent();

      // Should contain gather element to continue the call
      expect(twimlString).toContain('<Gather');
      expect(twimlString).toContain('action="/twilio/voice/process"');
    });
  });

  describe('Process Speech Input Response Format', () => {
    it('should return object with shouldEndCall flag for goodbye', async () => {
      const result = await twilioHandler.processSpeechInput('goodbye', 'test-call-sid');
      
      expect(typeof result).toBe('object');
      expect(result.shouldEndCall).toBe(true);
      expect(result.response).toContain('Take care');
    });

    it('should return string for regular responses', async () => {
      const result = await twilioHandler.processSpeechInput('find shelter', 'test-call-sid');
      
      // For regular responses, it should return a string (or object without shouldEndCall)
      if (typeof result === 'object') {
        expect(result.shouldEndCall).toBeFalsy();
      } else {
        expect(typeof result).toBe('string');
      }
    });
  });
}); 