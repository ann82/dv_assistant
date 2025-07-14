# Relay Server

A Node.js server for handling Twilio voice calls and web requests, providing domestic violence support resources.

**Current Version: 1.22.5** (Updated: July 14, 2025)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Twilio account (for voice/SMS features)
- OpenAI API key (for AI responses and TTS)

### Installation
```bash
cd relay-server
npm install
```

### Environment Setup
Create a `.env` file in the relay-server directory:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# TTS Configuration
TTS_PROVIDER=openai
TTS_VOICE=nova
ENABLE_TTS=true

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### Running the Server
```bash
# Development mode
npm run dev

# Production mode
npm start

# Run tests
npm test
```

## 🎯 Features

### Core Functionality
- **Voice Call Processing**: Handle incoming Twilio voice calls with speech recognition
- **AI-Powered Responses**: Generate contextual responses using OpenAI GPT models
- **TTS-Based Welcome Messages**: Welcome messages are generated using OpenAI TTS for natural, high-quality audio
- **Resource Search**: Find domestic violence shelters and support services using Tavily search
- **Multi-language Support**: Support for English, Spanish, French, and German
- **TTS Integration**: Text-to-speech using OpenAI's TTS service with voice customization
- **Conversation Context**: Maintain conversation state for follow-up questions
- **Emergency Handling**: Immediate 911 guidance for emergency situations

### Enhanced Features
- **Comprehensive Logging**: Detailed request/response logging with requestId, CallSid, and text tracking
- **Error Handling**: Robust error handling with graceful degradation and fallback responses
- **Performance Monitoring**: Real-time performance tracking and optimization
- **Caching System**: Intelligent caching for API responses and TTS audio
- **WebSocket Support**: Real-time communication for web clients
- **SMS Integration**: Send follow-up messages and resource summaries via SMS

### Recent Improvements (v1.22.5)
- **TTS-Based Welcome Messages**: The welcome message for incoming calls is now generated using the TTS pipeline, ensuring the full, configurable prompt is played to callers with natural, high-quality audio
- **Robust TTS Fallback**: If TTS generation fails (e.g., OpenAI API error), the system gracefully falls back to a simple TwiML `<Say>` so callers always hear a message
- **Improved Metadata Logging**: All TTS and TwiML generation logs now include requestId, callSid, text preview, and other metadata for easier debugging and traceability
- **TTS Pipeline Compatibility**: The TTS pipeline now works with the actual TTS service response format, handling both audioBuffer and audioUrl, and saving audio files as needed
- **Enhanced Error Handling**: Comprehensive error handling throughout the speech processing pipeline with graceful degradation

### Recent Improvements (v1.22.4)
- **Configurable Welcome Messages**: Welcome messages now use language-specific configuration from the language config system
- **Enhanced Route-Level Debugging**: Added comprehensive console logging for route entry points with request tracking
- **Speech Processing Robustness**: Significantly improved error resilience in speech processing with graceful degradation

### Recent Improvements (v1.22.3)
- **Fixed SpeechHandler Errors**: Resolved critical speech processing validation errors
- **Enhanced Debugging**: Added comprehensive logging throughout the speech processing flow
- **Improved Error Handling**: Better error recovery and fallback mechanisms
- **Streamlined Processing**: Optimized request processing pipeline for better reliability

## 🎤 Welcome Message System

### TTS-Based Welcome Messages
The system now uses OpenAI TTS to generate natural, high-quality welcome messages:

**How it works:**
1. **TTS Generation**: Welcome message text is sent to OpenAI TTS service
2. **Audio File Creation**: Generated audio is saved as an MP3 file in `/public/audio/`
3. **TwiML Response**: Audio is played via `<Play>` verb inside a `<Gather>` for immediate interaction
4. **Fallback**: If TTS fails, system falls back to simple `<Say>` TwiML

**Example TwiML Output:**
```xml
<Response>
  <Gather input="speech" action="/twilio/voice/process" method="POST">
    <Play>/audio/welcome_12345.mp3</Play>
  </Gather>
</Response>
```

**Configuration:**
- Welcome messages are configurable per language in `lib/languageConfig.js`
- TTS voice can be customized via `TTS_VOICE` environment variable
- TTS can be disabled by setting `ENABLE_TTS=false`

