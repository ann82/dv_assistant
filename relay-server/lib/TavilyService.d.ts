export declare class TavilyService {
    private cache;
    constructor();
    getCachedResponse(query: string): any;
    callTavilyAPI(query: string): Promise<any>;
}
