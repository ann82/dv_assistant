# DV Assistant

A comprehensive domestic violence support system that provides real-time assistance through voice calls, SMS, and web interfaces.

## Features

### Core Functionality
- **Multi-channel Support**: Voice calls, SMS, and web interface
- **Real-time Processing**: Immediate response to user queries
- **Contextual Understanding**: Advanced pattern matching for query analysis
- **Resource Routing**: Intelligent routing to appropriate support services

### Cache System
- **In-Memory Caching**: Fast access to frequently used data
- **TTL-based Expiration**: Automatic cleanup of stale entries
- **Background Cleanup**: Regular maintenance of cache entries
- **Cache Statistics**: Monitoring of cache performance and usage
- **Thread-Safe Operations**: Safe concurrent access
- **Memory Management**: Automatic cleanup of expired entries
- **Error Handling**: Graceful handling of cache misses and errors

### Performance Monitoring
- **Routing Statistics**: Track success rates by confidence level
- **Response Times**: Monitor performance across different sources
- **Error Tracking**: Comprehensive error logging and monitoring
- **Cache Metrics**: Hit/miss rates and memory usage tracking

### Security Features
- **API Key Management**: Secure handling of external service keys
- **Input Validation**: Robust validation of user inputs
- **Error Handling**: Comprehensive error management
- **Rate Limiting**: Protection against abuse

## Technical Architecture

### Cache Implementation
```javascript
class Cache {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 1000 * 60 * 60; // 1 hour
    this.CLEANUP_INTERVAL = 1000 * 60 * 15; // 15 minutes
  }

  // Core operations
  get(key) { /* ... */ }
  set(key, value) { /* ... */ }
  delete(key) { /* ... */ }
  clear() { /* ... */ }

  // Maintenance
  cleanup() { /* ... */ }
  startCleanup() { /* ... */ }

  // Monitoring
  getStats() { /* ... */ }
}
```

### Key Features
1. **Automatic Cleanup**
   - Regular background cleanup of expired entries
   - Configurable cleanup intervals
   - Process exit handling

2. **Performance Optimization**
   - In-memory storage for fast access
   - TTL-based expiration
   - Thread-safe operations

3. **Monitoring & Statistics**
   - Cache size tracking
   - Entry age monitoring
   - Hit/miss rate tracking
   - Memory usage monitoring

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with the following variables:
```env
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

## Usage

```javascript
import { ResponseGenerator } from './lib/response.js';

// Get response for a query
const response = await ResponseGenerator.getResponse('Where is the nearest shelter?');
```

## Testing

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT