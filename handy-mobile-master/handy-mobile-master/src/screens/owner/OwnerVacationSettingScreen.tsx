import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import Avatar from "@/components/Avatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useToast } from "@/components/Toast";
import { createOwnerSchedule, getOwnerSchedules } from "@/api/owner";
import { getCachedStaffList } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import { DAY_LABELS } from "@/utils/constants";
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

const OwnerVacationSettingScreen: React.FC<ScreenProps<"OwnerVacationSetting">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const [step, setStep] = useState<1 | 2>(1);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    getCachedStaffList(storeId).then((r: any) => {
      const filtered = (r ?? []).filter((s: any) => {
        const ws = s.working_status ?? s.contract?.working_status;
        return ws !== "퇴사" && ws !== "앱탈퇴";
      });
      setStaffList(filtered);
    }).catch((e) => { console.warn(e); toast({ description: "직원 목록을 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]);

  useEffect(() => {
    if (step === 2 && selectedStaff) {
      getOwnerSchedules(storeId, calYear, calMonth + 1).then(setSchedules).catch((e) => console.warn(e));
    }
  }, [storeId, calYear, calMonth, step, selectedStaff]);

  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: number[] = [...Array(firstDow).fill(0), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(0);
  const weeks: number[][] = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const staffScheduleDays = useMemo(() => {
    if (!selectedStaff) return new Set<number>();
    const set = new Set<number>();
    schedules.forEach((r: any) => {
      if (r.employee_id === selectedStaff) {
        const d = Number(r.work_date.slice(8, 10));
        set.add(d);
      }
    });
    return set;
  }, [schedules, selectedStaff]);

  const toIso = (d: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const staffName = staffList.find((s) => s.id === selectedStaff)?.name ?? "";

  const handleSubmit = async () => {
    if (!selectedStaff || !selectedDate || submitting) return;
    setSubmitting(true);
    try {
      await createOwnerSchedule(storeId, {
        employee_id: selectedStaff,
        work_date: selectedDate,
        is_holiday: true,
      });
      toast({ description: "휴가가 처리되었어요." });
      navigation.goBack();
    } catch {
      toast({ description: "휴가 처리에 실패했어요.", variant: "destructive" });
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
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>직원 휴가 처리</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }}>
        {([1, 2] as const).map((s) => (
          <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? "#4261FF" : "#EBEBEB" }} />
        ))}
      </View>

      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>직원 선택</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>휴가를 처리할 직원을 선택해주세요</Text>
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
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <View style={{ borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "#E8F3FF" }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#4261FF" }}>{staffName}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>휴가 날짜 선택</Text>
          <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 20 }}>휴가를 등록할 날짜를 선택해주세요</Text>

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
                const hasWork = staffScheduleDays.has(d);
                const isTd = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
                const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const cellDate = new Date(calYear, calMonth, d);
                const isPast = cellDate < todayOnly;
                const dayColor = isPast ? "#C8CDD6" : di === 0 ? "#FF5959" : di === 6 ? "#5DB1FF" : "#19191B";
                return (
                  <Pressable
                    key={di}
                    onPress={isPast ? undefined : () => setSelectedDate(iso)}
                    android_ripple={isPast ? undefined : { borderless: true, radius: 18, color: "rgba(66,97,255,0.12)" }}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 999, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: isSel ? "#4261FF" : isTd ? "#F0F3FF" : "transparent" }}>
                      <Text style={{ fontSize: 14, fontWeight: isSel || isTd ? "700" : "400", color: isSel ? "#FFFFFF" : dayColor }}>{d}</Text>
                    </View>
                    {hasWork && !isPast && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#4261FF", marginTop: 2 }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#F0F3FF", flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4261FF" }} />
            <Text style={{ fontSize: 12, color: "#4261FF" }}>파란 점이 있는 날은 기존 근무 일정이 있는 날이에요</Text>
          </View>
        </ScrollView>
      )}

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
        <AnimatedPressable
          onPress={() => { if (step === 1 && selectedStaff) setStep(2); else if (step === 2 && selectedDate) setConfirmOpen(true); }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: (step === 1 ? !!selectedStaff : !!selectedDate) ? "#4261FF" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{step === 1 ? "다음" : "휴가 처리하기"}</Text>
        </AnimatedPressable>
      </View>

      <ConfirmDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="휴가 처리"
        description={`${staffName}님의 ${selectedDate} 휴가를 등록하시겠어요?`}
        buttons={[
          { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
          { label: submitting ? "처리 중..." : "처리하기", onPress: handleSubmit },
        ]}
      />
    </SafeAreaView>
  );
};

export default OwnerVacationSettingScreen;
