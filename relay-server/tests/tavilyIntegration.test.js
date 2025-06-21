import { EnhancedTavilyService, exampleUsage } from '../lib/tavilyIntegration.js';
import { vi } from 'vitest';

// Mock Tavily response for testing
const mockTavilyResponse = {
  "query": "domestic violence shelters South Lake Tahoe California",
  "results": [
    {
      "title": "THE BEST 10 HOMELESS SHELTERS in SOUTH LAKE TAHOE, CA - Yelp",
      "url": "https://www.yelp.com/search?cflt=homelessshelters&find_loc=South+Lake+Tahoe,+CA",
      "content": "Best Homeless Shelters in South Lake Tahoe, CA - Volunteers of America Mens Shelter, Focus Homeless Shelter, Lodi House, Union Gospel Mission, Bobby Mello Opportunity House, Stockton Shelter For the Homeless, Modesto Gospel Mission, Berkeley Food & Housing Project, Cindy Maple Foothill House Of Hospitality, Gospel Center Rescue Mission",
      "score": 0.890761
    },
    {
      "title": "South Lake Tahoe, CA Homeless Shelters",
      "url": "https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe",
      "content": "Below are all of the homeless shelters and services for the needy that provide help to those in need for South Lake Tahoe, CA and surrounding cities. We also provide other homeless resources such as transitional resources and services that help the needy.",
      "score": 0.8674071
    },
    {
      "title": "Services - Tahoe Coalition for the Homeless",
      "url": "https://tahoehomeless.org/services/",
      "content": "Our skilled team is here to provide a range of supportive services to families and individuals experiencing or at risk of homelessness, in the South Lake Tahoe area and across El Dorado County. Please fill out the form below to begin the process of gaining assistance. You may also call (530) 600-2822 or email [email protected]",
      "score": 0.6672566
    }
  ],
  "response_time": 1.94
};

describe('Enhanced Tavily Integration', () => {
  let tavilyService;

  beforeEach(() => {
    tavilyService = new EnhancedTavilyService();
    
    // Mock the callTavilyAPI method to return our test data
    tavilyService.callTavilyAPI = vi.fn().mockResolvedValue(mockTavilyResponse);
  });

  test('should process Tavily response and return voice and SMS responses', async () => {
    const userQuery = "find shelter homes in South Lake Tahoe";
    const searchQuery = "domestic violence shelters South Lake Tahoe California";
    
    const result = await tavilyService.searchShelters(searchQuery, userQuery, 3);

    console.log('\n=== ENHANCED TAVILY INTEGRATION TEST ===');
    console.log('Voice Response:', result.voiceResponse);
    console.log('\nSMS Response:');
    console.log(result.smsResponse);
    console.log('\n========================================\n');

    // Verify the response structure
    expect(result).toHaveProperty('voiceResponse');
    expect(result).toHaveProperty('smsResponse');
    expect(result).toHaveProperty('rawResponse');
    expect(result).toHaveProperty('topResults');
    
    // Verify the content
    expect(result.voiceResponse).toContain('South Lake Tahoe');
    expect(result.voiceResponse).toContain('shelters');
    expect(result.smsResponse).toContain('Shelters in South Lake Tahoe:');
    expect(result.smsResponse).toContain('https://www.yelp.com');
    expect(result.smsResponse).toContain('1-800-799-7233');
    
    // Verify top results
    expect(result.topResults).toHaveLength(3);
    expect(result.topResults[0].score).toBe(0.890761);
  });

  test('should return only voice response', async () => {
    const userQuery = "find shelter homes in South Lake Tahoe";
    const searchQuery = "domestic violence shelters South Lake Tahoe California";
    
    const voiceResponse = await tavilyService.getVoiceResponse(searchQuery, userQuery, 2);
    
    expect(typeof voiceResponse).toBe('string');
    expect(voiceResponse).toContain('South Lake Tahoe');
    expect(voiceResponse).toContain('shelters');
  });

  test('should return only SMS response', async () => {
    const userQuery = "find shelter homes in South Lake Tahoe";
    const searchQuery = "domestic violence shelters South Lake Tahoe California";
    
    const smsResponse = await tavilyService.getSMSResponse(searchQuery, userQuery, 2);
    
    expect(typeof smsResponse).toBe('string');
    expect(smsResponse).toContain('Shelters in South Lake Tahoe:');
    expect(smsResponse).toContain('https://');
    expect(smsResponse).toContain('1-800-799-7233');
  });

  test('should get detailed information about a result', () => {
    const result = mockTavilyResponse.results[0];
    const details = tavilyService.getResultDetails(result);
    
    expect(details).toHaveProperty('title');
    expect(details).toHaveProperty('url');
    expect(details).toHaveProperty('score');
    expect(details).toHaveProperty('content');
    expect(details).toHaveProperty('phoneNumbers');
    expect(details).toHaveProperty('address');
    
    console.log('\n=== RESULT DETAILS ===');
    console.log('Title:', details.title);
    console.log('URL:', details.url);
    console.log('Score:', details.score);
    console.log('Phone Numbers:', details.phoneNumbers);
    console.log('Address:', details.address);
    console.log('=====================\n');
  });

  test('should handle errors gracefully', async () => {
    // Mock an error
    tavilyService.callTavilyAPI = vi.fn().mockRejectedValue(new Error('API Error'));
    
    const result = await tavilyService.searchShelters('test query', 'test user query');
    
    expect(result.voiceResponse).toContain('encountered an error');
    expect(result.smsResponse).toContain('Error processing shelter search');
    expect(result.rawResponse).toBeNull();
    expect(result.topResults).toEqual([]);
  });

  test('should respect maxResults parameter', async () => {
    const userQuery = "find shelter homes in South Lake Tahoe";
    const searchQuery = "domestic violence shelters South Lake Tahoe California";
    
    const result1 = await tavilyService.searchShelters(searchQuery, userQuery, 1);
    const result2 = await tavilyService.searchShelters(searchQuery, userQuery, 2);
    
    expect(result1.topResults).toHaveLength(1);
    expect(result2.topResults).toHaveLength(2);
  });
}); 