import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
const MORNING_ICON = require("../../../assets/images/icon/morning.png");
const LUNCH_ICON   = require("../../../assets/images/icon/lunch.png");
const NIGHT_ICON   = require("../../../assets/images/icon/night.png");
const SHIFT_ICON_SOURCES: [string[], any][] = [
  [["오픈", "오전", "1교대"], MORNING_ICON],
  [["미들", "오후", "2교대"], LUNCH_ICON],
  [["마감", "저녁", "3교대"], NIGHT_ICON],
];
const getShiftIcon = (name: string): any | null => {
  for (const [keywords, src] of SHIFT_ICON_SOURCES) {
    if (keywords.some((k) => name.includes(k))) return src;
  }
  return null;
};
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FadeScreen from "@/components/FadeScreen";
import { ChevronLeft, ChevronRight, Trash2, X, Plus, CalendarClock, TreePalm } from "lucide-react-native";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "@/components/Toast";
import {
  getMySchedule, getAllSchedule, getAllScheduleDetail, getScheduleChange, deleteScheduleChange,
  type StoreSetting,
} from "@/api/employee";
import { getShiftStyle, DEFAULT_SHIFT_STYLE } from "@/utils/shiftStyles";
import EmployeeBottomNav from "@/components/EmployeeBottomNav";
import { localStorage } from "@/utils/storage";
import { hapticLight, hapticSelection } from "@/utils/haptics";
import { DAY_LABELS } from "@/utils/constants";
import type { ScreenProps } from "@/navigation/types";

type Tab = "나의 일정" | "전체 직원 일정" | "변경 요청 내역";
const ALL_SCHEDULE_TABS: Tab[] = ["나의 일정", "전체 직원 일정", "변경 요청 내역"];
const FILTER_TABS = ["전체", "일정 변경", "휴가"] as const;

const REQUEST_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  대기중: { bg: "#FDF9DF", color: "#FFB300" },
  승인: { bg: "#ECFFF1", color: "#1EDC83" },
  거절: { bg: "#FFEAE6", color: "#FF3D3D" },
};
const REQUEST_TYPE_STYLE = { bg: "#E8F3FF", color: "#4261FF" };

const getPartStyle = (partName?: string | null) => {
  const s = getShiftStyle(partName);
  return { bg: s.bg, text: s.text };
};

const Badge: React.FC<{ label: string; bg: string; color: string }> = ({ label, bg, color }) => (
  <View style={{ height: 20, borderRadius: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: bg }}>
    <Text style={{ fontSize: 13, fontWeight: "600", color }}>{label}</Text>
  </View>
);

