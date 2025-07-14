import { updateConversationContext, getConversationContext, clearConversationContext } from './lib/intentClassifier.js';
import logger from './lib/logger.js';

async function testLocationContextSaving() {
  const testCallSid = 'test-context-location-123';
  
  console.log('🧪 Testing Location Context Saving and Retrieval');
  console.log('================================================');
  
  // Clear any existing context
  clearConversationContext(testCallSid);
  
  // Step 1: Simulate user mentioning location in an "off_topic" intent
  console.log('\n1️⃣ Simulating user mentioning location in off_topic intent...');
  const offTopicResponse = {
    voiceResponse: "I understand you live in Oakland, California. That's important information for finding local resources.",
    smsResponse: "Location noted: Oakland, California"
  };
  
  updateConversationContext(testCallSid, 'off_topic', 'I live in Oakland, California', offTopicResponse);
  
  // Check context after first update
  let context = getConversationContext(testCallSid);
  console.log('Context after off_topic with location:', {
    hasLastQueryContext: !!context?.lastQueryContext,
    location: context?.lastQueryContext?.location,
    intent: context?.lastQueryContext?.intent,
    needsLocation: context?.lastQueryContext?.needsLocation
  });
  
  // Step 2: Simulate user asking for counseling centers nearby
  console.log('\n2️⃣ Simulating user asking for counseling centers nearby...');
  const counselingResponse = {
    voiceResponse: "I'll help you find counseling centers in Oakland, California.",
    smsResponse: "Searching for counseling centers in Oakland"
  };
  
  updateConversationContext(testCallSid, 'counseling_services', 'Yeah, can you tell me if there are any counseling centers nearby?', counselingResponse);
  
  // Check context after second update
  context = getConversationContext(testCallSid);
  console.log('Context after counseling_services with nearby:', {
    hasLastQueryContext: !!context?.lastQueryContext,
    location: context?.lastQueryContext?.location,
    intent: context?.lastQueryContext?.intent,
    needsLocation: context?.lastQueryContext?.needsLocation
  });
  
  // Step 3: Test location extraction logic
  console.log('\n3️⃣ Testing location extraction logic...');
  
  // Simulate the location extraction logic from processSpeechResult
  const locationSeekingIntents = ['find_shelter', 'legal_services', 'counseling_services', 'other_resources'];
  const intent = 'counseling_services';
  const isLocationSeekingIntent = locationSeekingIntents.includes(intent);
  
  if (isLocationSeekingIntent) {
    // Simulate extractLocation returning null for "nearby"
    const location = null; // This is what extractLocation would return for "nearby"
    
    console.log('Location extracted from current speech:', location);
    
    // Check if we should use saved location from context
    if (!location && context?.lastQueryContext?.location) {
      const savedLocation = context.lastQueryContext.location;
      console.log('✅ Using saved location from conversation context:', savedLocation);
    } else {
      console.log('❌ No saved location found in context');
    }
  }
  
  console.log('\n✅ Test completed');
}

// Run the test
testLocationContextSaving().catch(console.error); 