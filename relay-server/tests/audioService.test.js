import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../src/services/audioService.js';

describe('AudioService', () => {
  let audioService;

  beforeEach(() => {
    audioService = new AudioService();
  });

  afterEach(() => {
    audioService = null;
  });

  it('should initialize with empty streams', () => {
    expect(audioService.streams).toBeDefined();
    expect(Object.keys(audioService.streams).length).toBe(0);
  });

  it('should add a new stream', () => {
    const streamId = 'test-stream';
    const stream = { id: streamId };
    audioService.addStream(streamId, stream);
    expect(audioService.streams[streamId]).toBe(stream);
  });

  it('should remove a stream', () => {
    const streamId = 'test-stream';
    const stream = { id: streamId };
    audioService.addStream(streamId, stream);
    audioService.removeStream(streamId);
    expect(audioService.streams[streamId]).toBeUndefined();
  });
}); 