import React, { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, FlatList, Pressable } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from "react-native-reanimated";
import { ChevronLeft, Trash2, Settings2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import { useFocusEffect } from "@react-navigation/native";
import { getNotifications, markNotificationRead, deleteNotification, NotificationItem } from "@/api/public";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";
import { useNavToast } from "@/components/NavToast";
import { useToast } from "@/components/Toast";

// ── 날짜 포맷 ───────────────────────────────────────────────────────────────
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const formatNotificationDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const month   = String(d.getMonth() + 1).padStart(2, "0");
  const date    = String(d.getDate()).padStart(2, "0");
  const day     = WEEK_DAYS[d.getDay()];
  const hours   = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm    = hours < 12 ? "오전" : "오후";
  const h       = hours % 12 === 0 ? 12 : hours % 12;
  return `${month}.${date}(${day}) ${ampm} ${h}:${minutes}`;
};

const formatTimeOnly = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const hours   = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm    = hours < 12 ? "오전" : "오후";
  const h       = hours % 12 === 0 ? 12 : hours % 12;
  return `${ampm} ${h}:${minutes}`;
};

const getTodayLabel = () => {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_DAYS[d.getDay()]})`;
};

// ── 백엔드 카테고리 → 한국어 레이블 ──────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  staff_mgmt:         "직원관리",
  schedule_change:    "일정",
  probation_end:      "수습종료",
  closing_report:     "마감보고",
  salary:             "급여",
  schedule:           "일정",
  board:              "게시판",
  notice:             "공지",
  attendance:         "근태",
  store:              "매장",
  service:            "서비스",
  member_status:      "매장",
  vacation:           "일정",
  schedule_approved:  "일정",
  schedule_rejected:  "일정",
  absent:             "결근",
  late:               "지각",
  tardiness:          "지각",
  check_in:           "출근",
  check_out:          "퇴근",
  early_leave:        "조기퇴근",
};

const resolveNotifType = (item: NotificationItem): string => {
  const raw: string = (item as any).type ?? (item as any).category ?? "";
  return CATEGORY_LABEL[raw] ?? raw;
};

const ATTEND_TYPE_SET = new Set(["근태", "출근", "퇴근", "지각", "결근", "조기퇴근"]);
const isAttendanceType = (type: string) => ATTEND_TYPE_SET.has(type);

const normalizeNotifMessage = (msg: string) =>
  msg.replace(/올렸어요/g, "작성했어요").replace(/올렸습니다/g, "작성했습니다");

// ── 필터 너비 ────────────────────────────────────────────────────────────────
const getFilterWidth = (label: string) => label.length <= 2 ? 48 : label.length <= 4 ? 60 : 90;

// ── 알림 유형 스타일 ──────────────────────────────────────────────────────────
const NOTIF_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  "마감보고": { bg: "#DCFCE7", color: "#16A34A" },
  "직원관리": { bg: "#FEF3C7", color: "#D97706" },
  "일정변경": { bg: "#FAF5FF", color: "#7C3AED" },
  "수습종료": { bg: "#FFEAE6", color: "#FF3D3D" },
  "근태":     { bg: "#ECFFF1", color: "#10C97D" },
  "매장":     { bg: "#FFF8EE", color: "#FF862D" },
  "일정":     { bg: "#EEF2FF", color: "#4261FF" },
  "급여":     { bg: "#F0FDF4", color: "#16A34A" },
  "공지":     { bg: "#FEF9EC", color: "#D97706" },
  "게시판":   { bg: "#F5F3FF", color: "#7C3AED" },
  "서비스":   { bg: "#F0F7FF", color: "#4261FF" },
};

// ── 역할별 필터 ──────────────────────────────────────────────────────────────
const EMPLOYEE_FILTERS = ["전체", "일정", "급여", "공지", "게시판", "근태", "매장", "서비스"];
const OWNER_FILTERS    = ["전체", "급여", "일정", "게시판", "직원관리", "수습종료", "마감보고", "서비스"];
const ATTEND_FILTERS   = ["전체", "출근", "퇴근", "지각", "결근"];

// ── 근태 유형 스타일 ─────────────────────────────────────────────────────────
const ATTEND_STYLE: Record<string, { bg: string; color: string }> = {
  "출근":    { bg: "#ECFFF1", color: "#10C97D" },
  "퇴근":    { bg: "#E8F3FF", color: "#4261FF" },
  "지각":    { bg: "#FFF3EB", color: "#FF862D" },
  "결근":    { bg: "#FFE8E8", color: "#FF3D3D" },
  "조기퇴근": { bg: "#FDF9DF", color: "#FFB300" },
};


// ── 근태 알림 탭 콘텐츠 ─────────────────────────────────────────────────────
const AttendanceTab: React.FC<{
  realItems: NotificationItem[];
  onPressReal: (item: NotificationItem) => void;
}> = ({ realItems, onPressReal }) => {
  const [filter, setFilter] = useState("전체");

  const filtered = useMemo(() => {
    if (filter === "전체") return realItems;
    return realItems.filter((i) => resolveNotifType(i) === filter);
  }, [filter, realItems]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    realItems.forEach((i) => { const t = resolveNotifType(i); c[t] = (c[t] ?? 0) + 1; });
    return c;
  }, [realItems]);

  const totalCount = realItems.length;
  const isEmpty = filtered.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F7F8" }}>
      {/* 날짜 헤더 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32 }}>
          {getTodayLabel()}
        </Text>
        <Text style={{ fontSize: 13, color: "#93989E", marginTop: 8 }}>
          *당일 발생한 출·퇴근, 지각, 결근 내역만 표시돼요
        </Text>
      </View>

      {/* 필터 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}
      >
        {ATTEND_FILTERS.map((f) => {
          const isActive = filter === f;
          const cnt = f === "전체" ? totalCount : (counts[f] ?? 0);
          return (
            <AnimatedPressable
              key={f}
              onPress={() => setFilter(f)}
              scaleAmount={0.94}
              opacityAmount={0.8}
              style={{
                height: 28, paddingHorizontal: 12, borderRadius: 9999,
                borderWidth: 1,
                borderColor: isActive ? "#4261FF" : "#DBDCDF",
                backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: isActive ? "#4261FF" : "#AAB4BF" }}>
                {f}{cnt > 0 ? ` ${cnt}` : ""}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {isEmpty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: "#AAB4BF" }}>해당 근태 알림이 없어요</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 10 }}>
          {filtered.map((item) => {
                const notifType = resolveNotifType(item);
                const ts = ATTEND_STYLE[notifType] ?? { bg: "#F7F7F8", color: "#70737B" };
                const msg = normalizeNotifMessage((item as any).message ?? (item as any).body ?? "");
                return (
                  <AnimatedPressable
                    key={item.id}
                    onPress={() => onPressReal(item)}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                    style={{
                      backgroundColor: "#FFFFFF", borderRadius: 12,
                      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12,
                      shadowOffset: { width: 2, height: 2 }, elevation: 2,
                      paddingHorizontal: 16, paddingVertical: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: ts.bg }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: ts.color }}>{notifType}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: "#93989E" }}>{formatNotificationDate(item.created_at)}</Text>
                      {!item.is_read && (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4261FF", marginLeft: "auto" }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#292B2E" }}>{msg}</Text>
                  </AnimatedPressable>
                );
              })}
        </ScrollView>
      )}
    </View>
  );
};

// ── 스와이프 삭제 (커스텀 Pan — ReanimatedSwipeable 대체) ──────────────────────
const SWIPE_REVEAL = 72;

const SwipeableNotifRow: React.FC<{
  onDelete: () => void;
  onPress: () => void;
  children: React.ReactNode;
}> = ({ onDelete, onPress, children }) => {
  const translateX = useSharedValue(0);
  const scale      = useSharedValue(1);
  const opacity    = useSharedValue(1);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const deleteWidth = useAnimatedStyle(() => ({
    width: Math.abs(Math.min(translateX.value, 0)),
  }));

  // Pan: 가로 스와이프만 반응, 세로 5px 이상이면 FlatList 스크롤에 양보
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-SWIPE_REVEAL, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < -(SWIPE_REVEAL / 2)) {
        translateX.value = withSpring(-SWIPE_REVEAL, { damping: 20, stiffness: 180 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 180 });
      }
    });

  // Tap: 가로 10px 이상 이동 시 실패 → pan에 양보
  const tap = Gesture.Tap()
    .maxDeltaX(10)
    .onBegin(() => {
      scale.value   = withTiming(0.98, { duration: 80 });
      opacity.value = withTiming(0.85, { duration: 80 });
    })
    .onFinalize(() => {
      scale.value   = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    })
    .onEnd(() => {
      if (translateX.value < -5) {
        // 열려있으면 닫기
        translateX.value = withSpring(0, { damping: 20, stiffness: 180 });
      } else {
        runOnJS(onPress)();
      }
    });

  return (
    <View style={{
      borderRadius: 12,
      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12,
      shadowOffset: { width: 2, height: 2 }, elevation: 2,
      backgroundColor: "#FFFFFF",
      overflow: "hidden",
    }}>
      {/* 삭제 버튼 (카드 뒤에 위치) */}
      <Animated.View style={[{
        position: "absolute", right: 0, top: 0, bottom: 0,
        backgroundColor: "#FF3D3D",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }, deleteWidth]}>
        <Pressable
          onPress={onDelete}
          style={{ flex: 1, width: SWIPE_REVEAL, alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700", marginTop: 2 }}>삭제</Text>
        </Pressable>
      </Animated.View>

      {/* 슬라이드 카드 */}
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Animated.View style={[{ borderRadius: 12, overflow: "hidden", backgroundColor: "#FFFFFF" }, cardStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// ── 메인 화면 ─────────────────────────────────────────────────────────────────
const NotificationsScreen: React.FC<ScreenProps<"Notifications">> = ({ navigation }) => {
  const [items, setItems]   = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState("전체");
  const [ownerTab, setOwnerTab] = useState<"알림" | "근태알림">("알림");
  const [pendingUnclosed, setPendingUnclosed] = useState<{ work_log_id: number; work_date: string } | null>(null);

  const { showNavToast } = useNavToast();
  const { toast } = useToast();
  const storeId      = Number(localStorage.getItem("currentStoreId") ?? 0);
  const currentRole  = localStorage.getItem("currentRole") ?? "employee";
  const isOwner      = currentRole === "owner";
  const isResigned   = !isOwner && localStorage.getItem("employeeWorkingStatus") === "퇴사";

  const filters = isOwner
    ? OWNER_FILTERS
    : isResigned
      ? EMPLOYEE_FILTERS.filter((f) => f !== "게시판")
      : EMPLOYEE_FILTERS;

  useFocusEffect(useCallback(() => {
    if (!isOwner) {
      const raw = localStorage.getItem("pending_unclosed_shift");
      if (raw) {
        try { setPendingUnclosed(JSON.parse(raw)); } catch {}
      } else {
        setPendingUnclosed(null);
      }
    }
  }, [isOwner]));

  useEffect(() => {
    getNotifications(true, storeId)
      .then((rs) => {
        setItems(Array.isArray(rs) ? rs : []);
      })
      .catch((e) => {
        console.warn(e);
        setItems([]);
        toast({ description: "알림을 불러오지 못했어요.", variant: "destructive" });
      });
  }, [storeId]);

  const attendanceItems = useMemo(
    () => isOwner ? items.filter((i) => isAttendanceType(resolveNotifType(i))) : [],
    [items, isOwner],
  );

  const displayItems = useMemo(
    () => isOwner ? items.filter((i) => !isAttendanceType(resolveNotifType(i))) : items,
    [items, isOwner],
  );

  const filtered = useMemo(() => {
    if (filter === "전체") return displayItems;
    return displayItems.filter((i) => resolveNotifType(i) === filter);
  }, [displayItems, filter]);

  // 근태알림 탭 진입 시 모든 미읽음 근태 알림 읽음 처리
  useEffect(() => {
    if (ownerTab !== "근태알림" || !isOwner) return;
    setItems((prev) => {
      const toRead: number[] = [];
      const updated = prev.map((p) => {
        if (isAttendanceType(resolveNotifType(p)) && !p.is_read) {
          toRead.push(p.id);
          return { ...p, is_read: true };
        }
        return p;
      });
      toRead.forEach((id) => markNotificationRead(id).catch((e) => console.warn(e)));
      return updated;
    });
  }, [ownerTab]);

  const handleDeleteItem = (id: number) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    deleteNotification(id).catch((e) => console.warn(e));
  };

  const handleAttendancePress = (item: NotificationItem) => {
    if (!item.is_read) {
      markNotificationRead(item.id).catch((e) => console.warn(e));
      setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_read: true } : p));
    }
    navigation.navigate("OwnerAttendanceManagement");
  };

  const handlePress = async (item: NotificationItem) => {
    const type: string        = resolveNotifType(item);
    const message: string     = (item as any).message ?? item.title ?? item.body ?? "";
    const referenceId: number | undefined =
      (item as any).reference_id ??
      (item.payload?.reference_id as number | undefined) ??
      (item.payload?.id as number | undefined);

    if (!item.is_read) {
      try { await markNotificationRead(item.id); } catch {}
      setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_read: true } : p));
    }

    // ── 게시판 ──────────────────────────────────────────────────────────────
    if (type === "게시판") {
      if (isResigned) {
        showNavToast("퇴사 후에는 게시판에 접근할 수 없어요");
      } else if (referenceId) {
        showNavToast("게시글로 이동했어요"); navigation.navigate("BoardDetail", { id: referenceId });
      } else {
        showNavToast("게시판으로 이동했어요"); navigation.navigate("BoardList");
      }

    // ── 급여 (역할별 분기) ────────────────────────────────────────────────
    } else if (type === "급여") {
      if (isOwner) {
        if (referenceId) {
          showNavToast("급여명세서로 이동했어요"); navigation.navigate("PayslipDetail", { payslipId: referenceId });
        } else {
          showNavToast("급여 관리로 이동했어요"); navigation.navigate("OwnerSalaryManagement");
        }
      } else {
        if (referenceId) {
          showNavToast("급여명세서로 이동했어요"); navigation.navigate("EmployeePayStubDetail", { payslipId: referenceId });
        } else {
          showNavToast("급여 내역으로 이동했어요"); navigation.navigate("EmployeeSalary");
        }
      }

    // ── 공지 ──────────────────────────────────────────────────────────────
    } else if (type === "공지") {
      if (referenceId) {
        showNavToast("공지사항으로 이동했어요"); navigation.navigate("AnnouncementDetail", { id: referenceId });
      } else {
        showNavToast("공지사항으로 이동했어요"); navigation.navigate("Announcements");
      }

    // ── 일정 (직원 — referenceId 있음) ───────────────────────────────────
    } else if (type === "일정" && referenceId) {
      const dateMatch = message.match(/\((\d{4}-\d{2}-\d{2})\)/);
      const workDate = dateMatch?.[1] ?? null;
      const pl: Record<string, any> = (item as any).payload ?? {};
      if (!isOwner && workDate && message.includes("추가됐어요")) {
        showNavToast("일정 상세로 이동했어요");
        navigation.navigate("ScheduleNotificationDetail", {
          notifType: "added", workDate, message,
          workStart: (pl.work_start as string) ?? null,
          workEnd:   (pl.work_end   as string) ?? null,
          shiftName: (pl.shift_name as string) ?? null,
        });
      } else if (!isOwner && workDate && message.includes("수정됐어요")) {
        showNavToast("일정 상세로 이동했어요");
        navigation.navigate("ScheduleNotificationDetail", {
          notifType: "changed", workDate, message,
          workStart: null, workEnd: null,
          shiftName: (pl.shift_name as string) ?? null,
          oldStart:  (pl.old_start  as string) ?? null,
          oldEnd:    (pl.old_end    as string) ?? null,
          newStart:  (pl.new_start  as string) ?? null,
          newEnd:    (pl.new_end    as string) ?? null,
        });
      } else if (message.includes("변경") && !isOwner) {
        showNavToast("일정 확인으로 이동했어요"); navigation.navigate("EmployeeSchedule");
      } else if (message.includes("변경")) {
        showNavToast("일정 변경으로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_change", id: referenceId });
      } else if (message.includes("추가") && isOwner) {
        showNavToast("일정 추가로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_added", id: referenceId });
      } else {
        showNavToast(isOwner ? "일정 관리로 이동했어요" : "일정 확인으로 이동했어요");
        navigation.navigate(isOwner ? "OwnerScheduleManagement" : "EmployeeSchedule");
      }

    // ── 일정 (직원 — referenceId 없음: 추가/수정/삭제) ──────────────────
    } else if (type === "일정" && !isOwner) {
      const dateMatch = message.match(/\((\d{4}-\d{2}-\d{2})\)/);
      const workDate = dateMatch?.[1] ?? null;
      const pl: Record<string, any> = (item as any).payload ?? {};
      if (workDate && message.includes("삭제됐어요")) {
        showNavToast("일정 상세로 이동했어요");
        navigation.navigate("ScheduleNotificationDetail", {
          notifType: "deleted", workDate, message,
          workStart: (pl.work_start as string) ?? null,
          workEnd:   (pl.work_end   as string) ?? null,
          shiftName: (pl.shift_name as string) ?? null,
        });
      } else if (workDate && message.includes("수정됐어요")) {
        showNavToast("일정 상세로 이동했어요");
        navigation.navigate("ScheduleNotificationDetail", {
          notifType: "changed", workDate, message,
          workStart: null, workEnd: null,
          shiftName: (pl.shift_name as string) ?? null,
          oldStart:  (pl.old_start  as string) ?? null,
          oldEnd:    (pl.old_end    as string) ?? null,
          newStart:  (pl.new_start  as string) ?? null,
          newEnd:    (pl.new_end    as string) ?? null,
        });
      } else if (workDate && message.includes("추가됐어요")) {
        showNavToast("일정 상세로 이동했어요");
        navigation.navigate("ScheduleNotificationDetail", {
          notifType: "added", workDate, message,
          workStart: (pl.work_start as string) ?? null,
          workEnd:   (pl.work_end   as string) ?? null,
          shiftName: (pl.shift_name as string) ?? null,
        });
      } else {
        showNavToast("일정 확인으로 이동했어요"); navigation.navigate("EmployeeSchedule");
      }

    // ── 일정 (사장 — referenceId 없음) ────────────────────────────────────
    } else if (type === "일정") {
      showNavToast("일정 관리로 이동했어요"); navigation.navigate("OwnerScheduleManagement");

    // ── 근태 (사장/직원, 지각·결근·출근·퇴근 포함) ──────────────────────
    } else if (type === "근태" || type === "출근" || type === "퇴근" || type === "지각" || type === "결근" || type === "조기퇴근") {
      if (isOwner) {
        showNavToast("근태 관리로 이동했어요"); navigation.navigate("OwnerAttendanceManagement");
      } else {
        const pl: Record<string, any> = (item as any).payload ?? {};
        const rawDate: string = pl.work_date ?? String(item.created_at ?? "").slice(0, 10);
        const isMissedClockOut =
          message.includes("퇴근 처리가 되지 않았어요") ||
          message.includes("퇴근이 처리되지 않았어요");
        if (isMissedClockOut && rawDate) {
          showNavToast("미퇴근 상세로 이동했어요");
          navigation.navigate("AttendanceUnclosedDetail", {
            workDate: rawDate,
            startTime: (pl.start_time as string) ?? null,
          });
        } else {
          showNavToast("근태 확인으로 이동했어요"); navigation.navigate("EmployeeAttendance");
        }
      }

    // ── 매장 ──────────────────────────────────────────────────────────────
    } else if (type === "매장") {
      if (isOwner) {
        showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement", { initialTab: "관리" });
      } else if (message.includes("승인")) {
        const storeName = localStorage.getItem("currentStoreName") ?? localStorage.getItem("pendingStoreName") ?? "";
        showNavToast("매장 정보로 이동했어요"); navigation.navigate("EmployeeApproved", { storeName });
      } else {
        showNavToast("내 정보로 이동했어요"); navigation.navigate("EmployeeProfile");
      }

    // ── 직원관리 ──────────────────────────────────────────────────────────
    } else if (type === "직원관리") {
      showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement", { initialTab: "가입요청" });

    // ── 일정변경 (사장 — 직원이 요청한 변경) ─────────────────────────────
    } else if (type === "일정변경") {
      showNavToast("일정 관리로 이동했어요"); navigation.navigate("OwnerScheduleManagement", { initialTab: "일정 변경 요청" });

    // ── 수습종료 ──────────────────────────────────────────────────────────
    } else if (type === "수습종료") {
      showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement", { initialTab: "관리" });

    // ── 마감보고 ──────────────────────────────────────────────────────────
    } else if (type === "마감보고") {
      showNavToast("매출 관리로 이동했어요"); navigation.navigate("OwnerSalesManagement");

    // ── 서비스 ────────────────────────────────────────────────────────────
    } else if (type === "서비스") {
      const isFeedbackAnswer = message.includes("답변이 등록됐어요");
      if (isFeedbackAnswer && referenceId) {
        showNavToast("건의함으로 이동했어요");
        navigation.navigate("FeedbackDetail", { id: referenceId });
      } else if (!isFeedbackAnswer && referenceId) {
        showNavToast("공지사항으로 이동했어요");
        navigation.navigate("AnnouncementDetail", { id: referenceId });
      } else {
        showNavToast("서비스 알림을 확인했어요");
      }

    // ── 알 수 없는 타입 ───────────────────────────────────────────────────
    } else {
      if (isOwner) {
        showNavToast("알림을 확인했어요"); navigation.navigate("OwnerHome");
      } else {
        showNavToast("알림을 확인했어요"); navigation.navigate("EmployeeHome");
      }
    }
  };

  const showAttendTab = isOwner && ownerTab === "근태알림";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B", flex: 1, marginLeft: 8 }}>알림</Text>
        <Pressable onPress={() => navigation.navigate("PushNotificationSetting")} style={{ padding: 4 }} hitSlop={8}>
          <Settings2 size={22} color="#70737B" />
        </Pressable>
      </View>
      {/* 사장에게는 탭 바가 자체 borderBottom을 가지므로 중간 구분선 숨김 */}
      {!isOwner && <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />}

      {/* 사장 전용 탭 바 */}
      {isOwner && (
        <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 24, borderBottomWidth: 1, borderBottomColor: "#EBEBEB", backgroundColor: "#FFFFFF" }}>
          {(["알림", "근태알림"] as const).map((tab) => {
            const isActive = ownerTab === tab;
            const label    = tab === "근태알림" ? "근태 알림" : "알림";
            const showDot  = tab === "근태알림" && attendanceItems.some((i) => !i.is_read);
            return (
              <AnimatedPressable
                key={tab}
                onPress={() => setOwnerTab(tab)}
                style={{ paddingVertical: 12, position: "relative", flexDirection: "row", alignItems: "center" }}
                scaleAmount={0.95}
                opacityAmount={0.8}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: isActive ? "700" : "500",
                  letterSpacing: -0.32,
                  color: isActive ? "#4261FF" : "#AAB4BF",
                }}>
                  {label}
                </Text>
                {showDot && (
                  <View style={{ position: "absolute", top: 6, right: -8, width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF3D3D" }} />
                )}
                {isActive && (
                  <View style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: 3, borderRadius: 9999, backgroundColor: "#4261FF",
                  }} />
                )}
              </AnimatedPressable>
            );
          })}
        </View>
      )}

      {/* 근태 알림 탭 */}
      {showAttendTab && (
        <AttendanceTab
          realItems={attendanceItems}
          onPressReal={handleAttendancePress}
        />
      )}

      {/* 일반 알림 영역 */}
      {!showAttendTab && (
        <View style={{ flex: 1, backgroundColor: "#F7F7F8" }}>

          {/* 필터 칩 — flexGrow:0 으로 높이 고정 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}
          >
            {filters.map((f) => {
              const isActive = filter === f;
              return (
                <AnimatedPressable
                  key={f}
                  onPress={() => setFilter(f)}
                  scaleAmount={0.94}
                  opacityAmount={0.8}
                  style={{
                    width: getFilterWidth(f), height: 28, borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: isActive ? "#4261FF" : "#DBDCDF",
                    backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: isActive ? "#4261FF" : "#AAB4BF" }}>
                    {f}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>

          {/* 안내 문구 — 항상 동일 위치 */}
          <Text style={{ paddingHorizontal: 20, paddingBottom: 8, fontSize: 13, fontWeight: "400", letterSpacing: -0.26, color: "#93989E" }}>
            *알림은 30일 후 자동으로 삭제돼요
          </Text>

          {/* 미퇴근 알림 카드 */}
          {!isOwner && pendingUnclosed && (
            <SwipeableNotifRow
              onDelete={() => {
                localStorage.setItem(`unclosed_dismissed_${pendingUnclosed.work_date}`, "1");
                localStorage.removeItem("pending_unclosed_shift");
                setPendingUnclosed(null);
              }}
              onPress={() => {
                showNavToast("미퇴근 상세로 이동했어요");
                navigation.navigate("AttendanceUnclosedDetail", { workDate: pendingUnclosed.work_date });
              }}
            >
              <View style={{
                minHeight: 74, backgroundColor: "#FFF3EB",
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
                justifyContent: "center", gap: 4,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ height: 24, paddingHorizontal: 8, backgroundColor: "#ECFFF1", borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#10C97D" }}>근태</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: "#93989E" }}>{pendingUnclosed.work_date}</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF862D", marginLeft: "auto" }} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#292B2E" }}>
                  퇴근 처리가 완료되지 않았어요
                </Text>
              </View>
            </SwipeableNotifRow>
          )}

          {/* 알림 목록 — FlatList로 ScrollView 대체 (ReanimatedSwipeable 제스처 충돌 방지) */}
          <FlatList
            data={filtered}
            keyExtractor={(it) => String(it.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>등록된 알림이 없어요</Text>
              </View>
            }
            renderItem={({ item: it }) => {
              const notifType: string    = resolveNotifType(it);
              const notifMessage: string = normalizeNotifMessage((it as any).message ?? it.title ?? it.body ?? "");
              const isUnread             = !it.is_read;
              return (
                <SwipeableNotifRow
                  onDelete={() => handleDeleteItem(it.id)}
                  onPress={() => handlePress(it)}
                >
                  <View style={{
                    minHeight: 74,
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    paddingHorizontal: 16, paddingVertical: 16,
                    justifyContent: "center",
                    gap: 4,
                  }}>
                    {/* 타입 태그 + 날짜 + 읽지않음 점 */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {(() => {
                        const ts = NOTIF_TYPE_STYLE[notifType] ?? { bg: "#E8F3FF", color: "#4261FF" };
                        return (
                          <View style={{
                            height: 24, paddingHorizontal: 8,
                            backgroundColor: ts.bg, borderRadius: 4,
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", letterSpacing: -0.26, color: ts.color }}>
                              {notifType}
                            </Text>
                          </View>
                        );
                      })()}
                      <Text style={{ fontSize: 12, fontWeight: "400", letterSpacing: -0.24, color: "#93989E" }}>
                        {formatNotificationDate(it.created_at)}
                      </Text>
                      {isUnread && (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4261FF", marginLeft: "auto" }} />
                      )}
                    </View>

                    {/* 메시지 */}
                    <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#292B2E" }} numberOfLines={1}>
                      {notifMessage}
                    </Text>
                  </View>
                </SwipeableNotifRow>
              );
            }}
          />

        </View>
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;
