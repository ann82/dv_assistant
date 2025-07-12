import logger from './logger.js';
import { filterConfig } from './filterConfig.js';
import { config } from './config.js';

// Cache for Tavily API responses
const tavilyCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_SIZE = 1000;

export async function callTavilyAPI(query, location = null, useCache = null) {
  try {
    // Use config default if not specified
    const shouldUseCache = useCache !== null ? useCache : config.TAVILY_CACHE_ENABLED;
    
    // Check cache first if enabled
    if (shouldUseCache) {
      const cacheKey = `${query}:${location || 'no-location'}`;
      const cached = tavilyCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        logger.info('Using cached Tavily response:', { query, location });
        return cached.data;
      }
    }

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

    // Enhanced query standardization for better results
    const standardizedQuery = location 
      ? `domestic violence shelters ${location} contact information address phone services`
      : cleanQuery;

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.TAVILY_TIMEOUT); // Configurable timeout for Tavily API

    try {
      // Make the API call with standardized parameters and timeout
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          query: standardizedQuery,
          search_depth: config.TAVILY_SEARCH_DEPTH,
          search_type: config.TAVILY_SEARCH_TYPE,
          include_answer: true,
          include_results: true,
          include_raw_content: false,
          include_images: false,
          include_sources: false, // Disabled to reduce response size
          max_results: config.TAVILY_MAX_RESULTS,
          exclude_domains: [
            "yellowpages.com",
            "tripadvisor.com", 
            "city-data.com",
            "yelp.com",
            "facebook.com",
            "instagram.com",
            "twitter.com",
            "linkedin.com",
            "pinterest.com",
            "tiktok.com",
            "youtube.com",
            "reddit.com",
            "zillow.com",
            "realtor.com",
            "trulia.com",
            "hotels.com",
            "booking.com",
            "airbnb.com",
            "vrbo.com",
            "expedia.com",
            "orbitz.com",
            "priceline.com",
            "hotwire.com",
            "kayak.com",
            "cheaptickets.com",
            "travelocity.com",
            ...(filterConfig.excludeDomains || [])
          ],
          context: location 
            ? `Find domestic violence shelters in ${location}. Focus on organizations with direct contact information, addresses, and services. Prioritize .org and .gov sources.`
            : undefined
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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

      // Cache the response if enabled
      if (shouldUseCache) {
        const cacheKey = `${query}:${location || 'no-location'}`;
        
        // Manage cache size
        if (tavilyCache.size >= MAX_CACHE_SIZE) {
          const firstKey = tavilyCache.keys().next().value;
          tavilyCache.delete(firstKey);
        }
        
        tavilyCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        logger.info('Cached Tavily response:', { 
          query, 
          location, 
          cacheSize: tavilyCache.size 
        });
      }

      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        logger.error('Tavily API request timed out after 30 seconds');
        throw new Error('Tavily API request timed out');
      }
      
      throw fetchError;
    }
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

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 25000); // 25 second timeout for GPT API

    try {
      // Make the API call with timeout
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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        logger.error('GPT API request timed out after 25 seconds');
        throw new Error('GPT API request timed out');
      }
      
      throw fetchError;
    }
  } catch (error) {
    logger.error('Error calling GPT:', error);
    throw error;
  }
} 