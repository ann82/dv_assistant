import { WebSocketServer } from 'ws';
import { AudioService } from './services/audioService.js';
import { config } from './lib/config.js';

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
      console.log('WebSocket Upgrade Request URL:', request.url);
      
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

    this.setupWebSocket();
  }

  // Method to register a call when TwiML is generated
  registerCall(callSid) {
    console.log('Registering call:', callSid);
    this.activeCalls.set(callSid, {
      timestamp: Date.now(),
      status: 'registered'
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      console.log('New Twilio WebSocket connection');
      
      // Log the full request for debugging
      console.log('WebSocket Request:', {
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
      
      console.log('Found active call:', callSid);

      if (!callSid) {
        console.error('No active call found for WebSocket connection');
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
            console.log('Received WebSocket message:', {
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
                  console.log('Processing media chunk:', {
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
              console.log('Received stop event, processing audio...');
              await this.handleStreamEnd(callSid, ws);
              break;

            case 'start':
              console.log('Stream started:', {
                callSid,
                streamSid: message.streamSid,
                startTime: message.startTime
              });
              break;

            case 'mark':
              console.log('Received mark event:', {
                callSid,
                mark: message.mark
              });
              break;

            case 'tts_complete':
              if (message.audioUrl) {
                console.log('TTS complete, sending TwiML response');
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
              console.log('Unknown event:', message.event);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket connection closed for call ${callSid}`);
        this.audioService.clearAccumulatedAudio(callSid);
        this.activeCalls.delete(callSid);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for call ${callSid}:`, error);
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

      console.log('Transcribing audio...');
      const transcript = await this.audioService.transcribeWithWhisper(audioBuffer);
      console.log('Transcript:', transcript);

      console.log('Getting GPT response...');
      const gptResponse = await this.audioService.getGptReply(transcript);
      console.log('GPT Response:', gptResponse.text);

      const ttsResponse = await this.audioService.generateTTS(gptResponse.text);

      ws.send(JSON.stringify({
        type: 'tts_request',
        text: ttsResponse.text,
        audioPath: ttsResponse.audioPath
      }));

      this.audioService.clearAccumulatedAudio(callSid);

    } catch (error) {
      console.error('Error handling stream end:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing audio'
      }));
    }
  }
} 