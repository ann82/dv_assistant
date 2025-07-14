import { getIntent, updateConversationContext, getConversationContext, clearConversationContext } from './lib/intentClassifier.js';
import logger from './lib/logger.js';

async function testIntentClassification() {
  const testCallSid = 'test-intent-classification-123';
  
  console.log('🧪 Testing Intent Classification for Housing Requests');
  console.log('====================================================');
  
  // Clear any existing context
  clearConversationContext(testCallSid);
  
  // Step 1: Test intent classification for "I'm looking for a house"
  console.log('\n1️⃣ Testing intent classification for "I\'m looking for a house"...');
  try {
    const intent = await getIntent("I'm looking for a house");
    console.log('Intent classification result:', { 
      query: "I'm looking for a house",
      intent: intent
    });
  } catch (error) {
    console.error('Error in intent classification:', error.message);
  }
  
  // Step 2: Test intent classification for "emergency housing"
  console.log('\n2️⃣ Testing intent classification for "emergency housing"...');
  try {
    const intent = await getIntent("emergency housing");
    console.log('Intent classification result:', { 
      query: "emergency housing",
      intent: intent
    });
  } catch (error) {
    console.error('Error in intent classification:', error.message);
  }
  
  // Step 3: Simulate the full conversation flow
  console.log('\n3️⃣ Simulating full conversation flow...');
  
  // First, user provides location
  console.log('User: "I live in Sacramento, California"');
  const locationIntent = await getIntent("I live in Sacramento, California");
  console.log('Intent:', locationIntent);
  
  // Update context with location
  updateConversationContext(testCallSid, locationIntent, "I live in Sacramento, California", {
    voiceResponse: "Thank you for sharing your location. What kind of help are you looking for?",
    smsResponse: "Location noted: Sacramento, California"
  });
  
  // Check context
  let context = getConversationContext(testCallSid);
  console.log('Context after location:', {
    hasLastQueryContext: !!context?.lastQueryContext,
    location: context?.lastQueryContext?.location,
    intent: context?.lastQueryContext?.intent
  });
  
  // Second, user asks for emergency housing
  console.log('\nUser: "emergency housing"');
  const housingIntent = await getIntent("emergency housing");
  console.log('Intent:', housingIntent);
  
  // Check if this should use saved location
  const locationSeekingIntents = ['find_shelter', 'legal_services', 'counseling_services', 'other_resources'];
  const isLocationSeekingIntent = locationSeekingIntents.includes(housingIntent);
  
  console.log('Is location-seeking intent:', isLocationSeekingIntent);
  console.log('Should use saved location:', isLocationSeekingIntent && context?.lastQueryContext?.location);
  
  if (isLocationSeekingIntent && context?.lastQueryContext?.location) {
    console.log('✅ Would use saved location:', context.lastQueryContext.location);
  } else {
    console.log('❌ Would NOT use saved location');
  }
  
  console.log('\n✅ Test completed');
}

// Run the test
testIntentClassification().catch(console.error); 