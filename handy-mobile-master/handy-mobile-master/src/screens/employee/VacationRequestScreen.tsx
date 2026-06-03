import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { getMySchedule, createScheduleChange } from "@/api/employee";
import { getShiftStyle } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

const HOLIDAY_STYLE = { bg: "#FFE8E8", text: "#FF5959" };

const getPartStyle = (partName?: string | null) => {
  const s = getShiftStyle(partName);
  return { bg: s.bg, text: s.text };
};

type Step = "select-dates" | "form";

const VacationRequestScreen: React.FC<ScreenProps<"VacationRequest">> = ({ navigation }) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select-dates");
  const [date, setDate] = useState(new Date());
  const [mySchedule, setMySchedule] = useState<Record<string, any>>({});
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);
  const [reasonFocused, setReasonFocused] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const year = date.getFullYear();
  const month = date.getMonth();

  useEffect(() => {
    if (!storeId) return;
    getMySchedule(storeId, year, month + 1)
      .then((res: any) => setMySchedule(res?.schedules ?? res ?? {}))
      .catch(() => setMySchedule({}));
  }, [storeId, year, month]);

  const toggleDate = (key: string) => {
    if (!mySchedule[key]) return;
    setSelectedDates((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  };

  const isFormValid = selectedDates.length > 0 && reason.trim().length > 0;

  const toBackendDate = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  const handleConfirm = async () => {
    if (!storeId || submitting) return;
    setConfirmDialogOpen(false);
    setSubmitting(true);
    try {
      await Promise.all(
        selectedDates.map((key) => {
          const sched = mySchedule[key];
          return createScheduleChange({
            store_id: storeId,
            type: "vacation",
            origin_date: toBackendDate(key),
            origin_start: sched?.work_start ? String(sched.work_start).slice(0, 5) : undefined,
            origin_end: sched?.work_end ? String(sched.work_end).slice(0, 5) : undefined,
            desired_date: toBackendDate(key),
            reason,
          });
        }),
      );
      toast({ description: "휴가 요청이 완료 되었어요." });
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "요청에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === "form") setStep("select-dates");
    else navigation.goBack();
  };

  // Calendar calculation
  const todayTs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { y: number; m: number; d: number; isOutside: boolean }[] = [];
  for (let i = firstDayOfWeek; i > 0; i--) cells.push({ y: year, m: month, d: 0, isOutside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ y: year, m: month, d, isOutside: false });
  while (cells.length % 7 !== 0) cells.push({ y: year, m: month, d: 0, isOutside: true });
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const sortedSelectedDates = useMemo(() => {
    return [...selectedDates].sort((a, b) => {
      const pa = a.split("-").map(Number);
      const pb = b.split("-").map(Number);
      return new Date(pa[0], pa[1] - 1, pa[2]).getTime() - new Date(pb[0], pb[1] - 1, pb[2]).getTime();
    });
  }, [selectedDates]);

  const formatDateDisplay = (dateKey: string) => {
    const parts = dateKey.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return `${parts[0]}.${String(parts[1]).padStart(2, "0")}.${String(parts[2]).padStart(2, "0")} (${DAYS_KR[d.getDay()]})`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={handleBack} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>휴가 요청</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Step 1: Select dates */}
        {step === "select-dates" && (
          <View style={{ flex: 1 }}>
            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
                <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>휴가를 요청할</Text>
                <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>일정을 선택해 주세요</Text>
                <Text style={{ fontSize: 13, color: "#70737B", marginTop: 4 }}>*일정을 여러 개 선택할 수 있어요</Text>
              </View>

              {/* Month navigation */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
                <AnimatedPressable onPress={() => setDate(new Date(year, month - 1, 1))} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
                  <ChevronLeft size={20} color="#19191B" />
                </AnimatedPressable>
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month + 1}월</Text>
                <AnimatedPressable onPress={() => setDate(new Date(year, month + 1, 1))} hitSlop={8} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
                  <ChevronRight size={20} color="#19191B" />
                </AnimatedPressable>
              </View>

              {/* Day headers */}
              <View style={{ flexDirection: "row", paddingHorizontal: 12 }}>
                {DAYS_KR.map((d, i) => (
                  <View key={d} style={{ flex: 1, alignItems: "center", paddingBottom: 12 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: "500",
                      letterSpacing: -0.28,
                      color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B",
                    }}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={{ paddingHorizontal: 12 }}>
                {weeks.map((week, wi) => (
                  <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
                    {week.map((cell, ci) => {
                      const key = `${cell.y}-${cell.m + 1}-${cell.d}`;
                      const sched = !cell.isOutside ? mySchedule[key] : null;
                      const isPast = !cell.isOutside && new Date(cell.y, cell.m, cell.d).getTime() < todayTs;
                      const enabled = !cell.isOutside && !!sched && !isPast;
                      const isSelected = selectedDates.includes(key);
                      const dateColor = cell.isOutside
                        ? "#AAB4BF"
                        : isPast
                          ? "#D0D3D9"
                          : isSelected
                            ? "#FFFFFF"
                            : ci === 0 ? "#FF5959" : ci === 6 ? "#5DB1FF" : "#70737B";
                      return (
                        <AnimatedPressable
                          key={ci}
                          scaleAmount={0.85}
                          opacityAmount={0.7}
                          onPress={() => { if (enabled) toggleDate(key); }}
                          style={{ flex: 1, minHeight: 90, paddingVertical: 6, alignItems: "center" }}
                          disabled={cell.isOutside || isPast}
                        >
                          {/* Date number */}
                          <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                            <View style={isSelected ? {
                              backgroundColor: "#4261FF",
                              borderRadius: 10,
                              minWidth: 40,
                              width: 40,
                              height: 22,
                              alignItems: "center",
                              justifyContent: "center",
                            } : {}}>
                              <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: dateColor }}>
                                {cell.isOutside ? "" : cell.d}
                              </Text>
                            </View>
                          </View>
                          {/* Schedule badge */}
                          <View style={{ width: "100%", paddingHorizontal: 2 }}>
                            {sched?.is_holiday ? (
                              <View style={{ backgroundColor: HOLIDAY_STYLE.bg, borderRadius: 4, height: 17, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 12, fontWeight: "500", color: HOLIDAY_STYLE.text }}>휴무</Text>
                              </View>
                            ) : sched?.work_start && sched?.work_end ? (() => {
                              const ps = getPartStyle(sched.shift_name);
                              return (
                                <View style={{
                                  backgroundColor: isSelected ? "#E8F3FF" : ps.bg,
                                  borderRadius: 4,
                                  paddingVertical: 2,
                                  alignItems: "center",
                                  minHeight: 36,
                                  justifyContent: "center",
                                }}>
                                  <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: isSelected ? "#7488FE" : ps.text, lineHeight: 16 }}>
                                    {String(sched.work_start).slice(0, 5)}
                                  </Text>
                                  <Text style={{ fontSize: 10, color: isSelected ? "#7488FE" : ps.text, lineHeight: 12 }}>-</Text>
                                  <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: isSelected ? "#7488FE" : ps.text, lineHeight: 16 }}>
                                    {String(sched.work_end).slice(0, 5)}
                                  </Text>
                                </View>
                              );
                            })() : null}
                          </View>
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Next button */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
              <AnimatedPressable
                disabled={selectedDates.length === 0}
                onPress={() => setStep("form")}
                style={{
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: selectedDates.length > 0 ? "#4261FF" : "#DBDCDF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                scaleAmount={0.97}
                opacityAmount={0.75}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>다음</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Step 2: Form */}
        {step === "form" && (
          <View style={{ flex: 1 }}>
            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>휴가를 요청할</Text>
                <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>일정을 확인해 주세요</Text>
              </View>

              {/* Selected dates */}
              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>선택한 일정</Text>
                <View style={{ gap: 8 }}>
                  {sortedSelectedDates.map((dateKey) => {
                    const sched = mySchedule[dateKey];
                    if (!sched) return null;
                    const ps = getPartStyle(sched.shift_name);
                    return (
                      <View key={dateKey} style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderRadius: 12,
                        backgroundColor: "#F7F7F8",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        flexWrap: "wrap",
                      }}>
                        <View style={{ backgroundColor: ps.bg, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: "500", color: ps.text }}>{sched.shift_name ?? "일일"}</Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{formatDateDisplay(dateKey)}</Text>
                        {sched.work_start && sched.work_end && (
                          <Text style={{ fontSize: 15, color: "#70737B" }}>
                            {String(sched.work_start).slice(0, 5)} - {String(sched.work_end).slice(0, 5)}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: "#EBEBEB", marginHorizontal: 20, marginVertical: 20 }} />

              {/* Reason */}
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>
                  휴가 요청 사유 <Text style={{ color: "#FF5959" }}>*</Text>
                </Text>
                <AnimatedPressable
                  onPress={() => { setReasonDraft(reason); setReasonSheetOpen(true); }}
                  style={{
                    borderWidth: 1,
                    borderColor: "#EBEBEB",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                >
                  <Text style={{ fontSize: 15, color: reason ? "#19191B" : "#9EA3AD" }}>
                    {reason || "요청 사유 입력"}
                  </Text>
                </AnimatedPressable>
                <Text style={{ fontSize: 13, color: "#70737B", textAlign: "right", marginTop: 4 }}>{reason.length}/100</Text>
              </View>
            </ScrollView>

            {/* Submit button */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
              <AnimatedPressable
                disabled={!isFormValid}
                onPress={() => setConfirmDialogOpen(true)}
                style={{
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: isFormValid ? "#4261FF" : "#DBDCDF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                scaleAmount={0.97}
                opacityAmount={0.75}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>휴가 요청하기</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* 휴가 사유 입력 시트 */}
      <BottomSheet isOpen={reasonSheetOpen} onClose={() => setReasonSheetOpen(false)} title="휴가 요청 사유 입력">
        <View style={{ position: "relative" }}>
          <TextInput
            value={reasonDraft}
            onChangeText={(t) => { if (t.length <= 100) setReasonDraft(t); }}
            placeholder="휴가 요청 사유를 입력해 주세요"
            placeholderTextColor="#AAB4BF"
            multiline
            maxLength={100}
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
            style={{
              minHeight: 180,
              borderWidth: 2,
              borderColor: reasonFocused ? "#4261FF" : "#EBEBEB",
              borderRadius: 12,
              backgroundColor: "#FFFFFF",
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingBottom: 28,
              fontSize: 15,
              color: "#19191B",
              textAlignVertical: "top",
            }}
          />
          <Text style={{ position: "absolute", bottom: 12, right: 12, fontSize: 13, color: "#70737B" }}>{reasonDraft.length}/100</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
          <AnimatedPressable
            onPress={() => setReasonSheetOpen(false)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF" }}>취소</Text>
          </AnimatedPressable>
          <AnimatedPressable
            disabled={!reasonDraft.trim()}
            onPress={() => { setReason(reasonDraft.trim()); setReasonSheetOpen(false); }}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 16,
              backgroundColor: reasonDraft.trim() ? "#4261FF" : "#DBDCDF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>입력하기</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

      {/* Confirm dialog */}
      <ConfirmDialog
        visible={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title="휴가 요청하기"
        description={"휴가를 요청하시겠어요?\n사장님이 확인 후 휴가로 처리돼요"}
        buttons={[
          { label: "취소", onPress: () => setConfirmDialogOpen(false), variant: "cancel" },
          { label: "확인", onPress: handleConfirm, variant: "confirm" },
        ]}
      />
    </SafeAreaView>
  );
};

export default VacationRequestScreen;
