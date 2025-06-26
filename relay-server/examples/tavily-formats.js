import { ResponseGenerator } from '../lib/response.js';
import logger from '../lib/logger.js';

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

logger.info('=== TAVILY RESPONSE FORMAT EXAMPLES ===');

// 1. Simple Format
logger.info('1. SIMPLE FORMAT:');
const simpleFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'simple', {
  query: 'find shelters in South Lake Tahoe',
  location: 'South Lake Tahoe'
});
logger.info('Simple format result:', simpleFormat);

// 2. Detailed Format
logger.info('2. DETAILED FORMAT:');
const detailedFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'detailed', {
  query: 'find shelters in South Lake Tahoe',
  location: 'South Lake Tahoe',
  searchDepth: 'advanced',
  minScore: 0.2,
  maxResults: 3
});
logger.info('Detailed format result:', detailedFormat);

// 3. Minimal Format
logger.info('3. MINIMAL FORMAT:');
const minimalFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'minimal');
logger.info('Minimal format result:', minimalFormat);

// 4. Custom Format - API-like structure
logger.info('4. CUSTOM FORMAT (API-like):');
const customFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'custom', {
  structure: {
    status: 'status',
    resources: 'data',
    includeScore: true,
    includePhone: true,
    includeContent: false
  }
});
logger.info('Custom format result:', customFormat);

// 5. Custom Format - With descriptions
logger.info('5. CUSTOM FORMAT (with descriptions):');
const customWithContent = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'custom', {
  structure: {
    status: 'status',
    resources: 'resources',
    includeScore: false,
    includePhone: false,
    includeContent: true
  }
});
logger.info('Custom with content result:', customWithContent);

// 6. Filtered results (high relevance only)
logger.info('6. FILTERED RESULTS (high relevance only):');
const filteredFormat = ResponseGenerator.formatTavilyResponseCustom(exampleTavilyResponse, 'simple', {
  minScore: 0.8,
  maxResults: 2
});
logger.info('Filtered format result:', filteredFormat);

// 7. Empty response handling
logger.info('7. EMPTY RESPONSE HANDLING:');
const emptyFormat = ResponseGenerator.formatTavilyResponseCustom({ results: [] }, 'simple');
logger.info('Empty format result:', emptyFormat);

// 8. Current default format (for comparison)
logger.info('8. CURRENT DEFAULT FORMAT:');
const defaultFormat = ResponseGenerator.formatTavilyResponse(exampleTavilyResponse, 'web', 'find shelters in South Lake Tahoe', 3);
logger.info('Default format result:', defaultFormat);

logger.info('=== USAGE EXAMPLES ===');

logger.info('To use these formats in your code:', {
  examples: {
    simple: 'ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, "simple", { query: "user query", location: "extracted location" })',
    detailed: 'ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, "detailed", { query: "user query", location: "extracted location", searchDepth: "advanced", minScore: 0.2, maxResults: 5 })',
    minimal: 'ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, "minimal")',
    custom: 'ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, "custom", { structure: { status: "status", resources: "data", includeScore: true, includePhone: true, includeContent: false } })',
    filtered: 'ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, "simple", { minScore: 0.8, maxResults: 3 })'
  }
}); 