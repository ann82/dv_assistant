# Domestic Violence Support Assistant - Architectural Evolution

## Project Overview

The Domestic Violence Support Assistant is a sophisticated voice-based AI system that helps users find domestic violence support resources through natural conversation. The system has evolved from a basic Twilio integration to a complex, multi-layered architecture with advanced AI capabilities.

## Architecture Evolution Timeline

### 🚀 Phase 1: Foundation (v0.1.0 - v1.0.0) - March 2024
**Initial Setup & Basic Integration**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Twilio Voice  │    │   Express.js    │    │   Tavily API    │
│     Calls       │───▶│     Server      │───▶│   (Search)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   WebSocket     │
                       │     Server      │
                       └─────────────────┘
```

**Key Components:**
- Basic Twilio voice call handling
- Simple Express.js server
- WebSocket server for real-time communication
- Tavily API integration for resource searches
- OpenAI GPT integration for general responses
- Railway deployment support

**Technologies:**
- Node.js 18+
- Express.js
- Twilio SDK
- WebSocket (ws)
- Environment-based configuration

---

### 🔧 Phase 2: Core Functionality (v1.0.1 - v1.0.5) - March-June 2024
**Speech Recognition & Response Processing**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Twilio Voice  │    │   Speech-to-    │    │   Intent        │
│     Calls       │───▶│     Text        │───▶│ Classification  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Location      │    │   Query         │
                       │   Extraction    │    │   Rewriting     │
                       └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Tavily API    │    │   Response      │
                       │   (Resources)   │◀───│   Generator     │
                       └─────────────────┘    └─────────────────┘
```

**Key Improvements:**
- Enhanced speech-to-text quality with domain-specific vocabulary
- Intent-based routing system
- Location extraction from speech
- Query rewriting for better search results
- Voice-optimized response formatting
- Follow-up question support

**New Components:**
- `speechProcessor.js` - Location extraction and speech processing
- `intentClassifier.js` - Intent classification using OpenAI GPT
- `response.js` - Response formatting and generation
- Enhanced TwilioVoiceHandler with better conversation flow

---

### 🧠 Phase 3: AI Intelligence (v1.0.6 - v1.0.8) - June 2024
**Advanced AI & Conversation Management**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │    │   Intent        │    │   Confidence    │
│                 │───▶│ Classification  │───▶│   Analysis      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Query         │    │   Routing       │
                       │   Rewriting     │    │   Decision      │
                       └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Hybrid        │    │   Response      │
                       │   Processing    │    │   Generation    │
                       └─────────────────┘    └─────────────────┘
```

**Key Features:**
- Confidence-based routing system
- Hybrid AI/Pattern processing for cost optimization
- Conditional query rewriting (prevents off-topic context injection)
- Enhanced caching system with TTL and LRU eviction
- Performance monitoring and statistics tracking

**New Components:**
- `queryCache.js` - Unified caching with TTL and LRU eviction
- `queryLogger.js` - Performance monitoring and statistics
- `fallbackResponder.js` - Graceful fallback handling
- Enhanced conversation context management

---

### 🎯 Phase 4: Conversation Intelligence (v1.0.9 - v1.0.12) - June-December 2024
**Advanced Conversation Flow & Context Management**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Conversation  │    │   Context       │    │   Follow-up     │
│   Context       │───▶│   Manager       │───▶│   Detection     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Location      │    │   Enhanced      │
                       │   Detection     │    │   Query         │
                       │   (Geocoding)   │    │   Rewriting     │
                       └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   SMS Consent   │    │   Call Flow     │
                       │   System        │    │   Management    │
                       └─────────────────┘    └─────────────────┘
```

**Key Features:**
- Enhanced location detection with geocoding validation
- Multi-turn conversation support
- SMS consent collection system
- Call flow management with proper ending
- Comprehensive test suite overhaul

**New Components:**
- `enhancedLocationDetector.js` - Geocoding-based location detection
- `enhancedQueryRewriter.js` - Advanced query processing
- Conversation context management system
- SMS consent and delivery system

---

### 🔄 Phase 5: Production Optimization (v1.0.13 - v1.0.16) - December 2024
**Production Readiness & Advanced Features**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Custom        │    │   Flexible      │    │   Location      │
│   Response      │    │   Formatting    │    │   Follow-up     │
│   Formats       │───▶│   System        │───▶│   Detection     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   WebSocket     │    │   Conversation  │
                       │   Server Fix    │    │   Context       │
                       │   (Architecture)│    │   Enhancement   │
                       └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Test          │    │   Production    │
                       │   Reliability   │    │   Stability     │
                       └─────────────────┘    └─────────────────┘
```

**Key Features:**
- Custom Tavily response formatting system
- WebSocket server architecture fixes
- Location follow-up detection
- Test reliability improvements
- Production stability enhancements

## Current Architecture (v1.0.16)

### High-Level System Architecture

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

### Core Components Deep Dive

#### 1. **Intent Classification System**
```javascript
// intentClassifier.js - 1,569 lines
- OpenAI GPT-3.5-turbo integration
- 8 intent categories: find_shelter, legal_services, counseling_services, 
  emergency_help, general_information, other_resources, end_conversation, off_topic
