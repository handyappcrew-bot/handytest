import React, { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import BottomSheet from "@/components/BottomSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import FadeScreen from "@/components/FadeScreen";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EmployeeBottomNav from "@/components/EmployeeBottomNav";
import { useToast } from "@/components/Toast";
import { getMyWorkLogs, getMyWorklogRequests } from "@/api/employee";
import { localStorage } from "@/utils/storage";
import { hapticSelection } from "@/utils/haptics";
import { DAY_LABELS } from "@/utils/constants";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

type Tab = "캘린더" | "출근내역" | "수정 요청 내역";
const ALL_ATTENDANCE_TABS: Tab[] = ["캘린더", "출근내역", "수정 요청 내역"];
const FILTER_TABS = ["전체", "출·퇴근", "휴게", "근무 누락"];

const REQUEST_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  대기중: { bg: "#FDF9DF", color: "#FFB300" },
  승인: { bg: "#ECFFF1", color: "#1EDC83" },
  거절: { bg: "#FFEAE6", color: "#FF3D3D" },
};
const REQUEST_TYPE_STYLE = { bg: "#E8F3FF", color: "#4261FF" };

const Badge: React.FC<{ label: string; bg: string; color: string }> = ({ label, bg, color }) => (
  <View style={{ height: 20, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: bg }}>
    <Text style={{ fontSize: 13, fontWeight: "600", color }}>{label}</Text>
  </View>
);

type AttendanceDetail = {
  year: number; month: number; day: number; dayOfWeek: string;
  status: string; startTime?: string; endTime?: string;
  breakMinutes?: number; lateMinutes?: number; extraMinutes?: number;
  shiftTypes?: string[];
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  absent:   { bg: "#FFEAE6", color: "#FF3D3D", label: "결근" },
  late:     { bg: "#FFEEE2", color: "#FF862D", label: "지각" },
  overtime: { bg: "#E8F3FF", color: "#7488FE", label: "연장" },
  normal:   { bg: "#ECFFF1", color: "#1EDC83", label: "근무완료" },
  vacation: { bg: "#F7F7F8", color: "#AAB4BF", label: "휴가" },
  holiday:  { bg: "#FFE8E8", color: "#FF5959", label: "휴무" },
};

