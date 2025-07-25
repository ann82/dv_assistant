/**
 * Domestic Violence Support Assistant - Main Server
 * 
 * This is the primary server for the Domestic Violence Support Assistant application.
 * It handles Twilio voice calls, web requests, WebSocket connections, and provides
 * comprehensive domestic violence support resources through AI-powered conversations.
 * 
 * Key Features:
 * - Twilio voice call processing with speech recognition
 * - WebSocket server for real-time communication
 * - AI-powered conversation management
 * - Resource search and recommendation
 * - Health monitoring and logging
 * - Rate limiting and security
 * 
 * @author Domestic Violence Support Assistant Team
 * @version 1.21.3
 * @since 2024-03-15
 */

// Core Node.js and Express imports
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

// Application-specific imports
import { config } from './lib/config.js';
import createTwilioRouter from './routes/twilio.js';
import healthRoutes from './routes/health.js';
import speechMonitorRoutes from './routes/speech-monitor.js';
import { TwilioWebSocketServer } from './websocketServer.js';
import logger from './lib/logger.js';
import { SearchIntegration } from './integrations/searchIntegration.js';
import rateLimit from 'express-rate-limit';
import { ServiceManager } from './services/ServiceManager.js';
import { HandlerManager } from './handlers/HandlerManager.js';
import { errorHandler } from './middleware/validation.js';
import { enhancedRequestLogger, enhancedErrorLogger, skipHealthCheckLogging } from './middleware/logging.js';
import { performanceMonitoring, errorTracking, startMemoryMonitoring } from './middleware/performanceMonitoring.js';
import { OpenAIIntegration } from './integrations/openaiIntegration.js';

// ES Module compatibility: Get the directory name for __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

/**
 * Environment Variable Validation
 * 
 * Ensures all required environment variables are present before starting the server.
 * This prevents runtime errors and provides clear feedback about missing configuration.
 */
const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TAVILY_API_KEY', 'OPENAI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars);
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Log environment configuration (with sensitive data masked)
logger.info('Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  WS_PORT: process.env.WS_PORT,
  LOG_LEVEL: process.env.LOG_LEVEL,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? '***' + process.env.TWILIO_ACCOUNT_SID.slice(-4) : undefined,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY ? '***' + process.env.TAVILY_API_KEY.slice(-4) : undefined,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***' + process.env.OPENAI_API_KEY.slice(-4) : undefined
});

// Initialize Express application
const app = express();

// Server configuration: Use Railway's PORT or fallback to 3000
const port = process.env.PORT || 3000;

/**
 * Express Middleware Configuration
 * 
 * Sets up essential middleware for request processing, security, and monitoring.
 */

// Body parsing middleware with increased limits for audio data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ 
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
}));

// Performance monitoring middleware for request tracking
app.use(performanceMonitoring);

// Enhanced request logging (skips health check endpoints to reduce noise)
app.use(skipHealthCheckLogging);

/**
 * Request Timeout Configuration
 * 
 * Sets reasonable timeouts for Twilio compatibility and prevents hanging requests.
 * Twilio has specific timeout requirements that must be met for proper operation.
 */
