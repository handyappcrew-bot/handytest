import { api, setAuthToken, setRefreshToken } from "./client";
import { localStorage } from "@/utils/storage";

export interface MeResponse {
  id: number;
  name: string;
  phone: string;
  image_url: string | null;
}

export interface MyStore {
  store_id: number;
  store_name: string;
  role: "owner" | "employee";
  store_member_id: number;
  employee_type?: string;
}

export const getMe = () => api.get<MeResponse>("/api/auth/me");

export const getMyStores = () => api.get<MyStore[]>("/api/auth/my/stores");

export interface OnboardingStatus {
  status: "ready" | "owner_pending" | "employee_pending" | "employee_rejected" | "no_store";
  store_name?: string;
}

export const getOnboardingStatus = () =>
  api.get<OnboardingStatus>("/api/auth/onboarding/status");

export const login = async (phone: string, password: string) => {
  const res = await api.post<{
    access_token?: string;
    refresh_token?: string;
    member_id?: number;
    stores?: MyStore[];
  }>("/api/auth/login", { phone, password });
  if (res.access_token) setAuthToken(res.access_token);
  if (res.refresh_token) setRefreshToken(res.refresh_token);
  if (res.member_id != null) localStorage.setItem("currentMemberId", String(res.member_id));
  return res;
};

// 애플 네이티브 로그인: identityToken(JWT)을 백엔드로 전송해 검증.
// 기존회원 → { access_token, refresh_token } (앱에 저장 후 로그인)
// 신규회원 → { redirect: "signup", signup_token } (소셜 가입 플로우로 진입)
export interface AppleNativeResponse {
  access_token?: string;
  refresh_token?: string;
  redirect?: "signup";
  signup_token?: string;
}

export const appleNativeLogin = async (identityToken: string): Promise<AppleNativeResponse> => {
  const res = await api.post<AppleNativeResponse>("/api/auth/apple/native", {
    identity_token: identityToken,
  });
  if (res.access_token) setAuthToken(res.access_token);
  if (res.refresh_token) setRefreshToken(res.refresh_token);
  return res;
};

export const logout = async () => {
  try { await api.post("/api/auth/logout"); } catch {}
  setAuthToken(null);
  setRefreshToken(null);
  localStorage.removeItem("currentMemberId");
  localStorage.removeItem("currentRole");
  localStorage.removeItem("currentStoreId");
  localStorage.removeItem("currentStoreMemberId");
};

export const sendSignupCode = (phone: string) =>
  api.post("/api/auth/signup/code/send", { phone });

export const verifySignupCode = (phone: string, code: string) =>
  api.post("/api/auth/signup/code/verify", { phone, code });

export interface SignupPayload {
  phone: string;
  name: string;
  birth: string;          // "YYYY-MM-DD"
  gender: "남자" | "여자";
  password?: string;
  type?: "general" | "social";
  social_token?: string;
  agreed_terms: boolean;
  image?: { uri: string; name: string; type: string };  // 백엔드 이미지 업로드 지원 후 연결 예정
}

export const getPushSettings = () =>
  api.get<Record<string, boolean>>("/api/auth/push-settings");

export const updatePushSettings = (settings: Record<string, boolean>) =>
  api.put<Record<string, boolean>>("/api/auth/push-settings", settings);

export const signup = async (payload: SignupPayload) => {
  const fd = new FormData();
  fd.append("phone", payload.phone);
  fd.append("name", payload.name);
  fd.append("birth", payload.birth);
  fd.append("gender", payload.gender);
  fd.append("type", payload.type ?? "general");
  fd.append("agreed_terms", String(payload.agreed_terms));
  if (payload.password) fd.append("password", payload.password);
  if (payload.social_token) fd.append("social_token", payload.social_token);
  if (payload.image) {
    fd.append("image", {
      uri: payload.image.uri,
      name: payload.image.name,
      type: payload.image.type,
    } as any);
  }
  return api.postForm("/api/auth/signup", fd);
};
