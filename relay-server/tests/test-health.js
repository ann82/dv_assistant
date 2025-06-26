#!/usr/bin/env node

import http from 'http';

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

console.log('🧪 Testing health check endpoint...');

const options = {
  hostname: HOST,
  port: PORT,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`📊 Health check status: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const healthData = JSON.parse(data);
      console.log('✅ Health check response:', healthData);
      
      if (healthData.status === 'ok') {
        console.log('🎉 Health check passed!');
        process.exit(0);
      } else {
        console.log('❌ Health check failed - status not ok');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to parse health check response:', error);
      console.log('📄 Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Health check request failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('⏰ Health check request timed out');
  req.destroy();
  process.exit(1);
});

req.end(); 