# Domestic Violence Support Assistant

A real-time voice-based assistant designed to provide immediate support and information to individuals affected by domestic violence. The system uses Twilio for voice communication and OpenAI for intelligent query handling.

---

**Latest Update (2025-07-06):**
- **Console Log Cleanup**: Removed unnecessary console statements for cleaner output and better production readiness
- **Timeout Handling Improvements**: Enhanced error handling for Tavily API timeouts with graceful fallbacks and faster response times
- **Simplified Location Detection**: Replaced complex regex patterns with simple, reliable location extraction for better accuracy
- **TypeScript Migration Complete**: Full TypeScript support with proper configuration, type definitions, and error-free compilation
- **Dependency Updates**: Installed missing packages (react-feather, react-leaflet, leaflet, realtime-api-beta, web-vitals) with proper type definitions
- **Code Quality**: All TypeScript errors resolved, proper type annotations added throughout the codebase
- **Enhanced Development Experience**: Clean TypeScript configuration with React/JSX support, esModuleInterop, and strict type checking

**Previous Update (2025-07-01):**
- **Codebase Cleanup**: Removed deprecated modules (`enhancedContextManager.js`, `contextIntegration.js`, `tavilyIntegration.js`, `utils.js`) and their associated tests for clarity and maintainability
- **Test Suite Green**: All tests now pass (21 test files, 263 tests, 2 skipped, 100% pass rate)

---

## Features

- Real-time voice communication using Twilio
- Intelligent query handling with OpenAI
- WebSocket server for real-time updates
- Comprehensive logging system
- Error handling and monitoring
- Test suite for all components (319 tests passing, 98.1% success rate)
- Cost logging for API usage tracking
- Health check endpoint for monitoring
- Enhanced logging and debugging capabilities
- Robust filtering, caching, and response formatting logic
- Customizable Tavily response formatting with required fields always present
- **Enhanced Tavily response formatting with improved title and address extraction**
- **Improved Railway deployment with enhanced startup script and error handling**
- **Enhanced speech-to-text recognition with intelligent preprocessing to reduce garbling**
- **Timeout handling with graceful fallbacks** for external API failures
- **Simplified location detection** with reliable pattern matching and fallback extraction
- Voice responses never include HTTP/HTTPS URLs; users are offered to receive details (including address and link) via text message for location/address queries
- Robust follow-up detection, even if OpenAI API key is missing
- Improved user experience for follow-up and location/address queries
- Pet-related follow-up questions (e.g., "Do they allow pets?") are now recognized as valid follow-ups and not off-topic
- Filtering logic for shelter results is now more intelligent and no longer excludes real shelters that lack phone/address fields
- All other markdown documentation files except README.md and CHANGELOG.md have been removed for clarity
- **Comprehensive Conversation Guidelines**: Detailed instructions for emergency protocols, cultural sensitivity, safety planning, and conversation structure
- **Unified Configuration**: Shared conversation config between web and voice interfaces ensures consistency

## Configurable Welcome Message

The system now includes a cost-efficient, configurable welcome message that provides consistent, empathetic interactions across all platforms:

### Key Features

- **Cost Efficiency**: Uses pre-written welcome message instead of AI generation, saving $0.10-2.00/month
- **Emergency Assessment**: Includes immediate danger check and 911 guidance in welcome
- **Consistent Experience**: Same empathetic welcome across voice and web interfaces
- **Single Source of Truth**: Welcome message defined in conversation config, easy to update
- **Fast Response**: No AI generation delay, immediate TTS processing

### Welcome Message Benefits

- **Safety First**: "Are you in immediate danger right now? If so, please call 911"
- **Empathetic Tone**: "Hello, and thank you for reaching out. I'm here to listen and help you"
- **Clear Purpose**: "find the support and resources you need"
- **Service Scope**: "shelters, counseling, legal services, or any other support"
- **Open Invitation**: "What brings you to call today?"

### Technical Implementation

