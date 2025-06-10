export class ContextManager {
  private context: Map<string, any> = new Map();

  setContext(sessionId: string, data: any): void {
    this.context.set(sessionId, data);
  }

  getContext(sessionId: string): any {
    return this.context.get(sessionId);
  }

  clearContext(sessionId: string): void {
    this.context.delete(sessionId);
  }
} 