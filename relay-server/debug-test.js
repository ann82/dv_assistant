import { ResponseGenerator } from './lib/response.js';

console.log('=== Debug Test for formatTavilyResponse ===\n');

// Test case 1: Empty results but useful answer field (failing test)
console.log('Test 1: Empty results but useful answer field');
const tavilyResponse1 = {
  query: "domestic violence shelter Hey, can you find shelters near San Jose?",
  answer: "In San Jose, the Women's Crisis Shelter provides support for domestic violence victims. They operate on a nonprofit basis. Contact them at 408-280-8800 for assistance.",
  results: [],
  response_time: 13.49
};

try {
  const formatted1 = ResponseGenerator.formatTavilyResponse(tavilyResponse1, 'twilio', 'find shelters in San Jose');
  console.log('Result 1:', JSON.stringify(formatted1, null, 2));
  console.log('voiceResponse defined:', !!formatted1.voiceResponse);
  console.log('voiceResponse value:', formatted1.voiceResponse);
} catch (error) {
  console.error('Error in test 1:', error);
}

console.log('\n---\n');

// Test case 2: Empty results and empty answer field (failing test)
console.log('Test 2: Empty results and empty answer field');
const tavilyResponse2 = {
  query: "domestic violence shelter in unknown location",
  answer: "",
  results: [],
  response_time: 5.2
};

try {
  const formatted2 = ResponseGenerator.formatTavilyResponse(tavilyResponse2, 'twilio', 'find shelters in unknown location');
  console.log('Result 2:', JSON.stringify(formatted2, null, 2));
  console.log('voiceResponse defined:', !!formatted2.voiceResponse);
  console.log('voiceResponse value:', formatted2.voiceResponse);
} catch (error) {
  console.error('Error in test 2:', error);
}

console.log('\n=== End Debug Test ==='); 