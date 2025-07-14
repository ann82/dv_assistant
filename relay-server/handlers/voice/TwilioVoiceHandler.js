import { BaseHandler } from '../base/BaseHandler.js';
import { WebSocket as RealWebSocket } from 'ws';
import twilio from 'twilio';
import { TwilioWebSocketServer } from '../../websocketServer.js';
import { AudioService } from '../../services/audioService.js';
import path from 'path';
import fs from 'fs/promises';
import { getLanguageConfig, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../../lib/languageConfig.js';
import logger from '../../lib/logger.js';

// Get validateRequest from twilio package
const { validateRequest: twilioValidateRequest } = twilio;

// Constants for better maintainability
const CALL_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  IN_PROGRESS: 'in-progress'
};

const ERROR_MESSAGES = {
  INVALID_REQUEST: 'Invalid Twilio request',
  PROCESSING_ERROR: 'Error processing call',
  STATUS_ERROR: 'Error processing call status'
};

const HTTP_STATUS = {
  OK: 200,
  FORBIDDEN: 403,
  SERVER_ERROR: 500
};

/**
 * TwilioVoiceHandler - Handles Twilio voice call operations
 * Extends BaseHandler for common functionality and focuses on voice-specific operations
 */
export class TwilioVoiceHandler extends BaseHandler {
  constructor(
    accountSid, 
    authToken, 
    phoneNumber, 
    services = {}, 
    dependencies = {}
  ) {
    super(services, 'TwilioVoiceHandler');
    
    // Extract dependencies with defaults for testability
    const {
      validateRequest = twilioValidateRequest,
      WebSocketClass = RealWebSocket,
      VoiceResponseClass = twilio.twiml.VoiceResponse,
      twilioClient = null,
      audioService = null,
      getLanguageConfigFn = getLanguageConfig,
      DEFAULT_LANGUAGE_CONST = DEFAULT_LANGUAGE
    } = dependencies;
    
    // Handle test environment where credentials might not be available
    if (process.env.NODE_ENV === 'test') {
      this.accountSid = accountSid || 'ACtest123456789';
      this.authToken = authToken || 'test_auth_token';
      this.phoneNumber = phoneNumber || '+1234567890';
    } else {
      // Production environment - validate credentials
      if (!accountSid || !accountSid.startsWith('AC')) {
        throw new Error('accountSid must start with AC');
      }
      if (!authToken) {
        throw new Error('authToken is required');
      }
      if (!phoneNumber) {
        throw new Error('phoneNumber is required');
      }
      this.accountSid = accountSid;
      this.authToken = authToken;
      this.phoneNumber = phoneNumber;
    }
    
    this.activeCalls = new Map(); // Track active calls
    this.validateRequest = validateRequest;
    this.WebSocketClass = WebSocketClass;
    this.twilioClient = twilioClient || twilio(this.accountSid, this.authToken);
    this.processingRequests = new Map(); // Track processing requests
    this.VoiceResponseClass = VoiceResponseClass;
    this.wsServer = null; // Initialize as null, will be set later via setWebSocketServer
    
    // Use injected AudioService or create new one
    this.audioService = audioService || new AudioService();
    
    // Store injected functions
    this._getLanguageConfig = getLanguageConfigFn;
    this._DEFAULT_LANGUAGE = DEFAULT_LANGUAGE_CONST;
    
    // Store all dependencies for testability
    this._deps = dependencies;
    
    // Schedule periodic cleanup of old audio files
    this.scheduleAudioCleanup();
  }

  /**
   * Get required services for this handler
   * @returns {Array} Array of required service names
   */
  getRequiredServices() {
    return ['tts', 'search', 'context'];
  }

  /**
   * Validate incoming request structure (not Twilio signature)
   * @param {Object} request - Request to validate
   */
  async validateIncomingRequest(request) {
    if (!request) {
      throw new Error('Request is required');
    }
    // For Twilio requests, we'll do the validation in the specific handler methods
    // to avoid conflicts with the Twilio validation function
    return true;
  }

  /**
   * Set WebSocket server instance
   * @param {Object} wsServer - WebSocket server instance
   */
  setWebSocketServer(wsServer) {
    this.wsServer = wsServer;
  }

