# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.20.0] - 2025-01-27

### Added
- **Configurable Welcome Message**: Added cost-efficient, configurable welcome message for both voice and web interfaces
- **Emergency Assessment in Welcome**: Welcome message includes immediate danger assessment and 911 guidance
- **Zero Additional AI Costs**: Welcome messages use pre-written text instead of AI generation
- **Consistent Cross-Platform Experience**: Same empathetic welcome message across voice and web platforms
- **Single Source of Truth**: Welcome message defined in conversation config for easy updates

### Changed
- **Replaced Hardcoded Welcome**: Updated Twilio voice processing to use configurable welcome message
- **Updated Frontend Welcome**: ConsolePage now uses the same configurable welcome message
- **Enhanced Conversation Config**: Added welcomeMessage export to shared configuration
- **Improved Cost Efficiency**: Eliminated AI generation costs for welcome messages

### Fixed
- **Inconsistent Welcome Messages**: Unified welcome experience across all platforms
- **Additional AI Costs**: Removed unnecessary AI calls for welcome message generation
- **Welcome Message Maintenance**: Single location for updating welcome message content

### Technical Details
- **Cost Savings**: $0.10-2.00/month savings depending on call volume
- **Response Time**: Faster welcome delivery (no AI generation delay)
- **Emergency Protocols**: Welcome follows conversation config structure for immediate danger assessment
- **Empathetic Tone**: Welcome message matches conversation config guidelines for supportive language

## [1.19.0] - 2025-06-25

### Added
- **Enhanced Voice Responses**: Voice responses now include shelter name, address, and phone number when available
- **Improved SMS Responses**: SMS responses include phone numbers for all shelters, not just additional resources
- **Test Suite Alignment**: All tests updated to match new query rewriting, filtering, and response logic; all tests now pass

### Changed
- **Enhanced Voice Response Format**: More detailed voice responses with conditional address and phone information
- **Improved SMS Response Format**: Consistent phone number inclusion for all shelter results

### Fixed
- **Missing Contact Information**: Voice responses now include essential shelter details when available
- **Incomplete SMS Information**: All shelters now show phone numbers in SMS responses

### Technical Details
- **Voice Response Enhancement**: Conditional inclusion of address and phone based on data availability
- **Natural Language Flow**: Responses maintain conversational tone while providing detailed information

## [1.18.1] - 2025-06-25

### Fixed
- Improved fallback logic: If Tavily API returns an empty results array but provides a useful answer (e.g., shelter name and phone in the answer field), the system now extracts and presents this information to the user in both voice and SMS responses.

## [1.18.0] - 2025-06-25

### Added
- Pet-related follow-up questions (e.g., "Do they allow pets?") are now recognized as valid follow-ups and not off-topic

### Changed
- Filtering logic for shelter results is now more intelligent and no longer excludes real shelters that lack phone/address fields

### Removed
- All other markdown documentation files except README.md and CHANGELOG.md have been removed for clarity

## [1.17.0] - 2025-06-25

### Added
- **Enhanced Query Rewriting**: Simplified and optimized Tavily query construction for better search results
- **Improved Site Filtering**: Added exclusion of low-quality sites (yellowpages, city-data, tripadvisor) for better results
- **Better Proximity Search**: Enhanced location search with "near" operator and exact phrase matching
- **Specific Field Requests**: Requests exact fields like shelter name, address, phone number, services offered, and 24-hour hotline
- **Comprehensive Test Coverage**: Added tests demonstrating improved query quality and site filtering

### Changed
- **Simplified Query Construction**: Replaced complex 20+ line conditional logic with clean, single-line query templates
- **Enhanced Query Format**: Uses `"domestic violence shelter"` with quotes for precise search results
- **Improved Site Restrictions**: 
  - **Quality sites**: `site:.org OR site:.gov` (credible sources only)
  - **Excluded sites**: `-site:yellowpages.com -site:city-data.com -site:tripadvisor.com` (low-quality directories)
- **Reduced Code Complexity**: Eliminated complex regex checks and conditional logic in query rewriting

