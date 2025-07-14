/**
 * Handler Manager
 * 
 * Central coordinator for all request handlers in the Domestic Violence Support Assistant.
 * Manages the lifecycle of different handlers (voice, speech, response, intent) and provides
 * a unified interface for processing various types of requests.
 * 
 * This manager enables:
 * - Unified request processing across different handler types
 * - Dependency injection for handlers
 * - Conversation flow management
 * - Emergency and follow-up request handling
 * - Batch processing capabilities
 * - Health monitoring and validation
 * 
 * @author Domestic Violence Support Assistant Team
 * @version 1.21.3
 * @since 2024-03-15
 */

// Handler imports for different request types
import { TwilioVoiceHandler } from './voice/TwilioVoiceHandler.js';
import { SpeechHandler } from './voice/SpeechHandler.js';
import { ResponseHandler } from './response/ResponseHandler.js';
import { IntentHandler } from './intent/IntentHandler.js';
import { HandlerFactory } from './HandlerFactory.js';
import { UnifiedResponseHandler } from '../lib/unifiedResponseHandler.js';
import { getConversationContext, updateConversationContext, clearConversationContext } from '../lib/intentClassifier.js';
import logger from '../lib/logger.js';

/**
 * HandlerManager Class
 * 
 * Manages all handlers and provides a unified interface for request processing.
 * Coordinates between different handlers and services to provide comprehensive
 * domestic violence support functionality.
 */
export class HandlerManager {
  /**
   * Constructor
   * 
   * Initializes the handler manager with services and dependencies,
   * then creates and configures all necessary handlers.
   * 
   * @param {Object} services - Core application services (audio, tts, search, context)
   * @param {Object} dependencies - External dependencies and integrations
   */
  constructor(services = {}, dependencies = {}) {
    // Store core services and dependencies for handler injection
    this.services = services;
    this.dependencies = dependencies;
    
    // Map to store initialized handlers
    this.handlers = new Map();
    
    // Logger instance for consistent logging
    this.logger = logger;
    
    // Factory for creating handlers with proper dependency injection
    this.factory = new HandlerFactory();
    
    // Initialize all handlers
    this.initializeHandlers();
  }

  /**
   * Initialize all handlers
   * 
   * Creates and configures all necessary handlers using the factory pattern.
   * This ensures proper dependency injection and consistent handler setup.
   */
  initializeHandlers() {
    try {
      // Use factory to create handlers with proper dependency injection
      const handlers = this.factory.createAllHandlers({
        services: this.services,
        dependencies: this.dependencies
      });

      // Store handlers in map for easy access
      this.handlers.set('twilioVoice', handlers.twilioVoice);
      this.handlers.set('speech', handlers.speech);
      this.handlers.set('response', handlers.response);
      this.handlers.set('intent', handlers.intent);

      this.logger.info('HandlerManager initialized with handlers:', Array.from(this.handlers.keys()));
    } catch (error) {
      this.logger.error('Error initializing handlers:', error);
      throw error;
    }
  }

