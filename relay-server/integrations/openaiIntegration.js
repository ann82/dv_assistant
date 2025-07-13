import { OpenAI } from 'openai';
import { apiConfig } from '../lib/config/api.js';
import logger from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * OpenAI Integration Module
 * Provides a unified interface for all OpenAI API calls with error handling, retries, and configuration management
 */
export class OpenAIIntegration {
  constructor(config = {}) {
    this.config = {
      ...apiConfig.openai,
      ...config
    };
    
    // Initialize OpenAI client
    this.client = new OpenAI({ 
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
    
    // Validate configuration
    this.validateConfig();
    
    logger.info('OpenAI Integration initialized', {
      integration: 'OpenAI',
      model: this.config.model,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      maxTokens: this.config.maxTokens,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log OpenAI integration operation with consistent format
   * @param {string} operation - Operation being performed
   * @param {Object} data - Data to log
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} requestId - Optional request ID for tracking
   */
  logOperation(operation, data = {}, level = 'info', requestId = null) {
    const logData = {
      integration: 'OpenAI',
      operation,
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      ...data
    };
    
    logger[level](`OpenAI Integration - ${operation}:`, logData);
  }

  /**
   * Validate OpenAI configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.config.apiKey || this.config.apiKey === 'sk-test-key') {
      throw new Error('OpenAI API key is required');
    }
    
    if (this.config.timeout < 1000) {
      throw new Error('OpenAI timeout must be at least 1000ms');
    }
    
    if (this.config.maxRetries < 0) {
      throw new Error('OpenAI max retries must be non-negative');
    }
  }

  /**
   * Create chat completion with retry logic and error handling
   * @param {Object} options - Chat completion options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Object>} Chat completion response
   */
  async createChatCompletion(options, requestId = null) {
    const operationId = requestId || uuidv4();
    const {
      messages,
      model = this.config.model.gpt35,
      maxTokens = this.config.maxTokens,
      temperature = 0.7,
      systemPrompt = null,
      ...otherOptions
    } = options;

    try {
      this.logOperation('createChatCompletion.start', {
        model,
        messageCount: messages.length,
        maxTokens,
        temperature,
        hasSystemPrompt: !!systemPrompt
      }, 'info', operationId);

      // Add system prompt if provided
      const finalMessages = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const response = await this.client.chat.completions.create({
        model,
        messages: finalMessages,
        max_tokens: maxTokens,
        temperature,
        ...otherOptions
      });

      this.logOperation('createChatCompletion.success', {
        model,
        usage: response.usage,
        responseLength: response.choices[0]?.message?.content?.length || 0,
        finishReason: response.choices[0]?.finish_reason
      }, 'info', operationId);

      return response;
    } catch (error) {
      this.logOperation('createChatCompletion.error', {
        model,
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        messageCount: messages.length
      }, 'error', operationId);

      logger.error('Chat completion failed', {
        model,
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Create TTS audio with retry logic and error handling
   * @param {Object} options - TTS options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<Buffer>} Audio buffer
   */
  async createTTS(options, requestId = null) {
    const operationId = requestId || uuidv4();
    const {
      text,
      voice = 'nova',
      model = 'tts-1',
      responseFormat = 'mp3',
      speed = 1.0
    } = options;

    try {
      this.logOperation('createTTS.start', {
        textLength: text.length,
        voice,
        model,
        responseFormat,
        speed
      }, 'info', operationId);

      const response = await this.client.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: responseFormat,
        speed
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      this.logOperation('createTTS.success', {
        textLength: text.length,
        audioSize: audioBuffer.length,
        voice,
        model,
        responseFormat
      }, 'info', operationId);

      return audioBuffer;
    } catch (error) {
      this.logOperation('createTTS.error', {
        textLength: text.length,
        voice,
        model,
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status
      }, 'error', operationId);

      logger.error('TTS creation failed', {
        textLength: text.length,
        voice,
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Transcribe audio using Whisper with retry logic and error handling
   * @param {Object} options - Transcription options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(options, requestId = null) {
    const operationId = requestId || uuidv4();
    const {
      audioBuffer,
      model = 'whisper-1',
      language = 'en',
      responseFormat = 'text',
      temperature = 0
    } = options;

    try {
      this.logOperation('transcribeAudio.start', {
        audioSize: audioBuffer.length,
        model,
        language,
        responseFormat,
        temperature
      }, 'info', operationId);

      // Create a file-like object from the buffer
      const file = new Blob([audioBuffer], { type: 'audio/wav' });

      const response = await this.client.audio.transcriptions.create({
        file,
        model,
        language,
        response_format: responseFormat,
        temperature
      });

      this.logOperation('transcribeAudio.success', {
        audioSize: audioBuffer.length,
        transcriptionLength: response.length,
        model,
        language
      }, 'info', operationId);

      return response;
    } catch (error) {
      this.logOperation('transcribeAudio.error', {
        audioSize: audioBuffer.length,
        model,
        language,
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status
      }, 'error', operationId);

      logger.error('Audio transcription failed', {
        audioSize: audioBuffer.length,
        model,
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Create embeddings with retry logic and error handling
   * @param {Object} options - Embedding options
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<number[]>} Embedding vector
   */
  async createEmbedding(options, requestId = null) {
    const operationId = requestId || uuidv4();
    const {
      text,
      model = 'text-embedding-3-small',
      encodingFormat = 'float'
    } = options;

    try {
      this.logOperation('createEmbedding.start', {
        textLength: text.length,
        model,
        encodingFormat
      }, 'info', operationId);

      const response = await this.client.embeddings.create({
        model,
        input: text,
        encoding_format: encodingFormat
      });

      const embedding = response.data[0].embedding;

      this.logOperation('createEmbedding.success', {
        textLength: text.length,
        embeddingLength: embedding.length,
        model,
        encodingFormat
      }, 'info', operationId);

      return embedding;
    } catch (error) {
      this.logOperation('createEmbedding.error', {
        textLength: text.length,
        model,
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status
      }, 'error', operationId);

      logger.error('Embedding creation failed', {
        textLength: text.length,
        model,
        error: error.message,
        code: error.code,
        status: error.status,
        requestId: operationId
      });
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Handle OpenAI API errors with proper error messages and logging
   * @param {Error} error - OpenAI API error
   * @returns {Error} Enhanced error with context
   */
  handleOpenAIError(error) {
    let enhancedError = new Error();

    // Handle different types of OpenAI errors
    if (error.code === 'invalid_api_key') {
      enhancedError.message = 'Invalid OpenAI API key';
      enhancedError.code = 'INVALID_API_KEY';
    } else if (error.code === 'insufficient_quota') {
      enhancedError.message = 'OpenAI API quota exceeded';
      enhancedError.code = 'QUOTA_EXCEEDED';
    } else if (error.code === 'rate_limit_exceeded') {
      enhancedError.message = 'OpenAI API rate limit exceeded';
      enhancedError.code = 'RATE_LIMIT';
    } else if (error.code === 'context_length_exceeded') {
      enhancedError.message = 'OpenAI context length exceeded';
      enhancedError.code = 'CONTEXT_LENGTH';
    } else if (error.status === 429) {
      enhancedError.message = 'OpenAI API rate limit exceeded';
      enhancedError.code = 'RATE_LIMIT';
    } else if (error.status === 401) {
      enhancedError.message = 'OpenAI API authentication failed';
      enhancedError.code = 'AUTH_FAILED';
    } else if (error.status === 500) {
      enhancedError.message = 'OpenAI API server error';
      enhancedError.code = 'SERVER_ERROR';
    } else {
      enhancedError.message = `OpenAI API error: ${error.message}`;
      enhancedError.code = 'API_ERROR';
    }

    enhancedError.originalError = error;
    enhancedError.status = error.status;
    
    return enhancedError;
  }

  /**
   * Check if OpenAI API is available and configured
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      integration: 'OpenAI',
      available: !!(this.config.apiKey && this.config.apiKey !== 'sk-test-key'),
      keyPrefix: this.config.apiKey ? this.config.apiKey.substring(0, 7) : 'none',
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      maxTokens: this.config.maxTokens,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test OpenAI API connectivity
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<boolean>} True if API is accessible
   */
  async testConnection(requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      this.logOperation('testConnection.start', {}, 'info', operationId);
      
      // Try a simple embedding request to test connectivity
      await this.createEmbedding({
        text: 'test',
        model: 'text-embedding-3-small'
      }, operationId);
      
      this.logOperation('testConnection.success', {}, 'info', operationId);
      logger.info('OpenAI API connection test successful', { requestId: operationId });
      return true;
    } catch (error) {
      this.logOperation('testConnection.error', {
        error: error.message,
        errorCode: error.code
      }, 'error', operationId);
      
      logger.error('OpenAI API connection test failed', {
        error: error.message,
        code: error.code,
        requestId: operationId
      });
      return false;
    }
  }
}

// Export a default instance
export const openAIIntegration = new OpenAIIntegration();

// Export convenience functions with request ID support
export async function createChatCompletion(options, requestId = null) {
  return openAIIntegration.createChatCompletion(options, requestId);
}

export async function createTTS(options, requestId = null) {
  return openAIIntegration.createTTS(options, requestId);
}

export async function transcribeAudio(options, requestId = null) {
  return openAIIntegration.transcribeAudio(options, requestId);
}

export async function createEmbedding(options, requestId = null) {
  return openAIIntegration.createEmbedding(options, requestId);
} 