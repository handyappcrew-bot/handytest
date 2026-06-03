import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import Avatar from "@/components/Avatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useToast } from "@/components/Toast";
import { createOwnerSchedule, getOwnerSchedules, OwnerSchedule } from "@/api/owner";
import { getCachedStaffList, getCachedStoreInfo } from "@/utils/cachedApi";
import { getShiftStyle, inferShiftName, StoreShift } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import { DAY_LABELS } from "@/utils/constants";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");

interface StaffItem {
  id: number;
  name: string;
  image_url?: string | null;
  birth?: string | null;
  gender?: string | null;
  contract?: { employee_type?: string | null; working_status?: string | null } | null;
}

const calcAge = (birth: string | null | undefined): number | null => {
  if (!birth) return null;
  const b = new Date(birth.replace(/\./g, "-"));
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

const normalizeGender = (g: string | null | undefined) => {
  if (!g) return null;
  if (g === "male" || g === "남") return "남자";
  if (g === "female" || g === "여") return "여자";
  return null;
};

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

const toMinutes = toMin;

const isCrossing = (start: string, end: string) => toMinutes(end) <= toMinutes(start);

const timeLabel = (t: string, start?: string) => {
  const nextDay = start && isCrossing(start, t);
  const h = Number(t.split(":")[0]);
  const prefix = !start
    ? h < 6 ? "새벽 " : ""
    : nextDay ? "다음날 " : "";
  return `${prefix}${t}`;
};

const OwnerScheduleAddScreen: React.FC<ScreenProps<"OwnerScheduleAdd">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const [step, setStep] = useState<1 | 2>(1);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [schedules, setSchedules] = useState<OwnerSchedule[]>([]);
  const [storeShifts, setStoreShifts] = useState<StoreShift[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [activeTimePicker, setActiveTimePicker] = useState<"start" | "end" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    getCachedStaffList(storeId).then((r: any) => {
      const filtered = (r ?? []).filter((s: any) => {
        const ws = s.working_status ?? s.contract?.working_status;
        return ws !== "퇴사" && ws !== "앱탈퇴";
      });
      setStaffList(filtered);
    }).catch((e) => { console.warn(e); toast({ description: "직원 목록을 불러오지 못했어요.", variant: "destructive" }); });
    getCachedStoreInfo(storeId).then((d: any) => setStoreShifts(d?.shifts ?? [])).catch((e) => console.warn(e));
  }, [storeId]);

  useEffect(() => {
    getOwnerSchedules(storeId, calYear, calMonth + 1).then(setSchedules).catch((e) => console.warn(e));
  }, [storeId, calYear, calMonth]);

  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: number[] = [...Array(firstDow).fill(0), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(0);
  const weeks: number[][] = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const monthlyMap: Record<number, string[]> = {};
  const holidayDaySet = new Set<number>();
  schedules.forEach((r) => {
    const d = Number(r.work_date.slice(8, 10));
    if (!monthlyMap[d]) monthlyMap[d] = [];
    const sh = r.shift_name ?? inferShiftName(r.work_start, storeShifts);
    if (sh && !monthlyMap[d].includes(sh)) monthlyMap[d].push(sh);
    if (r.is_holiday) holidayDaySet.add(d);
  });

  const toIso = (d: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const selectedStaffItem = staffList.find((s) => s.id === selectedStaff) ?? null;
  const staffName = selectedStaffItem?.name ?? "";
  const canNext = selectedStaff !== null;
  const canSubmit = selectedDate !== null;

  type DayMember = { name: string; start: string | null; end: string | null };
  type DayGroup  = { shift: string; members: DayMember[]; color: string };

  const dayDetailMap = useMemo(() => {
    const map: Record<number, DayGroup[]> = {};
    schedules.forEach((r) => {
      const d = Number(r.work_date.slice(8, 10));
      const shift = r.shift_name ?? inferShiftName(r.work_start, storeShifts) ?? "일일";
      const color = getShiftStyle(shift, storeShifts).color;
      if (!map[d]) map[d] = [];
      const group = map[d].find((g) => g.shift === shift);
      const member: DayMember = { name: r.employee_name, start: r.work_start, end: r.work_end };
      if (group) {
        if (!group.members.some((m) => m.name === r.employee_name)) group.members.push(member);
      } else {
        map[d].push({ shift, members: [member], color });
      }
    });
    return map;
  }, [schedules, storeShifts]);

  const selectedDayGroups = selectedDate
    ? dayDetailMap[Number(selectedDate.slice(8, 10))] ?? []
    : [];

  const isSelectedDateHoliday = selectedDate
    ? schedules.some((r) => r.work_date === selectedDate && r.is_holiday)
    : false;

  const handleSubmit = async () => {
    if (!selectedStaff || !selectedDate || submitting) return;
    setSubmitting(true);
    try {
      await createOwnerSchedule(storeId, {
        employee_id: selectedStaff,
        work_date: selectedDate,
        work_start: startTime || null,
        work_end: endTime || null,
      });
      toast({ description: "일정이 추가되었어요." });
      navigation.goBack();
    } catch {
      toast({ description: "일정 추가에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <AnimatedPressable onPress={() => step === 1 ? navigation.goBack() : setStep(1)} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronLeft size={24} color="#19191B" />
        </AnimatedPressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>일일 일정 추가</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }}>
        {([1, 2] as const).map((s) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? "#4261FF" : "#EBEBEB" }} />
        ))}
      </View>

      {step === 1 && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>직원 선택</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>일정을 추가할 직원을 선택해주세요</Text>
          {staffList.length === 0 ? (
            <Text style={{ fontSize: 14, color: "#AAB4BF", textAlign: "center", paddingVertical: 40 }}>등록된 직원이 없어요</Text>
          ) : staffList.map((s) => {
            const isSel = selectedStaff === s.id;
            const age = calcAge(s.birth);
            const gender = normalizeGender(s.gender);
            const empType = s.contract?.employee_type ?? null;
            const subParts = [age !== null ? `${age}세` : null, gender, empType].filter(Boolean);
            return (
              <AnimatedPressable
                key={s.id}
                onPress={() => setSelectedStaff(s.id)}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginBottom: 8,
                  backgroundColor: isSel ? "#E8F3FF" : "#F7F7F8",
                  borderWidth: isSel ? 1.5 : 0, borderColor: "#4261FF",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={s.name} imageUrl={s.image_url} size={44} defaultSource={STAFF_ICON} />
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: isSel ? "#4261FF" : "#19191B", letterSpacing: -0.3 }}>{s.name}</Text>
                    {subParts.length > 0 && (
                      <Text style={{ fontSize: 13, color: isSel ? "#7488FE" : "#9EA3AD", marginTop: 2 }}>{subParts.join(" · ")}</Text>
                    )}
                  </View>
                </View>
                {isSel && <Check size={18} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {/* 선택된 직원 카드 */}
          {selectedStaffItem && (() => {
            const age = calcAge(selectedStaffItem.birth);
            const gender = normalizeGender(selectedStaffItem.gender);
            const empType = selectedStaffItem.contract?.employee_type ?? null;
            const subParts = [age !== null ? `${age}세` : null, gender, empType].filter(Boolean);
            return (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginBottom: 20,
                backgroundColor: "#E8F3FF", borderWidth: 1.5, borderColor: "#4261FF",
              }}>
                <Avatar name={selectedStaffItem.name} imageUrl={selectedStaffItem.image_url} size={44} defaultSource={STAFF_ICON} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF", letterSpacing: -0.3 }}>{selectedStaffItem.name}</Text>
                  {subParts.length > 0 && (
                    <Text style={{ fontSize: 13, color: "#7488FE", marginTop: 2 }}>{subParts.join(" · ")}</Text>
                  )}
                </View>
                <Check size={18} color="#4261FF" />
              </View>
            );
          })()}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            {(() => {
              const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
              return (
                <AnimatedPressable
                  onPress={isCurrentMonth ? undefined : () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                  hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}
                  style={{ opacity: isCurrentMonth ? 0.25 : 1 }}
                >
                  <ChevronLeft size={20} color="#19191B" />
                </AnimatedPressable>
              );
            })()}
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>{calYear}년 {calMonth + 1}월</Text>
            <AnimatedPressable onPress={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
              <ChevronRight size={20} color="#19191B" />
            </AnimatedPressable>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            {DAY_LABELS.map((d, i) => (
              <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B" }}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1 }} />;
                const iso = toIso(d);
                const isSel = selectedDate === iso;
                const isTd = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
                const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const cellDate = new Date(calYear, calMonth, d);
                const isPast = cellDate < todayOnly;
                const dayColor = isPast
                  ? "#C8CDD6"
                  : di === 0 ? "#FF5959" : di === 6 ? "#5DB1FF" : "#19191B";
                return (
                  <Pressable
                    key={di}
                    onPress={isPast ? undefined : () => setSelectedDate(iso)}
                    android_ripple={isPast ? undefined : { borderless: true, radius: 18, color: "rgba(66,97,255,0.12)" }}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
                  >
                    <View style={{
                      width: 32, height: 32, borderRadius: 999,
                      overflow: "hidden",
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: isSel ? "#4261FF" : isTd ? "#F0F3FF" : "transparent",
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: isSel || isTd ? "700" : "400", color: isSel ? "#FFFFFF" : dayColor }}>{d}</Text>
                    </View>
                    {!isPast && holidayDaySet.has(d) ? (
                      <View style={{ marginTop: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: "#FFE8E8" }}>
                        <Text style={{ fontSize: 9, fontWeight: "600", color: "#FF3D3D" }}>휴무</Text>
                      </View>
                    ) : !isPast && monthlyMap[d] && monthlyMap[d].length > 0 ? (
                      <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                        {monthlyMap[d].slice(0, 3).map((name, i) => (
                          <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: getShiftStyle(name, storeShifts).color }} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* 당일 근무 현황 */}
          <View style={{ marginTop: 16, borderRadius: 14, backgroundColor: "#F7F7F8", padding: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B", marginBottom: selectedDate ? 10 : 0 }}>
              {selectedDate
                ? `${Number(selectedDate.slice(5, 7))}/${Number(selectedDate.slice(8, 10))} 근무 현황`
                : "날짜를 선택하면 당일 근무 현황을 확인할 수 있어요"}
            </Text>
            {selectedDate && isSelectedDateHoliday && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF3F3", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: "#FF5C5C", fontWeight: "600" }}>이날은 휴무일이에요</Text>
              </View>
            )}
            {selectedDate && (
              selectedDayGroups.length === 0 ? (
                <Text style={{ fontSize: 13, color: "#AAB4BF" }}>근무 예정 직원이 없어요</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {selectedDayGroups.map((g, i) => (
                    <View key={i}>
                      {/* 파트 헤더 */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.color }} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#19191B" }}>{g.shift}</Text>
                        <View style={{ backgroundColor: g.color + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: g.color }}>{g.members.length}명</Text>
                        </View>
                      </View>
                      {/* 직원별 행 */}
                      <View style={{ gap: 4, paddingLeft: 14 }}>
                        {g.members.map((m, j) => (
                          <View key={j} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 13, color: "#19191B", fontWeight: "500" }}>{m.name}</Text>
                            <Text style={{ fontSize: 12, color: "#9EA3AD" }}>
                              {m.start && m.end ? `${m.start} ~ ${m.end}` : m.start ? `${m.start} ~` : "-"}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )
            )}
          </View>

          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B", marginBottom: 12 }}>근무 시간</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {(["start", "end"] as const).map((type) => (
                <View key={type} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 6 }}>{type === "start" ? "출근 시간" : "퇴근 시간"}</Text>
                  <AnimatedPressable
                    onPress={() => setActiveTimePicker(type)}
                    scaleAmount={0.97}
                    opacityAmount={0.8}
                    style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 15, color: "#19191B" }}>
                      {type === "start" ? timeLabel(startTime) : timeLabel(endTime, startTime)}
                    </Text>
                  </AnimatedPressable>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
        <AnimatedPressable
          onPress={() => { if (step === 1 && canNext) setStep(2); else if (step === 2 && canSubmit) setConfirmOpen(true); }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: (step === 1 ? canNext : canSubmit) ? "#4261FF" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{step === 1 ? "다음" : "일정 추가하기"}</Text>
        </AnimatedPressable>
      </View>

      <BottomSheet isOpen={activeTimePicker !== null} onClose={() => setActiveTimePicker(null)} title={activeTimePicker === "start" ? "출근 시간 선택" : "퇴근 시간 선택"}>
        <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => {
            const isEnd = activeTimePicker === "end";
            const cur = isEnd ? endTime : startTime;
            const crosses = isEnd && isCrossing(startTime, t);
            const label = isEnd ? timeLabel(t, startTime) : timeLabel(t);
            return (
              <AnimatedPressable
                key={t}
                onPress={() => { isEnd ? setEndTime(t) : setStartTime(t); setActiveTimePicker(null); }}
                scaleAmount={0.97}
                opacityAmount={0.85}
                style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, marginBottom: 2, backgroundColor: cur === t ? "#E8F3FF" : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: cur === t ? "#4261FF" : "#19191B" }}>{label}</Text>
                  {crosses && cur !== t && (
                    <View style={{ backgroundColor: "#FFF0F0", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 11, color: "#FF5959", fontWeight: "600" }}>익일</Text>
                    </View>
                  )}
                </View>
                {cur === t && <Check size={16} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      <ConfirmDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="일정 추가"
        description={`${staffName}님 ${selectedDate} ${startTime}~${endTime} 일정을 추가하시겠어요?`}
        buttons={[
          { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
          { label: submitting ? "처리 중..." : "추가하기", onPress: handleSubmit },
        ]}
      />
    </SafeAreaView>
  );
};

export default OwnerScheduleAddScreen;
