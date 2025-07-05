// Move all vi.doMock calls into beforeEach, and import TwilioVoiceHandler after mocks
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AudioService before importing TwilioVoiceHandler
vi.doMock('../services/audioService.js', () => ({
  AudioService: class MockAudioService {
    constructor() {
      this.audioBuffer = new Map();
      this.audioDir = '/mock/audio';
      this.cacheDir = '/mock/cache';
      this.accumulatedAudio = new Map();
    }
    
    async ensureDirectories() {
      // Mock implementation
    }
    
    async generateTTS() {
      return { audioUrl: '/mock/audio/test.mp3' };
    }
  }
}));

// Mock twilio
vi.doMock('twilio', () => ({
  default: vi.fn().mockReturnValue({
    calls: {
      create: vi.fn().mockResolvedValue({ sid: 'test-call-sid' })
    }
  }),
  validateRequest: vi.fn().mockReturnValue(true),
  twiml: {
    VoiceResponse: class MockVoiceResponse {
      constructor() {
        this.say = vi.fn().mockReturnThis();
        this.gather = vi.fn().mockReturnThis();
        this.redirect = vi.fn().mockReturnThis();
      }
    }
  }
}));

// Mock config
vi.doMock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'ACtest123456789',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    OPENAI_API_KEY: 'test-openai-key',
    GPT4_MODEL: 'gpt-4',
    GPT35_MODEL: 'gpt-3.5-turbo',
    DEFAULT_MAX_TOKENS: 1000
  }
}));

// Mock logger
vi.doMock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { TwilioVoiceHandler } from '../lib/twilioVoice.js';

const mockPrompts = {
  welcome: 'Welcome!',
  incompleteLocation: `I'd be happy to help you find shelter. Could you please tell me which city, state, and country you're looking for?`,
  currentLocation: `I understand you want resources near your current location. To help you find the closest shelters, could you please tell me which city, state, and country you're in?`,
  locationPrompt: 'Please provide a specific location.',
  confirmLocation: 'I found a previous search for {{location}}. Would you like me to search there again?',
  usePreviousLocation: 'I\'ll search for resources in {{location}}.',
  fallback: 'I\'m sorry, I didn\'t understand your request.'
};

