import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../relay-server/services/audioService.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Top-level OpenAI mock functions for per-test control
const openaiMockFns = {
  create: vi.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
  }),
  transcriptionsCreate: vi.fn().mockResolvedValue('Test transcription'),
  chatCompletionsCreate: vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'Test response' } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 }
  })
};

// Mock OpenAI client
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: openaiMockFns.create
      },
      transcriptions: {
        create: openaiMockFns.transcriptionsCreate
      }
    },
    chat: {
      completions: {
        create: openaiMockFns.chatCompletionsCreate
      }
    }
  }))
}));

// Mock fs promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    copyFile: vi.fn(),
    rm: vi.fn()
  }
}));

// Mock fs sync
vi.mock('fs', () => ({
  default: {
    createWriteStream: vi.fn().mockImplementation(() => ({
      write: vi.fn((chunk, callback) => callback(null)),
      end: vi.fn((callback) => callback(null))
    })),
    existsSync: vi.fn().mockReturnValue(false) // Start with directories not existing
  }
}));

describe('AudioService', () => {
  let audioService;
  const testDir = path.join(__dirname, 'test-files');

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.values(fs).forEach(fn => {
      if (typeof fn?.mockClear === 'function') fn.mockClear();
    });
    Object.values(fsSync).forEach(fn => {
      if (typeof fn?.mockClear === 'function') fn.mockClear();
    });
    fsSync.existsSync.mockReturnValue(false);
    fs.mkdir.mockResolvedValue(undefined);
    // Reset OpenAI mock functions
    openaiMockFns.create.mockReset().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    openaiMockFns.transcriptionsCreate.mockReset().mockResolvedValue('Test transcription');
    openaiMockFns.chatCompletionsCreate.mockReset().mockResolvedValue({
      choices: [{ message: { content: 'Test response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    });
    const { OpenAI } = await import('openai');
    audioService = new AudioService(new OpenAI());
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  });

  describe('Directory Management', () => {
    it('should create required directories on initialization', async () => {
      await audioService.ensureDirectories();
      // The AudioService constructor also calls ensureDirectories, so expect 4 calls
      expect(fs.mkdir).toHaveBeenCalledTimes(4);
    });

    it('should handle directory creation errors', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Directory creation failed'));
      await expect(audioService.ensureDirectories()).rejects.toThrow('Directory creation failed');
    });
  });

  describe('Cache Management', () => {
    it('should generate consistent cache keys', () => {
      const text = 'test text';
      const key1 = audioService.generateCacheKey(text);
      const key2 = audioService.generateCacheKey(text);
      expect(key1).toBe(key2);
    });

    it('should validate cache entries correctly', () => {
      const now = Date.now();
      expect(audioService.isValidCacheEntry(now)).toBe(true);
      expect(audioService.isValidCacheEntry(now - 25 * 60 * 60 * 1000)).toBe(false);
    });

    it('should clean up old cache files', async () => {
      const mockFiles = [
        { name: 'old1.mp3', stats: { size: 1024, mtimeMs: Date.now() - 25 * 60 * 60 * 1000 } },
        { name: 'old2.mp3', stats: { size: 1024, mtimeMs: Date.now() - 26 * 60 * 60 * 1000 } },
        { name: 'new.mp3', stats: { size: 1024, mtimeMs: Date.now() } }
      ];
      fs.readdir.mockResolvedValue(mockFiles.map(f => f.name));
      fs.stat.mockImplementation((filePath) => {
        const fileName = path.basename(filePath);
        const file = mockFiles.find(f => f.name === fileName);
        return Promise.resolve(file ? file.stats : { size: 0, mtimeMs: 0 });
      });
      fs.unlink.mockResolvedValue();
      await audioService.cleanupCache();
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old1.mp3'));
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old2.mp3'));
    });
  });

  describe('GPT Response Caching', () => {
    it('should cache GPT responses', async () => {
      const transcript = 'test transcript';
      const response1 = await audioService.getGptReply(transcript);
      const response2 = await audioService.getGptReply(transcript);

      expect(response1).toEqual(response2);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should handle cache misses', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('Cache miss'));
      const response = await audioService.getGptReply('new transcript');
      expect(response).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('TTS Generation and Caching', () => {
    it('should generate and cache TTS audio', async () => {
      const text = 'test text';
      const mockStats = { size: 1024, mtimeMs: Date.now() };
      fs.stat.mockResolvedValue(mockStats);
      
      const response1 = await audioService.generateTTS(text);
      const response2 = await audioService.generateTTS(text);

      expect(response1.audioPath).toBeDefined();
      expect(response2.cached).toBe(true);
    });

    it('should handle large audio files with chunking', async () => {
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      openaiMockFns.create.mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(largeBuffer.buffer)
      });
      fs.stat.mockRejectedValueOnce(new Error('File not found')); // Force cache miss
      // Patch fsSync.existsSync to return true for the generated file
      const originalExistsSync = fsSync.existsSync;
      fsSync.existsSync = (filePath) => true;
      // Patch fs.stat to return the correct file size for the generated file
      const originalFsStat = fs.stat;
      fs.stat = vi.fn(async (filePath) => ({ size: 2 * 1024 * 1024, mtimeMs: Date.now() }));
      try {
        const response = await audioService.generateTTS('large text');
        expect(response.chunks).toBeGreaterThan(1);
      } finally {
        fsSync.existsSync = originalExistsSync;
        fs.stat = originalFsStat;
      }
    });

    it('should handle TTS generation errors', async () => {
      openaiMockFns.create.mockRejectedValueOnce(new Error('TTS generation failed'));
      fs.stat.mockRejectedValueOnce(new Error('File not found')); // Force cache miss
      await expect(audioService.generateTTS('test')).rejects.toThrow('TTS generation failed');
    });
  });

  describe('Audio Processing', () => {
    it('should process audio in chunks', async () => {
      const audioBuffer = Buffer.alloc(2 * 1024 * 1024); // 2MB
      const processFn = vi.fn().mockResolvedValue('processed');
      
      const results = await audioService.processAudioInChunks(audioBuffer, processFn);
      expect(results.length).toBeGreaterThan(1);
      expect(processFn).toHaveBeenCalledTimes(Math.ceil(audioBuffer.length / 1024 / 1024));
    });

    it('should handle audio processing errors', async () => {
      const audioBuffer = Buffer.alloc(1024);
      const processFn = vi.fn().mockRejectedValue(new Error('Processing failed'));
      
      await expect(audioService.processAudioInChunks(audioBuffer, processFn))
        .rejects.toThrow('Processing failed');
    });
  });
}); 