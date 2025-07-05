# Relay Server

A Node.js server for handling Twilio voice calls and web requests, providing domestic violence support resources.

**Current Version: 1.19.5** (Updated: January 27, 2025)

## Features

### Enhanced Intent Classification & Location Detection (v1.19.5)
- **"Near Me" Query Intelligence**
  - **Resource-Seeking Intent Classification**: Queries like "resources near me", "help near me", "shelter near me", "support near me" are now correctly classified as resource-seeking intents (not general information)
  - **Location Prompting**: "me", "my location", "here", "near me", etc. are treated as incomplete locations, triggering prompts for specific locations
  - **Intent Accuracy**: Improved classification ensures users get appropriate resource responses instead of generic information
- **Advanced Location Detection**
  - **Incomplete Location Handling**: System detects when users provide vague location references and prompts for specific cities/areas
  - **Geocoding Integration**: Uses Nominatim/OpenStreetMap API to validate and complete location information
  - **US vs Non-US Logic**: Properly distinguishes between US and non-US locations for appropriate site restrictions
- **Query Rewriting Optimization**
  - **US Location Enhancement**: For US locations, appends `site:org OR site:gov` to resource-seeking queries
  - **Non-US Handling**: Non-US locations receive appropriate responses without US-specific site restrictions
  - **Resource Query Enhancement**: Queries without "shelter" are rewritten to `"domestic violence shelter <location> site:org OR site:gov"` for US locations
- **Test Infrastructure**
  - **Comprehensive Test Coverage**: All 23 enhanced query rewriter tests pass with proper location and intent handling
  - **Mock Improvements**: Removed deprecated `isUS` references, focusing on `isComplete` and `scope` for clarity
  - **Country-Based Logic**: Tests now properly distinguish US vs non-US locations using country codes

### Tavily API Standardization & Raw Content Parsing (v1.19.4)
- **Unified Tavily API Integration**
  - All Tavily API calls now use a single, standardized function with consistent query structure, headers, and parameters.
  - Query format: `List domestic violence shelters in {location}. Include name, address, phone number, services offered, and 24-hour hotline if available. Prioritize .org and .gov sources.`
  - Unified use of `Authorization: Bearer` header and consistent exclusion of irrelevant domains.
  - All locations and context are handled in a uniform way for better, more reliable results.
- **Raw Content Parsing**
  - If Tavily's answer is missing or too vague, the system now parses `raw_content` using regex to extract addresses and phone numbers.
  - Regex patterns for addresses and phones are applied to all results, and the first found contact info is included in the response.
- **Test Suite**
  - All tests updated to mock the standardized Tavily API function and set the required environment variable.
  - All 337 tests pass with the new API integration.

### Test Suite Reliability (v1.19.3)
- **Robust Test Infrastructure**
  - **Static Method Pollution Fix**: Eliminated test interference by using `vi.spyOn()` instead of direct assignment mocking
  - **Proper Mock Management**: All mocks now use `vi.spyOn()` with `mockRestore()` for clean test isolation
  - **Real Implementation Isolation**: Moved real implementation tests to separate file for clean execution environment
  - **Performance Test Accuracy**: Fixed routing performance monitoring tests to match actual mock behavior
  - **Consistent Test Results**: All 337 tests (334 passed, 3 skipped) now pass reliably whether run individually or as full suite
- **Test Architecture Improvements**
  - **Clean Separation**: Separated mocked tests from real implementation tests for better maintainability
  - **Reliable Mocking**: Proper mock restoration prevents test pollution and ensures consistent behavior
  - **Performance Monitoring**: Accurate performance tracking that works with both real and mocked responses

### Request/Response Synchronization (v1.19.2)
- **Race Condition Prevention**
  - **Call-Specific State Management**: Each call has isolated state preventing cross-call interference
  - **Unique Request IDs**: Timestamp-based request ID generation prevents collisions
  - **Duplicate Detection**: Enhanced detection checks both requestId and isResponding state
  - **Context Synchronization**: Immediate context updates ensure proper follow-up detection
