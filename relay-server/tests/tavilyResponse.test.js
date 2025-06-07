import { describe, it, expect, beforeEach } from 'vitest';
import { formatTavilyResponse } from '../routes/twilio.js';

describe('Tavily Response Formatting', () => {
  describe('formatTavilyResponse', () => {
    it('should format valid Tavily response correctly', () => {
      const mockResponse = {
        results: [
          {
            title: 'Safe House of Santa Clara County | Domestic Violence Shelter',
            content: 'Safe House provides 24/7 emergency shelter and support services. Call us at 408-279-2962 for immediate assistance.',
            url: 'https://example.com/safehouse'
          },
          {
            title: 'Next Door Solutions | Domestic Violence Services',
            content: 'Next Door Solutions offers comprehensive services. Contact us at 408-279-2962.',
            url: 'https://example.com/nextdoor'
          },
          {
            title: 'Community Solutions | Emergency Shelter',
            content: 'Emergency shelter services available 24/7. Call 408-278-2160 for help.',
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
  });
}); 