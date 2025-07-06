import { processTavilyResponse, getResultDetails } from '../lib/tavilyProcessor.js';

// Example Tavily response from user
const exampleTavilyResponse = {
  "query": "find shelter homes in south lake tahoe",
  "follow_up_questions": null,
  "answer": null,
  "images": [],
  "results": [
    {
      "title": "THE BEST 10 HOMELESS SHELTERS in SOUTH LAKE TAHOE, CA - Yelp",
      "url": "https://www.yelp.com/search?cflt=homelessshelters&find_loc=South+Lake+Tahoe,+CA",
      "content": "Best Homeless Shelters in South Lake Tahoe, CA - Volunteers of America Mens Shelter, Focus Homeless Shelter, Lodi House, Union Gospel Mission, Bobby Mello Opportunity House, Stockton Shelter For the Homeless, Modesto Gospel Mission, Berkeley Food & Housing Project, Cindy Maple Foothill House Of Hospitality, Gospel Center Rescue Mission",
      "score": 0.890761,
      "raw_content": null
    },
    {
      "title": "South Lake Tahoe, CA Homeless Shelters",
      "url": "https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe",
      "content": "Below are all of the homeless shelters and services for the needy that provide help to those in need for South Lake Tahoe, CA and surrounding cities. We also provide other homeless resources such as transitional resources and services that help the needy.",
      "score": 0.8674071,
      "raw_content": null
    },
    {
      "title": "Best 5 Shelters in South Lake Tahoe, CA with Reviews - The Real Yellow ...",
      "url": "https://www.yellowpages.com/south-lake-tahoe-ca/shelters",
      "content": "Places Near South Lake Tahoe, CA with Shelters. Stateline Ca (1 miles) Stateline (5 miles) Zephyr Cove (8 miles) Meyers (11 miles) Echo Lake (12 miles) Genoa (14 miles) More Types of Community Services in South Lake Tahoe Rubbish Removal Dumps Landfills Libraries Public Transportation Probation Services Snow Removal Service Social Security Services",
      "score": 0.81979275,
      "raw_content": null
    },
    {
      "title": "temporary shelter programs in South Lake Tahoe, ca | findhelp.org",
      "url": "https://www.findhelp.org/housing/temporary-shelter--south-lake-tahoe-ca",
      "content": "temporary shelter programs and help in South Lake Tahoe, ca. Search 9 social services programs to assist you.",
      "score": 0.7443038,
      "raw_content": null
    },
    {
      "title": "Services - Tahoe Coalition for the Homeless",
      "url": "https://tahoehomeless.org/services/",
      "content": "Our skilled team is here to provide a range of supportive services to families and individuals experiencing or at risk of homelessness, in the South Lake Tahoe area and across El Dorado County. Please fill out the form below to begin the process of gaining assistance. You may also call (530) 600-2822 or email [email protected]",
      "score": 0.6672566,
      "raw_content": null
    }
  ],
  "response_time": 1.94
};

describe('Tavily Processor', () => {
  test('should process Tavily response and create voice and SMS responses', () => {
    const userQuery = "find shelter homes in South Lake Tahoe";
    const result = processTavilyResponse(exampleTavilyResponse, userQuery, 3);

    

    // Verify the response structure
    expect(result).toHaveProperty('voiceResponse');
    expect(result).toHaveProperty('smsResponse');
    expect(typeof result.voiceResponse).toBe('string');
    expect(typeof result.smsResponse).toBe('string');

    // Verify voice response contains expected content
    expect(result.voiceResponse).toContain('South Lake Tahoe');
    expect(result.voiceResponse).toContain('shelters');
    expect(result.voiceResponse).toContain('How else can I help you today?');

    // Verify SMS response contains expected content
    expect(result.smsResponse).toContain('Shelters in South Lake Tahoe:');
    expect(result.smsResponse).toContain('https://www.yelp.com');
    expect(result.smsResponse).toContain('https://www.homelessshelterdirectory.org');
    expect(result.smsResponse).toContain('https://www.yellowpages.com');
    expect(result.smsResponse).toContain('1-800-799-7233');
  });

  test('should handle empty results gracefully', () => {
    const emptyResponse = {
      query: "find shelters in nowhere",
      results: [],
      response_time: 0.5
    };

    const result = processTavilyResponse(emptyResponse, "find shelters in nowhere");
    
    expect(result.voiceResponse).toContain("couldn't find any shelters");
    expect(result.smsResponse).toContain("No shelters found");
    expect(result.smsResponse).toContain("1-800-799-7233");
  });

  test('should handle invalid input gracefully', () => {
    const result = processTavilyResponse(null, "test query");
    
    expect(result.voiceResponse).toContain("couldn't find any shelters");
    expect(result.smsResponse).toContain("No shelters found");
  });

  test('should extract location from various query formats', () => {
    const testCases = [
      { query: "find shelters in New York", expected: "New York" },
      { query: "shelters near Los Angeles, CA", expected: "Los Angeles, CA" },
      { query: "domestic violence shelters around Chicago", expected: "Chicago" },
      { query: "help at Miami, FL", expected: "Miami, FL" },
      { query: "just shelters", expected: "" }
    ];

    testCases.forEach(({ query, expected }) => {
      const result = processTavilyResponse(exampleTavilyResponse, query);
      if (expected) {
        expect(result.voiceResponse).toContain(expected);
        expect(result.smsResponse).toContain(expected);
      }
    });
  });

  test('should get detailed information about a specific result', () => {
    const result = exampleTavilyResponse.results[0];
    const details = getResultDetails(result);

    expect(details).toHaveProperty('title');
    expect(details).toHaveProperty('url');
    expect(details).toHaveProperty('score');
    expect(details).toHaveProperty('content');
    expect(details).toHaveProperty('phoneNumbers');
    expect(details).toHaveProperty('address');

    
  });

  test('should limit results to specified maximum', () => {
    const result1 = processTavilyResponse(exampleTavilyResponse, "test query", 1);
    const result2 = processTavilyResponse(exampleTavilyResponse, "test query", 2);
    const result3 = processTavilyResponse(exampleTavilyResponse, "test query", 3);

    // Count URLs in SMS response to determine number of results
    const countUrls = (smsResponse) => {
      const urlMatches = smsResponse.match(/https?:\/\/[^\s\n]+/g);
      return urlMatches ? urlMatches.length : 0;
    };

    expect(countUrls(result1.smsResponse)).toBe(1);
    expect(countUrls(result2.smsResponse)).toBe(2);
    expect(countUrls(result3.smsResponse)).toBe(3);
  });
}); 