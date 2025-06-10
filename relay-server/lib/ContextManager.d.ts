export declare class ContextManager {
    private context;
    setContext(sessionId: string, data: any): void;
    getContext(sessionId: string): any;
    clearContext(sessionId: string): void;
}
