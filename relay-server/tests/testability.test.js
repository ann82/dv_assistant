import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HandlerFactory } from '../handlers/HandlerFactory.js';
import { HandlerManager } from '../handlers/HandlerManager.js';
import { TwilioVoiceHandler } from '../handlers/voice/TwilioVoiceHandler.js';

describe('Testability Refactoring', () => {
  let handlerFactory;
  let mockServices;
  let mockDependencies;

  beforeEach(() => {
    // Create mock services
    mockServices = {
      audio: {
        generateTTS: vi.fn(),
        cleanupAudioFile: vi.fn(),
        getStatus: vi.fn()
      },
      tts: {
        generateTTS: vi.fn(),
        getStatus: vi.fn()
      },
      search: {
        search: vi.fn(),
        getStatus: vi.fn()
      },
      context: {
        getContext: vi.fn(),
        updateContext: vi.fn(),
        getStatus: vi.fn()
      }
    };

    // Create mock dependencies
    mockDependencies = {
      openaiIntegration: {
        chatCompletion: vi.fn(),
        generateTTS: vi.fn(),
        transcribeAudio: vi.fn(),
        getStatus: vi.fn()
      },
      searchIntegration: {
        search: vi.fn(),
        getStatus: vi.fn()
      },
      twilioIntegration: {
        validateRequest: vi.fn(),
        sendSMS: vi.fn(),
        getStatus: vi.fn()
      },
      ttsIntegration: {
        generateTTS: vi.fn(),
        getStatus: vi.fn()
      },
      speechRecognitionIntegration: {
        transcribe: vi.fn(),
        getStatus: vi.fn()
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      },
      validateRequest: vi.fn(),
      WebSocketClass: class MockWebSocket {},
      VoiceResponseClass: class MockVoiceResponse {},
      twilioClient: {
        messages: {
          create: vi.fn()
        }
      },
      getLanguageConfigFn: vi.fn(),
      DEFAULT_LANGUAGE_CONST: 'en-US'
    };

    handlerFactory = new HandlerFactory();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('HandlerFactory', () => {
    it('should create TwilioVoiceHandler with injected dependencies', () => {
      const handler = handlerFactory.createTwilioVoiceHandler({
        services: mockServices,
        dependencies: mockDependencies
      });

      expect(handler).toBeInstanceOf(TwilioVoiceHandler);
      expect(handler._deps).toBeDefined();
      expect(handler._deps.openaiIntegration).toBe(mockDependencies.openaiIntegration);
      expect(handler._deps.searchIntegration).toBe(mockDependencies.searchIntegration);
      expect(handler._deps.twilioIntegration).toBe(mockDependencies.twilioIntegration);
    });

    it('should create test handlers with mocked dependencies', () => {
      const handlers = handlerFactory.createTestHandlers({
        services: mockServices,
        openaiIntegration: mockDependencies.openaiIntegration
      });

      expect(handlers.twilioVoice).toBeInstanceOf(TwilioVoiceHandler);
      expect(handlers.speech).toBeDefined();
      expect(handlers.response).toBeDefined();
      expect(handlers.intent).toBeDefined();
    });

    it('should create all handlers with shared dependencies', () => {
      const handlers = handlerFactory.createAllHandlers({
        services: mockServices,
        dependencies: mockDependencies
      });

      expect(handlers.twilioVoice).toBeInstanceOf(TwilioVoiceHandler);
      expect(handlers.speech).toBeDefined();
      expect(handlers.response).toBeDefined();
      expect(handlers.intent).toBeDefined();

      // Verify shared dependencies - only check if they exist
      expect(handlers.twilioVoice._deps).toBeDefined();
      expect(handlers.speech._deps).toBeDefined();
    });
  });

  describe('HandlerManager with Dependency Injection', () => {
    it('should initialize with injected dependencies', () => {
      const handlerManager = new HandlerManager(mockServices, mockDependencies);

      expect(handlerManager.services).toBe(mockServices);
      expect(handlerManager.dependencies).toBe(mockDependencies);
      expect(handlerManager.getAvailableHandlers()).toContain('twilioVoice');
      expect(handlerManager.getAvailableHandlers()).toContain('speech');
      expect(handlerManager.getAvailableHandlers()).toContain('response');
      expect(handlerManager.getAvailableHandlers()).toContain('intent');
    });

    it('should use factory to create handlers', () => {
      const handlerManager = new HandlerManager(mockServices, mockDependencies);
      const twilioHandler = handlerManager.getHandler('twilioVoice');

      expect(twilioHandler).toBeInstanceOf(TwilioVoiceHandler);
      expect(twilioHandler._deps.openaiIntegration).toBe(mockDependencies.openaiIntegration);
    });

    it('should handle missing handler gracefully', () => {
      const handlerManager = new HandlerManager(mockServices, mockDependencies);

      expect(() => {
        handlerManager.getHandler('nonexistent');
      }).toThrow('Handler \'nonexistent\' not found');
    });
  });

  describe('TwilioVoiceHandler Dependency Injection', () => {
    it('should accept injected dependencies in constructor', () => {
      const handler = new TwilioVoiceHandler(
        'ACtest123',
        'test_token',
        '+1234567890',
        mockServices,
        mockDependencies
      );

      expect(handler._deps).toBe(mockDependencies);
      expect(handler._getLanguageConfig).toBe(mockDependencies.getLanguageConfigFn);
      expect(handler._DEFAULT_LANGUAGE).toBe(mockDependencies.DEFAULT_LANGUAGE_CONST);
    });

    it('should use injected dependencies instead of creating new ones', () => {
      const customAudioService = { custom: true };
      const customDependencies = {
        ...mockDependencies,
        audioService: customAudioService
      };

      const handler = new TwilioVoiceHandler(
        'ACtest123',
        'test_token',
        '+1234567890',
        mockServices,
        customDependencies
      );

      expect(handler.audioService).toBe(customAudioService);
    });

    it('should handle test environment credentials gracefully', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const handler = new TwilioVoiceHandler(
        null, // No accountSid
        null, // No authToken
        null, // No phoneNumber
        mockServices,
        mockDependencies
      );

      expect(handler.accountSid).toBe('ACtest123456789');
      expect(handler.authToken).toBe('test_auth_token');
      expect(handler.phoneNumber).toBe('+1234567890');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Integration Testing with Mocks', () => {
    it('should process voice call with mocked dependencies', async () => {
      const mockRequest = {
        body: {
          CallSid: 'test_call_sid',
          From: '+1234567890',
          To: '+0987654321'
        },
        headers: {},
        originalUrl: '/twilio/voice',
        method: 'POST',
        setTimeout: vi.fn(),
        get: vi.fn(),
        protocol: 'https'
      };

      const mockTwiml = { toString: () => '<Response><Say>Hello</Say></Response>' };
      const mockVoiceResponseClass = vi.fn().mockReturnValue(mockTwiml);

      const customDependencies = {
        ...mockDependencies,
        VoiceResponseClass: mockVoiceResponseClass,
        validateRequest: vi.fn().mockReturnValue(true)
      };

      const handler = new TwilioVoiceHandler(
        'ACtest123',
        'test_token',
        '+1234567890',
        mockServices,
        customDependencies
      );

      const result = await handler.handleIncomingCall(mockRequest);

      expect(result).toBeDefined();
      expect(mockVoiceResponseClass).toHaveBeenCalled();
    });

    it('should handle speech input with mocked dependencies', async () => {
      const mockRequest = {
        body: {
          CallSid: 'test_call_sid',
          SpeechResult: 'Hello, I need help'
        },
        headers: {},
        originalUrl: '/twilio/voice/process',
        method: 'POST'
      };

      const customDependencies = {
        ...mockDependencies,
        validateRequest: vi.fn().mockReturnValue(true)
      };

      const handler = new TwilioVoiceHandler(
        'ACtest123',
        'test_token',
        '+1234567890',
        mockServices,
        customDependencies
      );

      // Mock the processSpeechInput method
      handler.processSpeechInput = vi.fn().mockResolvedValue('Mocked response');

      const result = await handler.handleSpeechInput(mockRequest);

      expect(result).toBeDefined();
      expect(handler.processSpeechInput).toHaveBeenCalledWith(
        'Hello, I need help',
        'test_call_sid',
        'en-US'
      );
    });
  });

  describe('Service Integration', () => {
    it('should integrate with service manager', () => {
      const handlerManager = new HandlerManager(mockServices, mockDependencies);
      
      expect(handlerManager.services).toBe(mockServices);
      expect(handlerManager.services.audio).toBe(mockServices.audio);
      expect(handlerManager.services.tts).toBe(mockServices.tts);
      expect(handlerManager.services.search).toBe(mockServices.search);
      expect(handlerManager.services.context).toBe(mockServices.context);
    });

    it('should update services dynamically', () => {
      const handlerManager = new HandlerManager(mockServices, mockDependencies);
      
      const newServices = {
        ...mockServices,
        newService: { test: true }
      };

      handlerManager.updateServices(newServices);
      expect(handlerManager.services).toStrictEqual(newServices);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', () => {
      // Test with invalid factory that throws
      const invalidFactory = {
        createAllHandlers: vi.fn().mockImplementation(() => {
          throw new Error('Factory error');
        })
      };

      const handlerManager = new HandlerManager(mockServices, mockDependencies);
      handlerManager.factory = invalidFactory;

      expect(() => {
        handlerManager.initializeHandlers();
      }).toThrow('Factory error');
    });

    it('should handle missing required services', () => {
      // Test with empty services - should throw
      expect(() => {
        new TwilioVoiceHandler(
          'ACtest123',
          'test_token',
          '+1234567890',
          {}, // Empty services
          mockDependencies
        );
      }).toThrow('TwilioVoiceHandler: Required service');

      // Test with valid services - should not throw
      expect(() => {
        new TwilioVoiceHandler(
          'ACtest123',
          'test_token',
          '+1234567890',
          mockServices, // Valid services
          mockDependencies
        );
      }).not.toThrow();
    });
  });
}); 