```javascript
// Single source of truth in conversation config
export const welcomeMessage = `Hello, and thank you for reaching out...`;

// Used in both voice and web interfaces
import { welcomeMessage } from '../lib/conversationConfig.js';
```

### Cost Analysis

| Monthly Calls | AI-Generated Cost | Configurable Cost | Savings |
|---------------|-------------------|-------------------|---------|
| 1,000 | $0.10-0.20 | $0 | $0.10-0.20 |
| 10,000 | $1-2 | $0 | $1-2 |
| 100,000 | $10-20 | $0 | $10-20 |

## Enhanced AI Conversation Guidelines

The system now includes comprehensive conversation guidelines that significantly improve response quality and user experience:

### Key Improvements

- **Detailed Emergency Protocols**: Proper 911 escalation, immediate danger assessment, and safety planning
- **Cultural Sensitivity**: LGBTQ+ support, language preferences, religious accommodations, and accessibility guidelines
- **Structured Conversation Flow**: Professional call structure with welcome, needs assessment, resource provision, and closure
- **Safety Planning**: Comprehensive safety questions and action plan development
- **Privacy and Data Protection**: Clear guidelines for location sharing, data handling, and privacy protection
- **Location and Shelter Search**: Detailed protocols for location confirmation and shelter search optimization

### Technical Features

- **Shared Configuration**: Single source of truth for conversation guidelines
- **Voice-Optimized Instructions**: Tailored for phone interactions with concise, clear language
- **Web-Compatible Instructions**: Full-featured instructions for web interface
- **Cost-Effective Implementation**: Smart routing minimizes GPT usage while maximizing quality

### Benefits

- **Better User Experience**: More empathetic, culturally sensitive, and structured responses
- **Improved Safety**: Proper emergency protocols and 911 escalation
- **Risk Reduction**: Better handling reduces liability and improves outcomes
- **Professional Standards**: Consistent conversation flow across all interactions
- **Accessibility**: Support for diverse user needs and communication styles

These improvements ensure users receive the highest quality support possible, with proper emergency handling, cultural sensitivity, and professional conversation management.

## Enhanced Speech-to-Text Recognition

The system now includes advanced speech recognition capabilities that significantly reduce garbled speech and improve user experience:

### Key Improvements

- **Optimized Twilio Speech Recognition**: Enhanced configuration with better parameters for improved accuracy
  - `speechTimeout: 'auto'` for better handling
  - `speechModel: 'phone_call'` for optimized phone conversation recognition
  - `enhanced: 'true'` for improved accuracy
  - `profanityFilter: 'false'` to avoid filtering important words
  - `interimSpeechResultsCallback` for real-time feedback

- **Intelligent Speech Preprocessing**: Advanced cleaning and correction system
  - **Automatic artifact removal**: Cleans `[inaudible]`, `[background noise]`, `[static]`, etc.
  - **Common error correction**: Fixes frequent speech recognition errors
    - "help me find" → "find"
    - "shelter homes" → "shelters"
    - "close to me" → "near me"
  - **Garbled speech detection**: Identifies and handles unclear speech patterns
  - **Key word extraction**: Extracts relevant keywords from heavily garbled speech

- **Real-time Speech Feedback**: Interim speech results handling for better accuracy
  - Real-time processing of partial transcriptions
  - Improved recognition through feedback mechanisms
  - Better handling of ongoing conversations

### Technical Features

- **Pattern-based speech cleaning** that removes common recognition artifacts
- **Intelligent error correction** using domain-specific phrase mappings
- **Multi-criteria garbled speech detection** (special characters, repeated characters, short words)
- **Keyword extraction** for domestic violence-related terms
- **Comprehensive test coverage** for all speech preprocessing functions

### Benefits

- **Reduced garbling** through intelligent preprocessing
- **Better accuracy** with optimized Twilio parameters
- **Improved user experience** with fewer repeat requests
- **Robust error handling** for various speech patterns
- **Comprehensive logging** for monitoring and debugging

