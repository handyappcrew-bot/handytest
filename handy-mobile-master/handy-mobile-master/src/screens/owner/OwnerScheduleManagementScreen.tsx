import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Image,
} from "react-native";
const MORNING_ICON = require("../../../assets/images/icon/morning.png");
const LUNCH_ICON   = require("../../../assets/images/icon/lunch.png");
const NIGHT_ICON   = require("../../../assets/images/icon/night.png");
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  UserPlus,
  UserMinus,
  CalendarClock,
  Palmtree,
  CalendarOff,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import FilterChips from "@/components/FilterChips";
import RequestCard from "@/components/RequestCard";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import { useToast } from "@/components/Toast";
import { getCachedStoreInfo } from "@/utils/cachedApi";
import {
  getOwnerSchedules,
  getOwnerScheduleRequests,
  handleOwnerScheduleRequest,
  updateHolidayOverrides,
  OwnerSchedule,
  OwnerScheduleChangeRequest,
  HolidayOverride,
} from "@/api/owner";
import BottomSheet from "@/components/BottomSheet";
import { localStorage } from "@/utils/storage";
import { hapticLight, hapticSelection } from "@/utils/haptics";
import { badgeEvents } from "@/utils/badgeEvents";
import { getShiftStyle, inferShiftName } from "@/utils/shiftStyles";
import { DAY_LABELS } from "@/utils/constants";
import type { ScreenProps } from "@/navigation/types";

type Tab = "주간 일정" | "월간 일정" | "일정 변경 요청";
const TABS: Tab[] = ["주간 일정", "월간 일정", "일정 변경 요청"];
const REQUEST_FILTERS = ["전체", "휴가", "일정 변경"];

