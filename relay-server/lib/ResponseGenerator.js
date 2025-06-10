import { IntentExtractor } from './IntentExtractor';
import { EntityExtractor } from './EntityExtractor';
import { ContextManager } from './ContextManager';
import { RelevanceChecker } from './RelevanceChecker';
import { TavilyService } from './TavilyService';
export class ResponseGenerator {
    constructor() {
        this.intentExtractor = new IntentExtractor();
        this.entityExtractor = new EntityExtractor();
        this.contextManager = new ContextManager();
        this.relevanceChecker = new RelevanceChecker();
        this.tavilyService = new TavilyService();
    }
    async generateResponse(sessionId, query) {
        // 1. Check relevance
        if (!this.relevanceChecker.isRelevant(query)) {
            return "I'm here to help with safety, domestic violence, or shelter-related concerns. Please let me know if I can help with that.";
        }
        // 2. Get existing context
        const existingContext = this.contextManager.getContext(sessionId);
        const isFollowUp = existingContext !== undefined;
        // 3. Classify intent
        const intent = this.intentExtractor.classifyIntent(query);
        if (intent === 'unknown') {
            return "I couldn't understand what you're looking for. Please specify if you need a domestic violence shelter, legal help, or counseling.";
        }
        let location;
        let topic;
        let searchQuery;
        if (isFollowUp) {
            // Handle follow-up question
            location = existingContext.location;
            topic = this.entityExtractor.extractTopic(query);
            // Ensure location is not null
            if (!location) {
                return "I couldn't find the previous location. Please specify a location.";
            }
            // Construct follow-up specific query
            if (topic === 'pets') {
                searchQuery = `domestic violence shelters in ${location} that allow pets`;
            }
            else if (topic === 'legal help') {
                searchQuery = `domestic violence shelters in ${location} that provide legal assistance`;
            }
            else {
                // Generic follow-up query
                searchQuery = `domestic violence shelters in ${location} ${topic ? `that support ${topic}` : ''}`;
            }
        }
        else {
            // Handle initial question
            location = this.entityExtractor.extractLocation(query);
            topic = this.entityExtractor.extractTopic(query);
            if (!location) {
                return "I couldn't detect a location. Please specify a city or area.";
            }
            // Construct initial query
            if (intent === 'find_shelter') {
                searchQuery = `domestic violence shelters in ${location}`;
            }
            else if (intent === 'get_info') {
                searchQuery = `shelters in ${location} that support ${topic}`;
            }
            else {
                searchQuery = `Find ${topic} near ${location}`;
            }
        }
        // 4. Store or update context
        const context = {
            intent,
            location,
            topic,
            lastQuery: query,
            timestamp: Date.now()
        };
        this.contextManager.setContext(sessionId, context);
        // 5. Check cache
        const cachedResponse = this.tavilyService.getCachedResponse(searchQuery);
        if (cachedResponse) {
            return this.formatResponse(cachedResponse, isFollowUp);
        }
        // 6. Call Tavily API
        try {
            const tavilyResponse = await this.tavilyService.callTavilyAPI(searchQuery);
            return this.formatResponse(tavilyResponse, isFollowUp);
        }
        catch (error) {
            // 7. Fallback to GPT
            const gptResponse = await this.fallbackToGPT(query, location, existingContext?.lastShelterName);
            return gptResponse;
        }
    }
    formatResponse(response, isFollowUp) {
        if (!response.results || response.results.length === 0) {
            return "I couldn't find any relevant information. Would you like to try a different search?";
        }
        if (isFollowUp) {
            // Format follow-up response
            const results = response.results.map((result) => ({
                title: result.title,
                url: result.url
            }));
            return `Here's what I found about your question: ${JSON.stringify(results)}`;
        }
        else {
            // Format initial response
            return `Here are some resources: ${JSON.stringify(response.results)}`;
        }
    }
    async fallbackToGPT(query, location, lastShelterName) {
        const prompt = `You're a trauma-informed assistant helping someone with a domestic violence concern. They asked: '${query}'. Location: '${location}'. Context: '${lastShelterName}'. Give safe, non-judgmental guidance.`;
        // Simulate GPT call
        return `GPT Fallback: ${prompt}`;
    }
}
//# sourceMappingURL=ResponseGenerator.js.map