const formatDateLong = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
};
const formatDateShort = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${DAY_LABELS[d.getDay()]})`;
};

const EmployeeScheduleScreen: React.FC<ScreenProps<"EmployeeSchedule">> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("나의 일정");
  const [date, setDate] = useState(new Date());
  const [mySchedule, setMySchedule] = useState<Record<string, any>>({});
  const [storeSetting, setStoreSetting] = useState<StoreSetting | null>(null);
  const [allSummary, setAllSummary] = useState<Record<string, any>>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<typeof FILTER_TABS[number]>("전체");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [allStaffDetail, setAllStaffDetail] = useState<any[] | null>(null);
  const [allDetailLoading, setAllDetailLoading] = useState(false);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  // B6/B7 납품 후 자동 활성화
  const workingStatus = localStorage.getItem("employeeWorkingStatus") ?? "";
  const isResigned = workingStatus === "퇴사";
  const isOnLeave = workingStatus === "휴직";
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const year = date.getFullYear();
  const month = date.getMonth();

  useEffect(() => {
    if (!storeId) return;
    getMySchedule(storeId, year, month + 1).then((d) => {
      setStoreSetting(d.store_setting ?? null);
      setMySchedule(d.schedules ?? {});
    }).catch(() => { setMySchedule({}); setStoreSetting(null); });
    getAllSchedule(storeId, year, month + 1).then((d) => setAllSummary(d as any)).catch(() => setAllSummary({}));
  }, [storeId, year, month]);

  useFocusEffect(
    useCallback(() => {
      if (!storeId) return;
      getScheduleChange(storeId).then((rows: any) => setRequests(rows ?? [])).catch(() => setRequests([]));
    }, [storeId])
  );

  const handleDelete = async (id: any) => {
    try {
      await deleteScheduleChange(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setDeleteTargetId(null);
      toast({ description: "요청 내역을 삭제했어요" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제에 실패했어요";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const prevMonth = () => setDate(new Date(year, month - 1, 1));
  const nextMonth = () => setDate(new Date(year, month + 1, 1));

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

  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
        if (filterTab === "전체") return true;
        if (filterTab === "일정 변경") return r.type !== "vacation";
        if (filterTab === "휴가") return r.type === "vacation";
        return true;
      })
      .sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });
  }, [requests, filterTab]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const getDateKey = (d: number) => `${year}-${month + 1}-${d}`;

  const selectedSchedule = selectedDate ? mySchedule[selectedDate] : null;

  const isHolidayDate = (dateKey: string, weekdayIdx: number): boolean => {
    const override = storeSetting?.holiday_overrides?.find((o) => o.date === dateKey);
    if (override) return override.type === "closed";
    return !!(storeSetting?.is_fixed_holiday && storeSetting.holiday_days?.includes(DAY_LABELS[weekdayIdx]));
  };

  const selectedDateIsFixedHoliday = (() => {
    if (!selectedDate) return false;
    const parts = selectedDate.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isHolidayDate(selectedDate, d.getDay());
  })();

  const handleDatePress = async (key: string, day: number) => {
    setSelectedDate(key);
    setSheetOpen(true);
    if (activeTab === "전체 직원 일정") {
      setAllStaffDetail(null);
      setAllDetailLoading(true);
      try {
        const parts = key.split("-").map(Number);
        const data = await getAllScheduleDetail(storeId, parts[0], parts[1], parts[2]);
        setAllStaffDetail(data as any[]);
      } catch {
        setAllStaffDetail([]);
      } finally {
        setAllDetailLoading(false);
      }
    }
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    const parts = selectedDate.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return `${parts[0]}년 ${parts[1]}월 ${parts[2]}일 (${DAY_LABELS[d.getDay()]})`;
  };

  const showCalendar = activeTab === "나의 일정" || activeTab === "전체 직원 일정";

  return (
    <FadeScreen>
    <View style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.navigate("EmployeeHome")} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>일정 확인</Text>
        </View>

        {/* Tab bar */}
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }} contentContainerStyle={{ paddingHorizontal: 20, gap: 24, flexDirection: "row" }}>
          {ALL_SCHEDULE_TABS.filter(t => !(isResigned && t === "전체 직원 일정")).map((tab) => (
            <AnimatedPressable key={tab} scaleAmount={0.95} opacityAmount={0.8} onPress={() => { hapticSelection(); setActiveTab(tab); }} style={{ paddingVertical: 12, position: "relative" }}>
              <Text style={{ fontSize: 16, fontWeight: activeTab === tab ? "700" : "500", letterSpacing: -0.32, color: activeTab === tab ? "#4261FF" : "#AAB4BF", flexShrink: 0 }}>
                {tab === "변경 요청 내역" ? `변경 요청 내역 ${requests.length}건` : tab}
              </Text>
              {activeTab === tab && (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 9999, backgroundColor: "#4261FF" }} />
              )}
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      {/* Calendar view */}
      {showCalendar && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
            <AnimatedPressable scaleAmount={0.88} opacityAmount={0.7} onPress={prevMonth} style={{ padding: 4 }} hitSlop={8}>
              <ChevronLeft size={20} color="#19191B" />
            </AnimatedPressable>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month + 1}월</Text>
            <AnimatedPressable scaleAmount={0.88} opacityAmount={0.7} onPress={nextMonth} style={{ padding: 4 }} hitSlop={8}>
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
                  const isSun = ci === 0;
                  const isSat = ci === 6;
                  const key = getDateKey(cell.day);
                  const schedData = !cell.isOutside && activeTab === "나의 일정" ? mySchedule[key] : null;
                  const isHoliday = schedData?.is_holiday === true || (!schedData && !cell.isOutside && isHolidayDate(key, ci));
                  const isVacation = schedData?.is_vacation === true;
                  const dateColor = cell.isOutside ? "#AAB4BF" : isToday ? "#FFFFFF" : (isHoliday || isVacation) ? "#DBDCDF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#70737B";
                  const partStyle = schedData ? getPartStyle(schedData.shift_name) : DEFAULT_SHIFT_STYLE;
                  const allEntry = !cell.isOutside && activeTab === "전체 직원 일정" ? allSummary[`${year}-${month + 1}-${cell.day}`] : null;

                  return (
                    <AnimatedPressable
                      key={ci}
                      scaleAmount={0.85}
                      opacityAmount={0.7}
                      disabled={cell.isOutside}
                      onPress={() => {
                        if (cell.isOutside) return;
                        handleDatePress(key, cell.day);
                      }}
                      style={{ flex: 1, alignItems: "center", paddingVertical: 6, minHeight: 90 }}
                    >
                      <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                        <View style={isToday ? { backgroundColor: "#4261FF", borderRadius: 10, minWidth: 40, width: 40, height: 22, alignItems: "center", justifyContent: "center" } : {}}>
                          <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: dateColor, textDecorationLine: (!isToday && (isHoliday || isVacation)) ? "line-through" : "none" }}>
                            {cell.isOutside ? "" : cell.day}
                          </Text>
                        </View>
                      </View>

                      {/* My schedule */}
                      {activeTab === "나의 일정" && !cell.isOutside && (
                        <View style={{ width: "100%", paddingHorizontal: 2 }}>
                          {!isVacation && !isHoliday && schedData?.work_start && (
                            <View style={{ backgroundColor: partStyle.bg, borderRadius: 4, minHeight: 36, paddingVertical: 2, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: partStyle.text }}>{schedData.work_start}</Text>
                              <Text style={{ fontSize: 9, color: partStyle.text }}>-</Text>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: partStyle.text }}>{schedData.work_end}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* All staff */}
                      {activeTab === "전체 직원 일정" && !cell.isOutside && allEntry && (
                        <View style={{ width: "100%", paddingHorizontal: 2, gap: 2 }}>
                          {Object.entries(allEntry).filter(([, cnt]) => (cnt as number) > 0).map(([name, cnt]) => {
                            const s = getShiftStyle(name);
                            const iconSrc = getShiftIcon(name);
                            return (
                              <View key={name} style={{ backgroundColor: s.bg, borderRadius: 4, height: 16, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                {iconSrc ? <Image source={iconSrc} style={{ width: 9, height: 9 }} resizeMode="contain" /> : <Text style={{ fontSize: 9, fontWeight: "600", color: s.text }}>{name.slice(0, 1)}</Text>}
                                <Text style={{ fontSize: 11, fontWeight: "600", color: s.text }}>{cnt as number}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </AnimatedPressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Requests tab */}
      {activeTab === "변경 요청 내역" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ backgroundColor: "#F7F7F8", flexGrow: 1, paddingBottom: 80 }}>
          <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 8 }}>
            {FILTER_TABS.map((f) => {
              const isActive = filterTab === f;
              const label = f === "전체" ? `전체 ${requests.length}` : f;
              return (
                <AnimatedPressable
                  key={f}
                  scaleAmount={0.95}
                  opacityAmount={0.8}
                  onPress={() => setFilterTab(f)}
                  style={{ height: 28, borderRadius: 9999, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF", borderWidth: 1, borderColor: isActive ? "#4261FF" : "#DBDCDF" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: isActive ? "#4261FF" : "#AAB4BF" }}>{label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <View style={{ gap: 16, paddingHorizontal: 20, paddingBottom: 20 }}>
            {filteredRequests.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>요청 내역이 없어요</Text>
              </View>
            ) : (
              filteredRequests.map((r: any) => {
                const statusLabel = r.status === "pending" ? "대기중" : r.status === "approved" ? "승인" : "거절";
                const statusStyle = REQUEST_STATUS_STYLE[statusLabel];
                const isVacation = r.type === "vacation";
                const canDelete = r.status === "approved" || r.status === "rejected";
                const origDate = r.origin_date ? formatDateShort(r.origin_date) : "-";
                const desiredDate = r.desired_date ? formatDateShort(r.desired_date) : "-";
                const origTime = r.origin_start || r.origin_end ? ` | ${r.origin_start ?? ""} - ${r.origin_end ?? ""}` : "";
                const desiredTime = r.desired_start || r.desired_end ? ` | ${r.desired_start ?? ""} - ${r.desired_end ?? ""}` : "";
                return (
                  <View key={r.id} style={{ borderRadius: 16, backgroundColor: "#FFFFFF", padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Badge label={statusLabel} bg={statusStyle.bg} color={statusStyle.color} />
                        <Badge label={isVacation ? "휴가 요청" : "일정 변경 요청"} bg={REQUEST_TYPE_STYLE.bg} color={REQUEST_TYPE_STYLE.color} />
                      </View>
                      {canDelete && (
                        <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={() => setDeleteTargetId(String(r.id))} hitSlop={8}>
                          <Trash2 size={18} color="#AAB4BF" />
                        </AnimatedPressable>
                      )}
                    </View>

                    {!isVacation && r.origin_date && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>변경 요청 사항</Text>
                        <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F7F7F8", marginBottom: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9EA3AD", marginBottom: 4 }}>기존 일정</Text>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{origDate}{origTime}</Text>
                        </View>
                        <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F0F7FF" }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF", marginBottom: 4 }}>변경 일정</Text>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{desiredDate}{desiredTime}</Text>
                        </View>
                      </View>
                    )}

                    {isVacation && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>휴가 요청 일정</Text>
                        <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#F0F7FF" }}>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{desiredDate}{desiredTime}</Text>
                        </View>
                      </View>
                    )}

                    <View>
                      <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 2 }}>
                        {isVacation ? "휴가 요청 사유" : "변경 요청 사유"}
                      </Text>
                      <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{r.reason}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Day detail bottom sheet */}
      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} showHeader={false}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36, flex: 1, marginRight: 8 }}>{formatSelectedDate()}</Text>
          <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={() => setSheetOpen(false)} hitSlop={8}>
            <X size={24} color="#19191B" />
          </AnimatedPressable>
        </View>

        {activeTab === "나의 일정" && (
          <View>
            {selectedSchedule?.is_vacation ? (
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 4, alignSelf: "flex-start", paddingHorizontal: 8, height: 22, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#AAB4BF" }}>휴가</Text>
              </View>
            ) : selectedSchedule && !selectedSchedule.is_holiday && selectedSchedule.work_start ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ backgroundColor: getPartStyle(selectedSchedule.shift_name).bg, borderRadius: 4, paddingHorizontal: 8, height: 22, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: getPartStyle(selectedSchedule.shift_name).text }}>
                    {selectedSchedule.shift_name ?? "[일일]"}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: "#19191B" }}>
                  {selectedSchedule.work_start} - {selectedSchedule.work_end}
                </Text>
              </View>
            ) : (selectedSchedule?.is_holiday || (!selectedSchedule && selectedDateIsFixedHoliday)) ? (
              <View style={{ backgroundColor: "#DBDCDF", borderRadius: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#93989E" }}>
                  {!selectedSchedule && selectedDateIsFixedHoliday ? "고정 휴무" : "휴무"}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ backgroundColor: DEFAULT_SHIFT_STYLE.bg, borderRadius: 4, paddingHorizontal: 8, height: 22, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: DEFAULT_SHIFT_STYLE.text }}>근무 일정</Text>
                </View>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>없음</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "전체 직원 일정" && (
          <View style={{ gap: 20 }}>
            {allDetailLoading ? (
              <Text style={{ fontSize: 14, color: "#AAB4BF" }}>로딩 중...</Text>
            ) : allStaffDetail && allStaffDetail.length > 0 ? (
              allStaffDetail.map((part: any) => {
                const shiftStyle = getShiftStyle(part.shift_name);
                return (
                  <View key={part.part_id}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <View style={{ backgroundColor: shiftStyle.bg, borderRadius: 4, paddingHorizontal: 8, height: 22, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: shiftStyle.text }}>{part.shift_name}</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: "#9EA3AD" }}>{part.employees?.length ?? 0}명</Text>
                    </View>
                    <View style={{ paddingLeft: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                        <Text style={{ fontSize: 14, color: "#70737B" }}>
                          {part.start_time} - {part.end_time}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flexShrink: 1 }}>
                          {(part.employees ?? []).map((e: any) => e.name).join(", ")}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: "#9EA3AD" }}>근무 일정이 없어요</Text>
              </View>
            )}
          </View>
        )}

        <AnimatedPressable
          scaleAmount={0.97}
          opacityAmount={0.75}
          onPress={() => setSheetOpen(false)}
          style={{ marginTop: 32, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
        </AnimatedPressable>
      </BottomSheet>

      <ConfirmDialog
        visible={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="변경 요청 내역 삭제"
        description={"변경 요청 내역을 삭제 하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소", onPress: () => setDeleteTargetId(null), variant: "cancel" },
          { label: "삭제하기", onPress: () => handleDelete(deleteTargetId), variant: "danger" },
        ]}
      />
    </SafeAreaView>
    <EmployeeBottomNav activeTab="schedule" navigation={navigation} />
    {showCalendar && !isResigned && !isOnLeave && (
      <>
        {fabOpen && (
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.80)", zIndex: 200 }}
            onPress={() => setFabOpen(false)}
          />
        )}
        <View style={{ position: "absolute", bottom: 90 + insets.bottom, right: 20, alignItems: "flex-end", zIndex: 201, gap: 12 }}>
          {fabOpen && (
            <View style={{ backgroundColor: "#2B2D36", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 32, shadowOffset: { width: 0, height: 8 }, elevation: 8, minWidth: 200, marginBottom: 4 }}>
              {[
                { Icon: CalendarClock, label: "일정 변경 요청", onPress: () => { setFabOpen(false); navigation.navigate("ScheduleChangeRequest"); } },
                { Icon: TreePalm, label: "휴가 요청", onPress: () => { setFabOpen(false); navigation.navigate("VacationRequest"); } },
              ].map(({ Icon, label, onPress }, i, arr) => (
                <AnimatedPressable key={label} scaleAmount={0.97} opacityAmount={0.75} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.07)" }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} color="#FFFFFF" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#FFFFFF", letterSpacing: -0.3 }}>{label}</Text>
                </AnimatedPressable>
              ))}
            </View>
          )}
          <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={() => { hapticLight(); setFabOpen(!fabOpen); }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: fabOpen ? "#5C5F6B" : "#4261FF", alignItems: "center", justifyContent: "center", shadowColor: "#4261FF", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
            {fabOpen ? <X size={22} color="#FFFFFF" /> : <Plus size={22} color="#FFFFFF" />}
          </AnimatedPressable>
        </View>
      </>
    )}
    </View>
    </FadeScreen>
  );
};

export default EmployeeScheduleScreen;
