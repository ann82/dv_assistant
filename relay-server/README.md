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

## Recent Updates

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