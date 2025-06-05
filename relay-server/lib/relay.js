import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { config } from './config.js';
import { AudioProcessor } from './audio.js';
import { ResponseGenerator } from './response.js';
import { costLogger } from './costLogger.js';
import logger from './logger.js';

export class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log(`Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws, req) {
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

    // Instantiate new client
    this.log(`Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({ apiKey: this.apiKey });

    // Track conversation context
    const context = {
      isFollowUp: false,
      lastInput: null,
      lastShelterSearch: null,
      requestType // Add request type to context
    };

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
              fullDetails: response.text
            };
          }

          // Log cost for this interaction
          await costLogger.logCost({
            model: response.model || config.GPT35_MODEL,
            inputTokens: response.inputTokens || 0,
            outputTokens: response.outputTokens || 0,
            whisperUsed: response.whisperUsed || false,
            transcriptLength: response.transcriptLength || 0,
            responseLength: response.text.length,
            ttsCharacters: response.text.length, // Since we're using client-side TTS
            requestType // Add request type to cost logging
          });

          // Only send response if it's not an error
          if (response.source !== 'error') {
            // Send text response to client
            ws.send(JSON.stringify({
              type: 'response.text',
              text: response.text,
              source: response.source,
              tokens: response.tokens,
              requestType // Include request type in response
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
