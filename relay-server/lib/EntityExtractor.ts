export class EntityExtractor {
  extractLocation(query: string): string | null {
    const locationMatch = query.match(/(?:in|near|at)\s+([A-Za-z\s]+)/i);
    return locationMatch ? locationMatch[1].trim() : null;
  }

  extractTopic(query: string): string | null {
    const topics = ['domestic violence', 'shelter', 'legal help', 'counseling'];
    for (const topic of topics) {
      if (query.toLowerCase().includes(topic)) {
        return topic;
      }
    }
    return null;
  }
} 