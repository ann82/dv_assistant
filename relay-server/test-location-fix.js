import { extractLocationFromQuery } from './lib/enhancedLocationDetector.js';

// Test the specific case mentioned by the user
const testQuery = "I'm I'm not in any danger, I just am the bad situation and I want to be able to get out of it. Can you help me find shelter homes?";

console.log('Testing location extraction fix...');
console.log('Query:', testQuery);
console.log('---');

const result = extractLocationFromQuery(testQuery);
console.log('Result:', result);

if (result.location === null) {
  console.log('✅ SUCCESS: No location extracted (correct behavior)');
} else {
  console.log('❌ FAILURE: Location extracted:', result.location);
}

console.log('---');

// Test a few more cases to make sure we don't break existing functionality
const testCases = [
  "I need shelter in Austin, Texas",
  "Can you find shelters near me?",
  "Help me find resources in San Francisco",
  "I want to get out of this situation. Can you help me find shelter homes?",
  "Do you have any shelters in New York?",
  "Can you help me find shelter homes?"
];

console.log('Testing additional cases:');
testCases.forEach((query, index) => {
  const result = extractLocationFromQuery(query);
  console.log(`${index + 1}. "${query}" -> ${result.location || 'null'} (scope: ${result.scope})`);
}); 