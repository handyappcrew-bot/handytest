import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FocusInput from "@/components/FocusInput";
import { ChevronLeft, ChevronDown, Check } from "lucide-react-native";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "@/components/Toast";
import { createWorklogRequest, getEmployeePayslips } from "@/api/employee";
import { getShiftStyle } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

type EditStep = "reason" | "detail";

const REASON_OPTIONS = [
  { label: "출·퇴근 시간 변경", value: "time_change" },
  { label: "휴게 시간 추가/변경", value: "break_change" },
];

const UNREGISTERED_REASON_OPTIONS = [
  { label: "근무 누락", value: "missing_work" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_ITEMS = Array.from({ length: 121 }, (_, i) => String(i));


const STATUS_LABEL: Record<string, { bg: string; color: string; label: string }> = {
  "휴무": { bg: "#FFE8E8", color: "#FF5959", label: "휴무" },
  "결근": { bg: "#FFEAE6", color: "#FF3D3D", label: "결근" },
  "휴가": { bg: "#F7F7F8", color: "#AAB4BF", label: "휴가" },
};

const ATTENDANCE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  normal:   { bg: "#ECFFF1", color: "#1EDC83", label: "근무완료" },
  late:     { bg: "#FFEEE2", color: "#FF862D", label: "지각" },
  absent:   { bg: "#FFEAE6", color: "#FF3D3D", label: "결근" },
  vacation: { bg: "#F7F7F8", color: "#AAB4BF", label: "휴가" },
  holiday:  { bg: "#FFE8E8", color: "#FF5959", label: "휴무" },
  overtime: { bg: "#E8F3FF", color: "#7488FE", label: "연장" },
};

const AttendanceRecordEditScreen: React.FC<ScreenProps<"AttendanceRecordEdit">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const initial = route.params?.detail ?? {};
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const isUnregistered = initial?.status === "미등록";
  const isMissingWorkFlow = initial?.status === "미등록" || initial?.status === "결근" || initial?.status === "휴무";

  const [step, setStep] = useState<EditStep>("reason");
  const [selectedReason, setSelectedReason] = useState("");
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [startTime, setStartTime] = useState(isUnregistered ? "" : (initial?.startTime || "07:50"));
  const [endTime, setEndTime] = useState(isUnregistered ? "" : (initial?.endTime || "13:10"));
  const [changeReason, setChangeReason] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(String(initial?.breakMinutes || 0));
  const [breakReason, setBreakReason] = useState("");

  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<"start" | "end">("start");
  const [timePickerHour, setTimePickerHour] = useState("08");
  const [timePickerMinute, setTimePickerMinute] = useState("00");

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const breakScrollRef = useRef<ScrollView>(null);

  // ref로 최신값 추적 — stale closure 방지
  const hourValRef = useRef(timePickerHour);
  const minuteValRef = useRef(timePickerMinute);
  const breakValRef = useRef("0");
  useEffect(() => { hourValRef.current = timePickerHour; }, [timePickerHour]);
  useEffect(() => { minuteValRef.current = timePickerMinute; }, [timePickerMinute]);

  const [minutePickerOpen, setMinutePickerOpen] = useState(false);
  const [minutePickerValue, setMinutePickerValue] = useState("0");

  const [reasonInputOpen, setReasonInputOpen] = useState(false);
  const [reasonInputTarget, setReasonInputTarget] = useState<"change" | "break" | "unregistered">("change");
  const [reasonDraft, setReasonDraft] = useState("");
  const [isTransferred, setIsTransferred] = useState(false);

  // 피커 오픈 시 현재 선택값 위치로 스크롤 (ref로 최신값 읽어 stale closure 회피, timeout은 BottomSheet 애니메이션 대기)
  useEffect(() => {
    if (!timePickerOpen) return;
    const timer = setTimeout(() => {
      hourScrollRef.current?.scrollTo({ y: parseInt(hourValRef.current, 10) * 44, animated: false });
      minuteScrollRef.current?.scrollTo({ y: parseInt(minuteValRef.current, 10) * 44, animated: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [timePickerOpen]);

  useEffect(() => {
    if (!minutePickerOpen) return;
    const timer = setTimeout(() => {
      breakScrollRef.current?.scrollTo({ y: parseInt(breakValRef.current, 10) * 44, animated: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [minutePickerOpen]);

  // 스크롤이 끝난 실제 위치 → state 동기화 (snap 후 정확한 값 보장)
  const onHourScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / 44);
    const v = HOURS[Math.max(0, Math.min(i, HOURS.length - 1))];
    setTimePickerHour(v);
    hourValRef.current = v;
  };
  const onMinuteScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / 44);
    const v = MINUTES[Math.max(0, Math.min(i, MINUTES.length - 1))];
    setTimePickerMinute(v);
    minuteValRef.current = v;
  };
  const onBreakScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / 44);
    const v = MINUTE_ITEMS[Math.max(0, Math.min(i, MINUTE_ITEMS.length - 1))];
    setMinutePickerValue(v);
    breakValRef.current = v;
  };

  useEffect(() => {
    if (!initial.year || initial.month == null) return;
    getEmployeePayslips(storeId, initial.year, initial.month + 1)
      .then((slips) => {
        if (Array.isArray(slips) && slips.some((s: any) => s.is_transferred)) setIsTransferred(true);
      })
      .catch((e) => { console.warn(e); toast({ description: "급여 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, []);

  const reasonOptions = isMissingWorkFlow ? UNREGISTERED_REASON_OPTIONS : REASON_OPTIONS;
  const selectedReasonLabel = reasonOptions.find(r => r.value === selectedReason)?.label || "";

  const isBreakChange = selectedReason === "break_change";
  const isMissingWork = selectedReason === "missing_work";

  const dateLabel = initial?.date
    ? `${initial.date.slice(0, 4)}.${initial.date.slice(5, 7)}.${initial.date.slice(8, 10)} (${initial.dayOfWeek ?? ""})`
    : new Date().toISOString().slice(0, 10);

  const allShiftLabels: string[] = (initial as any)?.shiftTypes ?? [];

  const renderShiftBadges = () => {
    if (isUnregistered) {
      return (
        <View style={{ backgroundColor: "#F7F7F8", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: "#AAB4BF" }}>무일정</Text>
        </View>
      );
    }
    const attendanceBadge = ATTENDANCE_BADGE[initial?.status ?? ""];
    return (
      <>
        {allShiftLabels.map((st: string) => (
          <View key={st} style={{ backgroundColor: getShiftStyle(st).bg, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: getShiftStyle(st).color }}>{st}</Text>
          </View>
        ))}
        {attendanceBadge && (
          <View style={{ backgroundColor: attendanceBadge.bg, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: attendanceBadge.color }}>{attendanceBadge.label}</Text>
          </View>
        )}
      </>
    );
  };

  const formatAmPm = (time: string) => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    return h < 12 ? `오전 ${time}` : `오후 ${String(h > 12 ? h - 12 : h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const getCanSubmit = () => {
    if (isMissingWork) return !!startTime && !!endTime;
    if (isBreakChange) return breakMinutes !== "" && breakMinutes !== "0";
    return true;
  };
  const canSubmit = getCanSubmit();

  const openTimePicker = (target: "start" | "end") => {
    const val = target === "start" ? (startTime || "08:00") : (endTime || "13:00");
    setTimePickerHour(val.split(":")[0] || "08");
    setTimePickerMinute(val.split(":")[1] || "00");
    setTimePickerTarget(target);
    setTimePickerOpen(true);
  };

  const handleTimeConfirm = () => {
    const time = `${timePickerHour}:${timePickerMinute}`;
    if (timePickerTarget === "start") setStartTime(time);
    else setEndTime(time);
    setTimePickerOpen(false);
  };

  const openReasonInput = (target: "change" | "break" | "unregistered") => {
    setReasonInputTarget(target);
    setReasonDraft(target === "break" ? breakReason : changeReason);
    setReasonInputOpen(true);
  };

  const handleReasonInputConfirm = () => {
    if (reasonInputTarget === "break") setBreakReason(reasonDraft);
    else setChangeReason(reasonDraft);
    setReasonInputOpen(false);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    const dateStr = initial?.date ?? "";
    setSubmitting(true);
    try {
      await createWorklogRequest({
        store_id: storeId,
        type: isMissingWork ? "근무 누락" : isBreakChange ? "휴게 시간 변경" : "출·퇴근 시간 변경",
        date: dateStr,
        origin_start: isMissingWork ? undefined : initial?.startTime,
        origin_end: isMissingWork ? undefined : initial?.endTime,
        desired_start: startTime || "00:00",
        desired_end: endTime || "00:00",
        desired_break_minutes: (isBreakChange || isMissingWork) ? parseInt(breakMinutes, 10) : undefined,
        reason: changeReason || breakReason || "",
      });
      toast({ description: "수정 요청이 완료 되었어요", duration: 2000 });
      navigation.goBack();
    } catch (e: any) {
      if (e.message?.startsWith("409")) {
        toast({ description: "이미 해당 날짜에 요청한 내역이 있어요.", variant: "destructive", duration: 2000 });
        navigation.goBack();
      } else {
        toast({ description: "수정 요청에 실패했어요. 다시 시도해주세요", variant: "destructive", duration: 2000 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === "detail") setStep("reason");
    else if (selectedReason) setCancelConfirmOpen(true);
    else navigation.goBack();
  };

  const fieldStyle = {
    height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
    paddingHorizontal: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const,
    backgroundColor: "#FFFFFF",
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={handleBack} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>
          {isMissingWorkFlow ? "근무 기록 수정" : "근무 기록 수정 요청"}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 }}>

          {isTransferred && (
            <View style={{ backgroundColor: "#FFF3EB", borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF862D", marginBottom: 2 }}>수정 요청 불가</Text>
              <Text style={{ fontSize: 13, color: "#9EA3AD", lineHeight: 18 }}>
                이미 이체 완료된 급여 내역이 있는 달은{"\n"}근무 기록 수정 요청을 할 수 없어요.
              </Text>
            </View>
          )}

          {step === "reason" ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>근무 기록 수정 사유를</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 32 }}>선택해 주세요</Text>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 12 }}>선택한 일정</Text>
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {renderShiftBadges()}
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{dateLabel}</Text>
              </View>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>
                수정 요청 사유 <Text style={{ color: "#FF3D3D" }}>*</Text>
              </Text>
              <AnimatedPressable onPress={() => setReasonSheetOpen(true)} style={fieldStyle} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: selectedReason ? "#19191B" : "#AAB4BF", fontWeight: selectedReason ? "500" : "400" }}>
                  {selectedReason ? selectedReasonLabel : "수정 요청 사유 선택"}
                </Text>
                <ChevronDown size={20} color="#AAB4BF" />
              </AnimatedPressable>
            </>
          ) : isMissingWork ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>근무 기록 수정 사유를</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 32 }}>선택해 주세요</Text>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 12 }}>선택한 일정</Text>
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {renderShiftBadges()}
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{dateLabel}</Text>
              </View>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>출근 시간 <Text style={{ color: "#FF3D3D" }}>*</Text></Text>
              <AnimatedPressable onPress={() => openTimePicker("start")} style={[fieldStyle, { marginBottom: 16 }]} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: startTime ? "#19191B" : "#AAB4BF" }}>
                  {startTime ? formatAmPm(startTime) : "출근 시간 선택"}
                </Text>
                <ChevronDown size={20} color="#AAB4BF" />
              </AnimatedPressable>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>퇴근 시간 <Text style={{ color: "#FF3D3D" }}>*</Text></Text>
              <AnimatedPressable onPress={() => openTimePicker("end")} style={[fieldStyle, { marginBottom: 16 }]} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: endTime ? "#19191B" : "#AAB4BF" }}>
                  {endTime ? formatAmPm(endTime) : "퇴근 시간 선택"}
                </Text>
                <ChevronDown size={20} color="#AAB4BF" />
              </AnimatedPressable>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>휴게 시간</Text>
              <AnimatedPressable onPress={() => { setMinutePickerValue(breakMinutes); setMinutePickerOpen(true); }} style={[fieldStyle, { marginBottom: 16 }]} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: "#19191B" }}>{breakMinutes}</Text>
                <Text style={{ fontSize: 15, color: "#AAB4BF" }}>분</Text>
              </AnimatedPressable>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>변경 요청 사유</Text>
              <AnimatedPressable onPress={() => openReasonInput("unregistered")} style={fieldStyle} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: changeReason ? "#19191B" : "#AAB4BF" }}>
                  {changeReason || "변경 요청 사유 입력"}
                </Text>
              </AnimatedPressable>
              {changeReason && <Text style={{ fontSize: 13, color: "#AAB4BF", textAlign: "right", marginTop: 4 }}>{changeReason.length}/100</Text>}
            </>
          ) : isBreakChange ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>추가/변경할 휴게 시간을</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 32 }}>선택해 주세요</Text>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 12 }}>선택한 일정</Text>
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {renderShiftBadges()}
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{dateLabel}</Text>
              </View>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>등록 휴게 시간 변경 <Text style={{ color: "#FF3D3D" }}>*</Text></Text>
              <AnimatedPressable onPress={() => { setMinutePickerValue(breakMinutes); setMinutePickerOpen(true); }} style={[fieldStyle, { marginBottom: 24 }]} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: "#FF862D", fontWeight: "500" }}>{breakMinutes}</Text>
                <Text style={{ fontSize: 15, color: "#AAB4BF" }}>분</Text>
              </AnimatedPressable>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>변경 요청 사유</Text>
              <AnimatedPressable onPress={() => openReasonInput("break")} style={fieldStyle} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: breakReason ? "#19191B" : "#AAB4BF" }}>
                  {breakReason || "변경 요청 사유 입력"}
                </Text>
              </AnimatedPressable>
              {breakReason && <Text style={{ fontSize: 13, color: "#AAB4BF", textAlign: "right", marginTop: 4 }}>{breakReason.length}/100</Text>}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>변경할 시간을</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 32 }}>선택해 주세요</Text>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 12 }}>선택한 일정</Text>
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {renderShiftBadges()}
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{dateLabel}</Text>
              </View>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>출근 시간 변경 <Text style={{ color: "#FF3D3D" }}>*</Text></Text>
              <AnimatedPressable onPress={() => openTimePicker("start")} style={[fieldStyle, { marginBottom: 24 }]} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: "#19191B" }}>{formatAmPm(startTime)}</Text>
                <ChevronDown size={20} color="#AAB4BF" />
              </AnimatedPressable>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>퇴근 시간 변경 <Text style={{ color: "#FF3D3D" }}>*</Text></Text>
              <AnimatedPressable onPress={() => openTimePicker("end")} style={[fieldStyle, { marginBottom: 24 }]} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: "#FF862D" }}>{formatAmPm(endTime)}</Text>
                <ChevronDown size={20} color="#AAB4BF" />
              </AnimatedPressable>

              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>변경 요청 사유</Text>
              <AnimatedPressable onPress={() => openReasonInput("change")} style={fieldStyle} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 15, color: changeReason ? "#19191B" : "#AAB4BF" }}>
                  {changeReason || "변경 요청 사유 입력"}
                </Text>
              </AnimatedPressable>
              {changeReason && <Text style={{ fontSize: 13, color: "#AAB4BF", textAlign: "right", marginTop: 4 }}>{changeReason.length}/100</Text>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom button — outside KAV */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
        {step === "reason" ? (
          <AnimatedPressable
            disabled={!selectedReason || isTransferred}
            onPress={() => setStep("detail")}
            style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: selectedReason && !isTransferred ? "#4261FF" : "#DBDCDF" }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF" }}>다음</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            disabled={!canSubmit || submitting || isTransferred}
            onPress={() => setConfirmOpen(true)}
            style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: canSubmit && !isTransferred ? "#4261FF" : "#DBDCDF" }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF" }}>수정 요청하기</Text>
          </AnimatedPressable>
        )}
      </View>

      {/* Reason selection bottom sheet */}
      <BottomSheet isOpen={reasonSheetOpen} onClose={() => setReasonSheetOpen(false)} title="수정 요청 사유 선택">
        <View style={{ gap: 8 }}>
          {reasonOptions.map((option) => (
            <AnimatedPressable
              key={option.value}
              onPress={() => { setSelectedReason(option.value); setReasonSheetOpen(false); }}
              style={{ paddingHorizontal: 4, paddingVertical: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: selectedReason === option.value ? "#F4F5F8" : "#FFFFFF" }}
              scaleAmount={0.97}
              opacityAmount={0.8}
            >
              <Text style={{ fontSize: 15, fontWeight: "500", color: selectedReason === option.value ? "#4261FF" : "#19191B" }}>
                {option.label}
              </Text>
              {selectedReason === option.value && <Check size={20} color="#4261FF" />}
            </AnimatedPressable>
          ))}
        </View>
      </BottomSheet>

      {/* Time picker bottom sheet */}
      <BottomSheet isOpen={timePickerOpen} onClose={() => setTimePickerOpen(false)} title={timePickerTarget === "start" ? "출근 시간 선택" : "퇴근 시간 선택"}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 220 }}>
          <View style={{ position: "absolute", top: "50%", left: -4, right: -4, height: 44, backgroundColor: "#F7F7F8", borderRadius: 12, marginTop: -22 }} />
          <ScrollView ref={hourScrollRef} style={{ width: 80, height: 220 }} showsVerticalScrollIndicator={false} snapToInterval={44} decelerationRate="fast" onMomentumScrollEnd={onHourScrollEnd} onScrollEndDrag={onHourScrollEnd}>
            <View style={{ height: 88 }} />
            {HOURS.map((h) => (
              <AnimatedPressable key={h} onPress={() => { setTimePickerHour(h); hourValRef.current = h; hourScrollRef.current?.scrollTo({ y: Number(h) * 44, animated: true }); }} style={{ height: 44, alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 18, fontWeight: h === timePickerHour ? "700" : "400", color: h === timePickerHour ? "#19191B" : "#AAB4BF" }}>{h}</Text>
              </AnimatedPressable>
            ))}
            <View style={{ height: 88 }} />
          </ScrollView>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B" }}>:</Text>
          <ScrollView ref={minuteScrollRef} style={{ width: 80, height: 220 }} showsVerticalScrollIndicator={false} snapToInterval={44} decelerationRate="fast" onMomentumScrollEnd={onMinuteScrollEnd} onScrollEndDrag={onMinuteScrollEnd}>
            <View style={{ height: 88 }} />
            {MINUTES.map((m) => (
              <AnimatedPressable key={m} onPress={() => { setTimePickerMinute(m); minuteValRef.current = m; minuteScrollRef.current?.scrollTo({ y: Number(m) * 44, animated: true }); }} style={{ height: 44, alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 18, fontWeight: m === timePickerMinute ? "700" : "400", color: m === timePickerMinute ? "#19191B" : "#AAB4BF" }}>{m}</Text>
              </AnimatedPressable>
            ))}
            <View style={{ height: 88 }} />
          </ScrollView>
        </View>
        <AnimatedPressable onPress={handleTimeConfirm} style={{ marginTop: 16, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.75}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
        </AnimatedPressable>
      </BottomSheet>

      {/* Minute picker bottom sheet */}
      <BottomSheet isOpen={minutePickerOpen} onClose={() => setMinutePickerOpen(false)} title="휴게 시간 선택">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 220 }}>
          <View style={{ position: "absolute", top: "50%", left: -4, right: -4, height: 44, backgroundColor: "#F7F7F8", borderRadius: 12, marginTop: -22 }} />
          <ScrollView ref={breakScrollRef} style={{ width: 80, height: 220 }} showsVerticalScrollIndicator={false} snapToInterval={44} decelerationRate="fast" onMomentumScrollEnd={onBreakScrollEnd} onScrollEndDrag={onBreakScrollEnd}>
            <View style={{ height: 88 }} />
            {MINUTE_ITEMS.map((m) => (
              <AnimatedPressable key={m} onPress={() => { setMinutePickerValue(m); breakValRef.current = m; breakScrollRef.current?.scrollTo({ y: Number(m) * 44, animated: true }); }} style={{ height: 44, alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 18, fontWeight: m === minutePickerValue ? "700" : "400", color: m === minutePickerValue ? "#19191B" : "#AAB4BF" }}>{m}</Text>
              </AnimatedPressable>
            ))}
            <View style={{ height: 88 }} />
          </ScrollView>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>분</Text>
        </View>
        <AnimatedPressable
          onPress={() => { setBreakMinutes(minutePickerValue); setMinutePickerOpen(false); }}
          style={{ marginTop: 16, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          scaleAmount={0.97}
          opacityAmount={0.75}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
        </AnimatedPressable>
      </BottomSheet>

      {/* Reason input bottom sheet */}
      <BottomSheet isOpen={reasonInputOpen} onClose={() => setReasonInputOpen(false)} title="변경 요청 사유 입력">
        <FocusInput
          value={reasonDraft}
          onChangeText={(t) => setReasonDraft(t.slice(0, 50))}
          placeholder="변경 사유를 입력해 주세요"
          placeholderTextColor="#AAB4BF"
          multiline
          style={{ minHeight: 160, borderRadius: 12, padding: 16, fontSize: 15, color: "#19191B", textAlignVertical: "top" }}
        />
        <Text style={{ fontSize: 13, color: "#AAB4BF", textAlign: "right", marginTop: 4, marginBottom: 24 }}>{reasonDraft.length}/50</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <AnimatedPressable onPress={() => setReasonInputOpen(false)} style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.75}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#4261FF" }}>취소</Text>
          </AnimatedPressable>
          <AnimatedPressable
            disabled={!reasonDraft.trim()}
            onPress={handleReasonInputConfirm}
            style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: reasonDraft.trim() ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>입력하기</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="근무 기록 수정 요청하기"
        description={"근무 기록 수정을 요청하시겠어요?\n사장님이 확인 후 요청이 처리돼요"}
        buttons={[
          { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
          { label: "요청하기", onPress: handleConfirm },
        ]}
      />

      <ConfirmDialog
        visible={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="수정 요청 취소"
        description={"입력 중인 내용이 저장되지 않아요.\n정말 취소하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setCancelConfirmOpen(false), variant: "cancel" },
          { label: "확인", onPress: () => { setCancelConfirmOpen(false); navigation.goBack(); } },
        ]}
      />
    </SafeAreaView>
  );
};

export default AttendanceRecordEditScreen;
