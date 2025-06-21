import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';

describe('Tavily Response Formatting', () => {
  it('should format response with resources', () => {
    const response = {
      results: [
        { title: 'Shelter Resource 1', content: 'Some content', url: 'http://example.com/1' },
        { title: 'Shelter Resource 2', content: 'Some content', url: 'http://example.com/2' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(response, 'web', '', 3);
    expect(formatted.summary).toContain('I found 2 shelters');
    expect(formatted.shelters).toHaveLength(2);
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
        { title: 'Shelter A', content: 'Some content', url: 'http://example.com/a' },
        { title: 'Shelter B', content: 'Some content', url: 'http://example.com/b' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.summary).toContain('I found 2 shelters');
    expect(formatted.shelters).toHaveLength(2);
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
        { title: 'Shelter A', content: 'Some content', url: 'http://example.com/a' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters[0].phone).toBe('Not available');
  });

  it('should handle malformed results', () => {
    const mockResponse = {
      results: [
        { title: null, content: null, url: 'http://example.com/a' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters).toHaveLength(1);
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
        { title: 'Organization A Shelter', content: 'Some content', url: 'http://example.com/a' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters[0].name).toBe('Organization A Shelter');
  });

  it('should handle results with different phone number formats', () => {
    const mockResponse = {
      results: [
        { title: 'Emergency Shelter', content: 'Phone: 408-279-2962', url: 'http://example.com/a' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters[0].phone).toBe('408-279-2962');
  });

  it('should handle results with different coverage area formats', () => {
    const mockResponse = {
      results: [
        { title: 'Emergency Shelter', content: 'Coverage: Santa Clara County', url: 'http://example.com/a' }
      ]
    };
    const formatted = ResponseGenerator.formatTavilyResponse(mockResponse, 'web', '', 3);
    expect(formatted.shelters[0].name).toBe('Emergency Shelter');
  });
}); 