import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { config } from './config.js';
import { AudioProcessor } from './audio.js';
import { ResponseGenerator } from './ResponseGenerator.js';
import { costLogger } from './costLogger.js';
import logger from './logger.js';

export class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
    this.clients = new Map();
    this.lastRequestedShelter = new Map(); // Store last requested shelter per client
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log(`Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws, req) {
    const clientId = req.headers['sec-websocket-key'];
    this.clients.set(clientId, ws);
    this.lastRequestedShelter.set(clientId, null);

    if (!req.url) {
      this.log('No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/') {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Get request type from query params
    const requestType = url.searchParams.get('type') || 'web';
    this.log(`Request type: ${requestType}`);

    // Create context for this connection
    const context = {
      lastInput: null,
      isFollowUp: false,
      requestType,
      lastShelterSearch: null
    };

    // Create OpenAI client
    const client = new RealtimeClient({
      apiKey: config.OPENAI_API_KEY,
      model: config.GPT35_MODEL
    });

    // Handle disconnection
    ws.on('close', async () => {
      this.clients.delete(clientId);
      const lastShelter = this.lastRequestedShelter.get(clientId);
      if (lastShelter) {
        // Create summary message
        const summary = `Here's a summary of the shelter information you requested:\n\n` +
          `Name: ${lastShelter.name}\n` +
          `Phone: ${lastShelter.phone}\n` +
          `Services: ${lastShelter.services}\n` +
          (lastShelter.address ? `Address: ${lastShelter.address}\n` : '') +
          (lastShelter.description ? `Description: ${lastShelter.description}\n` : '');

        // Handle based on request type
        if (context.requestType === 'phone') {
          try {
            // Send summary via Twilio
            const twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
            await twilioClient.messages.create({
              body: summary,
              to: context.phoneNumber, // This should be stored in context when call starts
              from: config.TWILIO_PHONE_NUMBER
            });
            logger.info('Sent disconnection summary via Twilio SMS', {
              phoneNumber: context.phoneNumber,
              shelterName: lastShelter.name
            });
          } catch (error) {
            logger.error('Failed to send disconnection summary via Twilio:', error);
          }
        } else {
          // For web clients, try to send via websocket if still open
          try {
            ws.send(JSON.stringify({
              type: 'response.text',
              text: summary,
              source: 'tavily',
              tokens: 0,
              requestType: 'web'
            }));
          } catch (error) {
            logger.error('Failed to send disconnection summary via websocket:', error);
          }
        }
      }
      this.lastRequestedShelter.delete(clientId);
    });

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on('server.*', async (event) => {
      try {
        if (event.type === 'response.text.delta') {
          // Handle text response
          const response = await ResponseGenerator.getResponse(
            event.text,
            context
          );

          // Store shelter search results in context if it's a Tavily response
          if (response.source === 'tavily' && response.shelters) {
            context.lastShelterSearch = {
              shelters: response.shelters,
              cacheKey: response.cacheKey
            };
          }

          // If this is a detailed shelter response, store it
          if (response.source === 'tavily' && response.shelter) {
            this.lastRequestedShelter.set(clientId, response.shelter);
          }

          // Log cost for this interaction
          await costLogger.logCost({
            model: response.model || config.GPT35_MODEL,
            inputTokens: response.inputTokens || 0,
            outputTokens: response.outputTokens || 0,
            whisperUsed: response.whisperUsed || false,
            transcriptLength: response.transcriptLength || 0,
            responseLength: response.text.length,
            ttsCharacters: response.text.length,
            requestType
          });

          // Only send response if it's not an error
          if (response.source !== 'error') {
            // Send text response to client
            ws.send(JSON.stringify({
              type: 'response.text',
              text: response.text,
              source: response.source,
              tokens: response.tokens,
              requestType
            }));

            // Update context
            context.lastInput = event.text;
            context.isFollowUp = true;
          }
        } else {
          // Pass through other events
          this.log(`Relaying "${event.type}" to Client`);
          ws.send(JSON.stringify(event));
        }
      } catch (error) {
        this.log(`Error handling server event: ${error.message}`);
        // Only send error if we haven't sent a response yet
        if (!context.lastInput) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Error processing response'
          }));
        }
      }
    });

    client.realtime.on('close', () => ws.close());

    // Relay: Browser Event -> OpenAI Realtime API Event
    const messageQueue = [];
    const messageHandler = async (data) => {
      try {
        const event = JSON.parse(data);
        
        if (event.type === 'input.audio') {
          // Process audio input
          const { shouldProcess, processedAudio } = await AudioProcessor.shouldProcessAudio(event.audio);
          
          if (shouldProcess) {
            this.log('Processing audio input');
            client.realtime.send('input.audio', { audio: processedAudio });
          } else {
            this.log('Skipping audio input - too short or silent');
          }
        } else {
          this.log(`Relaying "${event.type}" to OpenAI`);
          client.realtime.send(event.type, event);
        }
      } catch (e) {
        console.error(e.message);
        this.log(`Error parsing event from client: ${data}`);
      }
    };

    ws.on('message', (data) => {
      if (!client.isConnected()) {
        messageQueue.push(data);
      } else {
        messageHandler(data);
      }
    });

    ws.on('close', () => client.disconnect());

    // Connect to OpenAI Realtime API
    try {
      this.log(`Connecting to OpenAI...`);
      await client.connect();
    } catch (e) {
      this.log(`Error connecting to OpenAI: ${e.message}`);
      ws.close();
      return;
    }

    this.log(`Connected to OpenAI successfully!`);
    while (messageQueue.length) {
      messageHandler(messageQueue.shift());
    }
  }

  log(...args) {
    logger.info(`[RealtimeRelay]`, ...args);
  }
}
