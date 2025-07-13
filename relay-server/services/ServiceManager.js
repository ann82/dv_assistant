import { TtsService } from './tts/TtsService.js';
import { SearchService } from './search/SearchService.js';
import { ContextService } from './context/ContextService.js';
import { AudioService } from './audioService.js';
import { config } from '../lib/config/index.js';
import logger from '../lib/logger.js';

/**
 * Service Manager
 * Manages initialization, dependency injection, and lifecycle of all services
 */
export class ServiceManager {
  constructor() {
    this.services = new Map();
    this.initialized = false;
    this.logger = logger;
  }
  
  /**
   * Initialize all services
   */
  async initialize() {
    try {
      this.logger.info('ServiceManager: Initializing all services...');
      
      // Initialize services in dependency order
      await this.initializeContextService();
      await this.initializeSearchService();
      await this.initializeTtsService();
      await this.initializeAudioService();
      
      this.initialized = true;
      this.logger.info('ServiceManager: All services initialized successfully');
      
      // Log service status
      this.logServiceStatus();
      
    } catch (error) {
      this.logger.error('ServiceManager: Failed to initialize services:', error);
      throw error;
    }
  }
  
  /**
   * Initialize Context Service
   */
  async initializeContextService() {
    try {
      const contextService = new ContextService({
        conversationTimeout: config.timeouts.conversation,
        maxHistoryItems: 10
      });
      
      await contextService.initialize();
      this.services.set('context', contextService);
      
      this.logger.info('ServiceManager: Context service initialized');
    } catch (error) {
      this.logger.error('ServiceManager: Failed to initialize context service:', error);
      throw error;
    }
  }
  
  /**
   * Initialize Search Service
   */
  async initializeSearchService() {
    try {
      const searchService = new SearchService({
        apiKey: config.api.tavily.apiKey,
        maxResults: config.api.tavily.maxResults,
        searchDepth: config.api.tavily.searchDepth,
        cacheEnabled: config.api.cache.enabled
      });
      
      await searchService.initialize();
      this.services.set('search', searchService);
      
      this.logger.info('ServiceManager: Search service initialized');
    } catch (error) {
      this.logger.error('ServiceManager: Failed to initialize search service:', error);
      throw error;
    }
  }
  
  /**
   * Initialize TTS Service
   */
  async initializeTtsService() {
    try {
      const ttsService = new TtsService({
        enabled: config.tts.enabled,
        timeout: config.tts.timeout,
        fallbackToPolly: config.tts.fallbackToPolly,
        openai: {
          apiKey: config.api.openai.apiKey,
          voice: config.tts.openai.voice,
          model: config.tts.openai.model
        },
        cache: {
          enabled: config.tts.cache.enabled,
          directory: config.tts.cache.directory,
          ttl: config.tts.cache.ttl
        }
      });
      
      await ttsService.initialize();
      this.services.set('tts', ttsService);
      
      this.logger.info('ServiceManager: TTS service initialized');
    } catch (error) {
      this.logger.error('ServiceManager: Failed to initialize TTS service:', error);
      throw error;
    }
  }

  /**
   * Initialize Audio Service
   */
  async initializeAudioService() {
    try {
      const audioService = new AudioService();
      await audioService.ensureDirectories();
      this.services.set('audio', audioService);
      
      this.logger.info('ServiceManager: Audio service initialized');
    } catch (error) {
      this.logger.error('ServiceManager: Failed to initialize audio service:', error);
      throw error;
    }
  }
  
  /**
   * Get a service by name
   * @param {string} serviceName - Name of the service to get
   * @returns {Object} Service instance
   * @throws {Error} If service is not found or not initialized
   */
  getService(serviceName) {
    if (!this.initialized) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }
    