### Logging and Debugging
All TTS operations include comprehensive metadata:
- `requestId`: Unique request identifier
- `callSid`: Twilio Call SID
- `textLength`: Length of text being converted
- `textPreview`: First 100 characters of text
- `voice`: TTS voice being used
- `provider`: TTS provider (OpenAI, Polly, etc.)

## 🛡️ Error Handling & Logging

### Enhanced Error Handling
The system implements comprehensive error handling with graceful degradation:

**TTS Pipeline:**
- **TTS Generation Failures**: Falls back to simple `<Say>` TwiML
- **Audio File Creation Failures**: Falls back to `<Say>` TwiML
- **OpenAI API Errors**: Graceful fallback with detailed error logging
- **File System Errors**: Handles audio file creation failures gracefully

**Speech Processing Pipeline:**
- **Context Service Failures**: System continues without context if context service is unavailable
- **Intent Classification Failures**: Falls back to 'general_information' intent
- **Location Extraction Failures**: Continues processing with location prompts
- **Query Rewriting Failures**: Uses original query as fallback
- **Response Generation Failures**: Provides fallback responses with detailed error logging
- **Context Update Failures**: Non-blocking updates with error logging

**Error Logging:**
All errors are logged with complete context:
- `requestId`: Unique request identifier for tracking
- `callSid`: Twilio Call SID for call-specific debugging
- `component`: Specific component that encountered the error
- `stack`: Full stack trace for debugging
- `timestamp`: ISO timestamp for chronological analysis

### Configurable Welcome Messages
Welcome messages are now configurable per language using the language configuration system:
- **Language-Specific**: Welcome messages adapt to the selected language
- **TTS-Enhanced**: Messages are delivered via high-quality TTS audio
- **Consistent Experience**: Messages are consistent with the overall language configuration
- **Easy Customization**: Messages can be easily updated in the language configuration files

## 📡 API Endpoints

### Voice Endpoints
- `POST /twilio/voice` - Handle incoming voice calls (with TTS welcome message)
- `POST /twilio/voice/process` - Process speech input
- `POST /twilio/voice/interim` - Handle interim speech results

### Web Endpoints
- `POST /twilio/web/process` - Process web-based speech input
- `GET /health` - Health check endpoint

### SMS Endpoints
- `POST /twilio/sms` - Handle SMS messages
- `POST /twilio/consent` - Handle SMS consent

## 🔧 Configuration

### TTS Configuration
```javascript
// TTS Provider and Voice Settings
TTS_PROVIDER=openai          // TTS provider (openai, polly, stub)
TTS_VOICE=nova               // OpenAI TTS voice (nova, alloy, echo, fable, onyx, shimmer)
ENABLE_TTS=true              // Enable/disable TTS functionality
TTS_TIMEOUT=15000            // TTS timeout in milliseconds
```

### Voice Configuration
```javascript
// Supported voices per language
'en-US': { twilioVoice: 'Polly.Amy', openaiVoice: 'nova' }
'es-ES': { twilioVoice: 'Polly.Lupe', openaiVoice: 'shimmer' }
'fr-FR': { twilioVoice: 'Polly.Lea', openaiVoice: 'echo' }
'de-DE': { twilioVoice: 'Polly.Vicki', openaiVoice: 'onyx' }
```

### Logging Configuration
The system now includes comprehensive logging with:
- Request/response tracking with unique requestIds
- CallSid tracking for Twilio calls
- Text content logging for debugging
- Voice configuration tracking
- TTS operation logging with metadata
- Step-by-step processing logs

## 🧪 Testing

Run the test suite:
```bash
npm test
```

The test suite includes:
- Unit tests for all core components
- Integration tests for API endpoints
- TTS functionality tests
- Performance and error handling tests
- 470+ tests with comprehensive coverage

## 📊 Monitoring

### Health Checks
- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed system status including TTS service health

### Logging
All requests are logged with:
- Unique requestId for tracking
- CallSid for Twilio calls
- Processing time and status
- TTS operation details and metadata
- Error details when applicable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the [API Documentation](docs/API_DOCUMENTATION.md)
- Review the [Developer Guide](docs/DEVELOPER_GUIDE.md)
- Check the [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)