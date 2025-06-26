import { extractLocationFromQuery } from './lib/enhancedLocationDetector.js';

function testLocationPatterns() {
  console.log('=== Testing Location Pattern Matching ===\n');
  
  const testQueries = [
    "Can you give me shelter homes near Sunnyvale?",
    "I need shelter in San Francisco",
    "Find shelter near Oakland",
    "I live in Santa Clara"
  ];
  
  testQueries.forEach((query, index) => {
    console.log(`${index + 1}. Query: "${query}"`);
    
    // Test the patterns manually
    const patterns = [
      /in\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /near\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /around\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /at\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /within\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /close\s+to\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /find\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /(?:need|want|looking\s+for)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /(?:can\s+you\s+)?(?:help\s+me\s+)?(?:find|get)\s+(?:some\s+)?(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /(?:shelter|help|resources?|services?)\s+(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)(?:\s*$|\s*[?.,])/i,
      /(?:in|near|around|at|within|close\s+to)\s+([^,.]+(?:,\s*[^,.]+)?)(?:\s*$|\s*[?.,])/i
    ];
    
    let matched = false;
    patterns.forEach((pattern, pIndex) => {
      const match = query.match(pattern);
      if (match && match[1]) {
        console.log(`   Pattern ${pIndex + 1} matched: "${match[1]}"`);
        matched = true;
      }
    });
    
    if (!matched) {
      console.log('   No patterns matched');
    }
    
    // Test the actual function
    const result = extractLocationFromQuery(query);
    console.log(`   Function result:`, result);
    console.log('');
  });
}

testLocationPatterns(); 