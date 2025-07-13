import logger from '../lib/logger.js';
import { OpenAIIntegration } from './openaiIntegration.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize OpenAI Integration for TTS
const openAIIntegration = new OpenAIIntegration();

const provider = process.env.TTS_PROVIDER || 'openai';

/**
 * Log TTS integration operation with consistent format
 * @param {string} operation - Operation being performed
 * @param {Object} data - Data to log
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} requestId - Optional request ID for tracking
 * @param {Object} metadata - Additional metadata for context
 */
function logTTSOperation(operation, data = {}, level = 'info', requestId = null, metadata = {}) {
  const logData = {
    integration: 'TTS',
    operation,
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString(),
    ...data,
    ...metadata
  };
  
  logger[level](`TTS Integration - ${operation}:`, logData);
}

export const TTSIntegration = {
  async generateTTS(text, options = {}, requestId = null, metadata = {}) {
    const operationId = requestId || uuidv4();
    
    logTTSOperation('generateTTS.start', { 
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      provider,
      options 
    }, 'info', operationId, metadata);
    
    if (provider === 'openai') {
      try {
        const audioBuffer = await openAIIntegration.createTTS({
          text,
          voice: options.voice || 'nova',
          model: 'tts-1',
          responseFormat: 'mp3',
          speed: options.speed || 1.0
        }, operationId);

        logTTSOperation('generateTTS.success', {
          textLength: text.length,
          audioSize: audioBuffer.length,
          provider: 'openai',
          voice: options.voice || 'nova',
          speed: options.speed || 1.0
        }, 'info', operationId, metadata);

        return {
          audioBuffer,
          provider: 'openai',
          text,
          voice: options.voice || 'nova'
        };
      } catch (error) {
        logTTSOperation('generateTTS.error', {
          textLength: text.length,
          provider: 'openai',
          error: error.message,
          errorCode: error.code,
          voice: options.voice || 'nova'
        }, 'error', operationId, metadata);
        
        logger.error('OpenAI TTS generation failed:', {
          error: error.message,
          code: error.code,
          requestId: operationId,
          ...metadata
        });
        throw error;
      }
    }
    
    if (provider === 'stub') {
      logTTSOperation('generateTTS.stub', {
        textLength: text.length,
        provider: 'stub'
      }, 'info', operationId, metadata);
      
      // Stub: return a dummy audio URL or buffer
      return {
        audioUrl: '/audio/stub.mp3',
        provider: 'stub',
        text
      };
    }
    
    logTTSOperation('generateTTS.unsupported', {
      provider,
      error: `Unsupported TTS provider: ${provider}`
    }, 'error', operationId, metadata);
    
    throw new Error(`Unsupported TTS provider: ${provider}`);
  },

  /**
   * Get TTS integration configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      integration: 'TTS',
      provider,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Check if the TTS integration is healthy
   * @param {string} requestId - Optional request ID for tracking
   * @param {Object} metadata - Additional metadata for context
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy(requestId = null, metadata = {}) {
    const operationId = requestId || uuidv4();
    
    try {
      logTTSOperation('isHealthy.start', {}, 'info', operationId, metadata);
      
      if (provider === 'openai') {
        const result = await openAIIntegration.testConnection(operationId);
        logTTSOperation('isHealthy.result', { healthy: result }, 'info', operationId, metadata);
        return result;
      }
      
      if (provider === 'stub') {
        logTTSOperation('isHealthy.result', { healthy: true }, 'info', operationId, metadata);
        return true;
      }
      
      logTTSOperation('isHealthy.unsupported', { provider }, 'warn', operationId, metadata);
      return false;
    } catch (error) {
      logTTSOperation('isHealthy.error', { 
        error: error.message,
        provider 
      }, 'error', operationId, metadata);
      
      logger.error('TTS integration health check failed:', {
        error: error.message,
        provider,
        requestId: operationId,
        ...metadata
      });
      return false;
    }
  }
}; 