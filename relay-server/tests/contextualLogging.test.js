import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeRequestContext,
  getCurrentContext,
  logWithContext,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logApiEndpoint,
  logIntegrationOperation,
  logPerformance,
  logSecurityEvent,
  clearRequestContext,
  createComponentLogger,
  ensureRequestContext,
  getContextSummary
} from '../lib/utils/contextualLogging.js';

// Mock the logger
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import logger from '../lib/logger.js';

describe('Contextual Logging', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      headers: {
        'x-request-id': 'test-request-123',
        'user-agent': 'test-agent',
        'x-session-id': 'test-session-456',
        'x-user-id': 'test-user-789'
      },
      method: 'POST',
      originalUrl: '/api/test',
      path: '/api/test',
      ip: '127.0.0.1',
      body: {
        CallSid: 'CA123456789',
        From: '+1234567890',
        To: '+0987654321'
      },
      // Add Express request methods
      get: function(header) {
        return this.headers[header.toLowerCase()];
      }
    };

    mockRes = {
      set: vi.fn(),
      on: vi.fn()
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    // Clear any stored context
    clearRequestContext('test-request-123');
  });

  describe('initializeRequestContext', () => {
    it('should initialize request context with all metadata', () => {
      const context = initializeRequestContext(mockReq);

      expect(context).toEqual({
        requestId: 'test-request-123',
        method: 'POST',
        url: '/api/test',
        path: '/api/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
        callSid: 'CA123456789',
        from: '+1234567890',
        to: '+0987654321',
        sessionId: 'test-session-456',
        userId: 'test-user-789'
      });

      expect(mockReq.requestContext).toEqual(context);
      expect(mockReq.id).toBe('test-request-123');
    });

    it('should generate request ID if not provided', () => {
      delete mockReq.headers['x-request-id'];
      
      const context = initializeRequestContext(mockReq);
      
      expect(context.requestId).toBeDefined();
      expect(typeof context.requestId).toBe('string');
      expect(context.requestId.length).toBeGreaterThan(0);
    });

    it('should handle missing optional fields', () => {
      const minimalReq = {
        method: 'GET',
        originalUrl: '/test',
        path: '/test',
        headers: {},
        get: function(header) {
          return this.headers[header.toLowerCase()];
        }
      };

      const context = initializeRequestContext(minimalReq);

      expect(context).toEqual({
        requestId: expect.any(String),
        method: 'GET',
        url: '/test',
        path: '/test',
        userAgent: undefined,
        ip: undefined,
        timestamp: expect.any(String),
        callSid: undefined,
        from: undefined,
        to: undefined,
        sessionId: undefined,
        userId: undefined
      });
    });
  });

  describe('getCurrentContext', () => {
    it('should return context for existing request ID', () => {
      const context = initializeRequestContext(mockReq);
      const retrieved = getCurrentContext('test-request-123');

      expect(retrieved).toEqual(context);
    });

    it('should return empty object for non-existent request ID', () => {
      const retrieved = getCurrentContext('non-existent');
      expect(retrieved).toEqual({});
    });

    it('should return empty object when no request ID provided', () => {
      const retrieved = getCurrentContext();
      expect(retrieved).toEqual({});
    });
  });

  describe('logWithContext', () => {
    it('should log with contextual metadata', () => {
      const context = initializeRequestContext(mockReq);
      
      logWithContext('info', 'Test message', { testData: 'value' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith('Test message', {
        ...context,
        testData: 'value',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });

    it('should log without context when request ID not found', () => {
      logWithContext('warn', 'Test warning', { testData: 'value' }, 'non-existent');

      expect(logger.warn).toHaveBeenCalledWith('Test warning', {
        testData: 'value',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logOperationStart', () => {
    it('should log operation start with context', () => {
      const context = initializeRequestContext(mockReq);
      
      logOperationStart('test operation', { data: 'value' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith('test operation started', {
        ...context,
        operation: 'test operation',
        data: 'value',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logOperationSuccess', () => {
    it('should log operation success with context', () => {
      const context = initializeRequestContext(mockReq);
      
      logOperationSuccess('test operation', { result: 'success' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith('test operation completed successfully', {
        ...context,
        operation: 'test operation',
        success: true,
        result: 'success',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logOperationError', () => {
    it('should log operation error with context', () => {
      const context = initializeRequestContext(mockReq);
      const error = new Error('Test error');
      error.name = 'TestError';
      error.code = 'TEST_ERROR';
      
      logOperationError('test operation', error, { additional: 'data' }, 'test-request-123');

      expect(logger.error).toHaveBeenCalledWith('test operation failed', {
        ...context,
        operation: 'test operation',
        error: 'Test error',
        errorName: 'TestError',
        errorCode: 'TEST_ERROR',
        errorStack: error.stack,
        additional: 'data',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logApiEndpoint', () => {
    it('should log API endpoint with context', () => {
      const context = initializeRequestContext(mockReq);
      
      // Corrected: do not pass 'info' as requestId
      logApiEndpoint('/api/test', 'POST', { param: 'value' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith(
        'API POST /api/test',
        expect.objectContaining({
          requestId: context.requestId,
          method: context.method,
          url: context.url,
          path: context.path,
          userAgent: context.userAgent,
          ip: context.ip,
          callSid: context.callSid,
          from: '123-***-7890',
          to: '098-***-4321',
          sessionId: context.sessionId,
          userId: context.userId,
          endpoint: '/api/test',
          param: 'value',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('logIntegrationOperation', () => {
    it('should log integration operation with context', () => {
      const context = initializeRequestContext(mockReq);
      
      logIntegrationOperation('Twilio', 'send message', { messageId: '123' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith('Twilio integration - send message', {
        ...context,
        integration: 'Twilio',
        operation: 'send message',
        messageId: '123',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logPerformance', () => {
    it('should log performance as info for fast operations', () => {
      const context = initializeRequestContext(mockReq);
      
      logPerformance('test operation', 500, { metric: 'value' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith('test operation performance', {
        ...context,
        operation: 'test operation',
        duration: '500ms',
        durationMs: 500,
        metric: 'value',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });

    it('should log performance as warn for slow operations', () => {
      const context = initializeRequestContext(mockReq);
      
      logPerformance('test operation', 1500, { metric: 'value' }, 'test-request-123');

      expect(logger.warn).toHaveBeenCalledWith('test operation performance', {
        ...context,
        operation: 'test operation',
        duration: '1500ms',
        durationMs: 1500,
        metric: 'value',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event with context', () => {
      const context = initializeRequestContext(mockReq);
      
      logSecurityEvent('invalid_signature', { ip: '192.168.1.1' }, 'test-request-123');

      expect(logger.warn).toHaveBeenCalledWith('Security event: invalid_signature', {
        ...context,
        securityEvent: 'invalid_signature',
        ip: '192.168.1.1',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('clearRequestContext', () => {
    it('should clear request context', () => {
      const context = initializeRequestContext(mockReq);
      
      // Verify context exists
      expect(getCurrentContext('test-request-123')).toEqual(context);
      
      // Clear context
      clearRequestContext('test-request-123');
      
      // Verify context is cleared
      expect(getCurrentContext('test-request-123')).toEqual({});
    });

    it('should handle clearing non-existent context', () => {
      expect(() => clearRequestContext('non-existent')).not.toThrow();
    });
  });

  describe('createComponentLogger', () => {
    it('should create component logger with all methods', () => {
      const componentLogger = createComponentLogger('TestComponent');
      
      expect(componentLogger.info).toBeDefined();
      expect(componentLogger.warn).toBeDefined();
      expect(componentLogger.error).toBeDefined();
      expect(componentLogger.debug).toBeDefined();
      expect(componentLogger.operationStart).toBeDefined();
      expect(componentLogger.operationSuccess).toBeDefined();
      expect(componentLogger.operationError).toBeDefined();
    });

    it('should log with component context', () => {
      const context = initializeRequestContext(mockReq);
      const componentLogger = createComponentLogger('TestComponent');
      
      componentLogger.info('Test message', { data: 'value' }, 'test-request-123');

      expect(logger.info).toHaveBeenCalledWith('Test message', {
        ...context,
        component: 'TestComponent',
        data: 'value',
        from: '123-***-7890',
        to: '098-***-4321',
        timestamp: expect.any(String)
      });
    });
  });

  describe('ensureRequestContext', () => {
    it('should initialize context if not present', () => {
      ensureRequestContext(mockReq, mockRes, mockNext);

      expect(mockReq.requestContext).toBeDefined();
      expect(mockReq.id).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not reinitialize existing context', () => {
      const originalContext = { requestId: 'existing', method: 'GET' };
      mockReq.requestContext = originalContext;
      mockReq.id = 'existing';

      ensureRequestContext(mockReq, mockRes, mockNext);

      expect(mockReq.requestContext).toBe(originalContext);
      expect(mockReq.id).toBe('existing');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getContextSummary', () => {
    it('should return context summary', () => {
      const context = initializeRequestContext(mockReq);
      const summary = getContextSummary('test-request-123');

      expect(summary).toEqual({
        requestId: context.requestId,
        method: context.method,
        path: context.path,
        callSid: context.callSid,
        from: context.from,
        to: context.to,
        sessionId: context.sessionId,
        userId: context.userId,
        timestamp: context.timestamp
      });
    });

    it('should return empty summary for non-existent context', () => {
      const summary = getContextSummary('non-existent');

      expect(summary).toEqual({
        requestId: undefined,
        method: undefined,
        path: undefined,
        callSid: undefined,
        from: undefined,
        to: undefined,
        sessionId: undefined,
        userId: undefined,
        timestamp: undefined
      });
    });
  });
}); 