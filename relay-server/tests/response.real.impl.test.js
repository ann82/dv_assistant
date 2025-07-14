import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseGenerator } from '../lib/response.js';
import { removeSSML } from '../lib/ssmlTemplates.js';

describe('ResponseGenerator (real formatTavilyResponse implementation)', () => {
  beforeEach(async () => {
    // Always restore the real implementation before each test in this block
    const { ResponseGenerator: OriginalResponseGenerator } = await import('../lib/response.js');
    ResponseGenerator.formatTavilyResponse = OriginalResponseGenerator.formatTavilyResponse;
  });

  it('should handle empty results but useful answer field', () => {
    const tavilyResponse = {
      query: "domestic violence shelter Hey, can you find shelters near San Jose?",
      answer: "In San Jose, the Women's Crisis Shelter provides support for domestic violence victims. They operate on a nonprofit basis. Contact them at 408-280-8800 for assistance.",
      results: [],
      response_time: 13.49
    };

    const formatted = ResponseGenerator.formatTavilyResponse(tavilyResponse, 'twilio', 'find shelters in San Jose');

    expect(formatted).toBeDefined();
    expect(formatted.voiceResponse).toBeDefined();
    expect(removeSSML(formatted.voiceResponse)).toContain("The Women's Crisis Shelter is located at");
    expect(formatted.voiceResponse).toContain("408-280-8800");
    expect(formatted.smsResponse).toContain("408-280-8800");
    expect(formatted.shelters).toHaveLength(1);
    expect(formatted.shelters[0].name).toBe("Women's Crisis Shelter");
    expect(formatted.shelters[0].phone).toBe("408-280-8800");
    expect(formatted.shelters[0].score).toBe(0.8);
  });

  it('should handle empty results and empty answer field', () => {
    const tavilyResponse = {
      query: "domestic violence shelter in unknown location",
      answer: "",
      results: [],
      response_time: 5.2
    };

    const formatted = ResponseGenerator.formatTavilyResponse(tavilyResponse, 'twilio', 'find shelters in unknown location');

    expect(formatted).toBeDefined();
    expect(formatted.voiceResponse).toBeDefined();
    expect(removeSSML(formatted.voiceResponse)).toContain("I searched for resources in unknown location, but I couldn't find any shelters");
    expect(formatted.shelters).toHaveLength(0);
  });
}); 