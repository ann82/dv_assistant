# Domestic Violence Support Assistant

A voice-based AI assistant that provides support and resources for people experiencing domestic violence. The system uses Twilio for voice calls, OpenAI's GPT for conversation, and Whisper for speech recognition.

## Features

- Voice-based interaction using Twilio
- Real-time speech recognition and transcription
- AI-powered responses using GPT-4
- Text-to-speech using OpenAI's TTS
- Secure and private communication
- Multi-language support
- Resource recommendations
- Emergency contact information
- Comprehensive call logging and monitoring
- Enhanced error handling and debugging
- Optimized build process for better performance

### Voice Call Support
- Real-time voice conversation with AI assistant
- Natural language processing for understanding user needs
- Resource recommendations based on conversation context
- Multi-language support (currently optimized for English)

### SMS Integration
- Call summary delivery via SMS
- Consent-based communication
- Opt-out functionality
- Secure message handling

### Privacy and Consent
- Explicit consent collection at call start
- User-controlled communication preferences
- Secure storage of call summaries
- Easy opt-out process

### Cache System

The application uses an intelligent caching system to improve performance and reduce API calls:

1. **Size Management**
   - Maximum cache size: 1000 entries
   - Automatic removal of oldest entries when full
   - 20% cleanup when size limit is reached

2. **Cleanup**
   - Automatic cleanup every 5 minutes
   - Expired entries removed based on 24-hour TTL
   - Memory usage monitoring and logging

3. **Debug Logging**
   - Cache size and memory usage tracking
   - Entry removal logging
   - Performance monitoring

### Twilio Voice Integration

The system provides natural voice conversations with several improvements:

1. **Context-Aware Responses**
   - Intelligent handling of conversation flow
   - Automatic detection of conversation endings
   - No unnecessary prompts after farewells

2. **Voice Features**
   - High-quality voice synthesis
   - Natural conversation flow
   - Automatic speech recognition
   - Consent-based SMS summaries

3. **Error Handling**
   - Robust error recovery
   - Automatic retries for failed operations
   - Detailed error logging

## System Architecture

The system consists of three main components:

1. **Twilio WebSocket Server** (`relay-server/`)
   - Handles incoming voice calls
   - Manages WebSocket connections
   - Processes audio streams
   - Coordinates with AI services
   - Provides detailed call logging
   - Manages audio file lifecycle

2. **AI Services** (`relay-server/services/`)
   - Speech-to-text using Whisper
   - Conversation handling using GPT-4
   - Text-to-speech using OpenAI TTS
   - Audio processing and management

3. **Web Interface** (`web/`)
   - Admin dashboard
   - Call monitoring
   - Resource management
   - Analytics
   - Call logs and debugging information

## Build and Performance Optimization

The project includes several optimizations for better build performance and reduced memory usage:

1. **Module System**
   - ES modules for production builds
   - CommonJS transformation for tests
   - Proper module compatibility in all environments
   - Optimized module loading and transformation

2. **Memory Management**
   - Limited Node.js memory usage to 512MB
   - Optimized chunk sizes for better loading
   - Filesystem caching for faster builds
   - Performance budgets for bundle sizes

3. **Build Process**
   - Code splitting for better loading times
   - Vendor chunking for third-party dependencies
   - Production-only optimizations
   - Minification and compression
   - Environment-specific configurations

4. **Dependencies**
   - Optimized package structure
   - Separated development and production dependencies
   - Removed unnecessary packages
   - Better dependency management

### Build Configuration

The project uses a modern build setup with the following features:

1. **Webpack Configuration**
   - Production and development modes
   - Code splitting and lazy loading
   - Asset optimization
   - Source map generation
   - Hot module replacement for development

2. **Babel Configuration**
   - ES modules support
   - React and TypeScript presets
   - Environment-specific transformations
   - Test environment optimizations

3. **Test Configuration**
   - Vitest for ESM tests
   - Jest for CommonJS tests
   - Environment-specific test settings
   - Coverage reporting

