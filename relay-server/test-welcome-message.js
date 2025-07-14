import dotenv from 'dotenv';
import { TTSIntegration } from './integrations/ttsIntegration.js';
import { TtsService } from './services/tts/TtsService.js';
import logger from './lib/logger.js';

// Load environment variables
dotenv.config();

async function testWelcomeMessage() {
  console.log('=== Welcome Message TTS Test ===');
  
  // Get the actual welcome message from language config
  const welcomeMessage = "Hello, I'm your domestic violence support assistant. I'm here to help you find resources, information, and support. You can ask me about local shelters, legal help, safety planning, or any other questions you might have. What would you like to know?";
  
  console.log('\n=== Test 1: Direct TTS Integration ===');
  console.log('Welcome message length:', welcomeMessage.length);
  console.log('Welcome message preview:', welcomeMessage.substring(0, 100) + '...');
  
  try {
    const result = await TTSIntegration.generateTTS(welcomeMessage, {
      voice: 'nova',
      speed: 1.0
    }, 'test-welcome-123');
    
    console.log('TTS Integration Success:');
    console.log('- Audio buffer size:', result.audioBuffer?.length || 'none');
    console.log('- Provider:', result.provider);
    console.log('- Voice:', result.voice);
  } catch (error) {
    console.log('TTS Integration Failed:');
    console.log('- Error message:', error.message);
    console.log('- Error code:', error.code);
    console.log('- Error status:', error.status);
  }
  
  console.log('\n=== Test 2: TTS Service ===');
  const ttsService = new TtsService();
  await ttsService.initialize();
  
  try {
    const serviceResult = await ttsService.generateSpeech(welcomeMessage, {
      voice: 'nova',
      language: 'en-US'
    }, {
      requestId: 'test-welcome-service-123',
      callSid: 'test-call-welcome-123'
    });
    
    console.log('TTS Service Success:');
    console.log('- Success:', serviceResult.success);
    if (serviceResult.success && serviceResult.data) {
      console.log('- Audio buffer size:', serviceResult.data.audioBuffer?.length || 'none');
      console.log('- Provider:', serviceResult.data.provider);
      console.log('- Voice:', serviceResult.data.voice);
    } else {
      console.log('- Error:', serviceResult.error);
    }
  } catch (error) {
    console.log('TTS Service Failed:');
    console.log('- Error message:', error.message);
    console.log('- Error code:', error.code);
    console.log('- Error status:', error.status);
  }
  
  console.log('\n=== Test 3: Empty Text (should fail) ===');
  try {
    const result = await TTSIntegration.generateTTS('', {
      voice: 'nova',
      speed: 1.0
    }, 'test-empty-123');
    
    console.log('Unexpected success with empty text:', result);
  } catch (error) {
    console.log('Expected failure with empty text:');
    console.log('- Error message:', error.message);
    console.log('- Error code:', error.code);
    console.log('- Error status:', error.status);
  }
}

testWelcomeMessage().then(() => {
  console.log('\n=== Welcome message test completed ===');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 