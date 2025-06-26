import { ResponseGenerator } from './lib/response.js';

async function testSimpleComparison() {
  console.log('=== Simple Prompt Comparison ===\n');
  
  const testQuery = "I need help finding a shelter";
  
  console.log(`Testing query: "${testQuery}"\n`);
  
  try {
    const response = await ResponseGenerator.generateGPTResponse(testQuery, 'gpt-3.5-turbo', {});
    
    console.log('Current Response (with new detailed prompt):');
    console.log('=' .repeat(50));
    console.log(response.text);
    console.log('=' .repeat(50));
    console.log('Response length:', response.text.length, 'characters');
    
    // Check for specific features from the new prompt
    const features = [];
    if (response.text.toLowerCase().includes('emergency')) features.push('Emergency protocols');
    if (response.text.toLowerCase().includes('safety')) features.push('Safety planning');
    if (response.text.toLowerCase().includes('step')) features.push('Structured guidance');
    if (response.text.toLowerCase().includes('thank you')) features.push('Empathetic tone');
    if (response.text.toLowerCase().includes('location')) features.push('Location awareness');
    if (response.text.toLowerCase().includes('911')) features.push('911 escalation');
    
    console.log('\nDetected features:', features.length > 0 ? features.join(', ') : 'Basic response');
    
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testSimpleComparison().catch(console.error); 