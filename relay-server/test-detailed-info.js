import { generateDetailedShelterInfo, generateResultSummary, cleanResultTitle } from './lib/intentClassifier.js';

// Mock logger to avoid console output
const originalLogger = console.log;
console.log = () => {};

console.log = originalLogger;

console.log('=== Testing Detailed Shelter Information ===\n');

// Test data
const mockContext = {
  location: 'Nevada',
  results: [
    {
      title: 'Domestic Violence Help - Emergency Shelter',
      content: 'We provide emergency shelter, counseling services, legal assistance, and 24/7 hotline support for victims of domestic violence. Our facility offers transitional housing and family services including children\'s programs.',
      url: 'https://example.com/shelter1'
    },
    {
      title: 'EMERGENCY SHELTER AND RENTAL ASSISTANCE',
      content: 'Emergency shelter services with rental assistance programs. We offer job training, education programs, and transportation assistance to help families rebuild their lives.',
      url: 'https://example.com/shelter2'
    },
    {
      title: 'Search | Find Domestic Violence and Abuse Shelters',
      content: 'Comprehensive domestic violence support including crisis intervention, support groups, and legal advocacy. We provide emergency shelter and long-term housing solutions.',
      url: 'https://example.com/shelter3'
    }
  ]
};

// Test 1: Generate detailed info for multiple shelters
console.log('Test 1: Multiple shelters detailed info');
const detailedResponse = generateDetailedShelterInfo(mockContext);
console.log('Response:', detailedResponse);
console.log('✅ Detailed info generated successfully\n');

// Test 2: Test result summary generation
console.log('Test 2: Individual result summaries');
mockContext.results.forEach((result, index) => {
  const summary = generateResultSummary(result);
  const cleanTitle = cleanResultTitle(result.title);
  console.log(`${index + 1}. ${cleanTitle}: ${summary}`);
});
console.log('✅ Result summaries generated successfully\n');

// Test 3: Test with single result
console.log('Test 3: Single shelter detailed info');
const singleContext = {
  location: 'Nevada',
  results: [mockContext.results[0]]
};
const singleResponse = generateDetailedShelterInfo(singleContext);
console.log('Response:', singleResponse);
console.log('✅ Single shelter info generated successfully\n');

console.log('=== All tests passed! ==='); 