import dotenv from 'dotenv';
import { TTSIntegration } from './integrations/ttsIntegration.js';
import { TtsService } from './services/tts/TtsService.js';
import logger from './lib/logger.js';

// Load environment variables
dotenv.config();

async function testTTSError() {
  console.log('=== TTS Error Test ===');
  
  // Test 1: Try with invalid text to trigger error
  console.log('\n=== Test 1: Invalid Text ===');
  try {
    const result = await TTSIntegration.generateTTS('', {
      voice: 'nova',
      speed: 1.0
    }, 'test-error-123');
    
    console.log('Unexpected success:', result);
  } catch (error) {
    console.log('Expected error caught:');
    console.log('- Error message:', error.message);
    console.log('- Error code:', error.code);
    console.log('- Error status:', error.status);
    console.log('- Error type:', error.constructor.name);
    console.log('- Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
  
  // Test 2: Try with invalid voice to trigger error
  console.log('\n=== Test 2: Invalid Voice ===');
  try {
    const result = await TTSIntegration.generateTTS('Hello world', {
      voice: 'invalid_voice_123',
      speed: 1.0
    }, 'test-error-456');
    
    console.log('Unexpected success:', result);
  } catch (error) {
    console.log('Expected error caught:');
    console.log('- Error message:', error.message);
    console.log('- Error code:', error.code);
    console.log('- Error status:', error.status);
    console.log('- Error type:', error.constructor.name);
    console.log('- Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
  
  // Test 3: Try with TTS Service
  console.log('\n=== Test 3: TTS Service Error ===');
  const ttsService = new TtsService();
  await ttsService.initialize();
  
  try {
    const serviceResult = await ttsService.generateSpeech('', {
      voice: 'invalid_voice',
      language: 'en-US'
    }, {
      requestId: 'test-service-error-123',
      callSid: 'test-call-error-123'
    });
    
    console.log('Unexpected service success:', serviceResult);
  } catch (error) {
    console.log('Expected service error caught:');
    console.log('- Error message:', error.message);
    console.log('- Error code:', error.code);
    console.log('- Error status:', error.status);
    console.log('- Error type:', error.constructor.name);
    console.log('- Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
}

testTTSError().then(() => {
  console.log('\n=== Error test completed ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 