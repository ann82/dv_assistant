import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock Twilio SDK
const mockTwilioClient = {
  messages: {
    create: vi.fn()
  },
  calls: {
    create: vi.fn(),
    fetch: vi.fn()
  }
};

vi.mock('twilio', () => ({
  default: vi.fn(() => mockTwilioClient)
}));

// Mock OpenAI SDK
const mockOpenAIClient = {
  chat: {
    completions: {
      create: vi.fn()
    }
  },
  audio: {
    speech: {
      create: vi.fn()
    },
    transcriptions: {
      create: vi.fn()
    }
  },
  embeddings: {
    create: vi.fn()
  }
};

vi.mock('openai', () => ({
  OpenAI: vi.fn(() => mockOpenAIClient)
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-request-id-123')
}));

// Mock fetch
global.fetch = vi.fn();

let TwilioIntegration, OpenAIIntegration, SearchIntegration, TTSIntegration, SpeechRecognitionIntegration, GeocodingIntegration;
let logger;

describe('Integration Logging', () => {
  beforeAll(async () => {
    // Set up environment variables before importing modules
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.TAVILY_API_KEY = 'test-tavily-key';
    process.env.OPENAI_API_KEY = 'sk-valid-test-key123';

    TwilioIntegration = (await import('../integrations/twilioIntegration.js')).TwilioIntegration;
    OpenAIIntegration = (await import('../integrations/openaiIntegration.js')).OpenAIIntegration;
    SearchIntegration = (await import('../integrations/searchIntegration.js')).SearchIntegration;
    TTSIntegration = (await import('../integrations/ttsIntegration.js')).TTSIntegration;
    SpeechRecognitionIntegration = (await import('../integrations/speechRecognitionIntegration.js')).SpeechRecognitionIntegration;
    GeocodingIntegration = (await import('../integrations/geocodingIntegration.js')).GeocodingIntegration;
    logger = (await import('../lib/logger.js')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Twilio Integration Logging', () => {
    it('should log SMS operations with request ID', async () => {
      const mockMessage = { sid: 'test-sid', status: 'sent' };
      mockTwilioClient.messages.create.mockResolvedValue(mockMessage);

      await TwilioIntegration.sendSMS('+1234567890', 'Test message', 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Twilio Integration - sendSMS.start:',
        expect.objectContaining({
          integration: 'Twilio',
          operation: 'sendSMS.start',
          requestId: 'test-request-id',
          to: '+1234567890',
          bodyLength: 12
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Twilio Integration - sendSMS.success:',
        expect.objectContaining({
          integration: 'Twilio',
          operation: 'sendSMS.success',
          requestId: 'test-request-id',
          to: '+1234567890',
          sid: 'test-sid',
          status: 'sent'
        })
      );
    });

    it('should log call operations with request ID', async () => {
      const mockCall = { sid: 'test-call-sid', status: 'initiated' };
      mockTwilioClient.calls.create.mockResolvedValue(mockCall);

      await TwilioIntegration.makeCall('+1234567890', 'http://test.com', 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Twilio Integration - makeCall.start:',
        expect.objectContaining({
          integration: 'Twilio',
          operation: 'makeCall.start',
          requestId: 'test-request-id',
          to: '+1234567890',
          twimlUrl: 'http://test.com'
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Twilio Integration - makeCall.success:',
        expect.objectContaining({
          integration: 'Twilio',
          operation: 'makeCall.success',
          requestId: 'test-request-id',
          to: '+1234567890',
          sid: 'test-call-sid',
          status: 'initiated'
        })
      );
    });
  });

  describe('OpenAI Integration Logging', () => {
    let openAI;

    beforeEach(() => {
      openAI = new OpenAIIntegration();
      // Inject our mock client
      openAI.client = mockOpenAIClient;
    });

    it('should log chat completion operations with request ID', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' }, finish_reason: 'stop' }],
        usage: { total_tokens: 10 }
      };
      mockOpenAIClient.chat.completions.create.mockResolvedValue(mockResponse);

      await openAI.createChatCompletion({
        messages: [{ role: 'user', content: 'Test' }]
      }, 'test-request-id');

      // Find the call for createChatCompletion.success
      const successCall = logger.info.mock.calls.find(
        call => call[0] === 'OpenAI Integration - createChatCompletion.success:'
      );
      expect(successCall).toBeTruthy();
      expect(successCall[1]).toEqual(expect.objectContaining({
        integration: 'OpenAI',
        operation: 'createChatCompletion.success',
        requestId: 'test-request-id',
        finishReason: 'stop',
        // responseLength and usage may be present, but we don't assert exact value
      }));
    });

    it('should log TTS operations with request ID', async () => {
      const mockAudioBuffer = Buffer.from('test audio');
      mockOpenAIClient.audio.speech.create.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockAudioBuffer)
      });

      await openAI.createTTS({
        text: 'Test text'
      }, 'test-request-id');

      // Find the call for createTTS.success
      const successCall = logger.info.mock.calls.find(
        call => call[0] === 'OpenAI Integration - createTTS.success:'
      );
      expect(successCall).toBeTruthy();
      expect(successCall[1]).toEqual(expect.objectContaining({
        integration: 'OpenAI',
        operation: 'createTTS.success',
        requestId: 'test-request-id',
        audioSize: 10,
        textLength: 9
      }));
    });
  });

  describe('Search Integration Logging', () => {
    it('should log search operations with request ID', async () => {
      const mockResponse = {
        results: [{ 
          title: 'Domestic Violence Shelter - Test Result',
          url: 'https://domesticshelters.org/test',
          content: 'Emergency shelter for domestic violence survivors. Call us at (555) 123-4567.',
          score: 0.8
        }],
        answer: 'Test answer'
      };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await SearchIntegration.search('test query', {}, 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Search Integration - search.start:',
        expect.objectContaining({
          integration: 'Search',
          operation: 'search.start',
          requestId: 'test-request-id',
          queryLength: 10,
          queryPreview: 'test query'
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Search Integration - search.success:',
        expect.objectContaining({
          integration: 'Search',
          operation: 'search.success',
          requestId: 'test-request-id',
          filteredResultCount: 1,
          hasAnswer: true
        })
      );
    });

    it('should log DV search query building with request ID', () => {
      const result = SearchIntegration.buildDvSearchQuery('New York', { emergency: true }, 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Search Integration - buildDvSearchQuery:',
        expect.objectContaining({
          integration: 'Search',
          operation: 'buildDvSearchQuery',
          requestId: 'test-request-id',
          location: 'New York',
          filters: { emergency: true }
        })
      );
    });
  });

  describe('TTS Integration Logging', () => {
    it('should log TTS generation with request ID', async () => {
      const mockAudioBuffer = Buffer.from('test audio');
      mockOpenAIClient.audio.speech.create.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockAudioBuffer)
      });

      await TTSIntegration.generateTTS('Test text', {}, 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'TTS Integration - generateTTS.start:',
        expect.objectContaining({
          integration: 'TTS',
          operation: 'generateTTS.start',
          requestId: 'test-request-id',
          textLength: 9,
          provider: 'openai'
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'TTS Integration - generateTTS.success:',
        expect.objectContaining({
          integration: 'TTS',
          operation: 'generateTTS.success',
          requestId: 'test-request-id',
          audioSize: 10,
          provider: 'openai'
        })
      );
    });
  });

  describe('Speech Recognition Integration Logging', () => {
    let speechRecognition;

    beforeEach(() => {
      speechRecognition = new SpeechRecognitionIntegration();
      // Inject our mock client into the OpenAI integration
      speechRecognition.openai.client = mockOpenAIClient;
    });

    it('should log transcription operations with request ID', async () => {
      const mockTranscription = 'Test transcription';
      mockOpenAIClient.audio.transcriptions.create.mockResolvedValue(mockTranscription);

      await speechRecognition.transcribeAudio({
        audioBuffer: Buffer.from('test audio')
      }, 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Speech Recognition Integration - transcribeAudio.start:',
        expect.objectContaining({
          integration: 'SpeechRecognition',
          operation: 'transcribeAudio.start',
          requestId: 'test-request-id',
          provider: 'openai',
          audioSize: 10
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Speech Recognition Integration - transcribeAudio.success:',
        expect.objectContaining({
          integration: 'SpeechRecognition',
          operation: 'transcribeAudio.success',
          requestId: 'test-request-id',
          transcriptionLength: 18
        })
      );
    });
  });

  describe('Geocoding Integration Logging', () => {
    let geocoding;

    beforeEach(() => {
      geocoding = new GeocodingIntegration();
    });

    it('should log geocoding operations with request ID', async () => {
      const mockGeocodeData = [
        {
          lat: '40.7128',
          lon: '-74.0060',
          display_name: 'New York, NY, USA',
          address: {
            city: 'New York',
            state: 'New York',
            country: 'United States'
          }
        }
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeocodeData)
      });

      await geocoding.geocode('New York', {}, 'test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Geocoding Integration - geocode.start:',
        expect.objectContaining({
          integration: 'Geocoding',
          operation: 'geocode.start',
          requestId: 'test-request-id',
          location: 'New York',
          provider: 'nominatim'
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Geocoding Integration - geocode.completed:',
        expect.objectContaining({
          integration: 'Geocoding',
          operation: 'geocode.completed',
          requestId: 'test-request-id',
          location: 'New York',
          success: true
        })
      );
    });

    it('should log cache operations with request ID', async () => {
      // First call to populate cache
      const mockGeocodeData = [
        {
          lat: '40.7128',
          lon: '-74.0060',
          display_name: 'New York, NY, USA',
          address: {
            city: 'New York',
            state: 'New York',
            country: 'United States'
          }
        }
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeocodeData)
      });

      await geocoding.geocode('New York', {}, 'test-request-id-1');
      
      // Second call should hit cache
      await geocoding.geocode('New York', {}, 'test-request-id-2');

      expect(logger.info).toHaveBeenCalledWith(
        'Geocoding Integration - geocode.cache.hit:',
        expect.objectContaining({
          integration: 'Geocoding',
          operation: 'geocode.cache.hit',
          requestId: 'test-request-id-2',
          location: 'New York'
        })
      );
    });
  });

  describe('Integration Health Checks', () => {
    it('should log health check operations with request ID', async () => {
      // Mock successful health checks
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      });

      mockOpenAIClient.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });

      await SearchIntegration.isHealthy('test-request-id');
      await TTSIntegration.isHealthy('test-request-id');

      expect(logger.info).toHaveBeenCalledWith(
        'Search Integration - isHealthy.start:',
        expect.objectContaining({
          integration: 'Search',
          operation: 'isHealthy.start',
          requestId: 'test-request-id'
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'TTS Integration - isHealthy.start:',
        expect.objectContaining({
          integration: 'TTS',
          operation: 'isHealthy.start',
          requestId: 'test-request-id'
        })
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with request ID and context', async () => {
      mockTwilioClient.messages.create.mockRejectedValue(new Error('API Error'));

      try {
        await TwilioIntegration.sendSMS('+1234567890', 'Test message', 'test-request-id');
      } catch (error) {
        // Expected to throw
      }

      expect(logger.error).toHaveBeenCalledWith(
        'Twilio Integration - sendSMS.error:',
        expect.objectContaining({
          integration: 'Twilio',
          operation: 'sendSMS.error',
          requestId: 'test-request-id',
          error: 'API Error'
        })
      );
    });
  });
}); 