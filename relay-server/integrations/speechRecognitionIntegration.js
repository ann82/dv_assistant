import logger from '../lib/logger.js';
import { OpenAIIntegration } from './openaiIntegration.js';
import { v4 as uuidv4 } from 'uuid';

const provider = process.env.STT_PROVIDER || 'openai';

export class SpeechRecognitionIntegration {
  constructor(config = {}) {
    this.config = config;
    this.openai = new OpenAIIntegration();
  }

  /**
   * Log Speech Recognition integration operation with consistent format
   * @param {string} operation - Operation being performed
   * @param {Object} data - Data to log
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} requestId - Optional request ID for tracking
   */
  logOperation(operation, data = {}, level = 'info', requestId = null) {
    const logData = {
      integration: 'SpeechRecognition',
      operation,
      requestId: requestId || uuidv4(),
      timestamp: new Date().toISOString(),
      ...data
    };
    
    logger[level](`Speech Recognition Integration - ${operation}:`, logData);
  }

  /**
   * Transcribe audio using the configured provider
   * @param {Object} options - { audioBuffer, model, language, responseFormat, temperature }
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(options, requestId = null) {
    const operationId = requestId || uuidv4();
    
    this.logOperation('transcribeAudio.start', { 
      provider,
      audioSize: options.audioBuffer?.length,
      model: options.model,
      language: options.language,
      responseFormat: options.responseFormat,
      temperature: options.temperature
    }, 'info', operationId);
    
    if (provider === 'openai') {
      try {
        const result = await this.openai.transcribeAudio(options, operationId);
        
        this.logOperation('transcribeAudio.success', {
          provider: 'openai',
          audioSize: options.audioBuffer?.length,
          transcriptionLength: result.length,
          model: options.model,
          language: options.language
        }, 'info', operationId);
        
        return result;
      } catch (error) {
        this.logOperation('transcribeAudio.error', {
          provider: 'openai',
          audioSize: options.audioBuffer?.length,
          error: error.message,
          errorCode: error.code,
          model: options.model
        }, 'error', operationId);
        
        logger.error('OpenAI Whisper transcription failed:', {
          error: error.message,
          code: error.code,
          requestId: operationId
        });
        throw error;
      }
    }
    
    // Add other providers here (e.g., Google, AssemblyAI, Deepgram)
    this.logOperation('transcribeAudio.unsupported', {
      provider,
      error: `Unsupported STT provider: ${provider}`
    }, 'error', operationId);
    
    throw new Error(`Unsupported STT provider: ${provider}`);
  }

  /**
   * Get Speech Recognition integration configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      integration: 'SpeechRecognition',
      provider,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if the Speech Recognition integration is healthy
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy(requestId = null) {
    const operationId = requestId || uuidv4();
    
    try {
      this.logOperation('isHealthy.start', {}, 'info', operationId);
      
      if (provider === 'openai') {
        const result = await this.openai.testConnection(operationId);
        this.logOperation('isHealthy.result', { healthy: result }, 'info', operationId);
        return result;
      }
      
      this.logOperation('isHealthy.unsupported', { provider }, 'warn', operationId);
      return false;
    } catch (error) {
      this.logOperation('isHealthy.error', { 
        error: error.message,
        provider 
      }, 'error', operationId);
      
      logger.error('Speech Recognition integration health check failed:', {
        error: error.message,
        provider,
        requestId: operationId
      });
      return false;
    }
  }
}

export const speechRecognitionIntegration = new SpeechRecognitionIntegration();

export async function transcribeAudio(options, requestId = null) {
  return speechRecognitionIntegration.transcribeAudio(options, requestId);
} 