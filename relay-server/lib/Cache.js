export class Cache {
    constructor() {
        this.cache = new Map();
        this.ttl = 3600000; // 1 hour in milliseconds
    }
    set(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }
}
//# sourceMappingURL=Cache.js.map