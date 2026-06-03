import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Modal, TextInput } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react-native";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "@/components/Toast";
import { getMySchedule, createScheduleChange } from "@/api/employee";
import { getShiftStyle, DEFAULT_SHIFT_STYLE } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import { DAY_LABELS as DAYS_KR } from "@/utils/constants";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 30)
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

const toMinutes = toMin;
const isCrossing = (start: string, end: string) => toMinutes(end) <= toMinutes(start);
const timeLabel = (t: string, start?: string) => {
  const nextDay = start && isCrossing(start, t);
  const h = Number(t.split(":")[0]);
  const prefix = !start ? h < 6 ? "새벽 " : "" : nextDay ? "다음날 " : "";
  return `${prefix}${t}`;
};

type Step = "select-schedule" | "form" | "select-change-date";

const HOLIDAY_STYLE = { bg: "#FFE8E8", text: "#FF5959" };

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDaysInMonth = new Date(year, month, 0).getDate();
  const days: { date: number; month: number; year: number; isOutside: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) days.push({ date: prevDaysInMonth - i, month: month - 1, year, isOutside: true });
  for (let i = 1; i <= daysInMonth; i++) days.push({ date: i, month, year, isOutside: false });
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) for (let i = 1; i <= remaining; i++) days.push({ date: i, month: month + 1, year, isOutside: true });
  return days;
}

function getDateKey(year: number, month: number, date: number) {
  return `${year}-${month + 1}-${date}`;
}

function formatDateDisplay(dateKey: string) {
  const parts = dateKey.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return `${parts[0]}.${String(parts[1]).padStart(2, "0")}.${String(parts[2]).padStart(2, "0")} (${DAYS_KR[d.getDay()]})`;
}

function formatDateShort(dateKey: string) {
  const parts = dateKey.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return `${String(parts[0]).slice(2)}.${String(parts[1]).padStart(2, "0")}.${String(parts[2]).padStart(2, "0")}(${DAYS_KR[d.getDay()]})`;
}

