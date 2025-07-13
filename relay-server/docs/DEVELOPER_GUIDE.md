# Developer Guide - Domestic Violence Support Assistant

**Version:** 1.21.3  
**Last Updated:** January 27, 2025

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Development Setup](#development-setup)
5. [Project Structure](#project-structure)
6. [Development Workflow](#development-workflow)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Contributing](#contributing)
10. [Troubleshooting](#troubleshooting)

## Overview

The Domestic Violence Support Assistant is a sophisticated voice-based AI system that helps users find domestic violence support resources through natural conversation. The system has evolved from a basic Twilio integration to a complex, multi-layered architecture with advanced AI capabilities.

### Key Technologies

- **Runtime**: Node.js 18+ (ESM modules)
- **Framework**: Express.js 4.18+
- **Voice**: Twilio SDK 4.22+
- **AI**: OpenAI GPT-3.5-turbo, GPT-4
- **Search**: Tavily API
- **Testing**: Vitest 1.6+
- **Logging**: Winston 3.12+

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Twilio    │  │   Web       │  │   WebSocket │             │
│  │   Voice     │  │   Browser   │  │   Client    │             │
│  │   Calls     │  │   Interface │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Express   │  │   Rate      │  │   CORS      │             │
│  │   Server    │  │   Limiting  │  │   Middleware│             │
│  │             │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Intent    │  │   Speech    │  │   Location  │             │
│  │Classifier   │  │  Processor  │  │   Detector  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Query     │  │   Response  │  │   Follow-up │             │
│  │  Rewriter   │  │  Generator  │  │   Handler   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Data & Cache Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Query     │  │   Tavily    │  │   OpenAI    │             │
│  │   Cache     │  │    API      │  │    GPT      │             │
│  │  (TTL/LRU)  │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Intent Classification System** (`lib/intentClassifier.js`)
- OpenAI GPT-3.5-turbo integration
- 8 intent categories: find_shelter, legal_services, counseling_services, emergency_help, general_information, other_resources, end_conversation, off_topic
- Confidence scoring and fallback handling
- Conversation context management
- Follow-up question detection

#### 2. **Response Generation Engine** (`lib/response.js`)
- Multi-format response system (voice, SMS, web)
- Custom Tavily response formatting
- Phone number extraction and validation
- Title cleaning and optimization
- Metadata calculation (hasPhone, contentLength, relevance)

#### 3. **Location Detection System** (`lib/enhancedLocationDetector.js`)
- Geocoding validation using Nominatim/OpenStreetMap API
- Service word filtering ("home" in "home Mumbai")
- US-only support with clear messaging
- Pattern-based location extraction
- Fallback mechanisms for reliability

#### 4. **Conversation Management**
- 5-minute context timeout
- History tracking (last 5 interactions)
- Location context preservation
- Intent tracking across turns
- Follow-up context management

#### 5. **Caching & Performance** (`lib/queryCache.js`)
- Unified cache architecture with TTL
- LRU eviction for memory management
- Multi-level caching (Tavily, GPT, follow-up)
- Cache statistics and monitoring
- Automatic cleanup of expired entries

## Getting Started

### Prerequisites

- Node.js 18+ (with ESM support)
- npm or yarn
- Git
- Twilio account (for voice/SMS testing)
- OpenAI API key
- Tavily API key

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/your-org/dv-support-assistant.git
cd dv-support-assistant/relay-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. **Run tests**
```bash
npm test
```

5. **Start development server**
```bash
npm run dev
```

## Development Setup

### Environment Variables

Create a `.env` file with the following variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# Tavily Configuration
TAVILY_API_KEY=your_tavily_api_key

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging Configuration
LOG_LEVEL=info
LOG_OUTPUT=console

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/intentClassifier.test.mjs

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
relay-server/
├── docs/                          # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── DEVELOPER_GUIDE.md
│   └── DEPLOYMENT_GUIDE.md
├── lib/                           # Core business logic
│   ├── intentClassifier.js        # Intent classification
│   ├── response.js                # Response generation
│   ├── enhancedLocationDetector.js # Location detection
│   ├── enhancedQueryRewriter.js   # Query rewriting
│   ├── conversationContextBuilder.js # Context management
│   ├── queryCache.js              # Caching system
│   ├── queryLogger.js             # Performance logging
│   ├── fallbackResponder.js       # Fallback handling
│   ├── relevanceScorer.js         # Result ranking
│   └── config/                    # Configuration
├── integrations/                  # External service integrations
│   ├── openaiIntegration.js       # OpenAI API
│   ├── searchIntegration.js       # Tavily API
│   ├── ttsIntegration.js          # Text-to-speech
│   ├── twilioIntegration.js       # Twilio API
│   ├── speechRecognitionIntegration.js # Speech recognition
│   └── geocodingIntegration.js    # Geocoding API
├── services/                      # Service layer
│   ├── base/                      # Base service classes
│   ├── ttsService.js              # TTS service
│   ├── searchService.js           # Search service
│   ├── contextService.js          # Context service
│   └── callSummaryService.js      # Call summary service
├── handlers/                      # Request handlers
│   ├── base/                      # Base handler classes
│   ├── twilioVoiceHandler.js      # Voice call handler
│   ├── speechHandler.js           # Speech processing
│   ├── responseHandler.js         # Response generation
│   └── intentHandler.js           # Intent processing
├── controllers/                   # Route controllers
│   └── twilioController.js        # Twilio route handlers
├── middleware/                    # Express middleware
│   ├── logging.js                 # Request logging
│   ├── validation.js              # Input validation
│   ├── performanceMonitoring.js   # Performance tracking
│   └── errorHandling.js           # Error handling
├── routes/                        # Express routes
│   └── twilio.js                  # Twilio webhook routes
├── tests/                         # Test files
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── api/                       # API tests
├── utils/                         # Utility functions
├── websocketServer.js             # WebSocket server
├── server.js                      # Main server file
├── package.json                   # Dependencies and scripts
└── README.md                      # Project overview
```

## Development Workflow

### 1. Feature Development

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes and write tests**
```bash
# Edit files
npm test  # Run tests
npm run lint  # Check code quality
```

3. **Commit changes**
```bash
git add .
git commit -m "feat: add your feature description"
```

4. **Push and create pull request**
```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

### 2. Code Quality Standards

- **ESLint**: Code linting with custom rules
- **Prettier**: Code formatting
- **TypeScript**: Type checking (partial migration)
- **Vitest**: Unit and integration testing
- **Coverage**: Minimum 80% test coverage

### 3. Testing Strategy

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test service interactions
- **API Tests**: Test HTTP endpoints
- **End-to-End Tests**: Test complete user flows

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/intentClassifier.test.mjs

# Run tests with coverage
npm run test:coverage

# Run API integration tests
npm test -- tests/apiIntegration.test.js
```

### Test Structure

```javascript
// Example test structure
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Component Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

### Mocking

```javascript
// Mock external dependencies
vi.mock('../integrations/openaiIntegration.js', () => ({
  OpenAIIntegration: {
    createChatCompletion: vi.fn()
  }
}));

// Use mocks in tests
const { OpenAIIntegration } = await import('../integrations/openaiIntegration.js');
OpenAIIntegration.createChatCompletion.mockResolvedValue(mockResponse);
```

## Deployment

### Production Deployment

1. **Build the application**
```bash
npm run build
```

2. **Set production environment variables**
```bash
NODE_ENV=production
PORT=3000
# ... other production variables
```

3. **Start the server**
```bash
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Cloud Deployment

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

#### Render
```bash
# Connect to Render
# Deploy from GitHub repository
```

## Contributing

### Contribution Guidelines

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Write tests for new functionality**
5. **Ensure all tests pass**
6. **Update documentation**
7. **Submit a pull request**

### Code Review Process

1. **Automated checks must pass**
   - Tests
   - Linting
   - Type checking
   - Coverage requirements

2. **Manual review by maintainers**
   - Code quality
   - Architecture alignment
   - Security considerations
   - Performance impact

3. **Approval and merge**

### Commit Message Format

Use conventional commits:

```
type(scope): description

feat(intent): add new intent classification
fix(location): resolve location extraction bug
docs(api): update API documentation
test(cache): add cache performance tests
```

## Troubleshooting

### Common Issues

#### 1. **Module Import Errors**
```bash
# Ensure Node.js 18+ with ESM support
node --version

# Check package.json for "type": "module"
```

#### 2. **Test Failures**
```bash
# Clear test cache
npm run test:clear

# Run tests with verbose output
npm test -- --reporter=verbose
```

#### 3. **API Key Issues**
```bash
# Verify environment variables
echo $OPENAI_API_KEY
echo $TAVILY_API_KEY
echo $TWILIO_ACCOUNT_SID
```

#### 4. **Performance Issues**
```bash
# Check memory usage
npm run monitor

# Analyze performance metrics
curl http://localhost:3000/health/performance
```

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Health Checks

```bash
# Basic health
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Integration health
curl http://localhost:3000/health/integrations
```

## Support

### Getting Help

- **Documentation**: Check the docs/ directory
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Email**: developer-support@your-domain.com

### Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [Twilio Documentation](https://www.twilio.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Vitest Testing Framework](https://vitest.dev/)

---

*This guide is maintained by the Domestic Violence Support Assistant development team.* 