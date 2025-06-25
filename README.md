# Domestic Violence Support Assistant

A real-time voice-based assistant designed to provide immediate support and information to individuals affected by domestic violence. The system uses Twilio for voice communication and OpenAI for intelligent query handling.

## Features

- Real-time voice communication using Twilio
- Intelligent query handling with OpenAI
- WebSocket server for real-time updates
- Comprehensive logging system
- Error handling and monitoring
- Test suite for all components (100% green, 304 tests)
- Cost logging for API usage tracking
- Health check endpoint for monitoring
- Enhanced logging and debugging capabilities
- Robust filtering, caching, and response formatting logic
- Customizable Tavily response formatting with required fields always present
- **Improved Railway deployment with enhanced startup script and error handling**

## Intent Classification and Off-Topic Detection

The assistant uses a robust intent classification system:

- **On-topic detection:** Only queries containing domestic violence-related keywords (e.g., shelter, abuse, legal, counseling, protection, etc.) are considered on-topic and classified into specific support intents (find_shelter, legal_services, counseling_services, etc.).
- **Off-topic detection:** All other queries (including medical, entertainment, weather, sports, jokes, and general help requests without context) are automatically classified as `off_topic`.
- **Fallback logic:** If the OpenAI API is unavailable, a pattern-matching fallback classifier is used, ensuring reliability.
- **Comprehensive test coverage:** The system includes tests for medical, entertainment, and generic queries to ensure only relevant queries are handled as on-topic.

See the test suite and intentClassifier.js for details.

## Railway Deployment

The system is optimized for Railway deployment with enhanced error handling and startup procedures:

- **Smart Startup Script**: Validates all required environment variables before starting
- **Enhanced Error Handling**: Clear error messages for missing configuration
- **Health Check Endpoint**: Built-in health monitoring at `/health`
- **Graceful Shutdown**: Proper handling of SIGTERM and SIGINT signals
- **Comprehensive Logging**: Detailed startup and runtime logging

### Required Environment Variables for Railway

- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `TAVILY_API_KEY` - Your Tavily API key
- `OPENAI_API_KEY` - Your OpenAI API key

See `RAILWAY_DEPLOYMENT.md` for detailed deployment instructions and troubleshooting.

## Enhanced Logging and Debugging

The system includes comprehensive logging throughout the request-response lifecycle:

- **Request Tracking**: Each request is assigned a unique ID for tracking
- **Parameter Validation**: Detailed logging of required parameters
- **Processing Time**: Tracking of processing time at each step
- **Error Handling**: Enhanced error logging with stack traces
- **Response Logging**: TwiML response logging before sending

### Logging Levels

- **INFO**: Normal operation logs
- **ERROR**: Error and exception logs
- **DEBUG**: Detailed debugging information

### Debugging Tips

1. Check the logs for the request ID to track a specific call
2. Look for processing time spikes
3. Monitor parameter validation errors
4. Check TwiML response formatting
5. Review error responses and stack traces

## Recent Changes

