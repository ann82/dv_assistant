export class Cache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number = 3600000; // 1 hour in milliseconds

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
} 