import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Linking, View } from "react-native";
import * as Notifications from "expo-notifications";
import { localStorage } from "@/utils/storage";
import { logScreen } from "@/utils/analytics";
import { getAuthToken, setAuthToken, setRefreshToken, setOnUnauthorized, clearOnUnauthorized, api } from "@/api/client";
import LoginScreen from "@/screens/LoginScreen";
import OwnerHomeScreen from "@/screens/OwnerHomeScreen";
import EmployeeHomeScreen from "@/screens/EmployeeHomeScreen";
// 비밀번호 찾기
import FindPasswordScreen from "@/screens/FindPasswordScreen";
import FindPasswordVerifyScreen from "@/screens/FindPasswordVerifyScreen";
import FindPasswordResetScreen from "@/screens/FindPasswordResetScreen";

// 온보딩
import OnboardingScreen from "@/screens/onboarding/OnboardingScreen";

// 회원가입
import SignupScreen from "@/screens/signup/SignupScreen";
import CodeVerifyScreen from "@/screens/signup/CodeVerifyScreen";
import PasswordScreen from "@/screens/signup/PasswordScreen";
import ProfileInfoScreen from "@/screens/signup/ProfileInfoScreen";
import ProfilePhotoScreen from "@/screens/signup/ProfilePhotoScreen";
import SignupCompleteScreen from "@/screens/signup/SignupCompleteScreen";
import TermsDetailScreen from "@/screens/signup/TermsDetailScreen";
import MemberTypeScreen from "@/screens/onboarding/MemberTypeScreen";
import OwnerBusinessVerifyScreen from "@/screens/owner/OwnerBusinessVerifyScreen";
import OwnerBusinessUploadScreen from "@/screens/owner/OwnerBusinessUploadScreen";
import EmployeeStoreRegistrationScreen from "@/screens/employee/EmployeeStoreRegistrationScreen";
import EmployeePendingScreen from "@/screens/employee/EmployeePendingScreen";
import EmployeeApprovedScreen from "@/screens/employee/EmployeeApprovedScreen";
import EmployeeRejectedScreen from "@/screens/employee/EmployeeRejectedScreen";

// ─ 사장 핵심 (Phase 2) ─
import OwnerScheduleManagementScreen from "@/screens/owner/OwnerScheduleManagementScreen";
import OwnerAttendanceManagementScreen from "@/screens/owner/OwnerAttendanceManagementScreen";
import OwnerAttendanceDetailScreen from "@/screens/owner/OwnerAttendanceDetailScreen";
import OwnerSalesManagementScreen from "@/screens/owner/OwnerSalesManagementScreen";
import OwnerSalesDailyDetailScreen from "@/screens/owner/OwnerSalesDailyDetailScreen";
import OwnerSalesMonthlyDetailScreen from "@/screens/owner/OwnerSalesMonthlyDetailScreen";
import OwnerStaffManagementScreen from "@/screens/owner/OwnerStaffManagementScreen";
import OwnerStaffDetailScreen from "@/screens/owner/OwnerStaffDetailScreen";
import OwnerStaffEditScreen from "@/screens/owner/OwnerStaffEditScreen";
import OwnerSalaryManagementScreen from "@/screens/owner/OwnerSalaryManagementScreen";
import PayslipDetailScreen from "@/screens/owner/PayslipDetailScreen";
import OwnerStoreInfoScreen from "@/screens/owner/OwnerStoreInfoScreen";
import OwnerStoreInfoEditScreen from "@/screens/owner/OwnerStoreInfoEditScreen";
import OwnerStoreHoursScreen from "@/screens/owner/OwnerStoreHoursScreen";
import OwnerStoreDeleteScreen from "@/screens/owner/OwnerStoreDeleteScreen";
import OwnerProfileScreen from "@/screens/owner/OwnerProfileScreen";
import OwnerProfileEditScreen from "@/screens/owner/OwnerProfileEditScreen";

// ─ 직원 핵심 (Phase 3) ─
import EmployeeScheduleScreen from "@/screens/employee/EmployeeScheduleScreen";
import EmployeeAttendanceScreen from "@/screens/employee/EmployeeAttendanceScreen";
import EmployeeSalaryScreen from "@/screens/employee/EmployeeSalaryScreen";
import EmployeePayStubDetailScreen from "@/screens/employee/EmployeePayStubDetailScreen";
import EmployeeProfileScreen from "@/screens/employee/EmployeeProfileScreen";
import EmployeeProfileEditScreen from "@/screens/employee/EmployeeProfileEditScreen";
import ScheduleChangeRequestScreen from "@/screens/employee/ScheduleChangeRequestScreen";
import VacationRequestScreen from "@/screens/employee/VacationRequestScreen";
import ClosingReportScreen from "@/screens/employee/ClosingReportScreen";

