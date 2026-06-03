import { getStoreInfo, getStaffList } from "@/api/owner";
import { apiCache } from "./apiCache";

const STORE_INFO_TTL = 5 * 60 * 1000;  // 5분
const STAFF_LIST_TTL = 10 * 60 * 1000; // 10분

export const getCachedStoreInfo = (storeId: number): Promise<any> => {
  const key = `storeInfo:${storeId}`;
  const cached = apiCache.get<any>(key, STORE_INFO_TTL);
  if (cached) return Promise.resolve(cached);
  return getStoreInfo(storeId).then((data) => { apiCache.set(key, data); return data; });
};

export const getCachedStaffList = (storeId: number): Promise<any> => {
  const key = `staffList:${storeId}`;
  const cached = apiCache.get<any>(key, STAFF_LIST_TTL);
  if (cached) return Promise.resolve(cached);
  return getStaffList(storeId).then((data) => { apiCache.set(key, data); return data; });
};

export const invalidateStoreInfo = (storeId: number) =>
  apiCache.invalidate(`storeInfo:${storeId}`);

export const invalidateStaffList = (storeId: number) =>
  apiCache.invalidate(`staffList:${storeId}`);
