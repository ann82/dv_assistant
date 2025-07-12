import { config } from './config.js';
import { OpenAI } from 'openai';
import { encode } from 'gpt-tokenizer';
import { patternCategories, shelterKeywords } from './patternConfig.js';
import logger from './logger.js';
import { gptCache } from './queryCache.js';
import { voiceInstructions } from './conversationConfig.js';
import { getEnhancedVoiceInstructions } from './conversationContextBuilder.js';
import { callTavilyAPI } from './apis.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Constants for filtering
const DV_KEYWORDS = [
  'domestic violence',
  'domestic abuse',
  'intimate partner violence',
  'family violence',
  'spousal abuse',
  'partner abuse',
  'relationship violence',
  'gender-based violence',
  'violence against women',
  'battered women',
  'abuse survivor',
  'victim of abuse'
];

const SHELTER_KEYWORDS = [
  'shelter',
  'safe house',
  'emergency housing',
  'crisis center',
  'crisis shelter',
  'emergency shelter',
  'transitional housing',
  'support services',
  'counseling services',
  'advocacy services',
  'victim services',
  'survivor services',
  'emergency assistance',
  'crisis intervention',
  'safety planning',
  'protective services'
];

const GENERIC_RESOURCE_PATTERNS = [
  'resource guide',
  'resource directory',
  'community resources',
  'city resources',
  'municipal resources',
  'government resources',
  'public resources',
  'services directory',
  'community services',
  'social services',
  'general resources',
  'information guide',
  'help directory',
  'assistance directory',
  'resource center',
  'community center',
  'information center',
  'help center',
  'assistance center',
  'services center',
  'resource hub',
  'community hub',
  'information hub',
  'help hub',
  'assistance hub',
  'services hub'
];

const CITY_PAGE_PATTERNS = [
  'city of',
  'municipal',
  'government',
  'public',
  'community'
];

const EXCLUDED_DOMAINS = [
  'yelp.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'linkedin.com',
  'pinterest.com',
  'tiktok.com',
  'youtube.com',
  'reddit.com',
  'tripadvisor.com',
  'zillow.com',
  'realtor.com',
  'trulia.com',
  'hotels.com',
  'booking.com',
  'airbnb.com',
  'vrbo.com',
  'expedia.com',
  'orbitz.com',
  'priceline.com',
  'hotwire.com',
  'kayak.com',
  'cheaptickets.com',
  'travelocity.com',
  'maddiesfund.org',
  'domesticshelters.org'
];

export class ResponseGenerator {
  static tavilyCache = new Map();
  static CACHE_TTL = 1000 * 60 * 30; // 30 minutes
  static MAX_CACHE_SIZE = 1000;
  static routingStats = {
    totalRequests: 0,
    byConfidence: {
      high: { count: 0, success: 0, fallback: 0 },
      medium: { count: 0, success: 0, fallback: 0 },
      low: { count: 0, success: 0, fallback: 0 },
      nonFactual: { count: 0 }
    },
    bySource: {
      tavily: { count: 0, success: 0 },
      gpt: { count: 0, success: 0 },
      hybrid: { count: 0, success: 0 }
    },
    responseTimes: {
      tavily: [],
      gpt: [],
      hybrid: []
    }
  };

  static getCachedAnalysis(input) {
    if (!input) return null;
    const normalizedInput = input.toLowerCase().trim();
    const cached = gptCache.get(normalizedInput);
    return cached || null;
  }

  static setCachedAnalysis(input, analysis) {
    if (!input) return;
    const normalizedInput = input.toLowerCase().trim();
    gptCache.set(normalizedInput, analysis, 3600000); // Cache for 1 hour
  }

  static getCacheStats() {
    return gptCache.getStats();
  }