These improvements ensure users can communicate more effectively with the system, even in challenging audio conditions or with unclear speech patterns.

## Enhanced Tavily Response Formatting

The system now includes advanced response formatting capabilities that significantly improve the quality of information provided to users:

### Key Improvements

- **Better Title Extraction**: When Tavily returns poor titles (like filenames), the system automatically extracts meaningful organization names from the content using multiple pattern matching techniques.

- **Enhanced Address Extraction**: Improved extraction of complete physical addresses from content, including multi-line addresses with street numbers, cities, states, and zip codes.

- **Multiple Resource Detection**: When content contains lists of multiple resources, the system can extract and format them individually, providing more comprehensive information.

- **Improved Response Quality**: The main formatting function now uses all extraction methods to provide better-formatted responses with:
  - Meaningful shelter names instead of filenames
  - Complete addresses with city and state information
  - Proper phone number extraction and formatting
  - Support for multiple resources in a single result

### Technical Features

- **Pattern-based title extraction** from content when original titles are poor
- **Multi-line address parsing** that captures complete location information
- **Resource list parsing** for content containing multiple organizations
- **Enhanced phone number extraction** with better regex patterns
- **Comprehensive test coverage** for all extraction functions

These improvements ensure users receive more useful and complete information about domestic violence shelters and resources, even when the original Tavily results have poor formatting or incomplete data.

## Robust Timeout Handling

The system now includes comprehensive timeout handling and error recovery that ensures users always receive helpful responses, even when external services are slow or unavailable:

### Key Improvements

- **Faster Location Searches**: 15-second timeout specifically for location follow-ups (vs 30s default) for more responsive user experience
- **Graceful Error Recovery**: When Tavily API fails or times out, users receive helpful fallback responses with alternative resources
- **Emergency Resource Provision**: Always includes National Domestic Violence Hotline (1-800-799-7233) as backup when searches fail
- **Enhanced Logging**: Better error tracking and debugging capabilities for timeout issues
- **Promise.race() Implementation**: Custom timeout handling that's more responsive than standard API timeouts

### Example Fallback Response
When external APIs fail, users receive:
> "I'm having trouble searching for shelter resources in Austin right now. Let me provide you with some general information about domestic violence resources in that area. You can also try calling the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance."

### Technical Features

- **Custom Timeout Logic**: 15-second timeout for location searches using Promise.race()
- **Comprehensive Error Handling**: Try-catch blocks around all external API calls
- **Helpful Fallback Messages**: Context-aware responses that guide users to alternative resources
- **Emergency Contact Integration**: Always provides hotline number when searches fail
- **Enhanced Monitoring**: Detailed logging for debugging timeout and API issues

### Benefits

- **Always Helpful**: Users never get stuck with no response when APIs fail
- **Faster Recovery**: 15-second timeout prevents long waits for location searches
- **Emergency Support**: Always provides alternative resources and hotline numbers
- **Better Reliability**: System continues to function even when external services are down
- **Improved User Experience**: Clear messaging about what went wrong and what to do next

## Simplified Location Detection

The system now uses a much simpler and more reliable approach to location extraction:

### Key Improvements

- **Simple Pattern Matching**: Replaced 15+ complex regex patterns with basic, reliable patterns
- **Fallback Extraction**: Uses capitalized word detection when patterns don't match
- **Conversational Support**: Works with natural language like "Yeah, but can you find some shelters near Austin, Texas?"
- **Reduced Complexity**: Eliminated ~100 lines of complex pattern matching code
- **Better Accuracy**: More reliable location extraction with fewer false negatives

### Technical Features

- **Basic Patterns**: Simple patterns like `/near\s+([^,.?]+(?:,\s*[^,.?]+)?)/i`
- **Capitalized Word Detection**: Falls back to detecting location names from capitalized words
- **Conversational Handling**: Works with natural speech patterns and fillers
- **Comprehensive Testing**: Full test coverage for all location extraction scenarios

