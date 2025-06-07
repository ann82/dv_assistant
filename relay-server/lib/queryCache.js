import logger from './logger.js';

/**
 * A lightweight in-memory cache with TTL support
 */
export class QueryCache {
    /**
     * @param {Object} options Cache configuration options
     * @param {number} [options.cleanupIntervalMs=300000] How often to clean expired entries (default: 5 minutes)
     * @param {number} [options.maxSize] Maximum number of entries (optional)
     * @param {string} [options.namespace] Optional namespace for all keys
     */
    constructor({ cleanupIntervalMs = 300000, maxSize, namespace } = {}) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.namespace = namespace;
        this.cleanupInterval = setInterval(() => this.clearExpired(), cleanupIntervalMs);
        
        // Store last accessed times for LRU eviction
        this.lastAccessed = new Map();
        
        logger.info('QueryCache initialized', {
            cleanupIntervalMs,
            maxSize,
            namespace
        });
    }

    /**
     * Get the full cache key including namespace if set
     * @private
     */
    #getFullKey(key) {
        return this.namespace ? `${this.namespace}:${key}` : key;
    }

    /**
     * Get a value from the cache
     * @param {string} key Cache key
     * @returns {any|null} Cached value or null if not found/expired
     */
    get(key) {
        const fullKey = this.#getFullKey(key);
        const entry = this.cache.get(fullKey);
        
        if (!entry) {
            return null;
        }

        if (entry.expiresAt < Date.now()) {
            this.cache.delete(fullKey);
            this.lastAccessed.delete(fullKey);
            return null;
        }

        // Update last accessed time for LRU
        this.lastAccessed.set(fullKey, Date.now());
        return entry.value;
    }

    /**
     * Set a value in the cache
     * @param {string} key Cache key
     * @param {any} value Value to cache
     * @param {number} ttlMs Time to live in milliseconds
     */
    set(key, value, ttlMs) {
        const fullKey = this.#getFullKey(key);
        
        // Check if we need to evict entries
        if (this.maxSize && this.cache.size >= this.maxSize) {
            this.#evictLRU();
        }

        this.cache.set(fullKey, {
            value,
            expiresAt: Date.now() + ttlMs
        });
        this.lastAccessed.set(fullKey, Date.now());
    }

    /**
     * Check if a key exists and is not expired
     * @param {string} key Cache key
     * @returns {boolean} True if key exists and is not expired
     */
    has(key) {
        const fullKey = this.#getFullKey(key);
        const entry = this.cache.get(fullKey);
        
        if (!entry) {
            return false;
        }

        if (entry.expiresAt < Date.now()) {
            this.cache.delete(fullKey);
            this.lastAccessed.delete(fullKey);
            return false;
        }

        return true;
    }

    /**
     * Remove all expired entries from the cache
     */
    clearExpired() {
        const now = Date.now();
        let expiredCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt < now) {
                this.cache.delete(key);
                this.lastAccessed.delete(key);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            logger.debug('Cleared expired cache entries', { expiredCount });
        }
    }

    /**
     * Evict the least recently used entry
     * @private
     */
    #evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, time] of this.lastAccessed.entries()) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.lastAccessed.delete(oldestKey);
            logger.debug('Evicted LRU cache entry', { key: oldestKey });
        }
    }

    /**
     * Clear all entries from the cache
     */
    clear() {
        this.cache.clear();
        this.lastAccessed.clear();
        logger.debug('Cache cleared');
    }

    /**
     * Get current cache size
     * @returns {number} Number of entries in cache
     */
    size() {
        return this.cache.size;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics including total entries, valid entries, and expired entries
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const entry of this.cache.values()) {
            if (entry.expiresAt < now) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        }

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.clear();
    }
}

// Create singleton instances for different use cases
export const tavilyCache = new QueryCache({
    namespace: 'tavily',
    maxSize: 1000, // Store up to 1000 Tavily results
    cleanupIntervalMs: 300000 // Clean every 5 minutes
});

export const gptCache = new QueryCache({
    namespace: 'gpt',
    maxSize: 500, // Store up to 500 GPT responses
    cleanupIntervalMs: 300000
});

export const embeddingCache = new QueryCache({
    namespace: 'embedding',
    maxSize: 2000, // Store up to 2000 embeddings
    cleanupIntervalMs: 600000 // Clean every 10 minutes
}); 