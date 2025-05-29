import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from '../src/services/websocketServer.js';

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