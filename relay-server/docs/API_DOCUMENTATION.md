# Domestic Violence Support Assistant - API Documentation

**Version:** 1.21.3  
**Base URL:** `https://your-domain.com`  
**Last Updated:** January 27, 2025

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Health Check Endpoints](#health-check-endpoints)
4. [Twilio Voice Endpoints](#twilio-voice-endpoints)
5. [Twilio SMS Endpoints](#twilio-sms-endpoints)
6. [WebSocket Endpoints](#websocket-endpoints)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Examples](#examples)

## Overview

The Domestic Violence Support Assistant API provides voice and SMS-based support for individuals seeking domestic violence resources. The system uses AI-powered conversation management to help users find shelters, legal services, counseling, and other support resources.

### Key Features

- **Voice Call Support**: Real-time voice conversations with AI assistance
- **SMS Support**: Text-based resource finding and support
- **Location Detection**: Automatic location extraction and geocoding
- **Resource Search**: AI-powered search for local support services
- **Conversation Management**: Multi-turn conversation support
- **Emergency Support**: Priority handling for emergency situations

## Authentication

### Twilio Webhook Authentication

Twilio webhooks are authenticated using Twilio's signature validation. The system automatically validates incoming requests using the `X-Twilio-Signature` header.

**Required Headers:**
```
X-Twilio-Signature: [Twilio-generated signature]
```

### API Key Authentication (for health endpoints)

Some endpoints require API key authentication:

```
Authorization: Bearer YOUR_API_KEY
```

## Health Check Endpoints

### Basic Health Check

**Endpoint:** `GET /health`

**Description:** Returns basic system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:30:00.000Z",
  "uptime": 3600
}
```

### Detailed Health Check

**Endpoint:** `GET /health/detailed`

**Description:** Returns comprehensive system health including all services.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "openai": { "status": "healthy" },
    "tavily": { "status": "healthy" },
    "tts": { "status": "healthy" },
    "twilio": { "status": "healthy" },
    "speechRecognition": { "status": "healthy" },
    "geocoding": { "status": "healthy" }
  },
  "system": {
    "memory": {
      "used": 512000000,
      "total": 2048000000,
      "percentage": 25
    },
    "uptime": 3600
  }
}
```

### Integration Health Check

**Endpoint:** `GET /health/integrations`

**Description:** Returns health status of all external integrations.

**Response:**
```json
{
  "openai": { "status": "healthy" },
  "tavily": { "status": "healthy" },
  "tts": { "status": "healthy" },
  "twilio": { "status": "healthy" },
  "speechRecognition": { "status": "healthy" },
  "geocoding": { "status": "healthy" }
}
```

### Configuration Status

**Endpoint:** `GET /health/config`

**Description:** Returns system configuration status.

**Response:**
```json
{
  "app": {
    "name": "dv-support-assistant",
    "version": "1.21.3",
    "environment": "production"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "features": {
    "voice": true,
    "sms": true,
    "websocket": true
  },
  "api": {
    "openai": { "configured": true },
    "tavily": { "configured": true },
    "twilio": { "configured": true }
  },
  "tts": {
    "enabled": true,
    "provider": "openai"
  },
  "logging": {
    "level": "info",
    "output": "console"
  }
}
```

### Readiness Check

**Endpoint:** `GET /health/ready`

**Description:** Kubernetes readiness probe endpoint.

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "external_apis": true,
    "memory": true
  }
}
```

### Liveness Check

**Endpoint:** `GET /health/live`

**Description:** Kubernetes liveness probe endpoint.

**Response:**
```json
{
  "alive": true,
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### Performance Metrics

**Endpoint:** `GET /health/performance`

**Description:** Returns performance monitoring metrics.

**Response:**
```json
{
  "requests": {
    "total": 1500,
    "byMethod": {
      "GET": 1200,
      "POST": 300
    },
    "byPath": {
      "/health": 800,
      "/twilio/voice": 400,
      "/twilio/sms": 300
    },
    "byStatus": {
      "200": 1400,
      "400": 50,
      "500": 50
    }
  },
  "errors": {
    "total": 100,
    "byType": {
      "ValidationError": 30,
      "ApiError": 40,
      "TimeoutError": 30
    }
  },
  "memory": {
    "used": 512000000,
    "total": 2048000000,
    "percentage": 25
  }
}
```

## Twilio Voice Endpoints

### Handle Voice Call

**Endpoint:** `POST /twilio/voice`

**Description:** Handles incoming Twilio voice calls and manages conversation flow.

**Request Body:**
```json
{
  "CallSid": "CA123456789",
  "From": "+1234567890",
  "To": "+0987654321",
  "CallStatus": "ringing|in-progress|completed",
  "Direction": "inbound",
  "SpeechResult": "I need shelter in San Francisco",
  "Confidence": "0.9"
}
```

**Response:** TwiML XML response
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello, I'm here to help you find domestic violence support resources. Please tell me what you need.</Say>
  <Gather input="speech" action="/twilio/voice" method="POST" speechTimeout="auto">
    <Say voice="alice">I'm listening...</Say>
  </Gather>
</Response>
```

**Error Response:**
```json
{
  "error": "Missing required field: CallSid",
  "statusCode": 400
}
```

## Twilio SMS Endpoints

### Handle SMS

**Endpoint:** `POST /twilio/sms`

**Description:** Handles incoming SMS messages and provides resource information.

**Request Body:**
```json
{
  "MessageSid": "SM123456789",
  "From": "+1234567890",
  "To": "+0987654321",
  "Body": "I need shelter in San Francisco"
}
```

**Response:**
```
OK
```

**Note:** The system automatically sends an SMS response with resource information.

## WebSocket Endpoints

### WebSocket Connection

**Endpoint:** `ws://your-domain.com/twilio-stream`

**Description:** Real-time WebSocket connection for call monitoring and streaming.

**Connection Parameters:**
- `callSid`: Twilio Call SID for the active call
- `from`: Caller's phone number
- `to`: Recipient's phone number

**Message Format:**
```json
{
  "type": "call_started|call_ended|speech_detected|resource_found",
  "data": {
    "callSid": "CA123456789",
    "timestamp": "2025-01-27T10:30:00.000Z",
    "message": "Call started"
  }
}
```

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message description",
  "statusCode": 400,
  "timestamp": "2025-01-27T10:30:00.000Z",
  "requestId": "req_123456789"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input or missing required fields |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Endpoint or resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side error |
| 503 | Service Unavailable - Service temporarily unavailable |

### Error Types

- **ValidationError**: Invalid input data
- **ApiError**: External API communication error
- **TimeoutError**: Request timeout
- **ConfigurationError**: Missing or invalid configuration
- **AuthenticationError**: Authentication failure

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Voice Calls**: 10 calls per minute per IP
- **SMS Messages**: 20 messages per minute per IP
- **Health Endpoints**: 100 requests per 15 minutes per IP
- **WebSocket Connections**: 5 connections per minute per IP

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643284800
```

## Examples

### Complete Voice Call Flow

1. **Incoming Call**
```bash
curl -X POST https://your-domain.com/twilio/voice \
  -H "Content-Type: application/json" \
  -d '{
    "CallSid": "CA123456789",
    "From": "+1234567890",
    "To": "+0987654321",
    "CallStatus": "ringing",
    "Direction": "inbound"
  }'
```

2. **User Speaks**
```bash
curl -X POST https://your-domain.com/twilio/voice \
  -H "Content-Type: application/json" \
  -d '{
    "CallSid": "CA123456789",
    "From": "+1234567890",
    "To": "+0987654321",
    "CallStatus": "in-progress",
    "SpeechResult": "I need shelter in San Francisco",
    "Confidence": "0.9"
  }'
```

### SMS Flow

```bash
curl -X POST https://your-domain.com/twilio/sms \
  -H "Content-Type: application/json" \
  -d '{
    "MessageSid": "SM123456789",
    "From": "+1234567890",
    "To": "+0987654321",
    "Body": "I need shelter in San Francisco"
  }'
```

### Health Check

```bash
curl -X GET https://your-domain.com/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Support

For technical support or questions about the API:

- **Email**: support@your-domain.com
- **Documentation**: https://docs.your-domain.com
- **Status Page**: https://status.your-domain.com

## Changelog

### v1.21.3 (January 27, 2025)
- Fixed location extraction bug
- Enhanced follow-up question handling
- Improved conversation context preservation

### v1.21.2 (January 26, 2025)
- Added conversation flow management
- Enhanced error handling
- Improved production reliability

### v1.21.1 (January 25, 2025)
- Optimized TTS timeouts
- Enhanced follow-up detection
- Improved performance

---

*This documentation is maintained by the Domestic Violence Support Assistant development team.* 