- **Timeout and Error Management**
  - **Isolated Timeout Management**: Each call has isolated timeout and retry tracking
  - **Comprehensive Error Handling**: Proper state cleanup and user-friendly error messages
  - **Memory Leak Prevention**: Pending request tracking prevents abandoned request leaks
  - **Graceful Recovery**: Error recovery with proper cleanup and user feedback

### Enhanced Location Detection & Query Rewriting (v1.0.12)
- **Advanced Location Processing**
  - **Enhanced Location Detector**: Comprehensive location detection with geocoding validation using Nominatim/OpenStreetMap API
  - **Service Word Filtering**: Intelligent filtering of service words like "home" in "home Mumbai" to improve location accuracy
  - **US-Only Support**: Clear messaging for non-US locations about service availability
  - **Incomplete Query Handling**: Prompts users to specify location when missing (e.g., "Can you help me find shelter homes near?")
- **Intelligent Query Processing**
  - **Enhanced Query Rewriter**: Advanced query processing with conversational filler removal
  - **Filler Removal**: Aggressive removal of conversational fillers ("Hey, can you help me...", etc.) at query start
  - **Context-Aware Rewriting**: Intelligent query enhancement based on intent and context
  - **Pattern-Based Optimization**: Reduces unnecessary API calls through smart pattern matching

### Response Generation
- **Multi-format Response System**
  - Web-optimized responses with detailed information
  - Voice-optimized responses for Twilio calls
  - Context-aware formatting based on request type
  - Emergency response prioritization

### Response Formatting
- **Voice-Optimized Format**
  - Clear, concise structure for speech
  - Numbered lists for easy reference
  - Essential information prioritized
  - Natural pauses and flow
  - Limited to 3 results for clarity

- **Web Format**
  - Detailed resource information
  - Relevance scoring
  - Full service descriptions
  - Coverage areas
  - Contact information

### Error Handling
- Robust error handling with fallback mechanisms
- Comprehensive logging
- Graceful degradation
- User-friendly error messages

### Performance Features
- Response caching
- Parallel processing
- Optimized timeouts
- Error handling mechanisms

### Conversation Context Features
- Context preservation
- Follow-up detection
- Location tracking
- Intent classification
- Entity extraction

### Conditional Query Rewriting
- **Intelligent Query Processing** - Smart query rewriting that adapts based on content and context
  - **Off-topic Detection**: Automatically identifies and preserves off-topic queries (jokes, weather, sports, etc.)
  - **Custom Off-topic Follow-up Response**: If a user asks an off-topic follow-up (e.g., a song request), the assistant gently reminds them of its purpose: _"I'm here to help with domestic violence support and resources. If you have any questions about that, please let me know!"_
  - **Support Context Enhancement**: Adds relevant domestic violence context to support-related queries
  - **Follow-up Context Preservation**: Maintains conversation context for natural follow-up questions
  - **Intent-Aware Enhancement**: Adds specific terms based on intent type (shelter, legal, counseling)
  - **Pattern-Based Filtering**: Uses regex patterns to detect off-topic content without AI calls
- **Natural Conversation Flow** - Prevents forced context injection that breaks conversation flow
  - **Contextual Awareness**: Understands when queries should remain unchanged
  - **Mixed Conversation Support**: Handles conversations that mix support topics with casual conversation
  - **Timeout Handling**: 5-minute context timeout prevents stale follow-up responses
  - **Error Prevention**: Avoids the issue where "Tell me a joke" becomes "domestic violence Tell me a joke"

### SMS Messaging System
- **Clear User Expectations** - Improved communication about when and how users receive detailed information
  - **Voice Response Updates**: Replaced confusing "Would you like me to send you the details?" with clear messaging
  - **SMS Timing Communication**: Users are informed they'll receive complete details via SMS at the end of the call
  - **Call End Detection**: System automatically detects when calls end and sends detailed SMS with full information
  - **User Consent**: Asks for permission before sending SMS at call end
