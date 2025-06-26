import { ResponseGenerator } from './lib/response.js';

async function testPromptBehavior() {
  console.log('=== Testing Prompt Behavior Changes ===\n');
  
  // Test scenarios that should show differences
  const testScenarios = [
    {
      name: "Emergency Situation",
      query: "I'm in immediate danger and need help right now",
      expected: "Should show more detailed emergency protocols"
    },
    {
      name: "Location Follow-up",
      query: "I live in Santa Clara",
      expected: "Should handle location follow-up better"
    },
    {
      name: "Cultural Sensitivity",
      query: "I'm LGBTQ and need help",
      expected: "Should show LGBTQ-specific guidance"
    },
    {
      name: "Safety Planning",
      query: "How can I stay safe?",
      expected: "Should provide detailed safety planning"
    },
    {
      name: "Conversation Structure",
      query: "I need shelter information",
      expected: "Should follow structured conversation flow"
    }
  ];
  
  for (const scenario of testScenarios) {
    console.log(`\n--- ${scenario.name} ---`);
    console.log(`Query: "${scenario.query}"`);
    console.log(`Expected: ${scenario.expected}`);
    
    try {
      const response = await ResponseGenerator.generateGPTResponse(scenario.query, 'gpt-3.5-turbo', {});
      
      console.log('\nResponse:');
      console.log(response.text);
      console.log('\nResponse Length:', response.text.length, 'characters');
      
      // Check for specific improvements
      const improvements = [];
      if (response.text.toLowerCase().includes('911')) improvements.push('Emergency protocols');
      if (response.text.toLowerCase().includes('lgbtq') || response.text.toLowerCase().includes('lgbt')) improvements.push('LGBTQ awareness');
      if (response.text.toLowerCase().includes('safety plan') || response.text.toLowerCase().includes('safety planning')) improvements.push('Safety planning');
      if (response.text.toLowerCase().includes('step') || response.text.toLowerCase().includes('first')) improvements.push('Structured guidance');
      if (response.text.toLowerCase().includes('thank you') || response.text.toLowerCase().includes('trust')) improvements.push('Empathetic tone');
      
      console.log('\nDetected Improvements:', improvements.length > 0 ? improvements.join(', ') : 'None detected');
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

testPromptBehavior().catch(console.error); 