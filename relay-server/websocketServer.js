/**
 * Twilio WebSocket Server
 * 
 * Handles real-time WebSocket connections for Twilio voice calls, providing
 * audio streaming, media processing, and call management capabilities.
 * 
 * This server enables:
 * - Real-time audio streaming from Twilio calls
 * - Audio processing and accumulation for speech recognition
 * - Call state management and tracking
 * - TTS (Text-to-Speech) response handling
 * - Call summary generation
 * 
 * @author Domestic Violence Support Assistant Team
 * @version 1.21.3
 * @since 2024-03-15
 */

import { WebSocketServer } from 'ws';
import { AudioService } from './services/audioService.js';
import { CallSummaryService } from './services/callSummaryService.js';
import path from 'path';
import fsSync from 'fs';
import logger from './lib/logger.js';

/**
 * TwilioWebSocketServer Class
 * 
 * Manages WebSocket connections for Twilio voice calls, handling audio streaming,
 * call state management, and real-time communication between the server and Twilio.
 */
export class TwilioWebSocketServer {
  /**
   * Constructor
   * 
   * Initializes the WebSocket server and sets up connection handling.
   * 
   * @param {http.Server} server - The HTTP server to attach WebSocket handling to
   * @param {Object} [dependencies] - Optional dependencies for easier testing
   * @param {AudioService} [dependencies.audioService]
   * @param {CallSummaryService} [dependencies.callSummaryService]
   */
  constructor(server, dependencies = {}) {
    // Initialize audio service for processing Twilio audio streams
    this.audioService = dependencies.audioService || new AudioService();
    
    // Create WebSocket server with noServer option for manual upgrade handling
    this.wss = new WebSocketServer({ 
      noServer: true 
    });
    
    // Track active calls with their metadata and WebSocket connections
    this.activeCalls = new Map();
    
    /**
     * Manual WebSocket Upgrade Handling
     * 
     * Intercepts HTTP upgrade requests to handle WebSocket connections manually.
     * This allows us to validate the connection path and store additional metadata.
     */
    server.on('upgrade', (request, socket, head) => {
      // Log the full request URL for debugging purposes
      logger.info('WebSocket Upgrade Request URL:', request.url);
      
      // Parse the URL to extract the pathname
      const pathname = new URL(request.url, `https://${request.headers.host}`).pathname;
      
      // Only accept connections on the /twilio-stream path
      if (pathname === '/twilio-stream') {
        // Store the full URL in the request object for later use
        request.fullUrl = request.url;
        
        // Handle the WebSocket upgrade
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        // Reject connections on other paths
        socket.destroy();
      }
    });

    // Initialize call summary service for generating call reports
    this.callSummaryService = dependencies.callSummaryService || new CallSummaryService();
    
    // Set up WebSocket event handlers
    this.setupWebSocket();
  }

  /**
   * Register a new call when TwiML is generated
   * 
   * Called when a new Twilio call is initiated to track call metadata
   * and prepare for WebSocket connection.
   * 
   * @param {string} callSid - Twilio Call SID for unique call identification
   * @param {string} from - Phone number of the caller
   */
  registerCall(callSid, from) {
    if (!this.activeCalls.has(callSid)) {
      // Create new call entry
      this.activeCalls.set(callSid, {
        from,
        startTime: Date.now(),
        hasConsent: false,
        conversationHistory: []
      });
    } else {
      // Reset consent and history for existing call (e.g., reconnection)
      this.activeCalls.set(callSid, {
        ...this.activeCalls.get(callSid),
        from,
        hasConsent: false,
        conversationHistory: []
      });
    }
  }

  /**
   * Set up WebSocket connection handling
   * 
   * Configures event handlers for WebSocket connections, including
   * message processing, connection management, and error handling.
   */
  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      logger.info('New Twilio WebSocket connection established');
      
      // Log comprehensive request information for debugging
      logger.info('WebSocket Request Details:', {
        url: req.fullUrl || req.url,
        headers: req.headers,
        query: req.query
      });

      /**
       * Find the most recently registered call
       * 
       * WebSocket connections are typically established after call registration,
       * so we find the most recent call to associate with this connection.
       */
      let callSid = null;
      let mostRecent = 0;
      
      for (const [sid, data] of this.activeCalls.entries()) {
        if (data.timestamp > mostRecent) {
          mostRecent = data.timestamp;
          callSid = sid;
        }
      }
      
