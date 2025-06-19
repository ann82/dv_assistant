import { vi } from 'vitest';

// Global mock variables
global.mockTwilioVoiceHandler = {
  validateTwilioRequest: vi.fn(),
  handleIncomingCall: vi.fn(),
  handleSpeechInput: vi.fn(),
  processSpeechInput: vi.fn()
};

// Mock all dependencies
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(() => ({
    audio: { speech: { create: vi.fn() } },
    chat: { completions: { create: vi.fn() } }
  }));
  return { OpenAI, default: OpenAI };
});

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    twiml: {
      VoiceResponse: vi.fn(() => ({
        say: vi.fn().mockReturnThis(),
        gather: vi.fn().mockReturnThis(),
        toString: vi.fn().mockReturnValue('<Response><Say>Test</Say></Response>')
      }))
    }
  }))
}));

vi.mock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'test_account_sid',
    TWILIO_AUTH_TOKEN: 'test_auth_token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    twilio: {
      accountSid: 'test_account_sid',
      authToken: 'test_auth_token',
      phoneNumber: '+1234567890'
    }
  }
}));

vi.mock('../lib/twilioVoice.js', () => ({
  TwilioVoiceHandler: vi.fn(() => global.mockTwilioVoiceHandler)
}));

vi.mock('../lib/twilio.js', () => ({
  validateTwilioRequest: (req, res, next) => next()
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
  default: {
    config: vi.fn()
  }
}));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = 'test_phone_number'; 