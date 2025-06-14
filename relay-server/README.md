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

### Deployment
- Added Railway deployment support
- Enhanced WebSocket configuration for cloud deployment
- Improved environment variable handling
- Added deployment documentation

### Bug Fixes
- Fixed duplicate export issues in twilio.js
- Resolved duplicate function declarations
- Improved error handling in speech processing

### Improvements
- Enhanced response formatting system for better user experience
- Improved location extraction from speech input with more natural language patterns
- Updated location prompts with better examples and more natural language
- Added comprehensive test coverage for all new features

## Deployment

### Railway Deployment

1. **Prerequisites**
   - A Railway account
   - A Twilio account with voice capabilities
   - Your application code in a Git repository

2. **Environment Variables**
   Set these in your Railway project settings:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   NODE_ENV=production
   LOG_LEVEL=info
   ```

3. **Deployment Steps**
   - Connect your repository to Railway
   - Railway will automatically detect the Node.js application
   - The Procfile will be used to start the application
   - Railway will provide a URL for your application

4. **Post-Deployment**
   - Update your Twilio webhook URL to point to your Railway URL:
     ```
     https://your-railway-app-url.railway.app/twilio/voice
     ```
   - Test the connection with a test call
   - Monitor the logs in Railway for any issues

### Local Development

1. **Environment Setup**
   Create a `.env` file with:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   NODE_ENV=development
   LOG_LEVEL=debug
   WS_PORT=3001
   ```

2. **Installation**
   ```bash
   npm install
   ```

3. **Running the Server**
   ```bash
   npm start
   ```

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```