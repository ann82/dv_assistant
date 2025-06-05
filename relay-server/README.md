# DV Assistant Relay Server

A Node.js server that handles Twilio voice calls and integrates with Tavily API for resource searches and OpenAI for general responses.

## Features

- Twilio voice call handling
- Real-time WebSocket communication
- Tavily API integration for resource searches
- OpenAI GPT integration for general responses
- Railway deployment support
- Health check endpoint
- Comprehensive error handling
- Environment variable validation

## Prerequisites

- Node.js >= 18.0.0
- Twilio account with:
  - Account SID
  - Auth Token
  - Phone number
- Tavily API key
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
TAVILY_API_KEY=your_tavily_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
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
   - `TAVILY_API_KEY`
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

## Testing

Run tests:
```bash
npm test
```

## License

MIT 