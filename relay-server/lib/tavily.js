import { config } from './config.js';
import logger from './logger.js';
import { rerankByRelevance } from './relevanceScorer.js';
import { fallbackResponse } from './fallbackResponder.js';
import { ResponseGenerator } from './response.js';

/**
 * Call Tavily API to search for resources
 * @param {string} query - The search query
 * @param {string} intent - The detected intent
 * @returns {Promise<string>} Formatted response with search results
 */
export async function callTavilyAPI(query, intent) {
  try {
    logger.info('Calling Tavily API with query:', { query, intent });

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.TAVILY_API_KEY
      },
      body: JSON.stringify({
        query,
        search_depth: 'advanced',
        include_domains: ['211.org', 'womenshelters.org', 'domesticshelters.org'],
        max_results: 5
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();
    logger.info('Tavily API response:', { 
      resultCount: data.results.length,
      query
    });

    // If no results, use fallback
    if (!data.results || data.results.length === 0) {
      logger.info('No Tavily results, using fallback response');
      return await fallbackResponse(query, intent);
    }

    // Rerank results by semantic relevance
    const rerankedResults = await rerankByRelevance(query, data.results);
    
    // If top result has low relevance score, use fallback
    if (rerankedResults[0].relevanceScore < 0.5) {
      logger.info('Low relevance results, using fallback response', {
        topScore: rerankedResults[0].relevanceScore
      });
      return await fallbackResponse(query, intent);
    }
    
    // Format the response
    const formattedResponse = ResponseGenerator.formatTavilyResponse({results: rerankedResults}, 'web', query, 3);
    return formattedResponse;

  } catch (error) {
    logger.error('Error calling Tavily API:', error);
    // Use fallback on error
    return await fallbackResponse(query, intent);
  }
} 