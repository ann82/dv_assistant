# Changelog

All notable changes to this project will be documented in this file.

## [1.0.5] - 2024-12-19

### Fixed
- **Speech Recognition Timeout Issues** - Standardized speech recognition settings across all gather elements
  - Fixed inconsistent `speechTimeout` values that caused responses to come back before listening to full user requests
  - Standardized all `speechTimeout` values to 10 seconds for consistent behavior
  - Removed conflicting `timeout` parameters that interfered with speech recognition
  - Ensured consistent speech recognition parameters (`speechModel` and `enhanced`) across all gather elements
  - Improved user experience with proper speech recognition timing and conversation flow
- **Import Statement Fixes** - Resolved `formatTavilyResponse is not a function` runtime error
  - Fixed incorrect import of `formatTavilyResponse` from `../routes/twilio.js` instead of `../lib/response.js`
  - Updated all usages to use `ResponseGenerator.formatTavilyResponse` static method correctly
  - Ensured consistent import patterns across the codebase

### Changed
- **Code Cleanup and Maintenance** - Removed unused code and improved organization
  - Deleted unused `lib/twilio.js` file containing old `TwilioHandler` class with "Welcome to Harbor AI" message
  - Removed entire unused `src/` directory containing legacy web interface code
  - Added comprehensive comments for web-based and Twilio voice call functionality
  - Updated tests to use current `TwilioVoiceHandler` implementation
  - Improved code organization and maintainability
  - Enhanced documentation for consent handling and core processing functions

## [1.0.4] - 2024-12-19

### Added
- **Follow-up Question Support** - Enhanced conversation flow with intelligent follow-up detection
  - Added automatic detection of follow-up questions about specific resources
  - Recognizes patterns like "Can you let me know more about...", "Tell me more about...", "What about..."
  - Uses conversation context to understand which resource the user is referring to
  - Processes follow-up questions without requiring location input again
  - Maintains conversation continuity for better user experience
- **Improved Context Awareness** - Enhanced conversation context management
  - Better tracking of previous interactions and mentioned resources
  - Smarter query rewriting for follow-up questions using conversation history
  - Contextual response generation based on conversation context
  - Seamless transition between initial searches and follow-up questions

### Fixed
- **CallSid Handling** - Fixed missing callSid in speech processing
  - Added proper callSid extraction from request body in `handleSpeechInput`
  - Fixed `processSpeechInput` method to accept callSid parameter
  - Removed non-existent `getCallSidFromContext()` method call
  - Ensured conversation context is properly maintained across interactions

### Changed
- Updated speech processing logic to prioritize follow-up question detection over location extraction
- Enhanced conversation flow to handle follow-up questions more intelligently
- Improved user experience by maintaining context across conversation turns

## [1.0.3] - 2024-12-19

### Added
- **Voice Response Optimization** - Enhanced text-to-speech compatibility for Twilio calls
  - Added voice-optimized `formatTavilyResponse` for Twilio calls
  - Limited responses to 3 results for voice clarity
  - Removed newlines and complex formatting that interfere with TTS
  - Focus on organization names and phone numbers for voice responses
  - Fixed response count to show actual number of results listed

### Fixed
- **Conversation Flow** - Resolved call disconnection after speech responses
  - Added `<Gather>` element after speech responses to continue conversation
  - Added fallback message if no speech is detected
  - Improved conversation flow and user experience
  - Fixed issue where calls would disconnect after providing resource information

### Changed
- Updated response formatting to be more concise and TTS-friendly
- Enhanced error handling with proper conversation continuation
- Improved user experience with better conversation flow

## [1.0.2] - 2024-12-19

### Fixed
- **Critical Fix: Double Response Error** - Resolved "Cannot set headers after they are sent to the client" error in Twilio voice route handler
  - Fixed route handler calling `sendTwMLResponse` internally while also trying to send response manually
  - Updated `handleIncomingCall` and `handleSpeechInput` methods to only return TwiML objects, not send responses directly
  - Removed `res` parameter from handler method calls in route handler
  - Added proper `processSpeechInput` method to TwilioVoiceHandler class
  - Exported `processSpeechResult` function from routes file for reuse
- **TwilioVoiceHandler Constructor Fix** - Resolved "Cannot read properties of undefined (reading 'startsWith')" error
  - Fixed TwilioVoiceHandler instantiation without required parameters
  - Added proper environment variable handling for `accountSid`, `authToken`, and `phoneNumber`
  - Enhanced constructor to handle test environment gracefully with fallback values
  - Added comprehensive validation for production environment credentials
  - Improved error messages for missing Twilio credentials

