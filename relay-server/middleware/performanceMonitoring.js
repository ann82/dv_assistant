/**
 * Performance Monitoring Middleware
 * Tracks request/response times, memory usage, and performance metrics
 */

import logger from '../lib/logger.js';
import { loggingConfig } from '../lib/config/logging.js';

// Performance metrics storage
const performanceMetrics = {
  requests: {
    total: 0,
    byMethod: {},
    byPath: {},
    byStatus: {},
    responseTimes: []
  },
  memory: {
    samples: [],
    maxSamples: 1000
  },
  errors: {
    total: 0,
    byType: {},
    byPath: {}
  },
  activeRequests: new Map()
};

/**
 * Get current memory usage
 * @returns {Object} Memory usage information
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
  };
}

/**
 * Add memory sample
 */
function addMemorySample() {
  if (!loggingConfig.performance.enabled) return;
  
  const memoryUsage = getMemoryUsage();
  performanceMetrics.memory.samples.push({
    timestamp: Date.now(),
    ...memoryUsage
  });
  
  // Keep only recent samples
  if (performanceMetrics.memory.samples.length > performanceMetrics.memory.maxSamples) {
    performanceMetrics.memory.samples.shift();
  }
}

/**
 * Calculate performance statistics
 * @param {Array} values - Array of numeric values
 * @returns {Object} Statistics object
 */
