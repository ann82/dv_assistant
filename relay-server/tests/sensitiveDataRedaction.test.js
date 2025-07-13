import { describe, it, expect, beforeEach } from 'vitest';
import {
  SENSITIVE_PATTERNS,
  REDACTION_CONFIG,
  redactString,
  redactObject,
  redactRequest,
  redactResponse,
  redactError,
  createRedactionFunction,
  redactLogData,
  containsSensitiveData,
  getRedactionSummary
} from '../lib/utils/sensitiveDataRedaction.js';

describe('Sensitive Data Redaction', () => {
  let mockReq;
  let mockRes;
  let mockError;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      originalUrl: '/api/test',
      path: '/api/test',
      headers: {
        'authorization': 'Bearer sk-1234567890abcdef1234567890abcdef1234567890abcdef',
        'x-api-key': 'TEST_ACCOUNT_SID_FOR_TESTING_ONLY',
        'user-agent': 'test-agent'
      },
      body: {
        password: 'secretpassword123',
        apiKey: 'sk-abcdef1234567890abcdef1234567890abcdef1234567890',
        phoneNumber: '+1-555-123-4567',
        email: 'test@example.com'
      },
      query: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      },
      params: {},
      ip: '192.168.1.1',
      get: function(header) {
        return this.headers[header.toLowerCase()];
      }
    };

    mockRes = {
      statusCode: 200,
      getHeaders: () => ({
        'content-type': 'application/json',
        'authorization': 'Bearer sk-1234567890abcdef1234567890abcdef1234567890abcdef'
      })
    };

    mockError = new Error('Database connection failed: mongodb://user:password@localhost:27017/db');
    mockError.name = 'DatabaseError';
    mockError.code = 'DB_CONNECTION_FAILED';
    mockError.statusCode = 500;
  });

  describe('SENSITIVE_PATTERNS', () => {
    it('should have all required patterns', () => {
      expect(SENSITIVE_PATTERNS.OPENAI_API_KEY).toBeDefined();
      expect(SENSITIVE_PATTERNS.TWILIO_ACCOUNT_SID).toBeDefined();
      expect(SENSITIVE_PATTERNS.TWILIO_AUTH_TOKEN).toBeDefined();
      expect(SENSITIVE_PATTERNS.API_KEYS).toBeDefined();
      expect(SENSITIVE_PATTERNS.PASSWORDS).toBeDefined();
      expect(SENSITIVE_PATTERNS.TOKENS).toBeDefined();
      expect(SENSITIVE_PATTERNS.PHONE_NUMBERS).toBeDefined();
      expect(SENSITIVE_PATTERNS.EMAIL_ADDRESSES).toBeDefined();
      expect(SENSITIVE_PATTERNS.CREDIT_CARDS).toBeDefined();
      expect(SENSITIVE_PATTERNS.SSN).toBeDefined();
      expect(SENSITIVE_PATTERNS.IP_ADDRESSES).toBeDefined();
      expect(SENSITIVE_PATTERNS.JWT_TOKENS).toBeDefined();
    });
  });

  describe('REDACTION_CONFIG', () => {
    it('should have proper configuration structure', () => {
      expect(REDACTION_CONFIG.enabled).toBeDefined();
      expect(REDACTION_CONFIG.replacementText).toBeDefined();
      expect(REDACTION_CONFIG.partialRedaction).toBeDefined();
    });

    it('should have sensible default settings', () => {
      expect(REDACTION_CONFIG.enabled.apiKeys).toBe(true);
      expect(REDACTION_CONFIG.enabled.passwords).toBe(true);
      expect(REDACTION_CONFIG.enabled.tokens).toBe(true);
      expect(REDACTION_CONFIG.enabled.emailAddresses).toBe(false); // Often needed for debugging
      expect(REDACTION_CONFIG.enabled.ipAddresses).toBe(false); // Often needed for debugging
    });
  });

  describe('redactString', () => {
    it('should redact OpenAI API keys', () => {
      const text = 'API key: sk-1234567890abcdef1234567890abcdef1234567890abcdef';
      const redacted = redactString(text);
      expect(redacted).toBe('API key: [REDACTED]');
    });

    it('should redact Twilio Account SID', () => {
      const text = 'Account SID: AC12345678901234567890123456789012';
      const redacted = redactString(text);
      expect(redacted).toBe('Account SID: [REDACTED]');
    });

    it('should redact passwords', () => {
      const text = 'password: secretpassword123';
      const redacted = redactString(text);
      expect(redacted).toBe('password: [REDACTED]');
    });

    it('should redact JWT tokens', () => {
      const text = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const redacted = redactString(text);
      expect(redacted).toBe('token: [REDACTED]');
    });

    it('should partially redact phone numbers', () => {
      const text = 'Phone: +1-555-123-4567';
      const redacted = redactString(text);
      expect(redacted).toBe('Phone: 555-***-4567');
    });

    it('should not redact email addresses by default', () => {
      const text = 'Email: test@example.com';
      const redacted = redactString(text);
      expect(redacted).toBe('Email: test@example.com');
    });

    it('should handle non-string input', () => {
      expect(redactString(null)).toBe(null);
      expect(redactString(undefined)).toBe(undefined);
      expect(redactString(123)).toBe(123);
      expect(redactString({})).toEqual({});
    });
  });

  describe('redactObject', () => {
    it('should redact sensitive data in objects', () => {
      const data = {
        username: 'testuser',
        password: 'secretpassword123',
        apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef',
        phone: '+1-555-123-4567',
        email: 'test@example.com'
      };

      const redacted = redactObject(data);

      expect(redacted.username).toBe('testuser');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.phone).toBe('555-***-4567');
      expect(redacted.email).toBe('test@example.com'); // Not redacted by default
    });

    it('should redact sensitive data in arrays', () => {
      const data = [
        { name: 'user1', password: 'pass1' },
        { name: 'user2', password: 'pass2' }
      ];

      const redacted = redactObject(data);

      expect(redacted[0].name).toBe('user1');
      expect(redacted[0].password).toBe('[REDACTED]');
      expect(redacted[1].name).toBe('user2');
      expect(redacted[1].password).toBe('[REDACTED]');
    });

    it('should handle circular references', () => {
      const obj = { name: 'test' };
      obj.self = obj;

      const redacted = redactObject(obj);

      expect(redacted.name).toBe('test');
      expect(redacted.self).toBe('[CIRCULAR_REFERENCE]');
    });

    it('should preserve safe keys', () => {
      const data = {
        timestamp: '2023-01-01T00:00:00Z',
        requestId: 'req-123',
        operation: 'test',
        level: 'info',
        message: 'test message',
        password: 'secret'
      };

      const redacted = redactObject(data);

      expect(redacted.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(redacted.requestId).toBe('req-123');
      expect(redacted.operation).toBe('test');
      expect(redacted.level).toBe('info');
      expect(redacted.message).toBe('test message');
      expect(redacted.password).toBe('[REDACTED]');
    });
  });

  describe('redactRequest', () => {
    it('should redact sensitive data from request object', () => {
      const redacted = redactRequest(mockReq);

      expect(redacted.method).toBe('POST');
      expect(redacted.path).toBe('/api/test');
      expect(redacted.headers.authorization).toBe('[REDACTED]');
      expect(redacted.headers['x-api-key']).toBe('[REDACTED]');
      expect(redacted.headers['user-agent']).toBe('test-agent');
      expect(redacted.body.password).toBe('[REDACTED]');
      expect(redacted.body.apiKey).toBe('[REDACTED]');
      expect(redacted.body.phoneNumber).toBe('555-***-4567');
      expect(redacted.body.email).toBe('test@example.com');
      expect(redacted.query.token).toBe('[REDACTED]');
      expect(redacted.ip).toBe('192.168.1.1'); // Not redacted by default
    });

    it('should handle null request', () => {
      expect(redactRequest(null)).toBe(null);
    });
  });

  describe('redactResponse', () => {
    it('should redact sensitive data from response object', () => {
      const redacted = redactResponse(mockRes);

      expect(redacted.statusCode).toBe(200);
      expect(redacted.headers['content-type']).toBe('application/json');
      expect(redacted.headers.authorization).toBe('[REDACTED]');
    });

    it('should handle null response', () => {
      expect(redactResponse(null)).toBe(null);
    });
  });

  describe('redactError', () => {
    it('should redact sensitive data from error object', () => {
      const redacted = redactError(mockError);

      expect(redacted.name).toBe('DatabaseError');
      expect(redacted.message).toBe('Database connection failed: [REDACTED]');
      expect(redacted.code).toBe('DB_CONNECTION_FAILED');
      expect(redacted.statusCode).toBe(500);
    });

    it('should handle null error', () => {
      expect(redactError(null)).toBe(null);
    });
  });

  describe('createRedactionFunction', () => {
    it('should create a redaction function with custom config', () => {
      const customConfig = {
        enabled: {
          emailAddresses: true,
          ipAddresses: true
        }
      };

      const redact = createRedactionFunction(customConfig);
      const data = {
        email: 'test@example.com',
        ip: '192.168.1.1'
      };

      const redacted = redact(data);

      expect(redacted.email).toBe('[REDACTED]');
      expect(redacted.ip).toBe('[REDACTED]');
    });
  });

  describe('redactLogData', () => {
    it('should redact sensitive data from log data', () => {
      const logData = {
        requestId: 'req-123',
        operation: 'test',
        password: 'secret',
        apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef'
      };

      const redacted = redactLogData(logData);

      expect(redacted.requestId).toBe('req-123');
      expect(redacted.operation).toBe('test');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect sensitive data in strings', () => {
      expect(containsSensitiveData('password: secret123')).toBe(true);
      expect(containsSensitiveData('apiKey: sk-1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(true);
      expect(containsSensitiveData('token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBe(true);
      expect(containsSensitiveData('Phone: +1-555-123-4567')).toBe(true);
    });

    it('should not detect sensitive data in safe strings', () => {
      expect(containsSensitiveData('Hello world')).toBe(false);
      expect(containsSensitiveData('test@example.com')).toBe(false); // Email not redacted by default
      expect(containsSensitiveData('192.168.1.1')).toBe(false); // IP not redacted by default
    });

    it('should handle non-string input', () => {
      expect(containsSensitiveData(null)).toBe(false);
      expect(containsSensitiveData(undefined)).toBe(false);
      expect(containsSensitiveData(123)).toBe(false);
      expect(containsSensitiveData({})).toBe(false);
    });
  });

  describe('getRedactionSummary', () => {
    it('should provide summary of redactions', () => {
      const original = {
        username: 'testuser',
        password: 'secret123',
        apiKey: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef',
        email: 'test@example.com'
      };

      const redacted = {
        username: 'testuser',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        email: 'test@example.com'
      };

      const summary = getRedactionSummary(original, redacted);

      expect(summary.redactions).toBe(2);
      expect(summary.types).toContain('PASSWORDS');
      expect(summary.types).toContain('OPENAI_API_KEY');
      expect(summary.fields).toContain('password');
      expect(summary.fields).toContain('apiKey');
    });

    it('should handle no redactions', () => {
      const data = { name: 'test', value: 'safe' };
      const summary = getRedactionSummary(data, data);

      expect(summary.redactions).toBe(0);
      expect(summary.types).toEqual([]);
      expect(summary.fields).toEqual([]);
    });
  });
}); 