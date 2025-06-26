import { ResponseGenerator } from './lib/response.js';

// Simple test for shelter details
const testResult = [
  {
    processedTitle: 'Safe Haven Shelter',
    physicalAddress: '123 Main Street, San Jose, CA',
    content: 'Emergency shelter. Phone: 408-279-2962',
    url: 'https://example.org',
    score: 0.9
  }
];

const voiceResponse = ResponseGenerator.createVoiceResponse(testResult, 'San Jose');
console.log('Voice Response:', voiceResponse);

const smsResponse = ResponseGenerator.createSMSResponse(testResult, 'San Jose');
console.log('\nSMS Response:');
console.log(smsResponse); 