  /**
   * Get a handler by name
   * 
   * Retrieves a specific handler from the handler map.
   * Throws an error if the handler is not found.
   * 
   * @param {string} handlerName - Name of the handler to retrieve
   * @returns {Object} Handler instance
   * @throws {Error} If handler is not found
   */
  getHandler(handlerName) {
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      throw new Error(`Handler '${handlerName}' not found`);
    }
    return handler;
  }

  /**
   * Get all available handlers
   * 
   * Returns a list of all handler names that are currently available.
   * 
   * @returns {Array<string>} Array of handler names
   */
  getAvailableHandlers() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Process voice call
   * 
   * Handles incoming Twilio voice calls, including speech recognition,
   * intent classification, and response generation.
   * 
   * @param {Object} request - Voice call request with Twilio parameters
   * @returns {Promise<Object>} Processing result with TwiML response
   */
  async processVoiceCall(request) {
    const handler = this.getHandler('twilioVoice');
    return handler.handleIncomingCall(request);
  }

  /**
   * Process speech input
   * 
   * Processes speech input for text extraction, language detection,
   * and audio generation if needed.
   * 
   * @param {Object} request - Speech input request
   * @returns {Promise<Object>} Processing result with extracted text
   */
  async processSpeechInput(request) {
    const handler = this.getHandler('speech');
    return handler.processSpeech(request);
  }

  /**
   * Generate response
   * 
   * Generates appropriate responses using the UnifiedResponseHandler.
   * This is the main entry point for all response generation, providing
   * AI-powered responses for domestic violence support queries.
   * 
   * @param {Object} request - Response generation request
   * @returns {Promise<Object>} Generated response with resources and guidance
   */
  async generateResponse(request) {
    // Hard switch: use UnifiedResponseHandler for all response generation
    const { query, context, requestType = 'web', options = {} } = request;
    return UnifiedResponseHandler.getResponse(query, context, requestType, options);
  }

  /**
   * Classify intent
   * 
   * Determines the intent of user input (e.g., shelter search, emergency,
   * follow-up question, off-topic).
   * 
   * @param {Object} request - Intent classification request
   * @returns {Promise<Object>} Classification result with intent and confidence
   */
  async classifyIntent(request) {
    const handler = this.getHandler('intent');
    return handler.classifyIntent(request);
  }

  /**
   * Process complete conversation flow
   * 
   * Handles the complete conversation pipeline: intent classification,
   * speech processing, and response generation. This is the main method
   * for processing user interactions.
   * 
   * @param {Object} request - Complete conversation request
   * @param {string} request.text - User input text
   * @param {string} request.contextId - Conversation context identifier
   * @param {string} request.languageCode - Language code (default: 'en-US')
   * @param {string} request.format - Response format ('text' or 'voice')
   * @returns {Promise<Object>} Complete processing result
   */
  async processConversation(request) {
    const { text, contextId, languageCode = 'en-US', format = 'text' } = request;

    try {
      this.logger.info('Processing conversation:', { 
        text: text.substring(0, 100), 
        contextId, 
        languageCode 
      });

      // Step 1: Classify intent to understand user's needs
      const intentResult = await this.classifyIntent({
        text,
        contextId,
        languageCode
      });

      // Step 2: Process speech input (extract text, generate audio if needed)
      const speechResult = await this.processSpeechInput({
        text,
        contextId,
        languageCode,
        generateAudio: format === 'voice'
      });

      // Step 3: Generate appropriate response using AI and search
      const responseResult = await this.generateResponse({
        query: speechResult.data.processedText,
        contextId,
        languageCode,
        format
      });

      // Return comprehensive result with all processing steps
      return {
        success: true,
        data: {
          originalText: text,
          intent: intentResult.data,
          speech: speechResult.data,
          response: responseResult.data,
          contextId,
          languageCode,
          format,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      this.logger.error('Error processing conversation:', error);
      return {
        success: false,
        error: error.message,
        data: {
          originalText: text,
          contextId,
          languageCode,
          format,
          timestamp: Date.now()
        }
      };
    }
  }

  /**
   * Process emergency request
   * 
   * Handles emergency situations with immediate 911 guidance and
   * safety planning information.
   * 
   * @param {Object} request - Emergency request
   * @returns {Promise<Object>} Emergency response with safety guidance
   */
  async processEmergency(request) {
    const responseHandler = this.getHandler('response');
    return responseHandler.generateEmergencyResponse(request);
  }

  /**
   * Process follow-up request
   * 
   * Handles follow-up questions and requests for additional information
   * about previously mentioned resources.
   * 
   * @param {Object} request - Follow-up request
   * @returns {Promise<Object>} Follow-up response with additional details
   */
  async processFollowUp(request) {
    const responseHandler = this.getHandler('response');
    return responseHandler.generateFollowUpResponse(request);
  }

  /**
   * Batch process multiple requests
   * 
   * Processes multiple requests in parallel for improved performance.
   * Useful for bulk operations and testing.
   * 
   * @param {Object} request - Batch processing request
   * @param {Array} request.requests - Array of requests to process
   * @param {string} request.operation - Type of operation to perform
   * @returns {Promise<Object>} Batch processing results
   */
  async batchProcess(request) {
    const { requests, operation } = request;

    try {
      this.logger.info('Starting batch processing:', { 
        requestCount: requests.length, 
        operation 
      });

      // Process requests in parallel for better performance
      const results = await Promise.allSettled(
        requests.map(async (req) => {
          try {
            switch (operation) {
              case 'conversation':
                return await this.processConversation(req);
              case 'intent':
                return await this.classifyIntent(req);
              case 'response':
                return await this.generateResponse(req);
              case 'speech':
                return await this.processSpeechInput(req);
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
          } catch (error) {
            return {
              success: false,
              error: error.message,
              request: req
            };
          }
        })
      );

      // Process results and provide summary
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      this.logger.info('Batch processing completed:', { 
        total: results.length, 
        successful, 
        failed 
      });

      return {
        success: true,
        data: {
          results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason),
          summary: {
            total: results.length,
            successful,
            failed,
            operation
          }
        }
      };

    } catch (error) {
      this.logger.error('Error in batch processing:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get handler statistics
   * 
   * Returns statistics about handler usage and performance
   * for monitoring and optimization purposes.
   * 
   * @returns {Object} Handler statistics
   */
  getHandlerStats() {
    const stats = {
      totalHandlers: this.handlers.size,
      availableHandlers: this.getAvailableHandlers(),
      services: Object.keys(this.services),
      dependencies: Object.keys(this.dependencies),
      timestamp: Date.now()
    };

    // Add individual handler stats if available
    this.handlers.forEach((handler, name) => {
      if (handler.getStats) {
        stats[name] = handler.getStats();
      }
    });

    return stats;
  }

  /**
   * Validate handler health
   * 
   * Checks the health and readiness of all handlers.
   * Useful for health checks and monitoring.
   * 
   * @returns {Promise<Object>} Health validation results
   */
  async validateHandlerHealth() {
    const healthResults = {};

    for (const [name, handler] of this.handlers) {
      try {
        if (handler.validateHealth) {
          healthResults[name] = await handler.validateHealth();
        } else {
          healthResults[name] = { status: 'unknown', message: 'No health validation method' };
        }
      } catch (error) {
        healthResults[name] = { 
          status: 'error', 
          message: error.message 
        };
      }
    }

    const allHealthy = Object.values(healthResults).every(r => r.status === 'healthy');
    
    return {
      overall: allHealthy ? 'healthy' : 'unhealthy',
      handlers: healthResults,
      timestamp: Date.now()
    };
  }

  /**
   * Update services
   * 
   * Updates the services available to handlers.
   * Useful for dynamic service updates and testing.
   * 
   * @param {Object} services - New services to update
   */
  updateServices(services) {
    this.services = { ...this.services, ...services };
    
    // Update services in handlers if they support it
    this.handlers.forEach(handler => {
      if (handler.updateServices) {
        handler.updateServices(this.services);
      }
    });

    this.logger.info('Services updated:', Object.keys(services));
  }

  /**
   * Set WebSocket server
   * 
   * Sets the WebSocket server for real-time communication.
   * Used by handlers that need to send real-time updates.
   * 
   * @param {Object} wsServer - WebSocket server instance
   */
  setWebSocketServer(wsServer) {
    this.wsServer = wsServer;
    
    // Update WebSocket server in handlers that need it
    this.handlers.forEach(handler => {
      if (handler.setWebSocketServer) {
        handler.setWebSocketServer(wsServer);
      }
    });

    this.logger.info('WebSocket server set for handlers');
  }

  /**
   * Cleanup resources
   * 
   * Performs cleanup operations for all handlers and resources.
   * Should be called when shutting down the application.
   */
  async cleanup() {
    this.logger.info('Cleaning up HandlerManager');
    
    for (const [name, handler] of this.handlers) {
      try {
        if (handler.cleanup && typeof handler.cleanup === 'function') {
          await handler.cleanup();
        }
      } catch (error) {
        this.logger.error(`Error cleaning up handler ${name}:`, error);
      }
    }
    
    this.handlers.clear();
  }

  // Legacy methods for backward compatibility with existing routes

  /**
   * Get active calls (legacy compatibility)
   * 
   * @returns {Map} Active calls map
   */
  get activeCalls() {
    const twilioHandler = this.handlers.get('twilioVoice');
    return twilioHandler ? twilioHandler.activeCalls : new Map();
  }

  /**
   * Generate TTS-based TwiML (legacy compatibility)
   * 
   * @param {string} text - Text to convert to speech
   * @param {boolean} shouldGather - Whether to include gather element
   * @param {string} languageCode - Language code for TTS
   * @param {Object} metadata - Additional metadata for logging
   * @returns {Promise<string>} TwiML response
   */
  async generateTTSBasedTwiML(text, shouldGather = true, languageCode = null, metadata = {}) {
    const twilioHandler = this.handlers.get('twilioVoice');
    return twilioHandler ? twilioHandler.generateTTSBasedTwiML(text, shouldGather, languageCode, metadata) : null;
  }

  /**
   * Preprocess speech (legacy compatibility)
   * 
   * @param {string} speech - Raw speech input
   * @returns {string} Preprocessed speech
   */
  preprocessSpeech(speech) {
    const speechHandler = this.handlers.get('speech');
    return speechHandler ? speechHandler.preprocessSpeech(speech) : speech;
  }

  /**
   * Generate call summary (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   * @param {Object} call - Call data
   * @returns {Promise<Object>} Call summary
   */
  async generateCallSummary(callSid, call) {
    const twilioHandler = this.handlers.get('twilioVoice');
    return twilioHandler ? twilioHandler.generateCallSummary(callSid, call) : null;
  }

  /**
   * Send SMS with retry (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   * @param {Object} call - Call data
   * @param {Object} summary - Call summary
   * @returns {Promise<Object>} SMS sending result
   */
  async sendSMSWithRetry(callSid, call, summary) {
    const twilioHandler = this.handlers.get('twilioVoice');
    return twilioHandler ? twilioHandler.sendSMSWithRetry(callSid, call, summary) : null;
  }

  /**
   * Cleanup call (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   */
  async cleanupCall(callSid) {
    const twilioHandler = this.handlers.get('twilioVoice');
    if (twilioHandler) {
      await twilioHandler.cleanupCall(callSid);
    }
  }

  /**
   * Clear conversation context (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   */
  clearConversationContext(callSid) {
    clearConversationContext(callSid);
  }

  /**
   * Handle call status update (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   * @param {string} status - Call status
   */
  async handleCallStatusUpdate(callSid, status) {
    const twilioHandler = this.handlers.get('twilioVoice');
    if (twilioHandler) {
      await twilioHandler.handleCallStatusUpdate(callSid, status);
    }
  }

  /**
   * Get conversation context (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Conversation context
   */
  async getConversationContext(callSid) {
    return getConversationContext(callSid);
  }

  /**
   * Update conversation context (legacy compatibility)
   * 
   * @param {string} callSid - Call SID
   * @param {string} intent - Intent classification result
   * @param {string} query - User query
   * @param {Object} response - Generated response
   * @param {Object} tavilyResponse - Tavily search response
   */
  async updateConversationContext(callSid, intent, query, response, tavilyResponse) {
    updateConversationContext(callSid, intent, query, response, tavilyResponse);
  }
} 