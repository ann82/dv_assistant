import { OpenAI } from 'openai';
import { config } from './config.js';
import logger from './logger.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

/**
 * Enhanced Context Manager for better conversation understanding
 * Features:
 * - Semantic conversation summarization
 * - Context compression and relevance scoring
 * - Multi-turn conversation understanding
 * - Intent progression tracking
 * - Resource recommendation memory
 */
export class EnhancedContextManager {
  constructor() {
    this.contexts = new Map();
    this.summaryCache = new Map();
    this.semanticCache = new Map();
  }

  /**
   * Update conversation context with enhanced understanding
   * @param {string} callSid - Call identifier
   * @param {Object} interaction - Current interaction data
   * @param {Object} options - Additional options
   */
  async updateContext(callSid, interaction, options = {}) {
    const {
      intent,
      query,
      response,
      tavilyResults = null,
      matchedResult = null,
      confidence = 0.5,
      location = null,
      needsLocation = false
    } = interaction;

    // Get or create context
    if (!this.contexts.has(callSid)) {
      this.contexts.set(callSid, {
        history: [],
        summaries: [],
        semanticContext: null,
        intentProgression: [],
        resourceMemory: new Map(),
        locationHistory: [],
        lastUpdate: Date.now(),
        conversationState: 'initial'
      });
    }

    const context = this.contexts.get(callSid);
    
    // Add interaction to history
    const interactionEntry = {
      intent,
      query,
      response,
      timestamp: Date.now(),
      confidence,
      location,
      needsLocation,
      tavilyResults: tavilyResults?.results || null,
      matchedResult
    };

    context.history.push(interactionEntry);
    
    // Keep only last 10 interactions for performance
    if (context.history.length > 10) {
      context.history.shift();
    }

    // Update intent progression
    context.intentProgression.push({
      intent,
      timestamp: Date.now(),
      confidence
    });

    // Update location history
    if (location) {
      context.locationHistory.push({
        location,
        timestamp: Date.now(),
        intent
      });
    }

    // Store resource information in memory
    if (tavilyResults?.results) {
      tavilyResults.results.forEach(result => {
        const key = `${result.title}-${result.url}`;
        if (!context.resourceMemory.has(key)) {
          context.resourceMemory.set(key, {
            title: result.title,
            url: result.url,
            content: result.content,
            firstMentioned: Date.now(),
            mentionCount: 1,
            lastMentioned: Date.now(),
            relevanceScore: result.score || 0.5
          });
        } else {
          const existing = context.resourceMemory.get(key);
          existing.mentionCount++;
          existing.lastMentioned = Date.now();
          existing.relevanceScore = Math.max(existing.relevanceScore, result.score || 0.5);
        }
      });
    }

    // Update conversation state
    context.conversationState = this.determineConversationState(context);
    context.lastUpdate = Date.now();

    // Generate semantic context if needed (every 3 interactions or when state changes)
    if (context.history.length % 3 === 0 || options.forceSummarize) {
      await this.generateSemanticContext(callSid, context);
    }

    logger.info('Enhanced context updated:', {
      callSid,
      historyLength: context.history.length,
      conversationState: context.conversationState,
      resourceCount: context.resourceMemory.size,
      hasSemanticContext: !!context.semanticContext
    });

    return context;
  }

