export class RelevanceChecker {
    constructor() {
        this.relevantKeywords = ['domestic violence', 'shelter', 'legal help', 'counseling'];
    }
    isRelevant(query) {
        const lowerQuery = query.toLowerCase();
        return this.relevantKeywords.some(keyword => lowerQuery.includes(keyword));
    }
    async checkRelevanceWithGPT(query) {
        // Simulate GPT-based relevance check
        return this.isRelevant(query);
    }
}
//# sourceMappingURL=RelevanceChecker.js.map