    return service;
  }
  
  /**
   * Get all services
   * @returns {Map} Map of all services
   */
  getAllServices() {
    if (!this.initialized) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    
    return new Map(this.services);
  }
  
  /**
   * Check if all services are healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      if (!this.initialized) {
        return false;
      }
      
      const healthChecks = await Promise.allSettled(
        Array.from(this.services.values()).map(service => service.isHealthy())
      );
      
      const allHealthy = healthChecks.every(result => 
        result.status === 'fulfilled' && result.value === true
      );
      
      return allHealthy;
    } catch (error) {
      this.logger.error('ServiceManager: Health check failed:', error);
      return false;
    }
  }
  
  /**
   * Get health status of all services
   * @returns {Promise<Object>} Health status of each service
   */
  async getHealthStatus() {
    const healthStatus = {};
    
    for (const [name, service] of this.services.entries()) {
      try {
        healthStatus[name] = {
          healthy: await service.isHealthy(),
          status: service.getStatus ? service.getStatus() : 'unknown'
        };
      } catch (error) {
        healthStatus[name] = {
          healthy: false,
          error: error.message
        };
      }
    }
    
    return healthStatus;
  }
  
  /**
   * Log service status
   */
  logServiceStatus() {
    this.logger.info('ServiceManager: Service status:', {
      totalServices: this.services.size,
      services: Array.from(this.services.keys()),
      initialized: this.initialized
    });
  }
  
  /**
   * Cleanup all services
   */
  async cleanup() {
    try {
      this.logger.info('ServiceManager: Cleaning up all services...');
      
      const cleanupPromises = Array.from(this.services.values()).map(service => 
        service.cleanup ? service.cleanup() : Promise.resolve()
      );
      
      await Promise.allSettled(cleanupPromises);
      
      this.services.clear();
      this.initialized = false;
      
      this.logger.info('ServiceManager: All services cleaned up');
    } catch (error) {
      this.logger.error('ServiceManager: Failed to cleanup services:', error);
    }
  }
  
  /**
   * Restart a specific service
   * @param {string} serviceName - Name of the service to restart
   */
  async restartService(serviceName) {
    try {
      this.logger.info(`ServiceManager: Restarting service '${serviceName}'...`);
      
      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service '${serviceName}' not found`);
      }
      
      // Cleanup service
      if (service.cleanup) {
        await service.cleanup();
      }
      
      // Reinitialize service
      switch (serviceName) {
        case 'context':
          await this.initializeContextService();
          break;
        case 'search':
          await this.initializeSearchService();
          break;
        case 'tts':
          await this.initializeTtsService();
          break;
        default:
          throw new Error(`Unknown service '${serviceName}'`);
      }
      
      this.logger.info(`ServiceManager: Service '${serviceName}' restarted successfully`);
    } catch (error) {
      this.logger.error(`ServiceManager: Failed to restart service '${serviceName}':`, error);
      throw error;
    }
  }
  
  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getServiceStats() {
    const stats = {
      totalServices: this.services.size,
      initialized: this.initialized,
      services: {}
    };
    
    for (const [name, service] of this.services.entries()) {
      stats.services[name] = {
        type: service.constructor.name,
        hasStatus: !!service.getStatus,
        hasStats: !!service.getCacheStats
      };
      
      if (service.getStatus) {
        stats.services[name].status = service.getStatus();
      }
      
      if (service.getCacheStats) {
        stats.services[name].cacheStats = service.getCacheStats();
      }
    }
    
    return stats;
  }
  
  /**
   * Validate service dependencies
   * @returns {Object} Validation results
   */
  validateDependencies() {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Check if all required services are available
    const requiredServices = ['context', 'search', 'tts'];
    
    for (const serviceName of requiredServices) {
      if (!this.services.has(serviceName)) {
        validation.valid = false;
        validation.errors.push(`Required service '${serviceName}' is missing`);
      }
    }
    
    // Check service-specific dependencies
    const searchService = this.services.get('search');
    if (searchService && !searchService.config.apiKey) {
      validation.warnings.push('Search service: Tavily API key not configured');
    }
    
    const ttsService = this.services.get('tts');
    if (ttsService && !ttsService.config.openai?.apiKey) {
      validation.warnings.push('TTS service: OpenAI API key not configured');
    }
    
    return validation;
  }
} 