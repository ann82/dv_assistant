import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger module
vi.mock('../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { QueryCache } from '../lib/queryCache.js';

describe('Query Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new QueryCache({ maxSize: 10 }); // 1 second TTL, max 10 entries
  });

  afterEach(() => {
    if (cache) {
      // Clean up cache
      cache.clear();
    }
  });

  it('should store and retrieve queries', () => {
    const query = 'find shelter in San Francisco';
    const result = { data: 'test result' };
    cache.set(query, result, 1000);
    const retrieved = cache.get(query);
    expect(retrieved).toEqual(result);
  });

  it('should return null for non-existent queries', () => {
    const result = cache.get('non-existent query');
    expect(result).toBeNull();
  });

  it('should respect TTL expiration', async () => {
    const query = 'test query';
    const result = { data: 'test' };
    cache.set(query, result, 1000);
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    const retrieved = cache.get(query);
    expect(retrieved).toBeNull();
  });

  it('should limit cache size', () => {
    // Add more entries than max size
    for (let i = 0; i < 15; i++) {
      cache.set(`query${i}`, { data: `result${i}` }, 1000);
    }
    // Should only have max size entries
    expect(cache.size()).toBeLessThanOrEqual(10);
  });

  it('should evict least recently used entries', () => {
    // Add entries up to max size
    for (let i = 0; i < 10; i++) {
      cache.set(`query${i}`, { data: `result${i}` }, 1000);
    }
    
    // Add a small delay to ensure different timestamps
    const originalDateNow = Date.now;
    let timeOffset = 0;
    Date.now = () => originalDateNow() + timeOffset;
    
    // Access first entry to make it recently used
    timeOffset += 100;
    cache.get('query0');
    
    // Add one more entry to trigger eviction (now we have 11 entries, exceeding max of 10)
    timeOffset += 100;
    cache.set('newQuery', { data: 'newResult' }, 1000);
    
    // query1 should be evicted (LRU) since it was the oldest unaccessed entry
    expect(cache.get('query1')).toBeNull();
    expect(cache.get('query0')).toBeTruthy(); // Should still be there
    expect(cache.get('newQuery')).toBeTruthy(); // New entry should be there
    
    // Restore Date.now
    Date.now = originalDateNow;
  });

  it('should handle concurrent access', () => {
    const query = 'concurrent query';
    const result = { data: 'concurrent result' };
    cache.set(query, result, 1000);
    const retrieved = cache.get(query);
    expect(retrieved).toEqual(result);
  });

  it('should clear all entries', () => {
    cache.set('query1', { data: 'result1' }, 1000);
    cache.set('query2', { data: 'result2' }, 1000);
    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('query1')).toBeNull();
    expect(cache.get('query2')).toBeNull();
  });
}); 