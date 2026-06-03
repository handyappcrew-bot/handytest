import React, { useCallback, useEffect, useMemo, useState } from "react";
const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
import {
  View, Text, ScrollView, Pressable, Modal, ActivityIndicator,
} from "react-native";
import { ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedPressable from "@/components/AnimatedPressable";
import Avatar from "@/components/Avatar";
import BottomSheet from "@/components/BottomSheet";
import FadeScreen from "@/components/FadeScreen";
import { getStaffAttendance, getStaffDetail, StaffAttendanceRecord } from "@/api/owner";
import { getCachedStaffList } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import { useToast } from "@/components/Toast";
import { formatPhone } from "@/utils/valid";
import { getShiftStyle } from "@/utils/shiftStyles";
import { DAY_LABELS as WEEK_DAYS } from "@/utils/constants";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  off_work:    { bg: "rgba(16,201,125,0.1)",  color: "#10C97D", label: "근무완료" },
  completed:   { bg: "rgba(16,201,125,0.1)",  color: "#10C97D", label: "근무완료" },
  working:     { bg: "rgba(16,201,125,0.1)",  color: "#10C97D", label: "근무중"   },
  on_break:    { bg: "rgba(255,134,45,0.1)",  color: "#FF862D", label: "휴게중"   },
  late:        { bg: "rgba(255,134,45,0.1)",  color: "#FF862D", label: "지각"     },
  extended:    { bg: "#E8F3FF",               color: "#7488FE", label: "연장"     },
  night:       { bg: "rgba(107,79,236,0.1)",  color: "#6B4FEC", label: "야간"     },
  holiday:     { bg: "rgba(224,92,0,0.1)",    color: "#E05C00", label: "휴일"     },
  absent:      { bg: "rgba(255,61,61,0.1)",   color: "#FF3D3D", label: "결근"     },
  vacation:    { bg: "#F7F7F8",               color: "#9EA3AD", label: "휴가"     },
  scheduled:   { bg: "#F7F7F8",               color: "#9EA3AD", label: "예정"     },
  before_work: { bg: "#F7F7F8",               color: "#9EA3AD", label: "근무전"   },
  off:         { bg: "#F7F7F8",               color: "#9EA3AD", label: "휴무"     },
};

