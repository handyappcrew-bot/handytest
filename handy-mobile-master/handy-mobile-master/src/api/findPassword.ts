import { api } from "./client";

export const sendFindPasswordCode = (phone: string) =>
  api.post("/api/auth/password/reset/code/send", { phone });

export const verifyFindPasswordCode = (phone: string, code: string) =>
  api.post("/api/auth/password/reset/code/verify", { phone, code });

export const resetPassword = (phone: string, newPassword: string) =>
  api.post("/api/auth/password/reset", { phone, new_password: newPassword });