### Build Commands

```bash
# Production build
npm run build

# Development server
npm run dev

# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Test coverage
npm run test:coverage
```

## Setup

### Prerequisites

- Node.js 18+
- Twilio account with a phone number
- OpenAI API key
- ngrok or similar for local development

### Environment Variables

Create a `.env` file in the root directory:

```env
# API Keys
TAVILY_API_KEY=your_tavily_api_key
OPENAI_API_KEY=your_openai_api_key

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Server Configuration
PORT=3000
WS_PORT=3001
NODE_ENV=development
LOG_LEVEL=debug  # Options: error, warn, info, debug
```

**Note:** For local testing, no real Twilio or OpenAI credentials are required due to comprehensive mocks. The test script in `package.json` sets `OPENAI_API_KEY` automatically.

### Configuration

The application uses a centralized configuration system in `relay-server/lib/config.js`. The configuration includes:

1. **API Keys**
   - OpenAI API key
   - Tavily API key
   - ElevenLabs API key

2. **Twilio Configuration**
   - Account SID
   - Auth Token
   - Phone Number
   - Both top-level and nested `twilio` object for backward compatibility

3. **Voice Settings**
   - ElevenLabs Voice ID
   - Audio processing parameters
   - Response settings

4. **Server Settings**
   - Port configuration
   - WebSocket port
   - Logging level

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. For production build:
```bash
npm run build
npm start
```

4. Set up Twilio webhook:
   - Voice webhook URL: `https://your-domain/twilio/voice`
   - Status callback URL: `https://your-domain/twilio/status`

### Testing

The project includes a comprehensive and robust test suite for the Twilio webhook handler, WebSocket server, and audio service logic:

1. Run tests:
```bash
npm test
```

2. Test Coverage:
   - Webhook request validation
   - Error handling scenarios
   - Mock service interactions (Twilio, WebSocket, file system, OpenAI)
   - Response formatting
   - Edge cases and error conditions
   - WebSocket connection and event handling
   - Audio file verification and error simulation

3. Test Structure:
   - Extensive use of advanced mock implementations for Twilio, OpenAI, WebSocket, and file system modules
   - All external dependencies are mocked before imports to ensure isolation and reliability
   - Isolated test cases for each scenario
   - Proper error handling verification
   - Response validation
   - Event-driven logic simulation

4. Common Test Scenarios:
   - Valid webhook requests
   - Invalid request handling
   - Service and file system errors
   - WebSocket connection/disconnection
   - Response formatting
   - Error message validation

**Recent Improvements:**
- Unified and advanced mocking for Twilio, OpenAI, WebSocket, and file system modules
- Mocked `twilio.twiml.VoiceResponse` with all required methods for TwiML response generation
- Mocked config to include a `twilio` object with `accountSid`, `authToken`, and `phoneNumber`
- Test script in `package.json` now sets `OPENAI_API_KEY` automatically for all test runs
- Improved reliability and coverage of the test suite
- All tests now pass, ensuring high confidence in code changes

**Example: Advanced Mocking in Tests**
```js
vi.mock('twilio', () => {
  class VoiceResponse {
    constructor() {
      this.say = vi.fn();
      this.play = vi.fn();
      this.gather = vi.fn().mockReturnValue({
        say: vi.fn(),
        play: vi.fn(),
        pause: vi.fn()
      });
      this.pause = vi.fn();
      this.connect = vi.fn().mockReturnValue({ stream: vi.fn() });
      this.toString = vi.fn().mockReturnValue('<Response></Response>');
    }
  }
  const twilio = vi.fn().mockImplementation(() => ({
    calls: { fetch: vi.fn() },
    messages: { create: vi.fn() },
    recordings: { list: vi.fn() }
  }));
  twilio.twiml = { VoiceResponse };
  twilio.validateRequest = vi.fn().mockReturnValue(true);
  return {
    default: twilio,
    twiml: { VoiceResponse },
    validateRequest: vi.fn().mockReturnValue(true)
  };
});

vi.mock('../relay-server/lib/config.js', () => ({
  config: {
    TWILIO_ACCOUNT_SID: 'ACxxxx...',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    twilio: {
      accountSid: 'ACxxxx...',
      authToken: 'test-auth-token',
      phoneNumber: '+1234567890'
    }
  }
}));
```

