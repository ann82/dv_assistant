# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Rate limit handling with automatic retry
- Visual alert banner for rate limits
- Graceful disconnection/reconnection
- Shelter search functionality with Tavily API integration
- Comprehensive logging for API calls and cache operations
- Class-based caching implementation for shelter search results
- Twilio SDK integration for call and message handling
- Initial setup for Twilio webhook endpoints
- Environment variables for Twilio configuration
- Twilio credential setup documentation
- Twilio webhook endpoints for voice and messaging

### Changed
- Updated dependencies to include Twilio SDK
- Modified relay server to handle Twilio webhooks
- Added Express server for Twilio webhook handling
- Separated WebSocket and HTTP servers to different ports
- Configured Twilio webhook URLs for voice and messaging endpoints
- Updated ngrok tunnel configuration for public access

### Security
- Added secure storage for Twilio credentials
- Implemented webhook authentication
- Added rate limiting for Twilio endpoints
- Added environment variable validation for Twilio credentials

### Documentation
- Added Twilio integration suggestions to Suggestions.md
- Updated CHANGELOG.md with Twilio-related changes
- Added Twilio credential setup instructions
- Documented webhook endpoint structure
- Added ngrok configuration documentation

### Fixed
- Fixed Twilio request validation by using instance auth token instead of environment variable
- Updated Twilio webhook validation to properly handle incoming requests
- Corrected message webhook endpoint from '/twilio/messages' to '/twilio/message'

### Changed
- Enhanced Twilio request logging for better debugging
- Updated server initialization to include detailed Twilio debugging
- Modified TwilioHandler class to store auth token as instance variable

### Added
- Added detailed logging for Twilio request validation
- Added comprehensive request debugging for voice and message webhooks
- Added validation for Twilio CallSid parameter

### Documentation
- Added notes about Twilio trial account limitations
- Updated webhook configuration instructions
- Added troubleshooting steps for common Twilio issues

## [Unreleased]

### Added
- Rate limit handling for 429 errors with automatic retry after 10-second cooldown
- Visual rate limit alert banner to inform users when they are being rate limited
- Graceful disconnection and reconnection when rate limits are encountered
- Tavily API integration for shelter search functionality
- Location-based shelter search with support for:
  - Current location detection
  - Specified location search
  - Reverse geocoding for city names
- Comprehensive logging system for API calls including:
  - Request/response logging
  - Error tracking
  - Location detection logs
  - API rate limit monitoring
  - Performance metrics
- Tavily API results caching with:
  - 24-hour cache expiration
  - Location and service-based cache keys
  - Automatic cache invalidation
  - Cache hit/miss logging
  - Memory-efficient storage

### Changed
- Improved error handling in ConsolePage component to handle rate limit errors
- Enhanced user experience during rate limit periods with clear visual feedback
- Updated shelter search to use Tavily API for more accurate and comprehensive results
- Enhanced location handling with fallback options and error recovery
- Updated AI prompt to better handle location-based queries and shelter searches
- Optimized API calls with caching to reduce:
  - API rate limit exposure
  - Response times for repeated queries
  - Network bandwidth usage
  - Server load

### Technical Improvements
- Added TypeScript interfaces for API responses and location data
- Implemented robust error handling for API calls
- Added detailed logging for debugging and monitoring
- Improved location detection with reverse geocoding support
- Enhanced API response processing and data formatting
- Added caching layer for API responses
- Implemented cache key generation and validation
- Added cache expiration and cleanup

### Security
- Added environment variable handling for API keys
- Implemented secure API key storage and usage
- Added input validation for location data
- Enhanced privacy guidelines in AI prompt
- Added data protection instructions for location handling

### Performance
- Added caching for location data
- Implemented efficient API call handling
- Added rate limit monitoring and prevention
- Reduced API calls through caching
- Optimized response times for repeated queries
- Improved memory usage with efficient cache storage

### User Experience
- Improved location-based query handling
- Enhanced shelter search result presentation
- Added clear privacy explanations
- Improved error messaging and recovery
- Enhanced conversational flow for location sharing 