### Changed
- Updated TwilioVoiceHandler constructor to support test environment with mock credentials
- Enhanced error handling in Twilio route initialization
- Improved environment variable validation and error reporting

## [1.0.1] - 2024-03-19

### Fixed
- Fixed Tavily API authentication by updating header format to use Bearer token

## [1.0.0] - 2024-03-19

### Added
- Initial release of DV Assistant Relay Server
- Twilio voice call handling
- WebSocket server for real-time communication
- Tavily API integration for resource searches
- OpenAI GPT integration for general responses
- Environment variable validation
- Health check endpoint
- Comprehensive error handling
- Railway deployment support

### Changed
- Updated server configuration for Railway deployment
- Improved error handling and logging
- Updated package.json with correct dependencies
- Added Node.js version requirement (>= 18.0.0)

### Fixed
- Fixed environment variable loading
- Fixed WebSocket server initialization
- Fixed API key validation
- Fixed server port configuration

## [0.1.0] - 2024-03-18

### Added
- Basic server setup
- Twilio integration
- WebSocket server
- Environment configuration
- Basic error handling
- Logging system

### Changed
- Confidence-based routing system for intelligent query handling
  - High confidence (≥ 0.7): Uses Tavily exclusively
  - Medium confidence (0.4-0.7): Tries both Tavily and GPT in parallel
  - Low confidence (0.3-0.4): Uses GPT with Tavily context
  - Non-factual (< 0.3): Uses GPT exclusively
- Performance monitoring and statistics tracking
  - Tracks routing decisions by confidence level
  - Monitors success rates and fallback patterns
  - Records response times for each service
- Caching system for confidence analysis
  - In-memory cache with 1-hour TTL
  - Automatic cleanup of expired entries
  - Cache statistics and monitoring
- Comprehensive test suite for new features
  - Confidence analysis tests
  - Cache functionality tests
  - Routing performance tests
  - Cache statistics tests

### Fixed
- Memory leak in confidence analysis caching
- Response time tracking accuracy
- Cache cleanup timing issues

## [Unreleased]

### Added
- Enhanced error handling with proper confidence tracking
- Improved fallback statistics for error cases
- Better error logging and diagnostics
- Automatic confidence preservation in error paths
- Comprehensive test coverage for error handling
- **TypeScript Migration:** Core components have been migrated to TypeScript for better type safety and maintainability.
- **Response Handling Improvements:** Enhanced response generation for irrelevant queries with proper domain-specific responses.
- **Follow-up Question Handling:** The `ResponseGenerator` now correctly handles follow-up questions by using the stored context from previous interactions.
- **Location Extraction Enhancement:** The `EntityExtractor` has been updated to handle trailing punctuation in location extraction.
- **Import Statement Updates:** Updated import statements in `ResponseGenerator.ts` to include the `.js` extension for all modules.
- **Logging Enhancements:** Added logging to `RelevanceChecker` and `EntityExtractor` for better debugging and diagnostics.
- Enhanced conversation context management system
- Intent-based query rewriting with context preservation
- Location context tracking across conversation turns
- Emergency situation handling and prioritization
- Service-specific context management
- Comprehensive test coverage for conversation context features
- Response caching system with 30-minute TTL
- Parallel processing for intent classification and API calls
- LRU cache implementation for response storage
- Performance monitoring and logging
- Comprehensive test coverage for caching and parallel processing
- Enhanced response formatting system with multi-format support
- Voice-optimized responses for Twilio calls
- Improved error handling with confidence tracking
- Better fallback statistics
- Comprehensive test coverage for response formatting
- New response format tests for different scenarios
- Improved location extraction to handle various speech patterns
- Updated location prompts to include example cities
- Comprehensive test coverage for speech processing and response formatting
- Railway deployment support
- WebSocket configuration for cloud deployment
- Enhanced environment variable handling
- Procfile for Railway deployment
- Rate limiting for API endpoints
- Request abort handling
- Resource cleanup on call end
- Comprehensive error logging
- Unified Tavily response formatting: all previous formatter functions removed in favor of `ResponseGenerator.formatTavilyResponse`.
- This function now supports voice, SMS, and web output, and is the single source of truth for Tavily result formatting.
- All usages and tests updated to use the new static method.
- Fully tested with comprehensive test coverage for all output types.
- Updated `esbuild` and `@types/node` to the latest versions (June 2024)
  - Resolves version mismatch warnings
  - Keeps build and type system up to date