// ─ 공통 (Phase 4) ─
import NotificationsScreen from "@/screens/common/NotificationsScreen";
import BoardListScreen from "@/screens/common/BoardListScreen";
import BoardDetailScreen from "@/screens/common/BoardDetailScreen";
import BoardWriteScreen from "@/screens/common/BoardWriteScreen";
import AnnouncementsScreen from "@/screens/common/AnnouncementsScreen";
import AnnouncementDetailScreen from "@/screens/common/AnnouncementDetailScreen";
import FAQScreen from "@/screens/common/FAQScreen";
import FeedbackScreen from "@/screens/common/FeedbackScreen";
import FeedbackDetailScreen from "@/screens/common/FeedbackDetailScreen";
import FeedbackWriteScreen from "@/screens/common/FeedbackWriteScreen";
import PasswordChangeScreen from "@/screens/common/PasswordChangeScreen";
import WithdrawalScreen from "@/screens/common/WithdrawalScreen";

// ─ 사장 일정 액션 화면 (Phase 7) ─
import OwnerScheduleAddScreen from "@/screens/owner/OwnerScheduleAddScreen";
import OwnerScheduleDeleteScreen from "@/screens/owner/OwnerScheduleDeleteScreen";
import OwnerScheduleChangeScreen from "@/screens/owner/OwnerScheduleChangeScreen";
import OwnerVacationSettingScreen from "@/screens/owner/OwnerVacationSettingScreen";

// ─ 보강 화면 (Phase 6) ─
import OwnerClosingReportScreen from "@/screens/owner/OwnerClosingReportScreen";
import PushNotificationSettingScreen from "@/screens/common/PushNotificationSettingScreen";
import OwnerAttendanceStandardScreen from "@/screens/owner/OwnerAttendanceStandardScreen";
import OwnerAttendanceEditScreen from "@/screens/owner/OwnerAttendanceEditScreen";
import OwnerStoreHoursPartsScreen from "@/screens/owner/OwnerStoreHoursPartsScreen";
import PayslipEditScreen from "@/screens/owner/PayslipEditScreen";
import SalaryDetailScreen from "@/screens/owner/SalaryDetailScreen";
import AttendanceRecordEditScreen from "@/screens/employee/AttendanceRecordEditScreen";
import NotificationDeepLinkScreen from "@/screens/common/NotificationDeepLinkScreen";
import ScheduleNotificationDetailScreen from "@/screens/employee/ScheduleNotificationDetailScreen";
import AttendanceUnclosedDetailScreen from "@/screens/employee/AttendanceUnclosedDetailScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import PendingScreen from "@/screens/PendingScreen";

