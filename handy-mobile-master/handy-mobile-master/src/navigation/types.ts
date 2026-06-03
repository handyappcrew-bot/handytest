import type { NativeStackScreenProps } from "@react-navigation/native-stack";

/** 라우트 명과 파라미터 정의 (web routes 와 1:1 매핑) */
export type RootStackParamList = {
  // ─ 인증 / 홈 ─
  Onboarding: undefined;
  Login: undefined;
  OwnerHome: undefined;
  EmployeeHome: undefined;

  // ─ 비밀번호 찾기 ─
  FindPassword: undefined;
  FindPasswordVerify: { phone: string };
  FindPasswordReset: { phone: string };

  // ─ 회원가입 / 온보딩 (Phase 1) ─
  Signup: { type?: "general" | "social"; socialToken?: string } | undefined;
  CodeVerify: { phone: string; type?: "general" | "social"; socialToken?: string };
  PasswordPage: { phone: string; type?: "general" | "social"; socialToken?: string };
  ProfileInfo: { phone: string; password?: string; type?: "general" | "social"; socialToken?: string };
  ProfilePhoto: {
    phone: string;
    password?: string;
    name: string;
    birthdate: string;
    gender: string;
    type?: "general" | "social";
    socialToken?: string;
    agreedTerms: boolean;
  };
  SignupComplete: { name: string };
  TermsDetail: { id: string };
  MemberType: { canBack?: boolean } | undefined;

  // ─ 사장 사업자 인증 ─
  OwnerBusinessVerify: undefined;
  OwnerBusinessUpload: {
    rawDigits: string;
    storeName: string;
    address: string;
    addressDetail?: string;
    businessType: string;
    ownerName: string;
    ownerPhone: string;
  };

  // ─ 직원 매장 등록 ─
  EmployeeStoreRegistration: undefined;
  EmployeePending: undefined;
  EmployeeApproved: { storeName?: string } | undefined;
  EmployeeRejected: { storeName?: string } | undefined;

  // ─ 사장 (Phase 2) ─
  OwnerScheduleManagement: { initialTab?: "주간 일정" | "월간 일정" | "일정 변경 요청" } | undefined;
  OwnerAttendanceManagement: undefined;
  OwnerAttendanceDetail: { staffId: number; name: string; imageUrl?: string | null };
  OwnerSalesManagement: undefined;
  OwnerSalesDailyDetail: { year: number; month: number; day: number };
  OwnerSalesMonthlyDetail: { year: number; month: number };
  OwnerStaffManagement: { initialTab?: "관리" | "가입요청" | "초대" } | undefined;
  OwnerStaffDetail: { staffId: number };
  OwnerStaffEdit: { staffId: number; section?: "계약정보" | "세금" | "인적사항" | "메모" | "계약서" | "근무상태" };
  OwnerSalaryManagement: undefined;
  PayslipDetail: { payslipId: number; name?: string; year?: number; month?: number };
  OwnerStoreInfo: undefined;
  OwnerStoreInfoEdit: { storeInfo: any };
  OwnerStoreHours: undefined;
  OwnerStoreDelete: { storeId: number };
  OwnerProfile: undefined;
  OwnerProfileEdit: undefined;

  // ─ 직원 (Phase 3) ─
  EmployeeSchedule: undefined;
  EmployeeAttendance: undefined;
  EmployeeSalary: undefined;
  EmployeePayStubDetail: { payslipId: number };
  EmployeeProfile: undefined;
  EmployeeProfileEdit: { profileData?: any } | undefined;
  ScheduleChangeRequest: undefined;
  VacationRequest: undefined;
  ClosingReport: undefined;

  // ─ 공통 (Phase 4) ─
  Notifications: undefined;
  BoardList: undefined;
  BoardDetail: { id: number };
  BoardWrite: { editPost?: { id: number; category: string; title: string; content: string; photos?: string[] } } | undefined;
  Announcements: undefined;
  AnnouncementDetail: { id: number };
  FAQ: undefined;
  Feedback: undefined;
  FeedbackDetail: { id: number };
  FeedbackWrite: undefined;
  PasswordChange: undefined;
  Withdrawal: undefined;

  // ─ 사장 일정 액션 화면 (Phase 7) ─
  OwnerScheduleAdd: undefined;
  OwnerScheduleDelete: undefined;
  OwnerScheduleChange: undefined;
  OwnerVacationSetting: undefined;

  // ─ 보강 화면 (Phase 6) ─
  OwnerClosingReport: undefined;
  PushNotificationSetting: undefined;
  OwnerAttendanceStandard: undefined;
  OwnerAttendanceEdit: {
    staffId: number;
    staffName: string;
    date: string;
    status: string | null;
    clockIn: string | null;
    clockOut: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    breakMinutes?: number | null;
  };
  OwnerStoreHoursParts: undefined;
  PayslipEdit: { payslipId: number };
  SalaryDetail: { name: string; year?: number; month?: number };
  AttendanceRecordEdit: { detail?: { date?: string; startTime?: string; endTime?: string; status?: string; breakMinutes?: number; year?: number; month?: number; dayOfWeek?: string; shiftTypes?: string[] } } | undefined;
  NotificationDeepLink: { type: "schedule_change" | "schedule_added"; id: number };
  ScheduleNotificationDetail: {
    notifType: "added" | "changed" | "deleted";
    workDate: string;
    message: string;
    workStart?: string | null;
    workEnd?: string | null;
    shiftName?: string | null;
    oldStart?: string | null;
    oldEnd?: string | null;
    newStart?: string | null;
    newEnd?: string | null;
  };
  AttendanceUnclosedDetail: {
    workDate: string;
    startTime?: string | null;
  };
  NotFound: undefined;
  Pending: { title?: string; message?: string; subMessage?: string } | undefined;
};

export type ScreenProps<R extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, R>;
