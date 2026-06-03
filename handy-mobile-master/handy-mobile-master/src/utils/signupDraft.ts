import { localStorage } from "./storage";

const KEY = "signup_profile_info_draft";

export interface ProfileInfoDraft {
  name?: string;
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  gender?: "남자" | "여자" | "";
  agreed?: Record<string, boolean>;
}

export const loadProfileInfoDraft = (): ProfileInfoDraft | null => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const saveProfileInfoDraft = (d: ProfileInfoDraft) => {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
};

export const clearProfileInfoDraft = () => {
  localStorage.removeItem(KEY);
};
