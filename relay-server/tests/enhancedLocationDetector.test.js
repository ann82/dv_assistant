import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  detectLocation, 
  extractLocationFromQuery, 
  detectLocationWithGeocoding,
  getLocationCoordinates,
  clearExpiredCache,
  getCacheStats,
  detectLocationFallback,
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

  describe('detectLocation', () => {
    it('should detect complete locations with geocoding', async () => {
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

      const result = await detectLocation('San Francisco, California, USA');
      
      expect(result).toEqual({
        location: 'San Francisco, California, USA',
        scope: 'complete',
        isComplete: true,
        geocodeData: {
          country: 'United States',
          countryCode: 'us',
          state: 'California',
          city: 'San Francisco',
          latitude: 37.7749,
          longitude: -122.4194,
          displayName: 'San Francisco, San Francisco County, California, United States',
          importance: 0,
          confidence: 0,
          placeId: undefined,
          osmType: undefined,
          osmId: undefined
        }
      });
    });

    it('should detect incomplete locations with geocoding', async () => {
      // Mock successful geocoding response for just "San Francisco"
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '37.7749',
          lon: '-122.4194',
          display_name: 'San Francisco, San Francisco County, California, United States',
          address: {
            city: 'San Francisco',
            state: null,
            country: null,
            country_code: null
          }
        }]
      });

      const result = await detectLocation('San Francisco');
      
      expect(result).toEqual({
        location: 'San Francisco',
        scope: 'complete',
        isComplete: true,
        geocodeData: {
          country: null,
          countryCode: null,
          state: null,
          city: 'San Francisco',
          latitude: 37.7749,
          longitude: -122.4194,
          displayName: 'San Francisco, San Francisco County, California, United States',
          importance: 0,
          confidence: 0,
          placeId: undefined,
          osmType: undefined,
          osmId: undefined
        }
      });
    });

    it('should fallback to pattern matching when geocoding fails', async () => {
      // Mock failed geocoding response
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await detectLocation('San Francisco, CA');
      
      expect(result).toEqual({
        location: 'San Francisco, CA',
        scope: 'complete',
        isComplete: true
      });
    });

    it('should use cached results for repeated queries', async () => {
      // Use a unique location to avoid cache interference
      const uniqueLocation = 'CacheTestville123, Test State, Test Country';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '10.0000',
          lon: '20.0000',
          display_name: 'CacheTestville123, Test State, Test Country',
          address: {
            city: 'CacheTestville123',
            state: 'Test State',
            country: 'Test Country',
            country_code: 'tc'
          }
        }]
      });

      // First call should hit the API
      const result1 = await detectLocation(uniqueLocation);
      expect(result1.isComplete).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear the mock to reset the call count
      global.fetch.mockClear();

      // Second call should use cache (no API call)
      const result2 = await detectLocation(uniqueLocation);
      expect(result2.isComplete).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(0); // No new API call
    });

    it('should handle edge cases', async () => {
      expect(await detectLocation('')).toEqual({
        location: null,
        scope: 'none',
        isComplete: false
      });

      expect(await detectLocation(null)).toEqual({
        location: null,
        scope: 'none',
        isComplete: false
      });

      expect(await detectLocation(undefined)).toEqual({
        location: null,
        scope: 'none',
        isComplete: false
      });
    });

    it('should treat "near me", "my location", "here" as current-location/incomplete', async () => {
      const cases = [
        'me',
        'near me',
        'my location',
        'here',
        'around me',
        'close to me',
        'current location',
        'help near me',
        'shelter near me',
        'resources around me',
        'services close to me'
      ];
      for (const input of cases) {
        const result = await detectLocation(input);
        expect(result).toEqual({ location: null, scope: 'current-location', isComplete: false });
      }
    });
  });

  describe('"Near Me" Location Extraction', () => {
    it('should extract location from "near me" queries and mark as incomplete', async () => {
      const testCases = [
        'resources near me',
        'help near me', 
        'shelter near me',
        'legal services near me',
        'counseling near me',
        'support near me'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should extract location from "nearby" queries and mark as incomplete', async () => {
      const testCases = [
        'shelter nearby',
        'help nearby',
        'resources nearby',
        'services nearby'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should extract location from "around me" queries and mark as incomplete', async () => {
      const testCases = [
        'help around me',
        'shelter around me',
        'resources around me',
        'services around me'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should extract location from "close to me" queries and mark as incomplete', async () => {
      const testCases = [
        'shelter close to me',
        'help close to me',
        'resources close to me',
        'services close to me'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should extract location from "my location" queries and mark as incomplete', async () => {
      const testCases = [
        'shelter my location',
        'help my location',
        'resources my location',
        'legal services my location',
        'counseling my location'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should extract location from "here" queries and mark as incomplete', async () => {
      const testCases = [
        'shelter here',
        'help here',
        'resources here',
        'services here',
        'counseling here'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should extract location from "current location" queries and mark as incomplete', async () => {
      const testCases = [
        'shelter current location',
        'help current location',
        'resources current location',
        'support current location'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should handle mixed word orders for current location queries', async () => {
      const testCases = [
        'near me shelter',
        'nearby help',
        'around me resources',
        'close to me services',
        'my location legal services',
        'here counseling',
        'current location support'
      ];

      for (const query of testCases) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });

    it('should distinguish between current location and specific location queries', async () => {
      // These should be treated as current location (incomplete)
      const currentLocationQueries = [
        'shelter near me',
        'help nearby',
        'resources around me'
      ];

      for (const query of currentLocationQueries) {
        const result = extractLocationFromQuery(query);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }

      // These should extract specific locations
      const specificLocationQueries = [
        'shelter in San Francisco',
        'help in New York',
        'resources in Los Angeles'
      ];

      for (const query of specificLocationQueries) {
        const result = extractLocationFromQuery(query);
        expect(result.location).toBeTruthy();
        expect(result.scope).not.toBe('current-location');
      }
    });
  });

  describe('Equivalent shelter terms', () => {
    it('should handle equivalent shelter terms correctly', () => {
      const equivalentQueries = [
        'I need domestic shelter homes in Portland',
        'Looking for emergency housing in Seattle',
        'Find domestic violence shelter in Austin',
        'Need safe house in Denver',
        'Looking for crisis center in Miami',
        'Find refuge in Phoenix'
      ];
      
      for (const query of equivalentQueries) {
        const result = extractLocationFromQuery(query);
        expect(result.location).toBeTruthy();
        expect(['complete', 'unknown']).toContain(result.scope);
      }
    });
  });

  describe('Feature-related phrase rejection', () => {
    it('should not extract feature-related phrases as locations', () => {
      const featureQueries = [
        'Do you think this shows that allows dogs and kids?',
        'Does this shelter accept pets?',
        'Is this place pet friendly?',
        'Do they allow children?',
        'Can I bring my dog?',
        'Are kids allowed?',
        'Does it support wheelchair access?',
        'What are their hours?',
        'Is there a cost?',
        'Do they offer Spanish language support?'
      ];
      for (const query of featureQueries) {
        const result = extractLocationFromQuery(query);
        expect(result.location).toBeNull();
      }
    });
  });

  describe('detectLocationFallback', () => {
    it('should detect complete locations with state/province', () => {
      expect(detectLocationFallback('San Francisco, California')).toEqual({
        location: 'San Francisco, California',
        scope: 'complete',
        isComplete: true
      });

      expect(detectLocationFallback('Toronto, Ontario')).toEqual({
        location: 'Toronto, Ontario',
        scope: 'complete',
        isComplete: true
      });
    });

    it('should detect complete locations with country', () => {
      expect(detectLocationFallback('London, England, UK')).toEqual({
        location: 'London, England, UK',
        scope: 'complete',
        isComplete: true
      });

      expect(detectLocationFallback('Mumbai, India')).toEqual({
        location: 'Mumbai, India',
        scope: 'complete',
        isComplete: true
      });
    });

    it('should detect incomplete locations', () => {
      expect(detectLocationFallback('San Francisco')).toEqual({
        location: 'San Francisco',
        scope: 'incomplete',
        isComplete: false
      });

      expect(detectLocationFallback('London')).toEqual({
        location: 'London',
        scope: 'incomplete',
        isComplete: false
      });
    });
  });

  describe('extractLocationFromQuery', () => {
    it('should extract locations from various query patterns', () => {
      expect(extractLocationFromQuery('find shelter in San Francisco')).toEqual({
        location: 'San Francisco',
        scope: 'unknown'
      });

      expect(extractLocationFromQuery('shelter near London, UK')).toEqual({
        location: 'London, UK',
        scope: 'unknown'
      });

      expect(extractLocationFromQuery('help in Mumbai, India')).toEqual({
        location: 'Mumbai, India',
        scope: 'complete'
      });
    });

    it('should handle incomplete location queries', () => {
      expect(extractLocationFromQuery('find shelter in')).toEqual({
        location: null,
        scope: 'incomplete'
      });

      expect(extractLocationFromQuery('shelter near')).toEqual({
        location: null,
        scope: 'incomplete'
      });
    });

    it('should handle current location queries', () => {
      expect(extractLocationFromQuery('shelter near me')).toEqual({
        location: null,
        scope: 'current-location'
      });

      expect(extractLocationFromQuery('help near my location')).toEqual({
        location: null,
        scope: 'current-location'
      });
    });

    it('should handle queries without locations', () => {
      expect(extractLocationFromQuery('I need help with domestic violence')).toEqual({
        location: null,
        scope: 'none'
      });
    });

    it('should treat "near me", "my location", "here" as current-location', () => {
      const cases = [
        'Can you help me with some resources that are near me?',
        'I need a shelter near me',
        'Find services around me',
        'Help at my location',
        'Support here',
        'Resources close to me',
        'Shelter current location'
      ];
      for (const input of cases) {
        const result = extractLocationFromQuery(input);
        expect(result).toEqual({ location: null, scope: 'current-location' });
      }
    });
  });

  describe('detectLocationWithGeocoding', () => {
    it('should detect complete locations with geocoding', async () => {
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

      const result = await detectLocationWithGeocoding('find shelter in San Francisco, California, USA');
      
      expect(result).toEqual({
        location: 'San Francisco, California',
        scope: 'complete',
        isComplete: true,
        geocodeData: {
          country: 'United States',
          countryCode: 'us',
          state: 'California',
          city: 'San Francisco',
          latitude: 37.7749,
          longitude: -122.4194,
          displayName: 'San Francisco, San Francisco County, California, United States',
          importance: 0,
          confidence: 0,
          placeId: undefined,
          osmType: undefined,
          osmId: undefined
        }
      });
    });

    it('should detect incomplete locations with geocoding', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '51.5074',
          lon: '-0.1278',
          display_name: 'London, Greater London, England, United Kingdom',
          address: {
            city: 'London',
            state: null,
            country: null,
            country_code: null
          }
        }]
      });

      const result = await detectLocationWithGeocoding('shelter in London');
      
      expect(result).toEqual({
        location: 'London',
        scope: 'complete',
        isComplete: true,
        geocodeData: {
          country: null,
          countryCode: null,
          state: null,
          city: 'London',
          latitude: 51.5074,
          longitude: -0.1278,
          displayName: 'London, Greater London, England, United Kingdom',
          importance: 0,
          confidence: 0,
          placeId: undefined,
          osmType: undefined,
          osmId: undefined
        }
      });
    });

    it('should handle queries without locations', async () => {
      const result = await detectLocationWithGeocoding('I need help with domestic violence');
      expect(result).toEqual({
        location: null,
        scope: 'none'
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear expired cache entries', () => {
      // This test verifies the function exists and doesn't throw
      expect(() => clearExpiredCache()).not.toThrow();
    });

    it('should return cache statistics', () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxAge');
    });
  });

  describe('Error Handling', () => {
    it('should handle geocoding API errors gracefully', async () => {
      // Clear cache first
      clearExpiredCache();
      
      // Mock API error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await detectLocation('ErrorTestCity123');
      
      // Should fallback to pattern matching
      expect(result.isComplete).toBe(false);
      expect(result.location).toBe('ErrorTestCity123');
      expect(result.scope).toBe('incomplete');
    });

    it('should handle malformed geocoding responses', async () => {
      // Clear cache first
      clearExpiredCache();
      
      // Mock malformed response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null
      });

      const result = await detectLocation('MalformedTestCity456');
      
      // Should fallback to pattern matching
      expect(result.isComplete).toBe(false);
      expect(result.location).toBe('MalformedTestCity456');
      expect(result.scope).toBe('incomplete');
    });

    it('should handle HTTP errors', async () => {
      // Clear cache first
      clearExpiredCache();
      
      // Mock HTTP error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await detectLocation('HTTPErrorTestCity789');
      
      // Should fallback to pattern matching
      expect(result.isComplete).toBe(false);
      expect(result.location).toBe('HTTPErrorTestCity789');
      expect(result.scope).toBe('incomplete');
    });
  });
}); 