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

Create a `.env` file in the root directory:

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

## Deployment

### Local Development with ngrok
For local development, you can use ngrok to create a temporary public URL:
1. Install ngrok: `npm install -g ngrok`
2. Start your server: `npm start`
3. Start ngrok: `ngrok http 3000`
4. Update your Twilio webhook URL with the ngrok URL

Note: ngrok URLs are temporary and will change each time you restart ngrok. For production, use a proper hosting service.

### Production Deployment
For production deployment, we recommend using Render.com:

1. **Render.com Setup**
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

2. **Alternative Hosting Options**
   - Railway.app
   - DigitalOcean App Platform
   - Heroku

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
