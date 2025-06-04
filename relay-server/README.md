# Relay Server

A sophisticated response generation system for domestic violence support, featuring intelligent query routing and caching.

## Features

### Intelligent Query Routing

The system uses a confidence-based routing mechanism to determine the best way to handle each query:

- **High Confidence (≥ 0.7)**
  - Uses Tavily exclusively for factual queries
  - Best for clear, location-based questions
  - Example: "Where is the nearest domestic violence shelter in Atlanta?"

- **Medium Confidence (0.4-0.7)**
  - Tries both Tavily and GPT in parallel
  - Uses the best available response
  - Example: "What services do domestic violence shelters provide?"

- **Low Confidence (0.3-0.4)**
  - Uses GPT with Tavily context
  - Combines factual and contextual information
  - Example: "How can I find help with housing?"

- **Non-Factual (< 0.3)**
  - Uses GPT exclusively
  - Best for emotional support and general queries
  - Example: "I feel scared and alone"

### Performance Monitoring

The system tracks detailed performance metrics:

- **Routing Statistics**
  - Success rates by confidence level
  - Fallback patterns
  - Response times per service

- **Cache Performance**
  - Hit/miss rates
  - Entry expiration tracking
  - Memory usage statistics

### Caching System

An efficient caching system for confidence analysis:

- **Features**
  - In-memory cache with 1-hour TTL
  - Automatic cleanup of expired entries
  - Cache statistics and monitoring

- **Benefits**
  - Reduced processing time
  - Consistent confidence scores
  - Memory-efficient operation

## Configuration

### Environment Variables

```env
# API Keys
OPENAI_API_KEY=your_openai_key
TAVILY_API_KEY=your_tavily_key

# Cache Settings
CACHE_TTL=3600000  # 1 hour in milliseconds
CLEANUP_INTERVAL=900000  # 15 minutes in milliseconds

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

### Confidence Thresholds

```javascript
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.4,
  LOW: 0.3
};
```

## Testing

The system includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=response.test.js
```

### Test Categories

- **Confidence Analysis**
  - Pattern matching
  - Confidence scoring
  - Query classification

- **Cache Functionality**
  - Caching behavior
  - TTL enforcement
  - Cleanup operations

- **Routing Performance**
  - Service selection
  - Response tracking
  - Error handling

- **Cache Statistics**
  - Entry counting
  - Expiration tracking
  - Performance metrics

## Monitoring

### Performance Metrics

The system logs detailed performance metrics:

```javascript
{
  totalRequests: number,
  confidenceBreakdown: {
    high: { count, successRate, fallbackRate },
    medium: { count, successRate, fallbackRate },
    low: { count, successRate, fallbackRate },
    nonFactual: count
  },
  sourcePerformance: {
    tavily: { count, successRate, avgResponseTime },
    gpt: { count, successRate, avgResponseTime },
    hybrid: { count, successRate, avgResponseTime }
  }
}
```

### Cache Statistics

Cache performance metrics:

```javascript
{
  totalEntries: number,
  validEntries: number,
  expiredEntries: number,
  oldestEntry: { key, timestamp },
  newestEntry: { key, timestamp }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details 