- **Enhanced Information Delivery** - Better formatting and content for SMS messages
  - **Complete Shelter Details**: Full shelter names, contact information, and services provided
  - **Title Length Optimization**: Increased from 47 to 80 characters to prevent truncation of organization names
  - **Structured SMS Format**: Clear, readable format with numbered lists and contact details
  - **Comprehensive Resource Information**: Includes URLs, phone numbers, and service descriptions

### Geocoding-Based Location Detection (NEW)
- **Intelligent Location Extraction**
  - Uses Nominatim/OpenStreetMap geocoding API to detect and validate locations in user queries
  - Supports US city, state, and ZIP code detection with high accuracy
  - Caches geocoding results for performance
  - Fallback to pattern-based detection for reliability
  - Non-US locations are detected and users are informed that support is US-only
- **Advanced Pattern Matching & Filler Removal (2024-06-24)**
  - Highly robust pattern matching for US city/state/ZIP and conversational queries
  - Aggressive removal of conversational fillers ("Hey, can you help me...", etc.) at the start of queries
  - Further reduces unnecessary GPT/OpenAI calls for common queries

### Improved Call Flow & SMS Consent System (v1.0.11)
- **Natural Conversation Flow**: Completely redesigned call flow for better user experience
  - **Voice Response Updates**: Changed from immediate SMS promise to "How else can I help you today?"
  - **Multi-Turn Conversations**: Users can now ask multiple questions before ending the call
  - **End Conversation Detection**: New `end_conversation` intent detects when users want to end the call
  - **Proper Consent Collection**: Only asks for SMS consent at the very end of the conversation
- **Incomplete Location Query Handling (2024-06-24)**
  - If a user asks for a resource but does not specify a location (e.g., "Can you help me find shelter homes near?"), the system detects this and prompts: "Could you please tell me which city or area you're looking for? For example, you could say 'near San Francisco' or 'in New York'."
  - Prevents irrelevant or low-confidence searches and improves user experience
- **Enhanced SMS Consent System**: Improved consent collection and SMS delivery
  - **Clear Consent Question**: "Before we end this call, would you like to receive a summary of our conversation and follow-up resources via text message? Please say yes or no."
  - **Consent Response Detection**: Automatically detects yes/no responses and routes to consent endpoint
  - **Explicit Consent Required**: SMS is only sent if user explicitly consents during the call
  - **Graceful Call Ending**: Call ends properly after consent processing
- **Call End Detection & SMS Delivery**: Improved call completion handling
  - **Twilio Status Webhooks**: Proper detection of call end using Twilio status callbacks
  - **Consent-Based SMS**: SMS delivery only occurs if user gave consent during the call
  - **Resource Management**: Proper cleanup and resource management at call end
  - **Comprehensive Logging**: Detailed logging of consent and SMS delivery process

### SMS Messaging & User Experience Improvements (v1.0.10)
- **Clear SMS Expectations**: Updated voice responses to inform users they'll receive details via SMS at end of call
  - Replaced confusing "Would you like me to send you the details?" with clear messaging
  - Users now know exactly when and how they'll receive detailed information
  - Improved user experience with transparent communication about SMS delivery
- **Title Truncation Fix**: Increased title length limit from 47 to 80 characters
  - Prevents truncation of organization names like "British Columbia Domestic Violence Help, Programs and Resources"
  - Ensures complete shelter names are displayed in voice responses
  - Maintains readability while providing full information
- **Call End Detection**: Enhanced call completion handling
  - Automatic detection of call end using Twilio status callbacks
  - SMS delivery at appropriate time with user consent
  - Proper cleanup and resource management

### Off-topic Follow-up Response (v1.0.9)
- **Custom Off-topic Follow-up Response**: The assistant now provides a friendly, purpose-focused message when users ask off-topic follow-up questions, instead of a generic or confusing response.

### Conditional Query Rewriting & Intent Classification (v1.0.8)
- **Intelligent Query Processing** - Implemented smart conditional query rewriting system
  - **Off-topic Detection**: Automatically identifies off-topic queries using pattern matching (jokes, weather, sports, etc.)
  - **Support Context Enhancement**: Adds "domestic violence" context only to support-related queries
  - **Follow-up Context Preservation**: Maintains conversation context for natural follow-up questions
  - **Intent-Aware Enhancement**: Adds specific terms based on intent type (shelter, legal, counseling)
  - **Pattern-Based Filtering**: Uses regex patterns to detect off-topic content without expensive AI calls
