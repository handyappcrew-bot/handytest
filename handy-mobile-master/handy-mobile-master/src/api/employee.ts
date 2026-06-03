import { api } from "./client";

// ───────── 출퇴근 ─────────
export const getTodayWork = (storeId: number) =>
  api.post("/api/employee/work/today", { store_id: storeId });

export interface WorkStatus {
  status?: "working" | "on_break" | "off_work" | null;
  clock_in_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  clock_out_time?: string | null;
  working_status?: string | null;
}

export const getWorkStatus = (storeId: number) =>
  api.post<WorkStatus>("/api/employee/work/status", { store_id: storeId });

export const getWeeklyWork = (storeId: number) =>
  api.post("/api/employee/work", { store_id: storeId });

export const getStoreNotice = (storeId: number) =>
  api.post("/api/employee/notice", { store_id: storeId });

export const clockIn = (storeId: number) =>
  api.post("/api/employee/work/clock-in", { store_id: storeId });

export const clockOut = (storeId: number) =>
  api.post("/api/employee/work/clock-out", { store_id: storeId });

export const breakStart = (storeId: number) =>
  api.post("/api/employee/work/break-start", { store_id: storeId });

export const breakEnd = (storeId: number) =>
  api.post("/api/employee/work/break-end", { store_id: storeId });

// ───────── 근무 기록 ─────────
export const getMyWorkLogs = (storeId: number, year: number, month: number) =>
  api.post<any[]>("/api/employee/work/logs", { store_id: storeId, year, month });

// ───────── 스케줄 ─────────
export interface StoreSetting {
  is_fixed_holiday: boolean;
  holiday_cycle: string | null;
  holiday_days: string[] | null;
  holiday_overrides?: { date: string; type: "open" | "closed" }[];
}

export interface ScheduleEntry {
  work_start: string | null;
  work_end: string | null;
  is_holiday: boolean;
  is_vacation?: boolean;
  shift_name: string | null;
}

export interface MyScheduleResponse {
  store_setting: StoreSetting;
  schedules: Record<string, ScheduleEntry>;
}

export const getMySchedule = (storeId: number, year: number, month: number) =>
  api.get<MyScheduleResponse>(
    `/api/employee/schedule/${storeId}`,
    { year, month },
  );

export const getAllSchedule = (storeId: number, year: number, month: number) =>
  api.get(`/api/employee/schedule/${storeId}/all`, { year, month });

export const getAllScheduleDetail = (storeId: number, year: number, month: number, day: number) =>
  api.get(`/api/employee/schedule/${storeId}/detail`, { year, month, day });

// ───────── 스케줄 변경 요청 ─────────
export interface ScheduleChangePayload {
  store_id: number;
  type?: string;            // "schedule_change" | "vacation"
  origin_date?: string;
  origin_start?: string;
  origin_end?: string;
  desired_date: string;
  desired_start?: string;
  desired_end?: string;
  reason?: string;
}

export const createScheduleChange = (payload: ScheduleChangePayload) =>
  api.post<{ id: number }>("/api/employee/schedule/change", payload);

export const getScheduleChange = (storeId: number) =>
  api.get<any[]>("/api/employee/schedule/change", { store_id: storeId });

export const deleteScheduleChange = (id: number) =>
  api.delete<{ ok: boolean }>(`/api/employee/schedule/change/${id}`);

// ───────── 근태 수정 요청 ─────────
export const createWorklogRequest = (payload: {
  store_id: number;
  type: string;
  date: string;
  reason: string;
  origin_start?: string;
  origin_end?: string;
  desired_start?: string;
  desired_end?: string;
  desired_break_minutes?: number;
}) => api.post<{ id: number }>("/api/employee/worklog/request", payload);

export const getMyWorklogRequests = (storeId: number) =>
  api.get<any[]>("/api/employee/worklog/request", { store_id: storeId });

// ───────── 마감 보고 ─────────
export const submitClosingReport = (payload: Record<string, unknown>) =>
  api.post("/api/employee/closing-report", payload);

export const checkClosingReport = (storeId: number) =>
  api.get<{ is_completed: boolean; submitted_by_name: string | null }>("/api/employee/closing-report/check", { store_id: storeId });

// ───────── 마이 페이지 ─────────
export const getMyEmployeeInfo = (storeId: number) => api.get("/api/employee/mypage", { store_id: storeId });

export const getEmployeeStoreInfo = (storeId: number) =>
  api.get<any>(`/api/employee/store/${storeId}/info`);

export const updateMyEmployeeInfo = (payload: {
  name: string;
  bank: string;
  account_number: string;
  store_id?: number;
  image?: { uri: string; name: string; type: string };
  resume?: { uri: string; name: string; type: string } | null;
  employment_contract?: { uri: string; name: string; type: string } | null;
  health_certificate?: { uri: string; name: string; type: string } | null;
}) => {
  const fd = new FormData();
  fd.append("name", payload.name);
  fd.append("bank", payload.bank);
  fd.append("account_number", payload.account_number);
  if (payload.store_id != null) fd.append("store_id", String(payload.store_id));
  if (payload.image) fd.append("image", payload.image as unknown as Blob);
  if (payload.resume) fd.append("resume", payload.resume as unknown as Blob);
  if (payload.employment_contract) fd.append("employment_contract", payload.employment_contract as unknown as Blob);
  if (payload.health_certificate) fd.append("health_certificate", payload.health_certificate as unknown as Blob);
  return api.postForm("/api/employee/mypage/edit", fd);
};

export const deleteEmployeeProfileImage = (storeId?: number) => {
  const qs = storeId ? `?store_id=${storeId}` : "";
  return api.delete(`/api/employee/mypage/profile-image${qs}`);
};

export const deleteEmployeeDocument = (field: string, storeId?: number) =>
  api.delete<{ ok: boolean }>("/api/employee/profile/document", { field, store_id: storeId });

// ───────── 가입 신청 ─────────
export interface MemberRequest {
  id: number;
  status: "pending" | "approved" | "rejected";
  store_id: number;
  store_name: string;
}

export const getMyMemberRequest = () =>
  api.get<MemberRequest | null>("/api/employee/member/request");

// ───────── 급여명세서 ─────────
export const getEmployeePayslips = (storeId: number, year?: number, month?: number, includePending?: boolean) =>
  api.get<any[]>("/api/employee/payslips", { store_id: storeId, year, month, ...(includePending ? { include_pending: true } : {}) });

export const getEmployeePayslipDetail = (payslipId: number, storeId?: number) =>
  api.get(`/api/employee/payslips/${payslipId}`, { store_id: storeId });

export interface SalaryPreviewResponse {
  total_hours: number;
  estimated_salary: number;
  net_pay?: number;
  base_pay?: number;
  overtime_pay?: number;
  night_pay?: number;
  holiday_pay?: number;
  weekly_leave_pay?: number;
  total_deduction?: number;
  work_days?: number;
  actual_work_minutes?: number;
}

export const getSalaryPreview = (storeId: number, year?: number, month?: number) =>
  api.post<SalaryPreviewResponse>("/api/employee/salary/preview", { store_id: storeId, year, month });
