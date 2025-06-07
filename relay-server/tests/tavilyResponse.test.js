import { describe, it, expect } from 'vitest';
import { formatTavilyResponse } from '../routes/twilio.js';

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
      expect(formatted).toContain('408-279-2962');
      expect(formatted).toContain('Next Door Solutions');
      expect(formatted).toContain('Community Solutions');
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
            content: 'Content A',
            url: 'https://example.com/a'
          },
          {
            title: 'Organization B - Services',
            content: 'Content B',
            url: 'https://example.com/b'
          },
          {
            title: 'Organization C',
            content: 'Content C',
            url: 'https://example.com/c'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Organization A');
      expect(formatted).toContain('Organization B');
      expect(formatted).toContain('Organization C');
    });

    it('should handle results with different phone number formats', () => {
      const mockResponse = {
        results: [
          {
            title: 'Org A',
            content: 'Call 408-279-2962',
            url: 'https://example.com/a'
          },
          {
            title: 'Org B',
            content: 'Call 408.279.2962',
            url: 'https://example.com/b'
          },
          {
            title: 'Org C',
            content: 'Call 4082792962',
            url: 'https://example.com/c'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('408-279-2962');
      expect(formatted).toContain('408.279.2962');
      expect(formatted).toContain('4082792962');
    });

    it('should handle results with different coverage area formats', () => {
      const mockResponse = {
        results: [
          {
            title: 'Org A',
            content: 'Coverage Area: Santa Clara County',
            url: 'https://example.com/a'
          },
          {
            title: 'Org B',
            content: 'Coverage Area: San Jose and surrounding areas',
            url: 'https://example.com/b'
          },
          {
            title: 'Org C',
            content: 'Serving the entire Bay Area',
            url: 'https://example.com/c'
          }
        ]
      };

      const formatted = formatTavilyResponse(mockResponse);
      
      expect(formatted).toContain('Coverage: Santa Clara County');
      expect(formatted).toContain('Coverage: San Jose and surrounding areas');
      expect(formatted).not.toContain('Coverage: Serving the entire Bay Area');
    });
  });
}); 