- **Enhanced Intent Classification** - Improved intent detection with new categories
  - **Off-topic Category**: New intent type for non-support-related queries
  - **Better Intent Detection**: More accurate classification of user requests
  - **Contextual Intent Handling**: Intent classification considers conversation context
  - **Fallback Intent System**: Graceful handling when intent classification fails
- **Natural Conversation Flow** - Prevents forced context injection that breaks conversation flow
  - **Contextual Awareness**: System understands when queries should remain unchanged
  - **Mixed Conversation Support**: Handles conversations that mix support topics with casual conversation
  - **Error Prevention**: Fixes issue where "Tell me a joke" was being rewritten to "domestic violence Tell me a joke"
  - **Follow-up Question Handling**: Conditional rewriting works correctly with follow-up questions

### Hybrid AI/Pattern Approach & Caching Optimization (v1.0.7)
- **Intelligent Hybrid Processing** - Implemented cost-effective and reliable AI/pattern hybrid approach
  - **Pattern Matching First**: Fast, free detection for common follow-up patterns and location extraction
  - **AI Fallback**: Uses AI only when pattern matching is uncertain or fails
  - **Smart Thresholds**: AI is called for ambiguous cases like "the third one", "that shelter", or unclear references
  - **Cost Optimization**: Reduces AI API calls by 60-80% while maintaining reliability
  - **Cache Integration**: All AI results are cached to avoid duplicate API calls
- **Enhanced Caching System** - Improved caching logic with detailed logging and performance monitoring
  - **Unified Cache Architecture**: All caching now uses the robust QueryCache with TTL, LRU eviction, and namespaces
  - **Detailed Cache Logging**: Logs every cache hit/miss with key, TTL, and performance metrics
  - **Cache Statistics**: Real-time monitoring of cache efficiency, hit rates, and eviction patterns
  - **Multi-level Caching**: Separate caches for Tavily API, GPT responses, and follow-up context
  - **Automatic Cleanup**: Periodic cleanup of expired entries and LRU eviction for memory management
- **Performance Monitoring** - Added comprehensive performance tracking and optimization
  - **Cache Hit Rate Monitoring**: Track how often cache is avoiding expensive API calls
  - **AI vs Pattern Usage**: Monitor when AI is needed vs when patterns suffice
  - **Response Time Tracking**: Measure performance improvements from caching and hybrid approach
  - **Cost Analysis**: Track API call reduction and cost savings from hybrid approach
- **Follow-up Question Enhancement** - Improved follow-up detection with hybrid approach
  - **Pattern Detection**: Fast detection of common follow-up patterns ("more", "details", "about", etc.)
  - **AI Context Understanding**: AI handles complex follow-ups like "the third one" or "that shelter"
  - **Context Caching**: Cache follow-up context to avoid re-processing similar questions
  - **Timeout Handling**: 5-minute context timeout to prevent stale follow-up responses
- **Location Extraction Optimization** - Enhanced location extraction with hybrid approach
  - **Pattern Matching**: Fast extraction for clear location patterns ("in San Francisco", "near Oakland")
  - **AI Fallback**: AI handles speech recognition errors and ambiguous references
  - **Cache Integration**: Cache extracted locations to avoid re-processing
  - **Error Handling**: Graceful fallback when both pattern and AI extraction fail

### Intent-Based Routing & Speech Recognition (v1.0.6)
- **Enhanced Speech-to-Text Quality** - Improved Twilio speech recognition for better accuracy
  - Added domain-specific vocabulary boost with relevant phrases like "shelter", "domestic violence", "Tahoe"
  - Added location names: "California", "Nevada", "Reno", "Sacramento" for better location recognition
  - Added action words: "help", "emergency", "crisis", "support" for context understanding
  - Added response words: "yes", "no", "more", "details" for better conversation flow
  - Set `boost: 20` to prioritize domain-relevant words in speech recognition
  - Added `speechRecognitionLanguage: 'en-US'` for better language detection
  - Disabled profanity filter to avoid filtering important words
