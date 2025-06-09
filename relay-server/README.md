# DV Assistant Relay Server

A Node.js server that handles Twilio voice calls and Tavily API integration for domestic violence resource search.

## Features

- **Twilio Voice Integration**: Handles incoming voice calls and processes speech input
- **Tavily API Integration**: Searches for domestic violence resources based on location
- **Real-time Communication**: WebSocket server for live updates
- **Audio File Handling**: Manages audio file storage and caching
- **Performance Optimizations**:
  - Response caching with automatic cleanup
  - Request timeout handling
  - Optimized API payloads
  - Detailed performance metrics

## Performance Optimizations

### Tavily API Integration
- **Response Caching**: 30-minute TTL with automatic cleanup
- **Cache Management**: Maximum 1000 entries with LRU eviction
- **API Timeout**: 10-second timeout for API calls
- **Optimized Payload**: Reduced search depth and disabled unnecessary features
- **Error Handling**: Fallback to expired cache on API errors

### Request Processing
- **Timing Metrics**: Detailed timing for each processing step
- **Request Abort Handling**: Proper cleanup on client disconnection
- **Error Recovery**: User-friendly error messages and graceful degradation

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Twilio account and credentials
- Tavily API key

### Installation
```bash
npm install
```

### Configuration
Create a `.env` file with the following variables:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TAVILY_API_KEY=your_tavily_api_key
```

### Running the Server
```bash
npm start
```

### Running Tests
```bash
npm test
```

## API Endpoints

### Twilio Voice
- `POST /twilio/voice/process`: Handles incoming voice calls and processes speech input

### WebSocket
- `WS /ws`: WebSocket endpoint for real-time updates

## Error Handling

The server implements comprehensive error handling:
- Request timeouts
- API failures
- Client disconnections
- Invalid inputs

All errors are logged with detailed context for debugging.

## Performance Monitoring

The server logs detailed performance metrics:
- Request processing time
- API call duration
- Cache hit/miss rates
- Response sizes

## Security

- Some moderate vulnerabilities remain in dev dependencies (esbuild, vite, vitest) due to upstream issues in the testing toolchain. These do **not** affect production code or runtime security.
- Attempted to update all dev dependencies to the latest compatible versions. See CHANGELOG for details.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 