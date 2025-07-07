import { vi, beforeEach, afterAll } from 'vitest';

// Mock environment variables
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.OPENAI_API_KEY = 'test-key';

if (!process.env.TAVILY_API_KEY) {
  process.env.TAVILY_API_KEY = 'test-key';
}

// Mock WebSocket
vi.mock('ws', () => {
  const WebSocket = vi.fn();
  WebSocket.OPEN = 1;
  WebSocket.CLOSED = 3;
  
  const WebSocketServer = vi.fn().mockImplementation(() => {
    const server = {
      on: vi.fn(),
      emit: vi.fn(),
      handleUpgrade: vi.fn(),
      close: vi.fn(),
      clients: new Set(),
      address: vi.fn().mockReturnValue({ port: 8080 })
    };
    server._handlers = {};
    server.on.mockImplementation((event, handler) => {
      server._handlers[event] = handler;
      return server;
    });
    return server;
  });

  return {
    WebSocket,
    WebSocketServer
  };
});

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.resetAllMocks();
}); 