### Changed
- Updated error handling to preserve confidence levels in fallback scenarios
- Enhanced fallback statistics tracking for better monitoring
- Improved error logging with more detailed diagnostics
- Updated the `ResponseGenerator` to handle follow-up questions differently from initial questions, improving the user experience by maintaining context.
- Migrated core components from JavaScript to TypeScript for better type safety and maintainability.
- Updated build process to include TypeScript compilation.
- Updated intent classification to support conversation context
- Improved location extraction to handle trailing punctuation
- Enhanced follow-up question detection and handling
- Modified query rewriting to incorporate conversation history
- Updated response generation to use conversation context
- Reduced response timeout from 90s to 30s
- Reduced speech timeout from 15s to 10s
- Reduced connection timeout from 60s to 30s
- Reduced activity check interval from 30s to 15s
- Reduced speech response delay from 300ms to 100ms
- Updated response formatting for better voice interaction
- Optimized voice response format for better clarity
- Updated response formatting based on request type
- Updated README with recent changes and improvements
- Updated WebSocket connection logic to support cloud deployment
- Enhanced configuration system for different environments
- Improved error handling in speech processing
- Increased request timeouts for Twilio requests
- Enhanced response formatting system
- Improved location extraction from speech input
- Updated location prompts with better examples
- Added comprehensive test coverage
- Fixed request abort handling in Twilio voice calls
- Fixed resource cleanup on call termination
- Fixed WebSocket connection issues in cloud environment
- Fixed package-lock.json synchronization issues
- Fixed logger import in config.js
- Fixed environment validation in test environment
- Refactored test suite to use a global mock for TwilioVoiceHandler via setupTests.js
- Removed all direct vi.mock calls for TwilioVoiceHandler from individual test files
- Updated vitest.config.js to use setupTests.js for global test setup
- Removed /twilio/speech route tests as the route does not exist
- Stabilized and cleaned up all Twilio route tests
- Increased Twilio `speechTimeout` in all Gather prompts from 10s to 30s for better user response time and to prevent premature disconnects.
- Improved follow-up question support and context tracking for voice agent (see FOLLOW_UP_IMPLEMENTATION.md).
- Caching improvements for Tavily and GPT queries.

### Fixed
- Fixed error handling to properly track fallback statistics
- Fixed confidence tracking in error paths
- Fixed a linter error in the `ResponseGenerator` class related to the `location` type.
- Fixed response handling for irrelevant queries to ensure proper domain-specific responses.
- Location extraction issues with complex formats
- Follow-up question handling without context
- Intent classification for emergency situations
- Query rewriting for service-specific requests
- Speech handling performance issues
- Response time delays
- Cache management edge cases
- Response formatting issues in voice calls
- Error handling in response generation
- Phone number extraction in voice responses
- Fixed duplicate export of `formatTavilyResponse` in twilio.js
- Fixed duplicate declaration of `generateLocationPrompt` in twilio.js
- Improved error handling in speech processing
- Enhanced response formatting system
- Improved location extraction from speech input
- Updated location prompts with better examples
- Added comprehensive test coverage
- Resolved persistent ReferenceError in test suite due to ESM hoisting and mocking order
- Ensured all tests pass and are isolated from initialization order issues

### Security
- Attempted to update dev dependencies (esbuild, vite, vitest) to address moderate vulnerabilities. Some advisories remain due to upstream issues in the testing toolchain. These do not affect production code.
- Attempted to update development dependencies to address vulnerabilities
- Added rate limiting to prevent abuse
- Enhanced request validation
- Improved error handling for malformed requests
- Added request timeout protection

## [1.0.0] - 2024-03-20

### Added
- Initial release
- Twilio integration
- Intent classification
- Entity extraction
- Relevance checking
- Tavily API integration
- GPT fallback
- Basic conversation context
- Response generation
- Error handling
- Logging system
- Test suite
- TypeScript support
- Build system
- Development tools
- Documentation
- Basic response generation

### Changed
- Migrated core components to TypeScript
- Enhanced response handling
- Improved error messages
- Updated documentation
- Refined logging
- Optimized build process
- Enhanced test coverage
- Improved type safety
- Streamlined development workflow
- Enhanced code organization

