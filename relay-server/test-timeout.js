#!/usr/bin/env node

import fetch from 'node-fetch';
import logger from './lib/logger.js';

const BASE_URL = process.env.TEST_URL || 'https://dvvoiceagent-production.up.railway.app';

async function testEndpoint(endpoint, timeout = 30000, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  
  logger.info(`Testing endpoint: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'test-signature'
      },
      signal: controller.signal
    };
    
    if (body) {
      options.body = new URLSearchParams(body);
    }
    
    const response = await fetch(url, options);
    
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
  
  // Test Twilio voice process endpoint with realistic speech input
  logger.info('\n=== Testing Twilio Voice Process Endpoint ===');
  const processResult = await testEndpoint('/twilio/voice/process', 60000, {
    CallSid: 'test-call-sid-' + Date.now(),
    SpeechResult: 'I need help finding a domestic violence shelter in Oakland California',
    From: '+1234567890',
    To: '+0987654321'
  });
  
  // Test with a longer speech input that might trigger TTS
  logger.info('\n=== Testing Twilio Voice Process Endpoint (Long Input) ===');
  const longProcessResult = await testEndpoint('/twilio/voice/process', 60000, {
    CallSid: 'test-call-sid-long-' + Date.now(),
    SpeechResult: 'I am in an emergency situation and need to find a safe place to stay tonight. I have children with me and we need immediate assistance. Can you help me find a domestic violence shelter in the San Francisco Bay Area that can accommodate us?',
    From: '+1234567890',
    To: '+0987654321'
  });
  
  // Summary
  logger.info('\n=== Test Summary ===');
  logger.info(`Health endpoint: ${voiceResult.success ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Voice endpoint: ${voiceResult.success ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Process endpoint: ${processResult.success ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Process endpoint (long): ${longProcessResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!processResult.success || !longProcessResult.success) {
    logger.error('🔍 The process endpoint is experiencing issues. Check Railway logs for more details.');
    logger.info('💡 Possible solutions:');
    logger.info('   1. Check Railway service logs');
    logger.info('   2. Verify environment variables are set');
    logger.info('   3. Check if Tavily API is responding');
    logger.info('   4. Monitor memory usage');
    logger.info('   5. Check TTS generation timeout');
  }
}

// Run the tests
runTests().catch(error => {
  logger.error('Test runner failed:', error);
  process.exit(1);
}); 