import Constants from "expo-constants";
import { Platform } from "react-native";
import { localStorage } from "@/utils/storage";
import { secureStorage } from "@/utils/secureStorage";

/**
 * 백엔드 API 베이스 URL.
 * - web: localhost:8000
 * - Android 에뮬레이터: 10.0.2.2:8000
 * - 실 디바이스 (Expo Go): Expo가 감지한 Metro 서버 IP 재사용 → 항상 올바른 LAN IP 자동 적용
 * - 실 디바이스 (production/standalone): app.json extra.apiUrl 사용
 */
const fromConfig = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

// Expo Go에서 Metro 서버 host를 가져와 같은 IP의 8000 포트를 백엔드로 사용
const expoHost = Constants.expoConfig?.hostUri?.split(":")?.[0];
const devUrl = expoHost && expoHost !== "localhost" ? `http://${expoHost}:8000` : null;

const _base =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : fromConfig ?? devUrl ?? (Platform.OS === "ios" ? "http://localhost:8000" : "http://10.0.2.2:8000");

export const API_BASE_URL: string =
  Platform.OS === "android" ? _base.replace("localhost", "10.0.2.2") : _base;

/**
 * 백엔드는 쿠키 기반 JWT 인증을 사용.
 * - web: credentials:'include' 로 브라우저가 쿠키를 자동 관리
 * - native: Set-Cookie 헤더를 파싱해 AsyncStorage 에 저장 후
 *           Cookie 헤더로 직접 전송
 */
const TOKEN_KEY = "auth_token";
const REFRESH_KEY = "refresh_token";

export const setAuthToken = (token: string | null) => {
  if (token) secureStorage.setItem(TOKEN_KEY, token);
  else secureStorage.removeItem(TOKEN_KEY);
};

export const setRefreshToken = (token: string | null) => {
  if (token) secureStorage.setItem(REFRESH_KEY, token);
  else secureStorage.removeItem(REFRESH_KEY);
};

export const getAuthToken = (): string | null => secureStorage.getItem(TOKEN_KEY);

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  isFormData?: boolean;
}

const buildUrl = (path: string, query?: RequestOptions["query"]): string => {
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${p}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.append(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  return url;
};

export class ApiError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

let _onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (cb: () => void) => { _onUnauthorized = cb; };
export const clearOnUnauthorized = () => { _onUnauthorized = null; };

// 응답의 Set-Cookie 헤더에서 토큰을 추출해 AsyncStorage 에 저장 (native 전용)
const saveCookiesFromResponse = (res: Response) => {
  if (Platform.OS === "web") return;
  try {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) return;
    const accessMatch = setCookie.match(/(?:^|,)\s*access_token=([^;,\s]+)/);
    const refreshMatch = setCookie.match(/(?:^|,)\s*refresh_token=([^;,\s]+)/);
    if (accessMatch?.[1]) setAuthToken(decodeURIComponent(accessMatch[1]));
    if (refreshMatch?.[1]) setRefreshToken(decodeURIComponent(refreshMatch[1]));
  } catch {}
};

export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, headers: extraHeaders, isFormData, ...rest } = options;
  const url = buildUrl(path, query);

  const headers: Record<string, string> = { ...((extraHeaders as Record<string, string>) ?? {}) };
  if (body !== undefined && !isFormData && !(body instanceof FormData)) {
    headers["Content-Type"] ??= "application/json";
  }

  if (Platform.OS !== "web") {
    // native: 저장된 쿠키를 Cookie 헤더로 직접 전송
    const token = secureStorage.getItem(TOKEN_KEY);
    const refresh = secureStorage.getItem(REFRESH_KEY);
    const parts: string[] = [];
    if (token) parts.push(`access_token=${token}`);
    if (refresh) parts.push(`refresh_token=${refresh}`);
    if (parts.length > 0) headers["Cookie"] = parts.join("; ");
  }

  const init: RequestInit = {
    method,
    headers,
    ...(Platform.OS === "web" ? { credentials: "include" as RequestCredentials } : {}),
    ...rest,
  };
  if (body !== undefined) {
    init.body =
      isFormData || body instanceof FormData
        ? (body as FormData)
        : JSON.stringify(body);
  }

  const res = await fetch(url, init);

  // 응답 쿠키 저장 (native 전용)
  saveCookiesFromResponse(res);

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const data = await res.clone().json();
      detail = (data as { detail?: string })?.detail;
    } catch {
      detail = await res.text().catch(() => undefined);
    }
    const err = new ApiError(detail || `Request failed: ${res.status}`, res.status, detail);
    if (res.status === 401 && _onUnauthorized) _onUnauthorized();
    throw err;
  }

  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// 편의 메서드
export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    apiRequest<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "method">) =>
    apiRequest<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "method">) =>
    apiRequest<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "method">) =>
    apiRequest<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, body?: unknown) =>
    apiRequest<T>("DELETE", path, body !== undefined ? { body } : {}),
  postForm: <T>(path: string, formData: FormData) =>
    apiRequest<T>("POST", path, { body: formData, isFormData: true }),
  putForm: <T>(path: string, formData: FormData) =>
    apiRequest<T>("PUT", path, { body: formData, isFormData: true }),
};
