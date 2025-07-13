import { BaseService } from '../base/BaseService.js';
import { config } from '../../lib/config/index.js';
import { isNotEmpty } from '../../lib/utils/validation.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Context Service
 * Handles conversation context management, storage, and retrieval
 */
export class ContextService extends BaseService {
  constructor(config = {}) {
    super(config, 'ContextService');
    this.config = { 
      conversationTimeout: config.timeouts?.conversation || 15 * 60 * 1000, // 15 minutes
      maxContextLength: 2000,
      maxHistoryItems: 10,
      ...config 
    };
    this.contexts = new Map();
    this.storageDir = './cache/contexts';
  }
  
  /**
   * Initialize context service
   */
  async initialize() {
    try {
      this.logOperation('initializing');
      
      // Create storage directory
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Load persisted contexts
      await this.loadPersistedContexts();
      
      this.logOperation('initialized');
    } catch (error) {
      await this.handleError(error, 'initialize');
      throw error;
    }
  }
  
  /**
   * Load persisted contexts from disk
   */
  async loadPersistedContexts() {
    try {
      const files = await fs.readdir(this.storageDir);
      const contextFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of contextFiles) {
        try {
          const filePath = path.join(this.storageDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const context = JSON.parse(data);
          
          // Check if context is still valid
          if (this.isContextValid(context)) {
            const callSid = file.replace('.json', '');
            this.contexts.set(callSid, context);
          } else {
            // Remove expired context file
            await fs.unlink(filePath).catch(() => {});
          }
        } catch (error) {
          this.logger.warn(`Failed to load context file ${file}:`, error.message);
        }
      }
      
      this.logOperation('contexts loaded', { count: this.contexts.size });
    } catch (error) {
      this.logger.warn('Failed to load persisted contexts:', error.message);
    }
  }
  
  /**
   * Get conversation context for a call
   * @param {string} callSid - Call SID
   * @returns {Object|null} Conversation context or null if not found/expired
   */
  async getConversationContext(callSid) {
    try {
      const context = this.contexts.get(callSid);
      
      if (!context) {
        return null;
      }
      
      // Check if context is still valid
      if (!this.isContextValid(context)) {
        await this.clearConversationContext(callSid);
        return null;
      }
      
      this.logOperation('context retrieved', { callSid, contextLength: context.history?.length || 0 });
      return context;
    } catch (error) {
      await this.handleError(error, 'getConversationContext', { callSid });
      return null;
    }
  }
  
  /**
   * Update conversation context
   * @param {string} callSid - Call SID
   * @param {Object} update - Context update data
   * @returns {Object} Updated context
   */
  async updateConversationContext(callSid, update) {
    return this.processRequest(
      { callSid, update },
      'update context',
      async ({ callSid, update }) => {
        // Validate input
        if (!isNotEmpty(callSid)) {
          throw new Error('Call SID is required');
        }
        
        let context = this.contexts.get(callSid) || this.createNewContext(callSid);
        
        // Update context with new data
        context = this.mergeContextUpdate(context, update);
        
        // Validate and clean context
        context = this.validateAndCleanContext(context);
        
        // Store updated context
        this.contexts.set(callSid, context);
        await this.persistContext(callSid, context);
        
        this.logOperation('context updated', { 
          callSid, 
          contextLength: context.history?.length || 0,
          hasLocation: !!context.location,
          hasFamilyConcerns: !!context.familyConcerns
        });
        
        return context;
      }
    );
  }
  
  /**
   * Create new conversation context
   * @param {string} callSid - Call SID
   * @returns {Object} New context
   */
  createNewContext(callSid) {
    return {
      callSid,
      timestamp: Date.now(),
      history: [],
      location: null,
      familyConcerns: null,
      emotionalTone: null,
      language: 'en-US',
      intent: null,
      lastQuery: null,
      lastResults: null,
      safetyLevel: 'unknown',
      emergencyDetected: false
    };
  }
  
  /**
   * Merge context update with existing context
   * @param {Object} context - Existing context
   * @param {Object} update - Update data
   * @returns {Object} Merged context
   */
  mergeContextUpdate(context, update) {
    const updated = { ...context };
    
    // Update timestamp
    updated.timestamp = Date.now();
    
    // Update history if new interaction provided
    if (update.interaction) {
      updated.history = this.addToHistory(context.history, update.interaction);
    }
    
    // Update location if provided
    if (update.location) {
      updated.location = update.location;
    }
    
    // Update family concerns if provided
    if (update.familyConcerns) {
      updated.familyConcerns = update.familyConcerns;
    }
    
    // Update emotional tone if provided
    if (update.emotionalTone) {
      updated.emotionalTone = update.emotionalTone;
    }
    
    // Update language if provided
    if (update.language) {
      updated.language = update.language;
    }
    
    // Update intent if provided
    if (update.intent) {
      updated.intent = update.intent;
    }
    
    // Update last query if provided
    if (update.lastQuery) {
      updated.lastQuery = update.lastQuery;
    }
    
    // Update last results if provided
    if (update.lastResults) {
      updated.lastResults = update.lastResults;
    }
    
    // Update safety level if provided
    if (update.safetyLevel) {
      updated.safetyLevel = update.safetyLevel;
    }
    
    // Update emergency detection if provided
    if (update.emergencyDetected !== undefined) {
      updated.emergencyDetected = update.emergencyDetected;
    }
    
    return updated;
  }
  
