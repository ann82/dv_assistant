import { describe, it, expect } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';

describe('Improved Tavily Response Filtering', () => {
  const mockGenericResults = {
    results: [
      {
        title: "Resource Guide",
        url: "https://www.quesnel.ca/our-community/community-resources/resource-guide",
        content: "The Quesnel Resource Guide gives the public access to easily finding employment, skills training, community and social services, financial help, and mental health resources.",
        score: 0.6599319
      },
      {
        title: "Resource Guide",
        url: "https://www.oshawa.ca/en/city-hall/resource-guide.aspx",
        content: "This Resource Guide includes links and information on community services and resources.",
        score: 0.340398
      },
      {
        title: "Resources & Tools for City Employees",
        url: "https://www.toronto.ca/city-government/accessibility-human-rights/domestic-and-intimate-partner-violence/resources-and-tools-for-city-employees/",
        content: "Resources for city employees dealing with domestic violence issues.",
        score: 0.2615388
      }
    ]
  };

  const mockGoodResults = {
    results: [
      {
        title: "Domestic Violence Shelter - Safe Haven",
        url: "https://safehaven.org/shelter",
        content: "Safe Haven provides emergency shelter for domestic violence victims and survivors. We offer 24/7 crisis intervention, counseling services, and safety planning.",
        score: 0.890761
      },
      {
        title: "Women's Crisis Center - Emergency Shelter",
        url: "https://womenscrisiscenter.org/shelter",
        content: "Our domestic violence shelter provides safe housing, counseling, legal advocacy, and support services for women and children escaping abuse.",
        score: 0.8674071
      },
      {
        title: "Family Justice Center - Domestic Violence Services",
        url: "https://familyjusticecenter.org/services",
        content: "We provide comprehensive domestic violence services including emergency shelter, legal assistance, counseling, and victim advocacy.",
        score: 0.6672566
      }
    ]
  };

  const mockMixedResults = {
    results: [
      {
        title: "Domestic Violence Shelter - Safe Haven",
        url: "https://safehaven.org/shelter",
        content: "Safe Haven provides emergency shelter for domestic violence victims and survivors. We offer 24/7 crisis intervention, counseling services, and safety planning.",
        score: 0.890761
      },
      {
        title: "Resource Guide",
        url: "https://www.quesnel.ca/our-community/community-resources/resource-guide",
        content: "The Quesnel Resource Guide gives the public access to easily finding employment, skills training, community and social services, financial help, and mental health resources.",
        score: 0.6599319
      },
      {
        title: "Women's Crisis Center - Emergency Shelter",
        url: "https://womenscrisiscenter.org/shelter",
        content: "Our domestic violence shelter provides safe housing, counseling, legal advocacy, and support services for women and children escaping abuse.",
        score: 0.8674071
      }
    ]
  };

  const dvKeywords = ['domestic', 'violence', 'abuse', 'shelter', 'crisis', 'center', 'safe house'];

  describe('Filtering Generic Resource Guides', () => {
    it('should filter out generic resource guides', () => {
      const mockResponse = {
        results: [
          {
            title: 'Resource Guide - City of Quesnel',
            content: 'General resource guide for quesnel residents',
            url: 'https://example.com/guide',
            score: 0.8
          },
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

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
      
      expect(formatted.shelters).toHaveLength(2);
      expect(formatted.voiceResponse).toContain("I found 2 shelters");

      formatted.shelters.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });

    it('should include only relevant domestic violence shelters', () => {
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
          },
          {
            title: 'Domestic Violence Shelter - Family Justice Center',
            content: 'Family justice center for domestic violence cases',
            url: 'https://example.com/justice',
            score: 0.8
          }
        ]
      };

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
      
      expect(formatted.shelters).toHaveLength(3);
      expect(formatted.voiceResponse).toContain("I found 3 shelters");
      expect(formatted.shelters[0].name).toContain("Domestic Violence Shelter");
      expect(formatted.shelters[1].name).toContain("Domestic Violence Shelter");
      expect(formatted.shelters[2].name).toContain("Domestic Violence Shelter");

      formatted.shelters.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });

    it('should filter mixed results correctly', () => {
      const mockResponse = {
        results: [
          {
            title: 'Resource Guide - City of Oshawa',
            content: 'General resource guide for oshawa residents',
            url: 'https://example.com/guide',
            score: 0.8
          },
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

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
      
      expect(formatted.shelters).toHaveLength(2);
      expect(formatted.voiceResponse).toContain("I found 2 shelters");
      expect(formatted.shelters[0].name).toContain("Domestic Violence Shelter");
      expect(formatted.shelters[1].name).toContain("Domestic Violence Shelter");

      formatted.shelters.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });
  });

  describe('Score Threshold Filtering', () => {
    it('should filter out low-scoring results', () => {
      const mockResponse = {
        results: [
          {
            title: 'Domestic Violence Shelter - Low Score',
            content: 'Low scoring shelter result',
            url: 'https://example.com/low',
            score: 0.3
          },
          {
            title: 'Domestic Violence Shelter - High Score',
            content: 'High scoring shelter result',
            url: 'https://example.com/high',
            score: 0.9
          }
        ]
      };

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
      
      expect(formatted.shelters).toHaveLength(1);
      expect(formatted.shelters[0].name).toContain("Domestic Violence Shelter");

      formatted.shelters.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });
  });

  describe('Domain Filtering', () => {
    it('should filter out excluded domains', () => {
      const mockResponse = {
        results: [
          {
            title: 'Domestic Violence Shelter - Yelp',
            content: 'Shelter listed on yelp',
            url: 'https://yelp.com/shelter',
            score: 0.8
          },
          {
            title: 'Domestic Violence Shelter - Legitimate',
            content: 'Legitimate shelter website',
            url: 'https://legitimate.org/shelter',
            score: 0.9
          }
        ]
      };

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
      
      expect(formatted.shelters).toHaveLength(1);
      expect(formatted.shelters[0].name).toContain("Domestic Violence Shelter");

      formatted.shelters.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });
  });

  describe('Keyword Filtering', () => {
    it('should require both DV keywords and shelter keywords', () => {
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

      const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
      
      expect(formatted.shelters).toHaveLength(2);
      expect(formatted.shelters[0].name).toContain("Domestic Violence Shelter");
      expect(formatted.shelters[1].name).toContain("Domestic Violence Shelter");
    });
  });

  describe('Custom Format with Improved Filtering', () => {
    it('should apply same filtering to custom formats', () => {
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
          },
          {
            title: 'Domestic Violence Shelter - Family Justice Center',
            content: 'Family justice center for domestic violence cases',
            url: 'https://example.com/justice',
            score: 0.8
          }
        ]
      };

      const simpleFormat = ResponseGenerator.formatTavilyResponseCustom(mockResponse, 'simple', { minScore: 0.2 });
      
      expect(simpleFormat.count).toBe(3);
      expect(simpleFormat.data).toHaveLength(3);
      expect(simpleFormat.data[0].name).toContain("Domestic Violence Shelter");
      expect(simpleFormat.data[1].name).toContain("Domestic Violence Shelter");
      expect(simpleFormat.data[2].name).toContain("Domestic Violence Shelter");
    });

    it('should respect custom filtering options', () => {
      const customFiltered = ResponseGenerator.formatTavilyResponseCustom(mockMixedResults, 'simple', {
        minScore: 0.7, // Higher threshold
        maxResults: 1
      });
      
      // Should have only 1 shelter due to maxResults limit
      expect(customFiltered.count).toBe(1);
      expect(customFiltered.data).toHaveLength(1);
      expect(customFiltered.data[0].name).toContain("Domestic Violence Shelter"); // Highest score

      customFiltered.data.forEach(shelter => {
        expect(
          dvKeywords.some(kw => shelter.name.toLowerCase().includes(kw) || (shelter.description || '').toLowerCase().includes(kw))
        ).toBe(true);
      });
    });
  });
}); 