const WORK_LABEL_STYLE: Record<string, { bg: string; color: string }> = {
  normal:    { bg: "#ECFFF1",               color: "#10C97D" },
  late:      { bg: "rgba(255,134,45,0.1)",  color: "#FF862D" },
  extended:  { bg: "#E8F3FF",               color: "#7488FE" },
  night:     { bg: "rgba(107,79,236,0.1)",  color: "#6B4FEC" },
  holiday:   { bg: "rgba(224,92,0,0.1)",    color: "#E05C00" },
  absent:    { bg: "#FFEAE6",               color: "#FF3D3D" },
  vacation:  { bg: "#F7F7F8",               color: "#9EA3AD" },
  scheduled: { bg: "#F7F7F8",               color: "#9EA3AD" },
  off:       { bg: "#F7F7F8",               color: "#9EA3AD" },
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();


const calcLateMin = (scheduled: string | null | undefined, actual: string | null | undefined): number => {
  if (!scheduled || !actual) return 0;
  const diff = toMin(actual) - toMin(scheduled);
  return diff > 0 ? diff : 0;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_DAYS[d.getDay()]})`;
};

const schedHours = (start: string | null, end: string | null): number => {
  if (!start || !end) return 0;
  let diff = toMin(end) - toMin(start);
  if (diff < 0) diff += 24 * 60;
  return Math.round(diff / 60);
};

const buildWorkData = (recs: StaffAttendanceRecord[]): Record<number, { label: string; type: string }> => {
  const map: Record<number, { label: string; type: string }> = {};
  recs.forEach(r => {
    const day = new Date(r.date).getDate();
    const s = r.status;
    const h = schedHours(r.scheduled_start, r.scheduled_end);
    if      (s === "absent")                                         map[day] = { label: "결근",                      type: "absent"   };
    else if (s === "vacation")                                       map[day] = { label: "휴가",                      type: "vacation" };
    else if (s === "holiday")                                        map[day] = { label: h > 0 ? `${h}시간` : "휴일", type: "holiday"  };
    else if (s === "late")                                           map[day] = { label: h > 0 ? `${h}시간` : "지각", type: "late"     };
    else if (s === "extended")                                       map[day] = { label: h > 0 ? `${h}시간` : "연장", type: "extended" };
    else if (s === "night")                                          map[day] = { label: h > 0 ? `${h}시간` : "야간", type: "night"    };
    else if (s === "off_work" || s === "completed" || s === "working") map[day] = { label: h > 0 ? `${h}시간` : "완료", type: "normal" };
    else if (s === "scheduled")                                      map[day] = { label: "예정",                      type: "scheduled"};
    else if (s === "off")                                            map[day] = { label: "휴무",                      type: "off"      };
  });
  return map;
};

const OwnerAttendanceDetailScreen: React.FC<ScreenProps<"OwnerAttendanceDetail">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const { staffId: initialStaffId, name: initialName, imageUrl: initialImageUrl } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  // Active staff (switchable via picker)
  const [activeStaffId,       setActiveStaffId]       = useState(initialStaffId);
  const [activeStaffName,     setActiveStaffName]     = useState(initialName);
  const [activeStaffImageUrl, setActiveStaffImageUrl] = useState<string | null | undefined>(initialImageUrl);
  const [staffPickerOpen,     setStaffPickerOpen]     = useState(false);
  const [staffList,           setStaffList]           = useState<any[]>([]);
  const [staffProfile, setStaffProfile] = useState<{ birth?: string | null; phone?: string | null; joinedAt?: string | null; shiftName?: string | null; employeeType?: string | null } | null>(null);

  // Calendar
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showAllRecords, setShowAllRecords] = useState(false);

  // Work info view sheet
  const [viewRecord, setViewRecord] = useState<StaffAttendanceRecord | null>(null);


  useEffect(() => {
    if (!storeId) return;
    getCachedStaffList(storeId).then((list: any) => {
      if (Array.isArray(list)) setStaffList(list);
    }).catch((e) => console.warn(e));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    setStaffProfile(null);
    getStaffDetail(storeId, activeStaffId).then((d: any) => {
      if (d) setStaffProfile({ birth: d.birth, phone: d.phone, joinedAt: d.joined_at ?? d.hire_date ?? null, shiftName: d.shift_name ?? null, employeeType: d.employee_type ?? null });
    }).catch((e) => console.warn(e));
  }, [storeId, activeStaffId]);

  const fetchData = useCallback(() => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    getStaffAttendance(storeId, activeStaffId, year, month)
      .then((rs) => setRecords(rs ?? []))
      .catch((e) => { console.warn(e); setRecords([]); toast({ description: "근태 기록을 불러오지 못했어요.", variant: "destructive" }); })
      .finally(() => setLoading(false));
  }, [storeId, activeStaffId, year, month]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const filteredRecords = useMemo(() => {
    if (!staffProfile?.joinedAt) return records;
    const hireDate = String(staffProfile.joinedAt).slice(0, 10);
    return records.filter(r => r.date >= hireDate);
  }, [records, staffProfile?.joinedAt]);

  const stats = useMemo(() => ({
    completed: filteredRecords.filter(r => r.status === "off_work" || r.status === "completed").length,
    late:      filteredRecords.filter(r => r.status === "late").length,
    extended:  filteredRecords.filter(r => r.status === "extended").length,
    night:     filteredRecords.filter(r => r.status === "night").length,
    holiday:   filteredRecords.filter(r => r.status === "holiday").length,
    absent:    filteredRecords.filter(r => r.status === "absent").length,
    vacation:  filteredRecords.filter(r => r.status === "vacation").length,
  }), [filteredRecords]);

  const workData = useMemo(() => buildWorkData(filteredRecords), [filteredRecords]);

  const calendarCells = useMemo(() => {
    const firstDay     = new Date(year, month - 1, 1).getDay();
    const daysInMonth  = getDaysInMonth(year, month);
    const prevDays     = getDaysInMonth(year, month - 1 === 0 ? 12 : month - 1);
    const cells: { day: number; isOutside: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, isOutside: true });
    for (let d = 1; d <= daysInMonth; d++)  cells.push({ day: d, isOutside: false });
    const rem = 7 - (cells.length % 7 || 7);
    if (rem < 7) for (let i = 1; i <= rem; i++) cells.push({ day: i, isOutside: true });
    return cells;
  }, [year, month]);

  const todayDate    = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  const navigateMonth = (dir: number) => {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDay(null);
    setShowAllRecords(false);
  };

  const openViewRecord = (r: StaffAttendanceRecord) => setViewRecord(r);

  const openEdit = (record: StaffAttendanceRecord) => {
    setViewRecord(null);
    navigation.navigate("OwnerAttendanceEdit", {
      staffId: activeStaffId,
      staffName: activeStaffName,
      date: record.date,
      status: record.status ?? null,
      clockIn: record.clock_in ?? null,
      clockOut: record.clock_out ?? null,
      scheduledStart: record.scheduled_start ?? null,
      scheduledEnd: record.scheduled_end ?? null,
      breakMinutes: record.break_minutes ?? null,
    });
  };

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>

      {/* 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>직원 근태 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* 직원 프로필 (직원 선택 picker 오픈) */}
        <AnimatedPressable
          onPress={() => setStaffPickerOpen(true)}
          scaleAmount={0.99}
          opacityAmount={0.9}
          style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}
        >
          <Avatar name={activeStaffName} imageUrl={activeStaffImageUrl} size={52} defaultSource={STAFF_ICON} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>{activeStaffName}</Text>
              {staffProfile?.shiftName ? (
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: getShiftStyle(staffProfile.shiftName).bg }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: getShiftStyle(staffProfile.shiftName).color }}>{staffProfile.shiftName}</Text>
                </View>
              ) : null}
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: "#F7F7F8" }}>
                <Text style={{ fontSize: 11, fontWeight: "500", color: "#9EA3AD" }}>{staffProfile?.employeeType ?? "직원"}</Text>
              </View>
              <ChevronDown size={16} color="#9EA3AD" />
            </View>
            {(staffProfile?.birth || staffProfile?.phone) ? (
              <View style={{ gap: 4, marginTop: 8 }}>
                {staffProfile?.birth ? (
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <Text style={{ fontSize: 14, color: "#70737B", width: 60 }}>생년월일</Text>
                    <Text style={{ fontSize: 14, color: "#19191B" }}>{String(staffProfile.birth).slice(0, 10)}</Text>
                  </View>
                ) : null}
                {staffProfile?.phone ? (
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <Text style={{ fontSize: 14, color: "#70737B", width: 60 }}>전화번호</Text>
                    <Text style={{ fontSize: 14, color: "#19191B" }}>{formatPhone(staffProfile.phone)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </AnimatedPressable>

        <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />

        {/* 월 캘린더 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          {/* 월 네비게이터 */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 }}>
            <AnimatedPressable onPress={() => navigateMonth(-1)} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
              <ChevronLeft size={20} color="#19191B" />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => { setPickerYear(year); setMonthPickerOpen(true); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}
              scaleAmount={0.97} opacityAmount={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month}월</Text>
              <ChevronDown size={16} color="#9EA3AD" />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => { const n = new Date(); if (year < n.getFullYear() || (year === n.getFullYear() && month < n.getMonth() + 1)) navigateMonth(1); }}
              hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}
            >
              <ChevronRight size={20} color="#19191B" />
            </AnimatedPressable>
          </View>

          {/* 요일 헤더 */}
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            {WEEK_DAYS.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#9EA3AD" }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* 날짜 그리드 */}
          {Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, wi) => (
            <View key={wi} style={{ flexDirection: "row" }}>
              {calendarCells.slice(wi * 7, wi * 7 + 7).map((cell, ci) => {
                if (cell.isOutside) {
                  return (
                    <View key={ci} style={{ flex: 1, alignItems: "center", height: 68, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, color: "#DBDCDF" }}>{cell.day}</Text>
                    </View>
                  );
                }
                const isToday  = cell.day === todayDate;
                const isSel    = cell.day === selectedDay && !isToday;
                const isSun    = ci === 0;
                const isSat    = ci === 6;
                const work     = workData[cell.day];
                const ws       = work ? (WORK_LABEL_STYLE[work.type] ?? WORK_LABEL_STYLE.scheduled) : null;
                const dateColor = isToday ? "#FFFFFF" : isSel ? "#4261FF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#19191B";
                return (
                  <AnimatedPressable
                    key={ci}
                    onPress={() => {
                      const r = filteredRecords.find(rec => new Date(rec.date).getDate() === cell.day);
                      if (r) { setSelectedDay(isSel ? null : cell.day); openViewRecord(r); }
                      else setSelectedDay(isSel ? null : cell.day);
                    }}
                    scaleAmount={0.9}
                    opacityAmount={0.75}
                    style={{ flex: 1, alignItems: "center", height: 68, paddingVertical: 4 }}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
                      backgroundColor: isToday ? "#4261FF" : isSel ? "rgba(66,97,255,0.1)" : "transparent",
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: isToday || isSel ? "700" : "500", color: dateColor }}>{cell.day}</Text>
                    </View>
                    {work && ws && (
                      <View style={{ marginTop: 2, width: 38, height: 16, borderRadius: 4, backgroundColor: ws.bg, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 9, fontWeight: "600", color: ws.color }}>{work.label}</Text>
                      </View>
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />

        {/* 요약 통계 */}
        <View style={{ backgroundColor: "#F0F7FF", borderRadius: 16, marginHorizontal: 20, marginTop: 16, padding: 16, marginBottom: 12 }}>
          <View style={{ alignSelf: "flex-start", height: 17, borderRadius: 4, paddingHorizontal: 8, backgroundColor: "#D3DAFF", justifyContent: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#7488FE" }}>{year}년 {month}월 근태 현황</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {stats.completed > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(16,201,125,0.1)" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#10C97D" }}>근무완료 {stats.completed}회</Text></View>}
            {stats.late      > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,134,45,0.1)" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#FF862D" }}>지각 {stats.late}회</Text></View>}
            {stats.extended  > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#E8F3FF" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#7488FE" }}>연장 {stats.extended}회</Text></View>}
            {stats.night     > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(107,79,236,0.1)" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#6B4FEC" }}>야간 {stats.night}회</Text></View>}
            {stats.holiday   > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(224,92,0,0.1)" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#E05C00" }}>휴일 {stats.holiday}회</Text></View>}
            {stats.absent    > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,61,61,0.1)" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#FF3D3D" }}>결근 {stats.absent}회</Text></View>}
            {stats.vacation  > 0 && <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#F7F7F8" }}><Text style={{ fontSize: 13, fontWeight: "500", color: "#9EA3AD" }}>휴가 {stats.vacation}회</Text></View>}
            {stats.completed === 0 && stats.late === 0 && stats.extended === 0 && stats.night === 0 && stats.holiday === 0 && stats.absent === 0 && stats.vacation === 0 && (
              <Text style={{ fontSize: 14, color: "#9EA3AD" }}>이번 달 근태 기록이 없어요</Text>
            )}
          </View>
        </View>

        {/* 근태 기록 목록 */}
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#4261FF" />
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#AAB4BF" }}>해당 월 근태 기록이 없어요</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36, marginBottom: 12 }}>
              {month}월 근무 상세내역
            </Text>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: "#F0F0F0" }}>
              {(showAllRecords ? filteredRecords : filteredRecords.slice(0, 5)).map((r, i, arr) => {
                const cfg        = STATUS_CONFIG[r.status ?? "off"] ?? STATUS_CONFIG.off;
                const isLate     = r.status === "late";
                const isExtended = r.status === "extended";
                const isAbsent   = r.status === "absent";
                const isNight    = r.status === "night";
                const isHoliday  = r.status === "holiday";
                const lateMin    = calcLateMin(r.scheduled_start, r.clock_in);
                const extMins    = (() => {
                  if (!isExtended || !r.clock_out || !r.scheduled_end) return 0;
                  let diff = toMin(r.clock_out) - toMin(r.scheduled_end);
                  if (diff < 0) diff += 24 * 60;
                  return Math.max(0, diff);
                })();
                const clockIn  = r.clock_in ?? r.scheduled_start ?? "-";
                const clockOut = r.clock_out ?? r.scheduled_end ?? "-";
                const schedS   = r.scheduled_start ?? "-";
                const schedE   = r.scheduled_end ?? "-";
                return (
                  <View key={r.date}>
                    <AnimatedPressable
                      onPress={() => openViewRecord(r)}
                      scaleAmount={0.98}
                      opacityAmount={0.85}
                      style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B", letterSpacing: -0.3, marginBottom: 6 }}>
                          {formatDate(r.date)}
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: cfg.bg }}>
                            <Text style={{ fontSize: 11, fontWeight: "500", color: cfg.color }}>{cfg.label}</Text>
                          </View>
                          {isLate && lateMin > 0 && (
                            <Text style={{ fontSize: 11, color: "#AAB4BF" }}>({lateMin}분 지각)</Text>
                          )}
                          {isAbsent ? (
                            <Text style={{ fontSize: 13, color: "#9EA3AD", textDecorationLine: "line-through" }}>
                              {schedS}{" - "}{schedE}
                            </Text>
                          ) : isLate ? (
                            <Text style={{ fontSize: 13 }}>
                              <Text style={{ color: "#FF862D", fontWeight: "600" }}>{clockIn}</Text>
                              <Text style={{ color: "#9EA3AD" }}>{" - "}{clockOut}</Text>
                            </Text>
                          ) : isExtended ? (
                            <Text style={{ fontSize: 13 }}>
                              <Text style={{ color: "#9EA3AD" }}>{clockIn}{" - "}</Text>
                              <Text style={{ color: "#7488FE", fontWeight: "600" }}>{clockOut}</Text>
                              {extMins > 0 ? (
                                <Text style={{ fontSize: 11, color: "#AAB4BF" }}>
                                  {" ("}{Math.floor(extMins / 60) > 0 ? `${Math.floor(extMins / 60)}시간 ` : ""}{extMins % 60 > 0 ? `${extMins % 60}분 ` : ""}{"연장)"}
                                </Text>
                              ) : null}
                            </Text>
                          ) : isNight ? (
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#6B4FEC" }}>
                              {clockIn}{" - "}{clockOut}
                            </Text>
                          ) : isHoliday ? (
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#E05C00" }}>
                              {clockIn}{" - "}{clockOut}
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 13, color: "#9EA3AD" }}>
                              {clockIn}{" - "}{clockOut}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <ChevronRight size={18} color="#DBDCDF" />
                      </View>
                    </AnimatedPressable>
                    {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: "#F0F0F0" }} />}
                  </View>
                );
              })}
            </View>
            {!showAllRecords && filteredRecords.length > 5 && (
              <AnimatedPressable
                onPress={() => setShowAllRecords(true)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 }}
                scaleAmount={0.97} opacityAmount={0.75}
              >
                <Text style={{ fontSize: 13, color: "#9EA3AD" }}>더보기</Text>
                <ChevronDown size={16} color="#9EA3AD" />
              </AnimatedPressable>
            )}
          </View>
        )}

      </ScrollView>

      {/* 월 선택 모달 */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setMonthPickerOpen(false)}
        >
          <Pressable
            style={{ width: 320, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <AnimatedPressable onPress={() => setPickerYear((p) => p - 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>{pickerYear}년</Text>
              <AnimatedPressable onPress={() => setPickerYear((p) => p + 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronRight size={20} color="#19191B" />
              </AnimatedPressable>
            </View>
            {Array.from({ length: 3 }, (_, row) => (
              <View key={row} style={{ flexDirection: "row", gap: 8, marginBottom: row < 2 ? 8 : 0 }}>
                {Array.from({ length: 4 }, (_, col) => {
                  const i = row * 4 + col;
                  const isSel = pickerYear === year && i + 1 === month;
                  return (
                    <AnimatedPressable
                      key={i}
                      onPress={() => { setYear(pickerYear); setMonth(i + 1); setMonthPickerOpen(false); setSelectedDay(null); setShowAllRecords(false); }}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: isSel ? "#4261FF" : "#F7F7F8" }}
                      scaleAmount={0.97} opacityAmount={0.8}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isSel ? "#FFFFFF" : "#19191B" }}>{i + 1}월</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 근무 정보 바텀시트 */}
      <BottomSheet isOpen={!!viewRecord} onClose={() => { setViewRecord(null); setSelectedDay(null); }} showHeader={false}>
        {viewRecord && (() => {
          const cfg        = STATUS_CONFIG[viewRecord.status ?? "off"] ?? STATUS_CONFIG.off;
          const isLate     = viewRecord.status === "late";
          const isExtended = viewRecord.status === "extended";
          const isAbsent   = viewRecord.status === "absent";
          const isNight    = viewRecord.status === "night";
          const isHoliday  = viewRecord.status === "holiday";
          const lateMin    = calcLateMin(viewRecord.scheduled_start, viewRecord.clock_in);
          const extMins    = (() => {
            if (!isExtended || !viewRecord.clock_out || !viewRecord.scheduled_end) return 0;
            let diff = toMin(viewRecord.clock_out) - toMin(viewRecord.scheduled_end);
            if (diff < 0) diff += 24 * 60;
            return Math.max(0, diff);
          })();
          const nightH         = isNight ? schedHours(viewRecord.scheduled_start, viewRecord.scheduled_end) : 0;
          const clockInColor   = isLate ? "#FF862D" : isNight ? "#6B4FEC" : isHoliday ? "#E05C00" : "#19191B";
          const clockOutColor  = isExtended ? "#7488FE" : isNight ? "#6B4FEC" : isHoliday ? "#E05C00" : "#19191B";
          return (
            <View>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>
                    {(() => { const d = new Date(viewRecord.date); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_DAYS[d.getDay()]})`; })()}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#70737B", marginTop: 4 }}>근무 정보</Text>
                </View>
                <AnimatedPressable
                  onPress={() => { setViewRecord(null); setSelectedDay(null); }}
                  hitSlop={8} scaleAmount={0.9} opacityAmount={0.7}
                >
                  <X size={20} color="#9EA3AD" />
                </AnimatedPressable>
              </View>

              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: cfg.bg, alignSelf: "flex-start", marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: cfg.color }}>{cfg.label}</Text>
              </View>

              {viewRecord.scheduled_start && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#70737B" }}>
                    {viewRecord.scheduled_start} ~ {viewRecord.scheduled_end ?? "-"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#AAB4BF" }}>근무 일정</Text>
                </View>
              )}

              <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14, gap: 12 }}>
                {isAbsent ? (
                  <Text style={{ fontSize: 14, color: "#FF3D3D", fontWeight: "500" }}>결근으로 처리된 날이에요. 근태 기록이 없어요</Text>
                ) : !viewRecord.scheduled_start ? (
                  <Text style={{ fontSize: 14, color: "#9EA3AD", fontWeight: "500" }}>근무 일정이 없는 날이에요</Text>
                ) : (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 15, color: "#70737B" }}>출근</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: clockInColor }}>
                          {viewRecord.clock_in ?? viewRecord.scheduled_start ?? "-"}
                        </Text>
                        {isLate && lateMin > 0 && (
                          <Text style={{ fontSize: 12, color: "#9EA3AD" }}>({lateMin}분 지각)</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 15, color: "#70737B" }}>퇴근</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: clockOutColor }}>
                          {viewRecord.clock_out ?? viewRecord.scheduled_end ?? "-"}
                        </Text>
                        {isExtended && extMins > 0 && (
                          <Text style={{ fontSize: 12, color: "#9EA3AD" }}>
                            ({Math.floor(extMins / 60) > 0 ? `${Math.floor(extMins / 60)}시간 ` : ""}{extMins % 60 > 0 ? `${extMins % 60}분 ` : ""}연장)
                          </Text>
                        )}
                        {isNight && nightH > 0 && (
                          <Text style={{ fontSize: 12, color: "#9EA3AD" }}>({nightH}시간 야간)</Text>
                        )}
                      </View>
                    </View>
                    {viewRecord.break_minutes != null && viewRecord.break_minutes > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 15, color: "#70737B" }}>휴게시간</Text>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{viewRecord.break_minutes}분</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <AnimatedPressable
                onPress={() => openEdit(viewRecord)}
                style={{ marginTop: 24, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
                scaleAmount={0.97} opacityAmount={0.75}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>근태 정보 수정하기</Text>
              </AnimatedPressable>
            </View>
          );
        })()}
      </BottomSheet>


      {/* 직원 선택 바텀시트 */}
      <BottomSheet isOpen={staffPickerOpen} onClose={() => setStaffPickerOpen(false)} title="직원 선택하기">
        <View style={{ marginHorizontal: -20, marginBottom: -8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: "#AAB4BF" }}>근무 직원</Text>
            <Text style={{ fontSize: 14, color: "#AAB4BF" }}>총 {staffList.length}명</Text>
          </View>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {staffList.map((staff: any) => {
              const isSel = staff.id === activeStaffId;
              return (
                <AnimatedPressable
                  key={staff.id}
                  onPress={() => {
                    setActiveStaffId(staff.id);
                    setActiveStaffName(staff.name ?? "");
                    setActiveStaffImageUrl(staff.image_url ?? null);
                    setStaffProfile(null);
                    setSelectedDay(null);
                    setStaffPickerOpen(false);
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingHorizontal: 20, paddingVertical: 12,
                    backgroundColor: isSel ? "#F0F4FF" : "#FFFFFF",
                  }}
                  scaleAmount={0.98} opacityAmount={0.85}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar name={staff.name} imageUrl={staff.image_url} size={40} defaultSource={STAFF_ICON} />
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: "500", color: isSel ? "#4261FF" : "#19191B" }}>{staff.name}</Text>
                      <Text style={{ fontSize: 12, color: "#9EA3AD", marginTop: 2 }}>{staff.contract?.employee_type ?? "직원"}</Text>
                    </View>
                  </View>
                  {isSel && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4261FF" }} />}
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>

    </SafeAreaView>
    </FadeScreen>
  );
};

export default OwnerAttendanceDetailScreen;
