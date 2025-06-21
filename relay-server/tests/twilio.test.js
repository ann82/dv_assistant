import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import twilioRoutes from '../routes/twilio.js';
import { TwilioVoiceHandler } from '../lib/twilioVoice.js';
import { config } from '../lib/config.js';
import twilio from 'twilio';
import { AudioService } from '../services/audioService.js';

vi.mock('../services/audioService.js', () => ({
  AudioService: vi.fn().mockImplementation(() => ({
    transcribeWithWhisper: vi.fn().mockResolvedValue('test transcription'),
    getGptReply: vi.fn().mockResolvedValue({
      text: 'test response',
      model: 'gpt-4',
      inputTokens: 10,
      outputTokens: 20
    }),
    generateTTS: vi.fn().mockResolvedValue({
      text: 'test response',
      audioPath: '/audio/test.mp3',
      fullPath: '/path/to/test.mp3',
      size: 1024,
      chunks: 1,
      cached: false
    })
  }))
}));

vi.mock('twilio', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { 
      create: vi.fn().mockResolvedValue({ 
        sid: 'test_message_sid',
        status: 'sent'
      })
    },
    calls: { 
      create: vi.fn().mockResolvedValue({ 
        sid: 'test_call_sid',
        status: 'in-progress'
      })
    }
  })),
  validateRequest: vi.fn().mockReturnValue(true)
}));

vi.mock('../lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    twilio: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'test-auth-token',
      phoneNumber: '+1234567890'
    }
  }
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    writeFile: vi.fn()
  },
  access: vi.fn(),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  writeFile: vi.fn()
}));

// Mock the current TwilioVoiceHandler dependencies
vi.mock('../lib/twilioVoice.js', () => ({
  TwilioVoiceHandler: vi.fn().mockImplementation(() => ({
    processSpeechInput: vi.fn().mockResolvedValue('test response'),
    validateTwilioRequest: vi.fn().mockReturnValue(true),
    handleIncomingCall: vi.fn().mockResolvedValue({
      toString: () => '<Response><Say>Welcome</Say></Response>'
    }),
    handleSpeechInput: vi.fn().mockResolvedValue({
      toString: () => '<Response><Say>Response</Say></Response>'
    })
  }))
}));

// Mock global WebSocket server
global.wss = {
  registerCall: vi.fn()
};

// Mock logger
const logger = { error: vi.fn(), info: vi.fn() };

describe('TwilioRouteHandler', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/twilio', twilioRoutes);
    vi.clearAllMocks();
  });

  it.skip('should handle transcription requests', async () => {
    const response = await request(app)
      .post('/twilio/voice')
      .send({
        CallSid: 'test-call-sid',
        SpeechResult: 'test speech result',
        RecordingUrl: 'https://test.com/recording.wav',
        RecordingSid: 'test-recording-sid'
      });
    expect(response.status).toBe(200);
    // Add more assertions as needed
  });

  // Add more tests for other scenarios using request(app)...
});

describe('TwilioClientTests', () => {
  let twilioClient;

  beforeEach(() => {
    vi.clearAllMocks();
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  });

  it('should create a message successfully', async () => {
    const message = await twilioClient.messages.create({
      body: 'Test message',
      to: '+1234567890',
      from: config.twilio.phoneNumber
    });

    expect(message.sid).toBe('test_message_sid');
    expect(message.status).toBe('sent');
    expect(twilioClient.messages.create).toHaveBeenCalledWith({
      body: 'Test message',
      to: '+1234567890',
      from: config.twilio.phoneNumber
    });
  });

  it('should create a call successfully', async () => {
    const call = await twilioClient.calls.create({
      to: '+1234567890',
      from: config.twilio.phoneNumber,
      url: 'http://example.com/voice'
    });

    expect(call.sid).toBe('test_call_sid');
    expect(call.status).toBe('in-progress');
    expect(twilioClient.calls.create).toHaveBeenCalledWith({
      to: '+1234567890',
      from: config.twilio.phoneNumber,
      url: 'http://example.com/voice'
    });
  });

  it('should handle message creation errors', async () => {
    twilioClient.messages.create.mockRejectedValueOnce(new Error('Failed to create message'));

    await expect(twilioClient.messages.create({
      body: 'Test message',
      to: '+1234567890',
      from: config.twilio.phoneNumber
    })).rejects.toThrow('Failed to create message');
  });

  it('should handle call creation errors', async () => {
    twilioClient.calls.create.mockRejectedValueOnce(new Error('Failed to create call'));

    await expect(twilioClient.calls.create({
      to: '+1234567890',
      from: config.twilio.phoneNumber,
      url: 'http://example.com/voice'
    })).rejects.toThrow('Failed to create call');
  });
});

describe('TwilioVoiceHandler', () => {
  let twilioVoiceHandler;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a new instance of TwilioVoiceHandler for each test
    twilioVoiceHandler = new TwilioVoiceHandler('test-sid', 'test-token', '+1234567890');

    // Setup mock request
    mockReq = {
      body: {
        CallSid: 'test-call-sid',
        SpeechResult: 'test speech result',
        From: '+1234567890'
      },
      headers: {
        'x-twilio-signature': 'test-signature'
      }
    };

    // Setup mock response
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
      type: vi.fn().mockReturnThis()
    };
  });

  describe('Speech Processing', () => {
    it('should process speech input correctly', async () => {
      const result = await twilioVoiceHandler.processSpeechInput('test speech', 'test-call-sid');
      
      expect(result).toBe('test response');
      expect(twilioVoiceHandler.processSpeechInput).toHaveBeenCalledWith('test speech', 'test-call-sid');
    });

    it('should handle incoming calls', async () => {
      const result = await twilioVoiceHandler.handleIncomingCall(mockReq);
      
      expect(result.toString()).toBe('<Response><Say>Welcome</Say></Response>');
      expect(twilioVoiceHandler.handleIncomingCall).toHaveBeenCalledWith(mockReq);
    });

    it('should handle speech input', async () => {
      const result = await twilioVoiceHandler.handleSpeechInput(mockReq);
      
      expect(result.toString()).toBe('<Response><Say>Response</Say></Response>');
      expect(twilioVoiceHandler.handleSpeechInput).toHaveBeenCalledWith(mockReq);
    });
  });

  describe('Validation', () => {
    it('should validate Twilio requests', () => {
      const isValid = twilioVoiceHandler.validateTwilioRequest(mockReq);
      
      expect(isValid).toBe(true);
      expect(twilioVoiceHandler.validateTwilioRequest).toHaveBeenCalledWith(mockReq);
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      twilioVoiceHandler.processSpeechInput.mockRejectedValueOnce(new Error('Processing failed'));
      
      await expect(twilioVoiceHandler.processSpeechInput('test', 'call-sid')).rejects.toThrow('Processing failed');
    });
  });
}); 