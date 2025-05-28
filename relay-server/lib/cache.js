import { config } from './config.js';

class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.commonResponses = new Map([
      ['hello', 'Hello! How can I help you today?'],
      ['hi', 'Hi there! How can I assist you?'],
      ['help', 'I can help you find shelters, provide resources, or answer questions about domestic violence support. What do you need?'],
      ['bye', 'Take care! Remember, help is always available.'],
      ['thanks', 'You\'re welcome! Is there anything else you need?']
    ]);
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
    this.cache.set(normalizedInput, {
      response,
      timestamp: Date.now()
    });
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= config.CACHE_EXPIRY) {
        this.cache.delete(key);
      }
    }
  }
}

export const responseCache = new ResponseCache();

// Clear expired entries periodically
setInterval(() => {
  responseCache.clearExpired();
}, config.CACHE_EXPIRY); 