import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * web의 localStorage 와 동일한 동기 인터페이스를 모방하는 인메모리 캐시 + 비동기 영구 저장.
 * 주의: 앱 재시작 후 첫 read 전에 init() 호출해야 인메모리 값이 채워짐.
 */
class AsyncLocalStorage {
  private cache: Record<string, string> = {};
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const SECURE_KEYS = new Set(["auth_token", "refresh_token"]);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [k, v] of pairs) {
        if (v != null && !SECURE_KEYS.has(k)) this.cache[k] = v;
      }
    } catch (e) {
      console.warn("[storage] init failed:", e);
    }
    this.initialized = true;
  }

  getItem(key: string): string | null {
    return key in this.cache ? this.cache[key] : null;
  }

  setItem(key: string, value: string): void {
    this.cache[key] = value;
    AsyncStorage.setItem(key, value).catch((e) => console.warn(`[storage] setItem(${key}) failed:`, e));
  }

  removeItem(key: string): void {
    delete this.cache[key];
    AsyncStorage.removeItem(key).catch((e) => console.warn(`[storage] removeItem(${key}) failed:`, e));
  }

  clear(): void {
    this.cache = {};
    AsyncStorage.clear().catch((e) => console.warn("[storage] clear failed:", e));
  }
}

export const localStorage = new AsyncLocalStorage();
