import React, { useCallback, useEffect, useState, useMemo } from "react";
const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
import { View, Text, ScrollView, Pressable, Modal, TextInput } from "react-native";
import { ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import EmptyState from "@/components/EmptyState";
import FilterChips from "@/components/FilterChips";
import RequestCard from "@/components/RequestCard";
import Avatar from "@/components/Avatar";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { getShiftStyle } from "@/utils/shiftStyles";
import {
  getTodayAttendance, getOwnerWorklogRequests, handleOwnerWorklogRequest, editWorklog,
  AttendanceTodayRow, AttendanceShift, WorklogChangeRequest,
} from "@/api/owner";
import { localStorage } from "@/utils/storage";
import { badgeEvents } from "@/utils/badgeEvents";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

type Tab = "오늘의 근태" | "주간 근태" | "근태 건의 요청";
const TABS: Tab[] = ["오늘의 근태", "주간 근태", "근태 건의 요청"];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  working:     { bg: "rgba(16,201,125,0.1)",  color: "#10C97D", label: "근무중"   },
  on_break:    { bg: "rgba(255,134,45,0.1)",  color: "#FF862D", label: "휴게중"   },
  off_work:    { bg: "rgba(66,97,255,0.1)",   color: "#4261FF", label: "퇴근"     },
  absent:      { bg: "rgba(255,61,61,0.1)",   color: "#FF3D3D", label: "결근"     },
  late:        { bg: "rgba(255,134,45,0.1)",  color: "#FF862D", label: "지각"     },
  before_work: { bg: "#F7F7F8",               color: "#9EA3AD", label: "근무전"   },
  scheduled:   { bg: "#F7F7F8",               color: "#9EA3AD", label: "근무전"   },
  completed:   { bg: "rgba(16,201,125,0.1)",  color: "#10C97D", label: "근무완료" },
  extended:    { bg: "#E8F3FF",               color: "#7488FE", label: "연장"     },
  night:       { bg: "rgba(107,79,236,0.1)",  color: "#6B4FEC", label: "야간"     },
  holiday:     { bg: "rgba(224,92,0,0.1)",    color: "#E05C00", label: "휴일"     },
  vacation:    { bg: "#F7F7F8",               color: "#9EA3AD", label: "휴가"     },
};