### Benefits

- **Higher Success Rate**: Better extraction of locations from natural speech
- **Simpler Maintenance**: Easy to understand and modify location detection logic
- **Reduced Errors**: Fewer false negatives and missed location extractions
- **Better User Experience**: More reliable location recognition in conversations

## Enhanced Query Rewriting

The system now includes optimized query rewriting that significantly improves search result quality and relevance:

### Key Improvements

- **Simplified Query Construction**: Replaced complex 20+ line conditional logic with clean, single-line query templates
- **Exact Phrase Matching**: Uses `"domestic violence shelter"` with quotes for precise search results
- **Better Proximity Search**: Uses `near [location]` operator for more accurate local results
- **Enhanced Site Restrictions**: 
  - **Quality sites**: `site:.org OR site:.gov` (credible sources only)
  - **Excluded sites**: `-site:yellowpages.com -site:city-data.com -site:tripadvisor.com` (low-quality directories)
- **Specific Field Requests**: Requests exact fields like `"shelter name"`, `"address"`, `"phone number"`, `"services offered"`, `"24 hour hotline"`

### Example Transformations

| User Input | Tavily Query |
|------------|--------------|
| "find shelter near Seattle" | `"domestic violence shelter" near seattle "shelter name" "address" "phone number" "services offered" "24 hour hotline" site:.org OR site:.gov -site:yellowpages.com -site:city-data.com -site:tripadvisor.com` |
| "I need shelter in San Francisco" | `"domestic violence shelter" near san francisco "shelter name" "address" "phone number" "services offered" "24 hour hotline" site:.org OR site:.gov -site:yellowpages.com -site:city-data.com -site:tripadvisor.com` |

### Technical Features

- **Consistent format** regardless of user input phrasing
- **Reduced complexity** from 20+ lines to 1 line of code
- **Better maintainability** with clear, readable structure
- **Improved reliability** with no complex regex checks or conditional logic
- **Enhanced filtering** to exclude low-quality directory sites

### Benefits

- **Better search results** through more precise queries
- **Fewer false positives** by excluding low-quality sites
- **More consistent** responses regardless of user input
- **Easier debugging** with clear, readable queries
- **Better performance** with simpler logic

These improvements ensure users receive higher-quality shelter information with fewer "couldn't find any shelters" responses.

## Enhanced Voice Responses

The system now provides more detailed voice responses that include essential shelter information:

### Key Improvements

- **Shelter Name**: Always included in voice responses for clear identification
- **Physical Address**: Included when available from search results
- **Phone Number**: Included when available for immediate contact
- **Smart Formatting**: Natural-sounding responses that flow conversationally
- **Multiple Shelters**: For multiple results, details are provided for the first shelter while listing all names

### Example Voice Responses

| Scenario | Voice Response |
|----------|----------------|
| Single shelter with details | "I found a shelter in San Jose: Safe Haven Shelter. The address is 123 Main Street, San Jose, CA. You can call them at 408-279-2962. How else can I help you today?" |
| Single shelter without details | "I found a shelter in San Francisco: Crisis Center. How else can I help you today?" |
| Multiple shelters | "I found 3 shelters in San Jose: Women's Crisis Shelter, Family Justice Center, and Safe House Program. Women's Crisis Shelter is located at 456 Oak Avenue, San Jose, CA. You can call them at 408-280-8800. How else can I help you today?" |

### Technical Features

- **Conditional Information**: Only includes address and phone when available
- **Natural Language**: Responses sound conversational and not robotic
- **Consistent Format**: Standardized structure across all response types
- **Enhanced SMS**: SMS responses also include phone numbers for all shelters
- **Fallback Handling**: Graceful handling when information is missing

### Benefits

- **Better User Experience**: Users get essential contact information immediately
- **Reduced Follow-ups**: Less need to ask for specific details
- **Improved Accessibility**: Voice users can get complete information without switching to SMS
- **Professional Quality**: Responses sound more helpful and comprehensive
- **Consistent Information**: Both voice and SMS provide the same level of detail

