export declare class RelevanceChecker {
    private relevantKeywords;
    isRelevant(query: string): boolean;
    checkRelevanceWithGPT(query: string): Promise<boolean>;
}
