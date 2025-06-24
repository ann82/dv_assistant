import { manageConversationFlow, shouldAttemptReengagement, generateReengagementMessage } from './lib/intentClassifier.js';

// Test conversation flow management
console.log('Testing Conversation Flow Management...\n');

// Test 1: Off-topic with conversation end
console.log('Test 1: Off-topic with conversation end');
const flow1 = manageConversationFlow('off_topic', 'goodbye, I need to go', {});
console.log('Result:', flow1);
console.log('Expected: shouldEndCall: true, shouldContinue: false\n');

// Test 2: Off-topic with re-engagement
console.log('Test 2: Off-topic with re-engagement');
const flow2 = manageConversationFlow('off_topic', 'I need help with domestic violence', {});
console.log('Result:', flow2);
console.log('Expected: shouldReengage: true\n');

// Test 3: Emergency intent
console.log('Test 3: Emergency intent');
const flow3 = manageConversationFlow('emergency_help', 'I need help now', {});
console.log('Result:', flow3);
console.log('Expected: priority: high, shouldContinue: true\n');

// Test 4: End conversation intent
console.log('Test 4: End conversation intent');
const flow4 = manageConversationFlow('end_conversation', 'end the call', {});
console.log('Result:', flow4);
console.log('Expected: shouldEndCall: true, shouldContinue: false\n');

// Test re-engagement logic
console.log('Testing Re-engagement Logic...\n');

const contextWithOffTopic = {
  history: [
    { intent: 'off_topic', query: 'what\'s the weather', timestamp: new Date().toISOString() },
    { intent: 'off_topic', query: 'tell me a joke', timestamp: new Date().toISOString() }
  ]
};

console.log('Test 5: Should attempt re-engagement');
const shouldReengage = shouldAttemptReengagement(contextWithOffTopic);
console.log('Result:', shouldReengage);
console.log('Expected: true\n');

// Test re-engagement message generation
console.log('Test 6: Re-engagement message generation');
const message = generateReengagementMessage(contextWithOffTopic);
console.log('Message:', message);
console.log('Expected: A helpful re-engagement message\n');

console.log('All tests completed!'); 