      logger.info('Associated WebSocket with active call:', callSid);

      // Validate that we have an active call
      if (!callSid) {
        logger.error('No active call found for WebSocket connection');
        ws.close(1008, 'No active call found');
        return;
      }

      // Update call status to connected and store WebSocket reference
      this.activeCalls.set(callSid, {
        ...this.activeCalls.get(callSid),
        status: 'connected',
        ws
      });

      /**
       * WebSocket Message Handler
       * 
       * Processes incoming WebSocket messages from Twilio, including:
       * - Media chunks (audio data)
       * - Stream control events (start, stop, mark)
       * - TTS completion notifications
       */
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          
          // Log non-media messages to avoid console spam
          if (message.event !== 'media') {
            logger.info('Received WebSocket message:', {
              callSid,
              messageType: message.event,
              data: message
            });
          }
          
          // Handle different message types
          switch (message.event) {
            case 'media':
              if (message.media && message.media.payload) {
                // Log every 100th media chunk to avoid excessive logging
                if (parseInt(message.media.chunk) % 100 === 0) {
                  logger.info('Processing media chunk:', {
                    callSid,
                    chunk: message.media.chunk,
                    track: message.media.track,
                    timestamp: message.media.timestamp
                  });
                }
                
                // Only process inbound audio (from caller to system)
                if (message.media.track === 'inbound_track') {
                  const audioChunk = await this.audioService.decodeTwilioAudio(message.media.payload);
                  this.audioService.accumulateAudio(callSid, audioChunk);
                }
              }
              break;

            case 'stop':
              logger.info('Received stop event, processing accumulated audio...');
              await this.handleStreamEnd(callSid, ws);
              break;

            case 'start':
              logger.info('Audio stream started:', {
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
                
                /**
                 * Generate TwiML Response
                 * 
                 * Creates a TwiML response that plays the TTS audio and
                 * sets up speech recognition for the next user input.
                 */
                const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${message.audioUrl}</Play>
  <Gather input="speech" action="/twilio/voice/process" method="POST" 
          speechTimeout="auto" 
          speechModel="phone_call"
          enhanced="true"
          language="en-US"
          speechRecognitionLanguage="en-US"
          profanityFilter="false"
          interimSpeechResultsCallback="/twilio/voice/interim"
          interimSpeechResultsCallbackMethod="POST"/>
</Response>`;

                // Send TwiML response back to Twilio
                ws.send(JSON.stringify({
                  type: 'twiml',
                  twiml
                }));
              }
              break;

            default:
              logger.info('Unknown WebSocket event received:', message.event);
          }
        } catch (error) {
          logger.error('Error processing WebSocket message:', error);
        }
      });

      /**
       * WebSocket Connection Close Handler
       * 
       * Cleans up resources when a WebSocket connection is closed.
       */
      ws.on('close', () => {
        logger.info(`WebSocket connection closed for call ${callSid}`);
        this.audioService.clearAccumulatedAudio(callSid);
        this.activeCalls.delete(callSid);
      });

      /**
       * WebSocket Error Handler
       * 
       * Handles WebSocket errors and cleans up resources.
       */
      ws.on('error', (error) => {
        logger.error(`WebSocket error for call ${callSid}:`, error);
        this.activeCalls.delete(callSid);
      });
    });
  }

  /**
   * Handle stream end event
   * 
   * Processes accumulated audio when the Twilio stream ends,
   * typically when the user stops speaking.
   * 
   * @param {string} callSid - Twilio Call SID
   * @param {WebSocket} ws - WebSocket connection
   */
  async handleStreamEnd(callSid, ws) {
    try {
      // Get accumulated audio chunks for this call
      const audioChunks = this.audioService.getAccumulatedAudio(callSid);
      
      if (audioChunks.length === 0) {
        logger.warn('No audio chunks accumulated for call:', callSid);
        return;
      }

      logger.info('Processing accumulated audio:', {
        callSid,
        chunkCount: audioChunks.length
      });

      // Transcribe the accumulated audio using Whisper
      const transcription = await this.audioService.transcribeWithWhisper(audioChunks);
      
      // Get GPT response based on transcription
      const gptReply = await this.audioService.getGptReply(transcription);
      
      // Send response back to the client
      if (ws && ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'response',
          transcription,
          reply: gptReply
        }));
      }
      
      logger.info('Audio processing complete for call:', callSid);
      
    } catch (error) {
      logger.error('Error handling stream end:', error);
    }
  }

  /**
   * Handle call end event
   * 
   * Processes call completion, generates call summary, and cleans up resources.
   * 
   * @param {string} callSid - Twilio Call SID
   * @returns {Object|null} Generated call summary or null if no call data
   */
  async handleCallEnd(callSid) {
    let summary = null;
    try {
      logger.info('Processing call end for:', callSid);
      
      const callData = this.activeCalls.get(callSid);
      logger.info('Retrieved callData for', callSid, ':', callData);
      
      if (!callData) {
        logger.info('No call data found for call end:', callSid);
        logger.warn('No call data found for call end:', callSid);
        return null;
      }

      // Add conversation history to the call summary service
      if (callData.conversationHistory) {
        logger.info('Adding conversation history:', callData.conversationHistory);
        try {
          callData.conversationHistory.forEach(message => {
            this.callSummaryService.addToHistory(callSid, message);
          });
        } catch (err) {
          logger.error('Error in addToHistory for conversationHistory:', err);
        }
      }
      
      // Debug: log before calling generateSummary
      logger.info('Calling callSummaryService.generateSummary with:', callSid);
      // Generate call summary
      summary = await this.callSummaryService.generateSummary(callSid);
      
      // Save call summary to file
      const summaryPath = path.join(process.cwd(), 'call-summaries', `${callSid}.json`);
      fsSync.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      
      logger.info('Call summary generated and saved:', summaryPath);
    } catch (error) {
      logger.error('Error handling call end:', error);
      summary = null;
    } finally {
      // Clean up call data
      this.activeCalls.delete(callSid);
      this.audioService.clearAccumulatedAudio(callSid);
    }
    logger.info('Returning summary from handleCallEnd:', summary);
    return summary;
  }

  /**
   * Add a client WebSocket connection for a call
   * 
   * @param {string} callSid - Twilio Call SID
   * @param {WebSocket} ws - WebSocket connection
   */
  addClient(callSid, ws) {
    this.activeCalls.set(callSid, { ...this.activeCalls.get(callSid), ws });
  }

  /**
   * Remove a client WebSocket connection for a call
   * 
   * @param {string} callSid - Twilio Call SID
   */
  removeClient(callSid) {
    this.activeCalls.delete(callSid);
  }

  /**
   * Get the WebSocket client for a specific call
   * 
   * @param {string} callSid - Twilio Call SID
   * @returns {WebSocket|null} WebSocket connection or null if not found
   */
  getClient(callSid) {
    const callData = this.activeCalls.get(callSid);
    return callData ? callData.ws : null;
  }

  /**
   * Get the total number of active clients
   * 
   * @returns {number} Number of active WebSocket connections
   */
  getClientCount() {
    return this.activeCalls.size;
  }

  /**
   * Send a message to a specific client
   * 
   * @param {string} callSid - Twilio Call SID
   * @param {Object} message - Message to send
   * @returns {boolean} True if message was sent successfully
   */
  sendToClient(callSid, message) {
    const ws = this.getClient(callSid);
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Broadcast a message to all connected clients
   * 
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    this.activeCalls.forEach((callData, callSid) => {
      if (callData.ws && callData.ws.readyState === 1) {
        callData.ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Close all WebSocket connections and clean up resources
   */
  close() {
    logger.info('Closing WebSocket server...');
    
    // Close all active connections
    this.activeCalls.forEach((callData, callSid) => {
      if (callData.ws) {
        callData.ws.close();
      }
    });
    
    // Close the WebSocket server
    this.wss.close(() => {
      logger.info('WebSocket server closed successfully');
    });
    
    // Clear active calls
    this.activeCalls.clear();
  }

  /**
   * Add a message to the conversation history for a call
   * 
   * @param {string} callSid - Twilio Call SID
   * @param {Object} message - Message to add to history
   */
  addToHistory(callSid, message) {
    const callData = this.activeCalls.get(callSid);
    if (callData) {
      callData.conversationHistory.push({
        ...message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get the current number of active connections
   * 
   * @returns {number} Number of active WebSocket connections
   */
  getConnectionCount() {
    return this.wss.clients.size;
  }

  /**
   * Get the current status of the WebSocket server
   * 
   * @returns {Object} Server status information
   */
  getStatus() {
    return {
      activeConnections: this.getConnectionCount(),
      activeCalls: this.activeCalls.size,
      serverState: this.wss.readyState
    };
  }
} 