import { ResponseGenerator } from './lib/response.js';

async function testPromptComparison() {
  console.log('=== Testing Prompt Comparison ===\n');
  
  // Old simple prompt (what we had before)
  const oldPrompt = `You are an AI assistant for domestic violence support. Be kind, empathetic, and non-judgmental. Prioritize the caller's safety and privacy. If you hear keywords like "suicide," "weapons," "kill," "knife," "gun," "children," "can't move," or "killed," immediately stop and ask the caller to call 911 or offer to call 911 on their behalf. Thank the caller for trusting you. Focus on understanding their needs, providing resources, and discussing safety plans. Keep responses concise and focused.`;
  
  // New detailed prompt (what we have now)
  const { voiceInstructions } = await import('./lib/conversationConfig.js');
  
  const testQueries = [
    "I need help finding a shelter",
    "I'm scared and don't know what to do",
    "Can you help me with legal services?",
    "I need emergency help right now",
    "What resources are available for domestic violence?"
  ];
  
  console.log('Old prompt length:', oldPrompt.length, 'characters');
  console.log('New prompt length:', voiceInstructions.length, 'characters');
  console.log('Difference:', voiceInstructions.length - oldPrompt.length, 'characters\n');
  
  for (const query of testQueries) {
    console.log(`\n--- Testing: "${query}" ---`);
    
    try {
      // Test with old prompt
      console.log('\nOLD PROMPT:');
      const oldResponse = await ResponseGenerator.generateGPTResponse(query, 'gpt-3.5-turbo', {});
      console.log('Response:', oldResponse.text.substring(0, 200) + '...');
      console.log('Length:', oldResponse.text.length, 'characters');
      
      // Test with new prompt
      console.log('\nNEW PROMPT:');
      const newResponse = await ResponseGenerator.generateGPTResponse(query, 'gpt-3.5-turbo', {});
      console.log('Response:', newResponse.text.substring(0, 200) + '...');
      console.log('Length:', newResponse.text.length, 'characters');
      
      // Compare
      const lengthDiff = newResponse.text.length - oldResponse.text.length;
      console.log('\nCOMPARISON:');
      console.log('Length difference:', lengthDiff, 'characters');
      console.log('Response changed:', oldResponse.text !== newResponse.text ? 'YES' : 'NO');
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

testPromptComparison().catch(console.error); 