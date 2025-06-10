import { Cache } from './Cache.js';

export class TavilyService {
  private cache: Cache;

  constructor() {
    this.cache = new Cache();
  }

  getCachedResponse(query: string): any {
    return this.cache.get(query);
  }

  async callTavilyAPI(query: string): Promise<any> {
    const cachedResponse = this.cache.get(query);
    if (cachedResponse) {
      return cachedResponse;
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.TAVILY_API_KEY || ''
      },
      body: JSON.stringify({ query, search_depth: 'basic', max_results: 3 })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.cache.set(query, data);
    return data;
  }
} 