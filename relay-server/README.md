# Relay Server

A Node.js server for handling Twilio voice calls and web requests, providing domestic violence support resources.

**Current Version: 1.22.4** (Updated: January 27, 2025)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Twilio account (for voice/SMS features)
- OpenAI API key (for AI responses)

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

### Recent Improvements (v1.22.4)
- **Enhanced Error Handling**: Comprehensive error handling throughout the speech processing pipeline
- **Configurable Welcome Messages**: Welcome messages now use language-specific configuration
- **Improved Debugging**: Enhanced route-level logging with request tracking
- **Graceful Degradation**: System continues to function even when individual components fail

### Recent Improvements (v1.22.3)
- **Fixed SpeechHandler Errors**: Resolved critical speech processing validation errors
- **Enhanced Debugging**: Added comprehensive logging throughout the speech processing flow
- **Improved Error Handling**: Better error recovery and fallback mechanisms
- **Streamlined Processing**: Optimized request processing pipeline for better reliability

## 🛡️ Error Handling & Logging

### Enhanced Error Handling
The system implements comprehensive error handling with graceful degradation:

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
- **Consistent Experience**: Messages are consistent with the overall language configuration
- **Easy Customization**: Messages can be easily updated in the language configuration files

## 📡 API Endpoints

### Voice Endpoints
- `POST /twilio/voice` - Handle incoming voice calls
- `POST /twilio/voice/process` - Process speech input
- `POST /twilio/voice/interim` - Handle interim speech results

### Web Endpoints
- `POST /twilio/web/process` - Process web-based speech input
- `GET /health` - Health check endpoint

### SMS Endpoints
- `POST /twilio/sms` - Handle SMS messages
- `POST /twilio/consent` - Handle SMS consent

## 🔧 Configuration

### Voice Configuration
```javascript
// Supported voices per language
'en-US': { twilioVoice: 'Polly.Amy', openaiVoice: 'nova' }
'es-ES': { twilioVoice: 'Polly.Lupe', openaiVoice: 'nova' }
'fr-FR': { twilioVoice: 'Polly.Lea', openaiVoice: 'nova' }
'de-DE': { twilioVoice: 'Polly.Vicki', openaiVoice: 'nova' }
```

### Logging Configuration
The system now includes comprehensive logging with:
- Request/response tracking with unique requestIds
- CallSid tracking for Twilio calls
- Text content logging for debugging
- Voice configuration tracking
- Step-by-step processing logs

## 🧪 Testing

Run the test suite:
```bash
npm test
```

The test suite includes:
- Unit tests for all core components
- Integration tests for API endpoints
- Performance and error handling tests
- 470+ tests with comprehensive coverage

## 📊 Monitoring

### Health Checks
- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed system status

### Logging
All requests are logged with:
- Unique requestId for tracking
- CallSid for Twilio calls
- Processing time and status
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