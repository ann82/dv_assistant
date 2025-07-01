#!/usr/bin/env node

import fetch from 'node-fetch';
import logger from './lib/logger.js';

const BASE_URL = process.env.TEST_URL || 'https://dvvoiceagent-production.up.railway.app';

async function testEndpoint(endpoint, timeout = 30000) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  
  logger.info(`Testing endpoint: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'test-signature'
      },
      body: new URLSearchParams({
        CallSid: 'test-call-sid',
        SpeechResult: 'test speech input',
        From: '+1234567890',
        To: '+0987654321'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    logger.info(`✅ ${endpoint} - Status: ${response.status}, Duration: ${duration}ms`);
    
    if (response.ok) {
      const text = await response.text();
      logger.info(`Response preview: ${text.substring(0, 200)}...`);
    }
    
    return { success: true, status: response.status, duration };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      logger.error(`❌ ${endpoint} - TIMEOUT after ${duration}ms`);
      return { success: false, error: 'timeout', duration };
    } else {
      logger.error(`❌ ${endpoint} - Error: ${error.message}, Duration: ${duration}ms`);
      return { success: false, error: error.message, duration };
    }
  }
}

async function runTests() {
  logger.info('🚀 Starting timeout diagnostic tests...');
  logger.info(`📍 Testing against: ${BASE_URL}`);
  
  // Test health endpoint first
  logger.info('\n=== Testing Health Endpoint ===');
  await testEndpoint('/health', 10000);
  
  // Test root endpoint
  logger.info('\n=== Testing Root Endpoint ===');
  await testEndpoint('/', 10000);
  
  // Test Twilio voice endpoint
  logger.info('\n=== Testing Twilio Voice Endpoint ===');
  const voiceResult = await testEndpoint('/twilio/voice', 60000);
  
  // Test Twilio voice process endpoint
  logger.info('\n=== Testing Twilio Voice Process Endpoint ===');
  const processResult = await testEndpoint('/twilio/voice/process', 90000);
  
  // Summary
  logger.info('\n=== Test Summary ===');
  logger.info(`Health endpoint: ${voiceResult.success ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Voice endpoint: ${voiceResult.success ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Process endpoint: ${processResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!processResult.success) {
    logger.error('🔍 The process endpoint is experiencing issues. Check Railway logs for more details.');
    logger.info('💡 Possible solutions:');
    logger.info('   1. Check Railway service logs');
    logger.info('   2. Verify environment variables are set');
    logger.info('   3. Check if Tavily API is responding');
    logger.info('   4. Monitor memory usage');
  }
}

// Run the tests
runTests().catch(error => {
  logger.error('Test runner failed:', error);
  process.exit(1);
}); 