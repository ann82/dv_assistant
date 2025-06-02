import { config } from './config.js';

class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Maximum number of entries
    this.cleanupInterval = 5 * 60 * 1000; // Clean every 5 minutes
    this.commonResponses = new Map([
      ['hello', 'Hello! How can I help you today?'],
      ['hi', 'Hi there! How can I assist you?'],
      ['help', 'I can help you find shelters, provide resources, or answer questions about domestic violence support. What do you need?'],
      ['bye', 'Take care! Remember, help is always available.'],
      ['thanks', 'You\'re welcome! Is there anything else you need?']
    ]);

    // Start periodic cleanup
    this.startCleanup();
  }

  getCachedResponse(input) {
    // Normalize input
    const normalizedInput = input.toLowerCase().trim();
    
    // Check common responses first
    if (this.commonResponses.has(normalizedInput)) {
      return {
        text: this.commonResponses.get(normalizedInput),
        source: 'common_responses'
      };
    }
    
    // Check cache
    const cached = this.cache.get(normalizedInput);
    if (cached && Date.now() - cached.timestamp < config.CACHE_EXPIRY) {
      return {
        text: cached.response,
        source: 'cache'
      };
    }
    
    return null;
  }

  setCachedResponse(input, response) {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check if we need to make space
    if (this.cache.size >= this.maxSize) {
      this.removeOldestEntries(Math.floor(this.maxSize * 0.2)); // Remove 20% of entries
    }
    
    this.cache.set(normalizedInput, {
      response,
      timestamp: Date.now()
    });
  }

  clearExpired() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= config.CACHE_EXPIRY) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      console.log(`🧹 [DEBUG] Cleared ${expiredCount} expired cache entries`);
    }
  }

  removeOldestEntries(count) {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, count);
    
    for (const [key] of entries) {
      this.cache.delete(key);
    }
    
    console.log(`🗑️ [DEBUG] Removed ${count} oldest cache entries`);
  }

  startCleanup() {
    setInterval(() => {
      this.clearExpired();
      this.logCacheStats();
    }, this.cleanupInterval);
  }

  logCacheStats() {
    const stats = {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
    console.log('📊 [DEBUG] Cache stats:', stats);
  }
}

export const responseCache = new ResponseCache(); 