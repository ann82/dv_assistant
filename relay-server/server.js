import express from 'express';
import cors from 'cors';
import { config } from './lib/config.js';
import twilioRoutes from './routes/twilio.js';
import { TwilioWebSocketServer } from './websocketServer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = config.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use('/audio', express.static(path.join(__dirname, 'public', 'audio')));

// Create public/audio directory if it doesn't exist
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Create WebSocket server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Initialize WebSocket server
const wsServer = new TwilioWebSocketServer(server);

// Set WebSocket server in Twilio routes
twilioRoutes.setWebSocketServer(wsServer);

// Mount Twilio routes
app.use('/twilio', twilioRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Application error:', err);
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
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
}); 