import dotenv from 'dotenv';
import { TTSIntegration } from './integrations/ttsIntegration.js';
import { TtsService } from './services/tts/TtsService.js';
import logger from './lib/logger.js';

// Load environment variables
dotenv.config();

async function testTTSDebug() {
  console.log('=== TTS Debug Test ===');
  console.log('Environment variables:');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***' + process.env.OPENAI_API_KEY.slice(-4) : 'NOT SET');
  console.log('- TTS_PROVIDER:', process.env.TTS_PROVIDER || 'openai (default)');
  console.log('- ENABLE_TTS:', process.env.ENABLE_TTS);
  console.log('- TTS_VOICE:', process.env.TTS_VOICE);
  
  try {
    // Test 1: Direct TTS Integration
    console.log('\n=== Test 1: Direct TTS Integration ===');
    const testText = "Hello, this is a test of the TTS functionality.";
    console.log('Testing with text:', testText);
    
    try {
      const result = await TTSIntegration.generateTTS(testText, {
        voice: 'nova',
        speed: 1.0
      }, 'test-tts-debug-123');
      
      console.log('✅ TTS Integration successful!');
      console.log('- Audio size:', result.audioBuffer ? result.audioBuffer.length : 'N/A');
      console.log('- Provider:', result.provider);
      console.log('- Voice:', result.voice);
    } catch (error) {
      console.log('❌ TTS Integration failed:');
      console.log('- Error message:', error.message);
      console.log('- Error code:', error.code);
      console.log('- Error status:', error.status);
      console.log('- Error type:', error.constructor.name);
      if (error.response) {
        console.log('- Response status:', error.response.status);
        console.log('- Response data:', error.response.data);
      }
      if (error.request) {
        console.log('- Request method:', error.request.method);
        console.log('- Request URL:', error.request.url);
      }
    }
    
    // Test 2: TTS Service
    console.log('\n=== Test 2: TTS Service ===');
    const ttsService = new TtsService();
    await ttsService.initialize();
    
    try {
      const serviceResult = await ttsService.generateSpeech(testText, {
        voice: 'nova',
        language: 'en-US'
      }, {
        requestId: 'test-service-123',
        callSid: 'test-call-123'
      });
      
      console.log('✅ TTS Service successful!');
      console.log('- Success:', serviceResult.success);
      if (serviceResult.success) {
        console.log('- Audio size:', serviceResult.data.audioBuffer ? serviceResult.data.audioBuffer.length : 'N/A');
        console.log('- Provider:', serviceResult.data.provider);
      }
    } catch (error) {
      console.log('❌ TTS Service failed:');
      console.log('- Error message:', error.message);
      console.log('- Error code:', error.code);
      console.log('- Error status:', error.status);
      console.log('- Error type:', error.constructor.name);
      if (error.response) {
        console.log('- Response status:', error.response.status);
        console.log('- Response data:', error.response.data);
      }
    }
    
    // Test 3: Health Check
    console.log('\n=== Test 3: TTS Health Check ===');
    try {
      const isHealthy = await TTSIntegration.isHealthy('test-health-123');
      console.log('TTS Health check result:', isHealthy);
    } catch (error) {
      console.log('❌ TTS Health check failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testTTSDebug().then(() => {
  console.log('\n=== Test completed ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 