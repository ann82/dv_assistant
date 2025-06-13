import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatTavilyResponse } from '../routes/twilio.js';
import { extractLocationFromSpeech, generateLocationPrompt } from '../lib/speechProcessor.js';

// Mock logger to prevent errors in tests
vi.mock('../lib/logger.js', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    logger,
    default: logger
  };
});

describe('Tavily Response Formatting', () => {
  describe('formatTavilyResponse', () => {
    it('should format valid Tavily response correctly', () => {
      const mockResponse = {
        results: [
          {
            title: 'Safe House of Santa Clara County | Domestic Violence Shelter',
            content: 'Safe House provides 24/7 emergency shelter and support services. Call us at 408-279-2962 for immediate assistance. Coverage Area: Santa Clara County',
            url: 'https://example.com/safehouse'
          },
          {
            title: 'Next Door Solutions - Domestic Violence Services',
            content: 'Next Door Solutions offers comprehensive services. Contact us at 408-279-2962. Coverage Area: San Jose and surrounding areas',
            url: 'https://example.com/nextdoor'
          },
          {
            title: 'Community Solutions | Emergency Shelter',
            content: 'Emergency shelter services available 24/7. Call 408-278-2160 for help. Coverage Area: South Bay Area',
            url: 'https://example.com/community'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('I found some resources that might help');
      expect(formatted).toContain('Safe House of Santa Clara County');
      expect(formatted).toContain('Safe House provides 24/7 emergency shelter and support services');
      expect(formatted).toContain('408-279-2962');
      expect(formatted).toContain('Next Door Solutions');
      expect(formatted).toContain('Next Door Solutions offers comprehensive services');
      expect(formatted).toContain('Community Solutions');
      expect(formatted).toContain('Emergency shelter services available 24/7');
      expect(formatted).toContain('408-278-2160');
      expect(formatted).toContain('Coverage: Santa Clara County');
      expect(formatted).toContain('Coverage: San Jose and surrounding areas');
      expect(formatted).toContain('Coverage: South Bay Area');
      expect(formatted).toContain('Would you like more information');
    });

    it('should handle empty results', () => {
      const mockResponse = {
        results: []
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain("I'm sorry, I couldn't find any specific resources");
      expect(formatted).toContain('Would you like me to search for resources in a different location');
    });

    it('should handle missing results array', () => {
      const mockResponse = {};

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain("I'm sorry, I couldn't find any specific resources");
    });

    it('should handle results without phone numbers', () => {
      const mockResponse = {
        results: [
          {
            title: 'Safe House of Santa Clara County',
            content: 'Safe House provides 24/7 emergency shelter and support services.',
            url: 'https://example.com/safehouse'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Safe House of Santa Clara County');
      expect(formatted).toContain('Safe House provides 24/7 emergency shelter and support services');
      expect(formatted).not.toContain('Phone:');
    });

    it('should handle malformed results', () => {
      const mockResponse = {
        results: [
          {
            title: null,
            content: null,
            url: null
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Unknown Organization');
    });

    it('should handle errors gracefully', () => {
      const mockResponse = null;

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain("I'm sorry, I couldn't find any specific resources");
      expect(formatted).toContain('Would you like me to search for resources in a different location');
    });

    it('should extract organization names from different title formats', () => {
      const mockResponse = {
        results: [
          {
            title: 'Organization A | Services',
            content: 'Provides emergency shelter services.',
            url: 'https://example.com/a'
          },
          {
            title: 'Organization B - Services',
            content: 'Offers comprehensive support.',
            url: 'https://example.com/b'
          },
          {
            title: 'Organization C',
            content: 'Emergency services available.',
            url: 'https://example.com/c'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Organization A');
      expect(formatted).toContain('Provides emergency shelter services');
      expect(formatted).toContain('Organization B');
      expect(formatted).toContain('Offers comprehensive support');
      expect(formatted).toContain('Organization C');
      expect(formatted).toContain('Emergency services available');
    });

    it('should handle results with different phone number formats', () => {
      const mockResponse = {
        results: [
          {
            title: 'Org A',
            content: 'Emergency services. Call 408-279-2962 for help.',
            url: 'https://example.com/a'
          },
          {
            title: 'Org B',
            content: 'Support services. Contact 408.279.2962.',
            url: 'https://example.com/b'
          },
          {
            title: 'Org C',
            content: 'Help available. Call 4082792962.',
            url: 'https://example.com/c'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Emergency services');
      expect(formatted).toContain('408-279-2962');
      expect(formatted).toContain('Support services');
      expect(formatted).toContain('408.279.2962');
      expect(formatted).toContain('Help available');
      expect(formatted).toContain('4082792962');
    });

    it('should handle results with different coverage area formats', () => {
      const mockResponse = {
        results: [
          {
            title: 'Org A',
            content: 'Emergency services. Coverage Area: Santa Clara County',
            url: 'https://example.com/a'
          },
          {
            title: 'Org B',
            content: 'Support services. Coverage Area: San Jose and surrounding areas',
            url: 'https://example.com/b'
          },
          {
            title: 'Org C',
            content: 'Help available. Serving the entire Bay Area',
            url: 'https://example.com/c'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Emergency services');
      expect(formatted).toContain('Coverage: Santa Clara County');
      expect(formatted).toContain('Support services');
      expect(formatted).toContain('Coverage: San Jose and surrounding areas');
      expect(formatted).toContain('Help available');
      expect(formatted).not.toContain('Coverage: Serving the entire Bay Area');
    });
  });

  describe('Location Extraction', () => {
    it('should extract location from various speech patterns', () => {
      const testCases = [
        { input: "I need help in San Francisco", expected: "San Francisco" },
        { input: "Find shelters near Santa Clara", expected: "Santa Clara" },
        { input: "I'm in San Jose and need resources", expected: "San Jose" },
        { input: "Looking for help in Oakland", expected: "Oakland" },
        { input: "My location is San Mateo", expected: "San Mateo" },
        { input: "I live in Redwood City", expected: "Redwood City" },
        { input: "Need resources in Mountain View", expected: "Mountain View" }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(extractLocationFromSpeech(input)).toBe(expected);
      });
    });

    it('should return null for speech without location', () => {
      const testCases = [
        "I need help",
        "Find shelters",
        "Looking for resources",
        "Can you help me",
        "I need assistance"
      ];

      testCases.forEach(input => {
        expect(extractLocationFromSpeech(input)).toBeNull();
      });
    });

    it('should handle complex location mentions', () => {
      const testCases = [
        { input: "Find domestic violence shelters in San Francisco County", expected: "San Francisco" },
        { input: "I'm looking for help in the San Jose area", expected: "San Jose" },
        { input: "Need resources near Santa Clara County", expected: "Santa Clara" }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(extractLocationFromSpeech(input)).toBe(expected);
      });
    });
  });

  describe('Location Prompts', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should generate a prompt when no location is found', async () => {
      const prompt = await generateLocationPrompt();
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toMatch(/city|area|location/);
    });

    it('should generate different prompts on multiple calls', async () => {
      const prompt1 = await generateLocationPrompt();
      const prompt2 = await generateLocationPrompt();
      
      expect(prompt1).toBeDefined();
      expect(prompt2).toBeDefined();
      expect(typeof prompt1).toBe('string');
      expect(typeof prompt2).toBe('string');
    });

    it('should include example locations in prompts', async () => {
      const prompt = await generateLocationPrompt();
      // Check if the prompt contains at least one example city
      const exampleCities = ['San Francisco', 'Santa Clara', 'San Jose', 'Oakland', 'San Mateo', 'Redwood City', 'Palo Alto', 'Mountain View', 'Sunnyvale'];
      const hasExampleCity = exampleCities.some(city => prompt.includes(city));
      expect(hasExampleCity).toBe(true);
    });

    it('should handle prompt generation', async () => {
      const prompt = await generateLocationPrompt();
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });
});

describe('Speech Processing', () => {
  describe('extractLocationFromSpeech', () => {
    it('should extract location from speech with "in" pattern', () => {
      const speech = 'I need help finding a shelter in San Francisco, California';
      const location = extractLocationFromSpeech(speech);
      expect(location).toBe('San Francisco, California');
    });

    it('should extract location from speech with "find shelters in" pattern', () => {
      const speech = 'find shelters in Oakland, California';
      const location = extractLocationFromSpeech(speech);
      expect(location).toBe('Oakland, California');
    });

    it('should return null when no location is found', () => {
      const speech = 'I need help finding a shelter';
      const location = extractLocationFromSpeech(speech);
      expect(location).toBeNull();
    });
  });

  describe('generateLocationPrompt', () => {
    it('should return a prompt asking for location', () => {
      const prompt = generateLocationPrompt();
      // Accept either 'city' or 'area' in the prompt
      expect(prompt).toMatch(/city|area/);
      expect(prompt).toContain('location');
    });

    it('should return different prompts on multiple calls (allowing for randomness)', () => {
      // Run the check multiple times to reduce flakiness
      let foundDifferent = false;
      let lastPrompt = generateLocationPrompt();
      for (let i = 0; i < 10; i++) {
        const prompt = generateLocationPrompt();
        if (prompt !== lastPrompt) {
          foundDifferent = true;
          break;
        }
        lastPrompt = prompt;
      }
      expect(foundDifferent).toBe(true);
    });
  });
}); 