export class RelevanceChecker {
  private relevantKeywords: string[] = ['domestic violence', 'shelter', 'legal help', 'counseling'];

  isRelevant(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return this.relevantKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  async checkRelevanceWithGPT(query: string): Promise<boolean> {
    // Simulate GPT-based relevance check
    return this.isRelevant(query);
  }
} 