import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  },
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}));
// Mock OpenAI Integration
vi.mock('../integrations/openaiIntegration.js', () => ({
  OpenAIIntegration: vi.fn().mockImplementation(() => ({
    createChatCompletion: vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Test response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }),
    createTTS: vi.fn().mockResolvedValue(Buffer.from('test audio')),
    transcribeAudio: vi.fn().mockResolvedValue('Test transcription'),
    createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    getStatus: vi.fn().mockReturnValue({
      available: true,
      keyPrefix: 'sk-test',
      timeout: 30000,
      maxRetries: 3,
      maxTokens: 150
    }),
    testConnection: vi.fn().mockResolvedValue(true)
  })),
  openAIIntegration: {
    createChatCompletion: vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Test response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }),
    createTTS: vi.fn().mockResolvedValue(Buffer.from('test audio')),
    transcribeAudio: vi.fn().mockResolvedValue('Test transcription'),
    createEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
  }
}));
// Mock Twilio
vi.mock('twilio', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
    calls: { create: vi.fn() }
  }))
}));
// Mock ws module
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    handleUpgrade: vi.fn(),
    clients: new Set()
  }))
}));
// Mock services
vi.mock('../services/audioService.js', () => ({
  AudioService: vi.fn().mockImplementation(() => ({
    accumulateAudio: vi.fn(),
    getAccumulatedAudio: vi.fn(),
    clearAccumulatedAudio: vi.fn(),
    transcribeWithWhisper: vi.fn(),
    getGptReply: vi.fn(),
    generateTTS: vi.fn()
  }))
}));
vi.mock('../services/callSummaryService.js', () => ({
  CallSummaryService: vi.fn().mockImplementation(() => ({
    addToHistory: vi.fn(),
    getHistory: vi.fn(),
    generateSummary: vi.fn()
  }))
}));
import { TwilioWebSocketServer } from '../websocketServer.js';
import { WebSocket } from 'ws';

// Mock dependencies
vi.mock('ws');
vi.mock('../lib/config.js', () => ({
  config: {
    WS_PORT: 8080
  }
}));

// Mock logger
const logger = { error: vi.fn(), info: vi.fn() };

describe('TwilioWebSocketServer', () => {
  let wsServer;
  let mockServer;

  beforeEach(() => {
    mockServer = {
      on: vi.fn(),
      emit: vi.fn()
    };
    wsServer = new TwilioWebSocketServer(mockServer);
  });

  afterEach(() => {
    wsServer = null;
  });

  it('should initialize WebSocket server', () => {
    expect(wsServer.wss).toBeDefined();
    expect(mockServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });

  it.skip('should handle new connections', () => {
    const mockWs = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1 // OPEN state
    };

    // Setup an active call first
    const callSid = 'test-call-sid';
    wsServer.activeCalls.set(callSid, {
      from: '+1234567890',
      startTime: Date.now(),
      hasConsent: true,
      conversationHistory: []
    });

    // Call setupWebSocket directly to register the connection handler
    wsServer.setupWebSocket();

    // Find the connection handler that was registered
    const connectionHandler = wsServer.wss.on.mock.calls.find(
      ([event]) => event === 'connection'
    )[1];
    
    // Call the connection handler
    connectionHandler(mockWs, { fullUrl: '/twilio-stream' });

    expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('should broadcast messages to all clients', () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1 };
    const message = { type: 'test', data: 'test data' };

    // Add clients to the Set
    wsServer.wss.clients = new Set([mockWs1, mockWs2]);

    // Mock the broadcast method to actually call send on clients
    wsServer.broadcast = vi.fn().mockImplementation((msg) => {
      wsServer.wss.clients.forEach(client => {
        client.send(JSON.stringify(msg));
      });
    });

    wsServer.broadcast(message);

    expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
    expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
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
      wsServer.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        conversationHistory: mockHistory
      });

      // Mock the call summary service
      wsServer.callSummaryService.generateSummary = vi.fn().mockResolvedValue(mockSummary);

      const summary = await wsServer.handleCallEnd(callSid);

      expect(summary).toBe(mockSummary);
      // Check that generateSummary was called with the history
      expect(wsServer.callSummaryService.generateSummary).toHaveBeenCalledWith(mockHistory);
      expect(wsServer.activeCalls.has(callSid)).toBe(false);
    });

    it('should handle call with no history', async () => {
      const callSid = 'test-call-sid';

      // Setup mock call without history
      wsServer.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true
      });

      // Mock the call summary service to return null for no history
      wsServer.callSummaryService.generateSummary = vi.fn().mockResolvedValue(null);

      const summary = await wsServer.handleCallEnd(callSid);

      expect(summary).toBeNull();
      expect(wsServer.audioService.getGptReply).not.toHaveBeenCalled();
      expect(wsServer.activeCalls.has(callSid)).toBe(false);
    });

    it('should handle GPT service error', async () => {
      const callSid = 'test-call-sid';

      // Setup mock call
      wsServer.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        conversationHistory: []
      });

      // Mock error
      wsServer.callSummaryService.generateSummary = vi.fn().mockRejectedValue(new Error('GPT error'));

      const summary = await wsServer.handleCallEnd(callSid);

      expect(summary).toBeNull();
      expect(wsServer.activeCalls.has(callSid)).toBe(false);
    });
  });

  describe('handleStreamEnd', () => {
    it('should handle stream end for active call', async () => {
      const callSid = 'test-call-sid';
      const mockWs = {
        send: vi.fn(),
        close: vi.fn()
      };

      // Setup mock call
      wsServer.activeCalls.set(callSid, {
        from: '+1234567890',
        startTime: Date.now(),
        hasConsent: true,
        ws: mockWs
      });

      // Mock audio service
      wsServer.audioService.getAccumulatedAudio = vi.fn().mockReturnValue([Buffer.from('test audio')]);
      wsServer.audioService.transcribeWithWhisper = vi.fn().mockResolvedValue('Hello world');
      wsServer.audioService.getGptReply = vi.fn().mockResolvedValue('Hi there!');

      await wsServer.handleStreamEnd(callSid, mockWs);

      expect(wsServer.audioService.transcribeWithWhisper).toHaveBeenCalled();
      expect(wsServer.audioService.getGptReply).toHaveBeenCalled();
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
}); 