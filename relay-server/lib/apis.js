import logger from './logger.js';
import { filterConfig } from './filterConfig.js';

export async function callTavilyAPI(query) {
  try {
    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim() === '') {
      logger.error('Invalid query parameter for Tavily API:', {
        query,
        type: typeof query,
        isNull: query === null,
        isUndefined: query === undefined,
        isEmpty: query === '',
        isWhitespace: query && query.trim() === ''
      });
      throw new Error('Invalid query parameter: query must be a non-empty string');
    }

    const cleanQuery = query.trim();
    logger.info('Calling Tavily API with query:', cleanQuery);
    
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
        query: cleanQuery,
        search_depth: 'advanced',
        include_answer: true,
        include_results: true,
        include_raw_content: false,
        include_domains: [],
        exclude_domains: filterConfig.excludeDomains,
        include_images: false,
        max_results: 15,
        // Add specific parameters for better shelter information
        search_type: 'basic',
        // Include specific content types that are likely to have contact information
        include_sources: true,
        // Add context to help with shelter-specific searches
        context: cleanQuery.includes('shelter') ? 'domestic violence shelter information with contact details' : undefined
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

export async function callGPT(prompt, model = 'gpt-4') {
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
        model: model,
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
    logger.info('GPT response received:', {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage,
      timestamp: new Date().toISOString()
    });
    return {
      text: data.choices[0].message.content
    };
  } catch (error) {
    logger.error('Error calling GPT:', error);
    throw error;
  }
} 