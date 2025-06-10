export class EntityExtractor {
  extractLocation(query: string): string | null {
    // Remove trailing punctuation
    const cleanedQuery = query.replace(/[.,!?;]$/, '');
    console.log(`Cleaned query for location extraction: "${cleanedQuery}"`);
    const locationMatch = cleanedQuery.match(/(?:in|near|at)\s+([A-Za-z\s]+)/i);
    console.log(`Location match result: ${locationMatch ? locationMatch[1].trim() : 'null'}`);
    return locationMatch ? locationMatch[1].trim() : null;
  }

  extractTopic(query: string): string | null {
    const topics = ['domestic violence', 'shelter', 'legal help', 'counseling'];
    for (const topic of topics) {
      if (query.toLowerCase().includes(topic)) {
        return topic;
      }
    }
    const topicMatch = query.match(/(?:looking for|need|want)\s+([A-Za-z\s]+)/i);
    return topicMatch ? topicMatch[1].trim() : null;
  }
} 