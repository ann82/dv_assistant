import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateRequest, errorHandler, requestLogger, rateLimiter } from '../middleware/validation.js';
import logger from '../lib/logger.js';

vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Validation Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      originalUrl: '/test',
      method: 'POST',
      get: vi.fn(),
      ip: '127.0.0.1'
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      on: vi.fn()
    };
    mockNext = vi.fn();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
  });

  describe('validateRequest', () => {
    it('should pass validation for valid twilioVoice request', () => {
      mockReq.body = {
        CallSid: 'CA1234567890',
        SpeechResult: 'Hello world'
      };

      validateRequest('twilioVoice')(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation for missing CallSid', () => {
      mockReq.body = {
        SpeechResult: 'Hello world'
      };

      validateRequest('twilioVoice')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['CallSid is required']
      });
    });

    it('should fail validation for invalid CallSid type', () => {
      mockReq.body = {
        CallSid: 123,
        SpeechResult: 'Hello world'
      };

      validateRequest('twilioVoice')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['CallSid must be a string']
      });
    });

    it('should pass validation for valid twilioSMS request', () => {
      mockReq.body = {
        From: '+1234567890',
        Body: 'Hello'
      };

      validateRequest('twilioSMS')(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation for missing SMS fields', () => {
      mockReq.body = {
        From: '+1234567890'
      };

      validateRequest('twilioSMS')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['Body is required']
      });
    });

    it('should pass validation for valid webSpeech request', () => {
      mockReq.body = {
        speechResult: 'Hello world'
      };

      validateRequest('webSpeech')(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation for empty speechResult', () => {
      mockReq.body = {
        speechResult: '   '
      };

      validateRequest('webSpeech')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['speechResult cannot be empty']
      });
    });

    it('should pass validation for valid callStatus request', () => {
      mockReq.body = {
        CallSid: 'CA1234567890',
        CallStatus: 'completed'
      };

      validateRequest('callStatus')(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid CallStatus', () => {
      mockReq.body = {
        CallSid: 'CA1234567890',
        CallStatus: 'invalid_status'
      };

      validateRequest('callStatus')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['CallStatus must be one of: initiated, ringing, answered, completed, busy, failed, no-answer']
      });
    });

    it('should pass validation for valid recording request', () => {
      mockReq.body = {
        RecordingSid: 'RE1234567890',
        RecordingUrl: 'https://api.twilio.com/recordings/RE1234567890',
        CallSid: 'CA1234567890'
      };

      validateRequest('recording')(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should fail validation for invalid RecordingUrl', () => {
      mockReq.body = {
        RecordingSid: 'RE1234567890',
        RecordingUrl: 'not-a-url',
        CallSid: 'CA1234567890'
      };

      validateRequest('recording')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        details: ['RecordingUrl must be a valid URL']
      });
    });

    it('should handle unknown validation schema', () => {
      validateRequest('unknownSchema')(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });
  });

  describe('errorHandler', () => {
    it('should handle errors with status code', () => {
      const error = new Error('Test error');
      error.statusCode = 400;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error'
      });
    });

    it('should handle errors without status code', () => {
      const error = new Error('Internal error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.statusCode = 500;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        stack: error.stack
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('requestLogger', () => {
    it('should log request and response', () => {
      requestLogger(mockReq, mockRes, mockNext);
      expect(logger.info).toHaveBeenCalledWith('Incoming request:', expect.any(Object));
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('rateLimiter', () => {
    it('should allow requests within limit', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(i + 1);
        expect(mockRes.status).not.toHaveBeenCalled();
      }
    });

    it('should block requests over limit', () => {
      // Make more requests than the limit
      for (let i = 0; i < 101; i++) {
        rateLimiter(mockReq, mockRes, mockNext);
      }

      // The last request should be blocked
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests'
      });
    });
  });
}); 