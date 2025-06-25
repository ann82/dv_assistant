import { describe, it, expect } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';

describe('Custom Tavily Response Formats', () => {
  const mockTavilyResponse = {
    query: "domestic violence shelters South Lake Tahoe California",
    results: [
      {
        title: "Domestic Violence Shelter - THE BEST 10 HOMELESS SHELTERS in SOUTH LAKE TAHOE, CA - Yelp",
        url: "https://www.yelp.com/search?cflt=homelessshelters&find_loc=South+Lake+Tahoe,+CA",
        content: "Best Domestic Violence Shelters in South Lake Tahoe, CA - Volunteers of America Mens Shelter, Focus Homeless Shelter. Emergency shelter for domestic violence victims. Phone: 408-279-2962",
        score: 0.890761,
        raw_content: null
      },
      {
        title: "Domestic Violence Crisis Center - South Lake Tahoe, CA Homeless Shelters",
        url: "https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe",
        content: "Below are all of the domestic violence shelters and crisis services for the needy that provide help to those in need for South Lake Tahoe, CA and surrounding cities. Emergency shelter for abuse victims.",
        score: 0.8674071,
        raw_content: null
      },
      {
        title: "Domestic Violence Services - Tahoe Coalition for the Homeless",
        url: "https://tahoehomeless.org/services/",
        content: "Our skilled team is here to provide a range of supportive services to families and individuals experiencing domestic violence or at risk of homelessness. Emergency shelter for abuse survivors. Call (530) 600-2822",
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
        minScore: 0.2
      });

      expect(formatted).toEqual({
        success: true,
        message: 'Found 2 shelters',
        count: 2,
        data: [
          {
            name: 'Domestic Violence Crisis Center - South Lake Tahoe, CA Homeless Shelters',
            url: 'https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe',
            phone: 'Not available',
            relevance: 87
          },
          {
            name: 'Domestic Violence Services - Tahoe Coalition for the Homeless',
            url: 'https://tahoehomeless.org/services/',
            phone: '530-600-2822',
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
      expect(
        dvKeywords.some(kw => formatted.data[1].name.toLowerCase().includes(kw) || (formatted.data[1].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });
  });

  describe('Detailed Format', () => {
    it('should format response in detailed JSON structure', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'detailed', {
        query: 'find shelters in South Lake Tahoe',
        location: 'South Lake Tahoe',
        searchDepth: 'advanced',
        minScore: 0.2,
        maxResults: 3
      });

      expect(formatted).toEqual({
        success: true,
        message: 'Found 2 shelters',
        count: 2,
        results: [
          {
            title: 'Domestic Violence Crisis Center - South Lake Tahoe, CA Homeless Shelters',
            url: 'https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe',
            content: 'Below are all of the domestic violence shelters and crisis services for the needy that provide help to those in need for South Lake Tahoe, CA and surrounding cities. Emergency shelter for abuse victims.',
            score: 0.8674071,
            relevance: 87,
            phone: 'Not available',
            cleanName: 'Domestic Violence Crisis Center',
            metadata: {
              hasPhone: false,
              contentLength: 202,
              isHighRelevance: true
            }
          },
          {
            title: 'Domestic Violence Services - Tahoe Coalition for the Homeless',
            url: 'https://tahoehomeless.org/services/',
            content: 'Our skilled team is here to provide a range of supportive services to families and individuals experiencing domestic violence or at risk of homelessness. Emergency shelter for abuse survivors. Call (530) 600-2822',
            score: 0.6672566,
            relevance: 67,
            phone: '530-600-2822',
            cleanName: 'Domestic Violence Services',
            metadata: {
              hasPhone: true,
              contentLength: 212,
              isHighRelevance: false
            }
          }
        ],
        metadata: {
          query: 'find shelters in South Lake Tahoe',
          location: 'South Lake Tahoe',
          searchDepth: 'advanced',
          minScore: 0.2,
          maxResults: 3,
          totalResults: 2,
          filteredResults: 2
        },
        timestamp: expect.any(String)
      });

      expect(
        dvKeywords.some(kw => formatted.results[0].title.toLowerCase().includes(kw) || (formatted.results[0].content || '').toLowerCase().includes(kw))
      ).toBe(true);
      expect(
        dvKeywords.some(kw => formatted.results[1].title.toLowerCase().includes(kw) || (formatted.results[1].content || '').toLowerCase().includes(kw))
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
        minScore: 0.2
      });

      expect(formatted.count).toBe(2);
      expect(formatted.resources).toHaveLength(2);
      expect(formatted.resources[0].name).toContain('Domestic Violence Crisis Center');
      expect(
        dvKeywords.some(kw => formatted.resources[0].name.toLowerCase().includes(kw) || (formatted.resources[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
      expect(
        dvKeywords.some(kw => formatted.resources[1].name.toLowerCase().includes(kw) || (formatted.resources[1].description || '').toLowerCase().includes(kw))
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
        minScore: 0.2
      });

      expect(formatted.count).toBe(2);
      expect(formatted.resources).toHaveLength(2);
      expect(formatted.resources[0].name).toContain('Domestic Violence Crisis Center');
      expect(
        dvKeywords.some(kw => formatted.resources[0].name.toLowerCase().includes(kw) || (formatted.resources[0].description || '').toLowerCase().includes(kw))
      ).toBe(true);
      expect(
        dvKeywords.some(kw => formatted.resources[1].name.toLowerCase().includes(kw) || (formatted.resources[1].description || '').toLowerCase().includes(kw))
      ).toBe(true);
    });

    it('should format response with custom structure and only one result', () => {
      const formatted = ResponseGenerator.formatTavilyResponseCustom(mockTavilyResponse, 'custom', {
        minScore: 0.2,
        maxResults: 1
      });

      expect(formatted).toEqual({
        status: 'success',
        resources: [
          {
            name: 'Domestic Violence Crisis Center - South Lake Tahoe, CA Homeless Shelters',
            phone: 'Not available',
            relevance: 87,
            score: 0.8674071,
            url: 'https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe',
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
        minScore: 0.8
      });

      // Only results with score >= 0.8 should be included
      expect(formatted.count).toBe(1);
      expect(formatted.data[0].relevance).toBe(87);

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