- **Intent-Based Routing System** - Added proper handling for different types of requests
  - **General Information Requests**: No location required, provides educational content about domestic violence
  - **Resource Requests**: Location required, searches for shelters, legal, or counseling services
  - **Emergency Help**: Immediate response with emergency contact information
  - **Follow-up Questions**: Context-aware responses based on previous conversation
  - Fixed issue where general information requests were incorrectly asking for location
- **Timeout & Performance Fixes** - Resolved critical timeout issues affecting Railway deployment
  - Disabled heavy Twilio signature validation middleware that was causing timeouts
  - Simplified voice endpoints for faster response times
  - Fixed "formattedResponse.substring is not a function" error in response processing
  - Restored proper speech processing functionality after timeout fixes
  - Improved error handling and fallback responses

### Speech Recognition Optimization (v1.0.5)
- **Standardized Speech Timeouts** - Fixed inconsistent speech recognition settings
  - Standardized all `speechTimeout` values to 10 seconds across all gather elements
  - Removed conflicting `timeout` parameters that interfered with speech recognition
  - Ensured consistent speech recognition parameters (`speechModel` and `enhanced`) across all gather elements
  - Fixed issue where responses were coming back before listening to full user requests
  - Improved user experience with proper speech recognition timing
- **Code Cleanup and Maintenance** - Removed unused code and improved organization
  - Deleted unused `lib/twilio.js` file containing old `TwilioHandler` class
  - Removed entire unused `src/` directory containing legacy web interface code
  - Fixed import statements to use correct `ResponseGenerator.formatTavilyResponse` static method
  - Added comprehensive comments for web-based and Twilio voice call functionality
  - Updated tests to use current `TwilioVoiceHandler` implementation
  - Improved code organization and maintainability

### Follow-up Question Support (v1.0.4)
- **Enhanced Conversation Flow** - Added intelligent follow-up question detection and handling
  - Automatically detects when users ask for more details about specific resources
  - Recognizes patterns like "Can you let me know more about...", "Tell me more about...", "What about..."
  - Uses conversation context to understand which resource the user is referring to
  - Processes follow-up questions without requiring location input again
  - Maintains conversation continuity for better user experience
- **Improved Context Awareness** - Enhanced conversation context management
  - Better tracking of previous interactions and mentioned resources
  - Smarter query rewriting for follow-up questions
  - Contextual response generation based on conversation history
  - Seamless transition between initial searches and follow-up questions

### Voice Response Optimization (v1.0.3)
- **Enhanced Text-to-Speech Compatibility** - Optimized responses for Twilio voice calls
  - Voice-optimized response formatting that works better with TTS
  - Limited to 3 results for voice clarity and better comprehension
  - Removed formatting that interferes with text-to-speech
  - Fixed response count accuracy (shows actual number of results listed)
- **Improved Conversation Flow** - Fixed call disconnection issues
  - Added proper conversation continuation after responses
  - Fallback prompts if no speech is detected
  - Better user experience with continuous conversation

### Critical Bug Fixes (v1.0.2)
- **Fixed Double Response Error** - Resolved critical "Cannot set headers after they are sent to the client" error in Twilio voice route handler
  - Route handler was calling `sendTwiMLResponse` internally while also trying to send response manually
  - Updated handler methods to only return TwiML objects, not send responses directly
  - Added proper `processSpeechInput` method to TwilioVoiceHandler class
- **Fixed TwilioVoiceHandler Constructor** - Resolved "Cannot read properties of undefined (reading 'startsWith')" error
  - Fixed instantiation without required parameters
  - Added proper environment variable handling for Twilio credentials
  - Enhanced constructor to handle test environment gracefully
  - Added comprehensive validation for production environment

