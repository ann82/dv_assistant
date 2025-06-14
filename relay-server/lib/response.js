import { config } from './config.js';
import { OpenAI } from 'openai';
import { encode } from 'gpt-tokenizer';
import { patternCategories, shelterKeywords } from './patternConfig.js';
import logger from './logger.js';
import { withRetryAndThrottle } from './apiUtils.js';
import { gptCache } from './queryCache.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

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
    const normalizedInput = input.toLowerCase().trim();
    return gptCache.get(normalizedInput);
  }

  static setCachedAnalysis(input, analysis) {
    const normalizedInput = input.toLowerCase().trim();
    gptCache.set(normalizedInput, analysis, 3600000); // Cache for 1 hour
  }

  static getCacheStats() {
    return gptCache.getStats();
  }

  static analyzeQuery(input) {
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
    const confidence = totalWeight > 0 ? patternScore / totalWeight : 0;

    // Determine if query is factual
    const isFactual = confidence >= 0.3;

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

  static async getResponse(input, context = {}) {
    const startTime = Date.now();
    let response;
    let source = 'unknown';
    let success = false;
    let fallback = false;
    let confidence = 0;
    let matches = [];

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(input);
      const cachedResponse = this.tavilyCache.get(cacheKey);
      if (cachedResponse && Date.now() - cachedResponse.timestamp < this.CACHE_TTL) {
        logger.info('Using cached response', { cacheKey });
        return cachedResponse.response;
      }

      // Run intent classification and Tavily query in parallel
      const [intentResult, tavilyResponse] = await Promise.all([
        this.classifyIntent(input),
        this.queryTavily(input)
      ]);

      confidence = intentResult.confidence;
      matches = intentResult.matches;

      if (confidence >= 0.7) {
        // High confidence - use Tavily directly
        source = 'tavily';
        logger.info('Using Tavily (High Confidence)', { 
          confidence,
          input,
          threshold: 0.7,
          matches
        });
        response = this.formatTavilyResponse(tavilyResponse);
        success = true;
      } else if (confidence >= 0.3) {
        // Low confidence - use GPT with Tavily context
        source = 'gpt';
        logger.info('Using GPT with Context (Low Confidence)', { 
          confidence,
          input,
          threshold: 0.3,
          matches
        });
        const gptContext = {
          tavilyResults: tavilyResponse.results || [],
          tavilyAnswer: tavilyResponse.answer || ''
        };
        response = await this.generateGPTResponse(input, 'gpt-3.5-turbo', gptContext);
        success = true;
      } else {
        // Non-factual - use GPT exclusively
        source = 'gpt';
        logger.info('Using GPT (Non-factual Query)', { 
          confidence,
          input,
          threshold: 0.3,
          matches
        });
        response = await this.generateGPTResponse(input, 'gpt-3.5-turbo', context);
        success = true;
      }

      // Cache the response
      this.cacheResponse(cacheKey, response);

    } catch (error) {
      logger.error('Error generating response', { 
        error: error.message,
        confidence,
        source,
        input,
        matches,
        stack: error.stack
      });
      // Fallback to GPT on error
      source = 'gpt';
      response = await this.generateGPTResponse(input, 'gpt-3.5-turbo', context);
      success = true;
      fallback = true;
      // If confidence is still 0, set to high (simulate high confidence error)
      if (confidence === 0) confidence = 0.8;
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log final response details
    logger.info('Response Generated', {
      confidence,
      source,
      success,
      fallback,
      responseTime,
      input,
      matches,
      response: typeof response === 'string' ? response.substring(0, 100) + '...' : JSON.stringify(response).substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    // Update routing stats
    this.updateRoutingStats(confidence, source, success, fallback, responseTime);

    return response;
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
        content: `You are an AI assistant for domestic violence support. Be kind, empathetic, and non-judgmental. Prioritize the caller's safety and privacy. If you hear keywords like "suicide," "weapons," "kill," "knife," "gun," "children," "can't move," or "killed," immediately stop and ask the caller to call 911 or offer to call 911 on their behalf. Thank the caller for trusting you. Focus on understanding their needs, providing resources, and discussing safety plans. Keep responses concise and focused.`
      },
      {
        role: 'user',
        content: input
      }
    ];

    const callOpenAIWithRetry = withRetryAndThrottle(async function callOpenAI() {
      const response = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: config.DEFAULT_MAX_TOKENS,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3
      });
      return response;
    });

    const response = await callOpenAIWithRetry();
    const text = response.choices[0].message.content;
    return {
      text,
      source: model,
      tokens: response.usage.total_tokens
    };
  }

  static async queryTavily(query) {
    logger.info('Querying Tavily API', {
      query,
      timestamp: new Date().toISOString()
    });

    if (!config.TAVILY_API_KEY) {
      logger.error('Tavily API key not configured');
      return null;
    }

    const callTavilyWithRetry = withRetryAndThrottle(async function callTavily(query) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.TAVILY_API_KEY}`
          },
          body: JSON.stringify({
            query,
            search_depth: 'advanced',
            include_answer: true,
            include_domains: [],
            exclude_domains: []
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('Tavily API error', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            query
          });
          throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        logger.info('Tavily API response', {
          query,
          resultCount: data.results?.length || 0,
          hasAnswer: !!data.answer,
          timestamp: new Date().toISOString()
        });

        return data;
      } catch (error) {
        logger.error('Error calling Tavily API', {
          error: error.message,
          query,
          stack: error.stack
        });
        throw error;
      }
    });

    try {
      return await callTavilyWithRetry(query);
    } catch (error) {
      logger.error('Failed to get Tavily response', {
        error: error.message,
        query,
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

  static formatTavilyResponse(tavilyResponse, requestType = 'web') {
    // Extract shelter information from results
    const shelters = tavilyResponse.results
      .filter(result => 
        result.title.toLowerCase().includes('shelter') || 
        result.content.toLowerCase().includes('shelter') ||
        result.raw_content?.toLowerCase().includes('shelter')
      )
      .map(result => ({
        name: result.title,
        address: result.url,
        phone: this.extractPhone(result.raw_content || result.content),
        description: result.content,
        services: this.extractServices(result.raw_content || result.content)
      }));

    if (shelters.length === 0) {
      return {
        summary: "I couldn't find specific shelter information. Would you like me to search for domestic violence resources in your area instead?",
        fullDetails: "No specific shelters found. Please try a different search query.",
        shelters: []
      };
    }

    // Cache the full shelter details
    const cacheKey = `shelter_search_${Date.now()}`;
    this.setCachedAnalysis(cacheKey, {
      shelters,
      timestamp: Date.now()
    });

    // Format based on request type
    if (requestType === 'phone') {
      const summary = `I found ${shelters.length} shelters. Here are their names:\n\n` + 
        shelters.map((s, i) => 
          `${i + 1}. ${s.name}`
        ).join('\n');

      return {
        summary,
        cacheKey,
        shelters
      };
    } else {
      const summary = `I found ${shelters.length} shelters:\n\n` + 
        shelters.map((s, i) => 
          `${i + 1}. ${s.name}`
        ).join('\n');

      return {
        summary,
        cacheKey,
        shelters
      };
    }
  }

  static extractPhone(content) {
    if (!content) return 'Not available';
    const phoneMatch = content.match(/(?:phone|tel|telephone|call)[:\s]+([\d-()]+)/i);
    return phoneMatch ? phoneMatch[1] : 'Not available';
  }

  static extractServices(content) {
    if (!content) return 'Not specified';
    const servicesMatch = content.match(/(?:services|offers|provides)[:\s]+([^.]+)/i);
    return servicesMatch ? servicesMatch[1].trim() : 'Not specified';
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
      // Enhance the query to focus on domestic violence shelters
      const enhancedQuery = `domestic violence shelter ${query}`;
      
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': config.TAVILY_API_KEY
        },
        body: JSON.stringify({
          query: enhancedQuery,
          search_depth: 'advanced',
          include_domains: [],
          exclude_domains: ['yelp.com', 'maddiesfund.org'], // Exclude irrelevant domains
          max_results: 5
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();
      
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
}

// Export the pattern categories and keywords
export { patternCategories, shelterKeywords }; 