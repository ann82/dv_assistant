import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { gptCache } from '../lib/queryCache.js';
import logger from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Constants for audio chunking
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_CHUNKS = 10; // Maximum number of chunks to process at once

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'cache');
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

export class AudioService {
  constructor(openaiClient = openai) {
    this.openai = openaiClient;
    this.audioBuffer = new Map(); // Store audio chunks by callSid
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    this.cacheDir = path.join(process.cwd(), 'cache', 'audio');
    this.accumulatedAudio = new Map();
    this.ensureDirectories();
  }

  // Ensure all required directories exist
  async ensureDirectories() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('Directories ensured:', {
        audio: this.audioDir,
        cache: this.cacheDir
      });
    } catch (error) {
      logger.error('Error creating directories:', error);
      throw error;
    }
  }

  // Generate cache key from text
  generateCacheKey(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  // Check if cache entry is valid
  isValidCacheEntry(timestamp) {
    return Date.now() - timestamp < CACHE_TTL;
  }

  // Clean up old cache files
  async cleanupCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const fileStats = [];

      // Get stats for all files
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        fileStats.push({ file, stats });
        totalSize += stats.size;
      }

      // Sort by last modified time (oldest first)
      fileStats.sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs);

      // Remove old files based on TTL
      for (const { file, stats } of fileStats) {
        if (!this.isValidCacheEntry(stats.mtimeMs)) {
          const filePath = path.join(this.cacheDir, file);
          await fs.unlink(filePath);
          totalSize -= stats.size;
          logger.info('Removed expired cache file:', { file });
        }
      }

      // Remove files if cache is too large
      while (totalSize > MAX_CACHE_SIZE && fileStats.length > 0) {
        const { file, stats } = fileStats.shift();
        const filePath = path.join(this.cacheDir, file);
        await fs.unlink(filePath);
        totalSize -= stats.size;
        logger.info('Removed old cache file:', { file });
      }
    } catch (error) {
      logger.error('Error cleaning up cache:', error);
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
      logger.error('Error decoding Twilio audio:', error);
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

      logger.info('Sending audio to Whisper for transcription...');
      const response = await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: "whisper-1",
        language: "en-US", // Using en-US as default
        response_format: "text"
      });

      logger.info('Whisper transcription complete:', { response: response.substring(0, 100) + '...' });

      // Clean up
      await file.close();
      await fs.unlink(filePath);

      return response;
    } catch (error) {
      logger.error('Error transcribing with Whisper:', error);
      throw error;
    }
  }

  // Get GPT response with caching
  async getGptReply(transcript, context = {}) {
    try {
      const cacheKey = this.generateCacheKey(transcript);
      const cachedResponse = gptCache.get(cacheKey);

      if (cachedResponse) {
        logger.info('Using cached GPT response');
        return cachedResponse;
      }

      const model = this.shouldUseGPT4(transcript) ? config.GPT4_MODEL : config.GPT35_MODEL;
      
      const response = await this.openai.chat.completions.create({
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

      const result = {
        text: response.choices[0].message.content,
        model,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens
      };

      // Cache the response
      gptCache.set(cacheKey, result, CACHE_TTL);

      return result;
    } catch (error) {
      logger.error('Error getting GPT reply:', error);
      throw error;
    }
  }

  // Generate TTS with caching
  async generateTTS(text) {
    try {
      // Check if TTS is enabled
      if (!config.ENABLE_TTS) {
        logger.info('TTS is disabled, throwing error to trigger fallback');
        throw new Error('TTS is disabled');
      }

      const cacheKey = this.generateCacheKey(text);
      const cacheFilePath = path.join(this.cacheDir, `tts_${cacheKey}.mp3`);

      // Check cache first
      try {
        const stats = await fs.stat(cacheFilePath);
        if (this.isValidCacheEntry(stats.mtimeMs)) {
          logger.info('Using cached TTS audio');
          const fileName = `${cacheKey}.mp3`;
          const filePath = path.join(this.audioDir, fileName);
          
          // Copy cached file to audio directory
          await fs.copyFile(cacheFilePath, filePath);
          
          return {
            text,
            fileName,
            filePath,
            cached: true
          };
        }
      } catch (error) {
        // Cache miss, continue to generate
      }

      // Generate new TTS with timeout
      logger.info('Generating TTS for text:', { 
        text: text.substring(0, 100) + '...',
        filePath: cacheFilePath,
        voice: config.TTS_VOICE,
        timeout: config.TTS_TIMEOUT
      });
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, config.TTS_TIMEOUT);

      try {
        const response = await this.openai.audio.speech.create({
          model: "tts-1",
          voice: config.TTS_VOICE,
          input: text
        }, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Calculate total size and chunk size
        const totalSize = buffer.length;
        const chunkSize = 1024 * 1024; // 1MB chunks
        const chunks = Math.ceil(totalSize / chunkSize);
        
        logger.info('Total audio size:', { totalSize, bytes: totalSize });
        
        // Write in chunks to avoid memory issues
        logger.info(`Writing ${chunks} chunks of audio...`);
        
        for (let i = 0; i < chunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, totalSize);
          const chunk = buffer.slice(start, end);
          
          if (i === 0) {
            // First chunk - create file
            await fs.writeFile(cacheFilePath, chunk);
          } else {
            // Append to file
            await fs.appendFile(cacheFilePath, chunk);
          }
          
          logger.info(`Wrote chunk ${i + 1}/${chunks}`, { chunkLength: chunk.length });
        }

        // Get file stats
        const stats = await fs.stat(cacheFilePath);
        logger.info('TTS audio file stats:', {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });

        // Copy to audio directory for serving
        const fileName = `${cacheKey}.mp3`;
        const filePath = path.join(this.audioDir, fileName);
        await fs.copyFile(cacheFilePath, filePath);

        logger.info('TTS audio generated successfully:', {
          text: text.substring(0, 50) + '...',
          fileName,
          filePath,
          size: stats.size,
          voice: config.TTS_VOICE
        });

        return {
          text,
          fileName,
          filePath,
          cached: false
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          logger.error(`TTS generation timed out after ${config.TTS_TIMEOUT}ms`);
          throw new Error('TTS generation timed out');
        }
        
        throw fetchError;
      }

    } catch (error) {
      logger.error('Error generating TTS:', error);
      logger.error('Error stack:', error.stack);
      throw error;
    }
  }

  // Process audio in chunks
  async processAudioInChunks(audioBuffer, processFn) {
    const chunks = this.splitAudioIntoChunks(audioBuffer);
    logger.info(`Processing ${chunks.length} chunks of audio...`);
    
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const result = await processFn(chunks[i], i);
      results.push(result);
    }
    return results;
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