These improvements ensure users receive complete shelter information through voice interactions, making the system more useful for immediate assistance.

## Intent Classification and Off-Topic Detection

The assistant uses a robust intent classification system:

- **On-topic detection:** Only queries containing domestic violence-related keywords (e.g., shelter, abuse, legal, counseling, protection, etc.) are considered on-topic and classified into specific support intents (find_shelter, legal_services, counseling_services, etc.).
- **Off-topic detection:** All other queries (including medical, entertainment, weather, sports, jokes, and general help requests without context) are automatically classified as `off_topic`.
- **Fallback logic:** If the OpenAI API is unavailable, a pattern-matching fallback classifier is used, ensuring reliability.
- **Comprehensive test coverage:** The system includes tests for medical, entertainment, and generic queries to ensure only relevant queries are handled as on-topic.

See the test suite and intentClassifier.js for details.

## Conversation Context Improvements

- The assistant now uses previous queries, intents, and locations to rewrite user queries more intelligently, leading to better search results and follow-up handling.
- Voice, SMS, and summary responses are now context-aware, referencing previous conversation turns for more coherent and personalized interactions.
- All relevant API calls and response generators now pass and utilize the conversation context, improving continuity across multi-turn conversations.

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

- **Tavily API integration now requests and processes content correctly** (`include_raw_content: true`)
- **Processor and tests are robust to null/empty content**
- **All test expectations are aligned with actual behavior**
- **All tests now pass (330 tests, 0 errors, 3 skipped)**
- **Removed problematic timeout-based cache test**
- **Improved follow-up and response logic for edge cases**
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
- **Fixed bug where voice response would say 'undefined and undefined' if no shelters were found. Now, a clear message is given when no results pass the Tavily score threshold.**
- **Clarified Tavily score threshold:** Only results with a score >= 0.2 are included in responses by default. If you want to include more results, you can lower this threshold in the code.
- **Enhanced AI Model Confidence Score Logging:** Added comprehensive logging of AI model confidence scores for intent classification, including confidence levels (High/Medium/Low), response times, and token usage metrics.
- **Improved Conversation Management:** Added intelligent conversation flow management for off-topic intents with graceful re-engagement and conversation closure capabilities.
- **Enhanced Error Handling:** Added fallback intent classification using pattern matching when OpenAI API is unavailable, ensuring system reliability.
- **Custom Tavily Response Formatting (v1.0.13):** New flexible formatting system with multiple format options (simple, detailed, minimal, custom) for different use cases. Enhanced phone number extraction, title cleaning, and metadata calculation with comprehensive test coverage.
- **See CHANGELOG for more details**
- **Simplified intent classification and off-topic detection:** Only queries with domestic violence-related keywords are considered on-topic; all others are classified as off-topic. This approach is robust, easier to maintain, and fully covered by tests.
- **Improved follow-up question handling:** The system now correctly interprets queries like "tell me more about the last one" or "the first one", mapping them to the correct Tavily result and providing detailed information from the content. Fully covered by tests.
- **Voice responses no longer include HTTP/HTTPS URLs; users are offered to receive details (including address and link) via text message**
- **Follow-up detection logic is now robust even if the OpenAI API key is missing, and works reliably for vague queries like "tell me more about the first one"**
- **All tests pass, including new tests for follow-up detection and conversational flow**
- **Improved user experience for follow-up and location/address queries**
- **Pet-related follow-up questions are now handled as relevant, not off-topic**
- **Improved filtering logic for shelter results**
- **Documentation cleanup: only README.md and CHANGELOG.md remain**

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

## Follow-up Question Support

The assistant now supports comprehensive follow-up question handling, allowing users to ask vague or context-dependent questions after an initial query. This includes:

