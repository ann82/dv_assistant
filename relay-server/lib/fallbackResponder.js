import { OpenAI } from 'openai';
import { config } from './config.js';
import logger from './logger.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Few-shot examples for each intent
const intentExamples = {
  find_shelter: [
    {
      role: 'user',
      content: 'I need to find a safe place to stay tonight'
    },
    {
      role: 'assistant',
      content: 'I understand you need immediate shelter. The National Domestic Violence Hotline (1-800-799-7233) can help you find a safe place right now. They work with shelters across the country and can arrange transportation if needed. Your safety is the priority - please call them for immediate assistance.'
    }
  ],
  get_support_resource: [
    {
      role: 'user',
      content: 'What kind of help is available for someone in my situation?'
    },
    {
      role: 'assistant',
      content: 'There are several types of support available: emergency shelters for immediate safety, counseling services for emotional support, legal aid for protection orders, and financial assistance programs. The National Domestic Violence Hotline (1-800-799-7233) can connect you with all these resources in your area. Would you like me to explain any of these options in more detail?'
    }
  ],
  get_contact_details: [
    {
      role: 'user',
      content: 'How can I reach someone who can help me?'
    },
    {
      role: 'assistant',
      content: 'You can reach the National Domestic Violence Hotline at 1-800-799-7233. They\'re available 24/7, and their advocates are trained to help with safety planning, finding local resources, and providing emotional support. The call is free and confidential. Would you like me to provide additional contact information for specific types of support?'
    }
  ],
  get_information: [
    {
      role: 'user',
      content: 'What should I do if I need to leave quickly?'
    },
    {
      role: 'assistant',
      content: 'If you need to leave quickly, here\'s what to do: 1) Call the National Domestic Violence Hotline (1-800-799-7233) for immediate assistance. 2) If possible, gather essential items like ID, medications, and important documents. 3) Consider having a small emergency bag ready with basic necessities. 4) Have a safe place in mind to go. Remember, your safety comes first - if you need to leave immediately, do so and call for help from a safe location.'
    }
  ]
};

/**
 * Generate a fallback response using GPT-3.5-turbo when Tavily results are insufficient
 * @param {string} query - The user's query
 * @param {string} intent - The detected intent
 * @returns {Promise<string>} A helpful response
 */
export async function fallbackResponse(query, intent, callSid = null, detectedLanguage = 'en-US') {
  try {
    logger.info('Generating fallback response:', { query, intent, callSid });

    // Get enhanced voice instructions if callSid is provided
    let systemContent = `You are a compassionate domestic violence support assistant. Provide warm, empathetic, and supportive responses that validate the caller's feelings and experiences. Use gentle, reassuring language and show understanding of their situation. Always include the National Domestic Violence Hotline number (1-800-799-7233) in your response. Focus on immediate safety, emotional support, and practical next steps. Acknowledge their courage in reaching out and reassure them that help is available.`;
    
    if (callSid) {
      try {
        const { getEnhancedVoiceInstructions } = await import('./conversationContextBuilder.js');
        const enhancedInstructions = await getEnhancedVoiceInstructions(callSid, query, detectedLanguage);
        systemContent = enhancedInstructions;
      } catch (contextError) {
        logger.error('Error getting enhanced voice instructions for fallback:', {
          callSid,
          error: contextError.message
        });
        // Continue with default system content if enhancement fails
      }
    }

    const messages = [
      {
        role: 'system',
        content: systemContent
      },
      // Add few-shot example if available for the intent
      ...(intentExamples[intent] || []),
      {
        role: 'user',
        content: query
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 250
    });

    const fallbackResponse = response.choices[0].message.content;
    
    logger.info('Generated fallback response:', {
      query,
      intent,
      responseLength: fallbackResponse.length
    });

    return fallbackResponse;

  } catch (error) {
    logger.error('Error generating fallback response:', error);
    return "I apologize, but I'm having trouble providing specific information right now. Please call the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance. They are available 24/7 and can help connect you with local resources.";
  }
} 