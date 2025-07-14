import dotenv from 'dotenv';
import { TwilioVoiceHandler } from './handlers/voice/TwilioVoiceHandler.js';
import { TtsService } from './services/tts/TtsService.js';
import { SearchService } from './services/search/SearchService.js';
import { ContextService } from './services/context/ContextService.js';
import logger from './lib/logger.js';

// Load environment variables
dotenv.config();

async function testWelcomeFix() {
  console.log('=== Welcome Message Fix Test ===');
  
  // Create services
  const ttsService = new TtsService();
  const searchService = new SearchService();
  const contextService = new ContextService();
  
  await ttsService.initialize();
  await searchService.initialize();
  await contextService.initialize();
  
  // Create TwilioVoiceHandler with test credentials
  const handler = new TwilioVoiceHandler(
    'ACtest123456789',
    'test_auth_token',
    '+1234567890',
    {
      tts: ttsService,
      search: searchService,
      context: contextService
    },
    {
      // Mock Twilio validation for testing
      validateRequest: () => true
    }
  );
  
  console.log('\n=== Test 1: Welcome Message Generation ===');
  
  // Simulate incoming call request
  const mockRequest = {
    body: {
      CallSid: 'test-call-123',
      From: '+1234567890',
      To: '+0987654321'
    },
    headers: {},
    originalUrl: '/twilio/voice',
    protocol: 'http',
    get: (header) => 'localhost',
    method: 'POST',
    setTimeout: () => {}
  };
  
  try {
    const twiml = await handler.handleIncomingCall(mockRequest);
    console.log('Welcome TwiML generated successfully:');
    console.log('- TwiML type:', twiml.constructor.name);
    console.log('- TwiML content length:', twiml.toString().length);
    console.log('- TwiML preview:', twiml.toString().substring(0, 200) + '...');
    
    // Check if it contains TTS elements
    const twimlString = twiml.toString();
    if (twimlString.includes('<Play>')) {
      console.log('✅ TTS-based TwiML detected');
    } else if (twimlString.includes('<Say>')) {
      console.log('⚠️  Fallback Say TwiML detected');
    } else {
      console.log('❓ Unknown TwiML format');
    }
    
  } catch (error) {
    console.log('❌ Welcome message generation failed:');
    console.log('- Error message:', error.message);
    console.log('- Error stack:', error.stack);
  }
  
  console.log('\n=== Test 2: Direct TTS Service Call ===');
  
  try {
    const welcomeMessage = "Hello, and thank you for reaching out. I'm here to listen and help you find the support and resources you need. Your safety is my top priority. Are you in immediate danger right now? If so, please call 911. Otherwise, I'm here to help you find shelters, counseling, legal services, or any other support you might need. What brings you to call today?";
    
    const result = await ttsService.generateSpeech(welcomeMessage, {
      voice: 'nova',
      language: 'en-US'
    }, {
      requestId: 'test-direct-123',
      callSid: 'test-call-123'
    });
    
    console.log('Direct TTS service call successful:');
    console.log('- Success:', result.success);
    if (result.success && result.data) {
      console.log('- Audio buffer size:', result.data.audioBuffer?.length || 'none');
      console.log('- Provider:', result.data.provider);
    } else {
      console.log('- Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Direct TTS service call failed:');
    console.log('- Error message:', error.message);
  }
}

testWelcomeFix().then(() => {
  console.log('\n=== Welcome fix test completed ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 