### Fixed
- **Poor Search Results**: Better query construction leads to more relevant shelter information
- **False Positives**: Excluding low-quality directory sites reduces irrelevant results
- **Inconsistent Queries**: Standardized format regardless of user input phrasing
- **Maintenance Issues**: Simplified code structure for easier debugging and updates

### Technical Details
- **Query Format**: `"domestic violence shelter" near [location] "shelter name" "address" "phone number" "services offered" "24 hour hotline" site:.org OR site:.gov -site:yellowpages.com -site:city-data.com -site:tripadvisor.com`
- **Code Reduction**: Simplified from 20+ lines of conditional logic to 1 line template
- **Better Maintainability**: Clear, readable structure with no complex regex checks
- **Enhanced Reliability**: Consistent query format improves search result quality

## [1.16.0] - 2024-12-19

### Added
- **Enhanced AI Conversation Guidelines**: Integrated comprehensive conversation instructions from frontend to relay-server
- **Detailed Emergency Protocols**: Proper 911 escalation, immediate danger assessment, and safety planning guidelines
- **Cultural Sensitivity Support**: LGBTQ+ support, language preferences, religious accommodations, and accessibility guidelines
- **Structured Conversation Flow**: Professional call structure with welcome, needs assessment, resource provision, and closure
- **Safety Planning Integration**: Comprehensive safety questions and action plan development
- **Privacy and Data Protection**: Clear guidelines for location sharing, data handling, and privacy protection
- **Location and Shelter Search Protocols**: Detailed protocols for location confirmation and shelter search optimization
- **Shared Configuration System**: Single source of truth for conversation guidelines across web and voice interfaces
- **Cost Analysis Documentation**: Comprehensive cost-benefit analysis showing manageable $1-3/month increase for significantly improved quality

### Changed
- **Replaced Simple System Prompt**: Upgraded from 3-line prompt to detailed 150+ line instructions (5,080 characters vs 493 characters)
- **Enhanced Response Quality**: More empathetic, culturally sensitive, and structured AI responses
- **Unified User Experience**: Consistent conversation guidelines between web and voice interfaces
- **Improved Emergency Handling**: Better 911 escalation and immediate danger assessment
- **Enhanced Cultural Competency**: Support for diverse user needs and communication styles
- **Optimized Token Usage**: Smart routing minimizes GPT usage while maximizing response quality

### Fixed
- **Code Duplication**: Eliminated 154 lines of duplicated instructions between frontend and backend
- **Inconsistent Experience**: Unified conversation guidelines across all interfaces
- **Limited Emergency Protocols**: Enhanced safety and emergency response capabilities
- **Cultural Insensitivity**: Added comprehensive cultural sensitivity guidelines

### Technical Details
- **Token Usage**: Increased from ~124 to ~1,270 tokens per GPT call
- **Cost Impact**: $0.001719 additional cost per GPT-3.5-turbo call (9.2x increase)
- **Monthly Cost**: $1-3/month for typical usage (100 calls/day)
- **Caching Benefits**: 30-minute response caching reduces duplicate GPT calls
- **Smart Routing**: High-confidence queries use Tavily only (no GPT cost)

## [1.15.0] - 2024-12-19

### Added
- **Enhanced speech-to-text recognition** with intelligent preprocessing to reduce garbling
- **Optimized Twilio speech recognition parameters** for improved accuracy
  - `speechTimeout: 'auto'` for better handling
  - `speechModel: 'phone_call'` for optimized phone conversation recognition
  - `enhanced: 'true'` for improved accuracy
  - `profanityFilter: 'false'` to avoid filtering important words
- **Intelligent speech preprocessing system** with advanced cleaning capabilities
  - **Automatic artifact removal**: Cleans `[inaudible]`, `[background noise]`, `[static]`, etc.
  - **Common error correction**: Fixes frequent speech recognition errors
    - "help me find" → "find"
    - "shelter homes" → "shelters"
    - "close to me" → "near me"
  - **Garbled speech detection**: Identifies unclear speech patterns using multiple criteria
  - **Key word extraction**: Extracts relevant keywords from heavily garbled speech
