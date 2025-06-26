import { detectLocationWithGeocoding } from './lib/enhancedLocationDetector.js';
import { rewriteQuery } from './lib/intentClassifier.js';

async function testGeocodingUsage() {
  console.log('=== Testing Geocoding Usage ===\n');
  
  const testQueries = [
    "Can you give me shelter homes near Sunnyvale?",
    "I need shelter in San Francisco",
    "Find shelter near Oakland"
  ];
  
  for (const query of testQueries) {
    console.log(`Testing query: "${query}"`);
    
    try {
      // Test 1: Direct geocoding call
      console.log('  1. Testing detectLocationWithGeocoding...');
      const geocodingResult = await detectLocationWithGeocoding(query);
      console.log('     Result:', {
        location: geocodingResult?.location,
        isUS: geocodingResult?.isUS,
        scope: geocodingResult?.scope,
        hasGeocodeData: !!geocodingResult?.geocodeData
      });
      
      // Test 2: Query rewriting (which uses geocoding)
      console.log('  2. Testing rewriteQuery...');
      const rewrittenResult = await rewriteQuery(query, 'find_shelter');
      console.log('     Rewritten query:', rewrittenResult);
      
    } catch (error) {
      console.log('     Error:', error.message);
    }
    
    console.log('');
  }
}

testGeocodingUsage().catch(console.error); 