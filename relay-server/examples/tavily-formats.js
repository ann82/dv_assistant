import { ResponseGenerator } from '../lib/response.js';

// Example Tavily response (this would normally come from the Tavily API)
const exampleTavilyResponse = {
  query: "domestic violence shelters South Lake Tahoe California",
  results: [
    {
      title: "THE BEST 10 HOMELESS SHELTERS in SOUTH LAKE TAHOE, CA - Yelp",
      url: "https://www.yelp.com/search?cflt=homelessshelters&find_loc=South+Lake+Tahoe,+CA",
      content: "Best Homeless Shelters in South Lake Tahoe, CA - Volunteers of America Mens Shelter, Focus Homeless Shelter. Phone: 408-279-2962",
      score: 0.890761,
      raw_content: null
    },
    {
      title: "South Lake Tahoe, CA Homeless Shelters",
      url: "https://www.homelessshelterdirectory.org/city/ca-south_lake_tahoe",
      content: "Below are all of the homeless shelters and services for the needy that provide help to those in need for South Lake Tahoe, CA and surrounding cities.",
      score: 0.8674071,
      raw_content: null
    },
    {
      title: "Services - Tahoe Coalition for the Homeless",
      url: "https://tahoehomeless.org/services/",
      content: "Our skilled team is here to provide a range of supportive services to families and individuals experiencing or at risk of homelessness. Call (530) 600-2822",
      score: 0.6672566,
      raw_content: null
    }
  ],
  response_time: 1.94
};

console.log('=== TAVILY RESPONSE FORMAT EXAMPLES ===\n');

// 1. Simple Format
console.log('1. SIMPLE FORMAT:');
const simpleFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'simple', {
  query: 'find shelters in South Lake Tahoe',
  location: 'South Lake Tahoe'
});
console.log(JSON.stringify(simpleFormat, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 2. Detailed Format
console.log('2. DETAILED FORMAT:');
const detailedFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'detailed', {
  query: 'find shelters in South Lake Tahoe',
  location: 'South Lake Tahoe',
  searchDepth: 'advanced',
  minScore: 0.2,
  maxResults: 3
});
console.log(JSON.stringify(detailedFormat, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 3. Minimal Format
console.log('3. MINIMAL FORMAT:');
const minimalFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'minimal');
console.log(JSON.stringify(minimalFormat, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 4. Custom Format - API-like structure
console.log('4. CUSTOM FORMAT (API-like):');
const customFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'custom', {
  structure: {
    status: 'status',
    resources: 'data',
    includeScore: true,
    includePhone: true,
    includeContent: false
  }
});
console.log(JSON.stringify(customFormat, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 5. Custom Format - With descriptions
console.log('5. CUSTOM FORMAT (with descriptions):');
const customWithContent = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'custom', {
  structure: {
    status: 'status',
    resources: 'resources',
    includeScore: false,
    includePhone: false,
    includeContent: true
  }
});
console.log(JSON.stringify(customWithContent, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 6. Filtered results (high relevance only)
console.log('6. FILTERED RESULTS (high relevance only):');
const filteredFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'simple', {
  minScore: 0.8,
  maxResults: 2
});
console.log(JSON.stringify(filteredFormat, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 7. Empty response handling
console.log('7. EMPTY RESPONSE HANDLING:');
const emptyFormat = ResponseGenerator.formatTavilyResponseCustom({ results: [] }, 'simple');
console.log(JSON.stringify(emptyFormat, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// 8. Current default format (for comparison)
console.log('8. CURRENT DEFAULT FORMAT:');
const defaultFormat = ResponseGenerator.formatTavilyResponse(exampleTavilyResponse, 'web', 'find shelters in South Lake Tahoe', 3);
console.log(JSON.stringify(defaultFormat, null, 2));

console.log('\n=== USAGE EXAMPLES ===\n');

console.log('To use these formats in your code:');
console.log(`
// Simple format for basic applications
const simple = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'simple', {
  query: 'user query',
  location: 'extracted location'
});

// Detailed format for analytics and debugging
const detailed = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'detailed', {
  query: 'user query',
  location: 'extracted location',
  searchDepth: 'advanced',
  minScore: 0.2,
  maxResults: 5
});

// Minimal format for lightweight applications
const minimal = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'minimal');

// Custom format for specific API requirements
const custom = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'custom', {
  structure: {
    status: 'status',
    resources: 'data',
    includeScore: true,
    includePhone: true,
    includeContent: false
  }
});

// Filtered results for high-quality responses
const filtered = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'simple', {
  minScore: 0.8,
  maxResults: 3
});
`); 