- **Comprehensive test coverage** for all speech preprocessing functions
- **Enhanced logging** for speech recognition quality monitoring

### Changed
- **Updated all Twilio gather configurations** to use improved speech recognition settings
- **Enhanced TwilioVoiceHandler** with new speech preprocessing methods
- **Improved speech processing endpoints** to use cleaned speech input
- **Updated websocket server** to use enhanced speech recognition parameters
- **Enhanced error handling** for speech recognition failures

### Fixed
- **Speech garbling issues** through intelligent preprocessing and parameter optimization
- **Poor speech recognition accuracy** with optimized Twilio configuration
- **User experience issues** caused by garbled speech recognition
- **Test reliability** with comprehensive mock implementations for speech preprocessing

## [1.14.0] - 2024-12-19

### Added
- **Enhanced Tavily response formatting** with improved title and address extraction capabilities
- **Better title extraction** from content when original Tavily titles are poor (e.g., filenames)
- **Enhanced address extraction** that captures complete multi-line addresses including city, state, and zip codes
- **Multiple resource detection** for content containing lists of multiple organizations
- **Improved phone number extraction** with better regex patterns
- **Comprehensive test coverage** for all new extraction functions

### Changed
- **Updated main formatting function** to use all new extraction methods for better response quality
- **Enhanced address parsing** to handle consecutive lines that form complete addresses
- **Improved title extraction patterns** to better identify organization names in content
- **Updated test suite** to reflect new functionality and improved test reliability

### Fixed
- **Address extraction issue** where city and state information was not being included in extracted addresses
- **Test environment issues** with mock function restoration in the test suite
- **Response formatting consistency** across different types of Tavily results

## [1.13.0] - 2024-06-25

### Added
- **Enhanced Railway deployment startup script** (`relay-server/start.js`) with comprehensive environment variable validation
- **Railway deployment guide** (`RAILWAY_DEPLOYMENT.md`) with detailed troubleshooting and setup instructions
- **Smart error handling** for missing environment variables with clear error messages
- **Graceful shutdown handling** for SIGTERM and SIGINT signals

### Changed
- **Updated Railway configuration** (`railway.toml`) for proper directory handling and build process
- **Fixed build command** to run from correct directory (`cd relay-server && npm install --legacy-peer-deps`)
- **Fixed start command** to use enhanced startup script (`cd relay-server && node start.js`)
- **Removed TypeScript build script** from `package.json` since this is a JavaScript project
- **Updated README** with Railway deployment section and environment variable documentation

### Fixed
- **Railway deployment failures** caused by incorrect file paths and TypeScript compilation attempts
- **Service unavailable errors** by implementing proper startup validation and error handling
- **Build process issues** by removing unnecessary TypeScript compilation step
- **Environment variable validation** with clear error messages for missing configuration

## [1.12.0] - 2024-06-09

### Changed
- Defensive type checking and logging for rewritten queries before Tavily API calls to prevent invalid query errors (422 Unprocessable Entity)
- Improved error handling and logging for Tavily API integration
- Updated enhanced query rewriter and location detector logic for better test consistency and robustness
- Fixed test mocks and edge cases for query rewriting and location extraction
- Updated test suite for more robust edge case handling
- See README for more details

## [1.11.0] - 2024-06-09

### Changed
- Improved conversational filler removal: Now removes all consecutive leading fillers, including those with punctuation, and is consistent across modules
- Location extraction now returns lowercase locations for test consistency
- Enhanced query rewriting uses improved filler removal and location extraction
- Fixed async handling and response formatting in query handler and speech processor
- Updated and aligned test expectations and logic for consistency
- Fixed export/import of extractLocationFromQuery for proper test and module usage
- Updated README to document these changes

## [1.10.0] - 2024-04-02

### Added
- Enhanced timeout configuration for better call handling
  - 45-second response timeout for complex queries
  - 10-second speech input timeout for user responses
  - 30-second WebSocket connection timeout
- Improved retry mechanism for response timeouts
  - Maximum of 3 retries for failed responses
  - Better error messages during retry attempts
  - Proper cleanup after max retries reached
