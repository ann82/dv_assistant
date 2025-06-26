// Test the cleanExtractedLocation function directly
function cleanExtractedLocation(location) {
  if (!location || typeof location !== 'string') {
    return null;
  }

  let cleaned = location.trim();
  
  console.log('   Original:', `"${location}"`);
  
  // Remove common artifacts
  cleaned = cleaned.replace(/^(a|an|the)\s+/i, ''); // Remove articles
  cleaned = cleaned.replace(/\s+(a|an|the)\s+/gi, ' '); // Remove articles in middle
  cleaned = cleaned.replace(/^(some|any|all)\s+/i, ''); // Remove quantifiers
  cleaned = cleaned.replace(/\s+(some|any|all)\s+/gi, ' '); // Remove quantifiers in middle
  cleaned = cleaned.replace(/^(shelter|help|resource|service)s?\s+/i, ''); // Remove service words
  cleaned = cleaned.replace(/\s+(shelter|help|resource|service)s?\s+/gi, ' '); // Remove service words in middle
  cleaned = cleaned.replace(/^(home|house|place)s?\s+/i, ''); // Remove building words
  cleaned = cleaned.replace(/\s+(home|house|place)s?\s+/gi, ' '); // Remove building words in middle
  
  console.log('   After removing artifacts:', `"${cleaned}"`);
  
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[?.,!;]+$/, '');
  
  console.log('   After removing trailing punctuation:', `"${cleaned}"`);
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  console.log('   After whitespace cleanup:', `"${cleaned}"`);
  
  // Must have at least 2 characters and contain letters
  if (cleaned.length < 2 || !/[a-zA-Z]/.test(cleaned)) {
    console.log('   ❌ Invalid location (too short or no letters)');
    return null;
  }
  
  // Return lowercase for consistency with test expectations
  const result = cleaned.toLowerCase();
  console.log('   ✅ Final result:', `"${result}"`);
  return result;
}

console.log('=== Testing Location Cleaning ===\n');

const testLocations = [
  'Sunnyvale?',
  'San Francisco',
  'Oakland',
  'Santa Clara',
  'New York?',
  'Los Angeles!',
  'Chicago.',
  'Miami;'
];

testLocations.forEach((location, index) => {
  console.log(`${index + 1}. Testing: "${location}"`);
  const result = cleanExtractedLocation(location);
  console.log(`   Result: ${result ? `"${result}"` : 'null'}\n`);
}); 