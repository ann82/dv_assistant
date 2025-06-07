import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryCache } from '../lib/queryCache.js';

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}));

describe('QueryCache', () => {
    let cache;

    beforeEach(() => {
        // Mock Date.now() to control time
        vi.useFakeTimers();
        cache = new QueryCache();
    });

    afterEach(() => {
        cache.destroy();
        vi.useRealTimers();
    });

    it('should set and get values', () => {
        cache.set('test', 'value', 1000);
        expect(cache.get('test')).toBe('value');
    });

    it('should return null for non-existent keys', () => {
        expect(cache.get('nonexistent')).toBeNull();
    });

    it('should expire values after TTL', () => {
        cache.set('test', 'value', 1000);
        expect(cache.get('test')).toBe('value');
        
        // Advance time by 1.1 seconds
        vi.advanceTimersByTime(1100);
        expect(cache.get('test')).toBeNull();
    });

    it('should check if key exists and is not expired', () => {
        cache.set('test', 'value', 1000);
        expect(cache.has('test')).toBe(true);
        
        vi.advanceTimersByTime(1100);
        expect(cache.has('test')).toBe(false);
    });

    it('should clear expired entries', () => {
        cache.set('test1', 'value1', 1000);
        cache.set('test2', 'value2', 2000);
        
        vi.advanceTimersByTime(1500);
        cache.clearExpired();
        
        expect(cache.has('test1')).toBe(false);
        expect(cache.has('test2')).toBe(true);
    });

    it('should respect maxSize and evict LRU entries', () => {
        const limitedCache = new QueryCache({ maxSize: 2 });
        
        limitedCache.set('key1', 'value1', 1000);
        limitedCache.set('key2', 'value2', 1000);
        limitedCache.set('key3', 'value3', 1000);
        
        expect(limitedCache.size()).toBe(2);
        expect(limitedCache.has('key1')).toBe(false); // Should be evicted
        expect(limitedCache.has('key2')).toBe(true);
        expect(limitedCache.has('key3')).toBe(true);
    });

    it('should handle namespaces correctly', () => {
        const namespacedCache = new QueryCache({ namespace: 'test' });
        
        namespacedCache.set('key', 'value', 1000);
        expect(namespacedCache.get('key')).toBe('value');
        
        // Different namespace should not interfere
        const otherCache = new QueryCache({ namespace: 'other' });
        expect(otherCache.get('key')).toBeNull();
    });

    it('should clear all entries', () => {
        cache.set('key1', 'value1', 1000);
        cache.set('key2', 'value2', 1000);
        
        expect(cache.size()).toBe(2);
        cache.clear();
        expect(cache.size()).toBe(0);
    });

    it('should update last accessed time on get', () => {
        const limitedCache = new QueryCache({ maxSize: 2 });
        
        limitedCache.set('key1', 'value1', 1000);
        limitedCache.set('key2', 'value2', 1000);
        
        // Access key1 to make it more recently used
        limitedCache.get('key1');
        
        // Add new key, should evict key2
        limitedCache.set('key3', 'value3', 1000);
        
        expect(limitedCache.has('key1')).toBe(true);
        expect(limitedCache.has('key2')).toBe(false);
        expect(limitedCache.has('key3')).toBe(true);
    });

    it('should automatically clean expired entries', () => {
        const autoCleanCache = new QueryCache({ cleanupIntervalMs: 1000 });
        
        autoCleanCache.set('test1', 'value1', 500);
        autoCleanCache.set('test2', 'value2', 1500);
        
        // Advance time to trigger cleanup
        vi.advanceTimersByTime(1000);
        
        expect(autoCleanCache.has('test1')).toBe(false);
        expect(autoCleanCache.has('test2')).toBe(true);
    });

    it('should handle cleanup errors gracefully', () => {
        const errorCache = new QueryCache();
        
        // Force an error during cleanup
        errorCache.cache.set('error', {
            get expiresAt() {
                throw new Error('Test error');
            }
        });
        
        // Should not throw
        expect(() => errorCache.clearExpired()).not.toThrow();
    });
}); 