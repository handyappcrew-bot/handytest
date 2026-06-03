import * as Location from "expo-location";

export interface Coords {
  latitude: number;
  longitude: number;
}

export type GpsErrorCode = "permission_denied" | "gps_unavailable" | "timeout";

export class GpsError extends Error {
  constructor(public code: GpsErrorCode, message: string) {
    super(message);
  }
}

/**
 * 위치 권한 요청 + 현재 좌표 반환.
 * 1) 마지막 알려진 위치 즉시 반환 시도
 * 2) 실패 시 현재 위치 요청 (Accuracy.Low — 시뮬레이터 호환)
 */
export const getCurrentLocation = async (): Promise<Coords> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new GpsError("permission_denied", "위치 권한이 거부됐어요.");
  }

  // 캐시된 마지막 위치 즉시 반환 (시뮬레이터에서도 동작)
  const last = await Location.getLastKnownPositionAsync({});
  if (last) {
    return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  }

  // 실시간 위치 요청 (Accuracy.Low = 빠름, 시뮬레이터 호환)
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    throw new GpsError("gps_unavailable", "GPS 신호를 가져올 수 없어요.");
  }
};

/**
 * 두 좌표 사이 거리 (meters) — Haversine 공식.
 */
export const distanceMeters = (a: Coords, b: Coords): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * 매장 반경 내 여부 검증.
 */
export const isWithinRadius = (current: Coords, store: Coords, radiusMeters: number): boolean => {
  return distanceMeters(current, store) <= radiusMeters;
};

/**
 * 위치 권한 상태 반환.
 */
export const requestLocationPermission = async (): Promise<"granted" | "denied"> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted" ? "granted" : "denied";
};
