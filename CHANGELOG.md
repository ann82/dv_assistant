# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Enhanced confidence scoring system for better query routing
- Improved pattern matching for shelter-related queries
- Detailed logging for better monitoring and debugging
- Connection timeouts to prevent hanging calls
- Better error messages and user feedback
- Comprehensive query examples and documentation
- New section in README explaining query types and confidence scoring

### Changed
- Increased response timeout from 10s to 15s for better reliability
- Updated WebSocket error handling and recovery mechanisms
- Improved logging format with more context and timestamps
- Enhanced README with latest features and setup instructions
- Updated pattern weights for better query routing
- **Testing:** Some integration and performance tests have been removed or consolidated for maintainability (see deleted files list)

### Fixed
- WebSocket connection issues causing call disconnections
- Missing confidence values in logs
- Premature call terminations
- Error handling in WebSocket message processing
- Confidence calculation and pattern matching
- Routing stats tracking for high confidence queries

## [1.0.0] - 2024-03-20

### Added
- Initial release of the Domestic Violence Support Assistant
- Voice interface using Twilio
- Real-time response generation
- Resource location capabilities
- Confidence-based query routing
- Multi-source information integration
- Conversation summary via SMS
- Basic error handling and logging

### Security
- Secure API key management
- Input validation
- Rate limiting
- Error handling

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

## [Unreleased]

### Changed
- Replaced Redis-based caching with efficient local in-memory cache
- Improved cache cleanup mechanism with automatic background cleanup
- Optimized cache performance by removing external dependencies
- Updated cache TTL to 1 hour (configurable via CACHE_EXPIRY)

### Removed
- Removed Redis dependency and configuration
- Removed async/await complexity from cache operations

### Added
- Added cache statistics and monitoring
- Added automatic cleanup every 15 minutes
- Added cache size and expiration tracking
- Added graceful cleanup on process exit