import { updateConversationContext, getConversationContext, handleFollowUp, isResourceQuery } from './lib/intentClassifier.js';

console.log('🧪 Testing Location Follow-up Detection...\n');

// Test 1: Set up a resource request without location
console.log('1. Setting up resource request without location...');
const testCallSid = 'test-call-sid-123';

// Simulate a user asking for shelter without specifying location
updateConversationContext(
  testCallSid,
  'find_shelter',
  'I need shelter',
  {
    voiceResponse: 'I can help you find shelter. Could you please tell me which city or area you\'re looking for?',
    smsResponse: null
  },
  null // No Tavily results yet
);

const context = getConversationContext(testCallSid);
console.log('Context after resource request:', {
  hasLastQueryContext: !!context.lastQueryContext,
  intent: context.lastQueryContext?.intent,
  needsLocation: context.lastQueryContext?.needsLocation,
  hasResults: context.lastQueryContext?.results?.length > 0
});

// Test 2: Test location follow-up detection
console.log('\n2. Testing location follow-up detection...');
const locationStatements = [
  'I live in Santa Clara.',
  'I am in San Francisco.',
  'My location is Oakland.',
  'I\'m from San Jose.',
  'I stay in Fremont.'
];

for (const locationStatement of locationStatements) {
  console.log(`\nTesting: "${locationStatement}"`);
  
  const followUpResponse = await handleFollowUp(locationStatement, context.lastQueryContext);
  
  if (followUpResponse) {
    console.log('✅ Detected as follow-up!');
    console.log('Type:', followUpResponse.type);
    console.log('Voice Response:', followUpResponse.voiceResponse?.substring(0, 100) + '...');
  } else {
    console.log('❌ Not detected as follow-up');
  }
}

// Test 3: Test non-location statements (should not be detected as follow-ups)
console.log('\n3. Testing non-location statements...');
const nonLocationStatements = [
  'What\'s the weather like?',
  'Tell me a joke.',
  'How are you today?',
  'What time is it?'
];

for (const nonLocationStatement of nonLocationStatements) {
  console.log(`\nTesting: "${nonLocationStatement}"`);
  
  const followUpResponse = await handleFollowUp(nonLocationStatement, context.lastQueryContext);
  
  if (followUpResponse) {
    console.log('❌ Incorrectly detected as follow-up!');
    console.log('Type:', followUpResponse.type);
  } else {
    console.log('✅ Correctly not detected as follow-up');
  }
}

console.log('\n🎉 Location follow-up detection test completed!'); 