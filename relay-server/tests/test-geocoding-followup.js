import { updateConversationContext, getConversationContext, handleFollowUp } from './lib/intentClassifier.js';

async function testGeocodingFollowUp() {
  console.log('Testing geocoding-based location follow-up detection...\n');

  // Create a mock conversation context with a previous shelter request
  const callSid = 'test-call-sid';
  
  // Update conversation context with a shelter request that needs location
  updateConversationContext(callSid, 'find_shelter', 'I need a shelter', {
    voiceResponse: 'I can help you find a shelter. What city or area are you looking for?',
    smsResponse: null
  }, { 
    results: [
      {
        title: 'Test Shelter',
        content: 'Test shelter content',
        url: 'https://example.com'
      }
    ] 
  });

  // Get the context
  const context = getConversationContext(callSid);
  console.log('Created context:', {
    hasLastQueryContext: !!context?.lastQueryContext,
    lastIntent: context?.lastIntent,
    needsLocation: context?.lastQueryContext?.needsLocation
  });

  // Test the specific case that was failing
  const locationStatement = "Near Austin, Texas.";
  console.log(`\nTesting: "${locationStatement}"`);
  
  const followUpResponse = await handleFollowUp(locationStatement, context.lastQueryContext);
  
  if (followUpResponse) {
    console.log('✅ SUCCESS: Location follow-up detected!');
    console.log('Response type:', followUpResponse.type);
    console.log('Location:', followUpResponse.location);
    console.log('Voice response preview:', followUpResponse.voiceResponse?.substring(0, 100) + '...');
  } else {
    console.log('❌ FAILED: Location follow-up NOT detected');
  }

  console.log('\n🎉 Test completed!');
}

testGeocodingFollowUp().catch(console.error); 