- **Railway deployment improvements**: Enhanced startup script with environment variable validation and better error handling
- **Fixed TypeScript build issues**: Removed unnecessary TypeScript compilation from JavaScript project
- **Improved deployment configuration**: Updated Railway configuration for proper directory handling
- **All tests now pass (100% green, 304 tests)**
- **Custom Tavily response formatting always includes required fields**: status, resources, count, and timestamp are always present in custom format output
- **Filtering, caching, and response formatting logic are robust and fully covered by tests**
- **Enhanced error handling, edge case handling, and test reliability**
- See CHANGELOG for details on the latest fixes and improvements
- **Fixed bug where voice response would say 'undefined and undefined' if no shelters were found. Now, a clear message is given when no results pass the Tavily score threshold.**
- **Clarified Tavily score threshold:** Only results with a score >= 0.2 are included in responses by default. If you want to include more results, you can lower this threshold in the code.
- **Enhanced AI Model Confidence Score Logging:** Added comprehensive logging of AI model confidence scores for intent classification, including confidence levels (High/Medium/Low), response times, and token usage metrics.
- **Improved Conversation Management:** Added intelligent conversation flow management for off-topic intents with graceful re-engagement and conversation closure capabilities.
- **Enhanced Error Handling:** Added fallback intent classification using pattern matching when OpenAI API is unavailable, ensuring system reliability.
- **Custom Tavily Response Formatting (v1.0.13):** New flexible formatting system with multiple format options (simple, detailed, minimal, custom) for different use cases. Enhanced phone number extraction, title cleaning, and metadata calculation with comprehensive test coverage.
- **Updated test expectations and logic for consistency**
- **Defensive type checking and logging for rewritten queries before Tavily API calls to prevent invalid query errors (422 Unprocessable Entity)**
- **Improved error handling and logging for Tavily API integration**
- **Updated enhanced query rewriter and location detector logic for better test consistency and robustness**
- **Fixed test mocks and edge cases for query rewriting and location extraction**
- **Updated test suite for more robust edge case handling**
- **Updated test suite for more robust edge case handling**
- **Updated deployment configuration**
- **Improved conversational filler removal: Now removes all consecutive leading fillers, including those with punctuation, and is consistent across modules**
- **Location extraction now consistently returns lowercase locations to match test expectations**
- **Enhanced query rewriting uses the improved filler removal and location extraction logic**
- **Fixed async handling and response formatting in query handler and speech processor**
- **Simplified module imports using index.js**
- **Updated package.json with proper module exports**
- **Removed unnecessary build step from deployment**
- **Improved conversational filler removal: Now removes all consecutive leading fillers, including those with punctuation, and is consistent across modules**
- **Location extraction now consistently returns lowercase locations to match test expectations**
- **Enhanced query rewriting uses the improved filler removal and location extraction logic**
- **Fixed async handling and response formatting in query handler and speech processor**
- **Updated test expectations and logic for consistency**
- **Defensive type checking and logging for rewritten queries before Tavily API calls to prevent invalid query errors (422 Unprocessable Entity)**
- **Improved error handling and logging for Tavily API integration**
- **Updated enhanced query rewriter and location detector logic for better test consistency and robustness**
- **Fixed test mocks and edge cases for query rewriting and location extraction**
- **Updated test suite for more robust edge case handling**
- **Fixed bug where voice response would say 'undefined and undefined' if no shelters were found. Now, a clear message is given when no results pass the Tavily score threshold.**
- **Clarified Tavily score threshold:** Only results with a score >= 0.2 are included in responses by default. If you want to include more results, you can lower this threshold in the code.
- **Enhanced AI Model Confidence Score Logging:** Added comprehensive logging of AI model confidence scores for intent classification, including confidence levels (High/Medium/Low), response times, and token usage metrics.
- **Improved Conversation Management:** Added intelligent conversation flow management for off-topic intents with graceful re-engagement and conversation closure capabilities.
- **Enhanced Error Handling:** Added fallback intent classification using pattern matching when OpenAI API is unavailable, ensuring system reliability.
- **Custom Tavily Response Formatting (v1.0.13):** New flexible formatting system with multiple format options (simple, detailed, minimal, custom) for different use cases. Enhanced phone number extraction, title cleaning, and metadata calculation with comprehensive test coverage.
- **See CHANGELOG for more details**
- **Simplified intent classification and off-topic detection:** Only queries with domestic violence-related keywords are considered on-topic; all others are classified as off-topic. This approach is robust, easier to maintain, and fully covered by tests.
- **Improved follow-up question handling:** The system now correctly interprets queries like "tell me more about the last one" or "the first one", mapping them to the correct Tavily result and providing detailed information from the content. Fully covered by tests.

## Custom Tavily Response Formatting

The system now supports flexible, customizable Tavily response formatting with multiple format options and filtering capabilities.

### Format Types

- **Simple Format**: Basic shelter information with phone numbers and relevance scores
- **Detailed Format**: Comprehensive information with metadata and search context
- **Minimal Format**: Just essential information (names and URLs)
- **Custom Format**: Fully customizable structure based on configuration options; always includes status, resources, count, and timestamp

### Key Features

- **Enhanced Phone Number Extraction**: Improved regex pattern handles various phone formats including parentheses
- **Intelligent Title Cleaning**: Smart title processing for voice responses while preserving original titles
- **Metadata Calculation**: Accurate calculation of hasPhone, contentLength, and relevance indicators
- **Flexible Filtering**: Configurable score thresholds and result limits
- **Error Handling**: Graceful handling of null/undefined responses and malformed data
- **Required Fields**: Custom format always includes status, resources, count, and timestamp

### Usage Example

```js
import { ResponseGenerator } from './lib/response.js';

const options = {
  query: 'find shelters in South Lake Tahoe',
  location: 'South Lake Tahoe',
  minScore: 0.2,
  maxResults: 3
};

// Simple format
const simple = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'simple', options);

// Custom format with specific structure
const custom = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'custom', {
  structure: {
    status: 'status',
    resources: 'resources',
    includeScore: true,
    includePhone: true,
    includeContent: false
  },
  minScore: 0.2
});
// Output will always include status, resources, count, and timestamp
```

See the relay-server README for detailed documentation and examples.

## Installation

1. Clone the repository:
```