const ScheduleChangeRequestScreen: React.FC<ScreenProps<"ScheduleChangeRequest">> = ({ navigation }) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select-schedule");

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [changeDateYear, setChangeDateYear] = useState(new Date().getFullYear());
  const [changeDateMonth, setChangeDateMonth] = useState(new Date().getMonth());

  const [mySchedule, setMySchedule] = useState<Record<string, any>>({});
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);
  const [changeDate, setChangeDate] = useState<string | null>(null);
  const [clockIn, setClockIn] = useState<string | null>(null);
  const [clockOut, setClockOut] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);
  const [reasonFocused, setReasonFocused] = useState(false);
  const [clockInPickerOpen, setClockInPickerOpen] = useState(false);
  const [clockOutPickerOpen, setClockOutPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  useEffect(() => {
    if (!storeId) return;
    getMySchedule(storeId, currentYear, currentMonth + 1)
      .then((res: any) => setMySchedule(res?.schedules ?? res ?? {}))
      .catch(() => setMySchedule({}));
  }, [storeId, currentYear, currentMonth]);

  const selectedSchedule = selectedScheduleDate ? mySchedule[selectedScheduleDate] : null;
  const isFormValid = !!(changeDate && clockIn && clockOut);

  const today = new Date();
  const isToday = (year: number, month: number, date: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === date;

  const calendarDays = useMemo(() => getCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);
  const changeDateCalendarDays = useMemo(() => getCalendarDays(changeDateYear, changeDateMonth), [changeDateYear, changeDateMonth]);

  const weeks = useMemo(() => {
    const w: typeof calendarDays[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) w.push(calendarDays.slice(i, i + 7));
    return w;
  }, [calendarDays]);

  const changeDateWeeks = useMemo(() => {
    const w: typeof changeDateCalendarDays[] = [];
    for (let i = 0; i < changeDateCalendarDays.length; i += 7) w.push(changeDateCalendarDays.slice(i, i + 7));
    return w;
  }, [changeDateCalendarDays]);

  const prevMain = () => {
    if (currentMonth === 0) { setCurrentYear(currentYear - 1); setCurrentMonth(11); } else setCurrentMonth(currentMonth - 1);
  };
  const nextMain = () => {
    if (currentMonth === 11) { setCurrentYear(currentYear + 1); setCurrentMonth(0); } else setCurrentMonth(currentMonth + 1);
  };
  const prevChange = () => {
    if (changeDateMonth === 0) { setChangeDateYear(changeDateYear - 1); setChangeDateMonth(11); } else setChangeDateMonth(changeDateMonth - 1);
  };
  const nextChange = () => {
    if (changeDateMonth === 11) { setChangeDateYear(changeDateYear + 1); setChangeDateMonth(0); } else setChangeDateMonth(changeDateMonth + 1);
  };

  const toBackendDate = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    if (!storeId || submitting) return;
    setSubmitting(true);
    try {
      await createScheduleChange({
        store_id: storeId,
        type: "schedule_change",
        origin_date: selectedScheduleDate ? toBackendDate(selectedScheduleDate) : undefined,
        origin_start: selectedSchedule?.work_start ? String(selectedSchedule.work_start).slice(0, 5) : undefined,
        origin_end: selectedSchedule?.work_end ? String(selectedSchedule.work_end).slice(0, 5) : undefined,
        desired_date: toBackendDate(changeDate!),
        desired_start: clockIn ?? undefined,
        desired_end: clockOut ?? undefined,
        reason: reason || undefined,
      });
      toast({ description: "일정 변경 요청이 완료 되었어요." });
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "요청에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === "form") setStep("select-schedule");
    else if (step === "select-change-date") setStep("form");
    else navigation.goBack();
  };

  const renderCalendar = (
    weeksData: typeof weeks,
    yearVal: number,
    monthVal: number,
    selectedKey: string | null,
    onSelect: (key: string) => void,
    showSchedule: boolean,
    onPrev: () => void,
    onNext: () => void,
    minDateKey?: string | null
  ) => (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
        <AnimatedPressable onPress={onPrev} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.97} opacityAmount={0.75}>
          <ChevronLeft size={20} color="#19191B" />
        </AnimatedPressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{yearVal}년 {monthVal + 1}월</Text>
        <AnimatedPressable onPress={onNext} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.97} opacityAmount={0.75}>
          <ChevronRight size={20} color="#19191B" />
        </AnimatedPressable>
      </View>

      <View style={{ paddingHorizontal: 12 }}>
        <View style={{ flexDirection: "row" }}>
          {DAYS_KR.map((d, i) => (
            <View key={d} style={{ flex: 1, alignItems: "center", paddingBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B" }}>{d}</Text>
            </View>
          ))}
        </View>

        {weeksData.map((week, wi) => (
          <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
            {week.map((d, di) => {
              const key = getDateKey(d.year, d.month, d.date);
              const schedule = !d.isOutside && showSchedule ? mySchedule[key] : null;
              const isHoliday = schedule?.is_holiday === true;
              const isTodayDate = !d.isOutside && isToday(d.year, d.month, d.date);
              const isSelected = !d.isOutside && key === selectedKey;
              const isSun = di === 0;
              const isSat = di === 6;
              const isBeforeMin = !d.isOutside && minDateKey != null && (() => {
                const [my, mm, md] = minDateKey.split("-").map(Number);
                const minTs = new Date(my, mm - 1, md).getTime();
                const keyTs = new Date(d.year, d.month, d.date).getTime();
                return keyTs < minTs;
              })();
              const dateColor = d.isOutside ? "#AAB4BF" : isBeforeMin ? "#D0D3D9" : isSelected ? "#FFFFFF" : isTodayDate ? "#FFFFFF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#70737B";
              const schedStyle = schedule ? getShiftStyle(schedule.shift_name) : DEFAULT_SHIFT_STYLE;
              return (
                <AnimatedPressable
                  key={di}
                  disabled={d.isOutside || !!isBeforeMin}
                  onPress={() => { if (!d.isOutside && !isBeforeMin) onSelect(key); }}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 6, minHeight: showSchedule ? 90 : 56 }}
                  scaleAmount={0.85}
                  opacityAmount={0.7}
                >
                  <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    <View style={
                      isSelected ? { backgroundColor: "#4261FF", borderRadius: 10, minWidth: 40, width: 40, height: 22, alignItems: "center", justifyContent: "center" }
                      : isTodayDate ? { backgroundColor: "#4261FF", borderRadius: 10, minWidth: 40, width: 40, height: 22, alignItems: "center", justifyContent: "center", opacity: 0.5 }
                      : {}
                    }>
                      <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: dateColor }}>
                        {d.date}
                      </Text>
                    </View>
                  </View>

                  {showSchedule && !d.isOutside && (
                    <View style={{ width: "100%", paddingHorizontal: 2 }}>
                      {isHoliday ? (
                        <View style={{ backgroundColor: HOLIDAY_STYLE.bg, borderRadius: 4, height: 17, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 12, fontWeight: "500", color: HOLIDAY_STYLE.text }}>휴무</Text>
                        </View>
                      ) : schedule?.work_start ? (
                        <View style={{ backgroundColor: isSelected ? "#E8F3FF" : schedStyle.bg, borderRadius: 4, minHeight: 36, paddingVertical: 2, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 12, fontWeight: "500", color: isSelected ? "#7488FE" : schedStyle.text }}>{schedule.work_start}</Text>
                          <Text style={{ fontSize: 10, color: isSelected ? "#7488FE" : schedStyle.text }}>-</Text>
                          <Text style={{ fontSize: 12, fontWeight: "500", color: isSelected ? "#7488FE" : schedStyle.text }}>{schedule.work_end}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </AnimatedPressable>
              );
            })}
          </View>
        ))}
      </View>
    </>
  );

  const fieldStyle = {
    height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#DBDCDF",
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
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>일정 변경 요청</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {/* Step: select-schedule */}
      {step === "select-schedule" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>변경을 요청할</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>일정을 선택해 주세요</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
            {renderCalendar(weeks, currentYear, currentMonth, selectedScheduleDate, (key) => { if (mySchedule[key]) setSelectedScheduleDate(key); }, true, prevMain, nextMain, `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`)}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
            <AnimatedPressable
              disabled={!selectedScheduleDate}
              onPress={() => setStep("form")}
              style={{ height: 56, borderRadius: 16, backgroundColor: selectedScheduleDate ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>다음</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}

      {/* Step: form */}
      {step === "form" && (
        <>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>변경할 일정을</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 16 }}>확인해 주세요</Text>

            <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>선택한 일정</Text>
            {selectedScheduleDate && selectedSchedule && (
              <View style={{ borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F0F7FF", marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {(() => {
                  const style = getShiftStyle(selectedSchedule.shift_name);
                  return (
                    <View style={{ backgroundColor: style.bg, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: style.text }}>
                        {selectedSchedule.shift_name ?? "일일"}
                      </Text>
                    </View>
                  );
                })()}
                <Text style={{ fontSize: 15, color: "#19191B", fontWeight: "500" }}>
                  {formatDateDisplay(selectedScheduleDate)}
                </Text>
                <Text style={{ fontSize: 15, color: "#70737B" }}>
                  {selectedSchedule.work_start} - {selectedSchedule.work_end}
                </Text>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: "#EBEBEB", marginVertical: 20 }} />

            <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>
              변경할 날짜 <Text style={{ color: "#FF5959" }}>*</Text>
            </Text>
            <AnimatedPressable onPress={() => setStep("select-change-date")} style={[fieldStyle, { marginBottom: 16 }]} scaleAmount={0.97} opacityAmount={0.8}>
              <Text style={{ fontSize: 15, color: changeDate ? "#19191B" : "#AAB4BF" }}>
                {changeDate ? formatDateDisplay(changeDate) : "날짜를 선택해 주세요"}
              </Text>
              <CalendarIcon size={20} color="#9EA3AD" />
            </AnimatedPressable>

            <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>
              출근 시간 <Text style={{ color: "#FF5959" }}>*</Text>
            </Text>
            <AnimatedPressable onPress={() => setClockInPickerOpen(true)} style={[fieldStyle, { marginBottom: 16 }]} scaleAmount={0.97} opacityAmount={0.8}>
              <Text style={{ fontSize: 15, color: clockIn ? "#19191B" : "#AAB4BF" }}>{clockIn ? timeLabel(clockIn) : "출근 시간 선택"}</Text>
              <ChevronDown size={20} color="#9EA3AD" />
            </AnimatedPressable>

            <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>
              퇴근 시간 <Text style={{ color: "#FF5959" }}>*</Text>
            </Text>
            <AnimatedPressable onPress={() => setClockOutPickerOpen(true)} style={[fieldStyle, { marginBottom: 16 }]} scaleAmount={0.97} opacityAmount={0.8}>
              <Text style={{ fontSize: 15, color: clockOut ? "#19191B" : "#AAB4BF" }}>{clockOut ? timeLabel(clockOut, clockIn ?? undefined) : "퇴근 시간 선택"}</Text>
              <ChevronDown size={20} color="#9EA3AD" />
            </AnimatedPressable>

            <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#93989E", marginBottom: 8 }}>변경 요청 사유</Text>
            <AnimatedPressable
              onPress={() => { setReasonDraft(reason); setReasonSheetOpen(true); }}
              style={fieldStyle}
              scaleAmount={0.97}
              opacityAmount={0.8}
            >
              <Text style={{ fontSize: 15, color: reason ? "#19191B" : "#AAB4BF" }}>{reason || "변경 사유 입력"}</Text>
            </AnimatedPressable>
          </ScrollView>

        </KeyboardAvoidingView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
          <AnimatedPressable
            disabled={!isFormValid || submitting}
            onPress={() => setConfirmOpen(true)}
            style={{ height: 56, borderRadius: 16, backgroundColor: isFormValid ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>일정 변경 요청하기</Text>
          </AnimatedPressable>
        </View>
        </>
      )}

      {/* Step: select-change-date */}
      {step === "select-change-date" && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>변경할 날짜를</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30 }}>선택해 주세요</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
            {renderCalendar(changeDateWeeks, changeDateYear, changeDateMonth, changeDate, setChangeDate, false, prevChange, nextChange, selectedScheduleDate)}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
            <AnimatedPressable
              disabled={!changeDate}
              onPress={() => setStep("form")}
              style={{ height: 56, borderRadius: 16, backgroundColor: changeDate ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>다음</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}

      {/* Clock in picker */}
      <BottomSheet isOpen={clockInPickerOpen} onClose={() => setClockInPickerOpen(false)} title="출근 시간 선택">
        <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => {
            const sel = clockIn === t;
            const label = timeLabel(t);
            return (
              <AnimatedPressable
                key={t}
                onPress={() => { setClockIn(t); setClockInPickerOpen(false); }}
                scaleAmount={0.97}
                opacityAmount={0.85}
                style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, marginBottom: 2, backgroundColor: sel ? "#E8F3FF" : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "500", color: sel ? "#4261FF" : "#19191B" }}>{label}</Text>
                {sel && <Check size={16} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Clock out picker */}
      <BottomSheet isOpen={clockOutPickerOpen} onClose={() => setClockOutPickerOpen(false)} title="퇴근 시간 선택">
        <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => {
            const sel = clockOut === t;
            const crosses = clockIn ? isCrossing(clockIn, t) : false;
            const label = clockIn ? timeLabel(t, clockIn) : timeLabel(t);
            return (
              <AnimatedPressable
                key={t}
                onPress={() => { setClockOut(t); setClockOutPickerOpen(false); }}
                scaleAmount={0.97}
                opacityAmount={0.85}
                style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, marginBottom: 2, backgroundColor: sel ? "#E8F3FF" : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: sel ? "#4261FF" : "#19191B" }}>{label}</Text>
                  {crosses && !sel && (
                    <View style={{ backgroundColor: "#FFF0F0", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 11, color: "#FF5959", fontWeight: "600" }}>익일</Text>
                    </View>
                  )}
                </View>
                {sel && <Check size={16} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Reason sheet */}
      <BottomSheet isOpen={reasonSheetOpen} onClose={() => setReasonSheetOpen(false)} title="변경 요청 사유 입력">
        <View style={{ position: "relative" }}>
          <TextInput
            value={reasonDraft}
            onChangeText={(t) => { if (t.length <= 50) setReasonDraft(t); }}
            placeholder="변경 사유를 입력해 주세요"
            placeholderTextColor="#AAB4BF"
            multiline
            maxLength={50}
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
            style={{
              minHeight: 160,
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
          <Text style={{ position: "absolute", bottom: 10, right: 12, fontSize: 13, color: "#AAB4BF" }}>{reasonDraft.length}/50</Text>
        </View>
        <Text style={{ marginBottom: 24 }}></Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <AnimatedPressable onPress={() => setReasonSheetOpen(false)} style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.75}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF" }}>취소</Text>
          </AnimatedPressable>
          <AnimatedPressable
            disabled={!reasonDraft.trim()}
            onPress={() => { setReason(reasonDraft.trim()); setReasonSheetOpen(false); }}
            style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: reasonDraft.trim() ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>입력하기</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

      {/* Confirm dialog */}
      <Modal visible={confirmOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }} onPress={() => setConfirmOpen(false)}>
          <Pressable style={{ width: "85%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden" }} onPress={() => {}}>
            <View style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B", marginBottom: 8, textAlign: "center" }}>일정 변경 요청하기</Text>
              <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22 }}>
                아래와 같이 일정을 변경하시겠어요?{"\n"}사장님이 확인 후 일정이 변경돼요
              </Text>
              {selectedScheduleDate && selectedSchedule && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#70737B" }}>선택한 일정</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{formatDateShort(selectedScheduleDate)} | {selectedSchedule.work_start}-{selectedSchedule.work_end}</Text>
                </View>
              )}
              {changeDate && clockIn && clockOut && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#70737B" }}>변경할 일정</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#4261FF" }}>{formatDateShort(changeDate)} | {timeLabel(clockIn!)}-{timeLabel(clockOut!, clockIn ?? undefined)}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
              <AnimatedPressable onPress={() => setConfirmOpen(false)} style={{ flex: 1, height: 52, backgroundColor: "#EBEBEB", borderRadius: 12, alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.75}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleConfirm} style={{ flex: 1, height: 52, backgroundColor: "#4261FF", borderRadius: 12, alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.75}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default ScheduleChangeRequestScreen;
