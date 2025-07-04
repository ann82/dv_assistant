import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { config } from './lib/config.js';
import twilioRoutes from './routes/twilio.js';
import { TwilioWebSocketServer } from './websocketServer.js';
import logger from './lib/logger.js';
import { callTavilyAPI } from './lib/apis.js';
import rateLimit from 'express-rate-limit';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Verify required environment variables
const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TAVILY_API_KEY', 'OPENAI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars);
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Log environment variables (without sensitive data)
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

const app = express();

// Use Railway's PORT or fallback to 3000
const port = process.env.PORT || 3000;

// Configure Express
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ 
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
}));

// Increase timeout for Twilio requests
app.use((req, res, next) => {
  // Increase timeouts for Railway deployment
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000); // 2 minutes
  
  // Add timeout error handling
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

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Twilio-Signature'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Serve audio files
app.use('/audio', express.static(audioDir));

// Mount Twilio routes
app.use('/twilio', twilioRoutes);

// Add health check endpoint
app.get('/health', (req, res) => {
  try {
    // Check if server is running
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: port,
      memory: process.memoryUsage(),
      pid: process.pid,
      // Add Railway-specific info
      railway: {
        staticUrl: process.env.RAILWAY_STATIC_URL,
        serviceId: process.env.RAILWAY_SERVICE_ID,
        environment: process.env.RAILWAY_ENVIRONMENT
      },
      // Add timeout configuration
      timeouts: {
        requestTimeout: 120000,
        responseTimeout: 120000,
        healthCheckTimeout: 1200
      },
      // Add active connections info
      connections: {
        activeCalls: twilioRoutes.getActiveCallsCount ? twilioRoutes.getActiveCallsCount() : 'unknown',
        wsConnections: wsServer ? wsServer.getConnectionCount() : 'unknown'
      }
    };
    
    logger.info('Health check requested:', healthStatus);
    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Add a simple root endpoint for basic connectivity testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'Domestic Violence Support Assistant API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Application error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Create HTTP server with Express app
const server = http.createServer(app);

// Debug log to confirm server object
logger.debug('Server object details:', { 
  type: typeof server, 
  keys: Object.keys(server) 
});

// Initialize WebSocket server
const wsServer = new TwilioWebSocketServer(server);

// Set WebSocket server in Twilio routes
twilioRoutes.setWebSocketServer(wsServer);

// Start the server
server.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
});

// Handle server shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
}); 