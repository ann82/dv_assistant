import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from './lib/config.js';
import twilioRoutes from './routes/twilio.js';
import { TwilioWebSocketServer } from './websocketServer.js';
import logger from './lib/logger.js';
import { callTavilyAPI } from './lib/apis.js';

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

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Create audio directory if it doesn't exist
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Serve audio files
app.use('/audio', express.static(audioDir));

// Create WebSocket server
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Server running on port ${port}`);
});

// Initialize WebSocket server
const wsServer = new TwilioWebSocketServer(server);

// Set WebSocket server in Twilio routes
twilioRoutes.setWebSocketServer(wsServer);

// Mount Twilio routes
app.use('/twilio', twilioRoutes);

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Handle server shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
}); 