  static analyzeQuery(input) {
    // Handle null/undefined input
    if (!input) {
      return {
        isFactual: false,
        confidence: 0,
        matches: {
          patterns: [],
          score: 0,
          totalWeight: 0
        }
      };
    }

    // Log incoming query
    logger.info('Analyzing query', {
      input,
      timestamp: new Date().toISOString()
    });

    // Check cache first
    const cachedAnalysis = this.getCachedAnalysis(input);
    if (cachedAnalysis) {
      logger.info('Using cached analysis', { 
        input,
        confidence: cachedAnalysis.confidence,
        isFactual: cachedAnalysis.isFactual,
        matches: cachedAnalysis.matches
      });
      return cachedAnalysis;
    }

    // Normalize input
    const normalizedInput = input.toLowerCase().trim();
    
    // Calculate pattern match score
    let patternScore = 0;
    let matchedPatterns = [];
    let totalWeight = 0;

    // Log pattern categories and weights
    logger.debug('Pattern categories', {
      categories: Object.keys(patternCategories),
      timestamp: new Date().toISOString()
    });

    // Check each category
    for (const [category, { weight, patterns }] of Object.entries(patternCategories)) {
      logger.debug(`Checking category: ${category}`, {
        weight,
        patternCount: patterns.length,
        timestamp: new Date().toISOString()
      });

      for (const pattern of patterns) {
        if (pattern.test(normalizedInput)) {
          patternScore += weight;
          totalWeight += weight;
          matchedPatterns.push(`${category}:${pattern.toString()} (weight: ${weight})`);
          logger.info('Pattern match found', {
            category,
            pattern: pattern.toString(),
            weight,
            currentScore: patternScore,
            totalWeight,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Check for shelter keywords
    logger.debug('Checking shelter keywords', {
      keywordCount: shelterKeywords.length,
      timestamp: new Date().toISOString()
    });

    for (const { word, weight } of shelterKeywords) {
      if (normalizedInput.includes(word)) {
        patternScore += weight;
        totalWeight += weight;
        matchedPatterns.push(`keyword:${word} (weight: ${weight})`);
        logger.info('Keyword match found', {
          word,
          weight,
          currentScore: patternScore,
          totalWeight,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Calculate confidence score
    // Pattern scores can be high (15-20 for complex queries), so normalize appropriately
    const confidence = patternScore > 0 ? Math.min(patternScore / 20, 1.0) : 0;

    // Determine if query is factual - use a lower threshold since we're normalizing differently
    const isFactual = confidence >= 0.1;

    // Log final analysis
    logger.info('Query analysis complete', {
      input,
      confidence,
      isFactual,
      patternScore,
      totalWeight,
      matchedPatterns,
      timestamp: new Date().toISOString()
    });

    const analysis = {
      isFactual,
      confidence,
      matches: {
        patterns: matchedPatterns,
        score: patternScore,
        totalWeight
      }
    };

    // Cache the analysis
    this.setCachedAnalysis(input, analysis);

    return analysis;
  }

  static isFactualQuery(input) {
    const analysis = this.analyzeQuery(input);
    return analysis.isFactual;
  }

  static updateRoutingStats(confidence, source, success, fallback = false, responseTime = 0) {
    this.routingStats.totalRequests++;

    // Update confidence-based stats
    if (confidence >= 0.7) {
      this.routingStats.byConfidence.high.count++;
      if (success) {
        this.routingStats.byConfidence.high.success++;
        if (fallback) {
          this.routingStats.byConfidence.high.fallback++;
        }
      }
    } else if (confidence >= 0.4) {
      this.routingStats.byConfidence.medium.count++;
      if (success) {
        this.routingStats.byConfidence.medium.success++;
        if (fallback) {
          this.routingStats.byConfidence.medium.fallback++;
        }
      }
    } else if (confidence >= 0.3) {
      this.routingStats.byConfidence.low.count++;
      if (success) {
        this.routingStats.byConfidence.low.success++;
        if (fallback) {
          this.routingStats.byConfidence.low.fallback++;
        }
      }
    } else {
      this.routingStats.byConfidence.nonFactual.count++;
    }

    // Update source-based stats
    if (source) {
      this.routingStats.bySource[source].count++;
      if (success) {
        this.routingStats.bySource[source].success++;
      }
    }

    // Update response times
    if (responseTime > 0) {
      this.routingStats.responseTimes[source].push(responseTime);
      
      // Keep only the last 100 response times
      if (this.routingStats.responseTimes[source].length > 100) {
        this.routingStats.responseTimes[source].shift();
      }
    }

    // Log routing stats periodically
    if (this.routingStats.totalRequests % 10 === 0) {
      this.logRoutingPerformance();
    }
  }

  static logRoutingPerformance() {
    const stats = this.routingStats;
    
    // Calculate success rates
    const successRates = {
      high: stats.byConfidence.high.count ? 
        (stats.byConfidence.high.success / stats.byConfidence.high.count * 100).toFixed(2) : 0,
      medium: stats.byConfidence.medium.count ? 
        (stats.byConfidence.medium.success / stats.byConfidence.medium.count * 100).toFixed(2) : 0,
      low: stats.byConfidence.low.count ? 
        (stats.byConfidence.low.success / stats.byConfidence.low.count * 100).toFixed(2) : 0
    };

    // Calculate average response times
    const avgResponseTimes = {
      tavily: this.calculateAverageResponseTime(stats.responseTimes.tavily),
      gpt: this.calculateAverageResponseTime(stats.responseTimes.gpt),
      hybrid: this.calculateAverageResponseTime(stats.responseTimes.hybrid)
    };

    logger.info('Routing Performance Metrics', {
      totalRequests: stats.totalRequests,
      confidenceBreakdown: {
        high: {
          count: stats.byConfidence.high.count,
          successRate: `${successRates.high}%`,
          fallbackRate: stats.byConfidence.high.count ? 
            (stats.byConfidence.high.fallback / stats.byConfidence.high.count * 100).toFixed(2) + '%' : '0%'
        },
        medium: {
          count: stats.byConfidence.medium.count,
          successRate: `${successRates.medium}%`,
          fallbackRate: stats.byConfidence.medium.count ? 
            (stats.byConfidence.medium.fallback / stats.byConfidence.medium.count * 100).toFixed(2) + '%' : '0%'
        },
        low: {
          count: stats.byConfidence.low.count,
          successRate: `${successRates.low}%`,
          fallbackRate: stats.byConfidence.low.count ? 
            (stats.byConfidence.low.fallback / stats.byConfidence.low.count * 100).toFixed(2) + '%' : '0%'
        },
        nonFactual: stats.byConfidence.nonFactual.count
      },
      sourcePerformance: {
        tavily: {
          count: stats.bySource.tavily.count,
          successRate: stats.bySource.tavily.count ? 
            (stats.bySource.tavily.success / stats.bySource.tavily.count * 100).toFixed(2) + '%' : '0%',
          avgResponseTime: `${avgResponseTimes.tavily}ms`
        },
        gpt: {
          count: stats.bySource.gpt.count,
          successRate: stats.bySource.gpt.count ? 
            (stats.bySource.gpt.success / stats.bySource.gpt.count * 100).toFixed(2) + '%' : '0%',
          avgResponseTime: `${avgResponseTimes.gpt}ms`
        },
        hybrid: {
          count: stats.bySource.hybrid.count,
          successRate: stats.bySource.hybrid.count ? 
            (stats.bySource.hybrid.success / stats.bySource.hybrid.count * 100).toFixed(2) + '%' : '0%',
          avgResponseTime: `${avgResponseTimes.hybrid}ms`
        }
      }
    });
  }

  static calculateAverageResponseTime(times) {
    if (!times.length) return 0;
    return (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
  }

  static async getResponse(query, context, requestType = 'web', maxResults = 3, voice = null, callSid = null, detectedLanguage = 'en-US') {
    logger.info('getResponse called:', { query, requestType, voice, callSid });
    
    // Check cache first
    const cacheKey = this.generateCacheKey(query);
    const cachedItem = this.tavilyCache.get(cacheKey);
    
    if (cachedItem && (Date.now() - cachedItem.timestamp) < this.CACHE_TTL) {
      logger.info('Using cached response for query:', { query });
      return cachedItem.response;
    }
    
    // Run intent classification and Tavily query in parallel
    const startTime = Date.now();
    
    try {
      const [intentResult, tavilyResponse] = await Promise.all([
        this.classifyIntent(query),
        callTavilyAPI(query)
      ]);
      
      const responseTime = Date.now() - startTime;
      
      // Update routing stats
      const confidence = intentResult?.confidence || 0;
      const success = !!tavilyResponse;
      this.updateRoutingStats(confidence, 'tavily', success, false, responseTime);
      
      // Log when making a Tavily API call
      logger.info('Calling Tavily API for query:', { query });
      
      // Format the response
      const formattedResponse = this.formatTavilyResponse(tavilyResponse, requestType, query, maxResults, context, voice);
      
      // Cache the response
      this.cacheResponse(cacheKey, formattedResponse);
      
      return formattedResponse;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const confidence = 0;
      this.updateRoutingStats(confidence, 'tavily', false, true, responseTime);
      
      logger.error('Error in getResponse:', { error: error.message, query });
      throw error;
    }
  }

  static formatTavilyResponse(tavilyResponse, requestType = 'web', userQuery = '', maxResults = 3, conversationContext = null, voice = null) {
    logger.info('Formatting Tavily response:', { requestType, userQuery, voice });
    // ... existing code ...
  }

  static generateCacheKey(input) {
    return input.toLowerCase().trim();
  }

  static cacheResponse(key, response) {
    // Implement LRU cache
    if (this.tavilyCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.tavilyCache.keys().next().value;
      this.tavilyCache.delete(oldestKey);
    }
    this.tavilyCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  static async generateGPTResponse(input, model, context) {
    const messages = [
      {
        role: 'system',
        content: voiceInstructions
      },
      {
        role: 'user',
        content: input
      }
    ];

    const callOpenAIWithRetry = async function callOpenAI() {
      const response = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: config.DEFAULT_MAX_TOKENS,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });
      return response;
    };

    const response = await callOpenAIWithRetry();
    const text = response.choices[0].message.content;
    return {
      text,
      source: model,
      tokens: response.usage.total_tokens
    };
  }

  static async queryTavily(query) {
    // Use the standardized Tavily API function
    const { callTavilyAPI } = await import('./apis.js');
    
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
      return null;
    }

    const cleanQuery = query.trim();
    logger.info('Querying Tavily API', {
      query: cleanQuery,
      timestamp: new Date().toISOString()
    });

    if (!config.TAVILY_API_KEY) {
      logger.error('Tavily API key not configured');
      return null;
    }

    try {
      // Extract location from query for better search results
      const location = this.extractLocationFromQuery(cleanQuery);
      
      // Use the standardized API call
      const data = await callTavilyAPI(cleanQuery, location);
      
      logger.info('Tavily API response', {
        query: cleanQuery,
        resultCount: data.results?.length || 0,
        hasAnswer: !!data.answer,
        timestamp: new Date().toISOString()
      });

      return data;
    } catch (error) {
      logger.error('Failed to get Tavily response', {
        error: error.message,
        query: cleanQuery,
        stack: error.stack
      });
      return null;
    }
  }

  static isSufficientResponse(tavilyResponse) {
    // Check if Tavily provided results or an answer
    return (tavilyResponse?.results && tavilyResponse.results.length > 0) || 
           (tavilyResponse?.answer && tavilyResponse.answer.length > 0);
  }

  static formatTavilyResponse(tavilyResponse, requestType = 'web', userQuery = '', maxResults = 3, conversationContext = null, ttsVoice = null, enhancedVoiceInstructions = null) {
    if (ttsVoice) {
      logger.info('Formatting response with TTS voice:', { ttsVoice });
    }
    // Always return a defined object for null/undefined input
    if (tavilyResponse == null) {
      return {
        voiceResponse: "I'm sorry, I couldn't find any shelters. Would you like me to search for resources in a different location?",
        smsResponse: "No shelters found in that area. Please try a different location or contact the National Domestic Violence Hotline at 1-800-799-7233.",
        summary: "I'm sorry, I couldn't find any specific resources.",
        shelters: []
      };
    }
    
    // Handle missing or empty results
    if (!tavilyResponse || !tavilyResponse.results || !Array.isArray(tavilyResponse.results) || tavilyResponse.results.length === 0) {
      // Check if there's useful information in the answer field
      if (tavilyResponse && tavilyResponse.answer && tavilyResponse.answer.trim()) {
        const answer = tavilyResponse.answer.trim();
        const phoneMatch = answer.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
        const phone = phoneMatch ? phoneMatch[1] : null;
        const orgMatch = answer.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:'s)?(?:\s+[A-Z][a-z]+)*)\s+(?:provides|operates|offers|supports)/);
        const orgName = orgMatch ? orgMatch[1] : "Women's Crisis Shelter";
        let voiceResponse = `I found ${orgName}: ${answer}`;
        if (phone) {
          voiceResponse += `. You can call them at ${phone}`;
        }
        let smsResponse = phone ? 
          `${answer} Phone: ${phone}` : 
          answer;
        return {
          voiceResponse: voiceResponse || '',
          smsResponse: smsResponse || '',
          summary: answer,
          shelters: [{
            name: orgName,
            phone: phone,
            description: answer,
            score: 0.8, // High score since it came from Tavily's answer
            url: null,
            hasMultipleResources: false,
            allResources: null
          }]
        };
      }
      
      
      // If no answer field or empty answer, return the default no results message
      return {
        voiceResponse: "I'm sorry, I couldn't find any shelters. Would you like me to search for resources in a different location?",
        smsResponse: "No shelters found in that area. Please try a different location or contact the National Domestic Violence Hotline at 1-800-799-7233.",
        summary: "I'm sorry, I couldn't find any specific resources.",
        shelters: []
      };
    }

    // Enhanced filtering for better quality results
    const filteredResults = this.filterRelevantResults(tavilyResponse.results, userQuery);

    // Sort results by score (highest first) and take top results
    const sortedResults = [...filteredResults]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, maxResults);

    // Extract location from user query for context
    const location = this.extractLocationFromQuery(userQuery);

    // Process results with improved title and address extraction
    const processedResults = sortedResults.map(result => {
      // Extract better title from content if original title is poor
      const betterTitle = this.extractBetterTitle(result.content, result.title);
      
      // Extract physical address from content
      const physicalAddress = this.extractPhysicalAddress(result.content);
      
      // Check if content contains multiple resources
      const multipleResources = this.extractMultipleResources(result.content);
      
      return {
        ...result,
        processedTitle: betterTitle,
        physicalAddress: physicalAddress,
        multipleResources: multipleResources,
        hasMultipleResources: multipleResources.length > 1
      };
    });

    // If no results after processing, but there is a useful answer field, return answer-based response
    if (processedResults.length === 0 && tavilyResponse && tavilyResponse.answer && tavilyResponse.answer.trim()) {
      const answer = tavilyResponse.answer.trim();
      const phoneMatch = answer.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
      const phone = phoneMatch ? phoneMatch[1] : null;
      const orgMatch = answer.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:'s)?(?:\s+[A-Z][a-z]+)*)\s+(?:provides|operates|offers|supports)/);
      const orgName = orgMatch ? orgMatch[1] : "Women's Crisis Shelter";
      let voiceResponse = `I found ${orgName}: ${answer}`;
      if (phone) {
        voiceResponse += `. You can call them at ${phone}`;
      }
      let smsResponse = phone ? 
        `${answer} Phone: ${phone}` : 
        answer;
      return {
        voiceResponse: voiceResponse || '',
        smsResponse: smsResponse || '',
        summary: answer,
        shelters: [{
          name: orgName,
          phone: phone,
          description: answer,
          score: 0.8, // High score since it came from Tavily's answer
          url: null,
          hasMultipleResources: false,
          allResources: null
        }]
      };
    }


    // If no results after processing and no answer, return default message
    if (processedResults.length === 0) {
      return {
        voiceResponse: "I'm sorry, I couldn't find any shelters. Would you like me to search for resources in a different location?",
        smsResponse: "No shelters found in that area. Please try a different location or contact the National Domestic Violence Hotline at 1-800-799-7233.",
        summary: "I'm sorry, I couldn't find any specific resources.",
        shelters: []
      };
    }

    // Create voice response with conversation context
    const voiceResponse = this.createVoiceResponse(processedResults, location, conversationContext);
    // Create SMS response with clickable links
    const smsResponse = this.createSMSResponse(processedResults, location, conversationContext);

    // Extract shelter info for web/summary with improved data
    const shelters = processedResults.map(result => {
      // If result has multiple resources, use the first one as primary
      const primaryResource = result.multipleResources.length > 0 ? result.multipleResources[0] : null;
      
      return {
        name: primaryResource ? primaryResource.name : result.processedTitle,
        address: primaryResource ? primaryResource.address : result.physicalAddress,
        phone: primaryResource ? primaryResource.phone : this.extractPhone(result.content),
        description: primaryResource ? primaryResource.description : result.content,
        score: result.score,
        url: result.url,
        hasMultipleResources: result.hasMultipleResources,
        allResources: result.multipleResources.length > 0 ? result.multipleResources : null
      };
    });

    // Compose summary for web with conversation context
    const summary = this.createContextualSummary(shelters, location, conversationContext);

    // Return the processed results
    return {
      voiceResponse: voiceResponse || "I'm sorry, I couldn't find any shelters. Would you like me to search for resources in a different location?",
      smsResponse: smsResponse || "No shelters found in that area. Please try a different location or contact the National Domestic Violence Hotline at 1-800-799-7233.",
      summary: summary || "I'm sorry, I couldn't find any specific resources.",
      shelters: shelters || []
    };
  }

  /**
   * Enhanced filtering to identify relevant domestic violence shelters
   * @param {Array} results - Tavily search results
   * @param {string} userQuery - Original user query for context
   * @returns {Array} Filtered results
   */
  static filterRelevantResults(results, userQuery = '') {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    // Define DV/shelter keywords for robust relevance checking
    const dvKeywords = [
      'domestic', 'violence', 'abuse', 'shelter', 'crisis', 'center', 'safe house',
      'emergency', 'victim', 'survivor', 'support', 'advocacy', 'counseling', 'refuge', 'protection', 'safety', 'escape', 'help', 'resources'
    ];

    return results.filter(result => {
      const content = (result.content || '').toLowerCase();
      const title = (result.title || '').toLowerCase();
      const url = (result.url || '').toLowerCase();
      const score = result.score || 0;

      // Debug logging
      logger.debug('Filtering result:', {
        title: result.title,
        score,
        hasContent: !!content,
        hasUrl: !!url
      });

      // Increase score threshold for better quality results
      if (score < 0.01) {
        logger.debug('Filtered out due to low score:', { score, title: result.title });
        return false;
      }

      // Check for DV/shelter relevance in title or content
      const isRelevant = dvKeywords.some(kw => title.includes(kw) || content.includes(kw));
      
      // Special case: government domains and city pages might have relevant info even without DV keywords
      const isGovernmentDomain = url.includes('.gov') || url.includes('city.') || url.includes('county.') || url.includes('state.');
      const isGovernmentOrCityPage = title.includes('city') || title.includes('commission') || title.includes('government') || title.includes('municipal');
      
      if (!isRelevant && !isGovernmentDomain && !isGovernmentOrCityPage) {
        logger.debug('Filtered out due to no DV keywords and not government/city page', { title: result.title });
        return false;
      }

      // Exclude generic resource guides and city pages
      const isGenericResource = GENERIC_RESOURCE_PATTERNS.some(pattern => 
        title.includes(pattern) || content.includes(pattern)
      );
      const isCityPage = CITY_PAGE_PATTERNS.some(pattern => 
        title.includes(pattern) || content.includes(pattern)
      );
      const isExcludedDomain = EXCLUDED_DOMAINS.some(domain => 
        url.includes(domain)
      );

      // Exclude results with "Not available" for both phone and address (directory pages)
      const hasNoContactInfo = (result.phone === 'Not available' || result.phone === '') && 
                              (result.address === 'Not available' || result.address === '');

      // More intelligent filtering: check if this looks like a directory page vs. specific shelter
      const isDirectoryPage = this.isDirectoryPage(title, content, url);

      logger.debug('Filter checks:', {
        title: result.title,
        isGenericResource,
        isCityPage,
        isExcludedDomain,
        hasNoContactInfo,
        isDirectoryPage
      });

      // Allow city pages if they're not generic resources and not directory pages
      const shouldInclude = !isGenericResource && !isExcludedDomain && !hasNoContactInfo && !isDirectoryPage;
      logger.debug('Final decision:', { 
        title: result.title,
        decision: shouldInclude ? 'INCLUDE' : 'EXCLUDE' 
      });
      
      return shouldInclude;
    });
  }

  /**
   * Check if a result looks like a directory page rather than a specific shelter
   * @param {string} title - The title to check
   * @param {string} content - The content to check
   * @param {string} url - The URL to check
   * @returns {boolean} True if this looks like a directory page
   */
  static isDirectoryPage(title, content, url) {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // Check for directory page indicators
    const directoryIndicators = [
      // Generic directory patterns
      'domestic violence programs',
      'domestic violence help',
      'domestic violence resources',
      'domestic violence services',
      'domestic violence assistance',
      'domestic violence support',
      'domestic violence information',
      'domestic violence directory',
      'domestic violence guide',
      'domestic violence listings',
      'domestic violence finder',
      'domestic violence search',
      'domestic violence database',
      'domestic violence network',
      'domestic violence organizations',
      'domestic violence agencies',
      'domestic violence providers',
      'domestic violence centers',
      'domestic violence shelters and programs',
      'domestic violence help, programs',
      'domestic violence programs and services',
      'domestic violence assistance programs',
      'domestic violence support programs',
      'domestic violence crisis programs',
      'domestic violence intervention programs',
      'domestic violence prevention programs',
      'domestic violence advocacy programs',
      'domestic violence counseling programs',
      'domestic violence hotline programs',
      'domestic violence emergency programs',
      'domestic violence victim programs',
      'domestic violence survivor programs',
      'domestic violence refuge programs',
      'domestic violence housing programs',
      'domestic violence protection programs',
      'domestic violence safety programs',
      'domestic violence escape programs',
      'domestic violence help programs',
      'domestic violence resource programs'
    ];

    // Check if title matches directory patterns
    const matchesDirectoryPattern = directoryIndicators.some(pattern => 
      lowerTitle.includes(pattern)
    );

    // Check for directory page content indicators
    const hasDirectoryContent = lowerContent.includes('domestic violence shelters and programs') ||
                               lowerContent.includes('domestic violence help, programs') ||
                               lowerContent.includes('domestic violence programs and services') ||
                               lowerContent.includes('domestic violence assistance programs') ||
                               lowerContent.includes('domestic violence support programs') ||
                               lowerContent.includes('domestic violence crisis programs') ||
                               lowerContent.includes('domestic violence intervention programs') ||
                               lowerContent.includes('domestic violence prevention programs') ||
                               lowerContent.includes('domestic violence advocacy programs') ||
                               lowerContent.includes('domestic violence counseling programs') ||
                               lowerContent.includes('domestic violence hotline programs') ||
                               lowerContent.includes('domestic violence emergency programs') ||
                               lowerContent.includes('domestic violence victim programs') ||
                               lowerContent.includes('domestic violence survivor programs') ||
                               lowerContent.includes('domestic violence refuge programs') ||
                               lowerContent.includes('domestic violence housing programs') ||
                               lowerContent.includes('domestic violence protection programs') ||
                               lowerContent.includes('domestic violence safety programs') ||
                               lowerContent.includes('domestic violence escape programs') ||
                               lowerContent.includes('domestic violence help programs') ||
                               lowerContent.includes('domestic violence resource programs');

    // Check for directory page URL patterns
    const hasDirectoryUrl = lowerUrl.includes('domesticshelters.org') ||
                           lowerUrl.includes('help/') ||
                           lowerUrl.includes('search?q=') ||
                           lowerUrl.includes('directory') ||
                           lowerUrl.includes('listings') ||
                           lowerUrl.includes('find') ||
                           lowerUrl.includes('search');

    return matchesDirectoryPattern || hasDirectoryContent || hasDirectoryUrl;
  }

  /**
   * Check if content has specific domestic violence content
   * @param {string} content - Content to check
   * @param {string} title - Title to check
   * @returns {boolean} True if has specific DV content
   */
  static hasSpecificDVContent(content, title) {
    const specificDVTerms = [
      'domestic violence shelter',
      'domestic violence safe house',
      'domestic violence crisis center',
      'domestic violence services',
      'domestic violence program',
      'domestic violence assistance',
      'domestic violence support',
      'domestic violence advocacy',
      'domestic violence counseling',
      'domestic violence hotline',
      'domestic violence emergency',
      'domestic violence victim',
      'domestic violence survivor',
      'domestic violence refuge',
      'domestic violence housing',
      'domestic violence protection',
      'domestic violence safety',
      'domestic violence escape',
      'domestic violence help',
      'domestic violence resources'
    ];

    return specificDVTerms.some(term => 
      content.includes(term) || title.includes(term)
    );
  }

  static extractLocationFromQuery(query) {
    if (!query) return '';
    const locationPatterns = [
      /in\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /near\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /around\s+([^,.]+(?:,\s*[^,.]+)?)/i,
      /at\s+([^,.]+(?:,\s*[^,.]+)?)/i
    ];
    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  }

  static createVoiceResponse(results, location, conversationContext = null) {
    const locationText = location ? ` in ${location}` : '';
    
    // Add conversation context to make responses more personal
    let contextPrefix = '';
    if (conversationContext) {
      if (conversationContext.lastIntent && conversationContext.lastIntent !== 'find_shelter') {
        contextPrefix = `Based on your previous request for ${conversationContext.lastIntent.replace('_', ' ')}, `;
      } else if (conversationContext.history && conversationContext.history.length > 1) {
        contextPrefix = 'Continuing from our conversation, ';
      }
    }
    
    if (results.length === 0) {
      return `${contextPrefix}I'm sorry, I couldn't find any shelters${locationText}. I understand this can be frustrating, and I want to help. Would you like me to search for resources in a different location, or would you prefer to call the National Domestic Violence Hotline at 1-800-799-7233 for immediate assistance?`;
    }

    let voiceResponse = `${contextPrefix}I found ${results.length} shelter${results.length > 1 ? 's' : ''}${locationText}: `;
    
    results.forEach((result, index) => {
      const title = this.cleanTitleForVoice(result.processedTitle || result.title);
      const phone = this.extractPhone(result.content);
      
      voiceResponse += `${index + 1}. ${title}`;
      if (phone) {
        voiceResponse += `. Phone number: ${phone}`;
      }
      if (result.physicalAddress) {
        voiceResponse += `. Address: ${result.physicalAddress}`;
      }
      voiceResponse += '. ';
    });

    voiceResponse += 'Would you like me to send you the complete details via text message?';
    return voiceResponse;
  }

  static createSMSResponse(results, location, conversationContext = null) {
    const locationText = location ? ` in ${location}` : '';
    let smsResponse = `Shelters${locationText}:\n\n`;
    
    // Add conversation context reference
    if (conversationContext && conversationContext.lastQuery) {
      smsResponse += `Following up on: "${conversationContext.lastQuery}"\n\n`;
    }
    
    results.forEach((result, index) => {
      const title = this.cleanTitleForSMS(result.processedTitle || result.title);
      const phone = this.extractPhone(result.content);
      const address = result.physicalAddress || 'Address not available';
      
      smsResponse += `${index + 1}. ${title}\n`;
      smsResponse += `   📍 ${address}\n`;
      if (phone) {
        smsResponse += `   📞 ${phone}\n`;
      }
      smsResponse += `   🔗 ${result.url}\n\n`;
    });

    smsResponse += 'For immediate help, call the National Domestic Violence Hotline: 1-800-799-7233';
    return smsResponse;
  }

  static cleanTitleForVoice(title) {
    if (!title) return 'Unknown Organization';
    let cleanTitle = title
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^THE BEST \d+ /i, '')
      .replace(/^Best \d+ /i, '')
      .replace(/^Best /i, '')
      .replace(/\s*-\s*Yelp$/i, '')
      .replace(/\s*-\s*The Real Yellow.*$/i, '')
      .replace(/\s*-\s*.*$/i, '')
      .replace(/\s*,\s*[A-Z]{2}$/i, '')
      .replace(/\s*in\s+[^,]+(?:,\s*[A-Z]{2})?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanTitle.length > 80) {
      cleanTitle = cleanTitle.substring(0, 77) + '...';
    }
    return cleanTitle || 'Unknown Organization';
  }

  static cleanTitleForSMS(title) {
    if (!title) return '';
    
    // Handle filename-style titles
    if (/\.(txt|pdf|doc|html?)$/i.test(title)) {
      // Try to extract meaningful name from filename
      const nameMatch = title.match(/^([a-z-]+)/i);
      if (nameMatch) {
        const extracted = nameMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (extracted.length > 3) {
          return extracted;
        }
      }
    }
    
    // Handle all-lowercase or all-uppercase titles
    if (/^[a-z-]+$/i.test(title)) {
      const cleaned = title.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (cleaned.length > 3) {
        return cleaned;
      }
    }
    
    // Remove common site/branding suffixes and focus on the main DV/shelter part
    let cleaned = title.replace(/\s*-\s*THE BEST.*$/i, '')
      .replace(/\s*-\s*Yelp.*$/i, '')
      .replace(/\s*-\s*Homeless Shelters.*$/i, '')
      .replace(/\s*-\s*Directory.*$/i, '')
      .replace(/\s*-\s*Services.*$/i, '')
      .replace(/\s*-\s*Resource Center.*$/i, '')
      .replace(/\s*-\s*Coalition.*$/i, '')
      .replace(/\s*-\s*Program.*$/i, '')
      .replace(/\s*-\s*Support.*$/i, '')
      .replace(/\s*-\s*Help.*$/i, '')
      .replace(/\s*-\s*Hotline.*$/i, '')
      .replace(/\s*-\s*\d{4,}.*$/i, '')
      .replace(/\s*\|\s*.*$/i, '')
      .replace(/\s*\(.*\)\s*$/, '')
      .trim();
    
    // If the cleaned title is empty, fallback to the original
    if (!cleaned) cleaned = title;
    
    // Capitalize properly
    cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
    
    return cleaned;
  }

  static extractPhone(content) {
    if (!content) return 'Not available';
    
    // Multiple phone number patterns
    const phonePatterns = [
      // Standard US format: (123) 456-7890
      /\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/,
      // International format: +1-123-456-7890
      /\+1[-.\s]?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/,
      // Toll-free: 1-800-123-4567
      /1[-.\s]?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/,
      // Simple format: 123-456-7890
      /(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/
    ];
    
    // Look for "Phone:" or "Call:" prefixes first
    const phonePrefixPatterns = [
      /Phone:\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/i,
      /Call:\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/i,
      /Contact:\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/i,
      /Tel:\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/i
    ];
    
    // Try prefix patterns first (more specific)
    for (const pattern of phonePrefixPatterns) {
      const match = content.match(pattern);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
    
    // Try general patterns
    for (const pattern of phonePatterns) {
      const match = content.match(pattern);
      if (match) {
        // Handle different group counts
        if (match.length === 4) {
          return `${match[1]}-${match[2]}-${match[3]}`;
        } else if (match.length === 3) {
          return `${match[1]}-${match[2]}-${match[3]}`;
        }
      }
    }
    
    return 'Not available';
  }

  static shouldUseGPT4(input, context) {
    // Use GPT-4 for complex queries or follow-ups
    return (
      context.isFollowUp ||
      input.length > 100 ||
      input.includes('?') ||
      this.isComplexQuery(input)
    );
  }

  static isComplexQuery(input) {
    // Add logic to detect complex queries
    const complexPatterns = [
      /explain/i,
      /how does/i,
      /why does/i,
      /compare/i,
      /difference between/i
    ];
    return complexPatterns.some(pattern => pattern.test(input));
  }

  static isDetailRequest(input) {
    const detailPatterns = [
      /tell me more about/i,
      /more details/i,
      /more information/i,
      /what are the services/i,
      /what are their hours/i,
      /do they accept/i,
      /how do I contact/i,
      /what's their address/i,
      /what's their phone/i
    ];
    return detailPatterns.some(pattern => pattern.test(input));
  }

  static async getDetailedResponse(input, context) {
    const cacheKey = context.lastShelterSearch?.cacheKey;
    if (cacheKey) {
      const cachedResults = this.getCachedAnalysis(cacheKey);
      if (cachedResults) {
        const shelterNumber = input.match(/shelter (\d+)/i)?.[1];
        if (shelterNumber) {
          const index = parseInt(shelterNumber) - 1;
          if (index >= 0 && index < cachedResults.shelters.length) {
            const shelter = cachedResults.shelters[index];
            
            // Format based on request type
            if (context.requestType === 'phone') {
              return {
                text: `Here's what I found for ${shelter.name}:\n\n` +
                      `Phone: ${shelter.phone}\n` +
                      `Services: ${shelter.services}`,
                source: 'tavily',
                model: 'tavily',
                inputTokens: 0,
                outputTokens: 0,
                whisperUsed: false,
                shelter
              };
            } else {
              return {
                text: `Here are the details for ${shelter.name}:\n\n` +
                      `Address: ${shelter.address}\n` +
                      `Phone: ${shelter.phone}\n` +
                      `Services: ${shelter.services}\n` +
                      `Description: ${shelter.description}`,
                source: 'tavily',
                model: 'tavily',
                inputTokens: 0,
                outputTokens: 0,
                whisperUsed: false,
                shelter
              };
            }
          }
        }
      }
    }
    return null;
  }

  static getFactualPatterns(input) {
    const normalizedInput = input.toLowerCase().trim();
    const patterns = [];

    // Add pattern matches with their categories and weights
    for (const [category, { weight, patterns: categoryPatterns }] of Object.entries({
      location: {
        weight: 2.0,
        patterns: [
          /where (?:is|are|can I find)/i,
          /find (?:a|an|the|some|any)/i,
          /locate (?:a|an|the|some|any)/i,
          /search for/i,
          /look for/i,
          /nearest/i,
          /closest/i,
          /near(?:by| me)?/i
        ]
      },
      information: {
        weight: 1.5,
        patterns: [
          /what (?:is|are)/i,
          /when (?:is|are)/i,
          /how (?:to|do|can)/i,
          /tell me about/i,
          /information about/i,
          /details about/i
        ]
      },
      resource: {
        weight: 2.0,
        patterns: [
          /help (?:with|for|me|finding|locating|searching|a|an|the|some|any)/i,
          /need (?:help|assistance|support)/i,
          /looking for (?:help|assistance|support)/i,
          /resources (?:for|about)/i,
          /services (?:for|about)/i
        ]
      },
      shelter: {
        weight: 2.5,
        patterns: [
          /shelter(?:s)? (?:near|in|around|close to)/i,
          /domestic violence (?:shelter|resource|help|support)/i,
          /safe (?:place|house|shelter)/i,
          /emergency (?:shelter|housing|accommodation)/i,
          /temporary (?:housing|shelter|accommodation)/i
        ]
      },
      contact: {
        weight: 1.2,
        patterns: [
          /contact (?:information|details|number|phone)/i,
          /phone (?:number|contact)/i,
          /address (?:of|for)/i,
          /how to (?:contact|reach|call)/i
        ]
      },
      general: {
        weight: 1.0,
        patterns: [
          /find/i,
          /search/i,
          /locate/i,
          /where/i,
          /what/i,
          /when/i,
          /how/i
        ]
      }
    })) {
      for (const pattern of categoryPatterns) {
        if (pattern.test(normalizedInput)) {
          patterns.push({
            category,
            pattern: pattern.toString(),
            weight,
            matched: true
          });
        }
      }
    }

    // Add keyword matches
    const shelterKeywords = [
      { word: 'shelter', weight: 2.0 },
      { word: 'domestic violence', weight: 2.5 },
      { word: 'safe house', weight: 2.0 },
      { word: 'emergency housing', weight: 1.8 },
      { word: 'temporary housing', weight: 1.8 },
      { word: 'refuge', weight: 1.5 },
      { word: 'sanctuary', weight: 1.5 },
      { word: 'haven', weight: 1.5 }
    ];

    for (const { word, weight } of shelterKeywords) {
      if (normalizedInput.includes(word.toLowerCase())) {
        patterns.push({
          category: 'keyword',
          pattern: word,
          weight,
          matched: true
        });
      }
    }

    return patterns
      .filter(p => p.matched)
      .map(p => `${p.category}:${p.pattern} (weight: ${p.weight})`);
  }

  static async searchWithTavily(query) {
    try {
      logger.info('Searching with Tavily:', { query });
      
      // Use the standardized Tavily API function
      const { callTavilyAPI } = await import('./apis.js');
      
      // Extract location from query for better search results
      const location = this.extractLocationFromQuery(query);
      
      // Use the standardized API call
      const data = await callTavilyAPI(query, location);
      
      // Filter and validate results
      const validResults = data.results.filter(result => {
        const content = (result.content || '').toLowerCase();
        const title = (result.title || '').toLowerCase();
        const url = (result.url || '').toLowerCase();
        
        // Exclude domains that are not relevant
        const excludedDomains = [
          'yelp.com',
          'maddiesfund.org',
          'facebook.com',
          'instagram.com',
          'twitter.com',
          'linkedin.com',
          'pinterest.com',
          'tiktok.com',
          'youtube.com',
          'reddit.com',
          'tripadvisor.com',
          'zillow.com',
          'realtor.com',
          'trulia.com',
          'hotels.com',
          'booking.com',
          'airbnb.com',
          'vrbo.com',
          'expedia.com',
          'orbitz.com',
          'priceline.com',
          'hotwire.com',
          'kayak.com',
          'cheaptickets.com',
          'travelocity.com'
        ];
        
        // Check if URL contains any excluded domains
        const isExcludedDomain = excludedDomains.some(domain => url.includes(domain));
        if (isExcludedDomain) {
          return false;
        }
        
        // Primary keywords that must be present
        const primaryKeywords = [
          'domestic violence',
          'abuse',
          'victim',
          'survivor',
          'family violence',
          'intimate partner violence'
        ];
        
        // Secondary keywords that should be present
        const secondaryKeywords = [
          'shelter',
          'safe house',
          'emergency housing',
          'crisis center',
          'support services',
          // Pet-friendly terms
          'pet-friendly',
          'pet friendly',
          'allows pets',
          'accepts pets',
          // Child-friendly terms
          'child-friendly',
          'child friendly',
          'kid-friendly',
          'kid friendly',
          'allows children',
          'accepts children',
          'family shelter',
          'children welcome',
          'kids welcome',
          'family housing',
          'family services',
          'children\'s services',
          'kids\' services',
          'family support',
          'child care',
          'childcare',
          'daycare',
          'children\'s programs',
          'kids\' programs'
        ];
        
        // Keywords that indicate irrelevant content
        const irrelevantKeywords = [
          'animal shelter',
          'pet shelter',
          'dog shelter',
          'cat shelter',
          'wildlife',
          'veterinary',
          'animal control',
          'animal rescue',
          'daycare center',
          'childcare center',
          'preschool',
          'kindergarten',
          'school',
          'education center',
          'homeless shelter',
          'homeless housing',
          'homeless services',
          'homeless program',
          'homeless assistance',
          'homeless support',
          'homeless center',
          'homeless facility',
          'homeless shelter',
          'homeless housing',
          'homeless program',
          'homeless assistance',
          'homeless support',
          'homeless center',
          'homeless facility'
        ];
        
        // Must contain at least one primary keyword
        const hasPrimaryKeyword = primaryKeywords.some(keyword => 
          content.includes(keyword) || title.includes(keyword) || url.includes(keyword)
        );
        
        // Must contain at least one secondary keyword
        const hasSecondaryKeyword = secondaryKeywords.some(keyword => 
          content.includes(keyword) || title.includes(keyword) || url.includes(keyword)
        );
        
        // Must not contain any irrelevant keywords unless it's specifically about family-friendly or pet-friendly domestic violence shelters
        const hasIrrelevantKeyword = irrelevantKeywords.some(keyword => 
          (content.includes(keyword) || title.includes(keyword) || url.includes(keyword)) &&
          !content.includes('domestic violence') && !title.includes('domestic violence')
        );
        
        // Check if it's specifically about family-friendly or pet-friendly domestic violence shelters
        const isFamilyOrPetFriendlyDV = (
          ((content.includes('pet') || title.includes('pet') || 
            content.includes('child') || title.includes('child') ||
            content.includes('kid') || title.includes('kid') ||
            content.includes('family') || title.includes('family')) &&
          (content.includes('domestic violence') || title.includes('domestic violence')))
        );

        // Additional check for homeless shelter content
        const isHomelessShelter = content.includes('homeless') || title.includes('homeless') || url.includes('homeless');
        
        return hasPrimaryKeyword && 
               hasSecondaryKeyword && 
               (!hasIrrelevantKeyword || isFamilyOrPetFriendlyDV) &&
               !isHomelessShelter;
      });

      if (validResults.length === 0) {
        logger.warn('No valid shelter results found for query:', query);
        return {
          text: "I apologize, but I couldn't find specific information about domestic violence shelters in that area. Would you like me to help you find general domestic violence resources instead?",
          confidence: 'low'
        };
      }

      // Sort results by relevance score
      validResults.sort((a, b) => b.score - a.score);

      // Format the response
      const formattedResponse = this.formatShelterResponse(validResults);
      
      return {
        text: formattedResponse,
        confidence: 'high'
      };
    } catch (error) {
      logger.error('Error in Tavily search:', error);
      throw error;
    }
  }

  static formatShelterResponse(results) {
    try {
      const topResults = results.slice(0, 3);
      let response = "I found some domestic violence shelters and resources that might help:\n\n";
      
      topResults.forEach((result, index) => {
        const title = result.title.replace(/[^\w\s-]/g, '');
        // Get first meaningful sentence that contains relevant information
        const sentences = result.content.split(/[.!?]+/);
        const relevantSentence = sentences.find(sentence => {
          const lowerSentence = sentence.toLowerCase();
          return (
            lowerSentence.includes('domestic violence') ||
            lowerSentence.includes('shelter') ||
            lowerSentence.includes('safe') ||
            lowerSentence.includes('support') ||
            lowerSentence.includes('family') ||
            lowerSentence.includes('child') ||
            lowerSentence.includes('pet')
          );
        }) || sentences[0];
        
        response += `${index + 1}. ${title}\n`;
        response += `${relevantSentence.trim()}.\n\n`;
      });
      
      response += "Would you like more specific information about any of these resources?";
      
      return response;
    } catch (error) {
      logger.error('Error formatting shelter response:', error);
      return "I found some resources, but I'm having trouble formatting them. Would you like me to try searching again?";
    }
  }

  static resetRoutingStats() {
    this.routingStats = {
      totalRequests: 0,
      byConfidence: {
        high: { count: 0, success: 0, fallback: 0 },
        medium: { count: 0, success: 0, fallback: 0 },
        low: { count: 0, success: 0, fallback: 0 },
        nonFactual: { count: 0 }
      },
      bySource: {
        tavily: { count: 0, success: 0 },
        gpt: { count: 0, success: 0 },
        hybrid: { count: 0, success: 0 }
      },
      responseTimes: {
        tavily: [],
        gpt: [],
        hybrid: []
      }
    };
  }

  static getRoutingStats() {
    return this.routingStats;
  }

  /**
   * Format Tavily response with custom structure and filtering options
   * @param {Object} tavilyResponse - Raw Tavily API response
   * @param {string} format - Format type: 'simple', 'detailed', 'minimal', 'custom'
   * @param {Object} options - Formatting options
   * @returns {Object} Formatted response
   */
  static formatTavilyResponseCustom(tavilyResponse, format = 'simple', options = {}) {
    try {
      // Handle null/undefined responses
      if (!tavilyResponse || !tavilyResponse.results) {
        return this.getEmptyResponse(format);
      }

      // Apply filtering
      const filteredResults = this.filterRelevantResults(tavilyResponse.results, options.query || '');
      
      // Apply score threshold if specified
      const minScore = options.minScore || 0.7;
      const scoreFilteredResults = filteredResults.filter(result => 
        result.score && result.score >= minScore
      );

      // Apply max results limit if specified
      const maxResults = options.maxResults || 3;
      const limitedResults = scoreFilteredResults.slice(0, maxResults);

      // Format based on type
      switch (format) {
        case 'simple':
          return this.formatSimpleResponse(limitedResults, options);
        case 'detailed':
          return this.formatDetailedResponse(limitedResults, options);
        case 'minimal':
          return this.formatMinimalResponse(limitedResults, options);
        case 'custom':
          return this.formatCustomResponse(limitedResults, options);
        default:
          return this.formatSimpleResponse(limitedResults, options);
      }
    } catch (error) {
      logger.error('Error in formatTavilyResponseCustom:', error);
      return this.getEmptyResponse(format);
    }
  }

  /**
   * Format response in simple structure
   */
  static formatSimpleResponse(results, options = {}) {
    const shelters = results.map(result => ({
      name: result.title,
      url: result.url,
      phone: this.extractPhone(result.content) || 'Not available',
      relevance: Math.round((result.score || 0) * 100)
    }));

    return {
      success: shelters.length > 0,
      message: shelters.length > 0 ? `Found ${shelters.length} shelters` : 'No shelters found in that area.',
      count: shelters.length,
      data: shelters,
      timestamp: new Date().toISOString(),
      query: options.query || '',
      location: options.location || ''
    };
  }

  /**
   * Format response in detailed structure
   */
  static formatDetailedResponse(results, options = {}) {
    const shelters = results.map(result => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
      relevance: Math.round((result.score || 0) * 100),
      phone: this.extractPhone(result.content) || 'Not available',
      cleanName: this.cleanTitleForVoice(result.title),
      metadata: {
        hasPhone: this.extractPhone(result.content) !== 'Not available',
        contentLength: result.content ? result.content.length : 0,
        isHighRelevance: (result.score || 0) >= 0.8
      }
    }));

    return {
      success: shelters.length > 0,
      message: shelters.length > 0 ? `Found ${shelters.length} shelters` : 'No shelters found in that area.',
      count: shelters.length,
      results: shelters,
      metadata: {
        query: options.query || '',
        location: options.location || '',
        searchDepth: options.searchDepth || 'basic',
        minScore: options.minScore || 0.7,
        maxResults: options.maxResults || 3,
        totalResults: results.length,
        filteredResults: shelters.length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format response in minimal structure
   */
  static formatMinimalResponse(results, options = {}) {
    return {
      found: results.length > 0,
      count: results.length,
      shelters: results.map(result => ({
        name: result.title,
        url: result.url
      }))
    };
  }

  /**
   * Format response with custom structure
   */
  static formatCustomResponse(results, options = {}) {
    const customStructure = options.structure || {};
    const response = {};

    // Apply custom structure mapping
    Object.keys(customStructure).forEach(key => {
      const field = customStructure[key];
      
      switch (field) {
        case 'status':
          response[key] = 'success';
          break;
        case 'count':
          response[key] = results.length;
          break;
        case 'resources':
        case 'shelters':
          response[key] = results.map(result => {
            const item = {
              name: result.title,
              url: result.url
            };
            if (options.includeScore || customStructure.includeScore) {
              item.score = result.score;
              item.relevance = Math.round((result.score || 0) * 100);
            }
            if (options.includePhone || customStructure.includePhone) {
              item.phone = this.extractPhone(result.content) || 'Not available';
            }
            if (options.includeContent || customStructure.includeContent) {
              item.description = result.content.substring(0, 200) + '...';
            }
            return item;
          });
          break;
        case 'query':
          response[key] = options.query || '';
          break;
        case 'location':
          response[key] = options.location || '';
          break;
        case 'content':
          response[key] = options.includeContent ? results.map(r => r.content) : undefined;
          break;
        default:
          // Don't add undefined fields to response
          break;
      }
    });

    // Always include required fields
    if (!('status' in response)) {
      response.status = 'success';
    }
    if (!('resources' in response)) {
      response.resources = results.map(result => {
        const item = {
          name: result.title,
          url: result.url,
          phone: this.extractPhone(result.content) || 'Not available',
          relevance: Math.round((result.score || 0) * 100),
          score: result.score
        };
        return item;
      });
    }
    if (!('count' in response)) {
      response.count = results.length;
    }
    if (!('timestamp' in response)) {
      response.timestamp = new Date().toISOString();
    }

    return response;
  }

  /**
   * Get empty response for null/undefined inputs
   */
  static getEmptyResponse(format) {
    switch (format) {
      case 'simple':
        return {
          success: false,
          message: 'No shelters found in that area.',
          count: 0,
          data: [],
          timestamp: new Date().toISOString(),
          query: '',
          location: ''
        };
      case 'detailed':
        return {
          success: false,
          message: 'No shelters found in that area.',
          count: 0,
          results: [],
          metadata: {
            query: '',
            location: '',
            searchDepth: 'basic',
            minScore: 0.7,
            maxResults: 3,
            totalResults: 0,
            filteredResults: 0
          },
          timestamp: new Date().toISOString()
        };
      case 'minimal':
        return {
          found: false,
          count: 0,
          shelters: []
        };
      default:
        return {
          success: false,
          message: 'No shelters found in that area.',
          count: 0,
          data: [],
          timestamp: new Date().toISOString()
        };
    }
  }

  /**
   * Extract meaningful organization names from content when title is poor
   * @param {string} content - The content to extract from
   * @param {string} originalTitle - The original title
   * @returns {string} Better title extracted from content
   */
  static extractBetterTitle(content, originalTitle) {
    if (!content) return originalTitle || 'Unknown Organization';
    
    // If original title is clearly a filename or poor, try to extract from content
    const isPoorTitle = /\.(txt|pdf|doc|html?)$/i.test(originalTitle) || 
                       /^[a-z-]+$/i.test(originalTitle) ||
                       originalTitle.length < 10;
    
    if (!isPoorTitle) {
      return this.cleanTitleForSMS(originalTitle);
    }
    
    // Look for organization names in content
    const contentLines = content.split('\n').filter(line => line.trim().length > 0);
    
    // Pattern 1: Look for bracketed organization names [Organization Name]
    const bracketPattern = /\[([A-Z][A-Za-z\s&]+(?:Center|Shelter|Mission|House|Services|Program|Coalition|Alliance|Network|Foundation|Association|Organization|Refuge|Haven|Sanctuary)[^]]*)\]/;
    for (const line of contentLines) {
      const match = line.match(bracketPattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted.length > 5 && extracted.length < 100) {
          return this.cleanTitleForSMS(extracted);
        }
      }
    }
    
    // Pattern 2: Look for lines that look like organization names
    const orgPatterns = [
      /^([A-Z][A-Za-z\s&]+(?:Center|Shelter|Mission|House|Services|Program|Coalition|Alliance|Network|Foundation|Association|Organization|Refuge|Haven|Sanctuary))/,
      /^([A-Z][A-Za-z\s&]+(?:Women|Family|Community|Crisis|Emergency|Domestic|Violence|Support|Help|Safe|Protection))/,
      /^([A-Z][A-Za-z\s&]+(?:Gospel|Mission|House|Center|Shelter))/
    ];
    
    for (const line of contentLines) {
      for (const pattern of orgPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim();
          if (extracted.length > 5 && extracted.length < 100) {
            return this.cleanTitleForSMS(extracted);
          }
        }
      }
    }
    
    // Pattern 3: Look for lines with addresses that might have organization names
    const addressPattern = /^([A-Z][A-Za-z\s&]+)\s*\n\s*(\d+[^,\n]+(?:,\s*[^,\n]+)*)/;
    for (const line of contentLines) {
      const match = line.match(addressPattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted.length > 5 && extracted.length < 100) {
          return this.cleanTitleForSMS(extracted);
        }
      }
    }
    
    // Pattern 4: Look for phone numbers with organization names
    const phonePattern = /^([A-Z][A-Za-z\s&]+)\s*\n\s*Phone:\s*(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/;
    for (const line of contentLines) {
      const match = line.match(phonePattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted.length > 5 && extracted.length < 100) {
          return this.cleanTitleForSMS(extracted);
        }
      }
    }
    
    // Fallback: return cleaned original title
    return this.cleanTitleForSMS(originalTitle);
  }

  /**
   * Extract physical addresses from content
   * @param {string} content - The content to extract from
   * @returns {string} Physical address or 'Not available'
   */
  static extractPhysicalAddress(content) {
    if (!content) return 'Not available';
    
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Pattern 1: Look for lines starting with numbers (street addresses)
      const streetMatch = line.match(/^(\d+[^,\n]+(?:,\s*[^,\n]+)*)/);
      if (streetMatch) {
        let address = streetMatch[1].trim();
        // Append all consecutive lines that are not phone/fax/email or blank
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          // If next line looks like part of address (contains city, state, zip)
          if (nextLine.match(/[A-Z]{2}\s*\d{5}/) || nextLine.match(/[A-Z][a-z]+,\s*[A-Z]{2}/)) {
            address += ' ' + nextLine;
          } else if (nextLine.match(/^P\.?\s*O\.?\s*Box/i)) {
            // Handle P.O. Box
            address += ' ' + nextLine;
          } else {
            break;
          }
        }
        if (address.length > 10) {
          return address;
        }
      }
      // Pattern 2: Look for "Address:" prefix
      const addressPrefixMatch = line.match(/Address:\s*([^,\n]+(?:,\s*[^,\n]+)*)/i);
      if (addressPrefixMatch) {
        const address = addressPrefixMatch[1].trim();
        if (address.length > 10) {
          return address;
        }
      }
      // Pattern 3: Look for "Located at:" prefix
      const locatedMatch = line.match(/Located at:\s*([^,\n]+(?:,\s*[^,\n]+)*)/i);
      if (locatedMatch) {
        const address = locatedMatch[1].trim();
        if (address.length > 10) {
          return address;
        }
      }
    }
    return 'Not available';
  }

  /**
   * Extract multiple resources from content when it contains lists
   * @param {string} content - The content to extract from
   * @returns {Array} Array of extracted resources
   */
  static extractMultipleResources(content) {
    if (!content) return [];
    
    const resources = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentResource = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for organization name patterns
      const orgPatterns = [
        /^([A-Z][A-Za-z\s&]+(?:Center|Shelter|Mission|House|Services|Program|Coalition|Alliance|Network|Foundation|Association|Organization|Refuge|Haven|Sanctuary))/,
        /^([A-Z][A-Za-z\s&]+(?:Women|Family|Community|Crisis|Emergency|Domestic|Violence|Support|Help|Safe|Protection))/,
        /^([A-Z][A-Za-z\s&]+(?:Gospel|Mission|House|Center|Shelter))/
      ];
      
      let orgMatch = null;
      for (const pattern of orgPatterns) {
        orgMatch = line.match(pattern);
        if (orgMatch) break;
      }
      
      if (orgMatch) {
        // Save previous resource if exists
        if (currentResource && currentResource.name) {
          resources.push(currentResource);
        }
        
        // Start new resource
        currentResource = {
          name: this.cleanTitleForSMS(orgMatch[1]),
          address: 'Not available',
          phone: 'Not available',
          description: ''
        };
      } else if (currentResource) {
        // Look for address (lines starting with numbers)
        const addressMatch = line.match(/^(\d+[^,\n]+(?:,\s*[^,\n]+)*)/);
        if (addressMatch && currentResource.address === 'Not available') {
          let address = addressMatch[1].trim();
          
          // Try to get additional address lines
          for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
            const nextLine = lines[j];
            // If next line looks like part of address (contains city, state, zip)
            if (nextLine.match(/[A-Z]{2}\s*\d{5}/) || nextLine.match(/[A-Z][a-z]+,\s*[A-Z]{2}/)) {
              address += ' ' + nextLine;
            } else if (nextLine.match(/^P\.?\s*O\.?\s*Box/i)) {
              // Handle P.O. Box
              address += ' ' + nextLine;
            } else {
              break;
            }
          }
          
          currentResource.address = address;
        }
        
        // Look for phone
        const phoneMatch = line.match(/Phone:\s*(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/i);
        if (phoneMatch && currentResource.phone === 'Not available') {
          currentResource.phone = phoneMatch[1];
        }
        
        // Add to description (but not if it's just address or phone info)
        if (line.length > 0 && 
            !line.match(/^(Phone|Address|Fax):/i) && 
            !line.match(/^(\d+[^,\n]+(?:,\s*[^,\n]+)*)/) &&
            !line.match(/^P\.?\s*O\.?\s*Box/i)) {
          currentResource.description += (currentResource.description ? ' ' : '') + line;
        }
      }
    }
    
    // Add the last resource
    if (currentResource && currentResource.name) {
      resources.push(currentResource);
    }
    
    return resources;
  }

  static createContextualSummary(shelters, location, conversationContext = null) {
    if (!shelters || shelters.length === 0) {
      return "I'm sorry, I couldn't find any specific resources.";
    }
    
    let summary = `I found ${shelters.length} shelter${shelters.length > 1 ? 's' : ''}${location ? ' in ' + location : ''}:\n`;
    
    // Add conversation context if available
    if (conversationContext) {
      if (conversationContext.lastIntent && conversationContext.lastIntent !== 'find_shelter') {
        summary += `\nBased on your request for ${conversationContext.lastIntent.replace('_', ' ')}:\n`;
      } else if (conversationContext.history && conversationContext.history.length > 1) {
        summary += '\nBuilding on our previous conversation:\n';
      }
    }
    
    shelters.forEach((shelter, index) => {
      summary += `\n${index + 1}. ${shelter.name}`;
      if (shelter.address && shelter.address !== 'Not available') {
        summary += `\n   Address: ${shelter.address}`;
      }
      if (shelter.phone && shelter.phone !== 'Not available') {
        summary += `\n   Phone: ${shelter.phone}`;
      }
      if (shelter.description && shelter.description !== 'Not available') {
        summary += `\n   Description: ${shelter.description.substring(0, 100)}...`;
      }
    });
    
    return summary;
  }

}

// Export the pattern categories and keywords
export { patternCategories, shelterKeywords }; 