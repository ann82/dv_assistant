# Railway Deployment Guide

## Prerequisites

Before deploying to Railway, ensure you have the following environment variables set in your Railway project:

### Required Environment Variables

1. **TWILIO_ACCOUNT_SID** - Your Twilio Account SID
2. **TWILIO_AUTH_TOKEN** - Your Twilio Auth Token  
3. **TWILIO_PHONE_NUMBER** - Your Twilio phone number (format: +1234567890)
4. **TAVILY_API_KEY** - Your Tavily API key
5. **OPENAI_API_KEY** - Your OpenAI API key

### Optional Environment Variables

- **NODE_ENV** - Set to "production" (default)
- **PORT** - Railway will set this automatically
- **LOG_LEVEL** - Set to "info", "debug", "warn", or "error" (default: "info")

## Deployment Steps

1. **Connect your GitHub repository to Railway**
2. **Set environment variables** in Railway dashboard
3. **Deploy** - Railway will automatically build and deploy

## Troubleshooting

### Service Unavailable Errors

If you see "service unavailable" errors:

1. **Check environment variables** - Ensure all required variables are set
2. **Check logs** - View Railway logs for specific error messages
3. **Verify build** - Ensure the build process completes successfully

### Common Issues

#### Missing Environment Variables
```
Error: Missing required environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
```
**Solution**: Set all required environment variables in Railway dashboard

#### Module Import Errors
```
Error: Cannot find module './lib/config.js'
```
**Solution**: Ensure all files are properly included in the deployment

#### Port Issues
```
Error: listen EADDRINUSE
```
**Solution**: Railway handles port assignment automatically

## Health Check

The application provides a health check endpoint at `/health` that returns:
```json
{
  "status": "ok",
  "timestamp": "2024-06-25T00:00:00.000Z"
}
```

## Monitoring

- **Logs**: View real-time logs in Railway dashboard
- **Metrics**: Monitor CPU, memory, and network usage
- **Health**: Check health endpoint for service status

## Support

If you continue to experience issues:

1. Check Railway logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure your Twilio and API keys are valid
4. Contact Railway support if infrastructure issues persist 