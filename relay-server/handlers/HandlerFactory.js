import { TwilioVoiceHandler } from './voice/TwilioVoiceHandler.js';
import { SpeechHandler } from './voice/SpeechHandler.js';
import { ResponseHandler } from './response/ResponseHandler.js';
import { IntentHandler } from './intent/IntentHandler.js';
import { TwilioIntegration } from '../integrations/twilioIntegration.js';
import { OpenAIIntegration } from '../integrations/openaiIntegration.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';
import { TTSIntegration } from '../integrations/ttsIntegration.js';
import { SpeechRecognitionIntegration } from '../integrations/speechRecognitionIntegration.js';
import logger from '../lib/logger.js';

/**
 * HandlerFactory - Creates handlers with proper dependency injection
 * Enables easy mocking and testing of individual components
 */
export class HandlerFactory {
  constructor(config = {}) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Create TwilioVoiceHandler with dependencies
   * @param {Object} options - Handler creation options
   * @returns {TwilioVoiceHandler} Handler instance
   */
  createTwilioVoiceHandler(options = {}) {
    const {
      accountSid = process.env.TWILIO_ACCOUNT_SID,
      authToken = process.env.TWILIO_AUTH_TOKEN,
      phoneNumber = process.env.TWILIO_PHONE_NUMBER,
      services = {},
      dependencies = {}
    } = options;

    // Create integrations if not provided
    const twilioIntegration = dependencies.twilioIntegration || TwilioIntegration;
    const openaiIntegration = dependencies.openaiIntegration || new OpenAIIntegration();
    const ttsIntegration = dependencies.ttsIntegration || TTSIntegration;

    const handlerDependencies = {
      ...dependencies,
      twilioIntegration,
      openaiIntegration,
      ttsIntegration,
      validateRequest: dependencies.validateRequest,
      WebSocketClass: dependencies.WebSocketClass,
      VoiceResponseClass: dependencies.VoiceResponseClass,
      twilioClient: dependencies.twilioClient,
      audioService: dependencies.audioService,
      getLanguageConfigFn: dependencies.getLanguageConfigFn,
      DEFAULT_LANGUAGE_CONST: dependencies.DEFAULT_LANGUAGE_CONST
    };

    return new TwilioVoiceHandler(
      accountSid,
      authToken,
      phoneNumber,
      services,
      handlerDependencies
    );
  }

  /**
   * Create SpeechHandler with dependencies
   * @param {Object} options - Handler creation options
   * @returns {SpeechHandler} Handler instance
   */
  createSpeechHandler(options = {}) {
    const {
      services = {},
      dependencies = {}
    } = options;

    // Create integrations if not provided
    const speechRecognitionIntegration = dependencies.speechRecognitionIntegration || new SpeechRecognitionIntegration();
    const openaiIntegration = dependencies.openaiIntegration || new OpenAIIntegration();

    const handlerDependencies = {
      ...dependencies,
      speechRecognitionIntegration,
      openaiIntegration
    };

    return new SpeechHandler(services, handlerDependencies);
  }

  /**
   * Create ResponseHandler with dependencies
   * @param {Object} options - Handler creation options
   * @returns {ResponseHandler} Handler instance
   */
  createResponseHandler(options = {}) {
    const {
      services = {},
      dependencies = {}
    } = options;

    // Create integrations if not provided
    const openaiIntegration = dependencies.openaiIntegration || new OpenAIIntegration();
    const searchIntegration = dependencies.searchIntegration || SearchIntegration;

    const handlerDependencies = {
      ...dependencies,
      openaiIntegration,
      searchIntegration
    };

    return new ResponseHandler(services, handlerDependencies);
  }

