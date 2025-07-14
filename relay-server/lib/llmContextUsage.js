import { getConversationContext } from './intentClassifier.js';
import { buildOptimizedContext } from './conversationContextBuilder.js';
import logger from './logger.js';

/**
 * Example: How to use minimal conversation context in LLM prompts
 */

/**
 * Method 1: Direct usage of minimal context
 * Use this when you want the raw minimal context data
 */
export function createLLMPromptWithMinimalContext(callSid, currentQuery) {
  const context = getConversationContext(callSid);
  
  if (!context || !context.lastQueryContext) {
    return {
      systemPrompt: "You are a helpful assistant for domestic violence support.",
      userMessage: currentQuery
    };
  }

  const minimalContext = context.lastQueryContext;
  
  // Build a concise system prompt with context
  const systemPrompt = `You are a helpful assistant for domestic violence support.

CONVERSATION CONTEXT:
- Last Intent: ${minimalContext.lastIntent || 'none'}
- Last Query: "${minimalContext.lastQuery || 'none'}"
- Location: ${minimalContext.location || 'not specified'}
- Recent Summary: ${minimalContext.recentSummary || 'no recent conversation'}
${minimalContext.needsLocation ? '- Status: User needs to provide location' : ''}

${minimalContext.results && minimalContext.results.length > 0 ? `
PREVIOUS SEARCH RESULTS:
${minimalContext.results.map((result, i) => 
  `${i + 1}. ${result.title} (${result.score.toFixed(2)})
   ${result.content}
   Phone: ${result.phoneNumbers.join(', ') || 'not available'}
   Address: ${result.addresses.join(', ') || 'not available'}`
).join('\n\n')}` : ''}

Use this context to provide personalized, relevant responses. If the user asks follow-up questions about previous results, reference them specifically.`;

  return {
    systemPrompt,
    userMessage: currentQuery
  };
}

/**
 * Method 2: Using optimized context (recommended)
 * Use this when you want processed, enhanced context
 */
export function createLLMPromptWithOptimizedContext(callSid, currentQuery, language = 'en-US') {
  const optimizedContext = buildOptimizedContext(callSid, currentQuery, language);
  
  if (optimizedContext.isNewConversation) {
    return {
      systemPrompt: "You are a helpful assistant for domestic violence support.",
      userMessage: currentQuery
    };
  }

  // Build enhanced system prompt
  const systemPrompt = `You are a helpful assistant for domestic violence support.

CONVERSATION CONTEXT:
- Recent Activity: ${optimizedContext.recentSummary || 'no recent activity'}
- Current Location: ${optimizedContext.location || 'not specified'}
- Last Intent: ${optimizedContext.lastIntent || 'none'}
${optimizedContext.needsLocation ? '- Status: User needs to provide location' : ''}
${optimizedContext.familyConcerns ? `- Family Concerns: ${optimizedContext.familyConcerns.join(', ')}` : ''}
${optimizedContext.emotionalTone ? `- Emotional Tone: ${optimizedContext.emotionalTone.join(', ')}` : ''}

INSTRUCTIONS:
- Use the location for resource searches if available
- Reference previous conversation when relevant
- Show empathy based on emotional tone indicators
- Consider family concerns (pets, children, elders) in recommendations
- If this is a follow-up question, use the context to provide continuity`;

  return {
    systemPrompt,
    userMessage: currentQuery,
    context: optimizedContext
  };
}

/**
 * Method 3: Context-aware response generation
 * Use this for generating responses that reference previous results
 */
export function createFollowUpResponsePrompt(callSid, currentQuery, followUpType = 'general') {
  const context = getConversationContext(callSid);
  
  if (!context || !context.lastQueryContext) {
    return {
      systemPrompt: "You are a helpful assistant for domestic violence support.",
      userMessage: currentQuery
    };
  }

  const minimalContext = context.lastQueryContext;
  
  let systemPrompt = `You are a helpful assistant for domestic violence support.

CONVERSATION CONTEXT:
- Last Intent: ${minimalContext.lastIntent}
- Location: ${minimalContext.location || 'not specified'}
- Recent Summary: ${minimalContext.recentSummary}`;

  // Add context based on follow-up type
  switch (followUpType) {
    case 'resource_details':
      if (minimalContext.results && minimalContext.results.length > 0) {
        systemPrompt += `

PREVIOUS RESOURCES FOUND:
${minimalContext.results.map((result, i) => 
  `${i + 1}. ${result.title}
   ${result.content}
   Contact: ${result.phoneNumbers.join(', ') || 'Call for details'}
   Address: ${result.addresses.join(', ') || 'Call for address'}`
).join('\n\n')}

The user is asking for more details about these resources. Reference them specifically and provide helpful information.`;
      }
      break;
      
    case 'location_followup':
      systemPrompt += `

LOCATION CONTEXT:
The user previously mentioned location: ${minimalContext.location}
Use this location for any new resource searches or recommendations.`;
      break;
      
    case 'general_followup':
    default:
      systemPrompt += `

GENERAL FOLLOW-UP:
This appears to be a follow-up question. Use the conversation context to provide continuity and avoid asking for information already provided.`;
      break;
  }

  return {
    systemPrompt,
    userMessage: currentQuery
  };
}

/**
 * Example usage in your main processing pipeline
 */
export async function processQueryWithContext(callSid, currentQuery, language = 'en-US') {
  try {
    // Get the optimized context
    const { systemPrompt, userMessage, context } = createLLMPromptWithOptimizedContext(callSid, currentQuery, language);
    
    // Log context size for monitoring
    logger.info('LLM Context Usage:', {
      callSid,
      contextSize: JSON.stringify(context).length,
      hasLocation: !!context?.location,
      hasResults: !!(context?.resultCount > 0)
    });
    
    // Here you would send to your LLM (OpenAI, etc.)
    // const llmResponse = await openai.createChatCompletion({
    //   model: 'gpt-3.5-turbo',
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     { role: 'user', content: userMessage }
    //   ]
    // });
    
    return {
      systemPrompt,
      userMessage,
      context,
      // response: llmResponse.choices[0].message.content
    };
    
  } catch (error) {
    logger.error('Error processing query with context:', error);
    throw error;
  }
}

/**
 * Example: How to detect if this is a follow-up question
 */
export function detectFollowUpType(callSid, currentQuery) {
  const context = getConversationContext(callSid);
  
  if (!context || !context.lastQueryContext) {
    return 'new_conversation';
  }
  
  const minimalContext = context.lastQueryContext;
  const query = currentQuery.toLowerCase();
  
  // Check for resource-specific follow-ups
  if (minimalContext.results && minimalContext.results.length > 0) {
    const resultTitles = minimalContext.results.map(r => r.title.toLowerCase());
    const hasResourceReference = resultTitles.some(title => 
      query.includes(title.split(' ')[0]) || query.includes('shelter') || query.includes('resource')
    );
    
    if (hasResourceReference) {
      return 'resource_details';
    }
  }
  
  // Check for location follow-ups
  if (minimalContext.location && (
    query.includes('nearby') || query.includes('close') || query.includes('around here') ||
    query.includes('in this area') || query.includes('local')
  )) {
    return 'location_followup';
  }
  
  // Check for general follow-ups
  if (query.includes('what about') || query.includes('also') || query.includes('and') ||
      query.includes('tell me more') || query.includes('how about')) {
    return 'general_followup';
  }
  
  return 'new_query';
} 