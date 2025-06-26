import { ResponseGenerator } from './lib/response.js';

async function testFilteringFix() {
  console.log('=== Testing Filtering Fix ===\n');
  
  // Test case similar to the one that was failing
  const testResults = [
    {
      title: '[PDF] City Commission Meeting Agenda - City of Pittsburg',
      content: 'City commission meeting agenda with various city services and resources',
      url: 'https://www.pittks.org/wp-content/uploads/2021/05/05-11-2021-City-Commission-Meeting-Agenda.pdf',
      score: 0.038484335
    },
    {
      title: 'Domestic Violence Shelter - Safe Haven',
      content: 'Emergency shelter for domestic violence victims with 24/7 support',
      url: 'https://safehaven.org/shelter',
      score: 0.85
    },
    {
      title: 'City of Seattle Social Services',
      content: 'City government page with information about local social services including shelters',
      url: 'https://www.seattle.gov/social-services',
      score: 0.12
    }
  ];
  
  console.log('Testing filterRelevantResults with mixed results...\n');
  
  const filteredResults = ResponseGenerator.filterRelevantResults(testResults, 'find shelter near Seattle');
  
  console.log('Original results count:', testResults.length);
  console.log('Filtered results count:', filteredResults.length);
  
  console.log('\nFiltered results:');
  filteredResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.title} (score: ${result.score})`);
  });
  
  // Test if the fix allows government/city pages through
  const hasGovernmentPage = filteredResults.some(result => 
    result.url.includes('.gov') || 
    result.title.toLowerCase().includes('city') || 
    result.title.toLowerCase().includes('commission')
  );
  
  console.log('\n✅ Government/City page included:', hasGovernmentPage ? 'YES' : 'NO');
  
  // Test if DV-specific results are still included
  const hasDVResult = filteredResults.some(result => 
    result.title.toLowerCase().includes('domestic violence') || 
    result.title.toLowerCase().includes('shelter')
  );
  
  console.log('✅ DV-specific result included:', hasDVResult ? 'YES' : 'NO');
}

testFilteringFix().catch(console.error); 