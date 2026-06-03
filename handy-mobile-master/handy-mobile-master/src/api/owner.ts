import { api } from "./client";

// ───────── 매장 ─────────
export const getStoreInfo = (storeId: number) =>
  api.get(`/api/owner/store/${storeId}`);

export interface StoreInfoUpdatePayload {
  id: number;
  name: string;
  address: string;
  address_detail: string | null;
  industry: string;
  owner_name: string;
  phone: string;
}

export const updateStoreInfo = (data: StoreInfoUpdatePayload) =>
  api.put("/api/owner/store/update", data);

export const updateStoreSetting = (storeId: number, payload: Record<string, unknown>) =>
  api.put(`/api/owner/store/${storeId}/setting`, payload);

export interface HolidayOverride {
  date: string;
  type: "open" | "closed";
}

export const updateHolidayOverrides = (storeId: number, overrides: HolidayOverride[]) =>
  api.put(`/api/owner/store/${storeId}/setting`, { holiday_overrides: overrides });

export interface ShiftItem {
  sort_order: number;
  name: string;
  start_time: string | null;
  end_time: string | null;
  is_active?: boolean;
}

export const updateStoreShifts = (storeId: number, shifts: ShiftItem[]) =>
  api.put(`/api/owner/store/${storeId}/shifts`, { shifts });

export const deleteStore = (storeId: number) =>
  api.delete("/api/owner/store/delete", { store_id: storeId });

export const updateStoreMap = (storeId: number, lat: number, lng: number) =>
  api.put(`/api/owner/store/${storeId}/map`, { lat, lng });

// ───────── 출퇴근 현황 ─────────
export interface AttendanceShift {
  worklog_id: number;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
}

export interface AttendanceTodayRow {
  id: number;
  name: string;
  shift: string | null;
  status: "working" | "on_break" | "off_work" | "absent" | "late" | "completed" | "before_work" | "scheduled" | "extended" | "night" | "holiday" | "vacation";
  clock_in: string | null;
  clock_out: string | null;
  work_start: string | null;
  work_end: string | null;
  image_url?: string | null;
  shifts?: AttendanceShift[];
  today_work_minutes?: number;
  estimated_clock_out?: string | null;
}

export const getTodayAttendance = (storeId: number, date?: string) =>
  api.get<AttendanceTodayRow[]>(`/api/owner/store/${storeId}/attendance/today`, { date });

