import { WebSocketServer as WSServer, WebSocket } from 'ws';

export class WebSocketServer {
  constructor(server) {
    this.wss = new WSServer({ noServer: true });
    
    server.on('upgrade', (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        // Handle incoming messages
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        // Handle client disconnection
        console.log('Client disconnected');
      });
    });
  }

  handleMessage(ws, data) {
    // Implement message handling logic
    console.log('Received message:', data);
  }

  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
} 