import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Mock OpenAI
vi.mock('openai', () => {
  const OpenAI = vi.fn().mockImplementation(() => ({
    audio: { speech: { create: vi.fn() } },
    chat: { completions: { create: vi.fn() } }
  }));
  return { OpenAI, default: OpenAI };
});
// Mock Twilio
vi.mock('twilio', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
    calls: { create: vi.fn() }
  }))
}));
import { WebSocketServer } from '../src/services/websocketServer.js';
import { WebSocket } from 'ws';
import { TwilioWebSocketServer } from '../websocketServer.js';

// Mock dependencies
vi.mock('ws');
vi.mock('../lib/config.js', () => ({
  config: {
    WS_PORT: 8080
  }
}));

describe('WebSocketServer', () => {
  let wsServer;
  let mockServer;

  beforeEach(() => {
    mockServer = {
      on: vi.fn(),
      emit: vi.fn()
    };
    wsServer = new WebSocketServer(mockServer);
  });

  afterEach(() => {
    wsServer = null;
  });

  it('should initialize WebSocket server', () => {
    expect(wsServer.wss).toBeDefined();
    expect(mockServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });

  it('should handle new connections', () => {
    const mockWs = {
      on: vi.fn(),
      send: vi.fn(),
      readyState: 1 // OPEN state
    };

    // Find the handler registered for 'connection' and call it manually
    const connectionHandler = wsServer.wss.on.mock.calls.find(
      ([event]) => event === 'connection'
    )[1];
    connectionHandler(mockWs);

    expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should broadcast messages to all clients', () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1 };
    const message = { type: 'test', data: 'test data' };

    // Add clients to the Set
    wsServer.wss.clients = new Set([mockWs1, mockWs2]);

    wsServer.broadcast(message);

    expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
  });
});

describe('TwilioWebSocketServer', () => {
  let server;
  let mockAudioService;
  let mockCallSummaryService;
  let mockWebSocket;
  let mockServer;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock WebSocket instance
    mockWebSocket = {
      on: vi.fn(),
      close: vi.fn(),
      send: vi.fn()
    };

    // Mock server with EventEmitter interface
    mockServer = {
      on: vi.fn(),
      emit: vi.fn(),
      listeners: vi.fn().mockReturnValue([]),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      once: vi.fn(),
      addListener: vi.fn()
    };

    // Mock audio service
    mockAudioService = {
      transcribeWithWhisper: vi.fn(),
      getGptReply: vi.fn(),
      generateTTS: vi.fn(),
      accumulateAudio: vi.fn(),
      getAccumulatedAudio: vi.fn(),
      clearAccumulatedAudio: vi.fn()
    };

    // Mock call summary service
    mockCallSummaryService = {
      addToHistory: vi.fn(),
      getHistory: vi.fn(),
      generateSummary: vi.fn().mockResolvedValue(null)
    };

    // Create server instance
    server = new TwilioWebSocketServer(mockServer);
    server.audioService = mockAudioService;
    server.callSummaryService = mockCallSummaryService;
  });

  describe('handleCallEnd', () => {
    it('should generate summary for call with history', async () => {
      const callSid = 'test-call-sid';
      const mockSummary = 'Test summary';
      const mockHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];

      // Setup mock call
      server.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        conversationHistory: mockHistory
      });

      // Mock summary generation
      mockCallSummaryService.generateSummary.mockResolvedValue(mockSummary);

      const summary = await server.handleCallEnd(callSid);

      expect(summary).toBe(mockSummary);
      expect(mockCallSummaryService.generateSummary).toHaveBeenCalledWith(mockHistory);
      expect(server.activeCalls.has(callSid)).toBe(false);
    });

    it('should handle call with no history', async () => {
      const callSid = 'test-call-sid';
      const mockCall = {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        conversationHistory: []
      };
      server.activeCalls.set(callSid, mockCall);

      const summary = await server.handleCallEnd(callSid);

      expect(summary).toBeNull();
      expect(mockAudioService.getGptReply).not.toHaveBeenCalled();
      expect(server.activeCalls.has(callSid)).toBe(false);
    });

    it('should handle non-existent call', async () => {
      const summary = await server.handleCallEnd('non_existent_call');

      expect(summary).toBeNull();
      expect(mockAudioService.getGptReply).not.toHaveBeenCalled();
    });

    it('should handle GPT service error', async () => {
      const callSid = 'test-call-sid';
      const mockCall = {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        conversationHistory: []
      };
      server.activeCalls.set(callSid, mockCall);

      mockAudioService.getGptReply.mockRejectedValue(new Error('GPT service error'));

      const summary = await server.handleCallEnd(callSid);

      expect(summary).toBeNull();
      expect(server.activeCalls.has(callSid)).toBe(false);
    });
  });

  describe('handleStreamEnd', () => {
    it('should handle stream end for active call', async () => {
      const callSid = 'test-call-sid';
      const mockAudioChunks = [Buffer.from('test audio')];
      const mockTranscript = 'test transcript';
      const mockGptResponse = { text: 'test response' };

      // Setup mock call
      server.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        ws: mockWebSocket
      });

      // Mock audio processing
      mockAudioService.getAccumulatedAudio.mockReturnValue(mockAudioChunks);
      mockAudioService.transcribeWithWhisper.mockResolvedValue(mockTranscript);
      mockAudioService.getGptReply.mockResolvedValue(mockGptResponse);

      await server.handleStreamEnd(callSid, mockWebSocket);

      expect(mockAudioService.getAccumulatedAudio).toHaveBeenCalledWith(callSid);
      expect(mockAudioService.transcribeWithWhisper).toHaveBeenCalled();
      expect(mockCallSummaryService.addToHistory).toHaveBeenCalledWith(callSid, {
        role: 'user',
        content: mockTranscript
      });
      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it('should handle stream end for non-existent call', async () => {
      const mockWs = {
        send: vi.fn()
      };
      await server.handleStreamEnd('non_existent_call', mockWs);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'error',
        message: 'Error processing audio'
      }));
    });
  });

  describe('registerCall', () => {
    it('should register new call', () => {
      const callSid = 'test-call-sid';
      const from = '+1234567890';

      server.registerCall(callSid, from);

      const call = server.activeCalls.get(callSid);
      expect(call).toBeDefined();
      expect(call.from).toBe(from);
      expect(call.startTime).toBeDefined();
      expect(call.hasConsent).toBe(false);
      expect(call.conversationHistory).toEqual([]);
    });

    it('should update existing call', () => {
      const callSid = 'test-call-sid';
      const from = '+1234567890';
      const existingCall = {
        from: '+1987654321',
        startTime: new Date(),
        hasConsent: true,
        conversationHistory: ['existing']
      };
      server.activeCalls.set(callSid, existingCall);

      server.registerCall(callSid, from);

      const call = server.activeCalls.get(callSid);
      expect(call.from).toBe(from);
      expect(call.hasConsent).toBe(false);
      expect(call.conversationHistory).toEqual([]);
    });
  });

  describe('addToHistory', () => {
    it('should add message to call history', () => {
      const callSid = 'test-call-sid';
      const message = { role: 'user', content: 'Hello' };

      // Setup mock call
      server.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        conversationHistory: []
      });

      server.addToHistory(callSid, message);

      const call = server.activeCalls.get(callSid);
      expect(call.conversationHistory).toContainEqual(message);
    });

    it('should handle non-existent call', () => {
      const message = { role: 'user', content: 'Hello' };
      server.addToHistory('non_existent_call', message);
      // Should not throw error
    });
  });
}); 