app.use((req, res, next) => {
  // Set 30-second timeouts for Twilio compatibility
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  // Handle request timeouts
  req.on('timeout', () => {
    logger.error('Request timeout:', {
      url: req.originalUrl,
      method: req.method,
      headers: req.headers
    });
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  
  // Handle response timeouts
  res.on('timeout', () => {
    logger.error('Response timeout:', {
      url: req.originalUrl,
      method: req.method
    });
    if (!res.headersSent) {
      res.status(408).json({ error: 'Response timeout' });
    }
  });
  
  next();
});

/**
 * CORS Configuration
 * 
 * Enables Cross-Origin Resource Sharing for web client access.
 * Configured to allow all origins for development and production flexibility.
 */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Twilio-Signature'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

/**
 * Rate Limiting Configuration
 * 
 * Prevents abuse by limiting requests per IP address.
 * Essential for protecting against DoS attacks and API abuse.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

/**
 * Static File Serving
 * 
 * Creates and serves audio files directory for TTS-generated audio.
 * Audio files are generated during voice calls and cached for reuse.
 */
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Serve audio files from the public/audio directory
app.use('/audio', express.static(audioDir));

/**
 * Route Configuration
 * 
 * Mounts application routes for different functionality areas.
 */

// Twilio voice and SMS processing routes - will be mounted after handlerManager is initialized

// Health check and monitoring routes
app.use('/health', healthRoutes);

// Mount speech monitoring routes
app.use('/speech-monitor', speechMonitorRoutes);

// Simple test route to verify basic routing works
app.get('/test', (req, res) => {
  res.json({ message: 'Basic routing works', timestamp: new Date().toISOString() });
});

// Simple test Twilio route to verify router mounting works
app.get('/twilio-simple', (req, res) => {
  res.json({ message: 'Simple Twilio route works', timestamp: new Date().toISOString() });
});

// Start memory monitoring for performance tracking
startMemoryMonitoring();

/**
 * Root Endpoint
 * 
 * Simple connectivity test endpoint for basic health verification.
 * Used by load balancers and monitoring systems.
 */
app.get('/', (req, res) => {
  res.json({ 
    message: 'Domestic Violence Support Assistant API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Error Handling Middleware Stack
 * 
 * Comprehensive error handling with logging, tracking, and graceful degradation.
 * Order is important: specific handlers first, then general fallbacks.
 */

// Enhanced error logging middleware
app.use(enhancedErrorLogger);

// Error tracking for monitoring and alerting
app.use(errorTracking);

// General error handler for uncaught exceptions
app.use(errorHandler);

// 404 handler will be mounted after routes are initialized

/**
 * HTTP Server Creation
 * 
 * Creates the HTTP server instance that will handle all incoming requests.
 * Separate from Express app to allow WebSocket server attachment.
 */
const server = http.createServer(app);

// Debug logging to confirm server object creation
logger.debug('Server object details:', { 
  type: typeof server, 
  keys: Object.keys(server) 
});

/**
 * Service and Handler Management
 * 
 * Initializes the core application services and request handlers.
 * These provide the business logic for domestic violence support functionality.
 */

// Initialize the service manager for core application services
const serviceManager = new ServiceManager();
let handlerManager;

// Exported function to mount test routes with a mock handlerManager
function mountTestRoutes(appInstance) {
  handlerManager = {
    processVoiceCall: () => Promise.resolve({ twiml: '<Response><Say>Test response</Say></Response>' }),
    generateTTSBasedTwiML: () => Promise.resolve('<Response><Say>Test response</Say></Response>'),
    activeCalls: new Map(),
    getConversationContext: () => Promise.resolve(null),
    updateConversationContext: () => {},
    cleanupCall: () => {},
    sendSMSWithRetry: () => Promise.resolve(),
    setWebSocketServer: () => {}
  };
  const twilioRoutes = createTwilioRouter(handlerManager);
  appInstance.use('/twilio', twilioRoutes);
  logger.info('Test environment: Mock HandlerManager and routes initialized');
}

/**
 * Server Initialization
 * 
 * Initializes services and handlers. In test environment, creates a mock handlerManager
 * to ensure routes are available for testing.
 */
function startServer() {
  server.listen(port, () => {
    logger.info(`🚀 Domestic Violence Support Assistant server started successfully`);
    logger.info(`📡 Server listening on port ${port}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Health check: http://localhost:${port}/health`);
    logger.info(`📞 Twilio webhook: http://localhost:${port}/twilio/voice`);
    logger.info(`🔊 Audio files: http://localhost:${port}/audio/`);
    
    // Log service status (only if ServiceManager is initialized)
    if (serviceManager && serviceManager.initialized) {
      try {
        const services = Array.from(serviceManager.getAllServices().keys());
        logger.info(`⚙️  Services initialized: ${services.join(', ')}`);
      } catch (error) {
        logger.warn('ServiceManager not yet initialized, skipping service status log');
      }
    } else {
      logger.info('⚙️  Services initializing...');
    }
    
    logger.info('✅ Server startup complete');
  }).on('error', (err) => {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}

if (process.env.NODE_ENV !== 'test') {
  // Production/development initialization
  (async () => {
    try {
      // Initialize all application services
      await serviceManager.initialize();
      
      /**
       * Dependency Injection Configuration
       * 
       * Creates a comprehensive dependencies object that provides all necessary
       * services and utilities to the handler manager and other components.
       */
      const dependencies = {
        // Integration dependencies for external APIs
        openaiIntegration: new OpenAIIntegration(),
        searchIntegration: SearchIntegration,
        twilioIntegration: null, // Will be initialized in HandlerManager
        
        // Core service dependencies
        audioService: serviceManager.getService('audio'),
        ttsService: serviceManager.getService('tts'),
        searchService: serviceManager.getService('search'),
        contextService: serviceManager.getService('context'),
        
        // Utility dependencies
        logger: logger,
        
        // Configuration dependencies
        config: config
      };
      
      // Initialize the handler manager with all dependencies
      handlerManager = new HandlerManager(Object.fromEntries(serviceManager.getAllServices()), dependencies);
      
      // Create and mount Twilio routes with injected handlerManager
      try {
        const twilioRoutes = createTwilioRouter(handlerManager);
        logger.info('Twilio router created successfully');
        app.use('/twilio', twilioRoutes);
        logger.info('Twilio router mounted at /twilio');
        
        // Debug: Log all mounted routes including routers
        const allRoutes = [];
        app._router.stack.forEach(layer => {
          if (layer.route) {
            // Direct routes
            allRoutes.push(`${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
          } else if (layer.name === 'router') {
            // Mounted routers
            const routerPath = layer.regexp.source.replace('^\\/','').replace('\\/?(?=\\/|$)','');
            layer.handle.stack.forEach(routeLayer => {
              if (routeLayer.route) {
                allRoutes.push(`${Object.keys(routeLayer.route.methods).join(',').toUpperCase()} /${routerPath}${routeLayer.route.path}`);
              }
            });
          }
        });
        logger.info('Debug: All mounted routes:', allRoutes);
        
        logger.info('ServiceManager and HandlerManager initialized successfully');
        logger.info('✅ Twilio routes mounted successfully at /twilio');
      } catch (error) {
        logger.error('Failed to create or mount Twilio routes:', error);
        throw error;
      }
      
      // Mount 404 handler after all routes are mounted
      app.use((req, res) => {
        res.status(404).json({
          error: 'Not Found',
          message: 'The requested resource was not found'
        });
      });
      
      // Start the server after routes are mounted
      startServer();
    } catch (error) {
      logger.error('Failed to initialize services, creating fallback handlerManager:', error);
      
      // Create a fallback handlerManager to ensure routes are available
      handlerManager = {
        processVoiceCall: () => Promise.resolve({ twiml: '<Response><Say>Service temporarily unavailable. Please try again later.</Say></Response>' }),
        generateTTSBasedTwiML: () => Promise.resolve('<Response><Say>Service temporarily unavailable. Please try again later.</Say></Response>'),
        activeCalls: new Map(),
        getConversationContext: () => Promise.resolve(null),
        updateConversationContext: () => {},
        cleanupCall: () => {},
        sendSMSWithRetry: () => Promise.resolve(),
        setWebSocketServer: () => {},
        preprocessSpeech: (speech) => speech,
        processSpeechInput: () => Promise.resolve('Service temporarily unavailable. Please try again later.')
      };
      
      // Create and mount Twilio routes with fallback handlerManager
      try {
        const twilioRoutes = createTwilioRouter(handlerManager);
        logger.info('Fallback Twilio router created successfully');
        app.use('/twilio', twilioRoutes);
        logger.info('Fallback Twilio router mounted at /twilio');
        
        logger.info('Fallback HandlerManager and routes initialized');
        logger.info('✅ Fallback Twilio routes mounted successfully at /twilio');
      } catch (error) {
        logger.error('Failed to create or mount fallback Twilio routes:', error);
        throw error;
      }
      
      // Mount 404 handler after all routes are mounted
      app.use((req, res) => {
        res.status(404).json({
          error: 'Not Found',
          message: 'The requested resource was not found'
        });
      });
      
      // Start the server after fallback routes are mounted
      startServer();
    }
  })();
} else {
  // Test environment - synchronous initialization
  // Create a mock handlerManager for tests
  handlerManager = {
    processVoiceCall: () => Promise.resolve({ twiml: '<Response><Say>Test response</Say></Response>' }),
    generateTTSBasedTwiML: () => Promise.resolve('<Response><Say>Test response</Say></Response>'),
    activeCalls: new Map(),
    getConversationContext: () => Promise.resolve(null),
    updateConversationContext: () => {},
    cleanupCall: () => {},
    sendSMSWithRetry: () => Promise.resolve(),
    setWebSocketServer: () => {}
  };
  
  // Create and mount Twilio routes with injected handlerManager
  try {
    const twilioRoutes = createTwilioRouter(handlerManager);
    logger.info('Test Twilio router created successfully');
    app.use('/twilio', twilioRoutes);
    logger.info('Test Twilio router mounted at /twilio');
    
    logger.info('Test environment: Mock HandlerManager and routes initialized');
    logger.info('✅ Test Twilio routes mounted successfully at /twilio');
  } catch (error) {
    logger.error('Failed to create or mount test Twilio routes:', error);
    throw error;
  }
  
  // Mount 404 handler after all routes are mounted
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found'
    });
  });
  
  // Don't start the server in test environment - just set up routes
  logger.info('Test environment: Routes mounted, server not started');
}

/**
 * WebSocket Server Initialization
 * 
 * Sets up the WebSocket server for real-time communication with web clients.
 * Only initialized in non-test environments to avoid Twilio SDK issues.
 */
let wsServer;
if (process.env.NODE_ENV !== 'test') {
  wsServer = new TwilioWebSocketServer(server);
  // Set WebSocket server on handlerManager when it becomes available
  const setWebSocketServer = () => {
    if (handlerManager) {
      handlerManager.setWebSocketServer(wsServer);
      logger.info('WebSocket server connected to HandlerManager');
    } else {
      // Retry after a short delay if handlerManager is not yet available
      setTimeout(setWebSocketServer, 100);
    }
  };
  setWebSocketServer();
}

/**
 * Server Startup
 * 
 * Server startup is now handled by the startServer() function
 * which is called after routes are mounted to prevent race conditions.
 */

/**
 * Graceful Shutdown Handling
 * 
 * Ensures the server shuts down cleanly when receiving termination signals.
 * This prevents data loss and ensures proper cleanup of resources.
 */
process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    logger.info('✅ Server closed successfully');
    process.exit(0);
  });
});

// Export the server, app, and handlerManager for testing purposes
export default server;
export { app, handlerManager, mountTestRoutes }; // Export the new function 