const EmployeeAttendanceScreen: React.FC<ScreenProps<"EmployeeAttendance">> = ({ navigation }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("캘린더");
  const [date, setDate] = useState(new Date());
  const [logs, setLogs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState("전체");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDetail, setSheetDetail] = useState<AttendanceDetail | null>(null);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const hasOvertimePay = localStorage.getItem("storeHasOvertimePay") === "true";
  const hasNightPay = localStorage.getItem("storeHasNightPay") === "true";
  const hasHolidayPay = localStorage.getItem("storeHasHolidayPay") === "true";
  // B6/B7 납품 후 자동 활성화
  const workingStatus = localStorage.getItem("employeeWorkingStatus") ?? "";
  const isResigned = workingStatus === "퇴사";
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const year = date.getFullYear();
  const month = date.getMonth();

  useFocusEffect(
    useCallback(() => {
      if (!storeId) return;
      getMyWorkLogs(storeId, year, month + 1).then((rows) => setLogs(rows ?? [])).catch(() => setLogs([]));
    }, [storeId, year, month])
  );

  useFocusEffect(
    useCallback(() => {
      if (!storeId) return;
      getMyWorklogRequests(storeId).then((rows) => {
        const dismissed: number[] = JSON.parse(localStorage.getItem("dismissedWorklogIds") ?? "[]");
        setRequests((rows ?? []).filter((r: any) => !dismissed.includes(r.id)));
      }).catch(() => setRequests([]));
    }, [storeId])
  );

  // DateTime string "2026-05-25 09:00:00+09:00" 또는 "HH:MM:SS" → "HH:MM"
  const extractTime = (dt: string | null | undefined): string | undefined => {
    if (!dt) return undefined;
    const s = String(dt).replace("T", " ");
    const parts = s.split(" ");
    const timePart = parts.length >= 2 ? parts[1] : parts[0];
    return timePart ? timePart.slice(0, 5) : undefined;
  };

  const calendarData = useMemo(() => {
    const map: Record<number, { status: string; hours?: string; lateMinutes?: number; extraMinutes?: number; startTime?: string; endTime?: string }> = {};
    const hireDate = localStorage.getItem("currentHireDate") ?? null;
    logs.forEach((log) => {
      const d = Number(String(log.work_date).slice(8, 10));
      if (!d) return;
      if (hireDate && String(log.work_date).slice(0, 10) < hireDate) return;
      const startTime = extractTime(log.start_time);
      const endTime = extractTime(log.end_time);
      const schedStart = log.sched_start ? String(log.sched_start).slice(0, 5) : null;
      const schedEnd = log.sched_end ? String(log.sched_end).slice(0, 5) : null;

      let workedMin = 0;
      if (startTime && endTime) {
        workedMin = toMin(endTime) - toMin(startTime);
        const bst = extractTime(log.break_start_time);
        const bet = extractTime(log.break_end_time);
        if (bst && bet) {
          workedMin -= toMin(bet) - toMin(bst);
        }
      }
      const hours = workedMin > 0
        ? `${Math.floor(workedMin / 60)}h${workedMin % 60 > 0 ? ` ${workedMin % 60}m` : ""}`
        : undefined;

      const lateMin = (startTime && schedStart) ? Math.max(0, toMin(startTime) - toMin(schedStart)) : 0;
      const overtimeMin = (schedEnd && endTime) ? Math.max(0, toMin(endTime) - toMin(schedEnd)) : 0;

      let status = "normal";
      if (log.status === "absent") status = "absent";
      else if (log.status === "vacation") status = "vacation";
      else if (log.status === "holiday") status = "holiday";
      else if (lateMin > 0) status = "late";
      else if (overtimeMin > 0 && hasOvertimePay) status = "overtime";

      map[d] = {
        status,
        hours,
        lateMinutes: lateMin > 0 ? lateMin : undefined,
        extraMinutes: overtimeMin > 0 ? overtimeMin : undefined,
        startTime,
        endTime,
      };
    });
    return map;
  }, [logs]);

  const historyItems = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const items: any[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d > today) continue;
      const dayOfWeek = DAY_LABELS[d.getDay()];
      const data = calendarData[day];
      if (!data) continue;
      const badges: { label: string; bg: string; color: string }[] = [];
      const isAbsent = data.status === "absent";
      const isVacation = data.status === "vacation";
      const isHolidayDay = data.status === "holiday";
      const isLate = data.status === "late";
      const isOvertime = (data.extraMinutes ?? 0) > 0;
      if (isAbsent) badges.push({ label: "결근", bg: "#FFEAE6", color: "#FF3D3D" });
      if (isVacation) badges.push({ label: "휴가", bg: "#F7F7F8", color: "#AAB4BF" });
      if (isHolidayDay) badges.push({ label: "휴무", bg: "#FFE8E8", color: "#FF5959" });
      if (isLate) badges.push({ label: "지각", bg: "#FFEEE2", color: "#FF862D" });
      if (isOvertime && hasOvertimePay) badges.push({ label: "연장", bg: "#E8F3FF", color: "#7488FE" });
      if (!isAbsent && !isVacation && !isHolidayDay) badges.push({ label: "근무완료", bg: "#ECFFF1", color: "#1EDC83" });
      items.push({ day, dayOfWeek, data, badges, date: `${month + 1}월 ${day}일` });
    }
    return items.sort((a, b) => b.day - a.day);
  }, [calendarData, year, month]);

  const normalCount = historyItems.filter(i => i.badges.some((b: any) => b.label === "근무완료") && !i.badges.some((b: any) => b.label === "지각" || b.label === "연장")).length;
  const lateCount = historyItems.filter(i => i.badges.some((b: any) => b.label === "지각")).length;
  const overtimeCount = hasOvertimePay ? historyItems.filter(i => i.badges.some((b: any) => b.label === "연장")).length : 0;
  const absentCount = historyItems.filter(i => i.badges.some((b: any) => b.label === "결근")).length;

  const totalRequestCount = requests.length;
  const filteredRequests = requests
    .filter((r: any) => {
      if (filterTab === "전체") return true;
      if (filterTab === "출·퇴근") return r.type === "출·퇴근 시간 변경" || r.type === "출퇴근 시간 변경";
      if (filterTab === "휴게") return r.type === "휴게 시간 변경";
      if (filterTab === "근무 누락") return r.type === "근무 누락";
      return true;
    })
    .sort((a: any, b: any) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return 0;
    });

  // Calendar grid
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number; isOutside: boolean }[] = [];
  for (let i = firstDayOfWeek; i > 0; i--) cells.push({ day: 0, isOutside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, isOutside: false });
  while (cells.length % 7 !== 0) cells.push({ day: 0, isOutside: true });
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  const openSheetByDay = (day: number) => {
    const dayData = calendarData[day];
    if (!dayData) return;
    const log = logs.find((l: any) => Number(String(l.work_date).slice(8, 10)) === day);
    const bst = extractTime(log?.break_start_time);
    const bet = extractTime(log?.break_end_time);
    const breakMinutes = bst && bet ? toMin(bet) - toMin(bst) : 0;
    const d = new Date(year, month, day);
    const shiftName = log?.shift_name;
    setSheetDetail({
      year, month, day, dayOfWeek: DAY_LABELS[d.getDay()],
      status: dayData.status,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      breakMinutes: breakMinutes > 0 ? breakMinutes : undefined,
      lateMinutes: dayData.lateMinutes,
      extraMinutes: dayData.extraMinutes,
      shiftTypes: shiftName ? [shiftName] : undefined,
    });
    setSheetOpen(true);
  };

  const goToPrevMonth = () => setDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setDate(new Date(year, month + 1, 1));

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.navigate("EmployeeHome")} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>출근 관리</Text>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", paddingHorizontal: 20, gap: 24 }}>
          {ALL_ATTENDANCE_TABS.filter(t => !(isResigned && t === "수정 요청 내역")).map((tab) => (
            <AnimatedPressable key={tab} scaleAmount={0.95} opacityAmount={0.8} onPress={() => { hapticSelection(); setActiveTab(tab); }} style={{ paddingVertical: 12, position: "relative" }}>
              <Text style={{ fontSize: 16, fontWeight: activeTab === tab ? "700" : "500", letterSpacing: -0.32, color: activeTab === tab ? "#4261FF" : "#AAB4BF", flexShrink: 0 }}>
                {tab === "수정 요청 내역" ? `수정 요청 내역 ${totalRequestCount}건` : tab}
              </Text>
              {activeTab === tab && (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 9999, backgroundColor: "#4261FF" }} />
              )}
            </AnimatedPressable>
          ))}
        </View>
      </View>

      {/* Calendar Tab */}
      {activeTab === "캘린더" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
            <AnimatedPressable scaleAmount={0.88} opacityAmount={0.7} onPress={goToPrevMonth} style={{ padding: 4 }} hitSlop={8}>
              <ChevronLeft size={20} color="#19191B" />
            </AnimatedPressable>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month + 1}월 ▾</Text>
            <AnimatedPressable scaleAmount={0.88} opacityAmount={0.7} onPress={goToNextMonth} style={{ padding: 4 }} hitSlop={8}>
              <ChevronRight size={20} color="#19191B" />
            </AnimatedPressable>
          </View>

          <View style={{ paddingHorizontal: 12 }}>
            <View style={{ flexDirection: "row" }}>
              {DAY_LABELS.map((label, i) => (
                <View key={label} style={{ flex: 1, alignItems: "center", paddingBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B" }}>{label}</Text>
                </View>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
                {week.map((cell, ci) => {
                  const isToday = !cell.isOutside && isCurrentMonth && today.getDate() === cell.day;
                  const dayData = !cell.isOutside ? calendarData[cell.day] : null;
                  const isFuture = !cell.isOutside && new Date(year, month, cell.day) > today;
                  const isSun = ci === 0;
                  const isSat = ci === 6;
                  const dateColor = cell.isOutside ? "#AAB4BF" : isToday ? "#FFFFFF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#70737B";
                  return (
                    <Pressable
                      key={ci}
                      onPress={() => { if (!cell.isOutside && !isFuture && dayData) openSheetByDay(cell.day); }}
                      style={{ flex: 1, alignItems: "center", paddingVertical: 6, minHeight: 90 }}
                    >
                      <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                        <View style={isToday ? { backgroundColor: "#4261FF", borderRadius: 10, minWidth: 40, width: 40, height: 22, alignItems: "center", justifyContent: "center" } : {}}>
                          <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: dateColor }}>
                            {cell.isOutside ? "" : cell.day}
                          </Text>
                        </View>
                      </View>
                      {dayData && !isFuture && (
                        <View style={{ width: "100%", paddingHorizontal: 2, gap: 2 }}>
                          {dayData.status === "absent" && (
                            <View style={{ borderRadius: 4, backgroundColor: "#FFEAE6", alignItems: "center", justifyContent: "center", height: 17 }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: "#FF3D3D" }}>결근</Text>
                            </View>
                          )}
                          {dayData.status === "vacation" && (
                            <View style={{ borderRadius: 4, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center", height: 17 }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: "#AAB4BF" }}>휴가</Text>
                            </View>
                          )}
                          {dayData.status === "holiday" && (
                            <View style={{ borderRadius: 4, backgroundColor: "#FFE8E8", alignItems: "center", justifyContent: "center", height: 17 }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: "#FF5959" }}>휴무</Text>
                            </View>
                          )}
                          {dayData.hours && (
                            <View style={{ borderRadius: 4, backgroundColor: dayData.status === "late" ? "#FFEEE2" : "#ECFFF1", alignItems: "center", justifyContent: "center", height: 17 }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: dayData.status === "late" ? "#FF862D" : "#1EDC83" }}>{dayData.hours}</Text>
                            </View>
                          )}
                          {dayData.status === "late" && dayData.lateMinutes && (
                            <View style={{ borderRadius: 4, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center", height: 17 }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: "#AAB4BF" }}>-{dayData.lateMinutes}m</Text>
                            </View>
                          )}
                          {hasOvertimePay && dayData.extraMinutes !== undefined && dayData.extraMinutes > 0 && (
                            <View style={{ borderRadius: 4, backgroundColor: "#E8F3FF", alignItems: "center", justifyContent: "center", height: 17 }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: "#7488FE" }}>+{dayData.extraMinutes}m</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />

          {/* Monthly summary */}
          <View style={{ marginHorizontal: 20, marginTop: 24, marginBottom: 20, borderRadius: 16, borderWidth: 1, borderColor: "#EBEBEB", backgroundColor: "#FFFFFF", padding: 20 }}>
            <View style={{ marginBottom: 12 }}>
              <View style={{ height: 28, borderRadius: 4, paddingHorizontal: 12, backgroundColor: "#E8F3FF", alignSelf: "flex-start", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#4261FF" }}>{month + 1}월 총 근무 내역</Text>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingTop: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12, columnGap: 32 }}>
                {[
                  { label: "근무완료", bg: "#ECFFF1", color: "#1EDC83", count: normalCount },
                  { label: "지각", bg: "#FFEEE2", color: "#FF862D", count: lateCount },
                  ...(hasOvertimePay ? [{ label: "연장", bg: "#E8F3FF", color: "#7488FE", count: overtimeCount }] : []),
                  { label: "결근", bg: "#FFEAE6", color: "#FF3D3D", count: absentCount },
                ].map(({ label, bg, color, count }) => (
                  <View key={label} style={{ width: "40%", flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 67, height: 28, borderRadius: 4, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color }}>{label}</Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#19191B" }}>{count}회</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* History Tab */}
      {activeTab === "출근내역" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}>
            <AnimatedPressable scaleAmount={0.88} opacityAmount={0.7} onPress={goToPrevMonth} style={{ padding: 4 }} hitSlop={8}>
              <ChevronLeft size={20} color="#19191B" />
            </AnimatedPressable>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month + 1}월 ▾</Text>
            <AnimatedPressable scaleAmount={0.88} opacityAmount={0.7} onPress={goToNextMonth} style={{ padding: 4 }} hitSlop={8}>
              <ChevronRight size={20} color="#19191B" />
            </AnimatedPressable>
          </View>

          <View>
            {historyItems.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <Text style={{ fontSize: 14, color: "#9EA3AD" }}>이번 달 출근 내역이 없어요</Text>
              </View>
            )}
            {historyItems.map((item: any, idx: number) => (
              <AnimatedPressable key={idx} scaleAmount={0.98} opacityAmount={0.85} onPress={() => openSheetByDay(item.day)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{item.date} ({item.dayOfWeek})</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {item.badges.map((badge: any, bi: number) => (
                      <Badge key={bi} label={badge.label} bg={badge.bg} color={badge.color} />
                    ))}
                    {item.data?.startTime && item.data.startTime !== "00:00" && (
                      <Text style={{ fontSize: 14, color: "#9EA3AD" }}>
                        <Text style={{ color: item.data.status === "late" ? "#FF862D" : "#9EA3AD" }}>{item.data.startTime}</Text>
                        {" - "}
                        <Text style={{ color: item.data.extraMinutes ? "#7488FE" : "#9EA3AD" }}>{item.data.endTime}</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <ChevronRight size={20} color="#AAB4BF" />
              </AnimatedPressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Edit Requests Tab */}
      {activeTab === "수정 요청 내역" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, backgroundColor: "#F7F7F8", flexGrow: 1 }}>
          {/* Filter chips */}
          <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 8 }}>
            {FILTER_TABS.map((f) => {
              const isActive = filterTab === f;
              const label = f === "전체" ? `전체 ${totalRequestCount}` : f;
              return (
                <AnimatedPressable
                  key={f}
                  scaleAmount={0.97}
                  opacityAmount={0.75}
                  onPress={() => setFilterTab(f)}
                  style={{
                    height: 28, borderRadius: 9999, paddingHorizontal: 14,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF",
                    borderWidth: 1, borderColor: isActive ? "#4261FF" : "#DBDCDF",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: isActive ? "#4261FF" : "#AAB4BF" }}>{label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <View style={{ gap: 16, paddingHorizontal: 20, paddingBottom: 20 }}>
            {filteredRequests.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>수정 요청 내역이 없어요</Text>
              </View>
            ) : (
              filteredRequests.map((req: any) => {
                const statusLabel = req.status === "pending" ? "대기중" : req.status === "approved" ? "승인" : "거절";
                const statusStyle = REQUEST_STATUS_STYLE[statusLabel];
                const canDelete = req.status === "approved" || req.status === "rejected";
                const origTime = req.origin_start || req.origin_end ? ` | ${req.origin_start ?? ""} - ${req.origin_end ?? ""}` : "";
                const desiredTime = req.desired_start || req.desired_end ? ` | ${req.desired_start ?? ""} - ${req.desired_end ?? ""}` : "";
                const dateStr = req.date ?? "";
                return (
                  <View key={req.id} style={{ borderRadius: 16, backgroundColor: "#FFFFFF", padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Badge label={statusLabel} bg={statusStyle.bg} color={statusStyle.color} />
                        <Badge label={req.type ?? "수정 요청"} bg={REQUEST_TYPE_STYLE.bg} color={REQUEST_TYPE_STYLE.color} />
                      </View>
                      {canDelete && (
                        <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={() => setDeleteTargetId(String(req.id))} hitSlop={8}>
                          <Trash2 size={18} color="#AAB4BF" />
                        </AnimatedPressable>
                      )}
                    </View>

                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>변경 요청 사항</Text>
                      <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F7F7F8", marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#9EA3AD", marginBottom: 4 }}>기존 일정</Text>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{dateStr}{origTime}</Text>
                      </View>
                      <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F0F7FF" }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF", marginBottom: 4 }}>변경 일정</Text>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{dateStr}{desiredTime}</Text>
                        {req.desired_break_minutes != null && (
                          <Text style={{ fontSize: 13, color: "#70737B", marginTop: 2 }}>[휴게] {req.desired_break_minutes}분</Text>
                        )}
                      </View>
                    </View>

                    {req.reason && (
                      <View>
                        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 2 }}>변경 요청 사유</Text>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{req.reason}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* 근태 상세 바텀시트 */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="근태 상세">
        {sheetDetail && (() => {
          const badge = STATUS_BADGE[sheetDetail.status] ?? STATUS_BADGE.normal;
          const hasTime = sheetDetail.startTime && sheetDetail.startTime !== "00:00";
          return (
            <View style={{ paddingBottom: 8 }}>
              {/* 날짜 */}
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 12 }}>
                {sheetDetail.year}년 {sheetDetail.month + 1}월 {sheetDetail.day}일 ({sheetDetail.dayOfWeek})
              </Text>

              {/* 상태 배지 */}
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {sheetDetail.status === "late" ? (
                  <>
                    <View style={{ height: 24, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFEEE2" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF862D" }}>지각</Text>
                    </View>
                    <View style={{ height: 24, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFFF1" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#1EDC83" }}>근무완료</Text>
                    </View>
                  </>
                ) : sheetDetail.status === "normal" || sheetDetail.status === "overtime" ? (
                  <>
                    {(sheetDetail.extraMinutes ?? 0) > 0 && hasOvertimePay && (
                      <View style={{ height: 24, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FF" }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#7488FE" }}>연장</Text>
                      </View>
                    )}
                    <View style={{ height: 24, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFFF1" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#1EDC83" }}>근무완료</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ height: 24, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: badge.bg }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: badge.color }}>{badge.label}</Text>
                  </View>
                )}
              </View>

              {/* 시간 대표 표시 */}
              {hasTime && (
                <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, alignItems: "center", marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 22, fontWeight: "700", letterSpacing: -0.5, color: sheetDetail.status === "late" ? "#FF862D" : "#19191B" }}>
                      {sheetDetail.startTime}
                    </Text>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: "#AAB4BF", marginHorizontal: 4 }}> - </Text>
                    <Text style={{ fontSize: 22, fontWeight: "700", letterSpacing: -0.5, color: (sheetDetail.extraMinutes ?? 0) > 0 && hasOvertimePay ? "#7488FE" : "#19191B" }}>
                      {sheetDetail.endTime ?? "--:--"}
                    </Text>
                  </View>
                  {sheetDetail.breakMinutes ? (
                    <Text style={{ fontSize: 13, color: "#70737B", marginTop: 4 }}>휴게 {sheetDetail.breakMinutes}분</Text>
                  ) : null}
                </View>
              )}

              {/* 상세 행 */}
              <View style={{ gap: 10, marginBottom: 20 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: "#70737B" }}>출근</Text>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: sheetDetail.status === "late" ? "#FF862D" : "#19191B" }}>
                    {hasTime ? sheetDetail.startTime : "-"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: "#70737B" }}>퇴근</Text>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: sheetDetail.extraMinutes ? "#7488FE" : "#19191B" }}>
                    {sheetDetail.endTime && sheetDetail.endTime !== "00:00" ? sheetDetail.endTime : "-"}
                  </Text>
                </View>
                {(sheetDetail.extraMinutes ?? 0) > 0 && hasOvertimePay && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#70737B" }}>추가근무</Text>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#7488FE" }}>+{sheetDetail.extraMinutes}분</Text>
                  </View>
                )}
              </View>

              {/* 수정 요청 버튼 */}
              {!isResigned && (
                <AnimatedPressable
                  onPress={() => {
                    setSheetOpen(false);
                    navigation.navigate("AttendanceRecordEdit", {
                      detail: {
                        date: `${sheetDetail.year}-${String(sheetDetail.month + 1).padStart(2, "0")}-${String(sheetDetail.day).padStart(2, "0")}`,
                        startTime: sheetDetail.startTime,
                        endTime: sheetDetail.endTime,
                        status: sheetDetail.status,
                        breakMinutes: sheetDetail.breakMinutes,
                        year: sheetDetail.year,
                        month: sheetDetail.month,
                        dayOfWeek: sheetDetail.dayOfWeek,
                        shiftTypes: sheetDetail.shiftTypes,
                      },
                    });
                  }}
                  scaleAmount={0.97} opacityAmount={0.75}
                  style={{ height: 52, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>근무 기록 수정 요청하기</Text>
                </AnimatedPressable>
              )}
            </View>
          );
        })()}
      </BottomSheet>

      <ConfirmDialog
        visible={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="수정 요청 내역 삭제"
        description={"수정 요청 내역을 삭제 하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소", onPress: () => setDeleteTargetId(null), variant: "cancel" },
          { label: "삭제하기", onPress: () => {
            const id = Number(deleteTargetId);
            const dismissed: number[] = JSON.parse(localStorage.getItem("dismissedWorklogIds") ?? "[]");
            if (!dismissed.includes(id)) {
              localStorage.setItem("dismissedWorklogIds", JSON.stringify([...dismissed, id]));
            }
            setRequests((prev) => prev.filter((r: any) => String(r.id) !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ description: "수정 요청 내역이 삭제됐어요.", duration: 2000 });
          }, variant: "danger" },
        ]}
      />

      <EmployeeBottomNav activeTab="attendance" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

export default EmployeeAttendanceScreen;