### Troubleshooting

- If tests fail due to missing config properties, ensure the config mock includes the `twilio` object with `accountSid`, `authToken`, and `phoneNumber`.
- If you see errors about missing environment variables, confirm that the test script in `package.json` sets `OPENAI_API_KEY` or set it manually in your shell.

## Deployment

### Local Development with ngrok
For local development, you can use ngrok to create a temporary public URL:
1. Install ngrok: `npm install -g ngrok`
2. Start your server: `npm start`
3. Start ngrok: `ngrok http 3000`
4. Update your Twilio webhook URL with the ngrok URL

Note: ngrok URLs are temporary and will change each time you restart ngrok. For production, use a proper hosting service.

### Production Deployment
For production deployment, we recommend using Render.com or Railway.app:

1. **Railway.app Setup**
   - Create an account on [Railway.app](https://railway.app)
   - Install the Railway CLI: `npm i -g @railway/cli`
   - Login to Railway: `railway login`
   - Initialize your project: `railway init`
   - Link your repository: `railway link`
   - Add the following environment variables in Railway dashboard:
     ```
     # OpenAI Configuration
     OPENAI_API_KEY=your_openai_api_key

     # Twilio Configuration
     TWILIO_ACCOUNT_SID=your_twilio_account_sid
     TWILIO_AUTH_TOKEN=your_twilio_auth_token
     TWILIO_PHONE_NUMBER=your_twilio_phone_number

     # Server Configuration
     NODE_ENV=production
     PORT=3000
     ```
   - Deploy your application:
     ```bash
     # Deploy from CLI
     railway up
     
     # Or deploy from GitHub
     # 1. Connect your GitHub repository in Railway dashboard
     # 2. Enable automatic deployments
     ```
   - Update your Twilio webhook URLs to point to your Railway domain:
     - Voice webhook: `https://your-railway-domain.railway.app/twilio/voice`
     - Status callback: `https://your-railway-domain.railway.app/twilio/status`

   **Health Check Configuration**
   - The application includes a health check endpoint at `/health`
   - Railway automatically monitors this endpoint
   - The health check provides:
     - Server status
     - Memory usage
     - Uptime
     - Environment information
   - Configure in `railway.toml`:
     ```toml
     [deploy]
     healthcheckPath = "/health"
     healthcheckTimeout = 100
     restartPolicyType = "always"
     ```

   **Troubleshooting Deployment**
   - Check Railway logs for detailed error messages
   - Verify all environment variables are set
   - Ensure package.json and package-lock.json are in sync
   - Monitor memory usage through the health check endpoint
   - Check server startup logs for any initialization issues

2. **Render.com Setup**
   - Create an account on render.com
   - Connect your GitHub repository
   - Create a new Web Service
   - Configure the following:
     - Build Command: `npm run build`
     - Start Command: `npm start`
     - Node Version: 18 (or latest LTS)
   - Add the following environment variables:
     ```
     # OpenAI Configuration
     OPENAI_API_KEY=your_openai_api_key

     # Twilio Configuration
     TWILIO_ACCOUNT_SID=your_twilio_account_sid
     TWILIO_AUTH_TOKEN=your_twilio_auth_token
     TWILIO_PHONE_NUMBER=your_twilio_phone_number

     # Server Configuration
     NODE_ENV=production
     PORT=10000  # Render will override this
     ```

### Build Optimization

The project includes several build optimizations to ensure efficient deployment:

1. **Memory Management**
   - Node.js memory limit set to 512MB
   - Optimized chunk sizes
   - Filesystem caching
   - Performance budgets

2. **Build Process**
   - Code splitting
   - Vendor chunking
   - Production optimizations
   - Minification

3. **Dependencies**
   - Optimized package structure
   - Development/production separation
   - Removed unnecessary packages

### Troubleshooting

#### Common Issues

1. **403 Forbidden Errors**
   - Check if your Twilio webhook URL is correct
   - Verify that your Twilio credentials are valid
   - Ensure your server is accessible from the internet

2. **404 Not Found for Audio Files**
   - Verify that audio files are in the correct directory (`relay-server/public/audio`)
   - Check file permissions
   - Ensure the static file serving is configured correctly

3. **Webhook Validation Failures**
   - Verify your Twilio Auth Token
   - Check if the request is coming from Twilio
   - Ensure your server is using HTTPS

4. **Audio Playback Issues**
   - Check if the audio files are being generated correctly
   - Verify the audio file paths in the TwiML response
   - Ensure the audio files are accessible via the public URL

5. **Build Memory Issues**
   - Check the `.npmrc` configuration
   - Verify webpack memory settings
   - Ensure proper chunk sizes
   - Monitor build performance

## Development

### Project Structure

```
├── relay-server/
│   ├── lib/
│   │   ├── config.js
│   │   └── twilio.js
│   ├── routes/
│   │   └── twilio.js
│   ├── services/
│   │   └── audioService.js
│   ├── public/
│   │   └── audio/
│   ├── websocketServer.js
│   └── index.js
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
├── public/
├── webpack.config.js
└── package.json
```

### Running Tests

```bash
npm test
```

### Debugging

The system provides comprehensive logging for debugging:

1. **Call Logs**
   - Call details (SID, status, duration)
   - Recording information
   - Status changes
   - Error events

2. **Audio Processing**
   - File creation and cleanup
   - TTS generation
   - Stream handling

3. **Error Tracking**
   - Detailed error messages
   - Stack traces
   - Call context information

4. **Build Performance**
   - Bundle size monitoring
   - Chunk analysis
   - Memory usage tracking
   - Build time metrics

## Security

- All communications are encrypted
- No call recordings are stored
- Secure handling of sensitive information
- Regular security audits
- Proper cleanup of temporary audio files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Call Flow

1. **Initial Contact**
   - User calls the support line
   - System plays welcome message
   - Requests consent for SMS follow-up
   - User provides verbal consent

2. **Main Conversation**
   - AI assistant engages in conversation
   - Provides support and resources
   - Tracks conversation for summary

3. **Call Conclusion**
   - Call ends naturally or by user
   - System generates conversation summary
   - Sends SMS if consent was given
   - Stores summary for record-keeping

## SMS Features

### Consent Management
- Explicit consent requested at call start
- Clear opt-out instructions
- Respect for user preferences
- Secure consent tracking

### Message Types
- Call summaries
- Resource recommendations
- Follow-up information
- Opt-out confirmations

### Security
- End-to-end encryption
- Secure storage
- Privacy-focused design
- Compliance with regulations

## Tavily Integration and Response Generation

### Tavily Integration
- **Frontend (React App):**  
  The frontend uses Tavily to search for domestic violence shelters. It sends a POST request to the Tavily API with a query like `domestic violence shelters in [location]`

### Logging System

The application uses a structured logging system that integrates with Railway:

1. **Log Levels**
   - `error`: Critical errors and failures
   - `warn`: Warning messages
   - `info`: Important operational information
   - `debug`: Detailed debugging information

2. **Configuration**
   ```env
   LOG_LEVEL=debug  # Options: error, warn, info, debug
   ```

3. **Log Format**
   ```json
   {
     "level": "debug|info|warn|error",
     "message": "Human readable message",
     "timestamp": "ISO timestamp",
     "additional": "context data"
   }
   ```

4. **Viewing Logs**
   - **Railway CLI**:
     ```bash
     railway logs
     ```
   - **Railway Dashboard**:
     - Go to project
     - Click service
     - Click "Logs" tab
     - Filter by level, service, or time range