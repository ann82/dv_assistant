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
- Detailed timing metrics for request processing
- Request abort handling and logging
- Improved error handling with user-friendly messages
- Enhanced logging for better debugging

### Changed
- Optimized Tavily API integration:
  - Added response caching with 30-minute TTL
  - Implemented cache size management (max 1000 entries)
  - Added 10-second timeout for API calls
  - Reduced API payload size and search depth
  - Added fallback to expired cache on API errors
- Updated location prompts to include example cities
- Improved error messages for better user experience

### Fixed
- Fixed request abort handling to prevent server hanging
- Fixed location prompt test to include example cities
- Fixed duplicate route path issue in Twilio integration

### Security
- Attempted to update dev dependencies (esbuild, vite, vitest) to address moderate vulnerabilities. Some advisories remain due to upstream issues in the testing toolchain. These do not affect production code.

## [1.0.0] - 2024-03-19

### Added
- Initial release
- Twilio voice call integration
- Tavily API integration for resource search
- WebSocket server for real-time communication
- Audio file handling and caching
- Basic error handling and logging

// ... existing changelog entries ... 