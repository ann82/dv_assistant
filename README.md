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
- Enhanced logging and debugging capabilities

## Enhanced Logging and Debugging

The system includes comprehensive logging throughout the request-response lifecycle:

- **Request Tracking**: Each request is assigned a unique ID for tracking
- **Parameter Validation**: Detailed logging of required parameters
- **Processing Time**: Tracking of processing time at each step
- **Error Handling**: Enhanced error logging with stack traces
- **Response Logging**: TwiML response logging before sending

### Logging Levels

- **INFO**: Normal operation logs
- **ERROR**: Error and exception logs
- **DEBUG**: Detailed debugging information

### Debugging Tips

1. Check the logs for the request ID to track a specific call
2. Look for processing time spikes
3. Monitor parameter validation errors
4. Check TwiML response formatting
5. Review error responses and stack traces

## Recent Changes

- Fixed a bug where a missing function (`generateWelcomePrompt`) for the Twilio welcome prompt caused 502 errors. The welcome prompt is now hardcoded for reliability.
- **Major Fix: Twilio Routing Conflicts** - Resolved duplicate responses and routing conflicts by standardizing all routes to use `/twilio/voice/process` consistently across the application.
- **Follow-up Question Support** - Fixed follow-up question detection and processing. The system now properly maintains conversation context and processes follow-up questions without requiring location input again.
- **Route Standardization** - Updated all Twilio handlers, WebSocket server, and route configurations to use consistent routing paths.
- **Enhanced Tavily Response Filtering** - Implemented configuration-based filtering system to exclude PDFs, government documents, and other non-shelter resources. Results now focus on actual shelter organizations with clean, readable titles.
- **Configuration-Based Architecture** - Replaced hardcoded filtering patterns with maintainable configuration files that can be easily updated without code changes.
- Enhanced error handling in Twilio routes
- Improved WebSocket server initialization
- Updated deployment configuration
- Improved file structure and organization
- Enhanced test coverage and reliability
- Added comprehensive logging system
- Implemented cost logging for API usage
- Added health check endpoint
- Simplified module imports using index.js
- Updated package.json with proper module exports
- Removed unnecessary build step from deployment

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

### Filtering Configuration

The system uses a configuration-based approach for filtering Tavily search results. Filtering patterns are defined in `relay-server/lib/filterConfig.js` and can be easily updated without code changes:

- **Unwanted Patterns**: Filters out PDFs, government documents, research papers, and other non-shelter resources
- **Positive Patterns**: Identifies actual shelter organizations, domestic violence centers, and support services
- **Domain Exclusions**: Excludes specific domains like Wikipedia, government sites, and research platforms
- **Title Cleanup**: Removes common prefixes/suffixes to provide cleaner organization names

This configuration can be extended to support different types of resources or modified for specific geographic regions.

## Configuration Notes

- **Twilio speechTimeout**: The system now uses a 30-second `speechTimeout` for all Twilio `<Gather>` prompts, giving users more time to respond before the call times out. You can adjust this in `relay-server/routes/twilio.js` and `relay-server/lib/twilioVoice.js` if needed.
- **Follow-up Support**: The voice agent supports follow-up questions and tracks context for up to 5 minutes after a response. See `FOLLOW_UP_IMPLEMENTATION.md` for details.

## Usage

1. Start the server:
```