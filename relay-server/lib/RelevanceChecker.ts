export class RelevanceChecker {
  private relevantKeywords: string[] = ['domestic violence', 'shelter', 'legal help', 'counseling'];

  isRelevant(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const isRelevant = this.relevantKeywords.some(keyword => lowerQuery.includes(keyword));
    console.log(`Relevance check for query: "${query}" - Result: ${isRelevant}`);
    return isRelevant;
  }

  async checkRelevanceWithGPT(query: string): Promise<boolean> {
    // Simulate GPT-based relevance check
    return this.isRelevant(query);
  }
} 