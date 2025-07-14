import dotenv from 'dotenv';
import { extractLocationFromQuery } from './lib/enhancedLocationDetector.js';
import logger from './lib/logger.js';

dotenv.config();

async function testLocationExtractionFix() {
  console.log('🧪 Testing location extraction fix for "Can you help me" issue...\n');
  
  // Test cases that should NOT extract locations
  const nonLocationQueries = [
    "I'm not in any danger, but I want to get out of this relationship. Can you help me with that?",
    "Can you help me find shelter?",
    "Could you tell me about resources?",
    "Would you be able to help me?",
    "I need help with my relationship",
    "Can you give me information?",
    "This is a difficult situation",
    "I want to get out of this relationship",
    "Help me understand my options",
    "Tell me what I can do"
  ];
  
  console.log('❌ Testing queries that should NOT extract locations:');
  for (const query of nonLocationQueries) {
    const result = extractLocationFromQuery(query);
    console.log(`\nQuery: "${query}"`);
    console.log(`Result: ${JSON.stringify(result)}`);
    
    if (result.location) {
      console.log(`❌ ERROR: Should not have extracted location "${result.location}"`);
    } else {
      console.log(`✅ CORRECT: No location extracted`);
    }
  }
  
  // Test cases that SHOULD extract locations
  const locationQueries = [
    "I need shelter in San Francisco",
    "Help me find resources in New York",
    "Are there services in Los Angeles?",
    "I'm looking for help in Chicago",
    "Can you find shelter near Boston?",
    "I need assistance in Miami",
    "Help in Seattle area",
    "Resources in Denver",
    "Shelter in Phoenix",
    "Services in Austin"
  ];
  
  console.log('\n\n✅ Testing queries that SHOULD extract locations:');
  for (const query of locationQueries) {
    const result = extractLocationFromQuery(query);
    console.log(`\nQuery: "${query}"`);
    console.log(`Result: ${JSON.stringify(result)}`);
    
    if (result.location) {
      console.log(`✅ CORRECT: Extracted location "${result.location}"`);
    } else {
      console.log(`❌ ERROR: Should have extracted a location`);
    }
  }
  
  console.log('\n✅ Location extraction fix test completed!');
}

testLocationExtractionFix().catch(console.error); 