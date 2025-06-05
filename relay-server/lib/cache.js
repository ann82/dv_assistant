import { config } from './config.js';
import logger from './logger.js';

class Cache {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = config.CACHE_EXPIRY || (1000 * 60 * 60); // 1 hour default
    this.CLEANUP_INTERVAL = 1000 * 60 * 15; // 15 minutes
    this.lastCleanup = Date.now();
    
    // Start background cleanup
    this.startCleanup();
  }

  get(key) {
    const value = this.cache.get(key);
    if (!value) return null;

    // Check if entry is expired
    if (Date.now() - value.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return value.data;
  }

  set(key, value) {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) {
      return;
    }

    logger.info('Starting cache cleanup', {
      timestamp: new Date().toISOString(),
      cacheSize: this.cache.size
    });

    let expiredCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    this.lastCleanup = now;

    logger.info('Cache cleanup completed', {
      timestamp: new Date().toISOString(),
      expiredCount,
      remainingSize: this.cache.size
    });
  }

  startCleanup() {
    // Run cleanup every 15 minutes
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);

    // Ensure cleanup runs on process exit
    process.on('SIGTERM', () => {
      this.cleanup();
    });
  }

  getStats() {
    const now = Date.now();
    const stats = {
      totalEntries: this.cache.size,
      expiredEntries: 0,
      validEntries: 0,
      oldestEntry: null,
      newestEntry: null
    };

    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      if (age > this.CACHE_TTL) {
        stats.expiredEntries++;
      } else {
        stats.validEntries++;
        if (!stats.oldestEntry || value.timestamp < stats.oldestEntry.timestamp) {
          stats.oldestEntry = { key, timestamp: value.timestamp };
        }
        if (!stats.newestEntry || value.timestamp > stats.newestEntry.timestamp) {
          stats.newestEntry = { key, timestamp: value.timestamp };
        }
      }
    }

    return stats;
  }

  clear() {
    this.cache.clear();
  }
}

export const cache = new Cache(); 