/**
 * Health Check Routes
 * Provides comprehensive system health monitoring and metrics
 */

import express from 'express';
import { logger } from '../lib/logger.js';
import { getPerformanceMetrics, getSystemHealth, getActiveRequests, resetPerformanceMetrics } from '../middleware/performanceMonitoring.js';
import { getLoggingStatus } from '../lib/config/logging.js';
import { config } from '../lib/config/index.js';
import { OpenAIIntegration } from '../integrations/openaiIntegration.js';
import { SearchIntegration } from '../integrations/searchIntegration.js';
import { TwilioIntegration } from '../integrations/twilioIntegration.js';
import { TtsIntegration } from '../integrations/ttsIntegration.js';

const router = express.Router();

/**
 * Basic health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const health = getSystemHealth();
    
    res.status(health.status === 'healthy' ? 200 : 503).json({
      status: health.status,
      timestamp: health.timestamp,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed health check with all system components
 */
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    const health = getSystemHealth();
    const performance = getPerformanceMetrics();
    const logging = getLoggingStatus();
    
    // Check integration health
    const integrationChecks = await checkIntegrationHealth();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: health.status,
      timestamp: health.timestamp,
      responseTime,
      system: {
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      health: health.checks,
      performance: {
        requests: performance.requests,
        memory: performance.memory.current,
        errors: performance.errors
      },
      logging,
      integrations: integrationChecks,
      config: {
        features: config.features,
        timeouts: config.timeouts,
        cache: config.cache
      }
    });
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Performance metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = getPerformanceMetrics();
    const activeRequests = getActiveRequests();
    
    res.json({
      ...metrics,
      activeRequests,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Reset performance metrics
 */
router.post('/metrics/reset', async (req, res) => {
  try {
    resetPerformanceMetrics();
    res.json({
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics reset failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Active requests endpoint
 */
router.get('/active-requests', async (req, res) => {
  try {
    const activeRequests = getActiveRequests();
    
    res.json({
      count: activeRequests.length,
      requests: activeRequests,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Active requests endpoint failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Integration health checks
 */
async function checkIntegrationHealth() {
  const checks = {
    openai: { status: 'unknown', responseTime: 0, error: null },
    search: { status: 'unknown', responseTime: 0, error: null },
    twilio: { status: 'unknown', responseTime: 0, error: null },
    tts: { status: 'unknown', responseTime: 0, error: null }
  };
  
  // Check OpenAI integration
  try {
    const startTime = Date.now();
    const openaiStatus = await OpenAIIntegration.getStatus();
    const responseTime = Date.now() - startTime;
    
    checks.openai = {
      status: openaiStatus.healthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: openaiStatus
    };
  } catch (error) {
    checks.openai = {
      status: 'unhealthy',
      responseTime: 0,
      error: error.message
    };
  }
  
  // Check Search integration
  try {
    const startTime = Date.now();
    const searchStatus = await SearchIntegration.getStatus();
    const responseTime = Date.now() - startTime;
    
    checks.search = {
      status: searchStatus.healthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: searchStatus
    };
  } catch (error) {
    checks.search = {
      status: 'unhealthy',
      responseTime: 0,
      error: error.message
    };
  }
  
  // Check Twilio integration
  try {
    const startTime = Date.now();
    const twilioStatus = await TwilioIntegration.getStatus();
    const responseTime = Date.now() - startTime;
    
    checks.twilio = {
      status: twilioStatus.healthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: twilioStatus
    };
  } catch (error) {
    checks.twilio = {
      status: 'unhealthy',
      responseTime: 0,
      error: error.message
    };
  }
  
  // Check TTS integration
  try {
    const startTime = Date.now();
    const ttsStatus = await TtsIntegration.getStatus();
    const responseTime = Date.now() - startTime;
    
    checks.tts = {
      status: ttsStatus.healthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: ttsStatus
    };
  } catch (error) {
    checks.tts = {
      status: 'unhealthy',
      responseTime: 0,
      error: error.message
    };
  }
  
  return checks;
}

/**
 * Integration health check endpoint
 */
router.get('/integrations', async (req, res) => {
  try {
    const integrationChecks = await checkIntegrationHealth();
    
    // Determine overall integration health
    const unhealthyCount = Object.values(integrationChecks).filter(check => check.status === 'unhealthy').length;
    const overallStatus = unhealthyCount === 0 ? 'healthy' : unhealthyCount === Object.keys(integrationChecks).length ? 'unhealthy' : 'degraded';
    
    res.json({
      status: overallStatus,
      integrations: integrationChecks,
      summary: {
        total: Object.keys(integrationChecks).length,
        healthy: Object.values(integrationChecks).filter(check => check.status === 'healthy').length,
        unhealthy: unhealthyCount,
        degraded: Object.values(integrationChecks).filter(check => check.status === 'degraded').length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Integration health check failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Configuration endpoint
 */
router.get('/config', async (req, res) => {
  try {
    res.json({
      environment: process.env.NODE_ENV || 'development',
      config: {
        features: config.features,
        timeouts: config.timeouts,
        cache: config.cache,
        logging: {
          level: config.logging.level,
          performance: config.logging.performance
        }
      },
      environmentVariables: {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***' : 'missing',
        TAVILY_API_KEY: process.env.TAVILY_API_KEY ? '***' : 'missing',
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? '***' : 'missing',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? '***' : 'missing'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Config endpoint failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Readiness probe endpoint
 */
router.get('/ready', async (req, res) => {
  try {
    const health = getSystemHealth();
    const integrationChecks = await checkIntegrationHealth();
    
    // Check if system is ready to handle requests
    const isReady = health.status !== 'unhealthy' && 
                   Object.values(integrationChecks).some(check => check.status === 'healthy');
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      status: health.status,
      integrations: Object.values(integrationChecks).some(check => check.status === 'healthy'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness probe failed:', error);
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe endpoint
 */
router.get('/live', async (req, res) => {
  try {
    const health = getSystemHealth();
    
    // Check if system is alive (basic health check)
    const isAlive = health.status !== 'unhealthy';
    
    res.status(isAlive ? 200 : 503).json({
      alive: isAlive,
      status: health.status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Liveness probe failed:', error);
    res.status(503).json({
      alive: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 