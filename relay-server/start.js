#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

logger.info('🚀 Starting Domestic Violence Support Assistant...');
logger.info('📁 Working directory:', { cwd: process.cwd() });
logger.info('📦 Node version:', { version: process.version });
logger.info('🌍 Environment:', { env: process.env.NODE_ENV || 'development' });
logger.info('🔌 Port:', { port: process.env.PORT || '3000' });

// Check for required environment variables
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN', 
  'TWILIO_PHONE_NUMBER',
  'TAVILY_API_KEY',
  'OPENAI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  logger.error('❌ Missing required environment variables:', { missingVars });
  logger.error('💡 Please set these variables in your Railway environment.');
  logger.error('🔗 Check RAILWAY_DEPLOYMENT.md for setup instructions.');
  process.exit(1);
}

logger.info('✅ All required environment variables are set');

// Start the server
const serverPath = join(__dirname, 'server.js');
logger.info('🔧 Starting server from:', { serverPath });

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (error) => {
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  logger.info(`📴 Server exited with code ${code}`);
  if (code !== 0) {
    logger.error('💥 Server crashed or failed to start properly');
    logger.error('📋 Check Railway logs for detailed error messages');
  }
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  server.kill('SIGINT');
});

// Log when the startup script is ready
logger.info('🎯 Startup script ready, server should be starting...'); 