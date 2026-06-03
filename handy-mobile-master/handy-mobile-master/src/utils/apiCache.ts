interface CacheEntry<T> {
  data: T;
  ts: number;
}

class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string, ttlMs: number): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > ttlMs) { this.store.delete(key); return null; }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, ts: Date.now() });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }
}

export const apiCache = new ApiCache();