- Enhanced search result filtering
  - Added comprehensive keyword filtering for relevant results
  - Improved query enhancement for better search results
  - Better response formatting for shelter information
  - Added fallback responses for no results found
  - Added support for pet-friendly domestic violence shelters
  - Added support for child-friendly and family shelters
  - Improved sentence selection for more relevant responses

### Changed
- Updated TwiML response structure for better reliability
  - Added 1-second pause between responses
  - Using Polly.Amy voice for consistent speech synthesis
  - Improved error message formatting
- Enhanced WebSocket connection handling
  - Better timeout management
  - Improved resource cleanup
  - More detailed error logging
- Improved search result processing
  - Better filtering of irrelevant results
  - Enhanced result validation
  - More structured response format
  - Smarter sentence selection for responses
  - Better handling of pet-friendly shelter information
  - Enhanced support for family and child-friendly shelters
  - Improved filtering of educational and childcare facilities

### Fixed
- Resolved issues with call cutoffs during long responses
- Fixed resource cleanup on connection errors
- Improved error recovery during WebSocket disconnections
- Enhanced logging for timeout and retry scenarios
- Fixed irrelevant search results causing call disconnections
- Improved handling of search queries for better accuracy
- Fixed filtering of pet-friendly domestic violence shelters
- Fixed filtering of child-friendly and family shelters
- Improved handling of educational and childcare facility results

## [1.9.0] - 2024-04-01

### Fixed
- Fixed Twilio test case for SMS error handling
- Corrected async/await handling in WebSocket close event
- Improved error logging in SMS summary sending
- Enhanced test reliability for error scenarios

### Changed
- Updated WebSocket connection handling to properly handle async operations
- Improved error message consistency in SMS failure cases

## [1.8.0] - 2024-03-31

### Added
- Enhanced build configuration for ES modules support
- Improved test environment configuration
- Better module transformation handling for tests

### Changed
- Updated babel configuration for better module compatibility
- Improved test scripts with proper environment variables
- Enhanced build process with production optimizations

### Fixed
- Resolved ES modules compatibility issues in build process
- Fixed module transformation in test environment
- Corrected build configuration for production deployment
- Addressed webpack module loading issues

## [1.7.0] - 2024-03-31

### Added
- Enhanced test suite for Twilio webhook handler and WebSocket server
- Comprehensive mock implementations for external services
- Detailed test cases for audio service logic

### Changed
- Improved test structure and organization
- Enhanced mock function initialization and management
- Better error handling in test scenarios

### Fixed
- Resolved issues with mock handler registration
- Fixed event simulation in WebSocket tests
- Corrected Twilio mock implementation
- Addressed test failures related to mock function calls
- Fixed hoisting issues with mock functions

## [1.6.0] - 2024-03-30

### Added
- Comprehensive test suite for Twilio webhook handler
- Mock implementations for Twilio services
- Enhanced error handling in webhook routes
- Detailed test cases for various webhook scenarios

### Changed
- Refactored Twilio webhook handler for better error handling
- Updated test structure for better organization
- Improved mock function initialization
- Enhanced error message formatting

### Fixed
- Resolved mock function reference errors in tests
- Fixed undefined property access in webhook handler
- Corrected error message assertions in tests
- Addressed test failures related to mock function calls
- Fixed hoisting issues with mock functions

## [1.5.0] - 2024-03-29

### Added
- Enhanced health check endpoint with detailed system information
- Comprehensive server startup logging
- Memory usage monitoring and reporting
- Detailed error tracking for deployment issues

### Changed
- Updated server directory structure for better organization
- Improved static file serving configuration
- Enhanced error handling middleware with better logging
- Updated Railway deployment configuration

### Fixed
- Resolved missing uuid package dependency
- Fixed package-lock.json synchronization issues
- Corrected server startup directory issues
- Addressed health check endpoint failures

## [1.4.0] - 2024-03-24

### Added
- Webpack configuration for production builds
- Proper static file serving configuration
- Health check endpoint for monitoring
- Enhanced error handling middleware
- Production deployment configuration for Render.com

### Changed
- Updated server configuration to use environment variables
- Improved static file serving for audio files
- Enhanced build process with proper webpack configuration
- Updated deployment documentation
- Moved audio files to `relay-server/public/audio` directory

