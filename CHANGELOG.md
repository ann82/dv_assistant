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
- Type-safe cache management with private methods
- Encapsulated cache logic for better maintainability
- Automatic cache cleanup for expired entries
- Periodic cache maintenance with setInterval

### Changed
- Improved error handling for API calls
- Enhanced user experience during rate limits
- Updated shelter search functionality with caching
- Refactored cache implementation to use class-based approach
- Improved type safety in cache operations
- Enhanced cache key generation and validation
- Optimized cache memory usage
- Restored and improved UI components:
  - Connect/disconnect button
  - Map component for shelter locations
  - Conversation display
  - VAD status indicator

### Technical Improvements
- Added TypeScript interfaces for cache entries
- Enhanced error handling and logging
- Implemented robust caching layer
- Improved code organization with class-based structure
- Added private methods for internal cache operations
- Added explicit return types for cache functions
- Implemented automatic cache cleanup
- Enhanced type safety throughout the application

### Performance
- Added caching for location-based shelter search results
- Implemented efficient API call handling
- Reduced redundant API calls with cache
- Optimized cache key generation
- Improved memory usage with encapsulated cache implementation
- Added automatic cleanup of expired cache entries
- Enhanced cache hit/miss logging

### User Experience
- Enhanced query handling for shelter searches
- Improved result presentation
- Faster response times with caching
- Better error messages and logging
- More reliable shelter search results
- Improved UI responsiveness
- Enhanced visual feedback for cache operations

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