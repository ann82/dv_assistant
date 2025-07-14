import { validateTranscription, generateRepromptMessage, containsLocationInfo, extractPotentialLocation } from './lib/transcriptionValidator.js';

console.log('🧪 Testing Transcription Validation System\n');

// Test cases for transcription errors
const testCases = [
  {
    name: "I Station 2 (should be 'I'm at Station 2')",
    transcription: "I Station 2",
    confidence: 0.3
  },
  {
    name: "I Building 5 (should be 'I'm at Building 5')",
    transcription: "I Building 5",
    confidence: 0.4
  },
  {
    name: "I Main Street (should be 'I'm at Main Street')",
    transcription: "I Main Street",
    confidence: 0.5
  },
  {
    name: "I need help find (should be 'I need help finding')",
    transcription: "I need help find",
    confidence: 0.6
  },
  {
    name: "I am at Downtown Center (should be 'I'm at Downtown Center')",
    transcription: "I am at Downtown Center",
    confidence: 0.7
  },
  {
    name: "Normal speech - no errors",
    transcription: "I'm looking for a shelter near downtown",
    confidence: 0.9
  },
  {
    name: "Very low confidence transcription",
    transcription: "I Station 2",
    confidence: 0.1
  },
  {
    name: "Empty transcription",
    transcription: "",
    confidence: null
  }
];

console.log('📝 Running Transcription Validation Tests:\n');

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Original: "${testCase.transcription}"`);
  console.log(`   Confidence: ${testCase.confidence}`);
  
  const result = validateTranscription(testCase.transcription, testCase.confidence, `test-${index}`);
  
  console.log(`   Corrected: "${result.corrected}"`);
  console.log(`   Confidence Level: ${result.confidenceLevel}`);
  console.log(`   Has Errors: ${result.hasErrors}`);
  console.log(`   Corrections: ${result.corrections.length}`);
  console.log(`   Is Valid: ${result.isValid}`);
  console.log(`   Should Reprompt: ${result.shouldReprompt}`);
  
  if (result.corrections && result.corrections.length > 0) {
    console.log(`   Corrections Applied:`);
    result.corrections.forEach((correction, i) => {
      console.log(`     ${i + 1}. ${correction.type}: "${correction.before}" → "${correction.after}"`);
    });
  }
  
  if (result.confidenceIssues && result.confidenceIssues.length > 0) {
    console.log(`   Confidence Issues: ${result.confidenceIssues.join(', ')}`);
  }
  
  if (result.shouldReprompt) {
    const repromptMessage = generateRepromptMessage(testCase.transcription, testCase.confidence);
    console.log(`   Reprompt Message: "${repromptMessage}"`);
  }
});

console.log('\n🔍 Testing Location Detection:\n');

const locationTestCases = [
  "I Station 2",
  "I'm at Main Street",
  "Near Downtown Center",
  "I need help finding shelters",
  "Hello, how are you?",
  "I Building 5",
  "I'm looking for help"
];

locationTestCases.forEach((testCase, index) => {
  const hasLocation = containsLocationInfo(testCase);
  const extractedLocation = extractPotentialLocation(testCase);
  
  console.log(`${index + 1}. "${testCase}"`);
  console.log(`   Contains Location: ${hasLocation}`);
  console.log(`   Extracted Location: ${extractedLocation || 'None'}`);
});

console.log('\n✅ Transcription Validation Tests Complete!'); 