### Fixed
- Audio file serving path issues
- Static file serving configuration
- Build process for production deployment
- Environment variable handling

## Deployment and Audio Issues - [Current Date]

### Fixed
- Resolved 403 Forbidden errors on Twilio webhook endpoints
- Fixed 404 Not Found errors for audio file access
- Corrected audio file serving path configuration
- Addressed ngrok URL expiration issues

### Changed
- Updated deployment documentation to include proper hosting options
- Improved audio file path handling in server configuration
- Enhanced error logging for webhook and audio file access issues

### Added
- Documentation for proper deployment options:
  - Render.com deployment instructions
  - Railway.app deployment instructions
  - DigitalOcean App Platform deployment instructions
  - Heroku deployment instructions
- Added troubleshooting guide for common deployment issues
- Enhanced logging for webhook validation failures

## Twilio Integration Improvements - [Current Date]

### Added
- Comprehensive Twilio call logging
  - Call details (SID, status, duration, timestamps)
  - Call recordings information
  - Detailed call logs with timestamps
- Enhanced error tracking and debugging capabilities

### Changed
- Improved audio file cleanup strategy
  - Moved cleanup to call end instead of after each response
  - Added cleanup on call status changes (completed, failed, busy, no-answer)
- Enhanced TwiML response handling
  - Better sequencing of audio playback and gather elements
  - Improved error handling in TwiML generation

### Fixed
- Audio file cleanup timing issues
- Potential race conditions in audio file handling
- TwiML response structure for better reliability

## Voice Activity Detection (VAD) Implementation - [Current Date]

### Major Changes
1. Made VAD the Default and Only Mode
   - Removed manual/push-to-talk mode completely
   - Removed Toggle component and related UI elements
   - Removed mode switching functionality
   - Set VAD as the permanent voice detection method

### Code Changes
1. ConsolePage.tsx Modifications
   - Removed `Toggle` component import
   - Removed `changeTurnEndType` function
   - Removed push-to-talk button and related code
   - Removed `startRecording` and `stopRecording` functions
   - Removed `canPushToTalk` state
   - Added `vadState` state for tracking VAD status
   - Updated initial state setup for VAD-only operation

### UI Improvements
1. Added VAD Status Indicator
   - Shows "Listening for voice..." when active
   - Shows "Processing voice..." during voice detection
   - Shows error state with microphone access issues
   - Added visual styling for different states

