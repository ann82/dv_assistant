import express from 'express';
import { createServer } from 'http';
import { TwilioWebSocketServer } from './websocketServer.js';
import { config } from './lib/config.js';
import logger from './lib/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Log startup environment
logger.info('Starting server with environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  WS_PORT: process.env.WS_PORT,
  LOG_LEVEL: process.env.LOG_LEVEL
});

// Memory monitoring
const logMemoryUsage = () => {
  const used = process.memoryUsage();
  logger.info(`Memory usage: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
};

// Log memory usage every 5 minutes
setInterval(logMemoryUsage, 5 * 60 * 1000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.info('Server directory:', { __dirname });

const app = express();
const server = createServer(app);

// Initialize WebSocket server and audio service
logger.info('Initializing WebSocket server and audio service...');
let wss;
try {
  wss = new TwilioWebSocketServer(server);
  logger.info('WebSocket server and audio service initialized successfully');
} catch (error) {
  logger.error('Failed to initialize WebSocket server:', error);
  process.exit(1);
}

// Make WebSocket server available globally
global.wss = wss;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - must be before static file serving
app.get('/health', (req, res) => {
  try {
    logger.info('Health check requested');
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT
      },
      services: {
        websocket: wss ? 'initialized' : 'not initialized',
        audioService: wss?.audioService ? 'initialized' : 'not initialized'
      }
    };
    logger.info('Health check response:', healthData);
    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve static files from the React build directory
const buildPath = path.join(__dirname, '..', 'build');
logger.info('Serving static files from:', { buildPath });
app.use(express.static(buildPath));

// Serve audio files
const audioPath = path.join(__dirname, 'public', 'audio');
logger.info('Serving audio files from:', { audioPath });
app.use('/audio', express.static(audioPath));

// API routes
logger.info('Setting up API routes...');
app.use('/twilio', (await import('./routes/twilio.js')).default);
logger.info('API routes setup complete');

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Application error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
logger.info(`Attempting to start server on port ${PORT}...`);

server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check available at: http://localhost:${PORT}/health`);
  logger.info('Server startup complete');
}).on('error', (err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