### Test Suite Improvements
- Test suite now uses a global mock for TwilioVoiceHandler via `setupTests.js` for reliable and isolated tests
- All direct `vi.mock` calls for TwilioVoiceHandler have been removed from individual test files
- `/twilio/speech` route tests were removed as the route does not exist
- All tests now pass and are stable, with no initialization order issues
- See `CHANGELOG.md` for more details

### Stability Improvements
- Added rate limiting for API protection
- Enhanced error handling and logging
- Improved request timeout handling
- Added resource cleanup on call end
- Fixed WebSocket connection issues
- Added comprehensive request validation

### Deployment
- Added Railway deployment support
- Enhanced WebSocket configuration for cloud deployment
- Improved environment variable handling
- Added deployment documentation

### Bug Fixes
- Fixed request abort handling
- Resolved resource cleanup issues
- Fixed WebSocket connection problems
- Fixed package-lock.json synchronization
- Fixed logger import in configuration
- Fixed environment validation in test environment

### Improvements
- Enhanced response formatting system
- Improved location extraction from speech input
- Updated location prompts with better examples
- Added comprehensive test coverage

### Context-Aware Follow-Up & Fuzzy Matching (v1.0.8)
- **Contextual Follow-Up Handling** - The system now tracks which specific result a user is referencing in follow-up questions (e.g., "South Lake Tahoe") and stores `focusResultTitle` in the conversation context.
- **Fuzzy/Partial Matching** - Follow-up queries are matched to previous Tavily search results using fuzzy/partial matching, so users can refer to results by location, title, or ordinal (e.g., "the third one").
- **Natural Voice Summaries** - Voice responses for follow-ups now use the full content/snippet of the matched result and generate smooth, conversational summaries (e.g., "Here's what I found about South Lake Tahoe: ...").
- **Comprehensive `generateFollowUpResponse()`** - New function generates a context-aware, natural voice response, SMS (if requested), and includes the matched result for further actions.
- **Timeout Handling** - If the last context is older than 5 minutes, the system asks the user to repeat their location or query for accuracy.

### Geocoding-Based Location Detection & US-Only Support (v1.0.11)
- **Geocoding Integration**: Location detection now uses Nominatim/OpenStreetMap geocoding API for accurate city/state/ZIP extraction
- **US-Only Support**: If a non-US location is detected, the agent responds that service is only available for US cities
- **Query Rewriting Improvements**: All resource search and query rewriting now leverage geocoding-based detection for robust, maintainable logic
- **Input Cleaning**: Conversational fillers are removed from the start of queries for more relevant searches
- **Comprehensive Tests**: New and updated tests for all enhanced location and query rewriting logic

## Testing