  /**
   * Handle incoming Twilio call
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} TwiML response
   */
  async handleIncomingCall(req) {
    return this.processRequest(req, 'incoming call', async (request) => {
      try {
        // Set longer timeout for Twilio requests
        request.setTimeout(30000); // 30 seconds timeout
        
        // Log request headers for debugging
        this.logOperation('twilio request received', {
          headers: request.headers,
          body: request.body,
          url: request.originalUrl,
          protocol: request.protocol,
          host: request.get('host'),
          method: request.method
        });

        // Validate request (structure only)
        await this.validateIncomingRequest(request);
        this.logOperation('twilio request structure validated');

        // Validate Twilio signature (skip in dev)
        this.logOperation('validating twilio request');
        if (!this.validateTwilioRequest(request)) {
          this.logOperation('invalid twilio request', {
            headers: request.headers,
            body: request.body,
            url: request.originalUrl,
            method: request.method
          });
          const twiml = new this.VoiceResponseClass();
          twiml.say('Invalid request');
          return twiml;
        }
        this.logOperation('twilio request validated successfully');

        const callSid = request.body.CallSid;
        const from = request.body.From;
        const to = request.body.To;

        // Initialize call tracking
        this.activeCalls.set(callSid, {
          callSid,
          from,
          to,
          startTime: Date.now(),
          lastActivity: Date.now(),
          status: CALL_STATUS.IN_PROGRESS,
          timeouts: new Set(),
          pendingRequests: new Set()
        });

        // Generate welcome message using TTS service
        const language = DEFAULT_LANGUAGE; // or detect dynamically
        const welcomeMessage = SUPPORTED_LANGUAGES[language].prompts.welcome;
        this.logger.info('Selected welcome message', { callSid, language, welcomeMessage });
        this.logOperation('generating welcome message', { welcomeMessage });
        
        // Create a simple TwiML response
        const twiml = new this.VoiceResponseClass();
        twiml.say(welcomeMessage);
        twiml.gather({
          input: 'speech',
          action: '/twilio/voice/process',
          method: 'POST'
        });
        this.logger.info('Sending welcome message TwiML', { callSid, language, twiml: twiml.toString() });

        this.logOperation('incoming call handled', { callSid, from, to });
        return twiml;
      } catch (error) {
        this.logger.error('Error in handleIncomingCall:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        throw error;
      }
    });
  }

  /**
   * Handle speech input from Twilio
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} TwiML response
   */
  async handleSpeechInput(req) {
    return this.processRequest(req, 'speech input', async (request) => {
      const speechResult = request.body.SpeechResult;
      const callSid = request.body.CallSid;
      const languageCode = this.detectLanguage(request, speechResult);

      if (!speechResult || speechResult.trim() === '') {
        const noSpeechMessage = this.getLocalizedPrompt(languageCode, 'noSpeech');
        return this.generateTwiML(noSpeechMessage, true, languageCode);
      }

      // Process speech input using the speech processor
      const result = await this.processSpeechInput(speechResult, callSid, languageCode);
      
      this.logOperation('speech input processed', { 
        callSid, 
        speechResult: speechResult.substring(0, 100),
        languageCode 
      });

      return result;
    });
  }

  /**
   * Process speech input and generate response
   * @param {string} speechResult - Speech input text
   * @param {string} callSid - Call SID
   * @param {string} languageCode - Language code
   * @returns {Promise<Object>} TwiML response
   */
  async processSpeechInput(speechResult, callSid = null, languageCode = DEFAULT_LANGUAGE) {
    const requestId = this.generateRequestId();

    try {
      this.logOperation('processing speech input', {
        requestId,
        callSid,
        speechResult: speechResult.substring(0, 100),
        languageCode,
        requestType: 'twilio',
        timestamp: new Date().toISOString()
      });

      // Preprocess speech
      const processedSpeech = this.preprocessSpeech(speechResult);
      
      // Check if speech is garbled
      if (this.isGarbled(processedSpeech)) {
        const garbledMessage = this.getLocalizedPrompt(languageCode, 'garbledSpeech');
        return this.generateTwiML(garbledMessage, true, languageCode);
      }

      // Use services to process the request
      const context = callSid ? await this.services.context.getConversationContext(callSid) : null;
      
      // Update context with new interaction
      if (callSid) {
        await this.services.context.updateConversationContext(callSid, {
          interaction: {
            query: processedSpeech,
            timestamp: Date.now()
          }
        });
      }

      // Generate response using search service
      const searchResult = await this.services.search.performSearch(processedSpeech, context);
      
      // Generate TTS response
      const responseText = searchResult.data.response || 'I apologize, but I could not process your request.';
      const twiml = await this.generateTTSBasedTwiML(responseText, true, languageCode);

      this.logOperation('speech processing completed', { 
        requestId, 
        callSid, 
        responseLength: responseText.length 
      });

      return twiml;

    } catch (error) {
      await this.handleError(error, 'processSpeechInput', { requestId, callSid });
      
      const errorMessage = this.getLocalizedPrompt(languageCode, 'error');
      return this.generateTwiML(errorMessage, true, languageCode);
    }
  }

  /**
   * Handle call status updates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleCallStatus(req, res) {
    return this.processRequest(req, 'call status', async (request) => {
      const callSid = request.body.CallSid;
      const callStatus = request.body.CallStatus;

      await this.handleCallStatusUpdate(callSid, callStatus);
      
      this.logOperation('call status updated', { callSid, callStatus });
      
      res.status(HTTP_STATUS.OK).send('OK');
      return { success: true };
    });
  }

  /**
   * Validate Twilio request
   * @param {Object} req - Express request object
   * @returns {boolean} Whether request is valid
   */
  validateTwilioRequest(req) {
    try {
      // Skip validation in development/test environment for testing
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        this.logger.info('Skipping Twilio validation in development/test environment');
        return true;
      }
      return this.validateRequest(req, this.authToken);
    } catch (error) {
      this.logger.error('Twilio request validation failed:', error);
      return false;
    }
  }