function calculateStats(values) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;
  
  return {
    min: sorted[0],
    max: sorted[len - 1],
    avg: Math.round(values.reduce((a, b) => a + b, 0) / len),
    median: sorted[Math.floor(len / 2)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)]
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitoring(req, res, next) {
  if (!loggingConfig.performance.enabled) {
    return next();
  }
  
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const method = req.method;
  const path = req.route?.path || req.path;
  
  // Track active request
  performanceMetrics.activeRequests.set(requestId, {
    startTime,
    method,
    path,
    url: req.originalUrl
  });
  
  // Add memory sample at start
  addMemorySample();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const statusCode = res.statusCode;
    
    // Remove from active requests
    performanceMetrics.activeRequests.delete(requestId);
    
    // Update metrics
    performanceMetrics.requests.total++;
    
    // Update method metrics
    performanceMetrics.requests.byMethod[method] = 
      (performanceMetrics.requests.byMethod[method] || 0) + 1;
    
    // Update path metrics
    performanceMetrics.requests.byPath[path] = 
      (performanceMetrics.requests.byPath[path] || 0) + 1;
    
    // Update status metrics
    performanceMetrics.requests.byStatus[statusCode] = 
      (performanceMetrics.requests.byStatus[statusCode] || 0) + 1;
    
    // Add response time
    performanceMetrics.requests.responseTimes.push(responseTime);
    
    // Keep only recent response times
    if (performanceMetrics.requests.responseTimes.length > 1000) {
      performanceMetrics.requests.responseTimes.shift();
    }
    
    // Log performance if threshold exceeded
    if (responseTime > loggingConfig.performance.threshold) {
      const memoryUsage = getMemoryUsage();
      logger.warn('Slow request detected:', {
        requestId,
        method,
        path,
        responseTime,
        statusCode,
        memoryUsage,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
    
    // Add memory sample at end
    addMemorySample();
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  // Override res.json to capture response size
  const originalJson = res.json;
  res.json = function(data) {
    const responseSize = JSON.stringify(data).length;
    res.set('X-Response-Size', responseSize);
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Error tracking middleware
 */
export function errorTracking(err, req, res, next) {
  if (!loggingConfig.performance.enabled) {
    return next(err);
  }
  
  const path = req.route?.path || req.path;
  const method = req.method;
  
  // Update error metrics
  performanceMetrics.errors.total++;
  performanceMetrics.errors.byType[err.name || 'Unknown'] = 
    (performanceMetrics.errors.byType[err.name || 'Unknown'] || 0) + 1;
  performanceMetrics.errors.byPath[path] = 
    (performanceMetrics.errors.byPath[path] || 0) + 1;
  
  next(err);
}

/**
 * Get performance metrics
 * @returns {Object} Performance metrics
 */
export function getPerformanceMetrics() {
  const responseTimeStats = calculateStats(performanceMetrics.requests.responseTimes);
  const memoryStats = performanceMetrics.memory.samples.length > 0 
    ? calculateStats(performanceMetrics.memory.samples.map(s => s.heapUsed))
    : { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
  
  const currentMemory = getMemoryUsage();
  const activeRequests = performanceMetrics.activeRequests.size;
  
  return {
    requests: {
      total: performanceMetrics.requests.total,
      active: activeRequests,
      byMethod: performanceMetrics.requests.byMethod,
      byPath: performanceMetrics.requests.byPath,
      byStatus: performanceMetrics.requests.byStatus,
      responseTimes: responseTimeStats
    },
    memory: {
      current: currentMemory,
      stats: memoryStats,
      samples: performanceMetrics.memory.samples.length
    },
    errors: {
      total: performanceMetrics.errors.total,
      byType: performanceMetrics.errors.byType,
      byPath: performanceMetrics.errors.byPath
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset performance metrics
 */
export function resetPerformanceMetrics() {
  performanceMetrics.requests = {
    total: 0,
    byMethod: {},
    byPath: {},
    byStatus: {},
    responseTimes: []
  };
  performanceMetrics.memory.samples = [];
  performanceMetrics.errors = {
    total: 0,
    byType: {},
    byPath: {}
  };
  performanceMetrics.activeRequests.clear();
  
  logger.info('Performance metrics reset');
}

/**
 * Get active requests
 * @returns {Array} Active requests
 */
export function getActiveRequests() {
  const active = [];
  const now = Date.now();
  
  for (const [requestId, request] of performanceMetrics.activeRequests) {
    active.push({
      requestId,
      ...request,
      duration: now - request.startTime
    });
  }
  
  return active;
}

/**
 * Start periodic memory monitoring
 */
export function startMemoryMonitoring() {
  if (!loggingConfig.performance.enabled) return;
  
  setInterval(() => {
    addMemorySample();
  }, 30000); // Every 30 seconds
  
  logger.info('Memory monitoring started');
}

/**
 * Get system health status
 * @returns {Object} Health status
 */
export function getSystemHealth() {
  const memory = getMemoryUsage();
  const metrics = getPerformanceMetrics();
  
  // Calculate health scores
  const memoryHealth = memory.heapUsed < 512 ? 'good' : memory.heapUsed < 1024 ? 'warning' : 'critical';
  const responseTimeHealth = metrics.requests.responseTimes.avg < 1000 ? 'good' : 
                            metrics.requests.responseTimes.avg < 3000 ? 'warning' : 'critical';
  const errorRate = metrics.requests.total > 0 ? 
    (metrics.errors.total / metrics.requests.total) * 100 : 0;
  const errorHealth = errorRate < 1 ? 'good' : errorRate < 5 ? 'warning' : 'critical';
  
  return {
    status: memoryHealth === 'critical' || responseTimeHealth === 'critical' || errorHealth === 'critical' ? 'unhealthy' :
            memoryHealth === 'warning' || responseTimeHealth === 'warning' || errorHealth === 'warning' ? 'degraded' : 'healthy',
    checks: {
      memory: {
        status: memoryHealth,
        value: memory.heapUsed,
        unit: 'MB',
        threshold: 1024
      },
      responseTime: {
        status: responseTimeHealth,
        value: metrics.requests.responseTimes.avg,
        unit: 'ms',
        threshold: 3000
      },
      errorRate: {
        status: errorHealth,
        value: errorRate,
        unit: '%',
        threshold: 5
      }
    },
    timestamp: new Date().toISOString()
  };
} 