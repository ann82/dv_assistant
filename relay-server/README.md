# Relay Server

A Node.js server for handling Twilio voice calls and web requests, providing domestic violence support resources.

## Features

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

The test suite uses [Vitest](https://vitest.dev/) and is configured for reliability and isolation:

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

## Maintenance

- As of June 2024, `esbuild` and `@types/node` have been updated to their latest versions. This keeps the build and type system up to date and resolves previous version mismatch warnings.

## Changelog

- Updated `esbuild` and `@types/node` to the latest versions (June 2024)
- No breaking changes expected; all tests pass after update.