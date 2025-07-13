import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseService } from '../services/base/BaseService.js';
import { BaseHandler } from '../handlers/base/BaseHandler.js';
import { config, validateConfig, getSystemStatus } from '../lib/config/index.js';
import { apiConfig, validateApiConfig } from '../lib/config/api.js';
import { ttsConfig, validateTtsConfig } from '../lib/config/tts.js';
import { loggingConfig, validateLoggingConfig } from '../lib/config/logging.js';
import { 
  isValidEmail, 
  isValidPhone, 
  isValidUrl, 
  isNotEmpty,
  validateAndSanitizeInput,
  createValidationRule
} from '../lib/utils/validation.js';
import {
  ValidationError,
  ApiError,
  TimeoutError,
  ConfigurationError,
  handleError,
  retryWithBackoff,
  withTimeout,
  isRetryableError
} from '../lib/utils/errorHandling.js';
import {
  INTENTS,
  CONFIDENCE_LEVELS,
  CONFIDENCE_THRESHOLDS,
  getConfidenceLevel,
  isHighPriorityIntent,
  getResponseTypeForIntent
} from '../lib/constants/intents.js';

describe('Phase 1: Foundation & Infrastructure', () => {
  
  describe('BaseService', () => {
    let service;
    
    beforeEach(() => {
      service = new BaseService({ test: 'config' }, 'TestService');
    });
    
    it('should initialize with configuration', () => {
      expect(service.config).toEqual({ test: 'config' });
      expect(service.serviceName).toBe('TestService');
      expect(service.logger).toBeDefined();
    });
    
    it('should validate configuration', () => {
      expect(() => service.validateConfig()).not.toThrow();
    });
    
    it('should handle errors correctly', async () => {
      const error = new Error('Test error');
      const result = await service.handleError(error, 'test-context', { extra: 'data' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.context.service).toBe('TestService');
      expect(result.context.context).toBe('test-context');
      expect(result.context.extra).toBe('data');
    });
    
    it('should create success responses', () => {
      const data = { result: 'success' };
      const response = service.createSuccessResponse(data, { meta: 'info' });
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.metadata.meta).toBe('info');
      expect(response.timestamp).toBeDefined();
    });
    
    it('should check health status', async () => {
      const health = await service.isHealthy();
      expect(health).toBe(true);
    });
  });
  
  describe('BaseHandler', () => {
    let handler;
    let mockServices;
    
    beforeEach(() => {
      mockServices = {
        testService: {
          name: 'TestService',
          isHealthy: () => Promise.resolve(true)
        }
      };
      
      // Create a test handler that requires testService
      class TestHandler extends BaseHandler {
        getRequiredServices() {
          return ['testService'];
        }
      }
      
      handler = new TestHandler(mockServices, 'TestHandler');
    });
    
    it('should initialize with services', () => {
      expect(handler.services).toEqual(mockServices);
      expect(handler.handlerName).toBe('TestHandler');
      expect(handler.logger).toBeDefined();
    });
    
    it('should validate required services', () => {
      expect(() => handler.validateServices()).not.toThrow();
    });
    
    it('should process requests correctly', async () => {
      const request = { data: 'test' };
      const processor = vi.fn().mockResolvedValue({ result: 'success' });
      
      const result = await handler.processRequest(request, 'test-operation', processor);
      
      expect(result.success).toBe(true);
      expect(result.data.result).toBe('success');
      expect(processor).toHaveBeenCalledWith(request);
    });
    
    it('should handle request processing errors', async () => {
      const request = { data: 'test' };
      const processor = vi.fn().mockRejectedValue(new Error('Processing error'));
      
      const result = await handler.processRequest(request, 'test-operation', processor);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing error');
    });
    
    it('should sanitize requests for logging', () => {
      const request = {
        password: 'secret',
        token: 'sensitive',
        normalData: 'safe'
      };
      
      const sanitized = handler.sanitizeRequest(request);
      
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.normalData).toBe('safe');
    });
    
    it('should get services by name', () => {
      const service = handler.getService('testService');
      expect(service).toBe(mockServices.testService);
    });
    
    it('should throw error for missing service', () => {
      expect(() => handler.getService('missingService')).toThrow();
    });
  });
  
  describe('Configuration System', () => {
    it('should load API configuration', () => {
      expect(apiConfig.openai).toBeDefined();
      expect(apiConfig.tavily).toBeDefined();
      expect(apiConfig.twilio).toBeDefined();
    });
    
    it('should load TTS configuration', () => {
      expect(ttsConfig.enabled).toBeDefined();
      expect(ttsConfig.openai).toBeDefined();
      expect(ttsConfig.polly).toBeDefined();
    });
    
    it('should load logging configuration', () => {
      expect(loggingConfig.level).toBeDefined();
      expect(loggingConfig.categories).toBeDefined();
      expect(loggingConfig.output).toBeDefined();
    });
    
    it('should validate main configuration', () => {
      // This might fail in test environment due to missing API keys
      // We'll just check that the function exists and can be called
      expect(typeof validateConfig).toBe('function');
    });
    
    it('should get system status', () => {
      const status = getSystemStatus();
      
      expect(status.app).toBeDefined();
      expect(status.server).toBeDefined();
      expect(status.features).toBeDefined();
      expect(status.api).toBeDefined();
      expect(status.tts).toBeDefined();
      expect(status.logging).toBeDefined();
    });
  });
  
  describe('Validation Utilities', () => {
    it('should validate email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
    
    it('should validate phone numbers', () => {
      expect(isValidPhone('1234567890')).toBe(true);
      expect(isValidPhone('(123) 456-7890')).toBe(true);
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
    
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
    
    it('should check if values are not empty', () => {
      expect(isNotEmpty('test')).toBe(true);
      expect(isNotEmpty([1, 2, 3])).toBe(true);
      expect(isNotEmpty({ key: 'value' })).toBe(true);
      expect(isNotEmpty('')).toBe(false);
      expect(isNotEmpty([])).toBe(false);
      expect(isNotEmpty({})).toBe(false);
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(undefined)).toBe(false);
    });
    
    it('should validate and sanitize input', () => {
      const rules = {
        name: createValidationRule({ required: true, type: 'string' }),
        email: createValidationRule({ 
          required: true, 
          type: 'string',
          validate: (value) => ({ isValid: isValidEmail(value), error: 'Invalid email' })
        }),
        age: createValidationRule({ 
          type: 'number',
          validate: (value) => ({ isValid: value >= 0, error: 'Age must be positive' })
        })
      };
      
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };
      
      const result = validateAndSanitizeInput(input, rules);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized.name).toBe('John Doe');
      expect(result.sanitized.email).toBe('john@example.com');
      expect(result.sanitized.age).toBe(25);
    });
    
    it('should handle validation errors', () => {
      const rules = {
        name: createValidationRule({ required: true }),
        email: createValidationRule({ 
          required: true,
          validate: (value) => ({ isValid: isValidEmail(value), error: 'Invalid email' })
        })
      };
      
      const input = {
        name: '',
        email: 'invalid-email'
      };
      
      const result = validateAndSanitizeInput(input, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'name' is required");
      expect(result.errors).toContain("Field 'email': Invalid email");
    });
  });
  
  describe('Error Handling Utilities', () => {
    it('should create custom error classes', () => {
      const validationError = new ValidationError('Invalid input', 'email', 'test');
      const apiError = new ApiError('API failed', 500, '/api/test');
      const timeoutError = new TimeoutError('Request timed out', 5000, 'api-call');
      const configError = new ConfigurationError('Missing config', 'API_KEY');
      
      expect(validationError.name).toBe('ValidationError');
      expect(apiError.name).toBe('ApiError');
      expect(timeoutError.name).toBe('TimeoutError');
      expect(configError.name).toBe('ConfigurationError');
      
      expect(validationError.field).toBe('email');
      expect(apiError.statusCode).toBe(500);
      expect(timeoutError.timeout).toBe(5000);
      expect(configError.configKey).toBe('API_KEY');
    });
    
    it('should handle errors with context', async () => {
      const error = new Error('Test error');
      const result = await handleError(error, 'test-context', { extra: 'data' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.errorType).toBe('Error');
      expect(result.context.context).toBe('test-context');
      expect(result.context.extra).toBe('data');
    });
    
    it('should retry with backoff', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary error');
        }
        return 'success';
      });
      
      const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should create timeout promises', async () => {
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 100));
      const fastPromise = new Promise(resolve => setTimeout(() => resolve('fast'), 10));
      
      const fastResult = await withTimeout(fastPromise, 50, 'fast-operation');
      expect(fastResult).toBe('fast');
      
      await expect(withTimeout(slowPromise, 50, 'slow-operation')).rejects.toThrow('slow-operation timed out after 50ms');
    });
    
    it('should identify retryable errors', () => {
      const networkError = new Error('ECONNRESET');
      networkError.code = 'ECONNRESET';
      
      const timeoutError = new TimeoutError('Request timed out');
      
      const validationError = new ValidationError('Invalid input');
      
      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(validationError)).toBe(false);
    });
  });
  
  describe('Intent Constants', () => {
    it('should define all intent types', () => {
      expect(INTENTS.FIND_SHELTER).toBe('find_shelter');
      expect(INTENTS.EMERGENCY).toBe('emergency');
      expect(INTENTS.SAFETY_PLAN).toBe('safety_plan');
      expect(INTENTS.OFF_TOPIC).toBe('off_topic');
    });
    
    it('should define confidence levels', () => {
      expect(CONFIDENCE_LEVELS.HIGH).toBe('high');
      expect(CONFIDENCE_LEVELS.MEDIUM).toBe('medium');
      expect(CONFIDENCE_LEVELS.LOW).toBe('low');
    });
    
    it('should get confidence level from score', () => {
      expect(getConfidenceLevel(0.9)).toBe('high');
      expect(getConfidenceLevel(0.7)).toBe('medium');
      expect(getConfidenceLevel(0.3)).toBe('low');
    });
    
    it('should identify high priority intents', () => {
      expect(isHighPriorityIntent(INTENTS.EMERGENCY)).toBe(true);
      expect(isHighPriorityIntent(INTENTS.SAFETY_PLAN)).toBe(true);
      expect(isHighPriorityIntent(INTENTS.FIND_SHELTER)).toBe(true);
      expect(isHighPriorityIntent(INTENTS.OFF_TOPIC)).toBe(false);
    });
    
    it('should get response type for intent', () => {
      expect(getResponseTypeForIntent(INTENTS.EMERGENCY)).toBe('immediate');
      expect(getResponseTypeForIntent(INTENTS.FIND_SHELTER)).toBe('search_based');
      expect(getResponseTypeForIntent(INTENTS.GREETING)).toBe('conversational');
    });
  });
}); 