  /**
   * Generate semantic understanding of the conversation
   * @param {string} callSid - Call identifier
   * @param {Object} context - Conversation context
   */
  async generateSemanticContext(callSid, context) {
    try {
      const recentHistory = context.history.slice(-5); // Last 5 interactions
      const historyText = recentHistory.map(h => 
        `User: ${h.query}\nAssistant: ${h.response?.voiceResponse || h.response}\nIntent: ${h.intent}`
      ).join('\n\n');

      const prompt = `Analyze this conversation and provide a semantic summary focusing on:

1. User's primary needs and concerns
2. Key topics discussed
3. Resources or information provided
4. Current conversation state
5. What the user might need next

Conversation:
${historyText}

Provide a concise JSON response with these fields:
{
  "primaryNeeds": ["array of user's main needs"],
  "keyTopics": ["array of main topics discussed"],
  "providedResources": ["array of resources/info provided"],
  "conversationState": "current state (seeking_info, location_needed, resource_found, etc.)",
  "nextLikelyNeeds": ["array of what user might need next"],
  "userSentiment": "positive/neutral/concerned/urgent",
  "locationContext": "any location information mentioned"
}`;

      const response = await openai.chat.completions.create({
        model: config.GPT35_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a conversation analyst for a domestic violence support system. Provide accurate, helpful semantic analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const semanticContext = JSON.parse(response.choices[0].message.content);
      context.semanticContext = semanticContext;
      
      // Cache the semantic context
      this.semanticCache.set(callSid, {
        context: semanticContext,
        timestamp: Date.now()
      });

      logger.info('Semantic context generated:', {
        callSid,
        primaryNeeds: semanticContext.primaryNeeds,
        conversationState: semanticContext.conversationState,
        userSentiment: semanticContext.userSentiment
      });

    } catch (error) {
      logger.error('Error generating semantic context:', error);
      // Fallback to basic context
      context.semanticContext = {
        primaryNeeds: [context.history[context.history.length - 1]?.intent || 'unknown'],
        keyTopics: ['domestic violence support'],
        providedResources: [],
        conversationState: 'basic',
        nextLikelyNeeds: [],
        userSentiment: 'neutral',
        locationContext: context.locationHistory[context.locationHistory.length - 1]?.location || null
      };
    }
  }

  /**
   * Determine conversation state based on context
   * @param {Object} context - Conversation context
   * @returns {string} Conversation state
   */
  determineConversationState(context) {
    const recentIntents = context.intentProgression.slice(-3).map(p => p.intent);
    const lastInteraction = context.history[context.history.length - 1];

    // Check for emergency situations
    if (recentIntents.includes('emergency_help')) {
      return 'emergency';
    }

    // Check for location needs
    if (lastInteraction?.needsLocation) {
      return 'location_needed';
    }

    // Check for resource seeking
    if (recentIntents.includes('find_shelter') || 
        recentIntents.includes('legal_services') || 
        recentIntents.includes('counseling_services')) {
      return 'resource_seeking';
    }

    // Check for follow-up questions
    if (context.history.length > 1) {
      const lastTwo = context.history.slice(-2);
      if (lastTwo[1]?.intent === lastTwo[0]?.intent) {
        return 'follow_up';
      }
    }

    // Check for off-topic
    if (recentIntents.includes('off_topic')) {
      return 'off_topic';
    }

    // Check for conversation end
    if (recentIntents.includes('end_conversation')) {
      return 'ending';
    }

    return 'general_inquiry';
  }

  /**
   * Get enhanced context for follow-up detection
   * @param {string} callSid - Call identifier
   * @param {string} currentQuery - Current user query
   * @returns {Object} Enhanced context for follow-up detection
   */
  async getEnhancedContext(callSid, currentQuery) {
    const context = this.contexts.get(callSid);
    if (!context) return null;

    // Check cache first
    const cached = this.semanticCache.get(callSid);
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
      return {
        ...context,
        semanticContext: cached.context
      };
    }

    // Generate fresh semantic context if needed
    if (!context.semanticContext || Date.now() - context.lastUpdate > 60000) {
      await this.generateSemanticContext(callSid, context);
    }

    return context;
  }

  /**
   * Enhanced follow-up detection with semantic understanding
   * @param {string} callSid - Call identifier
   * @param {string} query - Current query
   * @returns {Object|null} Enhanced follow-up response
   */
  async detectEnhancedFollowUp(callSid, query) {
    const context = await this.getEnhancedContext(callSid, query);
    if (!context) return null;

    const semanticContext = context.semanticContext;
    if (!semanticContext) return null;

    // Check if query relates to previous context
    const queryLower = query.toLowerCase();
    const isLocationFollowUp = this.isLocationFollowUp(query, context);
    const isResourceFollowUp = this.isResourceFollowUp(query, context);
    const isGeneralFollowUp = this.isGeneralFollowUp(query, semanticContext);

    if (isLocationFollowUp || isResourceFollowUp || isGeneralFollowUp) {
      return {
        type: 'enhanced_follow_up',
        confidence: 0.9,
        context: semanticContext,
        followUpType: isLocationFollowUp ? 'location' : 
                     isResourceFollowUp ? 'resource' : 'general',
        suggestedResponse: await this.generateContextualResponse(query, context)
      };
    }

    return null;
  }

  /**
   * Check if query is a location follow-up
   * @param {string} query - Current query
   * @param {Object} context - Conversation context
   * @returns {boolean} Is location follow-up
   */
  isLocationFollowUp(query, context) {
    const queryLower = query.toLowerCase();
    const locationKeywords = ['live in', 'located in', 'from', 'near', 'in', 'at'];
    const hasLocationKeywords = locationKeywords.some(keyword => queryLower.includes(keyword));
    
    return hasLocationKeywords && context.conversationState === 'location_needed';
  }

  /**
   * Check if query is a resource follow-up
   * @param {string} query - Current query
   * @param {Object} context - Conversation context
   * @returns {boolean} Is resource follow-up
   */
  isResourceFollowUp(query, context) {
    const queryLower = query.toLowerCase();
    const resourceKeywords = ['more', 'details', 'information', 'about', 'tell me', 'what about'];
    const hasResourceKeywords = resourceKeywords.some(keyword => queryLower.includes(keyword));
    
    return hasResourceKeywords && context.conversationState === 'resource_seeking';
  }

  /**
   * Check if query is a general follow-up
   * @param {string} query - Current query
   * @param {Object} semanticContext - Semantic context
   * @returns {boolean} Is general follow-up
   */
  isGeneralFollowUp(query, semanticContext) {
    const queryLower = query.toLowerCase();
    const followUpIndicators = ['one', 'that', 'this', 'it', 'them', 'those'];
    const hasFollowUpIndicators = followUpIndicators.some(indicator => queryLower.includes(indicator));
    
    return hasFollowUpIndicators && semanticContext.conversationState !== 'initial';
  }

  /**
   * Generate contextual response based on enhanced context
   * @param {string} query - Current query
   * @param {Object} context - Conversation context
   * @returns {string} Contextual response
   */
  async generateContextualResponse(query, context) {
    try {
      const semanticContext = context.semanticContext;
      const recentResources = Array.from(context.resourceMemory.values())
        .sort((a, b) => b.lastMentioned - a.lastMentioned)
        .slice(0, 3);

      const prompt = `Based on this conversation context, generate a helpful response to the user's query.

Conversation Context:
- Primary Needs: ${semanticContext.primaryNeeds.join(', ')}
- Key Topics: ${semanticContext.keyTopics.join(', ')}
- Conversation State: ${semanticContext.conversationState}
- User Sentiment: ${semanticContext.userSentiment}
- Recent Resources: ${recentResources.map(r => r.title).join(', ')}

User Query: "${query}"

Generate a natural, helpful response that:
1. Addresses the user's current query
2. Builds on previous context
3. Provides relevant information or next steps
4. Maintains the supportive tone

Response:`;

      const response = await openai.chat.completions.create({
        model: config.GPT35_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a supportive domestic violence assistance system. Provide helpful, contextual responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      return response.choices[0].message.content;

    } catch (error) {
      logger.error('Error generating contextual response:', error);
      return "I'm here to help. Could you please tell me more about what you need?";
    }
  }

  /**
   * Generate conversation summary for SMS or call end
   * @param {string} callSid - Call identifier
   * @returns {string} Conversation summary
   */
  async generateConversationSummary(callSid) {
    const context = this.contexts.get(callSid);
    if (!context || context.history.length === 0) {
      return 'No conversation history available.';
    }

    try {
      const semanticContext = context.semanticContext;
      const resources = Array.from(context.resourceMemory.values())
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5);

      const summary = `Conversation Summary:

Key Topics Discussed: ${semanticContext?.keyTopics.join(', ') || 'Domestic violence support'}
Primary Needs Identified: ${semanticContext?.primaryNeeds.join(', ') || 'General assistance'}

Resources Provided:
${resources.map((r, i) => `${i + 1}. ${r.title} - ${r.url}`).join('\n')}

Next Steps: Consider reaching out to the resources above for immediate assistance. Remember, you're not alone and help is available 24/7.

Stay safe and know that support is always available.`;

      return summary;

    } catch (error) {
      logger.error('Error generating conversation summary:', error);
      return 'Thank you for reaching out. Please remember that help is available 24/7.';
    }
  }

  /**
   * Clear context for a call
   * @param {string} callSid - Call identifier
   */
  clearContext(callSid) {
    this.contexts.delete(callSid);
    this.semanticCache.delete(callSid);
    this.summaryCache.delete(callSid);
    logger.info('Enhanced context cleared for call:', callSid);
  }

  /**
   * Get context statistics
   * @param {string} callSid - Call identifier
   * @returns {Object} Context statistics
   */
  getContextStats(callSid) {
    const context = this.contexts.get(callSid);
    if (!context) return null;

    return {
      historyLength: context.history.length,
      resourceCount: context.resourceMemory.size,
      conversationState: context.conversationState,
      hasSemanticContext: !!context.semanticContext,
      lastUpdate: context.lastUpdate,
      locationCount: context.locationHistory.length,
      intentCount: context.intentProgression.length
    };
  }
}

// Export singleton instance
export const enhancedContextManager = new EnhancedContextManager(); 