export interface StaffAttendanceRecord {
  date: string;
  status: "working" | "on_break" | "off_work" | "scheduled" | "absent" | "off" | "late" | "completed" | "before_work" | "extended" | "night" | "holiday" | "vacation" | null;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

export const getStaffAttendance = (storeId: number, staffId: number, year: number, month: number) =>
  api.get<StaffAttendanceRecord[]>(`/api/owner/store/${storeId}/staff/${staffId}/attendance`, { year, month });

// ───────── 근태 수정 요청 ─────────
export interface WorklogChangeRequest {
  id: number;
  employee_name: string;
  type: string;
  date: string;
  origin_start: string | null;
  origin_end: string | null;
  desired_start: string | null;
  desired_end: string | null;
  desired_break_minutes: number | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export const getOwnerWorklogRequests = (storeId: number) =>
  api.get<WorklogChangeRequest[]>(`/api/owner/store/${storeId}/worklog-requests`);

export const handleOwnerWorklogRequest = (
  storeId: number,
  reqId: number,
  status: "approved" | "rejected",
) => api.put(`/api/owner/store/${storeId}/worklog-requests/${reqId}`, { status });

export const editWorklog = (
  storeId: number,
  payload: {
    employee_id: number;
    date: string;
    status: "off_work" | "late" | "absent" | "extended" | "night" | "holiday";
    clock_in?: string | null;
    clock_out?: string | null;
    worklog_id?: number;
  },
) => api.patch(`/api/owner/store/${storeId}/worklog`, payload);

export const getMonthlySalesDetail = (storeId: number, year: number, month: number) =>
  api.get(`/api/owner/store/${storeId}/sales/monthly-detail?year=${year}&month=${month}`);

// ───────── 계약 이력 ─────────
export interface ContractHistoryEntry {
  valid_from: string;
  valid_to: string | null;
  salary_type: string | null;
  hourly_rate: number | null;
  monthly_salary: number | null;
  annual_salary: number | null;
  weekly_hours: number | null;
}

export const getContractHistory = (storeId: number, staffId: number, year: number, month: number) =>
  api.get<ContractHistoryEntry[]>(`/api/owner/store/${storeId}/staff/${staffId}/contract-history`, { year, month });

// ───────── 근태 기준 ─────────
export const updateAttendanceStandard = (storeId: number, payload: Record<string, unknown>) =>
  api.put(`/api/owner/store/${storeId}/attendance-standard`, payload);

// ───────── 직원 ─────────
export const getStaffList = (storeId: number) =>
  api.get(`/api/owner/store/${storeId}/staffs`);

export const getStaffDetail = (storeId: number, staffId: number) =>
  api.get(`/api/owner/store/${storeId}/staff/${staffId}`);

export const updateStaffContract = (storeId: number, staffId: number, data: Record<string, unknown>) =>
  api.put(`/api/owner/store/${storeId}/staff/${staffId}/contract`, data);

export const updateStaffWorkSchedule = (
  storeId: number,
  staffId: number,
  items: { day_of_week: number; shift_id: number }[],
) => api.put(`/api/owner/store/${storeId}/staff/${staffId}/work-schedule`, { items });

type DocFilePayload = { uri: string; name: string; type: string; webFile?: File };

const appendDocFile = (fd: FormData, key: string, f: DocFilePayload) => {
  if (f.webFile) {
    fd.append(key, f.webFile, f.name);
  } else {
    fd.append(key, f as unknown as Blob);
  }
};

export const updateStaffDocuments = (
  storeId: number,
  staffId: number,
  payload: {
    resume?: DocFilePayload | null;
    employment_contract?: DocFilePayload | null;
    health_certificate?: DocFilePayload | null;
    delete_fields?: string[];
  },
) => {
  const fd = new FormData();
  if (payload.resume) appendDocFile(fd, "resume", payload.resume);
  if (payload.employment_contract) appendDocFile(fd, "employment_contract", payload.employment_contract);
  if (payload.health_certificate) appendDocFile(fd, "health_certificate", payload.health_certificate);
  if (payload.delete_fields?.length) fd.append("delete_fields", payload.delete_fields.join(","));
  return api.putForm(`/api/owner/store/${storeId}/staff/${staffId}/documents`, fd);
};

export const acceptMemberRequest = (storeId: number, requestId: number) =>
  api.post(`/api/owner/store/${storeId}/member-requests/${requestId}/accept`);

export const rejectMemberRequest = (storeId: number, requestId: number) =>
  api.post(`/api/owner/store/${storeId}/member-requests/${requestId}/reject`);

export const getMemberRequests = (storeId: number) =>
  api.get(`/api/owner/store/${storeId}/member-requests`);

// ───────── 스케줄 ─────────
export interface OwnerSchedule {
  id: number;
  work_date: string;
  employee_id: number;
  employee_name: string;
  shift_id: number | null;
  shift_name: string | null;
  work_start: string | null;
  work_end: string | null;
  is_holiday: boolean;
  is_substitution: boolean;
}

export interface ScheduleCreatePayload {
  employee_id: number;
  shift_id?: number | null;
  work_date: string;
  work_start?: string | null;
  work_end?: string | null;
  is_holiday?: boolean;
  is_substitution?: boolean;
}

export const getOwnerSchedules = (storeId: number, year: number, month: number) =>
  api.get<OwnerSchedule[]>(`/api/owner/store/${storeId}/schedules`, { year, month });

export const createOwnerSchedule = (storeId: number, payload: ScheduleCreatePayload) =>
  api.post<{ id: number }>(`/api/owner/store/${storeId}/schedules`, payload);

export const bulkCreateOwnerSchedules = (storeId: number, schedules: ScheduleCreatePayload[]) =>
  api.post<{ ids: number[]; count: number }>(`/api/owner/store/${storeId}/schedules/bulk`, { schedules });

export const deleteOwnerSchedule = (storeId: number, scheduleId: number) =>
  api.delete<{ ok: boolean }>(`/api/owner/store/${storeId}/schedules/${scheduleId}`);

export const updateOwnerSchedule = (
  storeId: number,
  scheduleId: number,
  payload: Partial<ScheduleCreatePayload>,
) => api.put<{ id: number }>(`/api/owner/store/${storeId}/schedules/${scheduleId}`, payload);

// ───────── 스케줄 변경 요청 ─────────
export interface OwnerScheduleChangeRequest {
  id: number;
  employee_name: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  origin_date: string | null;
  origin_start: string | null;
  origin_end: string | null;
  desired_date: string;
  desired_start: string | null;
  desired_end: string | null;
  reason: string | null;
  created_at: string;
}

export const getOwnerScheduleRequests = (storeId: number) =>
  api.get<OwnerScheduleChangeRequest[]>(`/api/owner/store/${storeId}/schedule-requests`);

export const handleOwnerScheduleRequest = (
  storeId: number,
  reqId: number,
  status: "approved" | "rejected",
) => api.put(`/api/owner/store/${storeId}/schedule-requests/${reqId}`, { status });

// ───────── 급여명세서 ─────────
export const getPayslips = (storeId: number, year?: number, month?: number) =>
  api.get(`/api/owner/store/${storeId}/payslips`, { year, month });

export const getPayslipMonths = (storeId: number) =>
  api.get(`/api/owner/store/${storeId}/payslips/months`);

export const getPayslipDetail = (storeId: number, payslipId: number) =>
  api.get(`/api/owner/store/${storeId}/payslips/${payslipId}`);

export const updatePayslip = (storeId: number, payslipId: number, data: Record<string, unknown>) =>
  api.patch(`/api/owner/store/${storeId}/payslips/${payslipId}`, data);

export const publishPayslip = (storeId: number, payslipId: number) =>
  api.post(`/api/owner/store/${storeId}/payslips/${payslipId}/publish`);

export const transferPayslip = (storeId: number, payslipId: number) =>
  api.post(`/api/owner/store/${storeId}/payslips/${payslipId}/transfer`);

export const generatePayslips = (storeId: number, year: number, month: number, staffId?: number) =>
  api.post<{ created: any[]; failed: any[] }>(`/api/owner/store/${storeId}/payslips/generate`, {
    year,
    month,
    generate_all: staffId == null,
    ...(staffId != null ? { staff_id: staffId } : {}),
  });

// ───────── 마감 보고 ─────────
export interface ClosingReport {
  id: number;
  report_date: string;
  card_sales: number;
  cash_sales: number;
  transfer_sales: number;
  gift_sales: number;
  gross_sales: number;
  discount_amount: number;
  refund_amount: number;
  net_sales: number;
  cash_on_hand: number;
  cash_shortage: number;
  receipt_image_url: string | null;
  manager_note: string | null;
  created_at: string;
  employee_id?: number;
  employee_name?: string;
}

export interface ClosingReportsTodaySummary {
  is_completed: boolean;
  totals: {
    card_sales: number;
    cash_sales: number;
    transfer_sales: number;
    gift_sales: number;
    gross_sales: number;
    discount_amount: number;
    refund_amount: number;
    net_sales: number;
    cash_on_hand: number;
    cash_shortage: number;
  };
  reports: ClosingReport[];
}

export const getClosingReports = (storeId: number, year?: number, month?: number) =>
  api.get<ClosingReport[]>(`/api/owner/store/${storeId}/closing-reports`, { year, month });

export const getClosingReportsToday = (storeId: number) =>
  api.get<ClosingReportsTodaySummary>(`/api/owner/store/${storeId}/closing-reports/today`);

export const updateClosingReport = (storeId: number, reportId: number, data: Record<string, unknown>) =>
  api.put(`/api/owner/store/${storeId}/closing-reports/${reportId}`, data);

// ───────── 마이 페이지 ─────────
export const getOwnerInfo = (memberId: number, storeId: number) =>
  api.get(`/api/owner/mypage/${memberId}/info`, { store_id: storeId });

export const getOwnerStores = (memberId: number) =>
  api.get(`/api/owner/mypage/${memberId}/stores`);

export const updateOwnerNickname = (storeId: number, storeMemberId: number, nickname: string) =>
  api.put(`/api/owner/mypage/${storeId}/nickname`, { member_id: storeMemberId, nickname });

export const deleteOwnerProfileImage = (storeId: number, storeMemberId: number) =>
  api.delete(`/api/owner/mypage/${storeId}/profile-image?store_member_id=${storeMemberId}`);

export const uploadOwnerProfileImage = (
  storeId: number,
  storeMemberId: number,
  image: { uri: string; name: string; type: string },
) => {
  const fd = new FormData();
  fd.append("store_member_id", String(storeMemberId));
  fd.append("image", { uri: image.uri, name: image.name, type: image.type } as any);
  return api.postForm<{ image_url: string }>(`/api/owner/mypage/${storeId}/profile-image`, fd);
};