- Confidence scoring and fallback handling
- Conversation context management
- Follow-up question detection
```

#### 2. **Response Generation Engine**
```javascript
// response.js - 2,138 lines
- Multi-format response system (voice, SMS, web)
- Custom Tavily response formatting
- Phone number extraction and validation
- Title cleaning and optimization
- Metadata calculation (hasPhone, contentLength, relevance)
```

#### 3. **Location Detection System**
```javascript
// enhancedLocationDetector.js - 568 lines
- Geocoding validation using Nominatim/OpenStreetMap API
- Service word filtering ("home" in "home Mumbai")
- US-only support with clear messaging
- Pattern-based location extraction
- Fallback mechanisms for reliability
```

#### 4. **Conversation Management**
```javascript
// Conversation Context System
- 5-minute context timeout
- History tracking (last 5 interactions)
- Location context preservation
- Intent tracking across turns
- Follow-up context management
```

#### 5. **Caching & Performance**
```javascript
// queryCache.js - 213 lines
- Unified cache architecture with TTL
- LRU eviction for memory management
- Multi-level caching (Tavily, GPT, follow-up)
- Cache statistics and monitoring
- Automatic cleanup of expired entries
```

## Technology Stack Evolution

### **Core Technologies**
- **Runtime**: Node.js 18+ (ESM modules)
- **Framework**: Express.js 4.18+
- **Voice**: Twilio SDK 4.22+
- **WebSocket**: ws 8.16+
- **AI**: OpenAI GPT-3.5-turbo, GPT-4
- **Search**: Tavily API
- **Logging**: Winston 3.12+

### **Development Tools**
- **Testing**: Vitest 1.6+ (304 tests, 100% pass rate)
- **Build**: Vite 5.4+, esbuild 0.21+
- **TypeScript**: 5.0+ (partial migration)
- **Linting**: ESLint, Prettier
- **Deployment**: Railway, Render

### **Key Dependencies Evolution**
```json
// Initial (v0.1.0)
{
  "express": "^4.18.2",
  "twilio": "^4.22.0",
  "ws": "^8.16.0"
}

// Current (v1.0.16)
{
  "openai": "^4.103.0",
  "winston": "^3.12.0",
  "express-rate-limit": "^7.1.5",
  "gpt-tokenizer": "^2.1.2",
  "uuid": "^9.0.1",
  "async-retry": "^1.3.3"
}
```

## Performance & Scalability Features

### **Caching Strategy**
- **Query Cache**: 30-minute TTL, LRU eviction
- **Intent Cache**: 1-hour TTL for classification results
- **Location Cache**: Geocoding results cached
- **Response Cache**: Formatted responses cached

### **Cost Optimization**
- **Hybrid Processing**: Pattern matching first, AI fallback
- **60-80% reduction** in AI API calls
- **Smart routing** based on confidence levels
- **Cache hit rate monitoring**

### **Reliability Features**
- **Rate limiting**: 100 requests per 15 minutes per IP
- **Request timeouts**: 30-second limits
- **Error handling**: Comprehensive fallback mechanisms
- **Health checks**: Real-time system monitoring

## Testing & Quality Assurance

### **Test Coverage**
- **304 tests** with 100% pass rate
- **Comprehensive mocking** system
- **Integration tests** for all major components
- **Performance tests** for caching and API calls

### **Test Categories**
- Intent classification tests
- Location detection tests
- Response formatting tests
- Conversation flow tests
- Cache functionality tests
- API integration tests

## Deployment & Infrastructure

### **Cloud Platforms**
- **Railway**: Primary deployment platform
- **Render**: Alternative deployment option
- **Environment-based** configuration
- **Health monitoring** endpoints

### **Configuration Management**
- **Environment variables** for all sensitive data
- **Validation** of required configuration
- **Fallback values** for development
- **Secure credential** handling

## Key Metrics & Monitoring

### **Performance Metrics**
- Response time tracking
- Cache hit rates
- API call reduction
- Error rates and fallback patterns

### **Business Metrics**
- Conversation completion rates
- Location detection accuracy
- Resource search success rates
- User satisfaction indicators

## Future Roadmap

### **Planned Enhancements**
- **Multi-language support**
- **Advanced analytics dashboard**
- **Mobile app integration**
- **Enhanced security features**
- **Machine learning model training**

### **Architecture Improvements**
- **Microservices migration**
- **Event-driven architecture**
- **Real-time analytics**
- **Advanced caching strategies**

---

## Summary

The Domestic Violence Support Assistant has evolved from a simple Twilio integration to a sophisticated, production-ready AI system with:

- **Advanced conversation intelligence** with context management
- **Hybrid AI/pattern processing** for cost optimization
- **Comprehensive caching** and performance monitoring
- **Robust error handling** and fallback mechanisms
- **Production-grade** testing and deployment infrastructure

The system now handles complex multi-turn conversations, provides intelligent resource recommendations, and maintains high reliability while optimizing costs through smart caching and hybrid processing approaches. 