  /**
   * Create WebSocket connection for real-time communication
   * @param {string} callSid - Call SID
   * @param {string} from - Caller phone number
   * @param {Object} res - Express response object
   */
  async createWebSocketConnection(callSid, from, res) {
    try {
      if (!this.wsServer) {
        this.logger.warn('WebSocket server not available for call:', callSid);
        return;
      }

      const ws = await this.wsServer.createConnection(callSid, from);
      this.setupWebSocketHandlers(ws, callSid, res);
      
      this.logOperation('websocket connection created', { callSid, from });
    } catch (error) {
      this.logger.error('Failed to create WebSocket connection:', error);
    }
  }

  /**
   * Setup WebSocket event handlers
   * @param {Object} ws - WebSocket instance
   * @param {string} callSid - Call SID
   * @param {Object} res - Express response object
   */
  setupWebSocketHandlers(ws, callSid, res) {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      this.logger.error(`No call found for ${callSid} in setupWebSocketHandlers`);
      return;
    }

    // Initialize call-specific state
    call.responseTimeout = null;
    call.isResponding = false;
    call.lastRequestId = null;
    call.retryCount = 0;
    call.pendingRequests = new Set();
    
    const MAX_RETRIES = 3;
    const RESPONSE_TIMEOUT = 30000; // 30 seconds
    const CONNECTION_TIMEOUT = 30000; // 30 seconds
    const ACTIVITY_CHECK_INTERVAL = 15000; // 15 seconds

    // Set up activity monitoring
    const activityCheck = setInterval(() => {
      const currentCall = this.activeCalls.get(callSid);
      if (currentCall) {
        const timeSinceLastActivity = Date.now() - currentCall.lastActivity;
        if (timeSinceLastActivity > CONNECTION_TIMEOUT) {
          this.logger.error(`No activity detected for call ${callSid} for ${timeSinceLastActivity}ms`);
          clearInterval(activityCheck);
          this.handleCallTimeout(callSid, res);
        }
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Store the interval in the call's timeouts set
    call.timeouts.add(activityCheck);

    // WebSocket event handlers
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        call.lastActivity = Date.now();
        
        this.logOperation('websocket message received', { callSid, messageType: message.type });
        
        // Handle different message types
        switch (message.type) {
          case 'speech':
            await this.handleWebSocketSpeech(callSid, message.data, res);
            break;
          case 'status':
            await this.handleWebSocketStatus(callSid, message.data);
            break;
          default:
            this.logger.warn('Unknown WebSocket message type:', message.type);
        }
      } catch (error) {
        this.logger.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.logOperation('websocket connection closed', { callSid });
      clearInterval(activityCheck);
      this.cleanupCall(callSid);
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
      clearInterval(activityCheck);
      this.handleCallError(callSid, res, error);
    });
  }

