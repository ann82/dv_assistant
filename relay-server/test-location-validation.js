import { geocodingIntegration } from './integrations/geocodingIntegration.js';
import { extractPotentialLocation } from './lib/transcriptionValidator.js';

console.log('🧪 Testing Location Validation with Nominatim\n');

// Test cases for location validation
const testCases = [
  {
    name: "Valid real location - San Francisco",
    transcription: "I need help in San Francisco",
    expectedLocation: "San Francisco",
    shouldValidate: true
  },
  {
    name: "Valid real location - New York",
    transcription: "I'm at New York",
    expectedLocation: "New York",
    shouldValidate: true
  },
  {
    name: "Invalid location - Station 2 (likely transcription error)",
    transcription: "I Station 2",
    expectedLocation: "Station 2",
    shouldValidate: false
  },
  {
    name: "Invalid location - Building 5 (likely transcription error)",
    transcription: "I Building 5",
    expectedLocation: "Building 5",
    shouldValidate: false
  },
  {
    name: "Valid location with state - Los Angeles, California",
    transcription: "I need shelter in Los Angeles, California",
    expectedLocation: "Los Angeles, California",
    shouldValidate: true
  },
  {
    name: "Invalid location - Random words",
    transcription: "I need help at Blueberry Pancake",
    expectedLocation: "Blueberry Pancake",
    shouldValidate: false
  },
  {
    name: "No location in transcription",
    transcription: "I need help with domestic violence",
    expectedLocation: null,
    shouldValidate: null
  }
];

console.log('📝 Running Location Validation Tests:\n');

for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  console.log(`\n${i + 1}. ${testCase.name}`);
  console.log(`   Transcription: "${testCase.transcription}"`);
  
  // Extract potential location
  const extractedLocation = extractPotentialLocation(testCase.transcription);
  console.log(`   Extracted Location: "${extractedLocation}"`);
  console.log(`   Expected Location: "${testCase.expectedLocation}"`);
  
  if (extractedLocation !== testCase.expectedLocation) {
    console.log(`   ⚠️  Location extraction mismatch!`);
  }
  
  // Test Nominatim validation if we have a location
  if (extractedLocation) {
    console.log(`   🔍 Validating with Nominatim...`);
    
    try {
      const geoResult = await geocodingIntegration.geocode(extractedLocation, {}, `test-${i}`);
      
      console.log(`   Nominatim Success: ${geoResult.success}`);
      
      if (geoResult.success && geoResult.data) {
        const geoData = geoResult.data;
        console.log(`   Geocoding Result:`);
        console.log(`     - City: ${geoData.city || 'N/A'}`);
        console.log(`     - State: ${geoData.state || 'N/A'}`);
        console.log(`     - Country: ${geoData.country || 'N/A'}`);
        console.log(`     - Display Name: ${geoData.displayName || 'N/A'}`);
        
        const hasValidLocation = geoData.city || geoData.state || geoData.country;
        console.log(`   Has Valid Location: ${hasValidLocation}`);
        
        // Additional validation checks
        const isInTargetRegion = geoData.country === 'United States' || 
                                geoData.country === 'Canada' || 
                                geoData.country === 'Mexico';
        console.log(`   In Target Region (US/Canada/Mexico): ${isInTargetRegion}`);
        
        const locationName = geoData.displayName || '';
        const extractedLower = extractedLocation.toLowerCase();
        const displayLower = locationName.toLowerCase();
        const hasReasonableMatch = displayLower.includes(extractedLower) || 
                                  extractedLower.includes(displayLower.split(',')[0].toLowerCase());
        console.log(`   Has Reasonable Name Match: ${hasReasonableMatch}`);
        
        const overallValidation = hasValidLocation && isInTargetRegion && hasReasonableMatch;
        console.log(`   Overall Validation Result: ${overallValidation}`);
        
        if (testCase.shouldValidate === true && !overallValidation) {
          console.log(`   ❌ Expected validation to pass but it failed`);
        } else if (testCase.shouldValidate === false && overallValidation) {
          console.log(`   ❌ Expected validation to fail but it passed`);
        } else {
          console.log(`   ✅ Validation result matches expectation`);
        }
      } else {
        console.log(`   Nominatim Error: ${geoResult.error || 'Unknown error'}`);
        
        if (testCase.shouldValidate === false) {
          console.log(`   ✅ Validation correctly failed for invalid location`);
        } else if (testCase.shouldValidate === true) {
          console.log(`   ❌ Validation failed for what should be a valid location`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Geocoding error: ${error.message}`);
    }
  } else {
    console.log(`   ℹ️  No location extracted - skipping validation`);
  }
}

console.log('\n✅ Location Validation Tests Complete!'); 