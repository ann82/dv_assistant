import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export class AudioService {
  constructor() {
    this.audioBuffer = new Map(); // Store audio chunks by callSid
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    this.ensureAudioDirectory();
  }

  // Ensure audio directory exists
  async ensureAudioDirectory() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
      console.log('Audio directory ensured at:', this.audioDir);
    } catch (error) {
      console.error('Error creating audio directory:', error);
      throw error;
    }
  }

  // Decode Twilio's μ-law audio to PCM
  async decodeTwilioAudio(payload) {
    try {
      const audioData = Buffer.from(payload, 'base64');
      // Convert μ-law to PCM (16-bit)
      const pcmData = this.ulawToPCM(audioData);
      return pcmData;
    } catch (error) {
      console.error('Error decoding Twilio audio:', error);
      throw error;
    }
  }

  // Convert μ-law to PCM
  ulawToPCM(ulawData) {
    const pcmData = Buffer.alloc(ulawData.length * 2);
    for (let i = 0; i < ulawData.length; i++) {
      const pcm = this.ulaw2linear(ulawData[i]);
      pcmData.writeInt16LE(pcm, i * 2);
    }
    return pcmData;
  }

  // μ-law to linear conversion
  ulaw2linear(ulaw) {
    ulaw = ~ulaw;
    const sign = (ulaw & 0x80) ? -1 : 1;
    const exponent = (ulaw & 0x70) >> 4;
    const mantissa = ulaw & 0x0F;
    const sample = sign * ((mantissa << 3) + 0x84) << exponent;
    return sample - 0x84;
  }

  // Transcribe audio using Whisper
  async transcribeWithWhisper(audioBuffer) {
    try {
      // Create a temporary file
      const fileName = `${uuidv4()}.wav`;
      const filePath = path.join('public', 'audio', fileName);
      
      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write the audio buffer to a file
      await fs.writeFile(filePath, audioBuffer);

      // Create a file object for OpenAI
      const file = await fs.open(filePath, 'r');
      const fileStream = file.createReadStream();

      console.log('Sending audio to Whisper for transcription...');
      const response = await openai.audio.transcriptions.create({
        file: fileStream,
        model: "whisper-1",
        language: "en-US", // Using en-US as default
        response_format: "text"
      });

      console.log('Whisper transcription complete:', response);

      // Clean up
      await file.close();
      await fs.unlink(filePath);

      return response;
    } catch (error) {
      console.error('Error transcribing with Whisper:', error);
      throw error;
    }
  }

  // Get GPT response
  async getGptReply(transcript, context = {}) {
    try {
      const model = this.shouldUseGPT4(transcript) ? config.GPT4_MODEL : config.GPT35_MODEL;
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are a supportive assistant for people experiencing domestic violence. Provide clear, safe, and helpful responses in the same language as the user."
          },
          {
            role: "user",
            content: transcript
          }
        ],
        max_tokens: config.DEFAULT_MAX_TOKENS
      });

      return {
        text: response.choices[0].message.content,
        model,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens
      };
    } catch (error) {
      console.error('Error getting GPT reply:', error);
      throw error;
    }
  }

  // Generate TTS using OpenAI TTS
  async generateTTS(text) {
    try {
      // Create a temporary file
      const fileName = `${uuidv4()}.mp3`;
      const filePath = path.join(this.audioDir, fileName);
      
      // Ensure directory exists
      await this.ensureAudioDirectory();

      console.log('Generating TTS for text:', text.substring(0, 100) + '...');
      console.log('Saving to:', filePath);

      // Use OpenAI TTS
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text
      });

      // Save the audio file
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      // Verify the file was created
      if (!fsSync.existsSync(filePath)) {
        throw new Error('Failed to create audio file: ' + filePath);
      }

      // Get file stats to verify size
      const stats = await fs.stat(filePath);
      console.log('TTS audio file stats:', {
        size: stats.size,
        created: stats.birthtime,
        path: filePath
      });

      console.log('TTS audio generated successfully:', {
        text: text.substring(0, 100) + '...',
        filePath: `/audio/${fileName}`,
        fullPath: filePath,
        size: stats.size
      });

      return {
        text,
        audioPath: `/audio/${fileName}`,
        fullPath: filePath,
        size: stats.size
      };
    } catch (error) {
      console.error('Error generating TTS:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  // Determine if GPT-4 should be used
  shouldUseGPT4(transcript) {
    // Add logic to determine when to use GPT-4
    // For now, use GPT-4 for all requests
    return true;
  }

  // Accumulate audio chunks
  accumulateAudio(callSid, audioChunk) {
    if (!this.audioBuffer.has(callSid)) {
      this.audioBuffer.set(callSid, []);
    }
    this.audioBuffer.get(callSid).push(audioChunk);
  }

  // Get accumulated audio
  getAccumulatedAudio(callSid) {
    return this.audioBuffer.get(callSid) || [];
  }

  // Clear accumulated audio
  clearAccumulatedAudio(callSid) {
    this.audioBuffer.delete(callSid);
  }
} 