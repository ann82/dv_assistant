import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  detectUSLocation, 
  extractLocationFromQuery, 
  detectLocationWithGeocoding,
  getLocationCoordinates,
  clearExpiredCache,
  getCacheStats,
  detectUSLocationFallback,
  cleanConversationalFillers,
  cleanExtractedLocation,
  extractStandaloneLocation
} from '../lib/enhancedLocationDetector.js';

// Mock fetch for geocoding API calls
global.fetch = vi.fn();

describe('Enhanced Location Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExpiredCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearExpiredCache();
  });

  describe('detectUSLocation', () => {
    it('should detect US ZIP codes', async () => {
      const result = await detectUSLocation('94102');
      expect(result).toEqual({
        isUS: true,
        location: '94102',
        scope: 'US'
      });

      const result2 = await detectUSLocation('12345-6789');
      expect(result2).toEqual({
        isUS: true,
        location: '12345-6789',
        scope: 'US'
      });
    });

    it('should use geocoding for US cities', async () => {
      // Mock successful geocoding response for San Francisco
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, San Francisco County, California, United States',
          address: {
            city: 'San Francisco',
            state: 'California',
            country: 'United States',
            country_code: 'us'
          }
        }]
      });

      const result = await detectUSLocation('San Francisco');
      
      expect(result).toEqual({
        isUS: true,
        location: 'San Francisco',
        scope: 'US',
        geocodeData: {
          country: 'United States',
          countryCode: 'us',
          state: 'California',
          city: 'San Francisco',
          latitude: 37.7749,
          longitude: -122.4194,
          displayName: 'San Francisco, San Francisco County, California, United States'
        }
      });
    });

    it('should use geocoding for non-US locations', async () => {
      // Mock successful geocoding response for London
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '51.5074',
          lon: '-0.1278',
          display_name: 'London, Greater London, England, United Kingdom',
          address: {
            city: 'London',
            state: 'Greater London',
            country: 'United Kingdom',
            country_code: 'gb'
          }
        }]
      });

      const result = await detectUSLocation('London');
      
      expect(result).toEqual({
        isUS: false,
        location: 'London',
        scope: 'non-US',
        geocodeData: {
          country: 'United Kingdom',
          countryCode: 'gb',
          state: 'Greater London',
          city: 'London',
          latitude: 51.5074,
          longitude: -0.1278,
          displayName: 'London, Greater London, England, United Kingdom'
        }
      });
    });

    it('should fallback to pattern matching when geocoding fails', async () => {
      // Mock failed geocoding response
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await detectUSLocation('California');
      
      expect(result).toEqual({
        isUS: true,
        location: 'California',
        scope: 'US'
      });
    });

    it('should use cached results for repeated queries', async () => {
      // Use a unique location to avoid cache interference
      const uniqueLocation = 'CacheTestville123';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '10.0000',
          lon: '20.0000',
          display_name: 'CacheTestville123, Test State, United States',
          address: {
            city: 'CacheTestville123',
            state: 'Test State',
            country: 'United States',
            country_code: 'us'
          }
        }]
      });

      // First call should hit the API
      const result1 = await detectUSLocation(uniqueLocation);
      expect(result1.isUS).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear the mock to reset the call count
      global.fetch.mockClear();

      // Second call should use cache (no API call)
      const result2 = await detectUSLocation(uniqueLocation);
      expect(result2.isUS).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(0); // No new API call
    });

    it('should handle edge cases', async () => {
      expect(await detectUSLocation('')).toEqual({
        isUS: false,
        location: null,
        scope: 'non-US'
      });

      expect(await detectUSLocation(null)).toEqual({
        isUS: false,
        location: null,
        scope: 'non-US'
      });

      expect(await detectUSLocation(undefined)).toEqual({
        isUS: false,
        location: null,
        scope: 'non-US'
      });
    });
  });

  describe('detectUSLocationFallback', () => {
    it('should detect US states', () => {
      expect(detectUSLocationFallback('California')).toEqual({
        isUS: true,
        location: 'California',
        scope: 'US'
      });

      expect(detectUSLocationFallback('CA')).toEqual({
        isUS: true,
        location: 'CA',
        scope: 'US'
      });
    });

    it('should detect non-US countries', () => {
      expect(detectUSLocationFallback('Canada')).toEqual({
        isUS: false,
        location: 'Canada',
        scope: 'non-US'
      });

      expect(detectUSLocationFallback('United Kingdom')).toEqual({
        isUS: false,
        location: 'United Kingdom',
        scope: 'non-US'
      });
    });

    it('should handle mixed locations', () => {
      expect(detectUSLocationFallback('San Francisco, California')).toEqual({
        isUS: true,
        location: 'San Francisco, California',
        scope: 'US'
      });

      expect(detectUSLocationFallback('Mumbai, India')).toEqual({
        isUS: false,
        location: 'Mumbai, India',
        scope: 'non-US'
      });
    });
  });

  describe('extractLocationFromQuery', () => {
    it('should extract location from conversational queries with fillers', () => {
      const result = extractLocationFromQuery("Hey, can you help me find some shelter homes near Santa Clara?");
      expect(result.location).toBe('santa clara');
      expect(result.scope).toBe('unknown');
    });

    it('should extract location from queries with multiple fillers', () => {
      const result = extractLocationFromQuery("Hi there, I need help finding shelter in San Francisco");
      expect(result.location).toBe('san francisco');
      expect(result.scope).toBe('unknown');
    });

    it('should extract location from complex conversational queries', () => {
      const result = extractLocationFromQuery("Hello, I was wondering if you could help me find some shelter resources near Palo Alto");
      expect(result.location).toBe('palo alto');
      expect(result.scope).toBe('unknown');
    });

    it('should extract location from queries ending with location', () => {
      const result = extractLocationFromQuery("I need shelter in Mountain View");
      expect(result.location).toBe('mountain view');
      expect(result.scope).toBe('unknown');
    });

    it('should extract location with state abbreviations', () => {
      const result = extractLocationFromQuery("Find shelter near Sacramento, CA");
      expect(result.location).toBe('sacramento, ca');
      expect(result.scope).toBe('unknown');
    });

    it('should extract standalone location names', () => {
      const result = extractLocationFromQuery("I need help in Santa Clara");
      expect(result.location).toBe('santa clara');
      expect(result.scope).toBe('unknown');
    });

    it('should handle queries with articles and quantifiers', () => {
      const result = extractLocationFromQuery("I need some shelter in the San Jose area");
      expect(result.location).toBe('san jose area');
      expect(result.scope).toBe('unknown');
    });

    it('should return null for queries without location', () => {
      const result = extractLocationFromQuery("I need help with domestic violence");
      expect(result.location).toBeNull();
      expect(result.scope).toBe('non-US');
    });

    it('should handle empty queries', () => {
      const result = extractLocationFromQuery("");
      expect(result.location).toBeNull();
      expect(result.scope).toBe('non-US');
    });

    it('should handle null queries', () => {
      const result = extractLocationFromQuery(null);
      expect(result.location).toBeNull();
      expect(result.scope).toBe('non-US');
    });

    it('should correctly extract location when "home" is used as a service word', () => {
      const result = extractLocationFromQuery("Hey, can you help me find shelter home Mumbai?");
      expect(result.location).toBe('mumbai');
      expect(result.scope).toBe('unknown');
    });

    it('should detect incomplete location queries', () => {
      const result = extractLocationFromQuery("Can you help me find shelter homes near?");
      expect(result.location).toBeNull();
      expect(result.scope).toBe('incomplete');
    });

    it('should detect incomplete location queries with different patterns', () => {
      const incompleteQueries = [
        "find shelter in",
        "I need help near",
        "shelter around",
        "help me find shelter at",
        "can you help me find shelter close to"
      ];

      incompleteQueries.forEach(query => {
        const result = extractLocationFromQuery(query);
        expect(result.location).toBeNull();
        expect(result.scope).toBe('incomplete');
      });
    });

    it('should not detect complete location queries as incomplete', () => {
      const completeQueries = [
        "find shelter in San Francisco",
        "I need help near New York",
        "shelter around Los Angeles",
        "help me find shelter at Chicago"
      ];

      completeQueries.forEach(query => {
        const result = extractLocationFromQuery(query);
        expect(result.scope).not.toBe('incomplete');
      });
    });
  });

  describe('cleanConversationalFillers', () => {
    it('should remove common fillers from start of query', () => {
      const result = cleanConversationalFillers("Hey, can you help me find shelter in Santa Clara?");
      expect(result).toBe("find shelter in santa clara?");
    });

    it('should remove multiple consecutive fillers', () => {
      const result = cleanConversationalFillers("Hi there, I need help finding shelter in San Francisco");
      expect(result).toBe("there, i need help finding shelter in san francisco");
    });

    it('should handle complex filler combinations', () => {
      const result = cleanConversationalFillers("Hello, I was wondering if you could help me find some shelter");
      expect(result).toBe("if you could help me find some shelter");
    });

    it('should preserve query if no fillers', () => {
      const result = cleanConversationalFillers("Find shelter in Palo Alto");
      expect(result).toBe("find shelter in palo alto");
    });

    it('should handle empty string', () => {
      const result = cleanConversationalFillers("");
      expect(result).toBe("");
    });

    it('should handle null input', () => {
      const result = cleanConversationalFillers(null);
      expect(result).toBe(null);
    });
  });

  describe('cleanExtractedLocation', () => {
    it('should remove articles from location', () => {
      const result = cleanExtractedLocation("the Santa Clara");
      expect(result).toBe("santa clara");
    });

    it('should remove quantifiers from location', () => {
      const result = cleanExtractedLocation("some San Francisco");
      expect(result).toBe("san francisco");
    });

    it('should remove service words from location', () => {
      const result = cleanExtractedLocation("shelter Palo Alto");
      expect(result).toBe("palo alto");
    });

    it('should clean complex location strings', () => {
      const result = cleanExtractedLocation("the some shelter Mountain View area");
      expect(result).toBe("mountain view area");
    });

    it('should remove trailing punctuation', () => {
      const result = cleanExtractedLocation("Santa Clara?");
      expect(result).toBe("santa clara");
    });

    it('should return null for invalid locations', () => {
      const result = cleanExtractedLocation("a");
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = cleanExtractedLocation("");
      expect(result).toBeNull();
    });

    it('should handle null input', () => {
      const result = cleanExtractedLocation(null);
      expect(result).toBeNull();
    });
  });

  describe('extractStandaloneLocation', () => {
    it('should extract common US cities', () => {
      const result = extractStandaloneLocation("I need help in santa clara");
      expect(result).toBe("santa clara");
    });

    it('should extract multi-word cities', () => {
      const result = extractStandaloneLocation("Find shelter in san francisco");
      expect(result).toBe("san francisco");
    });

    it('should extract cities with state', () => {
      const result = extractStandaloneLocation("I need help in palo alto california");
      expect(result).toBe("palo alto");
    });

    it('should return null for non-location words', () => {
      const result = extractStandaloneLocation("I need help with domestic violence");
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = extractStandaloneLocation("");
      expect(result).toBeNull();
    });

    it('should handle null input', () => {
      const result = extractStandaloneLocation(null);
      expect(result).toBeNull();
    });
  });

  describe('detectLocationWithGeocoding', () => {
    it('should detect US locations with geocoding', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, San Francisco County, California, United States',
          address: {
            city: 'San Francisco',
            state: 'California',
            country: 'United States',
            country_code: 'us'
          }
        }]
      });

      const result = await detectLocationWithGeocoding('find shelter in San Francisco');
      
      expect(result).toEqual({
        location: 'san francisco',
        scope: 'US',
        isUS: true,
        geocodeData: {
          country: 'United States',
          countryCode: 'us',
          state: 'California',
          city: 'San Francisco',
          latitude: 37.7749,
          longitude: -122.4194,
          displayName: 'San Francisco, San Francisco County, California, United States'
        }
      });
    });

    it('should detect non-US locations with geocoding', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '51.5074',
          lon: '-0.1278',
          display_name: 'London, Greater London, England, United Kingdom',
          address: {
            city: 'London',
            state: 'Greater London',
            country: 'United Kingdom',
            country_code: 'gb'
          }
        }]
      });

      const result = await detectLocationWithGeocoding('shelter in London');
      
      expect(result).toEqual({
        location: 'london',
        scope: 'non-US',
        isUS: false,
        geocodeData: {
          country: 'United Kingdom',
          countryCode: 'gb',
          state: 'Greater London',
          city: 'London',
          latitude: 51.5074,
          longitude: -0.1278,
          displayName: 'London, Greater London, England, United Kingdom'
        }
      });
    });

    it('should handle queries without locations', async () => {
      const result = await detectLocationWithGeocoding('I need help with domestic violence');
      expect(result).toEqual({
        location: null,
        scope: 'non-US'
      });
    });
  });

  describe('getLocationCoordinates', () => {
    it('should return coordinates for valid locations', async () => {
      // Mock successful geocoding response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, California, United States',
          address: {
            city: 'San Francisco',
            state: 'California',
            country: 'United States',
            country_code: 'us'
          }
        }]
      });

      const coords = await getLocationCoordinates('San Francisco');
      
      expect(coords).toEqual({
        latitude: 37.7749,
        longitude: -122.4194
      });
    });

    it('should return null for invalid locations', async () => {
      const invalidLocation = 'DefinitelyNotARealPlaceXYZ123456789';
      
      // Mock empty geocoding response for invalid location
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [] // Empty array for invalid location
      });

      const coords = await getLocationCoordinates(invalidLocation);
      expect(coords).toBeNull();
    });

    it('should return null for empty input', async () => {
      const coords = await getLocationCoordinates('');
      expect(coords).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });

    it('should clear expired cache entries', () => {
      // This test verifies the function exists and doesn't throw
      expect(() => clearExpiredCache()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle geocoding API errors gracefully', async () => {
      // Mock API error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await detectUSLocation('San Francisco');
      
      // Should fallback to pattern matching
      expect(result.isUS).toBe(true);
      expect(result.location).toBe('San Francisco');
      expect(result.scope).toBe('US');
    });

    it('should handle malformed geocoding responses', async () => {
      // Mock malformed response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null
      });

      const result = await detectUSLocation('San Francisco');
      
      // Should fallback to pattern matching
      expect(result.isUS).toBe(true);
      expect(result.location).toBe('San Francisco');
      expect(result.scope).toBe('US');
    });

    it('should handle HTTP errors', async () => {
      // Mock HTTP error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await detectUSLocation('San Francisco');
      
      // Should fallback to pattern matching
      expect(result.isUS).toBe(true);
      expect(result.location).toBe('San Francisco');
      expect(result.scope).toBe('US');
    });
  });
}); 