#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Domestic Violence Support Assistant...');
console.log('📁 Working directory:', process.cwd());
console.log('📦 Node version:', process.version);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', process.env.PORT || '3000');

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
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('💡 Please set these variables in your Railway environment.');
  console.error('🔗 Check RAILWAY_DEPLOYMENT.md for setup instructions.');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

// Start the server
const serverPath = join(__dirname, 'server.js');
console.log('🔧 Starting server from:', serverPath);

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`📴 Server exited with code ${code}`);
  if (code !== 0) {
    console.error('💥 Server crashed or failed to start properly');
    console.error('📋 Check Railway logs for detailed error messages');
  }
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.kill('SIGINT');
});

// Log when the startup script is ready
console.log('🎯 Startup script ready, server should be starting...'); 