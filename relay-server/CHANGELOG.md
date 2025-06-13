# Changelog

All notable changes to this project will be documented in this file.

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

### Security
- Attempted to update dev dependencies (esbuild, vite, vitest) to address moderate vulnerabilities. Some advisories remain due to upstream issues in the testing toolchain. These do not affect production code.
- Attempted to update development dependencies to address vulnerabilities

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

// ... existing changelog entries ... 