  /**
   * Add interaction to history
   * @param {Array} history - Current history
   * @param {Object} interaction - New interaction
   * @returns {Array} Updated history
   */
  addToHistory(history = [], interaction) {
    const newHistory = [...history, {
      ...interaction,
      timestamp: Date.now()
    }];
    
    // Keep only the most recent items
    return newHistory.slice(-this.config.maxHistoryItems);
  }
  
  /**
   * Validate and clean context
   * @param {Object} context - Context to validate
   * @returns {Object} Cleaned context
   */
  validateAndCleanContext(context) {
    const cleaned = { ...context };
    
    // Ensure required fields exist
    if (!cleaned.callSid) {
      throw new Error('Context must have a call SID');
    }
    
    // Clean history
    if (cleaned.history && Array.isArray(cleaned.history)) {
      cleaned.history = cleaned.history.filter(item => 
        item && typeof item === 'object' && item.timestamp
      );
    } else {
      cleaned.history = [];
    }
    
    // Ensure timestamp exists
    if (!cleaned.timestamp) {
      cleaned.timestamp = Date.now();
    }
    
    return cleaned;
  }
  
  /**
   * Check if context is still valid (not expired)
   * @param {Object} context - Context to check
   * @returns {boolean} Whether context is valid
   */
  isContextValid(context) {
    if (!context || !context.timestamp) {
      return false;
    }
    
    const age = Date.now() - context.timestamp;
    return age < this.config.conversationTimeout;
  }
  
  /**
   * Clear conversation context
   * @param {string} callSid - Call SID
   */
  async clearConversationContext(callSid) {
    try {
      this.contexts.delete(callSid);
      await this.removePersistedContext(callSid);
      this.logOperation('context cleared', { callSid });
    } catch (error) {
      await this.handleError(error, 'clearConversationContext', { callSid });
    }
  }
  
  /**
   * Build context summary for AI instructions
   * @param {string} callSid - Call SID
   * @returns {Object} Context summary
   */
  async buildContextSummary(callSid) {
    try {
      const context = await this.getConversationContext(callSid);
      
      if (!context) {
        return {
          hasContext: false,
          contextParts: 0,
          contextLength: 0
        };
      }
      
      const recentInteractions = this.getRecentInteractions(context.history, 3);
      
      const summary = {
        hasContext: true,
        contextParts: 0,
        contextLength: 0,
        location: context.location,
        familyConcerns: context.familyConcerns,
        emotionalTone: context.emotionalTone,
        language: context.language,
        safetyLevel: context.safetyLevel,
        emergencyDetected: context.emergencyDetected,
        recentInteractions: recentInteractions
      };
      
      // Count context parts
      if (context.location) summary.contextParts++;
      if (context.familyConcerns) summary.contextParts++;
      if (context.emotionalTone) summary.contextParts++;
      if (recentInteractions && recentInteractions.length > 0) summary.contextParts++;
      
      // Calculate context length
      summary.contextLength = JSON.stringify(summary).length;
      
      return summary;
    } catch (error) {
      await this.handleError(error, 'buildContextSummary', { callSid });
      return {
        hasContext: false,
        contextParts: 0,
        contextLength: 0
      };
    }
  }
  
  /**
   * Get recent interactions from history
   * @param {Array} history - Conversation history
   * @param {number} count - Number of recent interactions to get
   * @returns {Array} Recent interactions
   */
  getRecentInteractions(history = [], count = 3) {
    if (!Array.isArray(history)) {
      return [];
    }
    
    return history
      .slice(-count)
      .map(interaction => ({
        query: interaction.query,
        intent: interaction.intent,
        response: interaction.response,
        timestamp: interaction.timestamp
      }));
  }
  
