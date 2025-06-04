# Changelog

## [Unreleased]

### Added
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

### Changed
- Improved query analysis with weighted pattern matching
- Enhanced logging with detailed performance metrics
- Optimized response generation with parallel processing for medium confidence queries

### Fixed
- Memory leak in confidence analysis caching
- Response time tracking accuracy
- Cache cleanup timing issues

// ... existing changelog entries ... 