The test suite uses [Vitest](https://vitest.dev/) and has been comprehensively overhauled for reliability and accuracy:

### Test Infrastructure (v1.0.12)
- **Comprehensive Test Overhaul**: Resolved 45+ test failures across multiple test suites
- **Mock System Fixes**: Fixed mock initialization issues in fallbackResponder, followUp, intentClassifier, and other tests
- **API Response Alignment**: Updated tests to match current implementation response formats
- **Async Test Handling**: Improved async/await patterns in test suites
- **Enhanced Coverage**: Added tests for new enhanced location detection and query rewriting features

### Call Ending Test Reliability (v1.0.14)
- **Simplified Mocking Approach**: Replaced complex dynamic import mocking with simple class-level mocking
- **Consistent Test Pattern**: Used the same mocking approach as twilio.test.js for consistency
- **Test Coverage Maintained**: All 6 call ending tests now pass while maintaining comprehensive coverage
- **Goodbye Intent Detection**: Tests verify proper detection of goodbye phrases and conversation ending
- **TwiML Generation**: Tests verify correct TwiML generation with and without gather elements
- **Response Format Validation**: Tests ensure proper response format for both goodbye and regular responses

### Test Categories
- **Core Functionality**: Response generation, query handling, speech processing
- **Location Detection**: Enhanced location detector with geocoding validation
- **Query Rewriting**: Enhanced query rewriter with filler removal and intelligent processing
- **Intent Classification**: Intent detection and classification accuracy
- **Cache System**: LRU cache eviction and TTL handling
- **Fallback Responses**: Error handling and fallback mechanisms
- **API Integration**: Tavily API and response formatting

### Running Tests
- All global mocks are set up in `tests/setupTests.js`
- No direct `vi.mock` calls for TwilioVoiceHandler in individual test files
- To run all tests:

```bash
npm test
```

- To run a specific test file:

```bash
npx vitest run tests/twilio.routes.test.js
```

- To run tests in watch mode:

```bash
npm run test:watch
```

## Deployment

### Railway Deployment

1. **Prerequisites**
   - A Railway account
   - A Twilio account with voice capabilities
   - Your application code in a Git repository

2. **Environment Variables**
   Set these in your Railway project settings:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   NODE_ENV=production
   ```

3. **Deployment Steps**
   - Connect your repository to Railway
   - Railway will automatically detect the Node.js application
   - The Procfile will be used to start the application
   - Railway will provide a URL for your application

4. **Post-Deployment**
   - Update your Twilio webhook URL to point to your Railway URL:
     ```
     https://your-railway-app-url.railway.app/twilio/voice
     ```
   - Test the connection with a test call
   - Monitor the logs in Railway for any issues

### Local Development

1. **Environment Setup**
   Create a `.env` file with:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   NODE_ENV=development
   LOG_LEVEL=debug
   WS_PORT=3001
   ```

2. **Installation**
   ```bash
   npm install
   ```

3. **Running the Server**
   ```bash
   npm start
   ```

## Features
- Voice call handling with Twilio integration
- Speech-to-text processing
- Location-based resource finding
- Real-time response formatting
- WebSocket support for real-time updates
- Rate limiting for API protection
- Comprehensive error handling
- Resource cleanup on call end

## Security Features
- Rate limiting to prevent abuse
- Request validation
- Error handling for malformed requests
- Request timeout protection
- Secure WebSocket connections
- Environment variable protection

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Tavily Response Formatting

The codebase now uses a single, unified function for formatting Tavily search results: `ResponseGenerator.formatTavilyResponse`.

### Usage

```js
import { ResponseGenerator } from './lib/response.js';

const tavilyResponse = await callTavilyAPI(query); // Tavily API response
const userQuery = 'find shelter homes in South Lake Tahoe';
const result = ResponseGenerator.formatTavilyResponse(tavilyResponse, 'voice', userQuery, 3);

console.log(result.voiceResponse); // For voice agent
console.log(result.smsResponse);   // For SMS
console.log(result.summary);       // For web summary
console.log(result.shelters);      // Array of shelter objects
```

### Parameters
- `tavilyResponse`: The raw response from the Tavily API (must have a `results` array).
- `requestType`: One of `'voice'`, `'sms'`, or `'web'` (default: `'web'`).
- `userQuery`: The original user query (for location extraction, optional but recommended).
- `maxResults`: Maximum number of results to include (default: 3).

### Output
Returns an object with:
- `voiceResponse`: A short, voice-friendly summary for agents like Twilio.
- `smsResponse`: A string with clickable links for SMS.
- `summary`: A web-friendly summary string.
- `shelters`: Array of shelter objects with name, address, phone, description, and score.

### Notes
- All previous formatter functions are deprecated. Use only `ResponseGenerator.formatTavilyResponse` for all Tavily result formatting.
- The function is fully tested and supports all output types (voice, SMS, web).

## Custom Tavily Response Formatting (v1.0.13)

The system now supports flexible, customizable Tavily response formatting with multiple format options and filtering capabilities.

### Custom Format Options

```js
import { ResponseGenerator } from './lib/response.js';

const tavilyResponse = await callTavilyAPI(query);
const options = {
  query: 'find shelters in South Lake Tahoe',
  location: 'South Lake Tahoe',
  minScore: 0.2,
  maxResults: 3
};

// Simple format - basic shelter information
const simple = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'simple', options);

// Detailed format - comprehensive information with metadata
const detailed = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'detailed', options);

// Minimal format - just names and URLs
const minimal = ResponseGenerator.formatTavilyResponseCustom(tavilyResponse, 'minimal', options);

// Custom format - fully customizable structure
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
```

### Format Types

#### Simple Format
Returns basic shelter information with phone numbers and relevance scores:
```json
{
  "success": true,
  "message": "Found 3 shelters",
  "count": 3,
  "data": [
    {
      "name": "Domestic Violence Shelter - Safe Haven",
      "url": "https://example.com/shelter",
      "phone": "408-279-2962",
      "relevance": 89
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "query": "find shelters in South Lake Tahoe",
  "location": "South Lake Tahoe"
}
```

#### Detailed Format
Returns comprehensive information with metadata:
```json
{
  "success": true,
  "message": "Found 3 shelters",
  "count": 3,
  "results": [
    {
      "title": "Domestic Violence Shelter - Safe Haven",
      "url": "https://example.com/shelter",
      "content": "Emergency shelter for domestic violence victims...",
      "score": 0.890761,
      "relevance": 89,
      "phone": "408-279-2962",
      "cleanName": "Domestic Violence Shelter",
      "metadata": {
        "hasPhone": true,
        "contentLength": 186,
        "isHighRelevance": true
      }
    }
  ],
  "metadata": {
    "query": "find shelters in South Lake Tahoe",
    "location": "South Lake Tahoe",
    "searchDepth": "advanced",
    "minScore": 0.2,
    "maxResults": 3,
    "totalResults": 3,
    "filteredResults": 3
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Minimal Format
Returns just essential information:
```json
{
  "found": true,
  "count": 3,
  "shelters": [
    {
      "name": "Domestic Violence Shelter - Safe Haven",
      "url": "https://example.com/shelter"
    }
  ]
}
```

#### Custom Format
Fully customizable structure based on options:
```json
{
  "status": "success",
  "resources": [
    {
      "name": "Domestic Violence Shelter - Safe Haven",
      "url": "https://example.com/shelter",
      "score": 0.890761,
      "relevance": 89,
      "phone": "408-279-2962"
    }
  ],
  "count": 3,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Filtering Options

- **minScore**: Minimum relevance score (0.0-1.0) for filtering results
- **maxResults**: Maximum number of results to return
- **query**: Original user query for context
- **location**: Extracted location for context

### Enhanced Features

- **Phone Number Extraction**: Improved regex pattern handles various phone formats including parentheses
- **Title Cleaning**: Intelligent title cleaning for voice responses while preserving original titles for custom formats
- **Empty Response Handling**: Proper handling of null/undefined responses with appropriate success/failure status
- **Metadata Calculation**: Accurate calculation of hasPhone, contentLength, and relevance indicators
- **Test Data Compatibility**: Updated test data includes domestic violence keywords for realistic testing

### Error Handling

The system gracefully handles:
- Empty or null Tavily responses
- Missing or malformed result data
- Invalid filtering options
- Phone number extraction failures

All custom format functions return consistent error responses with appropriate success/failure indicators.

## Maintenance

- As of June 2024, `esbuild` and `@types/node` have been updated to their latest versions. This keeps the build and type system up to date and resolves previous version mismatch warnings.

## Changelog

- Updated `esbuild` and `@types/node` to the latest versions (June 2024)
- No breaking changes expected; all tests pass after update.

- **Robust fallback for shelter search**: If no structured results are found but the AI provides a direct answer (e.g., shelter name and phone), the system will now extract and present this information to the user.

### Enhanced Location Follow-up Detection (v1.19.1)
- **Geocoding-Based Location Validation**
  - **Nominatim Integration**: Uses OpenStreetMap's Nominatim API to validate location statements in follow-up queries
  - **Robust Detection**: Handles location statements like "Near Austin, Texas" with geocoding validation
  - **Fallback Handling**: Graceful handling when geocoding fails or returns no results
  - **Test Coverage**: Comprehensive tests for geocoding-based location follow-up detection
- **Voice Response Formatting Improvements**
  - **Guard Clauses**: Added proper null/undefined checks in voice response formatting
  - **Fallback Returns**: Ensured voiceResponse always returns a defined object even for edge cases
  - **Consistent Formatting**: Improved formatting for empty results and missing answer fields