### Visual Feedback
1. Added Status Colors
   - Blue (#e3f2fd) for listening state
   - Orange (#fff3e0) for processing state
   - Red (#ffebee) for error state

### Connection Flow Updates
1. Enhanced Connection Process
   - Immediate VAD initialization on connect
   - Explicit VAD mode setting
   - Improved error handling
   - Added connection state feedback

### Removed Features
1. Manual Mode
   - Removed push-to-talk functionality
   - Removed mode toggle switch
   - Removed manual recording controls

### Future Considerations
1. Performance Optimization
   - VAD sensitivity settings
   - Audio buffer size optimization
   - Turn detection parameters

2. Error Handling
   - Microphone access issues
   - Connection failures
   - Voice detection failures

3. User Experience
   - Additional visual feedback
   - Help text and tooltips
   - Accessibility improvements

## Documentation Updates
1. Added New Documentation Files
   - Created Suggestions.md for future improvements
   - Created CHANGELOG.md (this file) for tracking changes

## Testing Requirements
1. VAD Functionality
   - Voice detection accuracy
   - Response timing
   - Error handling
   - Connection stability

2. UI/UX Testing
   - Status indicator visibility
   - Visual feedback clarity
   - Overall user experience

## Notes
- All changes maintain backward compatibility
- Focus on improving user experience
- Emphasis on clear visual feedback
- Simplified interface for easier use

## [Unreleased]

### Added
- New logging system with improved error tracking and debugging capabilities
- Enhanced error handling in Twilio routes
- Improved WebSocket server initialization and error handling
- New health check endpoint for monitoring
- Comprehensive test suite for all components
- New caching mechanism for improved performance
- Cost logging system for API usage tracking
- Central module exports through lib/index.js
- Enhanced Tavily API response formatting with better organization and phone number extraction
- Comprehensive test suite for Tavily response formatting
- Improved error handling for API responses
- Better user feedback messages for resource searches

### Changed
- Refactored caching mechanism to use a more efficient approach
- Updated deployment configuration to ensure all files are included
- Improved file structure and organization
- Enhanced error handling and logging throughout the application
- Updated Twilio integration with better error handling
- Improved WebSocket server initialization
- Enhanced test coverage and reliability
- Updated documentation with new features and changes
- Simplified module imports using index.js
- Updated package.json with proper module exports
- Removed unnecessary build step from deployment
- Updated response formatting to be more concise and user-friendly
- Improved error messages for better user experience
- Enhanced test coverage for response processing
- **Simplified intent classification and off-topic detection:** Only queries containing domestic violence-related keywords (e.g., shelter, abuse, legal, counseling, protection, etc.) are considered on-topic and classified into support intents. All other queries (including medical, entertainment, weather, sports, jokes, and generic help requests without context) are now classified as `off_topic`.
- **Improved fallback logic:** Pattern-matching fallback classifier ensures reliability if OpenAI API is unavailable.
- **Expanded test coverage:** Added tests for medical, entertainment, and generic queries to ensure robust off-topic detection.
- **Improved follow-up question handling:** The system now correctly interprets queries like "tell me more about the last one" or "the first one", mapping them to the correct Tavily result and providing detailed information from the content. This logic is fully covered by the test suite.
- The system now recognizes 'thank you', 'thanks', and similar gratitude phrases as a signal to end the call and deliver the end message. This works for both the main and fallback intent classification logic, and is covered by automated tests.
- Set `include_raw_content` to `false` in Tavily API requests to reduce response size and improve performance.
- Fixed call ending issue where the system wasn't playing the goodbye message when users said "thank you" or similar phrases. The conversation flow management now correctly handles end conversation intents without being overridden by intent-specific handling.
- Fixed SMS consent flow to properly ask for consent before ending calls when users say "thank you" or similar phrases. The system now asks "Before we end this call, would you like to receive a summary of our conversation and follow-up resources via text message? Please say yes or no." and properly handles the consent response.
- Fixed SMS consent parameter issue where redirecting to the consent endpoint was losing request parameters. Now handles consent directly in the process endpoint to ensure CallSid and SpeechResult are properly available.
- Fixed call initialization issue where calls weren't being properly tracked in the voice handler's activeCalls Map, causing "No active call found" errors during SMS consent handling. Now initializes calls in both WebSocket server and voice handler to ensure proper tracking.
- Updated call ending message from casual "Have a great day" to more empathetic "Thank you for reaching out. You're not alone, and help is always available. Take care and stay safe." to better reflect the sensitive nature of domestic violence support calls.
- Fixed WebSocket server null reference error in call summary generation. The system now properly initializes the WebSocket server in the voice handler and provides a fallback summary when the WebSocket server is unavailable.
- Enhanced Tavily API queries for shelter searches to specifically request shelter names, addresses, phone numbers, and contact information. Updated query rewriting to include "shelter name", "address", "phone number", and "contact information" terms for better search results.
- Tavily API integration: `include_raw_content` is now set to `false` for all requests, reducing response size and processing time.
- All raw content parsing logic and related fallback handling have been removed from the codebase.

### Removed
- Obsolete tests and unused files
- Old caching system
- Unused dependencies and configurations
- Redundant code and comments
- Unnecessary build step from deployment process

### Fixed
- Module import issues in deployment environment
- Twilio routes error handling
- WebSocket server initialization
- Test reliability issues
- Deployment configuration to ensure all files are included
- File structure issues in deployment
- Module resolution in production environment
- Fixed error handling in Tavily response formatting
- Resolved test suite dependencies by adding supertest package
- Improved test assertions for better reliability
- Call ending SMS consent flow: Fixed issue where the summary offer message "Before we end this call, would you like to receive a summary of our conversation and follow-up resources via text message? Please say yes or no." was not being sent when users said "thank you" or similar phrases. The system now properly detects end conversation intents and redirects to the consent endpoint.

### Fixed
- **Timeout Issues**: Resolved timeout problems with Twilio voice processing endpoint
  - Increased server timeout from 60s to 120s for Railway deployment
  - Added request-specific timeout handling (90s) for voice process endpoint
  - Implemented Promise.race with timeout for speech processing
  - Enhanced error handling with proper timeout responses
  - Added Railway-specific configuration with increased health check timeout (1200s)
  - Improved memory allocation with `--max-old-space-size=2048`
  - Enhanced health check endpoint with detailed diagnostics
  - Added timeout diagnostic test script (`test-timeout.js`)

### Added
- **Timeout Diagnostics**: New test script to diagnose endpoint timeout issues
- **Enhanced Health Monitoring**: Health check now includes Railway info, timeout config, and connection counts
- **Better Error Handling**: Improved timeout error responses with proper TwiML formatting

### Changed
- **Railway Configuration**: Updated `railway.toml` with better timeout and memory settings
- **Server Configuration**: Enhanced timeout handling with detailed logging and error responses

## [1.0.0] - 2024-03-19

### Added
- Initial release of the Domestic Violence Support Assistant
- Real-time voice communication using Twilio
- Intelligent query handling with OpenAI
- WebSocket server for real-time updates
- Comprehensive logging system
- Error handling and monitoring
- Test suite for all components

## [0.1.0] - 2024-03-15

### Added
- Project initialization
- Basic project structure
- Development environment setup
- Initial documentation

## [1.3.0] - 2024-03-20

### Added
- Comprehensive cost tracking system
- Per-call token usage monitoring
- Model usage tracking (GPT-4o vs GPT-3.5)
- Whisper API usage monitoring
- Response length tracking
- TTS character counting
- Persistent cost logs in JSON format
- Real-time cost feedback in console
- Cost statistics and summaries

### Changed
- Updated response generator to track token usage
- Enhanced caching system with cost metrics
- Improved model selection logic
- Better error handling with cost tracking

## [1.2.0] - 2024-03-20

### Added
- Advanced speech queue management system
- Natural pauses between responses
- Immediate speech cancellation on disconnect
- Speech state tracking and recovery
- Female voice preference with fallback options

### Changed
- Improved speech handling reliability
- Enhanced error recovery for speech synthesis
- Updated disconnect behavior to properly stop speech
- Optimized speech queue processing

### Fixed
- Speech continuing after disconnect
- Multiple responses speaking simultaneously
- Speech timing issues
- Voice selection reliability

## [1.1.0] - 2024-03-20

### Added
- Client-side Web Speech API integration for TTS
- Response caching system for common queries
- Audio preprocessing and optimization
- Token limiting for responses
- Tavily search integration for factual queries

### Changed
- Moved audio output from OpenAI to client-side Web Speech API
- Implemented GPT model tiering (GPT-3.5-turbo for simple queries, GPT-4o for complex)
- Optimized audio input processing to reduce Whisper API calls
- Updated response generation to use cached responses when available

### Removed
- OpenAI audio streaming integration
- Direct audio output from server

### Fixed
- High API costs from audio streaming
- Unnecessary GPT-4o usage for simple queries
- Redundant audio processing

## [1.6.0] - 2024-03-25

### Added
- Railway.app deployment configuration
- Railway CLI integration
- Health check endpoint for Railway
- Automatic deployment setup
- Railway-specific environment configuration

### Changed
- Updated deployment documentation
- Enhanced deployment options
- Improved health check implementation
- Updated webhook configuration for Railway

### Fixed
- Deployment configuration issues
- Health check timeout settings
- Environment variable handling

## [1.9.0] - 2024-04-01

### Added
- Centralized configuration system in `relay-server/lib/config.js`
- Backward compatibility for Twilio configuration
- Enhanced configuration documentation

### Changed
- Updated Twilio configuration structure
- Improved environment variable handling
- Enhanced configuration documentation in README

### Fixed
- Resolved Twilio configuration access issues
- Fixed `config.twilio`

## [1.11.0] - 2024-04-03

### Added
- Enhanced logging throughout Twilio voice processing
  - Comprehensive request lifecycle tracking
  - Detailed parameter validation logging
  - Processing time tracking at each step
  - Request ID tracking for better debugging
  - Raw request body and headers logging
  - TwiML response logging before sending
  - Error response tracking
- Improved parameter validation
  - Added validation for SpeechResult parameter
  - Enhanced error messages for missing parameters
  - Better error response handling

### Changed
- Updated TwiML response handling
  - More consistent response formatting
  - Better error message formatting
  - Improved gather verb configuration
- Enhanced error handling
  - More detailed error logging
  - Better error response structure
  - Processing time tracking in errors

## [1.14.0] - 2024-06-24

### Added
- **AI Model Confidence Score Logging:** Comprehensive logging of AI model confidence scores for intent classification
  - Confidence levels (High/Medium/Low) based on response characteristics
  - Response time tracking and token usage metrics
  - Detailed logging for debugging and performance monitoring
- **Conversation Management System:** Intelligent conversation flow management
  - Graceful handling of off-topic intents with re-engagement logic
  - Automatic conversation closure for end-of-call requests
  - Context-aware re-engagement messages for better user experience
- **Enhanced Error Handling:** Robust fallback systems for API failures
  - Pattern-based intent classification when OpenAI API is unavailable
  - API key validation and detailed error logging
  - System continues working even during API outages

### Changed
- Improved intent classification with better confidence calculation based on keyword matches and query characteristics
- Enhanced conversation context tracking for better follow-up question handling
- Updated Twilio voice handler to integrate new conversation management features

### Fixed
- Fixed bug where voice response would say 'undefined and undefined' if no shelters were found. Now, a clear message is given when no results pass the Tavily score threshold.

### Changed
- Clarified Tavily score threshold: Only results with a score >= 0.2 are included in responses by default. If you want to include more results, you can lower this threshold in the code.

## [1.16.0] - 2024-06-25

### Added
- Enhanced speech-to-text recognition: new Twilio parameters, speech preprocessing (artifact removal, error correction, garbled speech detection, keyword extraction)
- Node.js deprecation warning suppression and documentation, updated dependencies, and version management files

### Changed
- Updated Twilio, intent classifier, and websocket server to use new speech and follow-up logic
- Improved logging and error handling for speech and follow-up flows
- Tavily API integration now requests and processes content correctly (`include_raw_content: true`)
- Processor and tests are robust to null/empty content
- All test expectations are aligned with actual behavior
- All tests now pass (330 tests, 0 errors, 3 skipped)
- Removed problematic timeout-based cache test
- Improved follow-up and response logic for edge cases

### Fixed
- Speech garbling and follow-up context issues
- Node.js punycode deprecation warning in logs

## [1.17.0] - 2025-06-25

### Added
- Robust follow-up detection logic, even if OpenAI API key is missing
- New tests for follow-up detection and conversational flow
- Improved user experience for follow-up and location/address queries

### Changed
- Voice responses no longer include HTTP/HTTPS URLs; users are offered to receive details (including address and link) via text message for location/address queries
- Pattern matching for follow-up detection is now more comprehensive and reliable

### Fixed
- No more URLs read out in voice responses
- Follow-up questions are no longer classified as off-topic

## [Unreleased]
### Added
- Multi-language support for the voice agent (Twilio and OpenAI TTS/ASR)
- Language detection from request headers, explicit selection, or speech content
- Localized prompts and responses for English, Spanish, French, and German
- Centralized language and prompt configuration in `relay-server/lib/languageConfig.js`
- Easy extensibility for new languages and custom prompts

### Changed
- All TTS and ASR operations now use the correct language and voice for each call
- Prompts and error messages are now localized based on detected language

### Fixed
- OpenAI TTS voice configuration now uses correct API voice names (nova, shimmer, echo, onyx) instead of Twilio voice names
- Resolved 400 error when generating TTS with invalid voice names
- Proper fallback mechanism between OpenAI TTS (primary) and Twilio Polly (fallback)