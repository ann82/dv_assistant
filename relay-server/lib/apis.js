import logger from './logger.js';

export async function callTavilyAPI(query) {
  try {
    logger.info('Calling Tavily API with query:', query);
    
    // Get API key from environment
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      logger.error('TAVILY_API_KEY not found in environment variables');
      throw new Error('TAVILY_API_KEY not found in environment variables');
    }

    // Log the first few characters of the key to verify format
    logger.info('Tavily API key format check:', {
      startsWithTvly: apiKey.startsWith('tvly-'),
      length: apiKey.length,
      firstChars: apiKey.substring(0, 8) + '...'
    });

    // Make the API call
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`  // Changed from 'api-key' to 'Authorization: Bearer'
      },
      body: JSON.stringify({
        query: query,
        search_depth: 'advanced',
        include_domains: [],
        exclude_domains: []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Tavily API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`Tavily API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    logger.info('Tavily API response received:', data);
    return data;
  } catch (error) {
    logger.error('Error calling Tavily API:', error);
    throw error;
  }
}

export async function callGPT(prompt) {
  try {
    logger.info('Calling GPT with prompt:', prompt);
    
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }

    // Make the API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for domestic violence survivors. Provide clear, concise, and supportive responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    logger.info('GPT response received:', data);
    return {
      text: data.choices[0].message.content
    };
  } catch (error) {
    logger.error('Error calling GPT:', error);
    throw error;
  }
} 