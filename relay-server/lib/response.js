import { config } from './config.js';
import { responseCache } from './cache.js';
import { OpenAI } from 'openai';
import { encode } from 'gpt-tokenizer';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// Log levels in order of severity
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Get current log level from config
const currentLogLevel = LOG_LEVELS[config.LOG_LEVEL?.toLowerCase() || 'info'];

// Helper function to log messages
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] <= currentLogLevel) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}

export class ResponseGenerator {
  static async getResponse(input, context = {}) {
    try {
      // Check cache first
      const cachedResponse = responseCache.getCachedResponse(input);
      if (cachedResponse) {
        log('debug', 'Using cached response', { input });
        return {
          ...cachedResponse,
          requestType: context.requestType || 'web'
        };
      }

      // Check if this is a request for more details
      if (this.isDetailRequest(input)) {
        log('debug', 'Processing detail request', { input });
        const detailResponse = await this.getDetailedResponse(input, context);
        if (detailResponse) {
          return {
            ...detailResponse,
            requestType: context.requestType || 'web'
          };
        }
      }

      // Try Tavily search first for factual queries
      log('debug', 'Checking if query is factual', { input });
      if (this.isFactualQuery(input)) {
        log('info', 'Query is factual, attempting Tavily search', { input });
        const tavilyResponse = await this.queryTavily(input);
        log('debug', 'Tavily response received', { 
          hasResponse: !!tavilyResponse,
          hasAnswer: !!tavilyResponse?.answer 
        });
        
        if (tavilyResponse && this.isSufficientResponse(tavilyResponse)) {
          log('info', 'Tavily response is sufficient');
          const response = this.formatTavilyResponse(tavilyResponse, context.requestType || 'web');
          // Store full details in cache for later use
          responseCache.setCachedResponse(input, response.fullDetails, {
            model: 'tavily',
            inputTokens: 0,
            outputTokens: 0,
            whisperUsed: false,
            isDetailed: true
          });
          return {
            text: response.summary,
            source: 'tavily',
            model: 'tavily',
            inputTokens: 0,
            outputTokens: 0,
            whisperUsed: false,
            requestType: context.requestType || 'web'
          };
        } else {
          log('info', 'Tavily response not sufficient, falling back to GPT');
        }
      } else {
        log('debug', 'Query is not factual, skipping Tavily');
      }

      // Determine which GPT model to use
      const useGPT4 = this.shouldUseGPT4(input, context);
      const model = useGPT4 ? config.GPT4_MODEL : config.GPT35_MODEL;

      // Generate response with strict token limit
      const response = await this.generateGPTResponse(input, model, context);
      
      // Calculate token usage
      const inputTokens = encode(input).length;
      const outputTokens = encode(response.text).length;

      // Cache the response
      responseCache.setCachedResponse(input, response.text, {
        model,
        inputTokens,
        outputTokens,
        whisperUsed: false
      });
      
      return {
        text: response.text,
        source: 'openai',
        model,
        inputTokens,
        outputTokens,
        whisperUsed: false,
        transcriptLength: input.length,
        responseLength: response.text.length,
        requestType: context.requestType || 'web'
      };
    } catch (error) {
      log('error', 'Error generating response', { 
        error: error.message,
        stack: error.stack
      });
      return {
        text: 'I apologize, but I encountered an error processing your request.',
        source: 'error',
        model: config.GPT35_MODEL,
        inputTokens: 0,
        outputTokens: 0,
        whisperUsed: false,
        requestType: context.requestType || 'web'
      };
    }
  }

  static isFactualQuery(input) {
    const factualPatterns = [
      /what is/i,
      /where is/i,
      /when is/i,
      /how to/i,
      /tell me about/i,
      /find/i,
      /search/i,
      /locate/i
    ];
    return factualPatterns.some(pattern => pattern.test(input));
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

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: config.DEFAULT_MAX_TOKENS,
      temperature: 0.7,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    const text = response.choices[0].message.content;
    return {
      text,
      source: model,
      tokens: encode(text).length
    };
  }

