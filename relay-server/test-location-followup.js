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

// Test the location follow-up detection using geocoding
async function testLocationFollowUp() {
  console.log('Testing location follow-up detection with geocoding...\n');

  // Create a mock conversation context with a previous shelter request
  const callSid = 'test-call-sid';
  const mockContext = {
    intent: 'find_shelter',
    location: null,
    results: [
      {
        title: 'Austin Domestic Violence Shelter',
        content: 'Provides shelter and support services in Austin, Texas.',
        url: 'https://example.com/austin-shelter'
      }
    ],
    timestamp: Date.now(),
    needsLocation: true
  };

  // Update conversation context
  updateConversationContext(callSid, 'find_shelter', 'I need a shelter', {
    voiceResponse: 'I can help you find a shelter. What city or area are you looking for?',
    smsResponse: null
  }, { results: mockContext.results });

  // Get the context
  const context = getConversationContext(callSid);
  console.log('Created context:', {
    hasLastQueryContext: !!context?.lastQueryContext,
    lastIntent: context?.lastIntent,
    needsLocation: context?.lastQueryContext?.needsLocation
  });

  // Test the specific case that was failing
  const locationStatement = "Near Austin, Texas.";
  console.log(`\nTesting location statement: "${locationStatement}"`);
  
  const followUpResponse = await handleFollowUp(locationStatement, context.lastQueryContext);
  
  if (followUpResponse) {
    console.log('✅ Location follow-up detected!');
    console.log('Response type:', followUpResponse.type);
    console.log('Voice response:', followUpResponse.voiceResponse);
    console.log('Location extracted:', followUpResponse.location);
  } else {
    console.log('❌ Location follow-up NOT detected');
  }

  // Test a few other location formats
  const testCases = [
    "Austin, Texas",
    "I live in Austin, Texas",
    "Austin",
    "Near Austin"
  ];

  console.log('\nTesting various location formats:');
  for (const testCase of testCases) {
    console.log(`\nTesting: "${testCase}"`);
    const response = await handleFollowUp(testCase, context.lastQueryContext);
    if (response) {
      console.log('✅ Detected as follow-up');
      console.log('Type:', response.type);
      console.log('Location:', response.location);
    } else {
      console.log('❌ NOT detected as follow-up');
    }
  }

  // Test non-location statement
  const nonLocationStatement = "Tell me more about that shelter";
  console.log(`\nTesting non-location statement: "${nonLocationStatement}"`);
  
  const nonLocationResponse = await handleFollowUp(nonLocationStatement, context.lastQueryContext);
  
  if (nonLocationResponse) {
    console.log('✅ Non-location follow-up detected!');
    console.log('Response type:', nonLocationResponse.type);
    console.log('Voice response:', nonLocationResponse.voiceResponse);
  } else {
    console.log('❌ Non-location follow-up NOT detected');
  }
}

testLocationFollowUp().catch(console.error);

console.log('\n🎉 Location follow-up detection test completed!'); 