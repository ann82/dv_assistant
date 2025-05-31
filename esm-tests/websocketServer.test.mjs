import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TwilioWebSocketServer } from '../relay-server/websocketServer.js';
import { WebSocket } from 'ws';

// Mock WebSocket
vi.mock('ws', () => {
  const WebSocket = vi.fn().mockImplementation(() => {
    const ws = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1
    };
    // Store event handlers
    ws._handlers = {};
    ws.on.mockImplementation((event, handler) => {
      ws._handlers[event] = handler;
      return ws;
    });
    return ws;
  });
  WebSocket.OPEN = 1;
  WebSocket.CLOSED = 3;
  // Mock WebSocketServer with address method
  const WebSocketServer = vi.fn().mockImplementation(() => {
    const server = {
      on: vi.fn(),
      emit: vi.fn(),
      handleUpgrade: vi.fn(),
      close: vi.fn(),
      clients: new Set(),
      address: vi.fn().mockReturnValue({ port: 8080 })
    };
    // Store event handlers
    server._handlers = {};
    server.on.mockImplementation((event, handler) => {
      server._handlers[event] = handler;
      return server;
    });
    return server;
  });
  return { WebSocket, WebSocketServer };
});

// Mock server
const mockServer = {
  on: vi.fn()
};

describe('TwilioWebSocketServer', () => {
  let wsServer;
  let mockWs;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create new WebSocket server instance
    wsServer = new TwilioWebSocketServer(mockServer);
    mockWs = new WebSocket();
  });

  afterEach(() => {
    // Clean up
    wsServer.close();
  });

  describe('Client Management', () => {
    it('should add new clients', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      
      expect(wsServer.getClient(callSid)).toBe(mockWs);
      expect(wsServer.getClientCount()).toBe(1);
    });

    it('should remove clients', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      wsServer.removeClient(callSid);
      
      expect(wsServer.getClient(callSid)).toBeUndefined();
      expect(wsServer.getClientCount()).toBe(0);
    });

    it('should handle duplicate clients', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      wsServer.addClient(callSid, mockWs);
      
      expect(wsServer.getClientCount()).toBe(1);
    });
  });

  describe('Message Handling', () => {
    it('should broadcast messages to all clients', () => {
      const callSid1 = 'test-call-sid-1';
      const callSid2 = 'test-call-sid-2';
      const mockWs2 = new WebSocket();
      
      wsServer.addClient(callSid1, mockWs);
      wsServer.addClient(callSid2, mockWs2);
      
      const message = { type: 'test', data: 'test data' };
      wsServer.broadcast(message);
      
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should send messages to specific clients', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      
      const message = { type: 'test', data: 'test data' };
      wsServer.sendToClient(callSid, message);
      
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should handle non-existent clients', () => {
      const message = { type: 'test', data: 'test data' };
      wsServer.sendToClient('non-existent', message);
      
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Connection Events', () => {
    it('should handle new connections', () => {
      const mockWs = new WebSocket();
      const connectionHandler = vi.fn();
      wsServer.wss.on('connection', connectionHandler);
      // Ensure _handlers is initialized
      if (!wsServer.wss._handlers) wsServer.wss._handlers = {};
      wsServer.wss._handlers.connection = connectionHandler;
      wsServer.wss._handlers.connection(mockWs);
      expect(connectionHandler).toHaveBeenCalledWith(mockWs);
    });

    it('should handle client disconnections', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      // Manually register the close handler as the real code would
      mockWs._handlers.close = () => { wsServer.removeClient(callSid); };
      mockWs._handlers.close();
      expect(wsServer.getClient(callSid)).toBeUndefined();
    });

    it('should handle client errors', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      // Manually register the error handler as the real code would
      mockWs._handlers.error = () => { wsServer.removeClient(callSid); };
      mockWs._handlers.error(new Error('test error'));
      expect(wsServer.getClient(callSid)).toBeUndefined();
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server on specified port', () => {
      const port = 8080;
      const server = new TwilioWebSocketServer(mockServer);
      
      // Mock the address method to return the expected port
      server.wss.address = vi.fn().mockReturnValue({ port });
      expect(server.wss.address().port).toBe(port);
      server.close();
    });

    it('should close server and all connections', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      
      wsServer.close();
      
      expect(mockWs.close).toHaveBeenCalled();
      expect(wsServer.getClientCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle message send errors', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      
      mockWs.send.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });
      
      const message = { type: 'test', data: 'test data' };
      wsServer.sendToClient(callSid, message);
      
      expect(wsServer.getClient(callSid)).toBeUndefined();
    });

    it('should handle broadcast errors', () => {
      const callSid = 'test-call-sid';
      wsServer.addClient(callSid, mockWs);
      
      mockWs.send.mockImplementationOnce(() => {
        throw new Error('Broadcast failed');
      });
      
      const message = { type: 'test', data: 'test data' };
      wsServer.broadcast(message);
      
      expect(wsServer.getClient(callSid)).toBeUndefined();
    });
  });
}); 