import { vi } from 'vitest';

// Mock environment variables
process.env.TWILIO_PHONE_NUMBER = '+1234567890';

// Mock WebSocket
vi.mock('ws', () => {
  const WebSocket = vi.fn();
  WebSocket.OPEN = 1;
  WebSocket.CLOSED = 3;
  
  const WebSocketServer = vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    handleUpgrade: vi.fn(),
    clients: new Set()
  }));

  return {
    WebSocket,
    WebSocketServer
  };
}); 