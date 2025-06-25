import WebSocket from 'ws';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing WebSocket functionality...\n');

// Start the server in the background
console.log('1. Starting server...');
const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;
let serverOutput = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log('Server:', output.trim());
  
  // Check if server is ready
  if (output.includes('Server running on port') || output.includes('DEBUG: typeof server:')) {
    serverReady = true;
    console.log('\n✅ Server appears to be running');
  }
});

serverProcess.stderr.on('data', (data) => {
  const error = data.toString();
  console.log('Server Error:', error.trim());
  
  // Check for the specific WebSocket error
  if (error.includes('server.on is not a function')) {
    console.log('\n❌ WebSocket server error detected!');
    serverProcess.kill();
    process.exit(1);
  }
});

// Wait for server to start
setTimeout(async () => {
  if (!serverReady) {
    console.log('\n❌ Server did not start properly');
    serverProcess.kill();
    process.exit(1);
  }

  console.log('\n2. Testing WebSocket connection...');
  
  try {
    // Try to connect to the WebSocket endpoint
    const ws = new WebSocket('ws://localhost:3000/twilio-stream');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connection established successfully!');
      ws.close();
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket connection failed:', error.message);
    });
    
    ws.on('close', () => {
      console.log('✅ WebSocket connection closed properly');
      console.log('\n🎉 WebSocket functionality test completed successfully!');
      serverProcess.kill();
      process.exit(0);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      console.log('❌ WebSocket connection timeout');
      serverProcess.kill();
      process.exit(1);
    }, 5000);
    
  } catch (error) {
    console.log('❌ Failed to create WebSocket connection:', error.message);
    serverProcess.kill();
    process.exit(1);
  }
}, 3000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  serverProcess.kill();
  process.exit(0);
}); 