### Fixed
- TypeScript compilation issues
- Import path resolution
- Test environment setup
- Build process errors
- Documentation formatting
- Logging configuration
- Error handling edge cases
- Test coverage gaps
- Type definition issues
- Development tool integration

## [0.1.0] - 2024-03-19

### Added
- Project initialization
- Basic server setup
- Twilio webhook handling
- Intent classification
- Entity extraction
- Relevance checking
- Tavily API integration
- GPT fallback
- Basic error handling
- Initial logging
- Test framework
- Development environment
- Basic documentation

### Changed
- Server configuration
- Error handling
- Logging format
- Test structure
- Documentation style
- Code organization
- Development workflow
- Build process
- Test coverage
- Error messages

### Fixed
- Server startup issues
- Webhook handling
- Error responses
- Logging setup
- Test execution
- Development tools
- Build process
- Documentation
- Code formatting
- Type definitions

## [Unreleased]

### Fixed
- Fixed duplicate export of `formatTavilyResponse` in twilio.js
- Fixed duplicate declaration of `generateLocationPrompt` in twilio.js
- Improved error handling in speech processing
- Enhanced response formatting system
- Improved location extraction from speech input
- Updated location prompts with better examples
- Added comprehensive test coverage

### Added
- Enhanced response formatting system
- Improved location extraction from speech input
- Updated location prompts with better examples
- Comprehensive test coverage

### Changed
- Updated README with recent changes and improvements

## [1.0.6] - 2024-12-19

### Fixed
- **Critical Fix: Twilio Routing Conflicts** - Resolved duplicate responses and routing conflicts that were causing multiple TwiML responses
  - Standardized all routes to use `/twilio/voice/process` consistently across the application
  - Fixed non-existent `/twilio/speech/${callSid}` route in `handleIncomingCall` function
  - Updated TwilioVoiceHandler, WebSocket server, and all route configurations to use consistent routing paths
  - Eliminated route conflicts between `/twilio/voice` and `/twilio/voice/process`
- **Follow-up Question Support** - Fixed follow-up question detection and processing
  - Updated `/twilio/voice/process` route to use `TwilioVoiceHandler.processSpeechInput()` which includes proper follow-up detection
  - Follow-up questions are now processed without requiring location input again
  - Conversation context is properly maintained across interactions
  - Enhanced follow-up detection patterns for better user experience
- **TwiML Response Consistency** - Improved TwiML response generation across all routes
  - Consistent gather configuration with proper speech timeout and model settings
  - Proper fallback messages when no speech is detected
  - Unified error handling and response formatting

### Changed
- Updated all Twilio route handlers to use consistent routing paths
- Enhanced conversation flow to handle follow-up questions more intelligently
- Improved user experience by maintaining context across conversation turns
- Standardized speech timeout and model configurations across all routes

## [1.0.7] - 2024-12-19

### Added
- **Configuration-Based Filtering System** - Replaced hardcoded filtering patterns with maintainable configuration architecture
  - Created `filterConfig.js` with centralized filtering patterns and rules
  - Added helper functions for pattern matching and title cleanup
  - Implemented easy-to-update configuration without code changes
  - Added support for domain exclusions and title cleanup patterns
- **Enhanced Tavily Response Filtering** - Improved search result quality and relevance
  - Filters out PDFs, government documents, research papers, and other non-shelter resources
  - Focuses on actual shelter organizations, domestic violence centers, and support services
  - Cleans up organization titles by removing common prefixes/suffixes
  - Provides cleaner, more readable responses for voice interactions
- **AI-Powered Filtering Option** - Added intelligent result classification system
  - Created `aiFilter.js` with GPT-powered result classification
  - Includes caching system for performance optimization
  - Provides fallback to basic filtering when AI is unavailable
  - Can be used as an alternative or complement to configuration-based filtering

### Changed
- Updated `formatTavilyResponse` function to use configuration-based filtering
- Enhanced Tavily API calls with domain exclusions from configuration
- Improved query rewriting to target actual shelter organizations
- Updated response formatting to focus on shelters rather than general resources
- Changed terminology from "resources" to "shelters" in user-facing messages

### Fixed
- **Tavily Response Quality** - Eliminated PDFs and non-shelter resources from search results
- **Title Cleanup** - Removed "[PDF]", "- Domestic Shelters", and other unwanted suffixes
- **Search Relevance** - Improved targeting of actual shelter organizations vs. general information

## [1.0.6] - 2024-12-19 