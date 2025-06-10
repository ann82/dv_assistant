export class ContextManager {
    constructor() {
        this.context = new Map();
    }
    setContext(sessionId, data) {
        this.context.set(sessionId, data);
    }
    getContext(sessionId) {
        return this.context.get(sessionId);
    }
    clearContext(sessionId) {
        this.context.delete(sessionId);
    }
}
//# sourceMappingURL=ContextManager.js.map