import { getMyStores, getOnboardingStatus } from "@/api/auth";
import { secureStorage } from "@/utils/secureStorage";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<keyof RootStackParamList>("Login");
  const navigationRef = useRef<any>(null);

  // Handle OAuth deep link callbacks (handytest://oauth/callback?token=XXX)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      console.log("[DeepLink] received:", url);
      try {
        if (url.includes("://oauth/callback")) {
          const tokenMatch = url.match(/[?&]token=([^&]+)/);
          const token = tokenMatch?.[1];
          console.log("[DeepLink] oauth/callback token:", token ? "present" : "missing");
          if (!token) return;
          const data = await api.get<{ access_token: string; refresh_token: string }>(
            `/api/auth/mobile/exchange?token=${encodeURIComponent(token)}`
          );
          console.log("[DeepLink] /mobile/exchange success");
          setAuthToken(data.access_token);
          setRefreshToken(data.refresh_token);
          const pending = localStorage.getItem("pendingSocialProvider");
          if (pending) {
            localStorage.setItem("socialProvider", pending);
            localStorage.removeItem("pendingSocialProvider");
            logLogin(pending);
          }
          const stores = await getMyStores();
          const storeArr = Array.isArray(stores) ? stores : [];
          const ownerStore = storeArr.find((s: any) => s.role === "owner");
          const active = ownerStore ?? storeArr[0];
          if (active) {
            localStorage.setItem("currentRole", active.role);
            localStorage.setItem("currentStoreId", String(active.store_id));
            localStorage.setItem("currentMemberId", String(active.store_member_id));
            localStorage.setItem("currentStoreName", active.store_name ?? "");
            navigationRef.current?.reset({
              index: 0,
              routes: [{ name: active.role === "owner" ? "OwnerHome" : "EmployeeHome" }],
            });
          }
        } else if (url.includes("://oauth/signup")) {
          const tokenMatch = url.match(/[?&]token=([^&]+)/);
          const socialToken = tokenMatch?.[1];
          console.log("[DeepLink] oauth/signup socialToken:", socialToken ? "present" : "missing");
          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: "Signup", params: { type: "social", socialToken } }],
          });
        }
      } catch (e) {
        console.log("[DeepLink] error:", e);
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    return () => subscription.remove();
  }, []);

  // 푸시 알림 탭 → 화면 이동
  useEffect(() => {
    const handleNotificationTap = (response: Notifications.NotificationResponse) => {
      const nav = navigationRef.current;
      if (!nav) return;
      const data = response.notification.request.content.data as Record<string, any>;
      const title = response.notification.request.content.title ?? "";
      // 백엔드가 type을 data에 포함하면 우선 사용, 아니면 push_title로 폴백
      const type: string = data?.type || "";
      const role = localStorage.getItem("currentRole");

      if (role === "owner") {
        if (type === "closing_report" || title === "마감 보고") {
          nav.navigate("OwnerSalesManagement");
        } else if (type === "staff_mgmt" || title === "가입 요청") {
          nav.navigate("OwnerStaffManagement", { initialTab: "가입요청" });
        } else if (type === "schedule_change" || title === "일정 변경 요청" || title === "출근기록 수정 요청") {
          nav.navigate("OwnerScheduleManagement", { initialTab: "일정 변경 요청" });
        } else if (type === "probation_end" || title === "수습 종료 안내") {
          nav.navigate("OwnerStaffManagement", { initialTab: "관리" });
        } else if (type === "salary") {
          nav.navigate("OwnerSalaryManagement");
        } else if (type === "board" || type === "notice" || title === "새 게시글") {
          nav.navigate("BoardList");
        } else if (type === "attendance" || type === "check_in" || type === "late" || type === "absent" || type === "early_leave") {
          nav.navigate("OwnerAttendanceManagement");
        } else {
          nav.navigate("Notifications");
        }
      } else if (role === "employee") {
        if (type === "salary") {
          nav.navigate("EmployeeSalary");
        } else if (type === "schedule" || type === "schedule_change" || type === "schedule_approved" || type === "schedule_rejected" || type === "vacation") {
          nav.navigate("EmployeeSchedule");
        } else if (type === "board" || type === "notice") {
          nav.navigate("BoardList");
        } else if (type === "attendance" || type === "late" || type === "absent" || type === "check_in" || type === "check_out" || type === "early_leave") {
          nav.navigate("EmployeeAttendance");
        } else if (type === "member_status") {
          nav.navigate("EmployeeProfile");
        } else {
          nav.navigate("Notifications");
        }
      }
    };

    try {
      const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationTap);
      return () => sub.remove();
    } catch {
      return;
    }
  }, []);

  // 토큰 만료 시 전역 401 핸들러: 로그인으로 강제 이동
  useEffect(() => {
    setOnUnauthorized(() => {
      // 토큰이 없는 상태(비로그인)의 401은 무시 — LoginScreen의 getMyStores 등
      if (!getAuthToken()) return;
      setAuthToken(null);
      setRefreshToken(null);
      localStorage.removeItem("currentRole");
      navigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
    });
    return () => clearOnUnauthorized();
  }, []);

  useEffect(() => {
    (async () => {
      await secureStorage.init(["auth_token", "refresh_token"]);
      await localStorage.init();

      // First-ever launch: show onboarding
      const onboardingSeen = localStorage.getItem("onboarding_seen");
      if (!onboardingSeen) {
        setInitial("Onboarding");
        setReady(true);
        return;
      }

      const token = getAuthToken();
      const role = localStorage.getItem("currentRole");

      if (token) {
        try {
          const ob = await getOnboardingStatus();
          if (ob.status === "employee_pending") {
            localStorage.setItem("pendingMemberRequest", "true");
            setInitial("EmployeePending");
          } else if (ob.status === "employee_rejected") {
            const wasPending = localStorage.getItem("pendingMemberRequest");
            if (wasPending) {
              localStorage.setItem("pendingStoreName", ob.store_name ?? "");
              // pendingMemberRequest는 EmployeeRejectedScreen 버튼 탭 시 제거
              setInitial("EmployeeRejected");
            } else {
              setInitial("MemberType");
            }
          } else if (ob.status === "ready") {
            const stores = await getMyStores();
            const savedMemberId = localStorage.getItem("currentMemberId");
            const savedRole = localStorage.getItem("currentRole");
            const wasPending = localStorage.getItem("pendingMemberRequest");
            const pendingStoreId = localStorage.getItem("pendingStoreId");
            const stored = savedMemberId
              ? stores.find((s: any) => String(s.store_member_id) === savedMemberId)
              : null;
            const savedRoleStore = savedRole
              ? stores.find((s: any) => s.role === savedRole)
              : null;
            const ownerStore = stores.find((s: any) => s.role === "owner");

            if (wasPending && pendingStoreId) {
              // Check if the specific pending store has been approved
              const newlyApproved = stores.find((s: any) => String(s.store_id) === pendingStoreId);
              if (newlyApproved) {
                localStorage.setItem("currentRole", newlyApproved.role);
                localStorage.setItem("currentStoreId", String(newlyApproved.store_id));
                localStorage.setItem("currentMemberId", String(newlyApproved.store_member_id));
                localStorage.setItem("currentStoreName", newlyApproved.store_name ?? "");
                localStorage.setItem("pendingStoreName", newlyApproved.store_name);
                localStorage.removeItem("pendingStoreId");
                setInitial("EmployeeApproved");
              } else {
                // New store still pending — go to pending screen
                setInitial("EmployeePending");
              }
            } else {
              const active = stored ?? savedRoleStore ?? ownerStore ?? stores[0];
              if (active) {
                localStorage.setItem("currentRole", active.role);
                localStorage.setItem("currentStoreId", String(active.store_id));
                localStorage.setItem("currentMemberId", String(active.store_member_id));
                localStorage.setItem("currentStoreName", active.store_name ?? "");
                if (wasPending && active.role === "employee") {
                  localStorage.setItem("pendingStoreName", active.store_name);
                  // pendingMemberRequest는 EmployeeApprovedScreen 버튼 탭 시 제거
                  setInitial("EmployeeApproved");
                } else {
                  localStorage.removeItem("pendingMemberRequest");
                  if (active.role === "owner") {
                    const sid = String(active.store_id);
                    const setupDone = localStorage.getItem(`store_setup_done_${sid}`);
                    if (!setupDone) localStorage.setItem("owner_onboarding_mode", sid);
                    setInitial(setupDone ? "OwnerHome" : "OwnerStoreHours");
                  } else {
                    setInitial("EmployeeHome");
                  }
                }
              }
            }
          } else {
            // no_store / owner_pending → 유형 선택 화면
            setInitial("MemberType");
          }
        } catch (e: any) {
          if (e?.status === 401) {
            setAuthToken(null);
            setRefreshToken(null);
          }
          // 서버 다운, 네트워크 오류 등 모든 예외 → 로그인 화면으로
          setInitial("Login");
        }
      }
      setReady(true);
    })();
  }, []);

  const routeNameRef = useRef<string | undefined>();

  if (!ready) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
      onStateChange={() => {
        const current = navigationRef.current?.getCurrentRoute()?.name;
        if (current && current !== routeNameRef.current) {
          logScreen(current);
          routeNameRef.current = current;
        }
      }}
    >
      <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        {/* 온보딩 */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "fade" }} />

        {/* 인증 / 홈 */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerHome" component={OwnerHomeScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="EmployeeHome" component={EmployeeHomeScreen} options={{ animation: "fade" }} />

        {/* 비밀번호 찾기 */}
        <Stack.Screen name="FindPassword" component={FindPasswordScreen} />
        <Stack.Screen name="FindPasswordVerify" component={FindPasswordVerifyScreen} />
        <Stack.Screen name="FindPasswordReset" component={FindPasswordResetScreen} />

        {/* 회원가입 5단계 */}
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="CodeVerify" component={CodeVerifyScreen} />
        <Stack.Screen name="PasswordPage" component={PasswordScreen} />
        <Stack.Screen name="ProfileInfo" component={ProfileInfoScreen} />
        <Stack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
        <Stack.Screen name="SignupComplete" component={SignupCompleteScreen} options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="TermsDetail" component={TermsDetailScreen} />

        {/* 회원 유형 */}
        <Stack.Screen name="MemberType" component={MemberTypeScreen} />

        {/* 사장 사업자 인증 */}
        <Stack.Screen name="OwnerBusinessVerify" component={OwnerBusinessVerifyScreen} />
        <Stack.Screen name="OwnerBusinessUpload" component={OwnerBusinessUploadScreen} />

        {/* 직원 매장 등록 */}
        <Stack.Screen name="EmployeeStoreRegistration" component={EmployeeStoreRegistrationScreen} />
        <Stack.Screen name="EmployeePending" component={EmployeePendingScreen} options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="EmployeeApproved" component={EmployeeApprovedScreen} options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="EmployeeRejected" component={EmployeeRejectedScreen} options={{ animation: "fade", gestureEnabled: false }} />

        {/* 사장 핵심 (Phase 2) — 탭 목적지: 1depth fade / 서브페이지: 기본 fade */}
        <Stack.Screen name="OwnerScheduleManagement" component={OwnerScheduleManagementScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerAttendanceManagement" component={OwnerAttendanceManagementScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerAttendanceDetail" component={OwnerAttendanceDetailScreen} />
        <Stack.Screen name="OwnerSalesManagement" component={OwnerSalesManagementScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerSalesDailyDetail" component={OwnerSalesDailyDetailScreen} />
        <Stack.Screen name="OwnerSalesMonthlyDetail" component={OwnerSalesMonthlyDetailScreen} />
        <Stack.Screen name="OwnerStaffManagement" component={OwnerStaffManagementScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerStaffDetail" component={OwnerStaffDetailScreen} />
        <Stack.Screen name="OwnerStaffEdit" component={OwnerStaffEditScreen} />
        <Stack.Screen name="OwnerSalaryManagement" component={OwnerSalaryManagementScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} />
        <Stack.Screen name="OwnerStoreInfo" component={OwnerStoreInfoScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerStoreInfoEdit" component={OwnerStoreInfoEditScreen} />
        <Stack.Screen name="OwnerStoreHours" component={OwnerStoreHoursScreen} />
        <Stack.Screen name="OwnerStoreDelete" component={OwnerStoreDeleteScreen} />
        <Stack.Screen name="OwnerProfile" component={OwnerProfileScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="OwnerProfileEdit" component={OwnerProfileEditScreen} />

        {/* 직원 핵심 (Phase 3) — 탭 목적지: 1depth fade / 서브페이지: 기본 fade */}
        <Stack.Screen name="EmployeeSchedule" component={EmployeeScheduleScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="EmployeeAttendance" component={EmployeeAttendanceScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="EmployeeSalary" component={EmployeeSalaryScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="EmployeePayStubDetail" component={EmployeePayStubDetailScreen} />
        <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="EmployeeProfileEdit" component={EmployeeProfileEditScreen} />
        <Stack.Screen name="ScheduleChangeRequest" component={ScheduleChangeRequestScreen} />
        <Stack.Screen name="VacationRequest" component={VacationRequestScreen} />
        <Stack.Screen name="ClosingReport" component={ClosingReportScreen} />

        {/* 공통 (Phase 4) */}
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="BoardList" component={BoardListScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="BoardDetail" component={BoardDetailScreen} />
        <Stack.Screen name="BoardWrite" component={BoardWriteScreen} />
        <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
        <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} />
        <Stack.Screen name="FAQ" component={FAQScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="FeedbackDetail" component={FeedbackDetailScreen} />
        <Stack.Screen name="FeedbackWrite" component={FeedbackWriteScreen} />
        <Stack.Screen name="PasswordChange" component={PasswordChangeScreen} />
        <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />

        {/* 사장 일정 액션 화면 (Phase 7) */}
        <Stack.Screen name="OwnerScheduleAdd" component={OwnerScheduleAddScreen} />
        <Stack.Screen name="OwnerScheduleDelete" component={OwnerScheduleDeleteScreen} />
        <Stack.Screen name="OwnerScheduleChange" component={OwnerScheduleChangeScreen} />
        <Stack.Screen name="OwnerVacationSetting" component={OwnerVacationSettingScreen} />

        {/* 보강 화면 (Phase 6) */}
        <Stack.Screen name="OwnerClosingReport" component={OwnerClosingReportScreen} />
        <Stack.Screen name="PushNotificationSetting" component={PushNotificationSettingScreen} />
        <Stack.Screen name="OwnerAttendanceStandard" component={OwnerAttendanceStandardScreen} />
        <Stack.Screen name="OwnerAttendanceEdit" component={OwnerAttendanceEditScreen} />
        <Stack.Screen name="OwnerStoreHoursParts" component={OwnerStoreHoursPartsScreen} />
        <Stack.Screen name="PayslipEdit" component={PayslipEditScreen} />
        <Stack.Screen name="SalaryDetail" component={SalaryDetailScreen} />
        <Stack.Screen name="AttendanceRecordEdit" component={AttendanceRecordEditScreen} />
        <Stack.Screen name="NotificationDeepLink" component={NotificationDeepLinkScreen} />
        <Stack.Screen name="ScheduleNotificationDetail" component={ScheduleNotificationDetailScreen} />
        <Stack.Screen name="AttendanceUnclosedDetail" component={AttendanceUnclosedDetailScreen} />
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
        <Stack.Screen name="Pending" component={PendingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
