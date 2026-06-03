import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft } from "lucide-react-native";
import { useToast } from "@/components/Toast";
import { updateOwnerSchedule, getOwnerSchedules, OwnerSchedule } from "@/api/owner";
import { getCachedStaffList, getCachedStoreInfo } from "@/utils/cachedApi";
import { getShiftStyle, inferShiftName, StoreShift } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

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


const OwnerScheduleChangeScreen: React.FC<ScreenProps<"OwnerScheduleChange">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const [step, setStep] = useState<1 | 2>(1);
  const [schedules, setSchedules] = useState<OwnerSchedule[]>([]);
  const [storeShifts, setStoreShifts] = useState<StoreShift[]>([]);
  const [resignedIds, setResignedIds] = useState<Set<number>>(new Set());
  const [selectedSchedule, setSelectedSchedule] = useState<OwnerSchedule | null>(null);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("18:00");
  const [activeTimePicker, setActiveTimePicker] = useState<"start" | "end" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = new Date();

  useEffect(() => {
    getCachedStoreInfo(storeId).then((d: any) => setStoreShifts(d?.shifts ?? [])).catch((e) => console.warn(e));
    getOwnerSchedules(storeId, today.getFullYear(), today.getMonth() + 1).then(setSchedules).catch((e) => { console.warn(e); toast({ description: "일정을 불러오지 못했어요.", variant: "destructive" }); });
    getCachedStaffList(storeId).then((r: any) => {
      const ids = new Set<number>(
        (r ?? [])
          .filter((s: any) => {
            const ws = s.working_status ?? s.contract?.working_status;
            return ws === "퇴사" || ws === "앱탈퇴";
          })
          .map((s: any) => s.id as number)
      );
      setResignedIds(ids);
    }).catch((e) => console.warn(e));
  }, [storeId]);

  const sortedSchedules = useMemo(() =>
    [...schedules]
      .filter((s) => !resignedIds.has(s.employee_id))
      .sort((a, b) => a.work_date.localeCompare(b.work_date)),
    [schedules, resignedIds]
  );

  const handleSelectSchedule = (s: OwnerSchedule) => {
    setSelectedSchedule(s);
    setNewStart(s.work_start ?? "09:00");
    setNewEnd(s.work_end ?? "18:00");
  };

  const handleSubmit = async () => {
    if (!selectedSchedule || submitting) return;
    setSubmitting(true);
    try {
      await updateOwnerSchedule(storeId, selectedSchedule.id, {
        work_start: newStart || null,
        work_end: newEnd || null,
      });
      toast({ description: "일정이 변경되었어요." });
      navigation.goBack();
    } catch {
      toast({ description: "일정 변경에 실패했어요.", variant: "destructive" });
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
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>직원 일정 변경</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }}>
        {([1, 2] as const).map((s) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? "#4261FF" : "#EBEBEB" }} />
        ))}
      </View>

      {step === 1 && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>일정 선택</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>변경할 직원의 일정을 선택해주세요</Text>
          {sortedSchedules.length === 0 ? (
            <Text style={{ fontSize: 14, color: "#AAB4BF", textAlign: "center", paddingVertical: 40 }}>이번 달 일정이 없어요</Text>
          ) : sortedSchedules.map((s) => {
            const isSel = selectedSchedule?.id === s.id;
            const shift = s.shift_name ?? inferShiftName(s.work_start, storeShifts);
            const shiftStyle = getShiftStyle(shift);
            return (
              <AnimatedPressable
                key={s.id}
                onPress={() => handleSelectSchedule(s)}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8,
                  backgroundColor: isSel ? "#E8F3FF" : "#F7F7F8",
                  borderWidth: isSel ? 1 : 0, borderColor: "#4261FF",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: shift ? shiftStyle.bg : "#F0F0F0" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: shift ? shiftStyle.color : "#70737B" }}>{shift ?? "일일"}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{s.employee_name}</Text>
                    <Text style={{ fontSize: 12, color: "#70737B", marginTop: 2 }}>{s.work_date} · {s.work_start ?? "-"} – {s.work_end ?? "-"}</Text>
                  </View>
                </View>
                {isSel && <Check size={18} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}

      {step === 2 && selectedSchedule && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>시간 변경</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>새로운 근무 시간을 선택해주세요</Text>

          {/* Current schedule card */}
          <View style={{ borderRadius: 12, backgroundColor: "#F7F7F8", padding: 16, marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: "#70737B", marginBottom: 4 }}>현재 일정</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{selectedSchedule.employee_name}</Text>
            <Text style={{ fontSize: 14, color: "#70737B", marginTop: 4 }}>{selectedSchedule.work_date} · {selectedSchedule.work_start ?? "-"} – {selectedSchedule.work_end ?? "-"}</Text>
          </View>

          <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B", marginBottom: 12 }}>변경 시간</Text>
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
                    {type === "start" ? timeLabel(newStart) : timeLabel(newEnd, newStart)}
                  </Text>
                </AnimatedPressable>
              </View>
            ))}
          </View>

          {/* Preview */}
          <View style={{ borderRadius: 12, backgroundColor: "#E8F3FF", padding: 16, marginTop: 20 }}>
            <Text style={{ fontSize: 12, color: "#4261FF", marginBottom: 4 }}>변경 후 일정</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#4261FF" }}>{selectedSchedule.employee_name}</Text>
            <Text style={{ fontSize: 14, color: "#4261FF", marginTop: 4 }}>{selectedSchedule.work_date} · {timeLabel(newStart)} – {timeLabel(newEnd, newStart)}</Text>
          </View>
        </ScrollView>
      )}

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
        <AnimatedPressable
          onPress={() => { if (step === 1 && selectedSchedule) setStep(2); else if (step === 2) setConfirmOpen(true); }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: (step === 1 ? !!selectedSchedule : true) ? "#4261FF" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{step === 1 ? "다음" : "일정 변경하기"}</Text>
        </AnimatedPressable>
      </View>

      <BottomSheet isOpen={activeTimePicker !== null} onClose={() => setActiveTimePicker(null)} title={activeTimePicker === "start" ? "출근 시간 선택" : "퇴근 시간 선택"}>
        <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => {
            const isEnd = activeTimePicker === "end";
            const cur = isEnd ? newEnd : newStart;
            const crosses = isEnd && isCrossing(newStart, t);
            const label = isEnd ? timeLabel(t, newStart) : timeLabel(t);
            return (
              <AnimatedPressable
                key={t}
                onPress={() => { isEnd ? setNewEnd(t) : setNewStart(t); setActiveTimePicker(null); }}
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
        title="일정 변경"
        description={selectedSchedule ? `${selectedSchedule.employee_name}님의 일정을\n${selectedSchedule.work_start ?? "-"}~${selectedSchedule.work_end ?? "-"} → ${timeLabel(newStart)}~${timeLabel(newEnd, newStart)}으로 변경하시겠어요?` : ""}
        buttons={[
          { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
          { label: submitting ? "변경 중..." : "변경하기", onPress: handleSubmit },
        ]}
      />
    </SafeAreaView>
  );
};

export default OwnerScheduleChangeScreen;
