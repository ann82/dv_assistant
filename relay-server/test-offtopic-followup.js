import { generateFollowUpResponse } from './lib/intentClassifier.js';

async function testOffTopicFollowUp() {
  const offTopicContext = {
    intent: 'off_topic',
    results: [],
    location: null,
    query: 'Can you give me a song about Taylor Swift?',
    timestamp: Date.now()
  };

  const userQuery = 'Can you give me a song about Taylor Swift?';
  const response = await generateFollowUpResponse(userQuery, offTopicContext);
  console.log('Off-topic follow-up response:');
  console.log('Type:', response.type);
  console.log('Intent:', response.intent);
  console.log('Voice Response:', response.voiceResponse);
}

testOffTopicFollowUp(); 