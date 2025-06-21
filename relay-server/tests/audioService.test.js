import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../services/audioService.js';

describe('AudioService', () => {
  let audioService;

  beforeEach(() => {
    audioService = new AudioService();
  });

  afterEach(() => {
    audioService = null;
  });

  it('should initialize with empty audio buffer', () => {
    expect(audioService.audioBuffer).toBeDefined();
    expect(audioService.audioBuffer instanceof Map).toBe(true);
    expect(audioService.audioBuffer.size).toBe(0);
  });

  it('should accumulate audio for a call', () => {
    const callSid = 'test-call-sid';
    const audioChunk = Buffer.from('test audio data');
    
    audioService.accumulateAudio(callSid, audioChunk);
    expect(audioService.audioBuffer.has(callSid)).toBe(true);
    expect(audioService.audioBuffer.get(callSid)).toEqual([audioChunk]);
  });

  it('should get accumulated audio for a call', () => {
    const callSid = 'test-call-sid';
    const audioChunk = Buffer.from('test audio data');
    
    audioService.accumulateAudio(callSid, audioChunk);
    const retrievedAudio = audioService.getAccumulatedAudio(callSid);
    expect(retrievedAudio).toEqual([audioChunk]);
  });

  it('should clear accumulated audio for a call', () => {
    const callSid = 'test-call-sid';
    const audioChunk = Buffer.from('test audio data');
    
    audioService.accumulateAudio(callSid, audioChunk);
    expect(audioService.audioBuffer.has(callSid)).toBe(true);
    
    audioService.clearAccumulatedAudio(callSid);
    expect(audioService.audioBuffer.has(callSid)).toBe(false);
  });
}); 