const REQUEST_FILTERS = ["전체", "출·퇴근", "휴게", "근무 누락"];
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const formatDateLong = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_DAYS[d.getDay()]})`;
};

const formatRelativeTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1)  return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getWeekDates = (date: Date): Date[] => {
  const d   = new Date(date);
  const day = d.getDay();
  const sun = new Date(d);
  sun.setDate(d.getDate() - day);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(sun);
    dd.setDate(sun.getDate() + i);
    dates.push(dd);
  }
  return dates;
};


// ── ShiftBadge ───────────────────────────────────────────────────────────────
const ShiftBadge: React.FC<{ shift: string }> = ({ shift }) => {
  const style = getShiftStyle(shift);
  return (
    <View style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: style.bg }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: style.color }}>{shift}</Text>
    </View>
  );
};

// ── EmployeeRow ───────────────────────────────────────────────────────────────
interface EmployeeRowProps {
  row: AttendanceTodayRow;
  onPress?: () => void;
  isLast: boolean;
  showEditButton?: boolean;
  onEdit?: () => void;
}

const EmployeeRow: React.FC<EmployeeRowProps> = ({ row, onPress, isLast, showEditButton, onEdit }) => {
  const s = STATUS_STYLE[row.status] ?? STATUS_STYLE.absent;
  const isWorking = row.status === "working";

  return (
    <View style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: "#F0F0F0" }}>
      <AnimatedPressable
        onPress={onPress}
        style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}
        scaleAmount={0.98}
        opacityAmount={0.85}
      >
        {/* Avatar */}
        <View style={{ position: "relative", flexShrink: 0 }}>
          <Avatar name={row.name} imageUrl={row.image_url} size={40} defaultSource={STAFF_ICON} />
          {isWorking && (
            <View style={{
              position: "absolute", top: 0, right: 0,
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: "#10C97D", borderWidth: 2, borderColor: "#FFFFFF",
            }} />
          )}
        </View>

        {/* Name + shift + time */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {row.shift ? <ShiftBadge shift={row.shift} /> : null}
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{row.name}</Text>
          </View>
          {/* Time display */}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            {(() => {
              const s = row.status;
              const startTime = row.work_start ?? "-";
              const endTime   = row.work_end   ?? "-";
              const clockIn   = row.clock_in   ?? startTime;
              const clockOut  = row.clock_out  ?? endTime;
              const lateMins  = s === "late" && row.clock_in && row.work_start
                ? Math.max(0, toMin(row.clock_in) - toMin(row.work_start)) : 0;
              const extMins = (() => {
                if (s !== "extended" || !row.clock_out || !row.work_end) return 0;
                let d = toMin(row.clock_out) - toMin(row.work_end);
                if (d < 0) d += 24 * 60;
                return Math.max(0, d);
              })();
              const extStr = extMins > 0 ? (() => {
                const h = Math.floor(extMins / 60), m = extMins % 60;
                return m === 0 ? `${h}시간 연장` : h === 0 ? `${m}분 연장` : `${h}시간 ${m}분 연장`;
              })() : null;
              if (s === "absent") return (
                <Text style={{ fontSize: 14, color: "#AAB4BF", textDecorationLine: "line-through" }}>
                  {startTime} - {endTime}
                </Text>
              );
              if (s === "vacation" || s === "before_work" || s === "scheduled") return (
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>{startTime}{" - "}{endTime}</Text>
              );
              if (s === "late") return (
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>
                  <Text style={{ color: "#FF862D" }}>{clockIn}</Text>
                  {" - "}
                  <Text style={{ color: "#AAB4BF" }}>{endTime}</Text>
                  {lateMins > 0 ? <Text style={{ fontSize: 11 }}>{` (${lateMins}분 지각)`}</Text> : null}
                </Text>
              );
              if (s === "extended") return (
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>
                  <Text style={{ color: "#19191B" }}>{startTime}</Text>
                  {" - "}
                  <Text style={{ color: row.clock_out ? "#7488FE" : "#AAB4BF" }}>{row.clock_out ?? endTime}</Text>
                  {extStr ? <Text style={{ fontSize: 11 }}>{` (${extStr})`}</Text> : null}
                </Text>
              );
              if (s === "night") return (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ color: "#6B4FEC" }}>{startTime}</Text>
                  {" - "}
                  <Text style={{ color: "#6B4FEC" }}>{endTime}</Text>
                </Text>
              );
              if (s === "holiday") return (
                <Text style={{ fontSize: 14 }}>
                  <Text style={{ color: "#E05C00" }}>{startTime}</Text>
                  {" - "}
                  <Text style={{ color: "#E05C00" }}>{endTime}</Text>
                </Text>
              );
              if (s === "working" || s === "on_break") return (
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>
                  <Text style={{ color: "#19191B" }}>{clockIn}</Text>
                  {" - "}
                  <Text style={{ color: "#AAB4BF" }}>{endTime}</Text>
                </Text>
              );
              // off_work, completed
              return (
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>
                  <Text style={{ color: "#19191B" }}>{clockIn}</Text>
                  {" - "}
                  <Text style={{ color: "#19191B" }}>{clockOut}</Text>
                </Text>
              );
            })()}
          </View>
          {row.today_work_minutes != null && (row.status === "working" || row.status === "on_break") && (
            <Text style={{ fontSize: 12, color: "#10C97D", marginTop: 2 }}>
              {`근무 ${row.today_work_minutes >= 60 ? `${Math.floor(row.today_work_minutes / 60)}시간 ` : ""}${row.today_work_minutes % 60}분 경과`}
            </Text>
          )}
        </View>

        {/* Status badge */}
        <View style={{ paddingHorizontal: 8, height: 24, borderRadius: 4, backgroundColor: s.bg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: s.color }}>{s.label}</Text>
        </View>
      </AnimatedPressable>

      {/* 근태 수정 버튼 */}
      {showEditButton && (
        <AnimatedPressable
          onPress={onEdit}
          style={{
            marginBottom: 10, alignSelf: "flex-end",
            paddingHorizontal: 12, paddingVertical: 5,
            borderRadius: 8, borderWidth: 1, borderColor: "#DBDCDF", backgroundColor: "#FFFFFF",
          }}
          scaleAmount={0.97}
          opacityAmount={0.75}
        >
          <Text style={{ fontSize: 12, fontWeight: "500", color: "#70737B" }}>근태 수정</Text>
        </AnimatedPressable>
      )}
    </View>
  );
};

// ── CalendarTab (주간 근태) ───────────────────────────────────────────────────
interface CalendarTabProps { today: AttendanceTodayRow[]; onPressEmployee: (row: AttendanceTodayRow) => void }

const CalendarTab: React.FC<CalendarTabProps> = ({ today: todayData, onPressEmployee }) => {
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(now));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [showAll, setShowAll] = useState(false);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekDates = getWeekDates(currentDate);

  const isToday      = (d: Date) => isSameDay(d, now);
  const isSelected   = (d: Date) => selectedDate ? isSameDay(d, selectedDate) : false;
  const isFutureDate = (d: Date) => {
    const t  = new Date(now); t.setHours(0, 0, 0, 0);
    const dd = new Date(d);   dd.setHours(0, 0, 0, 0);
    return dd > t;
  };

  const handleDateClick = (d: Date) => {
    if (isFutureDate(d)) return;
    if (!isToday(d)) setSelectedDate(selectedDate && isSameDay(d, selectedDate) ? null : d);
    else setSelectedDate(null);
  };

  const navigateWeek = (dir: number) => {
    const nd = new Date(currentDate);
    nd.setDate(nd.getDate() + dir * 7);
    setCurrentDate(nd);
  };

  const displayed = showAll ? todayData : todayData.slice(0, 8);

  return (
    <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Week navigation */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0, marginBottom: 20 }}>
        <AnimatedPressable onPress={() => navigateWeek(-1)} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronLeft size={20} color="#19191B" />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => { setPickerYear(year); setMonthPickerOpen(true); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}
          hitSlop={4}
          scaleAmount={0.97}
          opacityAmount={0.8}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month + 1}월</Text>
          <ChevronDown size={16} color="#9EA3AD" />
        </AnimatedPressable>
        <AnimatedPressable onPress={() => navigateWeek(1)} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronRight size={20} color="#19191B" />
        </AnimatedPressable>
      </View>

      {/* Week day cells */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 8, marginBottom: 20 }}>
        {weekDates.map((d, i) => {
          const todayCell = isToday(d);
          const sel       = isSelected(d) && !todayCell;
          const isSun     = i === 0; const isSat = i === 6;
          const future    = isFutureDate(d);
          const dayColor  = future ? "#9EA3AD" : todayCell ? "#FFFFFF" : sel ? "#4261FF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#9EA3AD";
          const dateColor = future ? "#9EA3AD" : todayCell ? "#FFFFFF" : sel ? "#4261FF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#19191B";
          return (
            <AnimatedPressable
              key={i}
              onPress={() => handleDateClick(d)}
              disabled={future}
              style={{ alignItems: "center", opacity: future ? 0.35 : 1 }}
              scaleAmount={0.88}
              opacityAmount={0.7}
            >
              <View style={{
                width: 44, height: 64, borderRadius: 14,
                alignItems: "center", justifyContent: "center", gap: 2,
                backgroundColor: todayCell ? "#4261FF" : sel ? "rgba(66,97,255,0.1)" : "transparent",
              }}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: dayColor }}>{WEEK_DAYS[i]}</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: dateColor }}>{d.getDate()}</Text>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Employee list heading */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>근무 직원</Text>
        <Text style={{ fontSize: 14, color: "#9EA3AD" }}>총 {todayData.length}명</Text>
      </View>

      <View style={{
        marginHorizontal: 20, borderRadius: 16, backgroundColor: "#FFFFFF", paddingHorizontal: 16,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
      }}>
        {todayData.length === 0 ? (
          <EmptyState message="근무 직원 정보가 없어요" compact />
        ) : (
          displayed.map((row, i) => (
            <EmployeeRow key={row.id} row={row} isLast={i === displayed.length - 1} onPress={() => onPressEmployee(row)} />
          ))
        )}
      </View>

      {!showAll && todayData.length > 8 && (
        <AnimatedPressable
          onPress={() => setShowAll(true)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 }}
          scaleAmount={0.97}
          opacityAmount={0.75}
        >
          <Text style={{ fontSize: 13, color: "#9EA3AD" }}>더보기</Text>
          <ChevronDown size={16} color="#9EA3AD" />
        </AnimatedPressable>
      )}

      {/* Month picker modal */}
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
              <AnimatedPressable onPress={() => setPickerYear(p => p - 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>{pickerYear}년</Text>
              <AnimatedPressable onPress={() => setPickerYear(p => p + 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
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
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isSel ? "#FFFFFF" : "#19191B" }}>{i + 1}월</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
const OwnerAttendanceManagementScreen: React.FC<ScreenProps<"OwnerAttendanceManagement">> = ({ navigation }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("오늘의 근태");
  const [today, setToday]         = useState<AttendanceTodayRow[]>([]);
  const [requests, setRequests]         = useState<WorklogChangeRequest[]>([]);
  const [filter, setFilter]             = useState("전체");
  const [showAll, setShowAll]           = useState(false);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [editSheet, setEditSheet] = useState<AttendanceTodayRow | null>(null);
  const [editType,  setEditType]  = useState<"근무완료" | "지각" | "결근">("근무완료");
  const [editStart, setEditStart] = useState("");
  const [editEnd,   setEditEnd]   = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ type: "approved" | "rejected"; id: number } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedWorklogId, setSelectedWorklogId] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    getTodayAttendance(storeId).then(setToday).catch((e) => { console.warn("[today]", e); toast({ description: "근태 현황을 불러오지 못했어요.", variant: "destructive" }); });
    getOwnerWorklogRequests(storeId).then(setRequests).catch((e) => console.warn("[req]", e));
  }, [storeId]));

  const stats = useMemo(() => {
    const c = (s: string) => today.filter((e) => e.status === s).length;
    return {
      working:  c("working"),
      off:      today.filter((e) => e.status === "off_work" || e.status === "completed").length,
      before:   today.filter((e) => e.status === "before_work" || e.status === "scheduled").length,
      late:     c("late"),
      absent:   c("absent"),
      extended: c("extended"),
      night:    c("night"),
      holiday:  c("holiday"),
      vacation: c("vacation"),
      onBreak:  c("on_break"),
    };
  }, [today]);

  const statsLines = useMemo(() => {
    const line1: string[] = [];
    const line2: string[] = [];
    if (stats.working  > 0) line1.push(`출근 ${stats.working}명`);
    if (stats.off      > 0) line1.push(`퇴근 ${stats.off}명`);
    if (stats.before   > 0) line1.push(`근무전 ${stats.before}명`);
    if (stats.late     > 0) line1.push(`지각 ${stats.late}명`);
    if (stats.absent   > 0) line1.push(`결근 ${stats.absent}명`);
    if (stats.extended > 0) line2.push(`연장 ${stats.extended}명`);
    if (stats.night    > 0) line2.push(`야간 ${stats.night}명`);
    if (stats.holiday  > 0) line2.push(`휴일 ${stats.holiday}명`);
    if (stats.vacation > 0) line2.push(`휴가 ${stats.vacation}명`);
    return [line1.join(" · "), line2.join(" · ")].filter(Boolean);
  }, [stats]);

  const filterMap: Record<string, string> = {
    "출·퇴근": "출·퇴근 시간 변경",
    "휴게":     "휴게 시간 변경",
    "근무 누락": "근무 누락",
  };
  const filtered = filter === "전체"
    ? requests
    : requests.filter((r) => r.type === filterMap[filter]);

  const handleAction = (id: number, status: "approved" | "rejected") => {
    setConfirmDialog({ type: status, id });
  };

  const confirmAction = async () => {
    if (!confirmDialog) return;
    const { type, id } = confirmDialog;
    setConfirmDialog(null);
    try {
      await handleOwnerWorklogRequest(storeId, id, type);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      badgeEvents.emit();
      toast({ description: type === "approved" ? "요청이 수락 되었어요." : "요청이 거절 되었어요." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "처리에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const handleEditSave = async () => {
    if (!editSheet) return;
    const STATUS_MAP: Record<string, "off_work" | "late" | "absent"> = {
      "근무완료": "off_work",
      "지각": "late",
      "결근": "absent",
    };
    const todayDate = new Date().toISOString().slice(0, 10);
    setEditLoading(true);
    try {
      await editWorklog(storeId, {
        employee_id: editSheet.id,
        date: todayDate,
        status: STATUS_MAP[editType],
        clock_in: editType === "결근" ? null : (editStart || null),
        clock_out: editType === "결근" ? null : (editEnd || null),
        ...(selectedWorklogId != null ? { worklog_id: selectedWorklogId } : {}),
      });
      setEditSheet(null);
      toast({ description: "근태 정보가 수정 되었어요." });
      getTodayAttendance(storeId).then(setToday).catch((e) => console.warn(e));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "근태 수정에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  const sortedToday = useMemo(() => {
    const order = (e: AttendanceTodayRow) => {
      if (e.status === "working" || e.status === "on_break") return 0;
      if (e.status === "before_work" || e.status === "scheduled") return 1;
      return 2;
    };
    return [...today].sort((a, b) => order(a) - order(b));
  }, [today]);

  const displayed = showAll ? sortedToday : sortedToday.slice(0, 8);

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>

      {/* ── 헤더 ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF", borderBottomWidth: 0 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>근태 관리</Text>
      </View>

      {/* ── 탭 바 (웹앱 스타일 inline) ── */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", paddingHorizontal: 20, gap: 24 }}>
        {TABS.map((tab) => {
          const isActive   = activeTab === tab;
          const isReq      = tab === "근태 건의 요청";
          const label      = isReq ? `근태 변경 요청 ${requests.length}건` : tab;
          const hasNewBadge = isReq && requests.length > 0;
          return (
            <AnimatedPressable
              key={tab}
              onPress={() => { setActiveTab(tab); setShowAll(false); }}
              style={{ paddingVertical: 12, position: "relative" }}
              scaleAmount={0.95}
              opacityAmount={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {hasNewBadge && (
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: "#FF3D3D", marginRight: 4, marginBottom: 8,
                  }} />
                )}
                <Text style={{
                  fontSize: 16,
                  fontWeight: isActive ? "700" : "500",
                  letterSpacing: -0.32,
                  color: isActive ? "#4261FF" : "#AAB4BF",
                }}>
                  {label}
                </Text>
              </View>
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

      {/* ── 오늘의 근태 ── */}
      {activeTab === "오늘의 근태" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {/* 날짜 헤더 */}
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4, marginBottom: 12 }}>
            {formatDateLong(new Date().toISOString().slice(0, 10))}
          </Text>

          {/* 요약 카드 (웹앱과 동일) */}
          <View style={{ backgroundColor: "#F0F7FF", borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{
              alignSelf: "flex-start", height: 17, borderRadius: 4,
              paddingHorizontal: 8, backgroundColor: "#D3DAFF",
              justifyContent: "center", marginBottom: 8,
            }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: "#7488FE" }}>오늘의 근무 현황</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>총 근무자</Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#4261FF" }}>{today.length}명</Text>
            </View>
            <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginVertical: 10 }} />
            {statsLines.length > 0 ? (
              statsLines.map((line, i) => (
                <Text key={i} style={{ fontSize: 14, color: "#70737B", lineHeight: 22 }}>{line}</Text>
              ))
            ) : (
              <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 22 }}>근무 정보가 없어요</Text>
            )}
          </View>

          {/* 오늘의 근태현황 */}
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36, marginBottom: 12 }}>오늘의 근태현황</Text>

          {today.length === 0 ? (
            <View style={{ borderRadius: 16, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
              <EmptyState message="오늘 근태 정보가 없어요" />
            </View>
          ) : (
            <View style={{ borderRadius: 16, backgroundColor: "#FFFFFF", paddingHorizontal: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
              {displayed.map((row, i) => (
                <EmployeeRow
                  key={row.id}
                  row={row}
                  isLast={i === displayed.length - 1}
                  onPress={() => navigation.navigate("OwnerAttendanceDetail", { staffId: row.id, name: row.name, imageUrl: row.image_url })}
                  showEditButton
                  onEdit={() => {
                    const firstShift = row.shifts?.[0];
                    navigation.navigate("OwnerAttendanceEdit", {
                      staffId: row.id,
                      staffName: row.name,
                      date: new Date().toISOString().slice(0, 10),
                      status: row.status,
                      clockIn: firstShift?.clock_in ?? row.clock_in ?? null,
                      clockOut: firstShift?.clock_out ?? row.clock_out ?? null,
                      scheduledStart: row.work_start ?? null,
                      scheduledEnd: row.work_end ?? null,
                      breakMinutes: firstShift?.break_minutes ?? null,
                    });
                  }}
                />
              ))}
            </View>
          )}

          {!showAll && sortedToday.length > 8 && (
            <AnimatedPressable
              onPress={() => setShowAll(true)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12 }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 13, color: "#9EA3AD" }}>더보기</Text>
              <ChevronDown size={16} color="#9EA3AD" />
            </AnimatedPressable>
          )}
        </ScrollView>
      )}

      {/* ── 주간 근태 ── */}
      {activeTab === "주간 근태" && (
        <CalendarTab
          today={sortedToday}
          onPressEmployee={(row) => navigation.navigate("OwnerAttendanceDetail", { staffId: row.id, name: row.name, imageUrl: row.image_url })}
        />
      )}

      {/* ── 근태 건의 요청 ── */}
      {activeTab === "근태 건의 요청" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ flex: 1, backgroundColor: "#F7F7F8" }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }} nestedScrollEnabled>

          <FilterChips
            filters={REQUEST_FILTERS}
            active={filter}
            onChange={setFilter}
            totalCount={requests.length}
          />

          <View style={{ gap: 16 }}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
                <Text style={{ fontSize: 14, color: "#9EA3AD" }}>근태 건의 요청이 없어요</Text>
              </View>
            ) : (
              filtered.map((r) => {
                const dateLine    = formatDateLong(r.date);
                const originalTime = r.origin_start || r.origin_end ? `${r.origin_start ?? ""} - ${r.origin_end ?? ""}` : "";
                const changedTime  = r.desired_start || r.desired_end ? `${r.desired_start ?? ""} - ${r.desired_end ?? ""}` : "";
                return (
                  <View key={r.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2, overflow: "hidden" }}>
                    <View style={{ padding: 16, paddingBottom: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <View style={{ height: 20, borderRadius: 6, paddingHorizontal: 10, backgroundColor: "#EEF1FF", justifyContent: "center" }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF" }}>{r.type}</Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: "500", color: "#AAB4BF", letterSpacing: -0.24 }}>
                          {formatRelativeTime(r.created_at)}
                        </Text>
                      </View>
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 2 }}>요청 직원</Text>
                        <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{r.employee_name} · 직원</Text>
                      </View>
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>변경 요청 사항</Text>
                        <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9EA3AD", marginBottom: 4 }}>
                            {r.type === "근무 누락" ? "미근무 일정" : "기존 일정"}
                          </Text>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
                            {originalTime ? `${dateLine} | ${originalTime}` : dateLine}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: "#F0F7FF", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF", marginBottom: 4 }}>변경 일정</Text>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
                            {changedTime ? `${dateLine} | ${changedTime}` : dateLine}
                          </Text>
                          {r.desired_break_minutes != null && (
                            <Text style={{ fontSize: 13, color: "#70737B", marginTop: 2 }}>
                              [휴게] {r.desired_break_minutes}분
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 2 }}>요청 사유</Text>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{r.reason ?? ""}</Text>
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: "#F0F0F0", marginHorizontal: 16 }} />
                    <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingHorizontal: 16 }}>
                      <AnimatedPressable
                        onPress={() => handleAction(r.id, "rejected")}
                        style={{ flex: 1, height: 48, borderRadius: 10, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}
                        scaleAmount={0.97}
                        opacityAmount={0.75}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.32, color: "#4261FF" }}>거절하기</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => handleAction(r.id, "approved")}
                        style={{ flex: 1, height: 48, borderRadius: 10, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
                        scaleAmount={0.97}
                        opacityAmount={0.75}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.32, color: "#FFFFFF" }}>승인하기</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      )}

      <OwnerBottomNav activeTab="attendance" navigation={navigation} />

      {/* ── 승인/거절 확인 다이얼로그 (웹앱과 동일) ── */}
      <Modal
        visible={!!confirmDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDialog(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setConfirmDialog(null)}
        >
          <Pressable
            style={{ width: "85%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 20, alignItems: "center", paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 8 }}>
              {confirmDialog?.type === "approved" ? "근태 건의 요청 수락" : "근태 건의 요청 거절"}
            </Text>
            <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22, marginBottom: 20 }}>
              {confirmDialog?.type === "approved"
                ? "근태 건의 요청을 수락하시겠어요?\n수락 즉시 해당 직원의 근태 정보가\n변경 처리돼요"
                : "근태 건의 요청을 거절하시겠어요?\n거절 즉시 해당 직원의 근태 정보가\n변경 처리돼요"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
              <AnimatedPressable
                onPress={() => setConfirmDialog(null)}
                style={{ flex: 1, height: 52, backgroundColor: "#EBEBEB", borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                scaleAmount={0.97}
                opacityAmount={0.75}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={confirmAction}
                style={{ flex: 1, height: 52, backgroundColor: "#4261FF", borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                scaleAmount={0.97}
                opacityAmount={0.75}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 근태 수정 BottomSheet ── */}
      <BottomSheet isOpen={!!editSheet} onClose={() => setEditSheet(null)} title="근태 정보 수정">
        {editSheet && (
          <View>
            {/* 직원 정보 */}
            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B", letterSpacing: -0.3 }}>
                {editSheet.name} 직원의 근태 정보 수정
              </Text>
              {(editSheet.work_start || editSheet.work_end) && (
                <Text style={{ fontSize: 13, color: "#7488FE", marginTop: 4 }}>
                  {editSheet.work_start ?? "-"} - {editSheet.work_end ?? "-"}
                </Text>
              )}
            </View>

            {/* 분할 근무 shift 선택 */}
            {editSheet.shifts && editSheet.shifts.length > 1 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B", marginBottom: 8 }}>수정할 근무 구간</Text>
                {editSheet.shifts.map((sh: AttendanceShift) => (
                  <AnimatedPressable
                    key={sh.worklog_id}
                    onPress={() => {
                      setSelectedWorklogId(sh.worklog_id);
                      setEditStart(sh.clock_in ?? "");
                      setEditEnd(sh.clock_out ?? "");
                    }}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
                      backgroundColor: selectedWorklogId === sh.worklog_id ? "#F0F4FF" : "#F7F7F8",
                    }}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                  >
                    <Text style={{ fontSize: 14, fontWeight: selectedWorklogId === sh.worklog_id ? "700" : "500", color: selectedWorklogId === sh.worklog_id ? "#4261FF" : "#19191B" }}>
                      {`${sh.clock_in ?? "-"} - ${sh.clock_out ?? "-"}${sh.break_minutes > 0 ? ` (휴게 ${sh.break_minutes}분)` : ""}`}
                    </Text>
                    {selectedWorklogId === sh.worklog_id && <Check size={18} color="#4261FF" />}
                  </AnimatedPressable>
                ))}
              </View>
            )}

            {/* 근태 유형 선택 */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B", marginBottom: 8 }}>근태 유형</Text>
            {(["근무완료", "지각", "결근"] as const).map((type) => (
              <AnimatedPressable
                key={type}
                onPress={() => setEditType(type)}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
                  backgroundColor: editType === type ? "#F0F4FF" : "transparent",
                }}
                scaleAmount={0.98}
                opacityAmount={0.85}
              >
                <Text style={{ fontSize: 15, fontWeight: editType === type ? "700" : "500", color: editType === type ? "#4261FF" : "#19191B" }}>
                  {type}
                </Text>
                {editType === type && <Check size={18} color="#4261FF" />}
              </AnimatedPressable>
            ))}

            {/* 시간 입력 (결근 제외) */}
            {editType !== "결근" && (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B", marginBottom: 8 }}>출근 시간</Text>
                    <TextInput
                      value={editStart}
                      onChangeText={setEditStart}
                      placeholder="00:00"
                      placeholderTextColor="#AAB4BF"
                      style={{ height: 48, borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: "#19191B" }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B", marginBottom: 8 }}>퇴근 시간</Text>
                    <TextInput
                      value={editEnd}
                      onChangeText={setEditEnd}
                      placeholder="00:00"
                      placeholderTextColor="#AAB4BF"
                      style={{ height: 48, borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: "#19191B" }}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* 수정 버튼 */}
            <AnimatedPressable
              disabled={editLoading}
              onPress={handleEditSave}
              style={{ marginTop: 24, height: 56, borderRadius: 16, backgroundColor: editLoading ? "#A0AEFF" : "#4261FF", alignItems: "center", justifyContent: "center" }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>{editLoading ? "수정 중..." : "수정하기"}</Text>
            </AnimatedPressable>
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
    </FadeScreen>
  );
};

export default OwnerAttendanceManagementScreen;