  /**
   * Create IntentHandler with dependencies
   * @param {Object} options - Handler creation options
   * @returns {IntentHandler} Handler instance
   */
  createIntentHandler(options = {}) {
    const {
      services = {},
      dependencies = {}
    } = options;

    // Create integrations if not provided
    const openaiIntegration = dependencies.openaiIntegration || new OpenAIIntegration();

    const handlerDependencies = {
      ...dependencies,
      openaiIntegration
    };

    return new IntentHandler(services, handlerDependencies);
  }

  /**
   * Create all handlers with shared dependencies
   * @param {Object} options - Handler creation options
   * @returns {Object} Object containing all handlers
   */
  createAllHandlers(options = {}) {
    const {
      services = {},
      dependencies = {}
    } = options;

    // Create shared integrations
    const sharedDependencies = {
      openaiIntegration: dependencies.openaiIntegration || new OpenAIIntegration(),
      searchIntegration: dependencies.searchIntegration || SearchIntegration,
      twilioIntegration: dependencies.twilioIntegration || TwilioIntegration,
      ttsIntegration: dependencies.ttsIntegration || TTSIntegration,
      speechRecognitionIntegration: dependencies.speechRecognitionIntegration || new SpeechRecognitionIntegration(),
      ...dependencies
    };

    return {
      twilioVoice: this.createTwilioVoiceHandler({
        services,
        dependencies: sharedDependencies
      }),
      speech: this.createSpeechHandler({
        services,
        dependencies: sharedDependencies
      }),
      response: this.createResponseHandler({
        services,
        dependencies: sharedDependencies
      }),
      intent: this.createIntentHandler({
        services,
        dependencies: sharedDependencies
      })
    };
  }

  /**
   * Create test handlers with mocked dependencies
   * @param {Object} mocks - Mock objects for dependencies
   * @returns {Object} Object containing all handlers with mocked dependencies
   */
  createTestHandlers(mocks = {}) {
    const testDependencies = {
      // Mock integrations
      openaiIntegration: mocks.openaiIntegration || {
        chatCompletion: vi.fn(),
        generateTTS: vi.fn(),
        transcribeAudio: vi.fn(),
        getStatus: vi.fn()
      },
      searchIntegration: mocks.searchIntegration || {
        search: vi.fn(),
        getStatus: vi.fn()
      },
      twilioIntegration: mocks.twilioIntegration || {
        validateRequest: vi.fn(),
        sendSMS: vi.fn(),
        getStatus: vi.fn()
      },
      ttsIntegration: mocks.ttsIntegration || {
        generateTTS: vi.fn(),
        getStatus: vi.fn()
      },
      speechRecognitionIntegration: mocks.speechRecognitionIntegration || {
        transcribe: vi.fn(),
        getStatus: vi.fn()
      },

      // Mock services
      audioService: mocks.audioService || {
        generateTTS: vi.fn(),
        cleanupAudioFile: vi.fn()
      },
      ttsService: mocks.ttsService || {
        generateTTS: vi.fn(),
        getStatus: vi.fn()
      },
      searchService: mocks.searchService || {
        search: vi.fn(),
        getStatus: vi.fn()
      },
      contextService: mocks.contextService || {
        getContext: vi.fn(),
        updateContext: vi.fn(),
        getStatus: vi.fn()
      },

      // Mock utilities
      logger: mocks.logger || {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      },

      // Mock Twilio-specific dependencies
      validateRequest: mocks.validateRequest || vi.fn(),
      WebSocketClass: mocks.WebSocketClass || class MockWebSocket {},
      VoiceResponseClass: mocks.VoiceResponseClass || class MockVoiceResponse {},
      twilioClient: mocks.twilioClient || {
        messages: {
          create: vi.fn()
        }
      },

      // Mock functions
      getLanguageConfigFn: mocks.getLanguageConfigFn || vi.fn(),
      DEFAULT_LANGUAGE_CONST: mocks.DEFAULT_LANGUAGE_CONST || 'en-US'
    };

    return this.createAllHandlers({
      services: mocks.services || {},
      dependencies: testDependencies
    });
  }
} 