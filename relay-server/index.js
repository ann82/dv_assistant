import { RealtimeRelay } from './lib/relay.js';
import { TwilioHandler } from './lib/twilio.js';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from root directory
dotenv.config({ path: path.join(rootDir, '.env'), override: true });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

if (!OPENAI_API_KEY) {
  console.error(
    `Environment variable "OPENAI_API_KEY" is required.\n` +
      `Please set it in your .env file.`
  );
  process.exit(1);
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.error(
    `Twilio credentials are required.\n` +
      `Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file.`
  );
  process.exit(1);
}

const HTTP_PORT = parseInt(process.env.HTTP_PORT) || 8081;
const WS_PORT = parseInt(process.env.WS_PORT) || 8083;

// Initialize Express app for Twilio webhooks
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize Twilio handler
const twilioHandler = new TwilioHandler(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER);

// Twilio webhook endpoints
app.post('/twilio/voice', twilioHandler.validateTwilioRequest, twilioHandler.handleIncomingCall.bind(twilioHandler));
app.post('/twilio/voice/process', twilioHandler.validateTwilioRequest, twilioHandler.handleCallProcessing.bind(twilioHandler));
app.post('/twilio/message', twilioHandler.validateTwilioRequest, twilioHandler.handleIncomingMessage.bind(twilioHandler));

// Initialize WebSocket relay
const relay = new RealtimeRelay(OPENAI_API_KEY);

// Start servers
app.listen(HTTP_PORT, () => {
  console.log(`HTTP server listening on port ${HTTP_PORT}`);
});
relay.listen(WS_PORT); // WebSocket server on different port
