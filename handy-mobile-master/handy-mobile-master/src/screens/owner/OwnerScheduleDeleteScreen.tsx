import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useToast } from "@/components/Toast";
import { deleteOwnerSchedule, getOwnerSchedules, OwnerSchedule } from "@/api/owner";
import { getShiftStyle, inferShiftName, StoreShift } from "@/utils/shiftStyles";
import { getCachedStoreInfo } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import { DAY_LABELS } from "@/utils/constants";
import type { ScreenProps } from "@/navigation/types";


const OwnerScheduleDeleteScreen: React.FC<ScreenProps<"OwnerScheduleDelete">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const [step, setStep] = useState<1 | 2>(1);
  const [schedules, setSchedules] = useState<OwnerSchedule[]>([]);
  const [storeShifts, setStoreShifts] = useState<StoreShift[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  useEffect(() => {
    getCachedStoreInfo(storeId).then((d: any) => setStoreShifts(d?.shifts ?? [])).catch((e) => console.warn(e));
    getOwnerSchedules(storeId, calYear, calMonth + 1).then(setSchedules).catch((e) => { console.warn(e); toast({ description: "일정을 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId, calYear, calMonth]);

  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: number[] = [...Array(firstDow).fill(0), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(0);
  const weeks: number[][] = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const monthlyMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    schedules.forEach((r) => {
      const d = Number(r.work_date.slice(8, 10));
      if (!map[d]) map[d] = [];
      const sh = r.shift_name ?? inferShiftName(r.work_start, storeShifts);
      if (sh && !map[d].includes(sh)) map[d].push(sh);
    });
    return map;
  }, [schedules, storeShifts]);

  const holidayDaySet = useMemo(() => {
    const s = new Set<number>();
    schedules.forEach((r) => { if (r.is_holiday) s.add(Number(r.work_date.slice(8, 10))); });
    return s;
  }, [schedules]);

  const toIso = (d: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const daySchedules = useMemo(
    () => (selectedDate ? schedules.filter((r) => r.work_date === selectedDate) : []),
    [schedules, selectedDate]
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteOwnerSchedule(storeId, id)));
      toast({ description: "일정이 삭제되었어요." });
      navigation.goBack();
    } catch {
      toast({ description: "일정 삭제에 실패했어요.", variant: "destructive" });
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
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>직원 일정 삭제</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }}>
        {([1, 2] as const).map((s) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? "#FF3D3D" : "#EBEBEB" }} />
        ))}
      </View>

      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>날짜 선택</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>삭제할 일정의 날짜를 선택해주세요</Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <AnimatedPressable onPress={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
              <ChevronLeft size={20} color="#19191B" />
            </AnimatedPressable>
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
                const hasSched = !!monthlyMap[d];
                const isHoliday = holidayDaySet.has(d);
                const isTd = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
                const dayColor = isSel ? "#FFFFFF" : isHoliday ? "#DBDCDF" : di === 0 ? "#FF5959" : di === 6 ? "#5DB1FF" : "#19191B";
                return (
                  <Pressable
                    key={di}
                    onPress={() => { setSelectedDate(iso); setSelectedIds([]); }}
                    android_ripple={{ borderless: true, radius: 18, color: "rgba(255,61,61,0.12)" }}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: isSel ? "#FF3D3D" : isTd ? "#FFF0EE" : "transparent" }}>
                      <Text style={{ fontSize: 14, fontWeight: isSel || isTd ? "700" : "400", color: dayColor, textDecorationLine: isHoliday && !isSel ? "line-through" : "none" }}>{d}</Text>
                    </View>
                    {isHoliday && !isSel ? (
                      <View style={{ marginTop: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: "#FFE8E8" }}>
                        <Text style={{ fontSize: 9, fontWeight: "600", color: "#FF3D3D" }}>휴무</Text>
                      </View>
                    ) : hasSched && monthlyMap[d].length > 0 ? (
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
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>일정 선택</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>{selectedDate} 의 삭제할 일정을 선택해주세요</Text>
          {daySchedules.length === 0 ? (
            <Text style={{ fontSize: 14, color: "#AAB4BF", textAlign: "center", paddingVertical: 40 }}>이 날 일정이 없어요</Text>
          ) : daySchedules.map((s) => {
            const isSel = selectedIds.includes(s.id);
            const shift = s.shift_name ?? inferShiftName(s.work_start, storeShifts);
            const shiftStyle = getShiftStyle(shift, storeShifts);
            return (
              <AnimatedPressable
                key={s.id}
                onPress={() => toggleSelect(s.id)}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8,
                  backgroundColor: isSel ? "#FFEAE6" : "#F7F7F8",
                  borderWidth: isSel ? 1 : 0, borderColor: "#FF3D3D",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: shift ? shiftStyle.bg : "#F0F0F0" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: shift ? shiftStyle.color : "#70737B" }}>{shift ?? "일일"}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{s.employee_name}</Text>
                    <Text style={{ fontSize: 12, color: "#70737B", marginTop: 2 }}>{s.work_start ?? "-"} – {s.work_end ?? "-"}</Text>
                  </View>
                </View>
                {isSel ? <X size={18} color="#FF3D3D" /> : <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#DBDCDF" }} />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
        <AnimatedPressable
          onPress={() => {
            if (step === 1 && selectedDate) { setStep(2); }
            else if (step === 2 && selectedIds.length > 0) setConfirmOpen(true);
          }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: (step === 1 ? !!selectedDate : selectedIds.length > 0) ? "#FF3D3D" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{step === 1 ? "다음" : `삭제하기 (${selectedIds.length}건)`}</Text>
        </AnimatedPressable>
      </View>

      <ConfirmDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="일정 삭제"
        description={`선택한 ${selectedIds.length}건의 일정을 삭제하시겠어요?\n삭제하면 복구할 수 없어요.`}
        buttons={[
          { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
          { label: submitting ? "삭제 중..." : "삭제하기", onPress: handleSubmit },
        ]}
      />
    </SafeAreaView>
  );
};

export default OwnerScheduleDeleteScreen;
