# Domestic Violence Support Assistant

A comprehensive system for providing support and resources to individuals affected by domestic violence.

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
- Enhanced response formatting system with multi-format support
- Improved location extraction to handle various speech patterns
- Updated location prompts to include example cities
- Enhanced error handling and logging
- Comprehensive test coverage for speech processing and response formatting

### Bug Fixes
- Fixed duplicate export issues in twilio.js
- Resolved duplicate function declarations
- Improved error handling in speech processing

### Improvements
- Enhanced response formatting system for better user experience
- Improved location extraction from speech input with more natural language patterns
- Updated location prompts with better examples and more natural language
- Added comprehensive test coverage for all new features

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```