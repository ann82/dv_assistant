import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponseGenerator } from '../lib/ResponseGenerator';
import { IntentExtractor } from '../lib/IntentExtractor';
import { EntityExtractor } from '../lib/EntityExtractor';
import { ContextManager } from '../lib/ContextManager';
import { RelevanceChecker } from '../lib/RelevanceChecker';
import { TavilyService } from '../lib/TavilyService';

vi.mock('../lib/IntentExtractor');
vi.mock('../lib/EntityExtractor');
vi.mock('../lib/ContextManager');
vi.mock('../lib/RelevanceChecker');
vi.mock('../lib/TavilyService');

describe('ResponseGenerator', () => {
  let responseGenerator: ResponseGenerator;
  let intentExtractor: IntentExtractor;
  let entityExtractor: EntityExtractor;
  let contextManager: ContextManager;
  let relevanceChecker: RelevanceChecker;
  let tavilyService: TavilyService;

  beforeEach(() => {
    intentExtractor = new IntentExtractor();
    entityExtractor = new EntityExtractor();
    contextManager = new ContextManager();
    relevanceChecker = new RelevanceChecker();
    tavilyService = new TavilyService();

    responseGenerator = new ResponseGenerator();
    (responseGenerator as any).intentExtractor = intentExtractor;
    (responseGenerator as any).entityExtractor = entityExtractor;
    (responseGenerator as any).contextManager = contextManager;
    (responseGenerator as any).relevanceChecker = relevanceChecker;
    (responseGenerator as any).tavilyService = tavilyService;
  });

  it('should return a message for irrelevant queries', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(false);
    const response = await responseGenerator.generateResponse('session1', 'Tell me a joke');
    expect(response).toBe("I'm here to help with safety, domestic violence, or shelter-related concerns. Please let me know if I can help with that.");
  });

  it('should return a message for unknown intent', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('unknown');
    const response = await responseGenerator.generateResponse('session1', 'Random query');
    expect(response).toBe("I couldn't understand what you're looking for. Please specify if you need a domestic violence shelter, legal help, or counseling.");
  });

  it('should return a message for missing location', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('find_shelter');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue(null);
    const response = await responseGenerator.generateResponse('session1', 'Are there shelters?');
    expect(response).toBe("I couldn't detect a location. Please specify a city or area.");
  });

  it('should return cached response if available', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('find_shelter');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue('San Jose');
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('shelter');
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue({ results: ['Shelter 1', 'Shelter 2'] });
    const response = await responseGenerator.generateResponse('session1', 'Are there shelters in San Jose?');
    expect(response).toBe('Here are some resources: ["Shelter 1","Shelter 2"]');
  });

  it('should call Tavily API if no cached response', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('find_shelter');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue('San Jose');
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('shelter');
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue(null);
    vi.spyOn(tavilyService, 'callTavilyAPI').mockResolvedValue({ results: ['Shelter 1', 'Shelter 2'] });
    const response = await responseGenerator.generateResponse('session1', 'Are there shelters in San Jose?');
    expect(response).toBe('Here are some resources: ["Shelter 1","Shelter 2"]');
  });

  it('should fallback to GPT if Tavily API fails', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('find_shelter');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue('San Jose');
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('shelter');
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue(null);
    vi.spyOn(tavilyService, 'callTavilyAPI').mockRejectedValue(new Error('API error'));
    const response = await responseGenerator.generateResponse('session1', 'Are there shelters in San Jose?');
    expect(response).toBe('GPT Fallback: You\'re a trauma-informed assistant helping someone with a domestic violence concern. They asked: \'Are there shelters in San Jose?\'. Location: \'San Jose\'. Context: \'undefined\'. Give safe, non-judgmental guidance.');
  });

  it('should handle follow-up questions correctly', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('get_info');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue(null);
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('pets');
    vi.spyOn(contextManager, 'getContext').mockReturnValue({ location: 'San Jose' });
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue(null);
    vi.spyOn(tavilyService, 'callTavilyAPI').mockResolvedValue({ results: ['Shelter 1 allows pets', 'Shelter 2 does not allow pets'] });
    const response = await responseGenerator.generateResponse('session1', 'Do they allow pets?');
    expect(response).toBe('Here\'s what I found about your question: [{"title":"Shelter 1 allows pets","url":null},{"title":"Shelter 2 does not allow pets","url":null}]');
  });

  it('should return a message if location is missing in follow-up', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('get_info');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue(null);
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('pets');
    vi.spyOn(contextManager, 'getContext').mockReturnValue({ location: null });
    const response = await responseGenerator.generateResponse('session1', 'Do they allow pets?');
    expect(response).toBe("I couldn't find the previous location. Please specify a location.");
  });

  it('should handle initial question with topic', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('get_info');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue('San Jose');
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('legal help');
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue(null);
    vi.spyOn(tavilyService, 'callTavilyAPI').mockResolvedValue({ results: ['Shelter 1 provides legal help', 'Shelter 2 does not provide legal help'] });
    const response = await responseGenerator.generateResponse('session1', 'Do they provide legal help in San Jose?');
    expect(response).toBe('Here are some resources: ["Shelter 1 provides legal help","Shelter 2 does not provide legal help"]');
  });

  it('should handle follow-up question with missing topic', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('get_info');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue(null);
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue(null);
    vi.spyOn(contextManager, 'getContext').mockReturnValue({ location: 'San Jose' });
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue(null);
    vi.spyOn(tavilyService, 'callTavilyAPI').mockResolvedValue({ results: ['Shelter 1', 'Shelter 2'] });
    const response = await responseGenerator.generateResponse('session1', 'What about them?');
    expect(response).toBe('Here\'s what I found about your question: [{"title":"Shelter 1","url":null},{"title":"Shelter 2","url":null}]');
  });

  it('should fallback to GPT if Tavily API fails', async () => {
    vi.spyOn(relevanceChecker, 'isRelevant').mockReturnValue(true);
    vi.spyOn(intentExtractor, 'classifyIntent').mockReturnValue('find_shelter');
    vi.spyOn(entityExtractor, 'extractLocation').mockReturnValue('San Jose');
    vi.spyOn(entityExtractor, 'extractTopic').mockReturnValue('shelter');
    vi.spyOn(tavilyService, 'getCachedResponse').mockReturnValue(null);
    vi.spyOn(tavilyService, 'callTavilyAPI').mockRejectedValue(new Error('API error'));
    const response = await responseGenerator.generateResponse('session1', 'Are there shelters in San Jose?');
    expect(response).toBe('GPT Fallback: You\'re a trauma-informed assistant helping someone with a domestic violence concern. They asked: \'Are there shelters in San Jose?\'. Location: \'San Jose\'. Context: \'undefined\'. Give safe, non-judgmental guidance.');
  });
}); 