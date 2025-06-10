export declare class ResponseGenerator {
    private intentExtractor;
    private entityExtractor;
    private contextManager;
    private relevanceChecker;
    private tavilyService;
    constructor();
    generateResponse(sessionId: string, query: string): Promise<string>;
    private formatResponse;
    private fallbackToGPT;
}
