/**
 * Performance Monitoring Tests
 * Tests for performance monitoring middleware and health check endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  performanceMonitoring,
  errorTracking,
  getPerformanceMetrics,
  getSystemHealth,
  getActiveRequests,
  resetPerformanceMetrics,
  startMemoryMonitoring,
  getMemoryUsage
} from '../middleware/performanceMonitoring.js';
import { loggingConfig } from '../lib/config/logging.js';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Performance Monitoring', () => {
  let app;
  let originalPerformanceEnabled;
  
  beforeEach(() => {
    // Enable performance monitoring for tests
    originalPerformanceEnabled = loggingConfig.performance.enabled;
    loggingConfig.performance.enabled = true;
    
    app = express();
    app.use(express.json());
    app.use(performanceMonitoring);
    
    // Add test routes
    app.get('/test', (req, res) => {
      setTimeout(() => res.json({ message: 'test' }), 10); // Add small delay for timing
    });
    
    app.get('/slow', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ message: 'slow' });
    });
    
    app.get('/error', (req, res, next) => {
      next(new Error('Test error'));
    });
    
    app.get('/validation-error', (req, res, next) => {
      const error = new Error('Validation error');
      error.name = 'ValidationError';
      next(error);
    });
    
    // Error tracking middleware must be after routes but before error handler
    app.use(errorTracking);
    
    // Custom error handler to ensure errors are caught
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message, name: err.name });
    });
    
    // Reset metrics before each test
    resetPerformanceMetrics();
  });
  
  afterEach(() => {
    // Restore original performance monitoring setting
    loggingConfig.performance.enabled = originalPerformanceEnabled;
    vi.clearAllMocks();
  });
  
  describe('performanceMonitoring middleware', () => {
    it('should track request metrics', async () => {
      await request(app).get('/test');
      
      const metrics = getPerformanceMetrics();
      
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.byMethod.GET).toBe(1);
      expect(metrics.requests.byPath['/test']).toBe(1);
      expect(metrics.requests.byStatus[200]).toBe(1);
      expect(metrics.requests.responseTimes).toBeDefined();
      expect(metrics.requests.responseTimes.avg).toBeGreaterThan(0);
    });
    
    it('should track multiple requests', async () => {
      await request(app).get('/test');
      await request(app).get('/test');
      await request(app).post('/test').send({ data: 'test' });
      
      const metrics = getPerformanceMetrics();
      
      expect(metrics.requests.total).toBe(3);
      expect(metrics.requests.byMethod.GET).toBe(2);
      expect(metrics.requests.byMethod.POST).toBe(1);
      expect(metrics.requests.byPath['/test']).toBe(3);
    });
    
    it('should track memory usage', async () => {
      await request(app).get('/test');
      
      const metrics = getPerformanceMetrics();
      
      expect(metrics.memory.current).toBeDefined();
      expect(metrics.memory.current.heapUsed).toBeGreaterThan(0);
      expect(metrics.memory.current.rss).toBeGreaterThan(0);
    });
    
    it('should not track when disabled', async () => {
      // Temporarily disable performance monitoring
      loggingConfig.performance.enabled = false;
      
      await request(app).get('/test');
      
      const metrics = getPerformanceMetrics();
      
      // Re-enable
      loggingConfig.performance.enabled = true;
      
      expect(metrics.requests.total).toBe(0);
    });
    
    it.skip('should return active requests', async () => {
      let handlerEntered = false;
      let releaseHandler;
      app.get('/slow-request2', async (req, res) => {
        handlerEntered = true;
        await new Promise(resolve => { releaseHandler = resolve; });
        res.json({ message: 'slow2' });
      });
      // Start the request
      const reqPromise = request(app).get('/slow-request2');
      // Wait until the handler is entered
      while (!handlerEntered) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      // Now check active requests
      const active = getActiveRequests();
      expect(Array.isArray(active)).toBe(true);
      expect(active.length).toBeGreaterThan(0);
      const req = active[0];
      expect(req).toHaveProperty('requestId');
      expect(req).toHaveProperty('startTime');
      expect(req).toHaveProperty('method');
      expect(req).toHaveProperty('path');
      expect(req).toHaveProperty('url');
      expect(req).toHaveProperty('duration');
      // Allow the handler to finish
      releaseHandler();
      await reqPromise;
    });
  });
  
  describe('errorTracking middleware', () => {
    it('should track error metrics', async () => {
      await request(app).get('/error');
      const metrics = getPerformanceMetrics();
      expect(metrics.errors.total).toBe(1);
      expect(metrics.errors.byType.Error).toBe(1);
      expect(metrics.errors.byPath['/error']).toBe(1);
    });
    it('should track different error types', async () => {
      await request(app).get('/validation-error');
      const metrics = getPerformanceMetrics();
      expect(metrics.errors.total).toBe(1);
      expect(metrics.errors.byType.ValidationError).toBe(1);
    });
  });
  
  describe('getPerformanceMetrics', () => {
    it('should return comprehensive metrics', async () => {
      await request(app).get('/test');
      await request(app).get('/error');
      
      const metrics = getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('timestamp');
      
      expect(metrics.requests).toHaveProperty('total');
      expect(metrics.requests).toHaveProperty('active');
      expect(metrics.requests).toHaveProperty('byMethod');
      expect(metrics.requests).toHaveProperty('byPath');
      expect(metrics.requests).toHaveProperty('byStatus');
      expect(metrics.requests).toHaveProperty('responseTimes');
      
      expect(metrics.memory).toHaveProperty('current');
      expect(metrics.memory).toHaveProperty('stats');
      expect(metrics.memory).toHaveProperty('samples');
      
      expect(metrics.errors).toHaveProperty('total');
      expect(metrics.errors).toHaveProperty('byType');
      expect(metrics.errors).toHaveProperty('byPath');
    });
    
    it('should calculate response time statistics', async () => {
      // Make multiple requests to get meaningful stats
      for (let i = 0; i < 5; i++) {
        await request(app).get('/test');
      }
      // Wait a tick for metrics to update
      await new Promise(resolve => setTimeout(resolve, 10));
      const metrics = getPerformanceMetrics();
      const stats = metrics.requests.responseTimes;
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.avg).toBeGreaterThan(0);
      expect(stats.median).toBeGreaterThan(0);
      expect(stats.p95).toBeGreaterThan(0);
      expect(stats.p99).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThanOrEqual(stats.avg);
      expect(stats.avg).toBeGreaterThanOrEqual(stats.min);
    });
  });
  
  describe('getSystemHealth', () => {
    it('should return health status', () => {
      const health = getSystemHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('timestamp');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      
      expect(health.checks).toHaveProperty('memory');
      expect(health.checks).toHaveProperty('responseTime');
      expect(health.checks).toHaveProperty('errorRate');
      
      expect(health.checks.memory).toHaveProperty('status');
      expect(health.checks.memory).toHaveProperty('value');
      expect(health.checks.memory).toHaveProperty('unit');
      expect(health.checks.memory).toHaveProperty('threshold');
    });
    
    it('should classify health correctly', () => {
      const health = getSystemHealth();
      
      // Memory health should be based on heap usage
      if (health.checks.memory.value < 512) {
        expect(health.checks.memory.status).toBe('good');
      } else if (health.checks.memory.value < 1024) {
        expect(health.checks.memory.status).toBe('warning');
      } else {
        expect(health.checks.memory.status).toBe('critical');
      }
      
      // Response time health should be based on average response time
      if (health.checks.responseTime.value < 1000) {
        expect(health.checks.responseTime.status).toBe('good');
      } else if (health.checks.responseTime.value < 3000) {
        expect(health.checks.responseTime.status).toBe('warning');
      } else {
        expect(health.checks.responseTime.status).toBe('critical');
      }
    });
  });
  
  describe('resetPerformanceMetrics', () => {
    it('should reset all metrics', async () => {
      // Make some requests to populate metrics
      await request(app).get('/test');
      await request(app).get('/error');
      
      let metrics = getPerformanceMetrics();
      expect(metrics.requests.total).toBe(2);
      expect(metrics.errors.total).toBe(1);
      
      resetPerformanceMetrics();
      metrics = getPerformanceMetrics();
      
      expect(metrics.requests.total).toBe(0);
      expect(metrics.errors.total).toBe(0);
      expect(metrics.requests.byMethod).toEqual({});
      expect(metrics.requests.byPath).toEqual({});
      expect(metrics.requests.byStatus).toEqual({});
      expect(metrics.errors.byType).toEqual({});
      expect(metrics.errors.byPath).toEqual({});
    });
  });
  
  describe('getMemoryUsage', () => {
    it('should return memory usage in MB', () => {
      const memory = getMemoryUsage();
      
      expect(memory).toHaveProperty('rss');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('external');
      expect(memory).toHaveProperty('arrayBuffers');
      
      expect(memory.rss).toBeGreaterThan(0);
      expect(memory.heapTotal).toBeGreaterThan(0);
      expect(memory.heapUsed).toBeGreaterThan(0);
      expect(memory.external).toBeGreaterThanOrEqual(0);
      expect(memory.arrayBuffers).toBeGreaterThanOrEqual(0);
      
      // All values should be in MB (reasonable range)
      expect(memory.rss).toBeLessThan(10000); // 10GB max
      expect(memory.heapTotal).toBeLessThan(10000);
      expect(memory.heapUsed).toBeLessThan(10000);
    });
  });
  
  describe('startMemoryMonitoring', () => {
    it('should start memory monitoring', () => {
      // This is mostly a smoke test since we can't easily test intervals
      expect(() => startMemoryMonitoring()).not.toThrow();
    });
  });
}); 