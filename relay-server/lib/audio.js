import { config } from './config.js';

export class AudioProcessor {
  static async preprocessAudio(audioData) {
    try {
      // Check if audio is empty
      if (!audioData || audioData.length === 0) {
        return null;
      }

      // Convert to Float32Array if needed
      const audioArray = new Float32Array(audioData);
      
      // Calculate duration
      const duration = audioArray.length / 24000; // Assuming 24kHz sample rate
      
      // Check minimum duration
      if (duration < config.MIN_AUDIO_DURATION) {
        return null;
      }

      // Trim silence
      const trimmedAudio = this.trimSilence(audioArray);
      
      // Check if anything remains after trimming
      if (trimmedAudio.length === 0) {
        return null;
      }

      return trimmedAudio;
    } catch (error) {
      console.error('Error preprocessing audio:', error);
      return null;
    }
  }

  static trimSilence(audioArray) {
    const threshold = Math.pow(10, config.SILENCE_THRESHOLD / 20);
    const minSilenceSamples = config.SILENCE_DURATION * 24000;
    
    let start = 0;
    let end = audioArray.length;
    
    // Find start of audio
    for (let i = 0; i < audioArray.length; i++) {
      if (Math.abs(audioArray[i]) > threshold) {
        start = i;
        break;
      }
    }
    
    // Find end of audio
    for (let i = audioArray.length - 1; i >= 0; i--) {
      if (Math.abs(audioArray[i]) > threshold) {
        end = i + 1;
        break;
      }
    }
    
    // Check if we have enough samples
    if (end - start < minSilenceSamples) {
      return new Float32Array(0);
    }
    
    return audioArray.slice(start, end);
  }

  static async shouldProcessAudio(audioData) {
    const processedAudio = await this.preprocessAudio(audioData);
    return {
      shouldProcess: processedAudio !== null,
      processedAudio
    };
  }
} 