  /**
   * Handle WebSocket speech messages
   * @param {string} callSid - Call SID
   * @param {Object} data - Speech data
   * @param {Object} res - Express response object
   */
  async handleWebSocketSpeech(callSid, data, res) {
    try {
      const result = await this.processSpeechInput(data.text, callSid, data.languageCode);
      
      // Send response back through WebSocket
      if (this.wsServer) {
        this.wsServer.sendMessage(callSid, {
          type: 'response',
          data: {
            twiml: result.toString(),
            text: data.text
          }
        });
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket speech:', error);
    }
  }

  /**
   * Handle WebSocket status messages
   * @param {string} callSid - Call SID
   * @param {Object} data - Status data
   */
  async handleWebSocketStatus(callSid, data) {
    try {
      await this.handleCallStatusUpdate(callSid, data.status);
    } catch (error) {
      this.logger.error('Error handling WebSocket status:', error);
    }
  }

  /**
   * Handle call timeout
   * @param {string} callSid - Call SID
   * @param {Object} res - Express response object
   */
  async handleCallTimeout(callSid, res) {
    this.logOperation('call timeout', { callSid });
    await this.cleanupCall(callSid);
  }

  /**
   * Handle call error
   * @param {string} callSid - Call SID
   * @param {Object} res - Express response object
   * @param {Error} error - Error object
   */
  async handleCallError(callSid, res, error) {
    this.logOperation('call error', { callSid, error: error.message });
    await this.cleanupCall(callSid);
  }

  /**
   * Clean up call resources
   * @param {string} callSid - Call SID
   */
  async cleanupCall(callSid) {
    try {
      const call = this.activeCalls.get(callSid);
      if (call) {
        // Clear all timeouts
        call.timeouts.forEach(timeout => clearTimeout(timeout));
        call.timeouts.clear();
        
        // Remove from active calls
        this.activeCalls.delete(callSid);
        
        this.logOperation('call cleaned up', { callSid });
      }
    } catch (error) {
      this.logger.error('Error cleaning up call:', error);
    }
  }

  /**
   * Generate TwiML response
   * @param {string} text - Text to speak
   * @param {boolean} shouldGather - Whether to gather input after speaking
   * @param {string} languageCode - Language code
   * @returns {Object} TwiML response
   */
  generateTwiML(text, shouldGather = true, languageCode = DEFAULT_LANGUAGE) {
    const twiml = new this.VoiceResponseClass();
    
    // Handle undefined or null text
    const safeText = text || 'I\'m sorry, I didn\'t understand. Please try again.';
    
    // Escape XML characters
    const escapedText = this.escapeXML(safeText);
    
    // Add speech with simple voice settings
    twiml.say(escapedText, {
      voice: 'Polly.Amy',
      language: 'en-US'
    });

    if (shouldGather) {
      const gather = twiml.gather({
        input: 'speech',
        language: 'en-US',
        speechTimeout: 30,
        action: '/twilio/speech',
        method: 'POST'
      });
      
      // Add fallback message if no speech detected
      gather.say('I didn\'t hear anything. Please try again.', {
        voice: 'Polly.Amy',
        language: 'en-US'
      });
    }

    return twiml;
  }

  /**
   * Generate TTS-based TwiML response
   * @param {string} text - Text to speak
   * @param {boolean} shouldGather - Whether to gather input after speaking
   * @param {string} languageCode - Language code
   * @param {Object} metadata - Additional metadata for logging
   * @returns {Promise<Object>} TwiML response
   */
  async generateTTSBasedTwiML(text, shouldGather = true, languageCode = DEFAULT_LANGUAGE, metadata = {}) {
    try {
      // Handle undefined or null text
      const safeText = text || 'I\'m sorry, I didn\'t understand. Please try again.';
      
      this.logger.info('Generating TTS-based TwiML:', {
        textLength: safeText.length,
        textPreview: safeText.substring(0, 100) + (safeText.length > 100 ? '...' : ''),
        shouldGather,
        languageCode,
        ...metadata
      });
      
      // Use TTS service to generate audio with metadata
      const audioResult = await this.services.tts.generateSpeech(safeText, languageCode, metadata);
      
      if (audioResult.success && audioResult.data.audioUrl) {
        const twiml = new this.VoiceResponseClass();
        
        // Play the generated audio
        twiml.play(audioResult.data.audioUrl);

        if (shouldGather) {
          const gather = twiml.gather({
            input: 'speech',
            language: languageCode,
            speechTimeout: 30,
            action: '/twilio/speech',
            method: 'POST'
          });
          
          // Add fallback message if no speech detected
          const langConfig = this._getLanguageConfig(languageCode);
          const noSpeechPrompt = this.getLocalizedPrompt(languageCode, 'noSpeech') || 'I didn\'t hear anything. Please try again.';
          gather.say(noSpeechPrompt, {
            voice: langConfig.voice,
            language: languageCode
          });
        }

        this.logger.info('TTS-based TwiML generated successfully:', {
          audioUrl: audioResult.data.audioUrl,
          shouldGather,
          languageCode,
          ...metadata
        });

        return twiml;
      } else {
        // Fallback to regular TwiML if TTS fails
        this.logger.warn('TTS failed, falling back to regular TwiML:', {
          ttsSuccess: audioResult.success,
          ttsError: audioResult.error,
          ...metadata
        });
        return this.generateTwiML(safeText, shouldGather, languageCode);
      }
    } catch (error) {
      this.logger.error('Error generating TTS TwiML:', {
        error: error.message,
        stack: error.stack,
        textLength: text?.length || 0,
        shouldGather,
        languageCode,
        ...metadata
      });
      // Fallback to regular TwiML
      return this.generateTwiML(text, shouldGather, languageCode);
    }
  }

  /**
   * Escape XML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeXML(text) {
    // Handle undefined, null, or non-string values
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Send TwiML response
   * @param {Object} res - Express response object
   * @param {Object} twiml - TwiML response
   */
  async sendTwiMLResponse(res, twiml) {
    try {
      res.set('Content-Type', 'text/xml');
      res.send(twiml.toString());
    } catch (error) {
      this.logger.error('Error sending TwiML response:', error);
      res.status(HTTP_STATUS.SERVER_ERROR).send('Internal Server Error');
    }
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   */
  sendErrorResponse(res, status, message) {
    res.status(status).json({ error: message });
  }

  /**
   * Send success response
   * @param {Object} res - Express response object
   */
  sendSuccessResponse(res) {
    res.status(HTTP_STATUS.OK).send('OK');
  }

  /**
   * Handle call status update
   * @param {string} callSid - Call SID
   * @param {string} status - Call status
   */
  async handleCallStatusUpdate(callSid, status) {
    try {
      const call = this.activeCalls.get(callSid);
      if (call) {
        call.status = status;
        call.lastActivity = Date.now();

        if (status === CALL_STATUS.COMPLETED) {
          await this.handleCallEnd(callSid);
        }
      }
    } catch (error) {
      this.logger.error('Error handling call status update:', error);
    }
  }

  /**
   * Handle call end
   * @param {string} callSid - Call SID
   */
  async handleCallEnd(callSid) {
    try {
      const call = this.activeCalls.get(callSid);
      if (call) {
        // Generate call summary
        const summary = await this.generateCallSummary(callSid, call);
        
        // Send SMS with resources if consent was given
        if (call.smsConsent) {
          await this.sendSMSWithRetry(callSid, call, summary);
        }
        
        this.logOperation('call ended', { callSid, duration: Date.now() - call.startTime });
      }
      
      await this.cleanupCall(callSid);
    } catch (error) {
      this.logger.error('Error handling call end:', error);
    }
  }

  /**
   * Preprocess speech input
   * @param {string} speechResult - Raw speech input
   * @returns {string} Processed speech
   */
  preprocessSpeech(speechResult) {
    if (!speechResult) return '';

    let processed = speechResult.trim();

    // Remove common speech artifacts
    processed = processed.replace(/\b(um|uh|er|ah|like|you know|i mean)\b/gi, '');
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Remove trailing punctuation
    processed = processed.replace(/[.!?]+$/, '');
    
    // Convert to lowercase for consistency
    processed = processed.toLowerCase();

    return processed.trim();
  }

  /**
   * Check if speech is garbled
   * @param {string} speech - Speech text
   * @returns {boolean} Whether speech is garbled
   */
  isGarbled(speech) {
    if (!speech || speech.length < 3) return true;
    
    // Check for excessive repetition
    const words = speech.split(' ');
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    
    if (repetitionRatio < 0.3) return true;
    
    // Check for excessive special characters
    const specialCharRatio = (speech.match(/[^a-zA-Z0-9\s]/g) || []).length / speech.length;
    if (specialCharRatio > 0.5) return true;
    
    return false;
  }

  /**
   * Extract key words from speech
   * @param {string} speech - Speech text
   * @returns {Array} Array of key words
   */
  extractKeyWords(speech) {
    if (!speech) return [];
    
    const words = speech.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return words
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to 10 key words
  }

  /**
   * Clean up old audio files
   * @param {number} maxAge - Maximum age in milliseconds
   */
  async cleanupOldAudioFiles(maxAge = 24 * 60 * 60 * 1000) {
    try {
      const audioDir = path.join(process.cwd(), 'public', 'audio');
      const files = await fs.readdir(audioDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(audioDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          this.logger.info('Cleaned up old audio file:', file);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up audio files:', error);
    }
  }

  /**
   * Schedule periodic audio cleanup
   */
  scheduleAudioCleanup() {
    // Clean up every 6 hours
    setInterval(() => {
      this.cleanupOldAudioFiles();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Detect language from speech input or request headers
   * @param {Object} req - Express request object
   * @param {string} speechResult - Speech input text
   * @returns {string} Language code
   */
  detectLanguage(req, speechResult = '') {
    try {
      // Check if language is explicitly set in request
      const explicitLanguage = req.body?.Language || req.headers['accept-language'];
      if (explicitLanguage) {
        const langConfig = this._getLanguageConfig(explicitLanguage);
        if (langConfig) {
          this.logger.info('Language detected from request:', { language: explicitLanguage, config: langConfig.name });
          return explicitLanguage;
        }
      }

      // Try to detect language from speech content
      if (speechResult) {
        const detectedLang = this.detectLanguageFromText(speechResult);
        if (detectedLang) {
          this.logger.info('Language detected from speech:', { language: detectedLang, text: speechResult.substring(0, 50) });
          return detectedLang;
        }
      }

      // Default to English
      this.logger.info('Using default language:', this._DEFAULT_LANGUAGE);
      return this._DEFAULT_LANGUAGE;
    } catch (error) {
      this.logger.error('Error detecting language:', error);
      return this._DEFAULT_LANGUAGE;
    }
  }

  /**
   * Detect language from text content using simple heuristics
   * @param {string} text - Text to analyze
   * @returns {string|null} Language code or null if not detected
   */
  detectLanguageFromText(text) {
    if (!text) return null;

    const normalizedText = text.toLowerCase();
    
    // Spanish detection
    const spanishWords = ['hola', 'gracias', 'por favor', 'ayuda', 'necesito', 'donde', 'como', 'que', 'el', 'la', 'de', 'en', 'con', 'para', 'por', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'hacia', 'según', 'durante', 'mediante', 'excepto', 'salvo', 'además', 'también', 'pero', 'sin embargo', 'aunque', 'si', 'cuando', 'donde', 'porque', 'como', 'que', 'quien', 'cual', 'cuyo', 'cuanto'];
    const spanishCount = spanishWords.filter(word => normalizedText.includes(word)).length;
    
    // French detection
    const frenchWords = ['bonjour', 'merci', 's\'il vous plaît', 'aide', 'besoin', 'où', 'comment', 'quoi', 'le', 'la', 'de', 'en', 'avec', 'pour', 'par', 'sans', 'sur', 'entre', 'jusqu\'à', 'depuis', 'vers', 'selon', 'pendant', 'par', 'sauf', 'sauf', 'aussi', 'également', 'mais', 'cependant', 'bien que', 'si', 'quand', 'où', 'parce que', 'comme', 'que', 'qui', 'quel', 'dont', 'combien'];
    const frenchCount = frenchWords.filter(word => normalizedText.includes(word)).length;
    
    // German detection
    const germanWords = ['hallo', 'danke', 'bitte', 'hilfe', 'brauche', 'wo', 'wie', 'was', 'der', 'die', 'das', 'von', 'in', 'mit', 'für', 'durch', 'ohne', 'über', 'zwischen', 'bis', 'seit', 'nach', 'laut', 'während', 'durch', 'außer', 'außer', 'auch', 'ebenfalls', 'aber', 'jedoch', 'obwohl', 'wenn', 'wann', 'wo', 'weil', 'wie', 'dass', 'wer', 'welcher', 'dessen', 'wie viel'];
    const germanCount = germanWords.filter(word => normalizedText.includes(word)).length;

    // Threshold for detection (at least 2 words)
    const threshold = 2;
    
    if (spanishCount >= threshold) return 'es-ES';
    if (frenchCount >= threshold) return 'fr-FR';
    if (germanCount >= threshold) return 'de-DE';
    
    return null;
  }

  /**
   * Get language-specific prompt
   * @param {string} languageCode - Language code
   * @param {string} promptKey - Prompt key (e.g., 'welcome', 'incompleteLocation')
   * @returns {string} Localized prompt
   */
  getLocalizedPrompt(languageCode, promptKey, params = {}) {
    try {
      // Use injected getLanguageConfig if available, otherwise use the global one
      const getLangConfig = this._deps?.getLanguageConfig || this._getLanguageConfig;
      const langConfig = getLangConfig(languageCode);
      let prompt = langConfig.prompts[promptKey] || langConfig.prompts.fallback || 'I\'m sorry, I didn\'t understand your request.';

      // Replace placeholders in the prompt if parameters are provided
      if (Object.keys(params).length > 0) {
        for (const key in params) {
          prompt = prompt.replace(`{{${key}}}`, params[key]);
        }
      }

      // Ensure we always return a string
      return typeof prompt === 'string' ? prompt : 'I\'m sorry, I didn\'t understand your request.';
    } catch (error) {
      this.logger.error('Error getting localized prompt:', { languageCode, promptKey, error: error.message });
      return 'I\'m sorry, I didn\'t understand your request.';
    }
  }

  /**
   * Generate call summary
   * @param {string} callSid - Call SID
   * @param {Object} call - Call object
   * @returns {Promise<Object>} Call summary
   */
  async generateCallSummary(callSid, call) {
    try {
      const context = await this.services.context.getConversationContext(callSid);
      return {
        callSid,
        duration: Date.now() - call.startTime,
        context: context || {},
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error generating call summary:', error);
      return { callSid, error: 'Failed to generate summary' };
    }
  }

  /**
   * Send SMS with retry logic
   * @param {string} callSid - Call SID
   * @param {Object} call - Call object
   * @param {Object} summary - Call summary
   * @param {number} retryCount - Retry count
   */
  async sendSMSWithRetry(callSid, call, summary, retryCount = 0) {
    try {
      const message = this.formatSMSMessage(summary);
      await this.twilioClient.messages.create({
        body: message,
        from: this.phoneNumber,
        to: call.from
      });
      
      this.logOperation('sms sent', { callSid, to: call.from });
    } catch (error) {
      this.logger.error('Error sending SMS:', error);
      
      if (retryCount < 3) {
        setTimeout(() => {
          this.sendSMSWithRetry(callSid, call, summary, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  }

  /**
   * Format SMS message
   * @param {Object} summary - Call summary
   * @returns {string} Formatted SMS message
   */
  formatSMSMessage(summary) {
    // This would be implemented based on the call context and resources found
    return 'Thank you for calling. Here are the resources we discussed: [Resource links would be included here]';
  }
} 