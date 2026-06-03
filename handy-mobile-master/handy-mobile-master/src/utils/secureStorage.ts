import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * JWT 토큰 전용 암호화 저장소.
 * iOS Keychain / Android Keystore 사용.
 * 동기 인터페이스를 위해 메모리 캐시 유지.
 */
class SecureTokenStorage {
  private cache: Record<string, string> = {};

  async init(keys: string[]): Promise<void> {
    if (Platform.OS === "web") return;
    await Promise.all(
      keys.map(async (key) => {
        try {
          const val = await SecureStore.getItemAsync(key);
          if (val != null) this.cache[key] = val;
        } catch {}
      })
    );
  }

  getItem(key: string): string | null {
    return this.cache[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache[key] = value;
    if (Platform.OS !== "web") {
      SecureStore.setItemAsync(key, value).catch((e) =>
        console.warn(`[secureStorage] setItem(${key}) failed:`, e)
      );
    }
  }

  removeItem(key: string): void {
    delete this.cache[key];
    if (Platform.OS !== "web") {
      SecureStore.deleteItemAsync(key).catch((e) =>
        console.warn(`[secureStorage] removeItem(${key}) failed:`, e)
      );
    }
  }
}

export const secureStorage = new SecureTokenStorage();
