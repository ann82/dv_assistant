import { callGPT } from './apis.js';
import logger from './logger.js';

/**
 * AI-powered filter for Tavily search results
 * Uses GPT to intelligently classify and filter results
 */
export class AIResultFilter {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 1000 * 60 * 30; // 30 minutes
  }

  /**
   * Filter results using AI classification
   */
  async filterResults(results, query) {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    const filteredResults = [];
    
    for (const result of results) {
      const isRelevant = await this.isRelevantResult(result, query);
      if (isRelevant) {
        filteredResults.push(result);
      }
    }

    logger.info('AI filtering completed:', {
      originalCount: results.length,
      filteredCount: filteredResults.length,
      query
    });

    return filteredResults;
  }

  /**
   * Check if a single result is relevant using AI
   */
  async isRelevantResult(result, query) {
    const cacheKey = `${result.url}-${query}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.isRelevant;
    }

    const title = result.title || '';
    const content = result.content || '';
    const url = result.url || '';

    const prompt = `
You are an AI assistant helping to filter search results for domestic violence shelters and resources.

Query: "${query}"

Result to evaluate:
- Title: "${title}"
- Content: "${content.substring(0, 500)}..."
- URL: "${url}"

Please classify this result as either:
1. "RELEVANT" - if it's an actual shelter, domestic violence center, or direct service organization
2. "NOT_RELEVANT" - if it's a PDF, government document, general information, news article, or other non-direct service

Consider:
- Does this provide direct shelter or support services?
- Is this an actual organization people can contact?
- Is this just general information or documentation?

Respond with only "RELEVANT" or "NOT_RELEVANT".
`;

    try {
      const response = await callGPT(prompt);
      const isRelevant = response.text.trim().toUpperCase() === 'RELEVANT';
      
      // Cache the result
      this.cache.set(cacheKey, {
        isRelevant,
        timestamp: Date.now()
      });

      logger.info('AI classification result:', {
        title,
        url,
        isRelevant,
        query
      });

      return isRelevant;
    } catch (error) {
      logger.error('Error in AI filtering:', error);
      // Fallback to basic filtering if AI fails
      return this.basicFilter(result);
    }
  }

  /**
   * Basic fallback filter when AI is unavailable
   */
  basicFilter(result) {
    const title = (result.title || '').toLowerCase();
    const content = (result.content || '').toLowerCase();
    const url = (result.url || '').toLowerCase();

    // Basic unwanted patterns
    const unwantedPatterns = [
      /\.pdf$/i,
      /\[pdf\]/i,
      /wikipedia/i,
      /\.gov/i,
      /census/i,
      /statistics/i,
      /research/i,
      /study/i,
      /report/i,
      /news/i,
      /article/i,
      /blog/i
    ];

    // Basic positive patterns
    const positivePatterns = [
      /shelter/i,
      /domestic.*violence.*center/i,
      /safe.*house/i,
      /crisis.*center/i,
      /women.*center/i,
      /family.*services/i,
      /support.*services/i,
      /emergency.*shelter/i,
      /organization/i,
      /non.*profit/i,
      /charity/i,
      /foundation/i,
      /hotline/i,
      /helpline/i
    ];

    const hasUnwanted = unwantedPatterns.some(pattern => 
      pattern.test(title) || pattern.test(content) || pattern.test(url)
    );

    const hasPositive = positivePatterns.some(pattern => 
      pattern.test(title) || pattern.test(content)
    );

    return hasPositive && !hasUnwanted;
  }

  /**
   * Clean up cache to prevent memory leaks
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
} 