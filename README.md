# Domestic Violence Support Assistant

A real-time voice-based assistant designed to provide immediate support and information to individuals affected by domestic violence. The system uses Twilio for voice communication and OpenAI for intelligent query handling.

## Features

- Real-time voice communication using Twilio
- Intelligent query handling with OpenAI
- WebSocket server for real-time updates
- Comprehensive logging system
- Error handling and monitoring
- Test suite for all components
- Cost logging for API usage tracking
- Health check endpoint for monitoring

## Recent Changes

- Enhanced error handling in Twilio routes
- Improved WebSocket server initialization
- Updated deployment configuration
- Improved file structure and organization
- Enhanced test coverage and reliability
- Added comprehensive logging system
- Implemented cost logging for API usage
- Added health check endpoint

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ann82/dv_assistant.git
cd dv_assistant
```

2. Install dependencies:
```bash
cd relay-server
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your configuration:
```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TAVILY_API_KEY=your_tavily_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Configuration

The application requires the following environment variables:

- `TWILIO_ACCOUNT_SID`: Your Twilio account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio auth token
- `TWILIO_PHONE_NUMBER`: Your Twilio phone number
- `TAVILY_API_KEY`: Your Tavily API key
- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Server port (default: 3000)
- `WS_PORT`: WebSocket server port (default: 3001)
- `LOG_LEVEL`: Logging level (default: info)

## Usage

1. Start the server:
```bash
npm start
```

2. The server will be available at `http://localhost:3000`

3. WebSocket server will be available at `ws://localhost:3001`

4. Health check endpoint: `http://localhost:3000/health`

## Testing

Run the test suite:
```bash
npm test
```

## Deployment

The application is configured for deployment on Railway. The deployment process:

1. Uses nixpacks as the builder
2. Installs dependencies in the relay-server directory
3. Starts the server using server.js as the entry point
4. Includes all necessary files and directories
5. Maintains proper file structure in the deployment environment

## Architecture

The application consists of several key components:

- **Server**: Express.js server handling HTTP requests
- **WebSocket Server**: Real-time communication
- **Twilio Integration**: Voice communication
- **OpenAI Integration**: Intelligent query handling
- **Logging System**: Comprehensive error tracking
- **Cost Logging**: API usage tracking
- **Health Monitoring**: System status checks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.