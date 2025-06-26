import { extractLocationFromQuery } from './lib/enhancedLocationDetector.js';
import { updateConversationContext, getConversationContext } from './lib/intentClassifier.js';

async function testLocationIssue() {
  console.log('=== Testing Location Issue ===\n');
  
  // Test 1: Extract location from the user's query
  const userQuery = "Can you give me shelter homes near Sunnyvale?";
  console.log('1. User Query:', userQuery);
  
  const locationInfo = extractLocationFromQuery(userQuery);
  console.log('   Extracted Location:', locationInfo);
  
  // Test 2: Simulate conversation context update
  const callSid = 'test-call-sid';
  const mockResponse = {
    voiceResponse: "To find the closest resources to you, I need to know your location. Please tell me your city or area, such as Redwood City or Sunnyvale.",
    smsResponse: "To find the closest resources to you, I need to know your location. Please tell me your city or area, such as Redwood City or Sunnyvale."
  };
  
  console.log('\n2. Updating conversation context...');
  updateConversationContext(callSid, 'find_shelter', userQuery, mockResponse, null);
  
  // Test 3: Check conversation context
  const context = getConversationContext(callSid);
  console.log('   Context after update:', {
    lastIntent: context?.lastIntent,
    lastQuery: context?.lastQuery,
    hasLastQueryContext: !!context?.lastQueryContext,
    lastQueryContextLocation: context?.lastQueryContext?.location,
    needsLocation: context?.lastQueryContext?.needsLocation
  });
  
  // Test 4: Test with a new location follow-up
  const followUpQuery = "I live in Santa Clara";
  console.log('\n3. Follow-up Query:', followUpQuery);
  
  const followUpLocationInfo = extractLocationFromQuery(followUpQuery);
  console.log('   Extracted Follow-up Location:', followUpLocationInfo);
  
  // Test 5: Check if the system would still ask for location
  const updatedContext = getConversationContext(callSid);
  console.log('\n4. Updated Context Check:');
  console.log('   Has previous context:', !!updatedContext?.lastQueryContext);
  console.log('   Previous location:', updatedContext?.lastQueryContext?.location);
  console.log('   Needs location flag:', updatedContext?.lastQueryContext?.needsLocation);
  
  // Test 6: Simulate what the system should do
  if (followUpLocationInfo.location) {
    console.log('\n5. ✅ System should use new location:', followUpLocationInfo.location);
    console.log('   Should NOT ask for location again');
  } else {
    console.log('\n5. ❌ System would ask for location again');
  }
}

testLocationIssue().catch(console.error); 