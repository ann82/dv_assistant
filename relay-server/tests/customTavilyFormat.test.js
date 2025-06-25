import { describe, it, expect } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';

describe('Custom Tavily Response Formats', () => {
  const mockTavilyResponse = {
    query: "domestic violence shelters South Lake Tahoe California",
    results: [
      {
        title: "South Lake Tahoe Domestic Violence Shelter",
        url: "https://www.southlaketahoe-shelter.org",
        content: "Emergency shelter and support services for domestic violence survivors in South Lake Tahoe. 24/7 crisis line available. Phone: 530-555-1234",
        score: 0.890761,
        raw_content: null
      },
      {
        title: "Tahoe Safe House - Domestic Violence Crisis Center",
        url: "https://tahoesafehouse.org",
        content: "Our skilled team is here to provide emergency shelter and supportive services to families and individuals experiencing domestic violence. Call (530) 600-2822",
        score: 0.8674071,
        raw_content: null
      },
      {
        title: "Lake Tahoe Women's Shelter",
        url: "https://laketahoewomensshelter.org",
        content: "Emergency shelter for women and children fleeing domestic violence. Located in South Lake Tahoe. Phone: 530-555-5678",
        score: 0.6672566,
        raw_content: null
      }
    ],
    response_time: 1.94
  };

  const dvKeywords = ['domestic', 'violence', 'abuse', 'shelter', 'crisis', 'center', 'safe house'];

  describe('Simple Format', () => {
    it('should format response in simple JSON structure', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'simple', {
        query: 'find shelters in South Lake Tahoe',
        location: 'South Lake Tahoe',
        minScore: 0.6
      });

      expect(formatted).toEqual({
        success: true,
        message: 'Found 3 shelters',
        count: 3,
        data: [
          {
            name: 'South Lake Tahoe Domestic Violence Shelter',
            url: 'https://www.southlaketahoe-shelter.org',
            phone: '530-555-1234',
            relevance: 89
          },
          {
            name: 'Tahoe Safe House - Domestic Violence Crisis Center',
            url: 'https://tahoesafehouse.org',
            phone: '530-600-2822',
            relevance: 87
          },
          {
            name: "Lake Tahoe Women's Shelter",
            url: 'https://laketahoewomensshelter.org',
            phone: '530-555-5678',
            relevance: 67
          }
        ],
        timestamp: expect.any(String),
        query: 'find shelters in South Lake Tahoe',
        location: 'South Lake Tahoe'
      });

      expect(
        dvKeywords.some(kw => formatted.data[0].name.toLowerCase().includes(kw) || (formatted.data[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });
  });

  describe('Detailed Format', () => {
    it('should format response in detailed JSON structure', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'detailed', {
        query: 'find shelters in South Lake Tahoe',
        location: 'South Lake Tahoe',
        searchDepth: 'advanced',
        minScore: 0.6,
        maxResults: 3
      });

      expect(formatted).toEqual({
        success: true,
        message: 'Found 3 shelters',
        count: 3,
        results: [
          {
            title: 'South Lake Tahoe Domestic Violence Shelter',
            url: 'https://www.southlaketahoe-shelter.org',
            content: 'Emergency shelter and support services for domestic violence survivors in South Lake Tahoe. 24/7 crisis line available. Phone: 530-555-1234',
            score: 0.890761,
            relevance: 89,
            phone: '530-555-1234',
            cleanName: 'South Lake Tahoe Domestic Violence Shelter',
            metadata: {
              hasPhone: true,
              contentLength: 139,
              isHighRelevance: true
            }
          },
          {
            title: 'Tahoe Safe House - Domestic Violence Crisis Center',
            url: 'https://tahoesafehouse.org',
            content: 'Our skilled team is here to provide emergency shelter and supportive services to families and individuals experiencing domestic violence. Call (530) 600-2822',
            score: 0.8674071,
            relevance: 87,
            phone: '530-600-2822',
            cleanName: 'Tahoe Safe House',
            metadata: {
              hasPhone: true,
              contentLength: 157,
              isHighRelevance: true
            }
          },
          {
            title: "Lake Tahoe Women's Shelter",
            url: 'https://laketahoewomensshelter.org',
            content: 'Emergency shelter for women and children fleeing domestic violence. Located in South Lake Tahoe. Phone: 530-555-5678',
            score: 0.6672566,
            relevance: 67,
            phone: '530-555-5678',
            cleanName: "Lake Tahoe Women's Shelter",
            metadata: {
              hasPhone: true,
              contentLength: 116,
              isHighRelevance: false
            }
          }
        ],
        metadata: {
          query: 'find shelters in South Lake Tahoe',
          location: 'South Lake Tahoe',
          searchDepth: 'advanced',
          minScore: 0.6,
          maxResults: 3,
          totalResults: 3,
          filteredResults: 3
        },
        timestamp: expect.any(String)
      });

      expect(
        dvKeywords.some(kw => formatted.results[0].title.toLowerCase().includes(kw) || (formatted.results[0].content || '').toLowerCase().includes(kw))
      ).toBe(true);
    });
  });

  describe('Minimal Format', () => {
    it('should format response in minimal JSON structure', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'minimal', {
        maxResults: 1
      });

      expect(formatted.count).toBe(1);
      expect(formatted.shelters).toHaveLength(1);

      expect(
        dvKeywords.some(kw => formatted.shelters[0].name.toLowerCase().includes(kw) || (formatted.shelters[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });
  });

  describe('Custom Format', () => {
    it('should format response with custom structure', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'custom', {
        structure: {
          status: 'status',
          resources: 'resources',
          includeScore: true,
          includePhone: true,
          includeContent: false
        },
        minScore: 0.6
      });

      expect(formatted.count).toBe(3);
      expect(formatted.resources).toHaveLength(3);
      expect(formatted.resources[0].name).toContain('South Lake Tahoe');
      expect(formatted.resources[1].name).toContain('Tahoe Safe House');
      expect(formatted.resources[2].name).toContain("Women's Shelter");
      expect(
        dvKeywords.some(kw => formatted.resources[0].name.toLowerCase().includes(kw) || (formatted.resources[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });

    it('should format response with content included', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'custom', {
        structure: {
          status: 'status',
          resources: 'resources',
          includeScore: false,
          includePhone: false,
          includeContent: true
        },
        minScore: 0.6
      });

      expect(formatted.count).toBe(3);
      expect(formatted.resources).toHaveLength(3);
      expect(formatted.resources[0].name).toContain('South Lake Tahoe');
      expect(formatted.resources[1].name).toContain('Tahoe Safe House');
      expect(formatted.resources[2].name).toContain("Women's Shelter");
      expect(
        dvKeywords.some(kw => formatted.resources[0].name.toLowerCase().includes(kw) || (formatted.resources[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });

    it('should format response with custom structure and only one result', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'custom', {
        minScore: 0.6,
        maxResults: 1
      });

      expect(formatted).toEqual({
        status: 'success',
        resources: [
          {
            name: 'South Lake Tahoe Domestic Violence Shelter',
            phone: '530-555-1234',
            relevance: 89,
            score: 0.890761,
            url: 'https://www.southlaketahoe-shelter.org',
          }
        ],
        count: 1,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Empty Response Handling', () => {
    it('should handle empty Tavily response', () => {
      const emptyResponse = { results: [] };
      const formatted = ResponseGenerator.formatTavilyResponseCustom(emptyResponse, 'simple');

      expect(formatted).toEqual({
        success: false,
        message: 'No shelters found in that area.',
        count: 0,
        data: [],
        timestamp: expect.any(String),
        query: '',
        location: ''
      });
    });

    it('should handle null Tavily response', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(null, 'detailed');

      expect(formatted).toEqual({
        success: false,
        message: 'No shelters found in that area.',
        count: 0,
        results: [],
        metadata: {
          query: '',
          location: '',
          searchDepth: 'basic',
          minScore: 0.7,
          maxResults: 3,
          totalResults: 0,
          filteredResults: 0
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Filtering Options', () => {
    it('should respect minScore filter', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'simple', {
        minScore: 0.6
      });

      // Only results with score >= 0.6 should be included
      expect(formatted.count).toBe(3);
      expect(formatted.data[0].relevance).toBe(89);

      expect(
        dvKeywords.some(kw => formatted.data[0].name.toLowerCase().includes(kw) || (formatted.data[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });

    it('should respect maxResults limit', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'minimal', {
        maxResults: 1
      });

      expect(formatted.count).toBe(1);
      expect(formatted.shelters).toHaveLength(1);

      expect(
        dvKeywords.some(kw => formatted.shelters[0].name.toLowerCase().includes(kw) || (formatted.shelters[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });
  });
}); 