describe('Location Confirmation Logic', () => {
  const mockCallSid = 'test-call-sid-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Location Context Checking', () => {
    it('should ask for location when no previous location exists', async () => {
      const getIntent = vi.fn().mockResolvedValue('find_shelter');
      const getConversationContext = vi.fn().mockReturnValue(null);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'Can you help me with some resources that are near me?',
        mockCallSid
      );

      expect(getConversationContext).toHaveBeenCalledWith(mockCallSid);
      expect(extractLocation).toHaveBeenCalledWith('Can you help me with some resources that are near me?');
      expect(result).toContain('current location');
    });

    it('should confirm previous location when it exists', async () => {
      const previousContext = {
        lastQueryContext: {
          location: 'San Francisco, California, USA',
          intent: 'find_shelter'
        }
      };
      
      const getIntent = vi.fn().mockResolvedValue('find_shelter');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'I need resources near me',
        mockCallSid
      );

      expect(getConversationContext).toHaveBeenCalledWith(mockCallSid);
      expect(result).toContain('San Francisco, California, USA');
      expect(result).toContain('search there again');
    });

    it('should handle incomplete location with previous location available', async () => {
      const previousContext = {
        lastQueryContext: {
          location: 'Los Angeles, California, USA',
          intent: 'find_shelter'
        }
      };
      
      const getIntent = vi.fn().mockResolvedValue('find_shelter');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'incomplete' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'I need help in California',
        mockCallSid
      );

      expect(getConversationContext).toHaveBeenCalledWith(mockCallSid);
      expect(result).toContain('Los Angeles, California, USA');
      expect(result).toContain('search there again');
    });
  });

  describe('Location Confirmation Responses', () => {
    it('should proceed with search when user confirms previous location', async () => {
      const previousContext = {
        lastQueryContext: {
          location: 'San Francisco, California, USA',
          intent: 'find_shelter'
        }
      };
      
      const getIntent = vi.fn().mockResolvedValue('confirm_location');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter in San Francisco, California, USA');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({
        results: [
          { title: 'Test Shelter 1', url: 'https://test1.org', content: 'Test shelter content' }
        ]
      });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({
          voiceResponse: 'I found 1 shelter in San Francisco, California, USA.',
          smsResponse: 'Test SMS response'
        })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'Yes, that\'s right',
        mockCallSid
      );

      expect(callTavilyAPI).toHaveBeenCalled();
      expect(result).toContain('San Francisco, California, USA');
    });

    it('should ask for new location when user declines previous location', async () => {
      const previousContext = {
        lastQueryContext: {
          location: 'San Francisco, California, USA',
          intent: 'find_shelter'
        }
      };
      
      const getIntent = vi.fn().mockResolvedValue('decline_location');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'No, that\'s not right',
        mockCallSid
      );

      expect(result).toContain('city, state, and country');
    });

    it('should handle various affirmative responses', async () => {
      const previousContext = {
        lastQueryContext: {
          location: 'San Francisco, California, USA',
          intent: 'find_shelter'
        }
      };
      
      const getIntent = vi.fn().mockResolvedValue('confirm_location');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter in San Francisco, California, USA');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({
        results: [
          { title: 'Test Shelter 1', url: 'https://test1.org', content: 'Test shelter content' }
        ]
      });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({
          voiceResponse: 'I found 1 shelter in San Francisco, California, USA.',
          smsResponse: 'Test SMS response'
        })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const affirmativeResponses = ['yes', 'yeah', 'correct', 'that\'s right', 'sure', 'okay'];
      
      for (const response of affirmativeResponses) {
        vi.clearAllMocks();
        getIntent.mockResolvedValue('confirm_location');
        
        const result = await handler.processSpeechInput(response, mockCallSid);
        expect(callTavilyAPI).toHaveBeenCalled();
      }
    });

    it('should handle various negative responses', async () => {
      const previousContext = {
        lastQueryContext: {
          location: 'San Francisco, California, USA',
          intent: 'find_shelter'
        }
      };
      
      const getIntent = vi.fn().mockResolvedValue('decline_location');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const negativeResponses = ['no', 'nope', 'wrong', 'that\'s not right', 'different'];
      
      for (const response of negativeResponses) {
        vi.clearAllMocks();
        getIntent.mockResolvedValue('decline_location');
        
        const result = await handler.processSpeechInput(response, mockCallSid);
        expect(result).toContain('city, state, and country');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle expired conversation context', async () => {
      const getIntent = vi.fn().mockResolvedValue('find_shelter');
      const getConversationContext = vi.fn().mockReturnValue(null);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'I need resources near me',
        mockCallSid
      );

      expect(result).toContain('current location');
    });

    it('should handle missing lastQueryContext', async () => {
      const previousContext = {
        // No lastQueryContext
      };
      
      const getIntent = vi.fn().mockResolvedValue('find_shelter');
      const getConversationContext = vi.fn().mockReturnValue(previousContext);
      const extractLocation = vi.fn().mockReturnValue({ location: null, scope: 'current-location' });
      const handleFollowUp = vi.fn().mockResolvedValue(null);
      const manageConversationFlow = vi.fn().mockReturnValue({ shouldContinue: true, shouldEndCall: false, shouldReengage: false });
      const rewriteQuery = vi.fn().mockResolvedValue('domestic violence shelter');
      const updateConversationContext = vi.fn();
      const cleanResultTitle = vi.fn().mockReturnValue('Test Shelter');
      const callTavilyAPI = vi.fn().mockResolvedValue({ results: [] });
      const ResponseGenerator = {
        formatTavilyResponse: vi.fn().mockReturnValue({ voiceResponse: 'Test response' })
      };
      const getLanguageConfig = vi.fn().mockReturnValue({ prompts: mockPrompts });

      const handler = new TwilioVoiceHandler(
        'ACtest123456789',
        'test_auth_token',
        '+1234567890'
      );
      
      handler._deps = { 
        getIntent, 
        getConversationContext, 
        extractLocation, 
        handleFollowUp,
        manageConversationFlow,
        rewriteQuery,
        updateConversationContext,
        cleanResultTitle,
        callTavilyAPI,
        ResponseGenerator,
        getLanguageConfig 
      };
      handler.activeCalls = new Map();
      handler.audioService = { /* mock audio service */ };

      const result = await handler.processSpeechInput(
        'I need resources near me',
        mockCallSid
      );

      expect(result).toContain('current location');
    });
  });
}); 