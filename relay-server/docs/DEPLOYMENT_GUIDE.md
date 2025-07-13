# Deployment Guide - Domestic Violence Support Assistant

**Version:** 1.21.3  
**Last Updated:** January 27, 2025

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Production Deployment](#production-deployment)
5. [Cloud Platform Deployment](#cloud-platform-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Monitoring & Logging](#monitoring--logging)
8. [Security Considerations](#security-considerations)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide covers deploying the Domestic Violence Support Assistant to production environments. The system is designed to be deployed on various cloud platforms and can handle high-traffic scenarios with proper configuration.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                            │
│                    (Cloudflare/NGINX)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Servers                          │
│              (Multiple instances for scaling)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   OpenAI    │  │   Tavily    │  │   Twilio    │             │
│  │     API     │  │     API     │  │     API     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **Memory**: Minimum 512MB RAM (1GB recommended)
- **Storage**: Minimum 1GB available space
- **Network**: Stable internet connection for API calls
- **SSL Certificate**: Required for HTTPS (production)

### Required Accounts & API Keys

1. **Twilio Account**
   - Account SID
   - Auth Token
   - Phone number for voice/SMS

2. **OpenAI Account**
   - API key with GPT-3.5-turbo access

3. **Tavily Account**
   - API key for search functionality

4. **Domain Name** (for production)
   - SSL certificate
   - DNS configuration

## Environment Setup

### Production Environment Variables

Create a `.env` file with the following variables:

```env
# Application Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=250
OPENAI_TIMEOUT=30000

# Tavily Configuration
TAVILY_API_KEY=your_tavily_api_key
TAVILY_SEARCH_DEPTH=basic
TAVILY_TIMEOUT=30000

# Logging Configuration
LOG_LEVEL=info
LOG_OUTPUT=file
LOG_FILE_PATH=/var/log/dv-assistant/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
MEMORY_MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Security
CORS_ORIGIN=https://your-domain.com
TRUST_PROXY=true
HELMET_ENABLED=true

# Cache Configuration
CACHE_TTL=1800000
CACHE_MAX_SIZE=1000
CACHE_CLEANUP_INTERVAL=3600000

# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=8080
WEBSOCKET_PATH=/twilio-stream
```

### Environment-Specific Configurations

#### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
LOG_OUTPUT=console
CORS_ORIGIN=http://localhost:3000
```

#### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
LOG_OUTPUT=file
CORS_ORIGIN=https://staging.your-domain.com
```

#### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
LOG_OUTPUT=file
CORS_ORIGIN=https://your-domain.com
```

## Production Deployment

### Manual Deployment

1. **Prepare the server**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /opt/dv-assistant
sudo chown $USER:$USER /opt/dv-assistant
```

2. **Deploy the application**
```bash
# Clone the repository
cd /opt/dv-assistant
git clone https://github.com/your-org/dv-support-assistant.git .

# Install dependencies
npm ci --only=production

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Create log directory
sudo mkdir -p /var/log/dv-assistant
sudo chown $USER:$USER /var/log/dv-assistant
```

3. **Start the application**
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### PM2 Ecosystem Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'dv-assistant',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/dv-assistant/err.log',
    out_file: '/var/log/dv-assistant/out.log',
    log_file: '/var/log/dv-assistant/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

## Cloud Platform Deployment

### Railway Deployment

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login and initialize**
```bash
railway login
railway init
```

3. **Configure environment variables**
```bash
railway variables set NODE_ENV=production
railway variables set TWILIO_ACCOUNT_SID=your_sid
railway variables set TWILIO_AUTH_TOKEN=your_token
railway variables set OPENAI_API_KEY=your_key
railway variables set TAVILY_API_KEY=your_key
```

4. **Deploy**
```bash
railway up
```

### Render Deployment

1. **Connect repository to Render**
   - Go to Render Dashboard
   - Create new Web Service
   - Connect your GitHub repository

2. **Configure build settings**
```bash
Build Command: npm install
Start Command: npm start
```

3. **Set environment variables**
   - Add all required environment variables in Render dashboard

4. **Deploy**
   - Render will automatically deploy on push to main branch

### Heroku Deployment

1. **Install Heroku CLI**
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Ubuntu
sudo snap install heroku --classic
```

2. **Create Heroku app**
```bash
heroku create your-app-name
```

3. **Set environment variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set TWILIO_ACCOUNT_SID=your_sid
heroku config:set TWILIO_AUTH_TOKEN=your_token
heroku config:set OPENAI_API_KEY=your_key
heroku config:set TAVILY_API_KEY=your_key
```

4. **Deploy**
```bash
git push heroku main
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  dv-assistant:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - TAVILY_API_KEY=${TAVILY_API_KEY}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - dv-assistant
    restart: unless-stopped
```

### Deploy with Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t dv-assistant .
docker run -d -p 3000:3000 --env-file .env dv-assistant
```

## Monitoring & Logging

### Health Monitoring

The application provides several health check endpoints:

```bash
# Basic health check
curl https://your-domain.com/health

# Detailed health check
curl https://your-domain.com/health/detailed

# Performance metrics
curl https://your-domain.com/health/performance

# Integration health
curl https://your-domain.com/health/integrations
```

### Logging Configuration

Configure logging for production:

```javascript
// Logging configuration
const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  output: process.env.LOG_OUTPUT || 'file',
  file: {
    path: process.env.LOG_FILE_PATH || '/var/log/dv-assistant/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || 5
  },
  format: {
    timestamp: true,
    level: true,
    message: true,
    metadata: true
  }
};
```

### Monitoring Tools

#### PM2 Monitoring
```bash
# Monitor application
pm2 monit

# View logs
pm2 logs dv-assistant

# View status
pm2 status
```

#### External Monitoring

Set up monitoring with tools like:
- **UptimeRobot**: For uptime monitoring
- **New Relic**: For application performance monitoring
- **DataDog**: For comprehensive monitoring
- **Sentry**: For error tracking

### Alerting

Configure alerts for:
- Application downtime
- High error rates
- Memory usage spikes
- API rate limit warnings
- External service failures

## Security Considerations

### SSL/TLS Configuration

```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Headers

```javascript
// Security middleware configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Rate Limiting

```javascript
// Rate limiting configuration
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
```

### Environment Variable Security

- Never commit `.env` files to version control
- Use secrets management services
- Rotate API keys regularly
- Use least privilege principle

## Performance Optimization

### Node.js Optimization

```bash
# Start with optimized Node.js flags
node --max-old-space-size=1024 --optimize-for-size server.js
```

### Caching Strategy

```javascript
// Redis caching configuration
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

// Cache frequently accessed data
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    client.get(key, (err, data) => {
      if (data) {
        return res.json(JSON.parse(data));
      }
      next();
    });
  };
};
```

### Load Balancing

```nginx
# Nginx load balancer configuration
upstream dv_assistant {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://dv_assistant;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Common Issues

#### 1. **Application Won't Start**

```bash
# Check Node.js version
node --version

# Check port availability
netstat -tulpn | grep :3000

# Check logs
pm2 logs dv-assistant
```

#### 2. **API Key Issues**

```bash
# Verify environment variables
echo $OPENAI_API_KEY
echo $TAVILY_API_KEY
echo $TWILIO_ACCOUNT_SID

# Test API connections
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

#### 3. **Memory Issues**

```bash
# Check memory usage
free -h
ps aux | grep node

# Restart with more memory
pm2 restart dv-assistant --max-memory-restart 2G
```

#### 4. **Network Issues**

```bash
# Test external API connectivity
curl -I https://api.openai.com
curl -I https://api.tavily.com
curl -I https://api.twilio.com

# Check DNS resolution
nslookup api.openai.com
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set debug environment variable
export DEBUG=*

# Start application in debug mode
NODE_ENV=development LOG_LEVEL=debug npm start
```

### Performance Analysis

```bash
# Monitor CPU and memory usage
top -p $(pgrep -f "node.*server.js")

# Analyze heap memory
node --inspect server.js

# Profile application
node --prof server.js
```

### Recovery Procedures

#### Application Crash Recovery

```bash
# Restart application
pm2 restart dv-assistant

# Check for errors
pm2 logs dv-assistant --lines 100

# Rollback to previous version if needed
git checkout HEAD~1
npm install
pm2 restart dv-assistant
```

#### Database/External Service Issues

```bash
# Check external service health
curl https://your-domain.com/health/integrations

# Implement circuit breaker pattern
# Add fallback mechanisms
# Monitor service status
```

## Support

### Emergency Contacts

- **Technical Support**: tech-support@your-domain.com
- **Operations Team**: ops@your-domain.com
- **Security Team**: security@your-domain.com

### Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Architecture Documentation](../ARCHITECTURE_EVOLUTION.md)

### Monitoring Dashboards

- **Application Health**: https://status.your-domain.com
- **Performance Metrics**: https://metrics.your-domain.com
- **Error Tracking**: https://errors.your-domain.com

---

*This deployment guide is maintained by the Domestic Violence Support Assistant operations team.* 