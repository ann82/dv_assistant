# Relay Server

This server acts as a relay between the Twilio voice call and the AI assistant, handling speech-to-text, text-to-speech, and response generation.

## Features

- **Speech-to-Text**: Converts spoken audio to text using Twilio's speech recognition.
- **Text-to-Speech**: Converts AI responses to spoken audio using Twilio's text-to-speech.
- **Response Generation**: Uses a combination of Tavily and GPT to generate responses.
- **Speech Deduplication**: Prevents duplicate speech results from being processed multiple times.
- **WebSocket Server**: Real-time communication with the client.
- **Performance Monitoring**: Tracks routing performance and response times.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   OPENAI_API_KEY=your_openai_api_key
   TAVILY_API_KEY=your_tavily_api_key
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Testing

The test suite uses Vitest. Run the tests with:
```bash
npm test
```

## Changelog

### [Unreleased]
- Added speech deduplication to prevent duplicate speech results from being processed multiple times.
- Updated test suite to use Vitest instead of Jest.

### [1.0.0] - 2023-01-01
- Initial release.

## Prerequisites

- Node.js >= 18.0.0
- Twilio account with:
  - Account SID
  - Auth Token
  - Phone number
- Tavily API key (starts with 'tvly-')
- OpenAI API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# API Keys
TAVILY_API_KEY=tvly-your-tavily-api-key  # Must start with 'tvly-'
OPENAI_API_KEY=your_openai_api_key
```

## Development

Start the development server:
```bash
npm run dev
```

## Production

Start the production server:
```bash
npm start
```

## Railway Deployment

1. Create a new Railway project
2. Connect your GitHub repository
3. Set the root directory to `relay-server`
4. Configure the following environment variables in Railway:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `TAVILY_API_KEY` (must start with 'tvly-')
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
5. Deploy the application

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /twilio/voice` - Twilio voice webhook
- `POST /twilio/status` - Twilio status webhook

## WebSocket Events

- `connect` - Client connected
- `disconnect` - Client disconnected
- `message` - Message received
- `error` - Error occurred

## Error Handling

The server includes comprehensive error handling for:
- Missing environment variables
- API errors
- WebSocket errors
- General application errors

## Logging

Logging is configured using Winston with the following levels:
- error
- warn
- info
- debug

## License

MIT 