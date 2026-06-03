import { API_BASE_URL } from "@/api/client";

/**
 * 백엔드에서 받은 이미지 경로를 RN Image source URI 로 변환.
 * 웹 `getPhotoUrl` (src/utils/function.ts) 의 모바일 버전.
 *
 * - `/uploads/...` 같은 상대 경로 → API_BASE_URL 붙임
 * - 절대 URL (http/https) → 그대로
 * - falsy → null
 */
export const getPhotoUrl = (photo?: string | null): string | null => {
  if (!photo) return null;
  if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
  if (photo.startsWith("/")) return `${API_BASE_URL}${photo}`;
  return photo;
};

/**
 * RN Image source 로 바로 쓰기 좋은 형태.
 * 값 없으면 null 반환 → 호출부에서 placeholder 분기.
 */
export const photoSource = (photo?: string | null) => {
  const uri = getPhotoUrl(photo);
  return uri ? { uri } : null;
};