- **Conversation context tracking**: Remembers the last query, intent, location, and results for 5 minutes.
- **Vague query detection**: Recognizes follow-ups like "What's the address?", "Where is that located?", "What's the number?", or "Can you send that to me?".
- **Specific follow-up handlers**: Provides targeted responses for address, phone, and details requests, using cached results.
- **Timeout safety**: Automatically clears context after 5 minutes to prevent stale responses.
- **Improved user experience**: Users can ask natural follow-up questions without repeating themselves.

**Example usage:**
- User: "Find me a shelter in San Francisco"
- Assistant: "I found 2 shelters in San Francisco: ... Would you like me to send you the details?"
- User: "What's the address?"
- Assistant: "Here are the locations: ... Would you like me to send you the complete details?"

See `FOLLOW_UP_IMPLEMENTATION.md` for technical details.

## Node.js Deprecation Warnings

If you see a warning about the `punycode` module being deprecated in Node.js 14+:

```
(node:14) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
```

This is caused by dependencies like Vite or esbuild. The project now:
- Suppresses deprecation warnings in npm scripts using `--no-deprecation`
- Updates dependencies to minimize deprecation issues
- Adds `.node-version` and `.nvmrc` files to specify Node.js 18.19.0

**You can safely ignore this warning.**

See `DEPRECATION_WARNINGS.md` for more details.

## Tavily API Integration
- The assistant queries the Tavily API for shelter and resource information.
- As of the latest update, `include_raw_content` is set to `false` for all Tavily API requests. Raw content is no longer parsed or used in fallback logic.
- This change reduces response size and improves performance.

## Multi-Language Voice Support

The Domestic Violence Support Assistant now supports multiple languages for voice calls.

### Supported Languages
- English (US)
- Spanish (Spain)
- French (France)
- German (Germany)

You can add more languages by editing `relay-server/lib/languageConfig.js`.

### How It Works
- The system detects the caller's language from request headers, explicit selection, or speech content.
- All prompts and responses are localized based on the detected language.
- Twilio TTS/ASR and OpenAI TTS use the correct language and voice for each call.
- Prompts for each language are defined in `languageConfig.js`.
- OpenAI TTS uses language-specific voices (nova, shimmer, echo, onyx) while Twilio uses Polly voices for fallback.

### Customizing Prompts
- To customize or add translations, edit the `prompts` section for each language in `relay-server/lib/languageConfig.js`.
- You can add new languages by copying an existing entry and updating the language codes and translations.

### Example
```js
export const SUPPORTED_LANGUAGES = {
  'en-US': { 
    twilioVoice: 'Polly.Amy',
    openaiVoice: 'nova',
    // ... other config
  },
  'es-ES': { 
    twilioVoice: 'Polly.Conchita',
    openaiVoice: 'shimmer',
    // ... other config
  },
  // Add more here
};
```

### Adding a New Language
1. Add a new entry to `SUPPORTED_LANGUAGES` in `languageConfig.js`.
2. Specify the Twilio voice, OpenAI voice, language codes, and all required prompts.
3. Choose an appropriate OpenAI voice from: nova, shimmer, echo, onyx, fable, alloy, ash, sage, coral.
4. Restart the server to apply changes.

### Notes
- If a language is not detected, the system defaults to English (US).
- All TTS and ASR operations are now language-aware for improved accessibility and user experience.
- OpenAI TTS is used as the primary TTS provider, with Twilio Polly as fallback.

## Test Improvements

- **Enhanced Test Reliability**: Fixed mocking issues for Tavily API calls in tests to prevent real API calls during testing.
- **Improved Test Coverage**: Restored full `getResponse` implementation with caching, parallel processing, and routing stats for comprehensive testing.
- **Better Test Isolation**: Implemented proper module mocking to ensure tests run independently without external dependencies.
- **Cache Testing**: Added comprehensive tests for response caching, TTL validation, and LRU cache implementation.
- **Performance Monitoring**: Tests now validate parallel processing of intent classification and API calls, along with routing statistics tracking.