  /**
   * Build AI instructions with context
   * @param {string} callSid - Call SID
   * @param {string} baseInstructions - Base AI instructions
   * @returns {string} Enhanced instructions with context
   */
  async buildInstructionsWithContext(callSid, baseInstructions) {
    try {
      const contextSummary = await this.buildContextSummary(callSid);
      
      if (!contextSummary.hasContext) {
        return baseInstructions;
      }
      
      let contextInstructions = baseInstructions;
      
      // Add location context
      if (contextSummary.location) {
        contextInstructions += `\n\nLOCATION CONTEXT: The caller is located in ${contextSummary.location}.`;
      }
      
      // Add family concerns
      if (contextSummary.familyConcerns) {
        contextInstructions += `\n\nFAMILY CONTEXT: ${contextSummary.familyConcerns}`;
      }
      
      // Add emotional tone
      if (contextSummary.emotionalTone) {
        contextInstructions += `\n\nEMOTIONAL CONTEXT: The caller appears to be ${contextSummary.emotionalTone}.`;
      }
      
      // Add recent interactions
      if (contextSummary.recentInteractions && contextSummary.recentInteractions.length > 0) {
        contextInstructions += '\n\nRECENT CONVERSATION HISTORY:';
        contextSummary.recentInteractions.forEach((interaction, index) => {
          contextInstructions += `\n${index + 1}. Caller: "${interaction.query}" (Intent: ${interaction.intent})`;
          if (interaction.response) {
            contextInstructions += `\n   Assistant: "${interaction.response.substring(0, 100)}..."`;
          }
        });
      }
      
      // Add safety context
      if (contextSummary.safetyLevel !== 'unknown') {
        contextInstructions += `\n\nSAFETY CONTEXT: Current safety level is ${contextSummary.safetyLevel}.`;
      }
      
      if (contextSummary.emergencyDetected) {
        contextInstructions += '\n\nEMERGENCY CONTEXT: Emergency situation detected - prioritize immediate safety.';
      }
      
      this.logOperation('instructions built', {
        callSid,
        contextLength: contextSummary.contextLength,
        instructionsLength: contextInstructions.length,
        contextParts: contextSummary.contextParts
      });
      
      return contextInstructions;
    } catch (error) {
      await this.handleError(error, 'buildInstructionsWithContext', { callSid });
      return baseInstructions;
    }
  }
  
  /**
   * Persist context to disk
   * @param {string} callSid - Call SID
   * @param {Object} context - Context to persist
   */
  async persistContext(callSid, context) {
    try {
      const filePath = path.join(this.storageDir, `${callSid}.json`);
      await fs.writeFile(filePath, JSON.stringify(context, null, 2));
    } catch (error) {
      this.logger.warn('Failed to persist context:', error.message);
    }
  }
  
  /**
   * Remove persisted context from disk
   * @param {string} callSid - Call SID
   */
  async removePersistedContext(callSid) {
    try {
      const filePath = path.join(this.storageDir, `${callSid}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore errors when removing context files
    }
  }
  
  /**
   * Clean up expired contexts
   */
  async cleanupExpiredContexts() {
    try {
      const expiredCallSids = [];
      
      for (const [callSid, context] of this.contexts.entries()) {
        if (!this.isContextValid(context)) {
          expiredCallSids.push(callSid);
        }
      }
      
      for (const callSid of expiredCallSids) {
        await this.clearConversationContext(callSid);
      }
      
      if (expiredCallSids.length > 0) {
        this.logOperation('expired contexts cleaned', { count: expiredCallSids.length });
      }
    } catch (error) {
      await this.handleError(error, 'cleanupExpiredContexts');
    }
  }
  
  /**
   * Get context statistics
   * @returns {Object} Context statistics
   */
  getContextStats() {
    const contexts = Array.from(this.contexts.values());
    
    return {
      totalContexts: contexts.length,
      activeContexts: contexts.filter(context => this.isContextValid(context)).length,
      expiredContexts: contexts.filter(context => !this.isContextValid(context)).length,
      averageHistoryLength: contexts.length > 0 
        ? (contexts.reduce((sum, context) => sum + (context.history?.length || 0), 0) / contexts.length).toFixed(1)
        : 0
    };
  }
  
  /**
   * Check if context service is healthy
   * @returns {Promise<boolean>} Health status
   */
  async isHealthy() {
    try {
      // Check if storage directory is accessible
      await fs.access(this.storageDir);
      
      // Check if we can read/write
      const testFile = path.join(this.storageDir, 'health-check.json');
      await fs.writeFile(testFile, JSON.stringify({ test: true }));
      await fs.unlink(testFile);
      
      return true;
    } catch (error) {
      this.logger.error('Context service health check failed:', error.message);
      return false;
    }
  }
  
  /**
   * Get context service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      storageDirectory: this.storageDir,
      conversationTimeout: this.config.conversationTimeout,
      maxHistoryItems: this.config.maxHistoryItems,
      stats: this.getContextStats()
    };
  }
} 