const formatDateLong = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const formatDateShort = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${DAY_LABELS[d.getDay()]})`;
};

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const isValidDateStr = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());

const HOUR_WIDTH = 60;
const LEFT_COL = 140;
const HEADER_H = 36;
const ROW_H = 64;

const parseHourDecimal = (time: string | null): number | null => {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
};

const SHIFT_ICON_SOURCES: [string[], any][] = [
  [["오픈", "오전", "1교대"], MORNING_ICON],
  [["미들", "오후", "2교대"], LUNCH_ICON],
  [["마감", "저녁", "3교대"], NIGHT_ICON],
];
const ShiftIcon: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) => {
  for (const [keywords, src] of SHIFT_ICON_SOURCES) {
    if (keywords.some((k) => name.includes(k))) {
      return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
    }
  }
  return <Text style={{ fontSize: size - 2, fontWeight: "600", color }}>{name.slice(0, 1)}</Text>;
};

const ShiftBadge: React.FC<{ count: number; bg: string; color: string; shiftName?: string }> = ({ count, bg, color, shiftName }) => (
  <View style={{ height: 16, borderRadius: 4, backgroundColor: bg, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    {shiftName ? <ShiftIcon name={shiftName} size={9} color={color} /> : null}
    <Text style={{ fontSize: 11, fontWeight: "600", color, marginLeft: shiftName ? 2 : 0 }}>{count}</Text>
  </View>
);

const OwnerScheduleManagementScreen: React.FC<ScreenProps<"OwnerScheduleManagement">> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>(route.params?.initialTab ?? "주간 일정");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<OwnerSchedule[]>([]);
  const [requests, setRequests] = useState<OwnerScheduleChangeRequest[]>([]);
  const [filter, setFilter] = useState("전체");
  const [storeShifts, setStoreShifts] = useState<{ id: number; name: string; sort_order: number }[]>([]);
  const [storeSetting, setStoreSetting] = useState<any>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState<{ year: number; month: number; day: number } | null>(null);
  const [holidayManageOpen, setHolidayManageOpen] = useState(false);
  const [holidayAddDate, setHolidayAddDate] = useState("");
  const [holidayOpenDate, setHolidayOpenDate] = useState("");
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayPickerMode, setHolidayPickerMode] = useState<"closed" | "open" | null>(null);
  const [holidayPickerDate, setHolidayPickerDate] = useState(new Date());

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useFocusEffect(
    useCallback(() => {
      if (!storeId) return;
      getOwnerSchedules(storeId, year, month + 1)
        .then(setSchedules)
        .catch((e) => { console.warn(e); setSchedules([]); toast({ description: "일정을 불러오지 못했어요.", variant: "destructive" }); });
    }, [storeId, year, month])
  );

  useFocusEffect(
    useCallback(() => {
      if (!storeId) return;
      getCachedStoreInfo(storeId)
        .then((data: any) => {
          setStoreShifts(data?.shifts ?? []);
          setStoreSetting(data?.setting ?? null);
        })
        .catch((e) => console.warn(e));
    }, [storeId])
  );

  useFocusEffect(
    useCallback(() => {
      if (!storeId) return;
      getOwnerScheduleRequests(storeId)
        .then(setRequests)
        .catch(() => setRequests([]));
    }, [storeId])
  );

  const DAY_KR_TO_JS: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };

  const isHolidayDate = useCallback((date: Date): boolean => {
    const dateStr = toDateStr(date);
    const overrides: HolidayOverride[] = storeSetting?.holiday_overrides ?? [];
    const override = overrides.find(o => o.date === dateStr);
    if (override) return override.type === "closed";

    if (!storeSetting?.is_fixed_holiday) return false;
    const holidayDays: string[] = storeSetting.holiday_days ?? [];
    if (!holidayDays.length) return false;
    const jsDay = date.getDay();
    const dayKr = Object.entries(DAY_KR_TO_JS).find(([, v]) => v === jsDay)?.[0];
    if (!dayKr || !holidayDays.includes(dayKr)) return false;
    const rawCycle: string = storeSetting.holiday_cycle ?? "";
    if (rawCycle.startsWith("격주")) {
      const weekNum = Math.ceil(date.getDate() / 7);
      const weekType = rawCycle.includes("-") ? rawCycle.split("-")[1] : "";
      if (weekType === "1,3주차" && weekNum !== 1 && weekNum !== 3) return false;
      if (weekType === "2,4주차" && weekNum !== 2 && weekNum !== 4) return false;
    }
    return true;
  }, [storeSetting]);

  const holidayOverrides: HolidayOverride[] = storeSetting?.holiday_overrides ?? [];

  const saveOverrides = async (overrides: HolidayOverride[]) => {
    await updateHolidayOverrides(storeId, overrides);
    setStoreSetting((prev: any) => ({ ...prev, holiday_overrides: overrides }));
  };

  const addClosedOverride = async () => {
    if (!isValidDateStr(holidayAddDate)) {
      toast({ description: "날짜 형식이 올바르지 않아요 (예: 2025-06-09)", variant: "destructive" });
      return;
    }
    setHolidaySaving(true);
    try {
      const next = holidayOverrides.filter(o => o.date !== holidayAddDate);
      next.push({ date: holidayAddDate, type: "closed" });
      await saveOverrides(next);
      setHolidayAddDate("");
      toast({ description: "일일 휴무가 추가되었어요" });
    } catch {
      toast({ description: "저장에 실패했어요", variant: "destructive" });
    } finally {
      setHolidaySaving(false);
    }
  };

  const addOpenOverride = async () => {
    if (!isValidDateStr(holidayOpenDate)) {
      toast({ description: "날짜 형식이 올바르지 않아요 (예: 2025-06-02)", variant: "destructive" });
      return;
    }
    setHolidaySaving(true);
    try {
      const next = holidayOverrides.filter(o => o.date !== holidayOpenDate);
      next.push({ date: holidayOpenDate, type: "open" });
      await saveOverrides(next);
      setHolidayOpenDate("");
      toast({ description: "해당 날은 영업일로 변경되었어요" });
    } catch {
      toast({ description: "저장에 실패했어요", variant: "destructive" });
    } finally {
      setHolidaySaving(false);
    }
  };

  const removeOverride = async (date: string) => {
    setHolidaySaving(true);
    try {
      const next = holidayOverrides.filter(o => o.date !== date);
      await saveOverrides(next);
      toast({ description: "설정이 삭제되었어요" });
    } catch {
      toast({ description: "삭제에 실패했어요", variant: "destructive" });
    } finally {
      setHolidaySaving(false);
    }
  };

  const shiftColorMap = useMemo(() => {
    const map: Record<string, { bg: string; color: string }> = {};
    storeShifts.forEach((s) => {
      const style = getShiftStyle(s.name, storeShifts);
      map[s.name] = { bg: style.bg, color: style.color };
    });
    return map;
  }, [storeShifts]);

  // 월간: 일자별 shift count (shift_name 없으면 work_start로 추론)
  const monthlyMap = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    schedules.forEach((r) => {
      const d = Number(r.work_date.slice(8, 10));
      const shiftName = r.shift_name || inferShiftName(r.work_start, storeShifts);
      if (!shiftName) return;
      if (!map[d]) map[d] = {};
      map[d][shiftName] = (map[d][shiftName] ?? 0) + 1;
    });
    return map;
  }, [schedules, storeShifts]);

  const storeHolidayDaySet = useMemo(() => {
    const s = new Set<number>();
    schedules.forEach((r) => { if (r.is_holiday) s.add(Number(r.work_date.slice(8, 10))); });
    return s;
  }, [schedules]);

  // 주간: 오늘 날짜 직원 그룹
  const todayIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
  const weeklyStaff = useMemo(() => {
    return schedules.filter((r) => r.work_date === todayIso);
  }, [schedules, todayIso]);

  const timetableStart = useMemo(() => {
    const min = weeklyStaff.reduce((acc, r) => {
      const h = parseHourDecimal(r.work_start);
      return h !== null && Math.floor(h) < acc ? Math.floor(h) : acc;
    }, 8);
    return Math.min(min, 8);
  }, [weeklyStaff]);
  const dynHours = useMemo(
    () => Array.from({ length: 25 - timetableStart }, (_, i) => i + timetableStart),
    [timetableStart]
  );
  const dynWidth = dynHours.length * HOUR_WIDTH;

  // 선택된 날의 스케줄
  const daySchedules = useMemo(() => {
    if (!selectedDay) return [];
    const iso = `${selectedDay.year}-${String(selectedDay.month + 1).padStart(2, "0")}-${String(selectedDay.day).padStart(2, "0")}`;
    return schedules.filter((r) => r.work_date === iso);
  }, [schedules, selectedDay]);

  const filtered =
    filter === "전체"
      ? requests
      : filter === "휴가"
      ? requests.filter((r) => r.type === "vacation")
      : requests.filter((r) => r.type !== "vacation");

  const handleAction = async (id: number, status: "approved" | "rejected") => {
    try {
      await handleOwnerScheduleRequest(storeId, id, status);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      badgeEvents.emit();
      toast({
        description:
          status === "approved"
            ? "일정 변경 요청이 수락 되었어요."
            : "일정 변경 요청이 거절 되었어요.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "처리에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  // ─── Navigation helpers ───────────────────────────────────────────────────
  const getWeekNumber = () => {
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const adjustedFirst = firstDayOfWeek === 0 ? 7 : firstDayOfWeek;
    const dayOfMonth = currentDate.getDate();
    return Math.ceil((dayOfMonth + adjustedFirst - 1) / 7);
  };

  const navigateMonth = (dir: number) => setCurrentDate(new Date(year, month + dir, 1));
  const navigateWeek = (dir: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + dir * 7);
    setCurrentDate(newDate);
  };
  const handlePrev = () =>
    activeTab === "월간 일정" ? navigateMonth(-1) : navigateWeek(-1);
  const handleNext = () =>
    activeTab === "월간 일정" ? navigateMonth(1) : navigateWeek(1);

  const headerLabel =
    activeTab === "월간 일정"
      ? `${year}년 ${month + 1}월`
      : `${month + 1}월 ${getWeekNumber()}째주`;

  // ─── Calendar helpers ─────────────────────────────────────────────────────
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number; isOutside: boolean }[] = [];
  for (let i = firstDayOfWeek; i > 0; i--) cells.push({ day: 0, isOutside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, isOutside: false });
  while (cells.length % 7 !== 0) cells.push({ day: 0, isOutside: true });
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayDate = new Date();

  // ─── FAB actions ──────────────────────────────────────────────────────────
  const fabActions = [
    { key: "add", Icon: UserPlus, label: "일일 일정 추가", onPress: () => navigation.navigate("OwnerScheduleAdd") },
    { key: "delete", Icon: UserMinus, label: "직원 일정 삭제", onPress: () => navigation.navigate("OwnerScheduleDelete") },
    { key: "change", Icon: CalendarClock, label: "직원 일정 변경", onPress: () => navigation.navigate("OwnerScheduleChange") },
    { key: "vacation", Icon: Palmtree, label: "직원 휴가 처리", onPress: () => navigation.navigate("OwnerVacationSetting") },
    { key: "holiday", Icon: CalendarOff, label: "휴무 관리", onPress: () => { setHolidayPickerDate(new Date(year, month, 1)); setHolidayAddDate(""); setHolidayOpenDate(""); setHolidayManageOpen(true); } },
  ];

  // ─── Tab label helper ─────────────────────────────────────────────────────
  const requestCount = requests.length;

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 8,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>
          일정 관리
        </Text>
      </View>

      {/* Tabs — matching web style exactly */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#EBEBEB",
          paddingHorizontal: 20,
          gap: 24,
        }}
      >
        {TABS.map((tab) => {
          const isRequest = tab === "일정 변경 요청";
          const label = isRequest ? `일정 변경 요청 ${requestCount}건` : tab;
          const isActive = activeTab === tab;
          return (
            <AnimatedPressable
              key={tab}
              onPress={() => {
                hapticSelection();
                setActiveTab(tab as Tab);
                setFabOpen(false);
              }}
              style={{ paddingVertical: 12, position: "relative" }}
              scaleAmount={0.95}
              opacityAmount={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {isRequest && requestCount > 0 && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#FF3D3D",
                      marginRight: 4,
                      marginBottom: 8,
                    }}
                  />
                )}
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: isActive ? "700" : "500",
                    letterSpacing: -0.32,
                    color: isActive ? "#4261FF" : "#AAB4BF",
                  }}
                >
                  {label}
                </Text>
              </View>
              {isActive && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    borderRadius: 9999,
                    backgroundColor: "#4261FF",
                  }}
                />
              )}
            </AnimatedPressable>
          );
        })}
      </View>

      {/* 주간/월간 공통 — 네비게이션 헤더 */}
      {(activeTab === "주간 일정" || activeTab === "월간 일정") && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <AnimatedPressable onPress={handlePrev} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
            <ChevronLeft size={20} color="#19191B" />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              setPickerYear(year);
              setMonthPickerOpen(true);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            hitSlop={4}
            scaleAmount={0.97}
            opacityAmount={0.8}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>
              {headerLabel}
            </Text>
            <ChevronDown size={16} color="#9EA3AD" />
          </AnimatedPressable>
          <AnimatedPressable onPress={handleNext} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
            <ChevronRight size={20} color="#19191B" />
          </AnimatedPressable>
        </View>
      )}

      {/* 주간 일정 */}
      {activeTab === "주간 일정" && (
        <>
          {/* 요일+날짜 선택 행 (웹 ScheduleWeeklyView와 동일) */}
          {(() => {
            const dayOfWeek = currentDate.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(currentDate);
            monday.setDate(currentDate.getDate() + diffToMonday);
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              return d;
            });
            const WEEK_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
            const todayObj = new Date();
            return (
              <View style={{ paddingTop: 8, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: "#DBDCDF" }}>
                <View style={{ flexDirection: "row", paddingHorizontal: 20, justifyContent: "space-between" }}>
                  {weekDays.map((d, i) => {
                    const isSelected =
                      d.getFullYear() === currentDate.getFullYear() &&
                      d.getMonth() === currentDate.getMonth() &&
                      d.getDate() === currentDate.getDate();
                    const isToday =
                      d.getFullYear() === todayObj.getFullYear() &&
                      d.getMonth() === todayObj.getMonth() &&
                      d.getDate() === todayObj.getDate();
                    const isSat = i === 5;
                    const isSun = i === 6;
                    const isHoliday = isHolidayDate(d);
                    const dayLabelColor = isSelected ? "#FFFFFF" : isToday ? "#4261FF" : isSat ? "#5DB1FF" : isSun ? "#FF5959" : "#70737B";
                    const dateColor = isSelected ? "#FFFFFF" : (isHoliday && !isToday) ? "#DBDCDF" : isToday ? "#4261FF" : isSat ? "#5DB1FF" : isSun ? "#FF5959" : "#292B2E";
                    const bgColor = isSelected ? "#4261FF" : isToday ? "#EEF2FF" : "transparent";
                    return (
                      <AnimatedPressable
                        key={i}
                        onPress={() => setCurrentDate(d)}
                        style={{
                          width: 50,
                          borderRadius: 10,
                          backgroundColor: bgColor,
                          alignItems: "center",
                          paddingVertical: 6,
                        }}
                        scaleAmount={0.85}
                        opacityAmount={0.7}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "500", color: dayLabelColor, letterSpacing: -0.32, marginBottom: 2 }}>
                          {WEEK_LABELS[i]}
                        </Text>
                        <Text style={{ fontSize: 16, fontWeight: "500", color: dateColor, letterSpacing: -0.32, textDecorationLine: (isHoliday && !isSelected && !isToday) ? "line-through" : "none" }}>
                          {d.getDate()}
                        </Text>
                        <View style={{ width: 4, height: 4, marginTop: 3 }} />
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            );
          })()}
          {weeklyStaff.length === 0 ? (
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
              {isHolidayDate(currentDate) ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 }}>
                  <View style={{ backgroundColor: "#DBDCDF", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: "#93989E" }}>고정 휴무</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: "#AAB4BF" }}>고정 휴무일로 설정된 날이에요</Text>
                </View>
              ) : (
                <EmptyState message="이 날 근무 일정이 없어요" />
              )}
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
              <View style={{ flexDirection: "row" }}>
                {/* Fixed left column: staff names */}
                <View style={{ width: LEFT_COL, borderRightWidth: 0.5, borderRightColor: "#DBDCDF" }}>
                  <View style={{ height: HEADER_H, backgroundColor: "#F7F7F8", borderBottomWidth: 0.5, borderBottomColor: "#DBDCDF" }} />
                  {weeklyStaff.map((r) => {
                    const shift = r.shift_name ?? inferShiftName(r.work_start, storeShifts);
                    const shiftStyle = shiftColorMap[shift] ?? getShiftStyle(shift, storeShifts);
                    return (
                      <AnimatedPressable
                        key={r.id}
                        onPress={() => setSelectedDay({ year, month, day: currentDate.getDate() })}
                        style={{ height: ROW_H, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#DBDCDF" }}
                        scaleAmount={0.97}
                        opacityAmount={0.85}
                      >
                        <View style={{ flex: 1, justifyContent: "center" }}>
                          <View style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: shift ? shiftStyle.bg : "#F0F0F0", alignSelf: "flex-start", marginBottom: 3 }}>
                            <Text style={{ fontSize: 11, fontWeight: "600", color: shift ? shiftStyle.color : "#70737B" }}>{shift ?? "[일일]"}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B" }} numberOfLines={1}>{r.employee_name}</Text>
                        </View>
                        <ChevronRight size={14} color="#AAB4BF" />
                      </AnimatedPressable>
                    );
                  })}
                </View>

                {/* Horizontally scrollable timeline */}
                <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  <View>
                    {/* Hour header */}
                    <View style={{ flexDirection: "row", height: HEADER_H, borderBottomWidth: 0.5, borderBottomColor: "#DBDCDF", backgroundColor: "#F7F7F8" }}>
                      {dynHours.map((h, i) => (
                        <View key={h} style={{ width: HOUR_WIDTH, height: HEADER_H, justifyContent: "center", paddingLeft: 6, borderLeftWidth: i > 0 ? 0.5 : 0, borderLeftColor: "#DBDCDF" }}>
                          <Text style={{ fontSize: 11, color: "#9EA3AD" }}>{`${String(h).padStart(2, "0")}:00`}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Per-staff timeline rows */}
                    {weeklyStaff.map((r) => {
                      const shift = r.shift_name ?? inferShiftName(r.work_start, storeShifts);
                      const shiftStyle = shiftColorMap[shift] ?? getShiftStyle(shift, storeShifts);
                      const startH = parseHourDecimal(r.work_start);
                      const endH = parseHourDecimal(r.work_end);
                      const hasBlock = startH !== null && endH !== null && startH >= timetableStart && endH <= 24 && endH > startH;
                      const n = new Date();
                      const nowH = n.getHours() + n.getMinutes() / 60;
                      const nowOffset = nowH >= timetableStart && nowH <= 24 ? (nowH - timetableStart) * HOUR_WIDTH : null;
                      return (
                        <View key={r.id} style={{ width: dynWidth, height: ROW_H, borderBottomWidth: 0.5, borderBottomColor: "#DBDCDF" }}>
                          {dynHours.map((_, i) => (
                            <View key={i} style={{ position: "absolute", left: i * HOUR_WIDTH, top: 0, bottom: 0, width: 0.5, backgroundColor: "#EBEBEB" }} />
                          ))}
                          {hasBlock && (
                            <View style={{
                              position: "absolute",
                              left: (startH! - timetableStart) * HOUR_WIDTH + 3,
                              width: Math.max((endH! - startH!) * HOUR_WIDTH - 6, 30),
                              top: 10,
                              bottom: 10,
                              borderRadius: 6,
                              backgroundColor: shiftStyle.bg,
                              justifyContent: "center",
                              paddingHorizontal: 6,
                              overflow: "hidden",
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: "600", color: shiftStyle.color }} numberOfLines={1}>
                                {r.work_start?.slice(0, 5)} – {r.work_end?.slice(0, 5)}
                              </Text>
                            </View>
                          )}
                          {nowOffset !== null && (
                            <View style={{ position: "absolute", left: nowOffset, top: 0, bottom: 0, width: 1.5, backgroundColor: "#93989E" }} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* 월간 일정 */}
      {activeTab === "월간 일정" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}>
          {/* 요일 헤더 */}
          <View style={{ flexDirection: "row" }}>
            {DAY_LABELS.map((label, i) => (
              <View
                key={label}
                style={{ flex: 1, alignItems: "center", paddingBottom: 12 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    letterSpacing: -0.28,
                    color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B",
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
              {week.map((cell, ci) => {
                const isToday =
                  !cell.isOutside &&
                  todayDate.getFullYear() === year &&
                  todayDate.getMonth() === month &&
                  todayDate.getDate() === cell.day;
                const cellDate = !cell.isOutside && cell.day > 0 ? new Date(year, month, cell.day) : null;
                const isPublicHoliday = cellDate ? isHolidayDate(cellDate) : false;
                const isStoreHoliday = !cell.isOutside && storeHolidayDaySet.has(cell.day);
                const isHoliday = isPublicHoliday || isStoreHoliday;
                const counts = !cell.isOutside ? (monthlyMap[cell.day] ?? null) : null;
                return (
                  <AnimatedPressable
                    key={ci}
                    onPress={() => {
                      if (!cell.isOutside && cell.day > 0) {
                        setSelectedDay({ year, month, day: cell.day });
                      }
                    }}
                    style={{ flex: 1, minHeight: 90, paddingVertical: 6, backgroundColor: "transparent" }}
                    scaleAmount={0.85}
                    opacityAmount={0.7}
                  >
                    <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <View style={isToday ? { backgroundColor: "#4261FF", borderRadius: 10, minWidth: 40, width: 40, height: 22, alignItems: "center", justifyContent: "center" } : {}}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "500",
                            letterSpacing: -0.28,
                            color: cell.isOutside
                              ? "#AAB4BF"
                              : isToday
                              ? "#FFFFFF"
                              : isHoliday
                              ? "#DBDCDF"
                              : ci === 0
                              ? "#FF5959"
                              : ci === 6
                              ? "#5DB1FF"
                              : "#70737B",
                            textDecorationLine: (isHoliday && !isToday) ? "line-through" : "none",
                          }}
                        >
                          {cell.isOutside ? "" : cell.day}
                        </Text>
                      </View>
                    </View>
                    {isStoreHoliday && !counts && (
                      <View style={{ paddingHorizontal: 2 }}>
                        <View style={{ paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3, backgroundColor: "#FFE8E8", alignSelf: "flex-start" }}>
                          <Text style={{ fontSize: 9, fontWeight: "600", color: "#FF3D3D" }}>휴무</Text>
                        </View>
                      </View>
                    )}
                    {counts ? (
                      <View style={{ paddingHorizontal: 2, gap: 2 }}>
                        {counts && storeShifts.map((shift) => {
                          const count = counts[shift.name] ?? 0;
                          if (!count) return null;
                          const style = shiftColorMap[shift.name] ?? getShiftStyle(shift.name, storeShifts);
                          return <ShiftBadge key={shift.name} count={count} bg={style.bg} color={style.color} shiftName={shift.name} />;
                        })}
                        {counts && Object.entries(counts).filter(([n]) => !storeShifts.some(s => s.name === n)).map(([n, cnt]) => {
                          const style = getShiftStyle(n, storeShifts);
                          return <ShiftBadge key={n} count={cnt} bg={style.bg} color={style.color} shiftName={n} />;
                        })}
                      </View>
                    ) : null}
                  </AnimatedPressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* FAB + 액션 메뉴 (주간/월간 탭에서만 표시) */}
      {(activeTab === "주간 일정" || activeTab === "월간 일정") && (
        <>
          {/* Dim overlay */}
          {fabOpen && (
            <Pressable
              onPress={() => setFabOpen(false)}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.80)",
                zIndex: 200,
              }}
            />
          )}

          <View
            style={{
              position: "absolute",
              bottom: 90 + insets.bottom,
              right: 20,
              alignItems: "flex-end",
              zIndex: 201,
              gap: 12,
            }}
          >
            {/* Action menu — dark card matching web */}
            {fabOpen && (
              <View
                style={{
                  backgroundColor: "#2B2D36",
                  borderRadius: 16,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOpacity: 0.28,
                  shadowRadius: 32,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 8,
                  minWidth: 200,
                  marginBottom: 4,
                }}
              >
                {fabActions.map(({ key, Icon, label, onPress }, i) => (
                  <AnimatedPressable
                    key={key}
                    onPress={() => {
                      hapticLight();
                      setFabOpen(false);
                      onPress();
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      borderBottomWidth: i < fabActions.length - 1 ? 1 : 0,
                      borderBottomColor: "rgba(255,255,255,0.07)",
                    }}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                  >
                    {/* Icon circle */}
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "rgba(255,255,255,0.1)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={20} color="#FFFFFF" />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "500",
                        color: "#FFFFFF",
                        letterSpacing: -0.3,
                      }}
                    >
                      {label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}

            {/* Main FAB button */}
            <AnimatedPressable
              onPress={() => { hapticLight(); setFabOpen((v) => !v); }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: fabOpen ? "#5C5F6B" : "#4261FF",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#4261FF",
                shadowOpacity: 0.35,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
              scaleAmount={0.92}
              opacityAmount={0.75}
            >
              {fabOpen ? <X size={22} color="#FFFFFF" /> : <Plus size={22} color="#FFFFFF" />}
            </AnimatedPressable>
          </View>
        </>
      )}

      {/* 일정 변경 요청 */}
      {activeTab === "일정 변경 요청" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: "#F7F7F8" }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 90,
          }}
          nestedScrollEnabled
        >
          <FilterChips
            filters={REQUEST_FILTERS}
            active={filter}
            onChange={setFilter}
            totalCount={requests.length}
          />
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <EmptyState message="일정 변경 요청 내역이 없어요" compact />
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {filtered.map((r) => {
                const isVacation = r.type === "vacation";
                const origDate = r.origin_date ? formatDateShort(r.origin_date) : "-";
                const desiredDate = formatDateShort(r.desired_date);
                const origTime =
                  r.origin_start || r.origin_end
                    ? `${r.origin_start ?? ""} - ${r.origin_end ?? ""}`
                    : "";
                const desiredTime =
                  r.desired_start || r.desired_end
                    ? `${r.desired_start ?? ""} - ${r.desired_end ?? ""}`
                    : "";

                return (
                  <RequestCard
                    key={r.id}
                    badges={[
                      {
                        label: isVacation ? "휴가 요청" : "일정 변경 요청",
                        bg: "#EEF1FF",
                        color: "#4261FF",
                      },
                    ]}
                    meta={[{ label: "요청 직원", value: r.employee_name }]}
                    sectionsLabel={isVacation ? "휴가 요청 일정" : "변경 요청 사항"}
                    sections={
                      isVacation
                        ? [
                            {
                              tone: "blue",
                              text: `${formatDateLong(r.desired_date)}${
                                desiredTime ? ` | ${desiredTime}` : ""
                              }`,
                            },
                          ]
                        : [
                            {
                              tone: "gray",
                              innerLabel: "기존 일정",
                              text: r.origin_date
                                ? `${origDate}${origTime ? ` | ${origTime}` : ""}`
                                : "(기존 일정 없음)",
                            },
                            {
                              tone: "blue",
                              innerLabel: "변경 일정",
                              text: `${desiredDate}${desiredTime ? ` | ${desiredTime}` : ""}`,
                            },
                          ]
                    }
                    reasonLabel={
                      r.reason
                        ? isVacation
                          ? "휴가 요청 사유"
                          : "변경 요청 사유"
                        : undefined
                    }
                    reason={r.reason ?? undefined}
                    onReject={() => handleAction(r.id, "rejected")}
                    onApprove={() => handleAction(r.id, "approved")}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── 날짜 상세 바텀시트 (월간 캘린더에서 날짜 탭) ── */}
      <BottomSheet
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={
          selectedDay
            ? `${selectedDay.year}년 ${selectedDay.month + 1}월 ${selectedDay.day}일 (${
                DAY_LABELS[new Date(selectedDay.year, selectedDay.month, selectedDay.day).getDay()]
              })`
            : ""
        }
      >
        {/* Schedule entries */}
        {daySchedules.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ fontSize: 14, color: "#9EA3AD" }}>이 날 근무 일정이 없어요</Text>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            {storeShifts.map((shiftDef, idx) => {
              const items = daySchedules.filter((r) => r.shift_name === shiftDef.name);
              if (items.length === 0) return null;
              const shiftStyle = shiftColorMap[shiftDef.name] ?? getShiftStyle(shiftDef.name, storeShifts);
              return (
                <View key={shiftDef.name}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View
                      style={{
                        borderRadius: 4,
                        paddingHorizontal: 8,
                        height: 22,
                        backgroundColor: shiftStyle.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "500", color: shiftStyle.color }}>
                        {shiftDef.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: "#70737B" }}>{items.length}명</Text>
                  </View>
                  <View style={{ gap: 4, paddingLeft: 8 }}>
                    {items.map((item) => (
                      <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                        <Text style={{ fontSize: 14, color: "#70737B", width: 110 }} numberOfLines={1}>
                          {item.work_start ?? "-"} - {item.work_end ?? "-"}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flex: 1 }}>
                          {item.employee_name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {/* storeShifts에 없는 항목 (inferShiftName 기반 그룹) */}
            {(() => {
              const matchedNames = new Set(storeShifts.map((s) => s.name));
              const unmatched = daySchedules.filter((r) => !r.shift_name || !matchedNames.has(r.shift_name));
              if (unmatched.length === 0) return null;
              // inferShiftName으로 그룹화
              const inferredGroups: Record<string, typeof unmatched> = {};
              unmatched.forEach((r) => {
                const key = r.shift_name || inferShiftName(r.work_start, storeShifts) || "[일일]";
                if (!inferredGroups[key]) inferredGroups[key] = [];
                inferredGroups[key].push(r);
              });
              return (
                <>
                  {Object.entries(inferredGroups).map(([groupName, items]) => {
                    const style = getShiftStyle(groupName, storeShifts);
                    return (
                      <View key={groupName}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <View style={{ borderRadius: 4, paddingHorizontal: 8, height: 22, backgroundColor: style.bg, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 13, fontWeight: "500", color: style.color }}>{groupName}</Text>
                          </View>
                          <Text style={{ fontSize: 13, color: "#70737B" }}>{items.length}명</Text>
                        </View>
                        <View style={{ gap: 4, paddingLeft: 8 }}>
                          {items.map((item) => (
                            <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                              <Text style={{ fontSize: 14, color: "#70737B", width: 110 }} numberOfLines={1}>
                                {item.work_start ?? "-"} - {item.work_end ?? "-"}
                              </Text>
                              <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flex: 1 }}>
                                {item.employee_name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            })()}
          </View>
        )}

        {/* Confirm button */}
        <AnimatedPressable
          onPress={() => setSelectedDay(null)}
          style={{
            marginTop: 32,
            height: 56,
            borderRadius: 16,
            backgroundColor: "#4261FF",
            alignItems: "center",
            justifyContent: "center",
          }}
          scaleAmount={0.97}
          opacityAmount={0.75}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
        </AnimatedPressable>
      </BottomSheet>

      {/* Month picker modal */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={() => setMonthPickerOpen(false)}
        >
          <Pressable
            style={{
              width: 320,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Year navigation */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <AnimatedPressable onPress={() => setPickerYear((p) => p - 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>
                {pickerYear}년
              </Text>
              <AnimatedPressable onPress={() => setPickerYear((p) => p + 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronRight size={20} color="#19191B" />
              </AnimatedPressable>
            </View>
            {/* Month grid — 3 rows × 4 columns */}
            {Array.from({ length: 3 }, (_, row) => (
              <View key={row} style={{ flexDirection: "row", gap: 8, marginBottom: row < 2 ? 8 : 0 }}>
                {Array.from({ length: 4 }, (_, col) => {
                  const i = row * 4 + col;
                  const isSel = pickerYear === year && i === month;
                  return (
                    <AnimatedPressable
                      key={i}
                      onPress={() => { setCurrentDate(new Date(pickerYear, i, 1)); setMonthPickerOpen(false); }}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: isSel ? "#4261FF" : "#F7F7F8" }}
                      scaleAmount={0.97}
                      opacityAmount={0.8}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isSel ? "#FFFFFF" : "#19191B" }}>
                        {i + 1}월
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 휴무 관리 바텀시트 ── */}
      <BottomSheet
        isOpen={holidayManageOpen}
        onClose={() => { setHolidayManageOpen(false); setHolidayPickerMode(null); setHolidayAddDate(""); setHolidayOpenDate(""); }}
        title="휴무 관리"
      >
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 580 }}>
          {/* 캘린더 (항상 표시) */}
          <HolidayMiniCalendar
            date={holidayPickerDate}
            onChangeDate={setHolidayPickerDate}
            selected={holidayAddDate || holidayOpenDate}
            closedDates={holidayOverrides.filter(o => o.type === "closed").map(o => o.date)}
            openDates={holidayOverrides.filter(o => o.type === "open").map(o => o.date)}
            isFixedHoliday={isHolidayDate}
            onSelect={(d) => {
              setHolidayAddDate(d);
              setHolidayOpenDate(d);
            }}
          />

          {/* 선택된 날짜 표시 */}
          {holidayAddDate ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 2, gap: 6 }}>
              <CalendarClock size={14} color="#4261FF" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF" }}>{holidayAddDate} 선택됨</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: "#AAB4BF", textAlign: "center", marginTop: 10, marginBottom: 2 }}>날짜를 탭해서 선택하세요</Text>
          )}

          {/* 액션 버튼 2개 — 날짜 선택 시 모두 활성화, 누르면 즉시 저장 후 선택 초기화 */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 20 }}>
            <AnimatedPressable
              onPress={async () => {
                if (!holidayAddDate || holidaySaving) return;
                await addClosedOverride();   // 내부에서 holidayAddDate 사용 후 초기화
                setHolidayOpenDate("");
              }}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: holidayAddDate ? "#EDEDED" : "#F5F5F5", alignItems: "center", justifyContent: "center", opacity: holidaySaving ? 0.5 : 1 }}
              scaleAmount={0.97} opacityAmount={0.75}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: holidayAddDate ? "#70737B" : "#C0C4CC" }}>일일 휴무 지정</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={async () => {
                if (!holidayOpenDate || holidaySaving) return;
                await addOpenOverride();    // 내부에서 holidayOpenDate 사용 후 초기화
                setHolidayAddDate("");
              }}
              style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: holidayOpenDate ? "#4261FF" : "#F5F5F5", alignItems: "center", justifyContent: "center", opacity: holidaySaving ? 0.5 : 1 }}
              scaleAmount={0.97} opacityAmount={0.75}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: holidayOpenDate ? "#FFFFFF" : "#C0C4CC" }}>고정 휴무 취소</Text>
            </AnimatedPressable>
          </View>


          {/* 현재 설정 목록 */}
          {holidayOverrides.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: "#F0F1F4", marginBottom: 14 }} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B", marginBottom: 10 }}>설정된 날짜</Text>
              <View style={{ gap: 8, marginBottom: 8 }}>
                {[...holidayOverrides].sort((a, b) => a.date.localeCompare(b.date)).map(o => (
                  <View key={o.date} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F7F8FA", borderRadius: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.type === "closed" ? "#DBDCDF" : "#4261FF" }} />
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{o.date}</Text>
                      <Text style={{ fontSize: 12, color: o.type === "closed" ? "#93989E" : "#4261FF" }}>
                        {o.type === "closed" ? "일일 휴무" : "고정 휴무 취소"}
                      </Text>
                    </View>
                    <AnimatedPressable onPress={() => removeOverride(o.date)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.6}>
                      <X size={16} color="#AAB4BF" />
                    </AnimatedPressable>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 16 }} />
          <AnimatedPressable
            onPress={() => { setHolidayManageOpen(false); setHolidayPickerMode(null); setHolidayAddDate(""); setHolidayOpenDate(""); }}
            style={{ height: 52, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
            scaleAmount={0.97} opacityAmount={0.75}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>완료</Text>
          </AnimatedPressable>
        </ScrollView>
      </BottomSheet>

      <OwnerBottomNav activeTab="schedule" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

const DAY_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const HolidayMiniCalendar: React.FC<{
  date: Date;
  onChangeDate: (d: Date) => void;
  selected: string;
  closedDates?: string[];
  openDates?: string[];
  isFixedHoliday?: (d: Date) => boolean;
  onSelect: (dateStr: string) => void;
}> = ({ date, onChangeDate, selected, closedDates = [], openDates = [], isFixedHoliday, onSelect }) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: number[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(0);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(0);
  const weeks: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const today = new Date();

  return (
    <View style={{ backgroundColor: "#F7F8FA", borderRadius: 14, padding: 12 }}>
      {/* 월 네비게이터 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <AnimatedPressable onPress={() => onChangeDate(new Date(y, m - 1, 1))} hitSlop={8} scaleAmount={0.9} opacityAmount={0.7}>
          <ChevronLeft size={20} color="#70737B" />
        </AnimatedPressable>
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B" }}>{y}년 {m + 1}월</Text>
        <AnimatedPressable onPress={() => onChangeDate(new Date(y, m + 1, 1))} hitSlop={8} scaleAmount={0.9} opacityAmount={0.7}>
          <ChevronRight size={20} color="#70737B" />
        </AnimatedPressable>
      </View>
      {/* 요일 헤더 */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {DAY_OF_WEEK.map((d, i) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#9EA3AD" }}>{d}</Text>
        ))}
      </View>
      {/* 날짜 그리드 */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
          {week.map((day, ci) => {
            if (!day) return <View key={ci} style={{ flex: 1 }} />;
            const cellDate = new Date(y, m, day);
            const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = selected === dateStr;
            // override로 등록된 날짜
            const isClosed = closedDates.includes(dateStr);
            const isOpen = openDates.includes(dateStr);
            // 고정 휴무 요일 (override 없이 설정으로 인한 휴무)
            const isFixedHol = !isClosed && !isOpen && !!isFixedHoliday?.(cellDate);
            const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;

            // 우선순위: 선택 > override closed > override open > 고정휴무 > 오늘
            const bgColor = isSelected
              ? "#4261FF"
              : isClosed ? "#E8E9EC"
              : isOpen ? "#EEF2FF"
              : isFixedHol ? "#F5E6FF"
              : isToday ? "#F0F0FF"
              : "transparent";
            const textColor = isSelected
              ? "#FFFFFF"
              : isClosed ? "#93989E"
              : isOpen ? "#4261FF"
              : isFixedHol ? "#A855F7"
              : isToday ? "#4261FF"
              : ci === 0 ? "#FF5959"
              : ci === 6 ? "#5DB1FF"
              : "#19191B";

            return (
              <Pressable
                key={ci}
                onPress={() => onSelect(dateStr)}
                android_ripple={{ borderless: true, radius: 16, color: "rgba(66,97,255,0.12)" }}
                style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 }}
              >
                <View style={{ width: 30, height: 30, borderRadius: 999, overflow: "hidden", backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: isSelected ? "700" : "400", color: textColor }}>
                    {day}
                  </Text>
                </View>
                {/* 하단 점: 이미 등록된 override */}
                {(isClosed || isOpen) && !isSelected && (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isClosed ? "#AAAAAA" : "#4261FF", marginTop: 1 }} />
                )}
                {/* 고정 휴무 요일 표시 점 */}
                {isFixedHol && !isSelected && (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#A855F7", marginTop: 1 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* 범례 */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
        {isFixedHoliday && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#A855F7" }} />
            <Text style={{ fontSize: 11, color: "#A855F7" }}>고정 휴무</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#AAAAAA" }} />
          <Text style={{ fontSize: 11, color: "#93989E" }}>일일 휴무</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4261FF" }} />
          <Text style={{ fontSize: 11, color: "#4261FF" }}>고정 휴무 취소</Text>
        </View>
      </View>
    </View>
  );
};

export default OwnerScheduleManagementScreen;
