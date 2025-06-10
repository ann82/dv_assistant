export declare class Cache {
    private cache;
    private ttl;
    set(key: string, data: any): void;
    get(key: string): any;
}
