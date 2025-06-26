import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';

describe('Tavily Response Formatting', () => {
  it('should format response with resources', () => {
    const response = {
      results: [
        { title: 'Domestic Violence Resource Center', content: 'Some content', url: 'http://example.com/1', score: 0.8 },
        { title: "Women's Crisis Shelter", content: 'Some content', url: 'http://example.com/2', score: 0.9 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(response, 'web', '', 3);
    expect(formatted.summary).toContain('I found 1 shelters');
    expect(formatted.shelters).toHaveLength(1);
  });

  it('should format response without resources', () => {
    const response = {
      results: []
    };
    const formatted = ResponseGenerator.formatTavilyResponse(response, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle null response', () => {
    const formatted = ResponseGenerator.formatTavilyResponse(null, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle undefined response', () => {
    const formatted = ResponseGenerator.formatTavilyResponse(undefined, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle empty response', () => {
    const formatted = ResponseGenerator.formatTavilyResponse({}, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should format valid Tavily response correctly', () => {
    const mockResponse = {
      results: [
        { title: 'Domestic Violence Resource Center', content: 'Some content', url: 'http://example.com/a', score: 0.75 },
        { title: "Women's Crisis Shelter", content: 'Some content', url: 'http://example.com/b', score: 0.8 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.summary).toContain('I found 1 shelters');
    expect(formatted.shelters).toHaveLength(1);
  });

  it('should handle empty results', () => {
    const mockResponse = {
      results: []
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle missing results array', () => {
    const mockResponse = {};
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle results without phone numbers', () => {
    const mockResponse = {
      results: [
        { title: 'Domestic Violence Resource Center', content: 'Some content', url: 'http://example.com/a', score: 0.8 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle malformed results', () => {
    const mockResponse = {
      results: [
        { title: null, content: null, url: 'http://example.com/a', score: 0.8 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle errors gracefully', () => {
    const mockResponse = null;
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.summary).toContain("I'm sorry, I couldn't find any specific resources");
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should extract organization names from different title formats', () => {
    const mockResponse = {
      results: [
        { title: 'Family Justice Center', content: 'Some content', url: 'http://example.com/a', score: 0.8 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters[0].name).toBe('Family Justice Center');
  });

  it('should handle results with different phone number formats', () => {
    const mockResponse = {
      results: [
        { title: 'Domestic Violence Resource Center', content: 'Phone: 408-279-2962', url: 'http://example.com/a', score: 0.8 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should handle results with different coverage area formats', () => {
    const mockResponse = {
      results: [
        { title: 'Domestic Violence Resource Center', content: 'Coverage: Santa Clara County', url: 'http://example.com/a', score: 0.8 }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters).toHaveLength(0);
  });

  it('should filter out results with score < 0.01', () => {
    const mockResponse = {
      results: [
        {
          title: 'High Score Result',
          content: 'High scoring shelter result',
          url: 'https://example.com/high',
          score: 0.9
        },
        {
          title: 'Low Score Result',
          content: 'Low scoring result',
          url: 'https://example.com/low',
          score: 0.005 // Below 0.01 threshold
        }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 10);
    expect(formatted.shelters).toHaveLength(1);
    expect(formatted.summary).toContain('I found 1 shelters');
  });

  describe('formatTavilyResponse', () => {
    it('should format response with shelters', () => {
      const mockResponse = {
        results: [
          {
            title: 'Domestic Violence Shelter - Safe Haven',
            content: 'Emergency shelter for domestic violence victims',
            url: 'https://example.com/shelter',
            score: 0.9
          },
          {
            title: 'Domestic Violence Shelter - Women\'s Crisis Center',
            content: 'Crisis center for domestic violence survivors',
            url: 'https://example.com/crisis',
            score: 0.85
          }
        ]
      };

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', 'find shelter', 3);
      
      expect(formatted.shelters).toHaveLength(2);
      expect(formatted.voiceResponse).toContain('I found 2 shelters');
      expect(formatted.smsResponse).toContain('Safe Haven');
      expect(formatted.smsResponse).toContain('Women\'S Crisis Center');
      const dvKeywords = ['domestic', 'violence', 'abuse', 'shelter', 'crisis', 'center', 'safe house'];
      formatted.shelters.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });

    it('should handle empty results', () => {
      const mockResponse = { results: [] };
      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', 'find shelter', 3);
      
      expect(formatted.shelters).toHaveLength(0);
      expect(formatted.voiceResponse).toContain('I couldn\'t find any shelters');
      expect(formatted.smsResponse).toContain('No shelters found');
      expect(formatted.summary).toContain('I\'m sorry, I couldn\'t find any specific resources');
    });

    it('should handle null results', () => {
      const mockResponse = { results: null };
      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', 'find shelter', 3);
      
      expect(formatted.shelters).toHaveLength(0);
      expect(formatted.voiceResponse).toContain('I couldn\'t find any shelters');
      expect(formatted.summary).toContain('I\'m sorry, I couldn\'t find any specific resources');
    });

    it('should limit results to maxResults', () => {
      const mockResponse = {
        results: [
          {
            title: 'Domestic Violence Shelter - First',
            content: 'First shelter',
            url: 'https://example.com/first',
            score: 0.9
          },
          {
            title: 'Domestic Violence Shelter - Second',
            content: 'Second shelter',
            url: 'https://example.com/second',
            score: 0.8
          },
          {
            title: 'Domestic Violence Shelter - Third',
            content: 'Third shelter',
            url: 'https://example.com/third',
            score: 0.7
          }
        ]
      };

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', 'find shelter', 2);
      
      expect(formatted.shelters).toHaveLength(2);
      expect(formatted.shelters[0].name).toContain('First');
      expect(formatted.shelters[1].name).toContain('Second');
    });

    it('should filter out low-scoring results', () => {
      const mockResponse = {
        results: [
          {
            title: 'High Score Shelter',
            content: 'High scoring shelter result',
            url: 'https://example.com/high',
            score: 0.9
          },
          {
            title: 'Low Score Result',
            content: 'Low scoring result',
            url: 'https://example.com/low',
            score: 0.005 // Below 0.01 threshold
          }
        ]
      };
      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', 'find shelter', 3);
      // Only the high score result should be included
      expect(formatted.shelters).toHaveLength(1);
      expect(formatted.shelters[0].name).toContain('High Score');
      expect(formatted.summary).toContain('I found 1 shelters');
    });
  });
}); 