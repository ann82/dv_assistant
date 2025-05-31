import { OpenAI } from 'openai';
import { config } from '../lib/config.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Constants for audio chunking
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_CHUNKS = 10; // Maximum number of chunks to process at once

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'cache');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

export class AudioService {
  constructor(openaiClient = openai) {
    this.openai = openaiClient;
    this.audioBuffer = new Map(); // Store audio chunks by callSid
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    this.cacheDir = CACHE_DIR;
    this.responseCache = new Map(); // In-memory cache for GPT responses
    this.ensureDirectories();
  }

  // Ensure all required directories exist
  async ensureDirectories() {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log('Directories ensured:', {
        audio: this.audioDir,
        cache: this.cacheDir
      });
    } catch (error) {
      console.error('Error creating directories:', error);
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
          console.log('Removed expired cache file:', file);
        }
      }

      // Remove files if cache is too large
      while (totalSize > MAX_CACHE_SIZE && fileStats.length > 0) {
        const { file, stats } = fileStats.shift();
        const filePath = path.join(this.cacheDir, file);
        await fs.unlink(filePath);
        totalSize -= stats.size;
        console.log('Removed old cache file:', file);
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
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
      const response = await this.openai.audio.transcriptions.create({
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

  // Get GPT response with caching
  async getGptReply(transcript, context = {}) {
    try {
      const cacheKey = this.generateCacheKey(transcript);
      const cachedResponse = this.responseCache.get(cacheKey);

      // Check in-memory cache first
      if (cachedResponse && this.isValidCacheEntry(cachedResponse.timestamp)) {
        console.log('Using cached GPT response');
        return cachedResponse.data;
      }

      // Check file cache
      const cacheFilePath = path.join(this.cacheDir, `gpt_${cacheKey}.json`);
      try {
        const cachedData = JSON.parse(await fs.readFile(cacheFilePath, 'utf8'));
        if (this.isValidCacheEntry(cachedData.timestamp)) {
          console.log('Using file cached GPT response');
          this.responseCache.set(cacheKey, cachedData);
          return cachedData.data;
        }
      } catch (error) {
        // Cache miss or invalid, continue with API call
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
      const cacheData = {
        timestamp: Date.now(),
        data: result
      };

      // Update in-memory cache
      this.responseCache.set(cacheKey, cacheData);

      // Update file cache
      await fs.writeFile(cacheFilePath, JSON.stringify(cacheData));

      // Clean up old cache files
      await this.cleanupCache();

      return result;
    } catch (error) {
      console.error('Error getting GPT reply:', error);
      throw error;
    }
  }

  // Generate TTS with caching
  async generateTTS(text) {
    try {
      const cacheKey = this.generateCacheKey(text);
      const cacheFilePath = path.join(this.cacheDir, `tts_${cacheKey}.mp3`);

      // Check cache first
      try {
        const stats = await fs.stat(cacheFilePath);
        if (this.isValidCacheEntry(stats.mtimeMs)) {
          console.log('Using cached TTS audio');
          const fileName = `${cacheKey}.mp3`;
          const filePath = path.join(this.audioDir, fileName);
          
          // Copy cached file to audio directory
          await fs.copyFile(cacheFilePath, filePath);
          
          return {
            text,
            audioPath: `/audio/${fileName}`,
            fullPath: filePath,
            size: stats.size,
            chunks: Math.ceil(stats.size / CHUNK_SIZE),
            cached: true
          };
        }
      } catch (error) {
        // Cache miss, continue with TTS generation
      }

      // Create a temporary file
      const fileName = `${uuidv4()}.mp3`;
      const filePath = path.join(this.audioDir, fileName);
      
      // Ensure directory exists
      await this.ensureDirectories();

      console.log('Generating TTS for text:', text.substring(0, 100) + '...');
      console.log('Saving to:', filePath);

      // Use OpenAI TTS
      const response = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text
      });

      // Get the audio buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      const totalSize = buffer.length;
      console.log('Total audio size:', totalSize, 'bytes');

      // If the audio is small enough, write it directly
      if (totalSize <= CHUNK_SIZE) {
        await fs.writeFile(filePath, buffer);
        // Cache the file
        await fs.copyFile(filePath, cacheFilePath);
      } else {
        // Write in chunks
        const chunks = Math.ceil(totalSize / CHUNK_SIZE);
        console.log(`Writing ${chunks} chunks of audio...`);

        const writeStream = fsSync.createWriteStream(filePath);
        const cacheStream = fsSync.createWriteStream(cacheFilePath);
        
        for (let i = 0; i < chunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalSize);
          const chunk = buffer.slice(start, end);
          
          await Promise.all([
            new Promise((resolve, reject) => {
              writeStream.write(chunk, (error) => {
                if (error) reject(error);
                else resolve();
              });
            }),
            new Promise((resolve, reject) => {
              cacheStream.write(chunk, (error) => {
                if (error) reject(error);
                else resolve();
              });
            })
          ]);

          console.log(`Wrote chunk ${i + 1}/${chunks} (${chunk.length} bytes)`);
        }

        // Close the write streams
        await Promise.all([
          new Promise((resolve, reject) => {
            writeStream.end((error) => {
              if (error) reject(error);
              else resolve();
            });
          }),
          new Promise((resolve, reject) => {
            cacheStream.end((error) => {
              if (error) reject(error);
              else resolve();
            });
          })
        ]);
      }

      // Verify the file was created
      if (!fsSync.existsSync(filePath)) {
        throw new Error('Failed to create audio file: ' + filePath);
      }

      // Get file stats to verify size
      const stats = await fs.stat(filePath);
      console.log('TTS audio file stats:', {
        size: stats.size,
        created: stats.birthtime,
        path: filePath,
        chunks: Math.ceil(stats.size / CHUNK_SIZE)
      });

      // Verify file integrity
      if (stats.size !== totalSize) {
        throw new Error(`File size mismatch: expected ${totalSize} bytes, got ${stats.size} bytes`);
      }

      // Clean up old cache files
      await this.cleanupCache();

      console.log('TTS audio generated successfully:', {
        text: text.substring(0, 100) + '...',
        filePath: `/audio/${fileName}`,
        fullPath: filePath,
        size: stats.size,
        chunks: Math.ceil(stats.size / CHUNK_SIZE)
      });

      return {
        text,
        audioPath: `/audio/${fileName}`,
        fullPath: filePath,
        size: stats.size,
        chunks: Math.ceil(stats.size / CHUNK_SIZE),
        cached: false
      };
    } catch (error) {
      console.error('Error generating TTS:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  // Process audio in chunks
  async processAudioInChunks(audioBuffer, processFn) {
    const chunks = [];
    const totalSize = audioBuffer.length;
    
    for (let i = 0; i < totalSize; i += CHUNK_SIZE) {
      const chunk = audioBuffer.slice(i, Math.min(i + CHUNK_SIZE, totalSize));
      chunks.push(chunk);
    }

    console.log(`Processing ${chunks.length} chunks of audio...`);
    
    // Process chunks in batches to avoid memory issues
    const results = [];
    for (let i = 0; i < chunks.length; i += MAX_CHUNKS) {
      const batch = chunks.slice(i, i + MAX_CHUNKS);
      const batchResults = await Promise.all(batch.map(processFn));
      results.push(...batchResults);
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