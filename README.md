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

## Setup

### Prerequisites

- Node.js 18+
- Twilio account with a phone number
- OpenAI API key
- ngrok or similar for local development

### Environment Variables

Create a `.env` file in the `relay-server` directory:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info  # Options: debug, info, warn, error
```

### Installation

1. Install dependencies:
```bash
cd relay-server
npm install
```

2. Start the server:
```bash
npm start
```

3. Set up Twilio webhook:
   - Voice webhook URL: `https://your-domain/twilio/voice`
   - Status callback URL: `https://your-domain/twilio/status`

## Deployment

### Local Development with ngrok
For local development, you can use ngrok to create a temporary public URL:
1. Install ngrok: `npm install -g ngrok`
2. Start your server: `npm start`
3. Start ngrok: `ngrok http 3000`
4. Update your Twilio webhook URL with the ngrok URL

Note: ngrok URLs are temporary and will change each time you restart ngrok. For production, use a proper hosting service.

### Production Deployment
For production deployment, we recommend using one of these hosting services:

1. **Render.com** (Recommended)
   - Free tier available
   - Easy deployment from GitHub
   - Automatic SSL certificates
   - Steps:
     1. Create an account on render.com
     2. Connect your GitHub repository
     3. Create a new Web Service
     4. Set build command: `npm install`
     5. Set start command: `node relay-server/server.js`
     6. Add your environment variables
     7. Deploy

2. **Railway.app**
   - Free tier available
   - Simple deployment process
   - Good for Node.js applications

3. **DigitalOcean App Platform**
   - Paid but very reliable
   - Good for production workloads
   - Built-in monitoring

4. **Heroku**
   - Free tier available
   - Well-established platform
   - Good for Node.js applications

### Troubleshooting

#### Common Issues

1. **403 Forbidden Errors**
   - Check if your Twilio webhook URL is correct
   - Verify that your Twilio credentials are valid
   - Ensure your server is accessible from the internet

2. **404 Not Found for Audio Files**
   - Verify that audio files are in the correct directory
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

## Usage

1. Call the Twilio phone number
2. The system will:
   - Play a welcome message
   - Listen for your input
   - Process your request using GPT
   - Respond with helpful information
   - Continue the conversation
   - Log all call activities and status changes

## Development

### Project Structure

```
relay-server/
├── lib/
│   ├── config.js
│   └── twilio.js
├── routes/
│   └── twilio.js
├── services/
│   └── audioService.js
├── websocketServer.js
├── server.js
└── package.json

web/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
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
