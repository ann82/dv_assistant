import dotenv from 'dotenv';
import { TTSIntegration } from './integrations/ttsIntegration.js';
import logger from './lib/logger.js';

// Load environment variables
dotenv.config();

async function testTTS() {
  console.log('Testing TTS functionality...');
  console.log('Environment variables:');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***' + process.env.OPENAI_API_KEY.slice(-4) : 'NOT SET');
  console.log('- TTS_PROVIDER:', process.env.TTS_PROVIDER || 'openai (default)');
  
  try {
    // Test TTS generation
    const testText = "Hello, this is a test of the TTS functionality.";
    console.log('\nGenerating TTS for:', testText);
    
    const result = await TTSIntegration.generateTTS(testText, {
      voice: 'nova',
      speed: 1.0
    }, 'test-tts-123');
    
    console.log('TTS generation successful!');
    console.log('- Audio size:', result.audioBuffer ? result.audioBuffer.length : 'N/A');
    console.log('- Provider:', result.provider);
    console.log('- Voice:', result.voice);
    
    // Test health check
    console.log('\nTesting TTS health check...');
    const isHealthy = await TTSIntegration.isHealthy('test-health-123');
    console.log('TTS health check result:', isHealthy);
    
    console.log('\n✅ TTS functionality is working correctly!');
    
  } catch (error) {
    console.error('❌ TTS test failed:', error.message);
    console.error('Error details:', error);
  }
}

testTTS().then(() => {
  console.log('Test completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 