import { BaseService } from '../base/BaseService.js';
import { ttsConfig, getTtsConfigForLanguage } from '../../lib/config/tts.js';
import { withTimeout, retryWithBackoff, isRetryableError } from '../../lib/utils/errorHandling.js';
import { isNotEmpty } from '../../lib/utils/validation.js';
import { TTSIntegration } from '../../integrations/ttsIntegration.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * TTS Service
 * Handles all text-to-speech functionality using TTSIntegration
 */
export class TtsService extends BaseService {
  constructor(config = {}) {
    super(config, 'TtsService');
    this.config = { ...ttsConfig, ...config };
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      total: 0
    };
  }
  
  /**
   * Initialize TTS service
   */
  async initialize() {
    try {
      this.logOperation('initializing');
      
      // Initialize cache directory
      if (this.config.cache.enabled) {
        await this.initializeCache();
      }
      
      this.logOperation('initialized');
    } catch (error) {
      await this.handleError(error, 'initialize');
      throw error;
    }
  }
  
  /**
   * Initialize cache directory
   */
  async initializeCache() {
    try {
      await fs.mkdir(this.config.cache.directory, { recursive: true });
      this.logOperation('cache initialized', { directory: this.config.cache.directory });
    } catch (error) {
      this.logger.warn('Failed to initialize cache directory:', error.message);
    }
  }
  
  /**
   * Generate speech from text
   * @param {string} text - Text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<Object>} TTS result with audio data
   */
  async generateSpeech(text, options = {}) {
    return this.processRequest(
      { text, options },
      'generate speech',
      async ({ text, options }) => {
        // Validate input
        if (!isNotEmpty(text)) {
          throw new Error('Text is required for TTS generation');
        }
        
        const ttsOptions = {
          voice: options.voice || this.config.openai.voice,
          language: options.language || 'en-US',
          ...options
        };
        
        // Check cache first
        const cacheKey = this.generateCacheKey(text, ttsOptions);
        const cachedResult = await this.getFromCache(cacheKey);
        
        if (cachedResult) {
          this.logOperation('cache hit', { cacheKey: cacheKey.substring(0, 8) });
          return cachedResult;
        }
        
        this.logOperation('cache miss', { cacheKey: cacheKey.substring(0, 8) });
        
        // Generate speech using TTSIntegration
        const result = await TTSIntegration.generateTTS(text, ttsOptions);
        
        // Cache result
        if (this.config.cache.enabled) {
          await this.addToCache(cacheKey, result);
        }
        
        return result;
      }
    );
  }
  
  /**
   * Generate cache key for TTS request
   * @param {string} text - Text content
   * @param {Object} options - TTS options
   * @returns {string} Cache key
   */
  generateCacheKey(text, options) {
    const data = {
      text: text.toLowerCase().trim(),
      voice: options.voice,
      language: options.language
    };
    
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
  
  /**
   * Get TTS result from cache
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached result or null
   */
  async getFromCache(cacheKey) {
    if (!this.config.cache.enabled) {
      return null;
    }
    
    try {
      const cacheFile = path.join(this.config.cache.directory, `${cacheKey}.json`);
      const cacheData = await fs.readFile(cacheFile, 'utf8');
      const cached = JSON.parse(cacheData);
      
      // Check if cache is still valid
      const age = Date.now() - new Date(cached.timestamp).getTime();
      if (age > this.config.cache.ttl) {
        await this.removeFromCache(cacheKey);
        return null;
      }
      
      // Load audio file
      const audioFile = path.join(this.config.cache.directory, `${cacheKey}.mp3`);
      const audio = await fs.readFile(audioFile);
      
      this.cacheStats.hits++;
      this.cacheStats.total++;
      
      return {
        ...cached,
        audio: audio
      };
    } catch (error) {
      // Cache miss or error
      this.cacheStats.misses++;
      this.cacheStats.total++;
      return null;
    }
  }
  
  /**
   * Add TTS result to cache
   * @param {string} cacheKey - Cache key
   * @param {Object} result - TTS result
   */
  async addToCache(cacheKey, result) {
    if (!this.config.cache.enabled) {
      return;
    }
    
    try {
      // Save metadata
      const metadata = {
        ...result,
        audio: undefined, // Don't save audio in metadata
        timestamp: new Date().toISOString()
      };
      
      const cacheFile = path.join(this.config.cache.directory, `${cacheKey}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(metadata, null, 2));
      
      // Save audio file
      const audioFile = path.join(this.config.cache.directory, `${cacheKey}.mp3`);
      await fs.writeFile(audioFile, result.audio);
      
      this.logOperation('cached', { cacheKey: cacheKey.substring(0, 8) });
    } catch (error) {
      this.logger.warn('Failed to cache TTS result:', error.message);
    }
  }
  
  /**
   * Remove item from cache
   * @param {string} cacheKey - Cache key
   */
  async removeFromCache(cacheKey) {
    try {
      const cacheFile = path.join(this.config.cache.directory, `${cacheKey}.json`);
      const audioFile = path.join(this.config.cache.directory, `${cacheKey}.mp3`);
      
      await Promise.all([
        fs.unlink(cacheFile).catch(() => {}),
        fs.unlink(audioFile).catch(() => {})
      ]);
    } catch (error) {
      // Ignore errors when removing cache files
    }
  }
  
  /**
   * Estimate audio duration based on text length
   * @param {string} text - Text content
   * @returns {number} Estimated duration in seconds
   */
  estimateDuration(text) {
    // Rough estimate: 150 words per minute
    const words = text.split(/\s+/).length;
    return Math.max(0.5, words / 2.5); // Minimum 0.5 seconds
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const hitRate = this.cacheStats.total > 0 
      ? (this.cacheStats.hits / this.cacheStats.total * 100).toFixed(2)
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`
    };
  }
  
  /**
   * Clear cache
   */
  async clearCache() {
    if (!this.config.cache.enabled) {
      return;
    }
    
    try {
      const files = await fs.readdir(this.config.cache.directory);
      const cacheFiles = files.filter(file => file.endsWith('.json') || file.endsWith('.mp3'));
      
      await Promise.all(
        cacheFiles.map(file => 
          fs.unlink(path.join(this.config.cache.directory, file)).catch(() => {})
        )
      );
      
      this.cacheStats = { hits: 0, misses: 0, total: 0 };
      this.logOperation('cache cleared');
    } catch (error) {
      this.logger.warn('Failed to clear cache:', error.message);
    }
  }
  
  /**
   * Check if TTS service is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      if (!this.config.enabled) {
        return true; // Service is disabled, consider it healthy
      }
      
      // Test TTSIntegration health
      if (TTSIntegration.isHealthy()) {
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('TTS service health check failed:', error.message);
      return false;
    }
  }
  
  /**
   * Get TTS service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      openai: {
        available: !!this.config.openai, // This will be removed as TTSIntegration is used
        voice: this.config.openai.voice,
        model: this.config.openai.model
      },
      polly: {
        available: false, // This will be removed as TTSIntegration is used
        voice: 'unknown'
      },
      cache: {
        enabled: this.config.cache.enabled,
        stats: this.getCacheStats()
      }
    };
  }
} 