import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Modal,
} from "react-native";
import { ChevronLeft, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { editWorklog, getStaffDetail, getPayslips, generatePayslips } from "@/api/owner";
import { getCachedStoreInfo } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import { DAY_LABELS as WEEK_DAYS } from "@/utils/constants";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

type EditType = "출근" | "지각" | "연장" | "야간" | "휴일" | "결근";

const TYPE_OPTIONS: { label: EditType; color: string; bg: string }[] = [
  { label: "출근", color: "#10C97D", bg: "rgba(16,201,125,0.1)" },
  { label: "지각", color: "#FF862D", bg: "rgba(255,134,45,0.1)" },
  { label: "연장", color: "#7488FE", bg: "#E8F3FF"              },
  { label: "야간", color: "#6B4FEC", bg: "rgba(107,79,236,0.1)" },
  { label: "휴일", color: "#E05C00", bg: "rgba(224,92,0,0.1)"   },
  { label: "결근", color: "#FF3D3D", bg: "rgba(255,61,61,0.1)"  },
];

const toApiStatus = (t: EditType): "off_work" | "late" | "absent" | "extended" | "night" | "holiday" =>
  t === "결근" ? "absent" : t === "지각" ? "late" : t === "연장" ? "extended" : t === "야간" ? "night" : t === "휴일" ? "holiday" : "off_work";

const STATUS_LABEL: Record<string, string> = {
  off_work: "근무완료", completed: "근무완료", working: "근무중", on_break: "휴게중",
  late: "지각", extended: "연장", night: "야간", holiday: "휴일",
  absent: "결근", vacation: "휴가", scheduled: "예정", before_work: "근무전", off: "휴무",
};


/** 출퇴근 시간과 계약/설정 기준으로 하루 급여 계산 */
const calcDayWage = (params: {
  start: string; end: string; breakMin: number; hourlyRate: number;
  scheduledEnd: string | null;
  hasOvertime: boolean; overtimeMult: number; overtimeThreshMin: number;
  hasNight: boolean; nightStart: string | null; nightEnd: string | null; nightMult: number;
  isHoliday: boolean; hasHolidayPay: boolean; holidayMultUnder8: number; holidayMultOver8: number;
}): { base: number; overtime: number; night: number; holiday: number; total: number } => {
  if (!params.start || !params.end) return { base: 0, overtime: 0, night: 0, holiday: 0, total: 0 };
  const startMin = toMin(params.start);
  let endMin = toMin(params.end);
  if (endMin <= startMin) endMin += 24 * 60; // 익일 처리
  const worked = Math.max(0, endMin - startMin - params.breakMin);
  const ratePerMin = params.hourlyRate / 60;

  // 휴일수당
  if (params.isHoliday && params.hasHolidayPay) {
    const mult = worked > 8 * 60 ? params.holidayMultOver8 : params.holidayMultUnder8;
    const total = Math.round(worked * ratePerMin * mult);
    return { base: Math.round(worked * ratePerMin), overtime: 0, night: Math.round(worked * ratePerMin * (mult - 1)), holiday: total, total };
  }

  const base = Math.round(worked * ratePerMin);

  // 연장수당
  let overtime = 0;
  if (params.hasOvertime && params.scheduledEnd) {
    const schedEndMin = toMin(params.scheduledEnd);
    const overThresh = schedEndMin + params.overtimeThreshMin;
    if (endMin > overThresh) {
      const overtimeMin = endMin - overThresh;
      overtime = Math.round(overtimeMin * ratePerMin * (params.overtimeMult - 1));
    }
  }

  // 야간수당
  let night = 0;
  if (params.hasNight && params.nightStart && params.nightEnd) {
    const nsMin = toMin(params.nightStart);
    const neMin = toMin(params.nightEnd) + (toMin(params.nightEnd) < nsMin ? 24 * 60 : 0);
    const overlap = Math.max(0, Math.min(endMin, neMin) - Math.max(startMin, nsMin));
    if (overlap > 0) night = Math.round(overlap * ratePerMin * (params.nightMult - 1));
  }

  return { base, overtime, night, holiday: 0, total: base + overtime + night };
};

const OwnerAttendanceEditScreen: React.FC<ScreenProps<"OwnerAttendanceEdit">> = ({ route, navigation }) => {
  const {
    staffId, staffName, date,
    status, clockIn, clockOut,
    scheduledStart, scheduledEnd,
    breakMinutes,
  } = route.params;

  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const initialType: EditType =
    status === "absent"   ? "결근" :
    status === "late"     ? "지각" :
    status === "extended" ? "연장" :
    status === "night"    ? "야간" :
    status === "holiday"  ? "휴일" : "출근";

  const [editType,   setEditType]   = useState<EditType>(initialType);
  const [editStart,  setEditStart]  = useState(clockIn ?? "");
  const [editEnd,    setEditEnd]    = useState(clockOut ?? "");
  const [saving,     setSaving]     = useState(false);
  const [payslipDialog, setPayslipDialog] = useState(false);
  const [payslipLoading, setPayslipLoading] = useState(false);

  // 급여 계산용 데이터
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [breakMin,   setBreakMin]   = useState(breakMinutes ?? 0);
  const [storeSettings, setStoreSettings] = useState<any>(null);

  const [timePickerOpen,   setTimePickerOpen]   = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<"start" | "end">("start");
  const [timePickerHour,   setTimePickerHour]   = useState("09");
  const [timePickerMinute, setTimePickerMinute] = useState("00");

  const hourScrollRef   = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const hourValRef      = useRef("09");
  const minuteValRef    = useRef("00");
  useEffect(() => { hourValRef.current   = timePickerHour;   }, [timePickerHour]);
  useEffect(() => { minuteValRef.current = timePickerMinute; }, [timePickerMinute]);

  // 직원 계약 + 매장 설정 로드
  useEffect(() => {
    if (!storeId || !staffId) return;
    Promise.all([
      getStaffDetail(storeId, staffId).catch(() => null),
      getCachedStoreInfo(storeId).catch(() => null),
    ]).then(([detail, info]) => {
      const d = detail as any;
      const i = info as any;
      const rate = d?.contract?.hourly_rate ?? null;
      setHourlyRate(rate);
      if (d?.contract?.break_minutes) setBreakMin(d.contract.break_minutes);
      setStoreSettings(i?.setting ?? null);
    });
  }, [storeId, staffId]);

  useEffect(() => {
    if (!timePickerOpen) return;
    const timer = setTimeout(() => {
      hourScrollRef.current?.scrollTo({ y: parseInt(hourValRef.current, 10) * 44, animated: false });
      minuteScrollRef.current?.scrollTo({ y: parseInt(minuteValRef.current, 10) * 44, animated: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [timePickerOpen]);

  const onHourScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / 44);
    const v = HOURS[Math.max(0, Math.min(i, HOURS.length - 1))];
    setTimePickerHour(v); hourValRef.current = v;
  };
  const onMinuteScrollEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / 44);
    const v = MINUTES[Math.max(0, Math.min(i, MINUTES.length - 1))];
    setTimePickerMinute(v); minuteValRef.current = v;
  };

  const openTimePicker = (target: "start" | "end") => {
    const val = target === "start" ? (editStart || "09:00") : (editEnd || "18:00");
    setTimePickerHour(val.split(":")[0] || "09");
    setTimePickerMinute(val.split(":")[1] || "00");
    setTimePickerTarget(target);
    setTimePickerOpen(true);
  };

  const handleTimeConfirm = () => {
    const time = `${timePickerHour}:${timePickerMinute}`;
    if (timePickerTarget === "start") setEditStart(time);
    else setEditEnd(time);
    setTimePickerOpen(false);
  };

  /** 급여 계산 공통 파라미터 */
  const wageParams = useCallback(() => {
    if (!storeSettings) return null;
    const s = storeSettings;
    return {
      breakMin,
      hourlyRate: hourlyRate ?? 0,
      scheduledEnd: scheduledEnd ?? null,
      hasOvertime: !!s.has_overtime_pay,
      overtimeMult: parseFloat(s.overtime_multiplier ?? "1.5"),
      overtimeThreshMin: s.overtime_threshold_minutes ?? 0,
      hasNight: !!s.has_night_pay,
      nightStart: s.night_start?.slice(0, 5) ?? null,
      nightEnd: s.night_end?.slice(0, 5) ?? null,
      nightMult: parseFloat(s.night_multiplier ?? "1.5"),
      hasHolidayPay: !!s.has_holiday_pay,
      holidayMultUnder8: parseFloat(s.holiday_multiplier_under_8h ?? "1.5"),
      holidayMultOver8: parseFloat(s.holiday_multiplier_over_8h ?? "2.0"),
    };
  }, [storeSettings, hourlyRate, breakMin, scheduledEnd]);

  const beforeWage = useCallback(() => {
    const p = wageParams();
    if (!p || !hourlyRate) return null;
    if (status === "absent") return { base: 0, overtime: 0, night: 0, holiday: 0, total: 0 };
    if (!clockIn) return null;
    return calcDayWage({ ...p, start: clockIn, end: clockOut ?? "", isHoliday: status === "holiday" });
  }, [wageParams, status, clockIn, clockOut, hourlyRate]);

  const afterWage = useCallback(() => {
    const p = wageParams();
    if (!p || !hourlyRate) return null;
    if (editType === "결근") return { base: 0, overtime: 0, night: 0, holiday: 0, total: 0 };
    if (!editStart) return null;
    return calcDayWage({ ...p, start: editStart, end: editEnd, isHoliday: editType === "휴일" });
  }, [wageParams, editType, editStart, editEnd, hourlyRate]);

  const bWage = beforeWage();
  const aWage = afterWage();
  const delta = (aWage !== null && bWage !== null) ? aWage.total - bWage.total : null;

  const handleSave = async () => {
    if (saving) return;
    if (editType !== "결근" && !editStart) {
      toast({ description: "출근 시간을 입력해주세요", duration: 2000 });
      return;
    }
    setSaving(true);
    try {
      await editWorklog(storeId, {
        employee_id: staffId,
        date,
        status: toApiStatus(editType),
        clock_in:  editType === "결근" ? null : editStart,
        clock_out: editType === "결근" ? null : (editEnd || null),
      });
      toast({ description: "근태 정보가 수정됐어요" });
      // 급여 반영 제안
      if (hourlyRate && delta !== null && delta !== 0) {
        setPayslipDialog(true);
      } else {
        navigation.goBack();
      }
    } catch {
      toast({ description: "수정 중 오류가 발생했어요", duration: 2000 });
    } finally {
      setSaving(false);
    }
  };

  const handlePayslipUpdate = async () => {
    setPayslipLoading(true);
    try {
      const d = new Date(date);
      await generatePayslips(storeId, d.getFullYear(), d.getMonth() + 1, staffId);
      toast({ description: "급여명세서가 업데이트됐어요" });
    } catch {
      toast({ description: "급여명세서 업데이트 중 오류가 발생했어요", variant: "destructive" });
    } finally {
      setPayslipLoading(false);
      setPayslipDialog(false);
      navigation.goBack();
    }
  };

  const formattedDate = (() => {
    const d = new Date(date);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK_DAYS[d.getDay()]})`;
  })();

  const currentStatusLabel = STATUS_LABEL[status ?? ""] ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>

      {/* 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>근태 정보 수정</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 정보 카드 */}
        <View style={{ backgroundColor: "#F0F4FF", borderRadius: 14, padding: 16, marginBottom: 28 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B", letterSpacing: -0.3 }}>
            {formattedDate}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF", marginTop: 6 }}>
            {staffName}
          </Text>
          {currentStatusLabel ? (
            <Text style={{ fontSize: 13, color: "#70737B", marginTop: 4 }}>
              현재 상태: {currentStatusLabel}
              {clockIn ? `  ·  ${clockIn}${clockOut ? ` ~ ${clockOut}` : ""}` : ""}
            </Text>
          ) : null}
          {(scheduledStart || scheduledEnd) ? (
            <Text style={{ fontSize: 13, color: "#70737B", marginTop: 2 }}>
              예정: {scheduledStart ?? "-"} ~ {scheduledEnd ?? "-"}
            </Text>
          ) : null}
        </View>

        {/* 근태 유형 */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#70737B", marginBottom: 10, letterSpacing: -0.28 }}>
          근태 유형
        </Text>
        {[TYPE_OPTIONS.slice(0, 3), TYPE_OPTIONS.slice(3)].map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", gap: 8, marginBottom: ri === 0 ? 8 : 28 }}>
            {row.map((opt) => {
              const isSel = editType === opt.label;
              return (
                <AnimatedPressable
                  key={opt.label}
                  onPress={() => setEditType(opt.label)}
                  style={{
                    flex: 1, height: 52, borderRadius: 10,
                    alignItems: "center", justifyContent: "center",
                    borderWidth: isSel ? 2 : 1,
                    borderColor: isSel ? opt.color : "#DBDCDF",
                    backgroundColor: isSel ? opt.bg : "#FFFFFF",
                  }}
                  scaleAmount={0.97} opacityAmount={0.85}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: isSel ? "700" : "500",
                    color: isSel ? opt.color : "#70737B",
                  }}>
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        ))}

        {/* 시간 */}
        {editType !== "결근" && (
          <>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#70737B", marginBottom: 10, letterSpacing: -0.28 }}>
              시간
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: "#9EA3AD", marginBottom: 8 }}>출근</Text>
                <AnimatedPressable
                  onPress={() => openTimePicker("start")}
                  style={{
                    height: 52, borderWidth: editStart ? 2 : 1,
                    borderColor: editStart ? "#4261FF" : "#DBDCDF",
                    borderRadius: 10, paddingHorizontal: 14, justifyContent: "center",
                  }}
                  scaleAmount={0.98} opacityAmount={0.85}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: editStart ? "#19191B" : "#AAB4BF" }}>
                    {editStart || "시간 선택"}
                  </Text>
                </AnimatedPressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: "#9EA3AD", marginBottom: 8 }}>퇴근</Text>
                <AnimatedPressable
                  onPress={() => openTimePicker("end")}
                  style={{
                    height: 52, borderWidth: editEnd ? 2 : 1,
                    borderColor: editEnd ? "#4261FF" : "#DBDCDF",
                    borderRadius: 10, paddingHorizontal: 14, justifyContent: "center",
                  }}
                  scaleAmount={0.98} opacityAmount={0.85}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: editEnd ? "#19191B" : "#AAB4BF" }}>
                    {editEnd || "시간 선택"}
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          </>
        )}

        {/* 급여 영향 카드 */}
        {hourlyRate && (aWage !== null || editType === "결근") && (
          <View style={{ backgroundColor: "#F7F8FA", borderRadius: 16, padding: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <AlertCircle size={14} color="#70737B" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>예상 급여 영향</Text>
              <Text style={{ fontSize: 11, color: "#AAB4BF", marginLeft: "auto" }}>시급 {hourlyRate.toLocaleString()}원 기준</Text>
            </View>

            {/* 이전 → 이후 */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#AAB4BF", marginBottom: 4 }}>수정 전</Text>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#70737B" }}>
                  {bWage !== null ? `${bWage.total.toLocaleString()}원` : "-"}
                </Text>
              </View>
              <View style={{ width: 1, height: 32, backgroundColor: "#EBEBEB" }} />
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={{ fontSize: 11, color: "#AAB4BF", marginBottom: 4 }}>수정 후</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B" }}>
                  {aWage !== null ? `${aWage.total.toLocaleString()}원` : (editType === "결근" ? "0원" : "-")}
                </Text>
              </View>
            </View>

            {/* 내역 */}
            {aWage !== null && (
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: 10, padding: 12, gap: 6, marginBottom: 10 }}>
                <WageRow label="기본급" value={aWage.base} />
                {aWage.overtime > 0 && <WageRow label="연장수당" value={aWage.overtime} color="#7488FE" />}
                {aWage.night > 0 && <WageRow label="야간수당" value={aWage.night} color="#6B4FEC" />}
                {aWage.holiday > 0 && <WageRow label="휴일수당" value={aWage.holiday} color="#E05C00" />}
              </View>
            )}

            {/* 차액 */}
            {delta !== null && (
              <View style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                borderRadius: 10, padding: 10,
                backgroundColor: delta > 0 ? "rgba(16,201,125,0.08)" : delta < 0 ? "rgba(255,61,61,0.08)" : "#F0F0F0",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {delta > 0 ? <TrendingUp size={14} color="#10C97D" /> : delta < 0 ? <TrendingDown size={14} color="#FF3D3D" /> : <Minus size={14} color="#AAB4BF" />}
                  <Text style={{ fontSize: 12, color: "#70737B" }}>차액</Text>
                </View>
                <Text style={{
                  fontSize: 15, fontWeight: "700",
                  color: delta > 0 ? "#10C97D" : delta < 0 ? "#FF3D3D" : "#AAB4BF",
                }}>
                  {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}원
                </Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
        borderTopWidth: 1, borderTopColor: "#F0F0F0",
      }}>
        <AnimatedPressable
          onPress={handleSave}
          style={{
            height: 56, borderRadius: 16,
            backgroundColor: saving ? "#F7F7F8" : "#4261FF",
            alignItems: "center", justifyContent: "center",
          }}
          scaleAmount={0.97} opacityAmount={0.75}
        >
          {saving
            ? <ActivityIndicator color="#AAB4BF" />
            : <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.36 }}>
                근태 정보 수정하기
              </Text>
          }
        </AnimatedPressable>
      </View>

      {/* 시간 피커 */}
      <BottomSheet
        isOpen={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        title={timePickerTarget === "start" ? "출근 시간 선택" : "퇴근 시간 선택"}
      >
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
        <AnimatedPressable
          onPress={handleTimeConfirm}
          style={{ marginTop: 16, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          scaleAmount={0.97} opacityAmount={0.75}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
        </AnimatedPressable>
      </BottomSheet>

      {/* 급여 반영 여부 다이얼로그 */}
      <Modal visible={payslipDialog} transparent animationType="fade" onRequestClose={() => { setPayslipDialog(false); navigation.goBack(); }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => { setPayslipDialog(false); navigation.goBack(); }}
        >
          <Pressable
            style={{ width: "85%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 20, alignItems: "center", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20 }}
            onPress={e => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 8 }}>
              급여명세서 업데이트
            </Text>
            <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22, marginBottom: 8 }}>
              근태 수정으로 인해 급여가{"\n"}
              <Text style={{ fontWeight: "700", color: delta && delta > 0 ? "#10C97D" : "#FF3D3D" }}>
                {delta && delta > 0 ? `+${delta?.toLocaleString()}` : delta?.toLocaleString()}원
              </Text>{" "}
              변경될 수 있어요.{"\n"}
              이번 달 급여명세서를 업데이트할까요?
            </Text>
            {delta !== null && (
              <View style={{ backgroundColor: "#F7F8FA", borderRadius: 12, padding: 12, width: "100%", marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: "#AAB4BF", textAlign: "center" }}>
                  수정 전 {bWage?.total.toLocaleString() ?? "-"}원 → 수정 후 {aWage?.total.toLocaleString() ?? "-"}원
                </Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
              <AnimatedPressable
                onPress={() => { setPayslipDialog(false); navigation.goBack(); }}
                style={{ flex: 1, height: 52, backgroundColor: "#EBEBEB", borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                scaleAmount={0.97} opacityAmount={0.75}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#70737B" }}>나중에</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handlePayslipUpdate}
                disabled={payslipLoading}
                style={{ flex: 1, height: 52, backgroundColor: "#4261FF", borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                scaleAmount={0.97} opacityAmount={0.75}
              >
                {payslipLoading
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>업데이트</Text>
                }
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
};

const WageRow = ({ label, value, color = "#19191B" }: { label: string; value: number; color?: string }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
    <Text style={{ fontSize: 13, color: "#70737B" }}>{label}</Text>
    <Text style={{ fontSize: 13, fontWeight: "600", color }}>{value.toLocaleString()}원</Text>
  </View>
);

export default OwnerAttendanceEditScreen;
