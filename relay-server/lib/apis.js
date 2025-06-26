import logger from './logger.js';
import { filterConfig } from './filterConfig.js';

export async function callTavilyAPI(query, location = null) {
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

    // Standardized query format for domestic violence shelters
    const standardizedQuery = location 
      ? `List domestic violence shelters in ${location}. Include name, address, phone number, services offered, and 24-hour hotline if available. Prioritize .org and .gov sources.`
      : cleanQuery;

    // Make the API call with standardized parameters
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: standardizedQuery,
        search_depth: 'advanced',
        search_type: 'advanced',
        include_answer: true,
        include_results: true,
        include_raw_content: true,
        include_images: false,
        include_sources: true,
        max_results: 10,
        exclude_domains: [
          "yellowpages.com",
          "tripadvisor.com", 
          "city-data.com",
          "yelp.com",
          ...(filterConfig.excludeDomains || [])
        ],
        context: location 
          ? `Return detailed contact info for domestic violence shelters in ${location}, including name, address, phone number, services offered, and 24-hour hotline.`
          : undefined
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

    // If answer is missing or too vague, parse raw_content with regex
    if (!data.answer || data.answer.length < 50) {
      logger.info('Answer missing or vague, parsing raw_content for contact info');
      data.parsedContent = parseRawContentForContactInfo(data.results);
    }

    return data;
  } catch (error) {
    logger.error('Error calling Tavily API:', error);
    throw error;
  }
}

/**
 * Parse raw content from Tavily results to extract addresses and phone numbers
 * @param {Array} results - Tavily API results
 * @returns {Object} Parsed contact information
 */
function parseRawContentForContactInfo(results) {
  if (!results || !Array.isArray(results)) {
    return { addresses: [], phones: [] };
  }

  const addressRegex = /\d{1,5}\s[\w\s]+\s(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Way|Lane|Ln|Drive|Dr|Court|Ct)\b/i;
  const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  
  const addresses = [];
  const phones = [];

  results.forEach(result => {
    if (result.raw_content) {
      // Extract addresses
      const addressMatches = result.raw_content.match(addressRegex);
      if (addressMatches) {
        addresses.push(...addressMatches);
      }

      // Extract phone numbers
      const phoneMatches = result.raw_content.match(phoneRegex);
      if (phoneMatches) {
        phones.push(...phoneMatches);
      }
    }
  });

  return {
    addresses: [...new Set(addresses)], // Remove duplicates
    phones: [...new Set(phones)] // Remove duplicates
  };
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