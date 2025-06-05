import { WebSocketServer } from 'ws';
import { AudioService } from './services/audioService.js';
import { CallSummaryService } from './services/callSummaryService.js';
import path from 'path';
import fsSync from 'fs';
import logger from './lib/logger.js';

export class TwilioWebSocketServer {
  constructor(server) {
    this.audioService = new AudioService();
    this.wss = new WebSocketServer({ 
      noServer: true 
    });
    
    // Store active calls
    this.activeCalls = new Map();
    
    // Handle upgrade manually to get the full URL
    server.on('upgrade', (request, socket, head) => {
      // Log the full request URL for debugging
      logger.info('WebSocket Upgrade Request URL:', request.url);
      
      const pathname = new URL(request.url, `https://${request.headers.host}`).pathname;
      
      if (pathname === '/twilio-stream') {
        // Store the full URL in the request object for later use
        request.fullUrl = request.url;
        
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.callSummaryService = new CallSummaryService();
    this.setupWebSocket();
  }

  // Method to register a call when TwiML is generated
  registerCall(callSid, from) {
    if (!this.activeCalls.has(callSid)) {
      this.activeCalls.set(callSid, {
        from,
        startTime: Date.now(),
        hasConsent: false,
        conversationHistory: []
      });
    } else {
      // Reset consent and history for existing call
      this.activeCalls.set(callSid, {
        ...this.activeCalls.get(callSid),
        from,
        hasConsent: false,
        conversationHistory: []
      });
    }
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      logger.info('New Twilio WebSocket connection');
      
      // Log the full request for debugging
      logger.info('WebSocket Request:', {
        url: req.fullUrl || req.url,
        headers: req.headers,
        query: req.query
      });

      // Find the most recently registered call
      let callSid = null;
      let mostRecent = 0;
      
      for (const [sid, data] of this.activeCalls.entries()) {
        if (data.timestamp > mostRecent) {
          mostRecent = data.timestamp;
          callSid = sid;
        }
      }
      
      logger.info('Found active call:', callSid);

      if (!callSid) {
        logger.error('No active call found for WebSocket connection');
        ws.close(1008, 'No active call found');
        return;
      }

      // Update call status
      this.activeCalls.set(callSid, {
        ...this.activeCalls.get(callSid),
        status: 'connected',
        ws
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          
          // Only log non-media messages to avoid console spam
          if (message.event !== 'media') {
            logger.info('Received WebSocket message:', {
              callSid,
              messageType: message.event,
              data: message
            });
          }
          
          switch (message.event) {
            case 'media':
              if (message.media && message.media.payload) {
                // Only log every 100th media message to avoid console spam
                if (parseInt(message.media.chunk) % 100 === 0) {
                  logger.info('Processing media chunk:', {
                    callSid,
                    chunk: message.media.chunk,
                    track: message.media.track,
                    timestamp: message.media.timestamp
                  });
                }
                
                // Only process inbound audio
                if (message.media.track === 'inbound_track') {
                  const audioChunk = await this.audioService.decodeTwilioAudio(message.media.payload);
                  this.audioService.accumulateAudio(callSid, audioChunk);
                }
              }
              break;

            case 'stop':
              logger.info('Received stop event, processing audio...');
              await this.handleStreamEnd(callSid, ws);
              break;

            case 'start':
              logger.info('Stream started:', {
                callSid,
                streamSid: message.streamSid,
                startTime: message.startTime
              });
              break;

            case 'mark':
              logger.info('Received mark event:', {
                callSid,
                mark: message.mark
              });
              break;

            case 'tts_complete':
              if (message.audioUrl) {
                logger.info('TTS complete, sending TwiML response');
                const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${message.audioUrl}</Play>
  <Gather input="speech" action="/twilio/voice" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"/>
</Response>`;

                ws.send(JSON.stringify({
                  type: 'twiml',
                  twiml
                }));
              }
              break;

            default:
              logger.info('Unknown event:', message.event);
          }
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        logger.info(`WebSocket connection closed for call ${callSid}`);
        this.audioService.clearAccumulatedAudio(callSid);
        this.activeCalls.delete(callSid);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for call ${callSid}:`, error);
        this.activeCalls.delete(callSid);
      });
    });
  }

  async handleStreamEnd(callSid, ws) {
    try {
      const audioChunks = this.audioService.getAccumulatedAudio(callSid);
      if (audioChunks.length === 0) {
        throw new Error('No audio data received');
      }

      const audioBuffer = Buffer.concat(audioChunks);

      logger.info('Transcribing audio...');
      const transcript = await this.audioService.transcribeWithWhisper(audioBuffer);
      logger.info('Transcript:', transcript);

      // Add user's message to history
      this.callSummaryService.addToHistory(callSid, {
        role: 'user',
        content: transcript
      });

      logger.info('Getting GPT response...');
      const gptResponse = await this.audioService.getGptReply(transcript);
      logger.info('GPT Response:', gptResponse.text);

      // Add assistant's response to history
      this.callSummaryService.addToHistory(callSid, {
        role: 'assistant',
        content: gptResponse.text
      });

      const ttsResponse = await this.audioService.generateTTS(gptResponse.text);

      ws.send(JSON.stringify({
        type: 'tts_request',
        text: ttsResponse.text,
        audioPath: ttsResponse.audioPath
      }));

      this.audioService.clearAccumulatedAudio(callSid);

    } catch (error) {
      logger.error('Error handling stream end:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing audio'
      }));
    }
  }

  async handleCallEnd(callSid) {
    try {
      // Generate call summary
      const call = this.activeCalls.get(callSid);
      let summary = null;
      if (call) {
        try {
          summary = await this.callSummaryService.generateSummary(call.conversationHistory);
        } catch (error) {
          summary = null;
        }
        this.activeCalls.delete(callSid);
        return summary;
      } else {
        return null;
      }
    } catch (error) {
      logger.error('Error handling call end:', error);
      this.activeCalls.delete(callSid);
      return null;
    }
  }

  // --- Test-friendly methods for compatibility with generic WebSocketServer tests ---
  addClient(callSid, ws) {
    this.activeCalls.set(callSid, { ws, timestamp: Date.now(), status: 'connected' });
  }

  removeClient(callSid) {
    this.activeCalls.delete(callSid);
  }

  getClient(callSid) {
    const entry = this.activeCalls.get(callSid);
    return entry ? entry.ws : undefined;
  }

  getClientCount() {
    return this.activeCalls.size;
  }

  sendToClient(callSid, message) {
    const entry = this.activeCalls.get(callSid);
    if (entry && entry.ws && entry.ws.readyState === 1) {
      try {
        entry.ws.send(JSON.stringify(message));
      } catch (err) {
        this.activeCalls.delete(callSid);
      }
    }
  }

  broadcast(message) {
    for (const [callSid, entry] of this.activeCalls.entries()) {
      if (entry.ws && entry.ws.readyState === 1) {
        try {
          entry.ws.send(JSON.stringify(message));
        } catch (err) {
          this.activeCalls.delete(callSid);
        }
      }
    }
  }

  close() {
    for (const [callSid, entry] of this.activeCalls.entries()) {
      if (entry.ws && typeof entry.ws.close === 'function') {
        entry.ws.close();
      }
    }
    this.activeCalls.clear();
    if (this.wss && typeof this.wss.close === 'function') {
      this.wss.close();
    }
  }

  addToHistory(callSid, message) {
    const call = this.activeCalls.get(callSid);
    if (call) {
      if (!call.conversationHistory) call.conversationHistory = [];
      call.conversationHistory.push(message);
    }
  }
} 