  static async queryTavily(query) {
    try {
      log('info', 'Calling Tavily API', { query });

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.TAVILY_API_KEY}`
        },
        body: JSON.stringify({
          query,
          search_depth: 'advanced',
          max_results: 5,
          include_answer: true
        })
      });

      if (!response.ok) {
        log('error', 'Tavily API error', {
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`Tavily API error: ${response.statusText}`);
      }

      const data = await response.json();
      log('info', 'Tavily API response received', {
        hasAnswer: !!data.answer,
        resultCount: data.results?.length || 0
      });
      return data;
    } catch (error) {
      log('error', 'Error querying Tavily', {
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  static isSufficientResponse(tavilyResponse) {
    // Check if Tavily provided a good answer
    return tavilyResponse?.answer && tavilyResponse.answer.length > 0;
  }

  static formatTavilyResponse(tavilyResponse, requestType = 'web') {
    // Extract shelter names and basic info
    const shelters = tavilyResponse.results.map(result => ({
      name: result.title,
      address: result.url,
      phone: result.raw_content ? (result.raw_content.match(/phone:?\s*([\d-]+)/i)?.[1] || 'Not available') : 'Not available',
      description: result.content,
      services: result.raw_content ? (result.raw_content.match(/services:?\s*([^.]+)/i)?.[1] || 'Not specified') : 'Not specified'
    }));

    // Format based on request type
    if (requestType === 'phone') {
      // For phone calls, be more concise and focus on essential info
      const summary = `I found ${shelters.length} shelters. Here are the first 3:\n\n` + 
        shelters.slice(0, 3).map((s, i) => 
          `${i + 1}. ${s.name}\n` +
          `   Phone: ${s.phone}\n`
        ).join('\n') +
        '\n\nWould you like to hear more details about any of these shelters?';

      // Create detailed response with only essential info
      const fullDetails = shelters.map((s, i) => 
        `${i + 1}. ${s.name}\n` +
        `   Phone: ${s.phone}\n` +
        `   Services: ${s.services}\n`
      ).join('\n');

      return {
        summary,
        fullDetails,
        shelters
      };
    } else {
      // For web requests, include more details
      const summary = `I found ${shelters.length} shelters in your area:\n\n` + 
        shelters.map((s, i) => 
          `${i + 1}. ${s.name}\n` +
          `   Services: ${s.services}\n` +
          `   Phone: ${s.phone}\n`
        ).join('\n') +
        '\n\nWould you like more details about any of these shelters?';

      const fullDetails = shelters.map((s, i) => 
        `${i + 1}. ${s.name}\n` +
        `   Address: ${s.address}\n` +
        `   Phone: ${s.phone}\n` +
        `   Services: ${s.services}\n` +
        `   Description: ${s.description}\n`
      ).join('\n');

      return {
        summary,
        fullDetails,
        shelters
      };
    }
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
    const lastSearch = context.lastShelterSearch;
    if (lastSearch) {
      const shelterNumber = input.match(/shelter (\d+)/i)?.[1];
      if (shelterNumber) {
        const index = parseInt(shelterNumber) - 1;
        if (index >= 0 && index < lastSearch.shelters.length) {
          const shelter = lastSearch.shelters[index];
          
          // Format based on request type
          if (context.requestType === 'phone') {
            return {
              text: `Here's what I found for ${shelter.name}:\n\n` +
                    `Phone: ${shelter.phone}\n` +
                    `Services: ${shelter.services}\n\n` +
                    `Would you like to know about another shelter?`,
              source: 'tavily',
              model: 'tavily',
              inputTokens: 0,
              outputTokens: 0,
              whisperUsed: false
            };
          } else {
            return {
              text: `Here are the details for ${shelter.name}:\n\n` +
                    `Address: ${shelter.address}\n` +
                    `Phone: ${shelter.phone}\n` +
                    `Services: ${shelter.services}\n` +
                    `Description: ${shelter.description}\n\n` +
                    `Would you like to know more about any other shelters?`,
              source: 'tavily',
              model: 'tavily',
              inputTokens: 0,
              outputTokens: 0,
              whisperUsed: false
            };
          }
        }
      }
      return null;
    }
    return null;
  }
} 