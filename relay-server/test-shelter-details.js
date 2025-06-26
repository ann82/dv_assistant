import { ResponseGenerator } from './lib/response.js';

console.log('=== TESTING SHELTER DETAILS IN VOICE RESPONSE ===\n');

// Test 1: Single shelter with address and phone
console.log('Test 1: Single shelter with address and phone');
const singleShelterResult = [
  {
    processedTitle: 'Safe Haven Domestic Violence Shelter',
    physicalAddress: '123 Main Street, San Jose, CA 95123',
    content: 'Emergency shelter for domestic violence victims. Phone: 408-279-2962',
    url: 'https://example.org/shelter',
    score: 0.9
  }
];

const singleVoiceResponse = ResponseGenerator.createVoiceResponse(singleShelterResult, 'San Jose');
console.log('Voice Response:', singleVoiceResponse);
console.log('Expected: Should include shelter name, address, and phone number\n');

// Test 2: Single shelter without address or phone
console.log('Test 2: Single shelter without address or phone');
const singleShelterNoDetails = [
  {
    processedTitle: 'Crisis Center',
    physicalAddress: 'Not available',
    content: 'Emergency shelter for domestic violence victims.',
    url: 'https://example.org/crisis',
    score: 0.8
  }
];

const singleNoDetailsResponse = ResponseGenerator.createVoiceResponse(singleShelterNoDetails, 'San Francisco');
console.log('Voice Response:', singleNoDetailsResponse);
console.log('Expected: Should include only shelter name\n');

// Test 3: Multiple shelters
console.log('Test 3: Multiple shelters');
const multipleShelters = [
  {
    processedTitle: 'Women\'s Crisis Shelter',
    physicalAddress: '456 Oak Avenue, San Jose, CA 95124',
    content: 'Emergency shelter for women and children. Phone: 408-280-8800',
    url: 'https://example.org/womens',
    score: 0.9
  },
  {
    processedTitle: 'Family Justice Center',
    physicalAddress: '789 Pine Street, San Jose, CA 95125',
    content: 'Comprehensive services for families. Phone: 408-281-9900',
    url: 'https://example.org/family',
    score: 0.85
  },
  {
    processedTitle: 'Safe House Program',
    physicalAddress: '321 Elm Street, San Jose, CA 95126',
    content: 'Confidential shelter program. Phone: 408-282-1100',
    url: 'https://example.org/safehouse',
    score: 0.8
  }
];

const multipleVoiceResponse = ResponseGenerator.createVoiceResponse(multipleShelters, 'San Jose');
console.log('Voice Response:', multipleVoiceResponse);
console.log('Expected: Should list all shelters and include details for the first one\n');

// Test 4: SMS response with phone numbers
console.log('Test 4: SMS response with phone numbers');
const smsResponse = ResponseGenerator.createSMSResponse(multipleShelters, 'San Jose');
console.log('SMS Response:');
console.log(smsResponse);
console.log('Expected: Should include phone numbers for all shelters\n');

// Test 5: No results
console.log('Test 5: No results');
const noResultsResponse = ResponseGenerator.createVoiceResponse([], 'Unknown Location');
console.log('Voice Response:', noResultsResponse);
console.log('Expected: Should handle no results gracefully\n');

console.log('=== TEST COMPLETED ==='); 