import { IntentExtractor } from './IntentExtractor';
import { EntityExtractor } from './EntityExtractor';
import { ContextManager } from './ContextManager';
import { RelevanceChecker } from './RelevanceChecker';
import { TavilyService } from './TavilyService';

export class ResponseGenerator {
  private intentExtractor: IntentExtractor;
  private entityExtractor: EntityExtractor;
  private contextManager: ContextManager;
  private relevanceChecker: RelevanceChecker;
  private tavilyService: TavilyService;

  constructor() {
    this.intentExtractor = new IntentExtractor();
    this.entityExtractor = new EntityExtractor();
    this.contextManager = new ContextManager();
    this.relevanceChecker = new RelevanceChecker();
    this.tavilyService = new TavilyService();
  }

  async generateResponse(sessionId: string, query: string): Promise<string> {
    // 1. Check relevance
    if (!this.relevanceChecker.isRelevant(query)) {
      return "I'm here to help with safety, domestic violence, or shelter-related concerns. Please let me know if I can help with that.";
    }

    // 2. Classify intent
    const intent = this.intentExtractor.classifyIntent(query);
    if (intent === 'unknown') {
      return "I couldn't understand what you're looking for. Please specify if you need a domestic violence shelter, legal help, or counseling.";
    }

    // 3. Extract entities
    const location = this.entityExtractor.extractLocation(query);
    const topic = this.entityExtractor.extractTopic(query);

    if (!location) {
      return "I couldn't detect a location. Please specify a city or area.";
    }

    // 4. Save context
    this.contextManager.setContext(sessionId, { intent, location, topic });

    // 5. Construct search query for Tavily
    let searchQuery: string;
    if (intent === 'find_shelter') {
      searchQuery = `domestic violence shelters in ${location}`;
    } else if (intent === 'get_info') {
      searchQuery = `shelters in ${location} that support ${topic}`;
    } else {
      searchQuery = `Find ${topic} near ${location}`;
    }

    // 6. Check cache
    const cachedResponse = this.tavilyService.getCachedResponse(searchQuery);
    if (cachedResponse) {
      return this.formatResponse(cachedResponse);
    }

    // 7. Call Tavily API
    try {
      const tavilyResponse = await this.tavilyService.callTavilyAPI(searchQuery);
      return this.formatResponse(tavilyResponse);
    } catch (error) {
      // 8. Fallback to GPT
      const gptResponse = await this.fallbackToGPT(query, location, this.contextManager.getContext(sessionId)?.lastShelterName);
      return gptResponse;
    }
  }

  private formatResponse(response: any): string {
    return `Here are some resources: ${JSON.stringify(response)}`;
  }

  private async fallbackToGPT(query: string, location: string, lastShelterName: string): Promise<string> {
    const prompt = `You're a trauma-informed assistant helping someone with a domestic violence concern. They asked: '${query}'. Location: '${location}'. Context: '${lastShelterName}'. Give safe, non-judgmental guidance.`;
    // Simulate GPT call
    return `GPT Fallback: ${prompt}`;
  }
} 