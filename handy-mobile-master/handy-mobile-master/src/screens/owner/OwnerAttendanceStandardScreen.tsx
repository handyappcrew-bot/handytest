import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Platform, KeyboardAvoidingView, TextInput, Modal, Pressable } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence,
  withTiming, withDelay, Easing as RAEasing,
} from "react-native-reanimated";
import AnimatedPressable from "@/components/AnimatedPressable";
import FocusInput from "@/components/FocusInput";
import { ChevronLeft, ChevronDown, Check, Store } from "lucide-react-native";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "@/components/Toast";
import { updateAttendanceStandard } from "@/api/owner";
import { getCachedStoreInfo, invalidateStoreInfo } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const DISTANCE_OPTIONS    = ["10m", "50m", "100m", "200m", "300m", "500m"];
const LATE_OPTIONS        = ["0분", "5분", "10분", "15분", "20분"];
const RATE_OPTIONS        = ["1.5배 (법정 기준)", "2배 (법정 기준)", "직접 입력"];
const RATE_OPTIONS_BASIC  = ["1.5배 (법정 기준)", "2배 (법정 기준)"];
const UNIT_OPTIONS = [
  { label: "1분",   value: "1"  },
  { label: "10분",  value: "10" },
  { label: "15분",  value: "15" },
  { label: "30분",  value: "30" },
  { label: "1시간", value: "60" },
];

const extractNumber = (s: string): number | null => {
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const unitLabel = (v: string): string => UNIT_OPTIONS.find(u => u.value === v)?.label ?? `${v}분`;

// ─── SectionNotice ────────────────────────────────────────────────────────────
const SectionNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ backgroundColor: "#F7F7F8", borderRadius: 10, padding: 10, paddingHorizontal: 14, marginBottom: 16 }}>
    <Text style={{ fontSize: 13, color: "#70737B", lineHeight: 21 }}>{children}</Text>
  </View>
);

// ─── ToggleChips ─────────────────────────────────────────────────────────────
const ToggleChips: React.FC<{
  label: string; value: string; options: [string, string];
  onChange: (v: string) => void; subText?: string;
}> = ({ label, value, options, onChange, subText }) => (
  <View style={{ marginBottom: 24 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 10 }}>
      {label} <Text style={{ color: "#FF3D3D" }}>*</Text>
    </Text>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <AnimatedPressable
            key={opt}
            onPress={() => onChange(opt)}
            scaleAmount={0.94}
            opacityAmount={0.8}
            style={{
              flex: 1, height: 44, borderRadius: 10,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 4,
              borderWidth: active ? 2 : 1,
              borderColor: active ? "#4261FF" : "#DBDCDF",
              backgroundColor: active ? "#F0F4FF" : "#FFFFFF",
            }}
          >
            {active && <Check size={14} color="#4261FF" />}
            <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#4261FF" : "#70737B" }}>{opt}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
    {subText ? (
      <Text style={{ fontSize: 13, color: value === options[0] ? "#4261FF" : "#AAB4BF", marginTop: 6 }}>{subText}</Text>
    ) : null}
  </View>
);

// ─── FieldButton ─────────────────────────────────────────────────────────────
const FieldButton: React.FC<{
  label: string; value: string; placeholder: string;
  onPress: () => void; subText?: string;
}> = ({ label, value, placeholder, onPress, subText }) => (
  <View style={{ marginBottom: 24 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 10 }}>
      {label} <Text style={{ color: "#FF3D3D" }}>*</Text>
    </Text>
    <AnimatedPressable
      onPress={onPress}
      scaleAmount={0.97}
      opacityAmount={0.8}
      style={{
        height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
        paddingHorizontal: 20, flexDirection: "row", alignItems: "center",
        justifyContent: "space-between", backgroundColor: "#FFFFFF",
        marginBottom: subText ? 6 : 0,
      }}
    >
      <Text style={{ fontSize: 15, color: value ? "#19191B" : "#AAB4BF" }}>{value || placeholder}</Text>
      <ChevronDown size={20} color="#AAB4BF" />
    </AnimatedPressable>
    {subText ? <Text style={{ fontSize: 13, color: "#AAB4BF", marginTop: 4 }}>{subText}</Text> : null}
  </View>
);

// ─── RateExampleBox ───────────────────────────────────────────────────────────
const RateExampleBox: React.FC<{ rate: string }> = ({ rate }) => (
  <View style={{
    backgroundColor: "#F7F7F8", borderRadius: 8,
    padding: 10, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
  }}>
    <Text style={{ fontSize: 13, color: "#70737B" }}>연장 1시간 계산 예시</Text>
    <Text style={{ fontSize: 13, color: "#AAB4BF" }}>→</Text>
    <Text style={{ fontSize: 13, fontWeight: "700", color: "#4261FF" }}>
      시급 × {rate.replace(" (법정 기준)", "")}
    </Text>
  </View>
);

// ─── UnitChips ───────────────────────────────────────────────────────────────
const UnitChips: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  hint?: string;
}> = ({ label, value, onChange, hint }) => (
  <View style={{ marginBottom: 24 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 6 }}>
      {label} <Text style={{ color: "#FF3D3D" }}>*</Text>
    </Text>
    <Text style={{ fontSize: 12, color: "#AAB4BF", marginBottom: 10 }}>
      {hint ?? "몇 분 이상 연장해야 수당이 발생하나요?"}
    </Text>
    <View style={{ flexDirection: "row", gap: 6 }}>
      {UNIT_OPTIONS.map((opt) => {
        const sel = value === opt.value;
        return (
          <AnimatedPressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            scaleAmount={0.95}
            opacityAmount={0.8}
            style={{
              flex: 1, height: 44, borderRadius: 10,
              alignItems: "center", justifyContent: "center",
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? "#4261FF" : "#DBDCDF",
              backgroundColor: sel ? "#F0F4FF" : "#FFFFFF",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: sel ? "#4261FF" : "#19191B" }}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  </View>
);

// ─── Toggle Switch (웹앱 하루8시간/주40시간 토글) ────────────────────────────
const ToggleSwitch: React.FC<{
  on: boolean; onToggle: () => void;
  title: string; subTitle: string; activeText: string;
}> = ({ on, onToggle, title, subTitle, activeText }) => (
  <View style={{
    backgroundColor: "#FFFFFF", borderRadius: 10, padding: 12, paddingHorizontal: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: on ? "#4261FF" : "#EBEBEB",
  }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: on ? 8 : 0 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B", marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{subTitle}</Text>
      </View>
      {/* Toggle pill */}
      <AnimatedPressable
        onPress={onToggle}
        scaleAmount={0.92}
        opacityAmount={0.85}
        style={{
          width: 48, height: 28, borderRadius: 14,
          backgroundColor: on ? "#4261FF" : "#DBDCDF",
          justifyContent: "center", flexShrink: 0, marginLeft: 12,
        }}
      >
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: "#FFFFFF",
          position: "absolute", top: 3,
          left: on ? 23 : 3,
          shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
        }} />
      </AnimatedPressable>
    </View>
    {on && (
      <Text style={{ fontSize: 12, color: "#4261FF", fontWeight: "500" }}>{activeText}</Text>
    )}
  </View>
);

// ─── OptionSheet ─────────────────────────────────────────────────────────────
const OptionSheet: React.FC<{
  visible: boolean; title: string; options: string[];
  value: string; onSelect: (v: string) => void; onClose: () => void;
  allowCustomInput?: boolean;
}> = ({ visible, title, options, value, onSelect, onClose, allowCustomInput }) => {
  const [showCustom, setShowCustom]   = useState(false);
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  // 드로어 열릴 때 초기화
  React.useEffect(() => {
    if (visible) { setShowCustom(false); setCustomValue(""); }
  }, [visible]);

  React.useEffect(() => {
    if (showCustom) setTimeout(() => inputRef.current?.focus(), 100);
  }, [showCustom]);

  const isCustomValue = allowCustomInput && value && !options.includes(value);

  const handleCustomConfirm = () => {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    const result = trimmed.replace(/배$/, "") + "배";
    onSelect(result);
    onClose();
  };

  return (
    <BottomSheet isOpen={visible} onClose={onClose} title={title}>
      <View>
        {options.map((opt) => {
          const isCustomOpt = opt === "직접 입력";
          const sel = isCustomOpt ? (isCustomValue || showCustom) : (!showCustom && opt === value);
          return (
            <View key={opt}>
              <AnimatedPressable
                onPress={() => {
                  if (isCustomOpt && allowCustomInput) { setShowCustom(true); }
                  else { onSelect(opt); onClose(); }
                }}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={{
                  paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
                  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                  backgroundColor: sel ? "rgba(66,97,255,0.1)" : "#FFFFFF", marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{opt}</Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
              {isCustomOpt && showCustom && (
                <View style={{ marginTop: 8, marginBottom: 8, paddingHorizontal: 4, gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <FocusInput
                      ref={inputRef}
                      keyboardType="decimal-pad"
                      placeholder="예: 1.5"
                      placeholderTextColor="#AAB4BF"
                      value={customValue}
                      onChangeText={setCustomValue}
                      onSubmitEditing={handleCustomConfirm}
                      defaultBorderColor="#EBEBEB"
                      style={{
                        flex: 1, height: 52, borderWidth: 1,
                        borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: "#19191B",
                      }}
                    />
                    <Text style={{ fontSize: 15, color: "#AAB4BF" }}>배</Text>
                  </View>
                  <AnimatedPressable
                    onPress={handleCustomConfirm}
                    disabled={!customValue.trim()}
                    scaleAmount={0.97}
                    opacityAmount={0.75}
                    style={{
                      height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center",
                      backgroundColor: customValue.trim() ? "#4261FF" : "#DBDCDF",
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>입력완료</Text>
                  </AnimatedPressable>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const OwnerAttendanceStandardScreen: React.FC<ScreenProps<"OwnerAttendanceStandard">> = ({ navigation }) => {
  const { toast }  = useToast();
  const storeId    = Number(localStorage.getItem("currentStoreId") ?? 0);
  const isOnboarding = !!localStorage.getItem("owner_onboarding_mode");

  const [step, setStep]                   = useState<1 | 2>(1);
  const [distance, setDistance]           = useState("");
  const [lateStandard, setLateStandard]   = useState("");

  // 연장 수당
  const [overtimeMethod, setOvertimeMethod]     = useState("");
  const [overtimeDaily,  setOvertimeDaily]       = useState("지급");   // 하루 8시간 초과
  const [overtimeWeekly, setOvertimeWeekly]      = useState("지급");   // 주 40시간 초과
  const [overtimeRate,   setOvertimeRate]        = useState("1.5배 (법정 기준)");
  const [overtimeUnit,   setOvertimeUnit]        = useState("");

  // 야간 수당
  const [nightMethod, setNightMethod] = useState("");
  const [nightRate,   setNightRate]   = useState("1.5배 (법정 기준)");
  const [nightUnit,   setNightUnit]   = useState("");

  // 휴일 수당
  const [holidayMethod,       setHolidayMethod]       = useState("");
  const [holidayRateUnder8,   setHolidayRateUnder8]   = useState("1.5배 (법정 기준)");
  const [holidayRateOver8,    setHolidayRateOver8]    = useState("2배 (법정 기준)");
  const [holidayUnit,         setHolidayUnit]         = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheet, setSheet] = useState<{ key: string; title: string; options: string[] } | null>(null);

  useEffect(() => {
    if (!storeId) return;
    getCachedStoreInfo(storeId).then((info: any) => {
      const s = info?.setting;
      if (info?.radius)              setDistance(`${info.radius}m`);
      if (s?.late_minutes != null)   setLateStandard(`${s.late_minutes}분`);
      if (s?.has_overtime_pay)       setOvertimeMethod("적용");
      else if (s != null)            setOvertimeMethod("미적용");
      if (s?.overtime_multiplier != null) {
        const v = Number(s.overtime_multiplier);
        setOvertimeRate(v === 1.5 ? "1.5배 (법정 기준)" : v === 2 ? "2배 (법정 기준)" : `${v}배`);
      }
      if (s?.overtime_threshold_minutes != null) setOvertimeUnit(String(s.overtime_threshold_minutes));
      if (s?.has_night_pay)          setNightMethod("적용");
      else if (s != null)            setNightMethod("미적용");
      if (s?.night_multiplier != null) {
        const v = Number(s.night_multiplier);
        setNightRate(v === 1.5 ? "1.5배 (법정 기준)" : v === 2 ? "2배 (법정 기준)" : `${v}배`);
      }
      if (s?.night_threshold_minutes != null) setNightUnit(String(s.night_threshold_minutes));
      if (s?.has_holiday_pay)        setHolidayMethod("적용");
      else if (s != null)            setHolidayMethod("미적용");
      if (s?.holiday_multiplier_under_8h != null) {
        const v = Number(s.holiday_multiplier_under_8h);
        setHolidayRateUnder8(v === 1.5 ? "1.5배 (법정 기준)" : v === 2 ? "2배 (법정 기준)" : `${v}배`);
      }
      if (s?.holiday_multiplier_over_8h != null) {
        const v = Number(s.holiday_multiplier_over_8h);
        setHolidayRateOver8(v === 1.5 ? "1.5배 (법정 기준)" : v === 2 ? "2배 (법정 기준)" : `${v}배`);
      }
      if (s?.holiday_threshold_minutes != null) setHolidayUnit(String(s.holiday_threshold_minutes));
    }).catch((e) => { console.warn(e); toast({ description: "근태 기준을 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]);

  const isStep1Complete = !!(distance && lateStandard);

  const isOvertimePaid = overtimeMethod === "적용";
  const isNightPaid    = nightMethod    === "적용";
  const isHolidayPaid  = holidayMethod  === "적용";

  const isStep2Complete = !!(overtimeMethod && nightMethod && holidayMethod)
    && (!isOvertimePaid || (overtimeRate && overtimeUnit))
    && (!isNightPaid    || (nightRate    && nightUnit))
    && (!isHolidayPaid  || (holidayRateUnder8 && holidayRateOver8 && holidayUnit));

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateAttendanceStandard(storeId, {
        radius:                      extractNumber(distance),
        late_minutes:                extractNumber(lateStandard),
        has_overtime_pay:            isOvertimePaid,
        overtime_after_daily_8h:     overtimeDaily === "지급",
        overtime_after_weekly_40h:   overtimeWeekly === "지급",
        overtime_threshold_minutes:  isOvertimePaid ? Number(overtimeUnit) : null,
        overtime_multiplier:         isOvertimePaid ? extractNumber(overtimeRate) : null,
        has_night_pay:               isNightPaid,
        night_multiplier:            isNightPaid ? extractNumber(nightRate) : null,
        night_threshold_minutes:     isNightPaid ? Number(nightUnit) : null,
        has_holiday_pay:             isHolidayPaid,
        holiday_multiplier_under_8h: isHolidayPaid ? extractNumber(holidayRateUnder8) : null,
        holiday_multiplier_over_8h:  isHolidayPaid ? extractNumber(holidayRateOver8) : null,
        holiday_threshold_minutes:   isHolidayPaid ? Number(holidayUnit) : null,
      });
      invalidateStoreInfo(storeId);
      toast({ description: "근태 기준이 저장되었어요." });
      const onboardingStoreId = localStorage.getItem("owner_onboarding_mode");
      if (onboardingStoreId) {
        localStorage.setItem(`store_setup_done_${onboardingStoreId}`, "1");
        localStorage.removeItem("owner_onboarding_mode");
        navigation.reset({ index: 0, routes: [{ name: "OwnerHome" }] });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "저장에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getSheetValue = (): string => {
    if (!sheet) return "";
    const map: Record<string, string> = {
      distance:          distance,
      late:              lateStandard,
      overtimeRate:      overtimeRate,
      nightRate:         nightRate,
      holidayRateUnder8: holidayRateUnder8,
      holidayRateOver8:  holidayRateOver8,
    };
    return map[sheet.key] ?? "";
  };

  const handleSheetSelect = (v: string) => {
    if (!sheet) return;
    const setMap: Record<string, (s: string) => void> = {
      distance:          setDistance,
      late:              setLateStandard,
      overtimeRate:      setOvertimeRate,
      nightRate:         setNightRate,
      holidayRateUnder8: setHolidayRateUnder8,
      holidayRateOver8:  setHolidayRateOver8,
    };
    setMap[sheet.key]?.(v);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>

      {/* ── 헤더 ── */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          {(!isOnboarding || step === 2) && (
            <AnimatedPressable onPress={() => step === 2 ? setStep(1) : navigation.goBack()} scaleAmount={0.9} opacityAmount={0.7} style={{ padding: 4 }} hitSlop={8}>
              <ChevronLeft size={24} color="#19191B" />
            </AnimatedPressable>
          )}
          {isOnboarding && step === 1 && <View style={{ width: 32 }} />}
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>근태 기준 설정</Text>
        </View>

        {/* 온보딩 전체 진행바 (1행) */}
        {isOnboarding && (
          <>
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 4 }}>
              {["운영시간", "영업파트", "근태기준"].map((label, i) => (
                <View key={label} style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "#4261FF" }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={{ fontSize: 11, color: "#AAB4BF" }}>① 완료</Text>
              <Text style={{ fontSize: 11, color: "#AAB4BF" }}>② 완료</Text>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#4261FF" }}>③ 근태 기준</Text>
            </View>
          </>
        )}

        {/* 화면 내부 진행바 (2행) */}
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 4 }}>
          {([1, 2] as const).map((s) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: s <= step ? "#4261FF" : "#DBDCDF" }} />
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: step === 1 ? "#4261FF" : "#AAB4BF" }}>
            {step === 1 ? "① 출퇴근 · 지각 기준" : "① 완료"}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: "600", color: step === 2 ? "#4261FF" : "#AAB4BF" }}>
            {step === 2 ? "② 연장 · 야간 수당" : "② 수당 기준"}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ══════════════════════════════════
              STEP 1 — 출퇴근 허용거리 + 지각 기준
          ══════════════════════════════════ */}
          {step === 1 && (
            <>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>출퇴근 허용 거리 설정</Text>
              <FieldButton
                label="출퇴근 허용 거리"
                value={distance}
                placeholder="거리 선택"
                onPress={() => setSheet({ key: "distance", title: "출퇴근 허용 거리 설정", options: DISTANCE_OPTIONS })}
                subText="*직원이 매장으로부터 설정한 거리 안에 있을 때만 출퇴근 기록이 가능해요"
              />
              {distance ? <RadiusPreview distance={distance} /> : null}

              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>지각 기준 설정</Text>
                <FieldButton
                  label="지각 기준"
                  value={lateStandard}
                  placeholder="지각 기준 선택"
                  onPress={() => setSheet({ key: "late", title: "지각 기준 설정", options: LATE_OPTIONS })}
                  subText="*출근 시간 기준, 설정한 분이 지난 후 출근하면 지각으로 처리돼요"
                />
              </View>

              {/* 둘 다 선택 시 요약 카드 */}
              {isStep1Complete && (
                <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 14, marginTop: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#4261FF", marginBottom: 6 }}>✓ 설정 확인</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: "#70737B" }}>허용 거리</Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#19191B" }}>{distance}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: "#70737B" }}>지각 기준</Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#19191B" }}>출근 시간 {lateStandard} 초과 시</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ══════════════════════════════════
              STEP 2 — 연장 수당 + 야간 수당 + 휴일 수당
          ══════════════════════════════════ */}
          {step === 2 && (
            <>
              {/* 공통 안내 */}
              <SectionNotice>
                5인 미만 사업장은 연장·야간·휴일 수당 지급 의무가 없어요. 법적 의무 대상이거나 자율 지급하려면{" "}
                <Text style={{ fontWeight: "700", color: "#19191B" }}>적용</Text>으로 설정해 주세요.
              </SectionNotice>

              {/* ── 연장 수당 ── */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 8 }}>연장 수당 기준 설정</Text>

                <ToggleChips
                  label="연장 근무 수당 지급 방식"
                  value={overtimeMethod}
                  options={["적용", "미적용"]}
                  onChange={(v) => {
                    setOvertimeMethod(v);
                    if (v === "미적용") {
                      setOvertimeRate("1.5배 (법정 기준)");
                      setOvertimeUnit("");
                    }
                  }}
                  subText={
                    overtimeMethod === "미적용"
                      ? "✗ 연장 근무를 해도 추가 수당을 지급하지 않아요"
                      : overtimeMethod === "적용"
                      ? "✓ 연장 근무 시 수당이 자동 계산돼요"
                      : undefined
                  }
                />

                {/* 법정 기준 조건 세부 설정 (웹앱과 동일) */}
                {isOvertimePaid && (
                  <View style={{ backgroundColor: "#F7F7F8", borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#EBEBEB" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#4261FF", marginBottom: 4 }}>수당 발생 조건 선택</Text>
                    <Text style={{ fontSize: 12, color: "#70737B", marginBottom: 14, lineHeight: 18 }}>
                      아래 두 조건 중 적용할 항목을 켜주세요. 둘 다 켜도 돼요.
                    </Text>

                    {/* 하루 8시간 */}
                    <ToggleSwitch
                      on={overtimeDaily === "지급"}
                      onToggle={() => setOvertimeDaily(overtimeDaily === "지급" ? "미지급" : "지급")}
                      title="하루 8시간 초과 시"
                      subTitle="예: 9시간 근무 → 초과 1시간에 수당 발생"
                      activeText="✓ 8시간 초과분부터 수당이 자동 계산돼요"
                    />

                    {/* 주 40시간 */}
                    <ToggleSwitch
                      on={overtimeWeekly === "지급"}
                      onToggle={() => setOvertimeWeekly(overtimeWeekly === "지급" ? "미지급" : "지급")}
                      title="주 40시간 초과 시"
                      subTitle="예: 주 43시간 근무 → 초과 3시간에 수당 발생"
                      activeText="✓ 40시간 초과분부터 수당이 자동 계산돼요"
                    />
                  </View>
                )}

                {isOvertimePaid && (
                  <>
                    {/* 수당 지급 비율 */}
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 10 }}>
                        수당 지급 비율 <Text style={{ color: "#FF3D3D" }}>*</Text>
                      </Text>
                      <AnimatedPressable
                        onPress={() => setSheet({ key: "overtimeRate", title: "수당 지급 비율 선택", options: RATE_OPTIONS })}
                        scaleAmount={0.97}
                        opacityAmount={0.8}
                        style={{
                          height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
                          paddingHorizontal: 20, flexDirection: "row", alignItems: "center",
                          justifyContent: "space-between", backgroundColor: "#FFFFFF", marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 15, color: "#19191B" }}>{overtimeRate}</Text>
                        <ChevronDown size={20} color="#AAB4BF" />
                      </AnimatedPressable>
                      <RateExampleBox rate={overtimeRate} />
                    </View>

                    {/* 수당 발생 최소 단위 */}
                    <UnitChips
                      label="수당 발생 최소 단위"
                      value={overtimeUnit}
                      onChange={setOvertimeUnit}
                      hint="몇 분 이상 연장해야 수당이 발생하나요?"
                    />
                  </>
                )}
              </View>

              {/* ── 야간 수당 ── */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 8 }}>야간 수당 기준 설정</Text>
                <ToggleChips
                  label="밤 10시 ~ 새벽 6시 야간 수당 지급"
                  value={nightMethod}
                  options={["적용", "미적용"]}
                  onChange={(v) => { setNightMethod(v); if (v === "미적용") setNightUnit(""); }}
                  subText={
                    nightMethod === "적용"
                      ? "✓ 야간 시간대 근무분에 수당이 자동 계산돼요"
                      : nightMethod === "미적용"
                      ? "✗ 야간 시간대 근무에도 추가 수당이 지급되지 않아요"
                      : undefined
                  }
                />
                {isNightPaid && (
                  <>
                    {/* 수당 지급 비율 */}
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 10 }}>
                        수당 지급 비율 <Text style={{ color: "#FF3D3D" }}>*</Text>
                      </Text>
                      <AnimatedPressable
                        onPress={() => setSheet({ key: "nightRate", title: "야간 수당 비율 선택", options: RATE_OPTIONS })}
                        scaleAmount={0.97}
                        opacityAmount={0.8}
                        style={{
                          height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
                          paddingHorizontal: 20, flexDirection: "row", alignItems: "center",
                          justifyContent: "space-between", backgroundColor: "#FFFFFF", marginBottom: 6,
                        }}
                      >
                        <Text style={{ fontSize: 15, color: "#19191B" }}>{nightRate}</Text>
                        <ChevronDown size={20} color="#AAB4BF" />
                      </AnimatedPressable>
                      <Text style={{ fontSize: 13, color: "#AAB4BF" }}>
                        ✓ 야간 근무 1시간당 시급의 {nightRate.replace(" (법정 기준)", "")}를 추가 지급해요
                      </Text>
                    </View>

                    <UnitChips
                      label="수당 발생 최소 단위"
                      value={nightUnit}
                      onChange={setNightUnit}
                      hint="몇 분 이상 야간 근무해야 수당이 발생하나요?"
                    />
                  </>
                )}
              </View>

              {/* ── 휴일 수당 ── */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 8 }}>휴일 수당 기준 설정</Text>
                <ToggleChips
                  label="휴일 근무 수당 지급"
                  value={holidayMethod}
                  options={["적용", "미적용"]}
                  onChange={(v) => { setHolidayMethod(v); if (v === "미적용") setHolidayUnit(""); }}
                  subText={
                    holidayMethod === "적용"
                      ? "✓ 휴일 근무분에 수당이 자동 계산돼요"
                      : holidayMethod === "미적용"
                      ? "✗ 휴일 근무에도 추가 수당이 지급되지 않아요"
                      : undefined
                  }
                />
                {isHolidayPaid && (
                  <>
                    {/* 수당 지급 비율 — 8시간 이내 / 8시간 초과 구분 (웹앱과 동일) */}
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 10 }}>
                        수당 지급 비율 <Text style={{ color: "#FF3D3D" }}>*</Text>
                      </Text>

                      {/* 8시간 이내 */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: "#70737B", width: 88, flexShrink: 0 }}>8시간 이내</Text>
                        <AnimatedPressable
                          onPress={() => setSheet({ key: "holidayRateUnder8", title: "휴일 수당 비율 (8시간 이내)", options: RATE_OPTIONS_BASIC })}
                          scaleAmount={0.97}
                          opacityAmount={0.8}
                          style={{
                            flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
                            paddingHorizontal: 16, flexDirection: "row", alignItems: "center",
                            justifyContent: "space-between", backgroundColor: "#FFFFFF",
                          }}
                        >
                          <Text style={{ fontSize: 14, color: "#19191B" }}>{holidayRateUnder8}</Text>
                          <ChevronDown size={16} color="#AAB4BF" />
                        </AnimatedPressable>
                      </View>

                      {/* 8시간 초과 */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: "#70737B", width: 88, flexShrink: 0 }}>8시간 초과</Text>
                        <AnimatedPressable
                          onPress={() => setSheet({ key: "holidayRateOver8", title: "휴일 수당 비율 (8시간 초과)", options: RATE_OPTIONS_BASIC })}
                          scaleAmount={0.97}
                          opacityAmount={0.8}
                          style={{
                            flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
                            paddingHorizontal: 16, flexDirection: "row", alignItems: "center",
                            justifyContent: "space-between", backgroundColor: "#FFFFFF",
                          }}
                        >
                          <Text style={{ fontSize: 14, color: "#19191B" }}>{holidayRateOver8}</Text>
                          <ChevronDown size={16} color="#AAB4BF" />
                        </AnimatedPressable>
                      </View>

                      <Text style={{ fontSize: 13, color: "#AAB4BF" }}>
                        ✓ 8시간 이내 {holidayRateUnder8.replace(" (법정 기준)", "")}, 8시간 초과분은 {holidayRateOver8.replace(" (법정 기준)", "")} 지급해요
                      </Text>
                    </View>

                    <UnitChips
                      label="수당 발생 최소 단위"
                      value={holidayUnit}
                      onChange={setHolidayUnit}
                      hint="몇 분 이상 휴일 근무해야 수당이 발생하나요?"
                    />
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 하단 버튼 ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: "#F7F7F8", backgroundColor: "#FFFFFF" }}>
        {step === 1 ? (
          <AnimatedPressable
            onPress={() => isStep1Complete && setStep(2)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ height: 56, borderRadius: 16, backgroundColor: isStep1Complete ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>다음</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            onPress={() => isStep2Complete && setConfirmOpen(true)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ height: 56, borderRadius: 16, backgroundColor: isStep2Complete ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>저장하기</Text>
          </AnimatedPressable>
        )}
      </View>

      {/* OptionSheet — 거리/지각/배율 선택 */}
      <OptionSheet
        visible={sheet !== null}
        title={sheet?.title ?? ""}
        options={sheet?.options ?? []}
        value={getSheetValue()}
        onSelect={handleSheetSelect}
        onClose={() => setSheet(null)}
        allowCustomInput={sheet?.options?.includes("직접 입력") ?? false}
      />

      {/* 저장 확인 팝업 */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setConfirmOpen(false)}
        >
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ width: "85%", maxWidth: 340, backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 4 }}>근태 기준 설정 저장</Text>
            <Text style={{ fontSize: 13, color: "#70737B", textAlign: "center", marginBottom: 16 }}>아래 내용으로 저장할게요. 확인해주세요.</Text>

            <View style={{ backgroundColor: "#F7F8FF", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 20 }}>
              <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 6 }}>출퇴근 기준</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>허용 거리</Text>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B" }}>{distance}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>지각 기준</Text>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B" }}>출근 {lateStandard} 초과 시</Text>
                </View>
              </View>

              <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 6 }}>연장 수당</Text>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B" }}>
                  {overtimeMethod === "적용"
                    ? `${overtimeRate.replace(" (법정 기준)", "")} · ${unitLabel(overtimeUnit)} 이상 발생`
                    : "미적용"}
                </Text>
              </View>

              <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 6 }}>야간 수당</Text>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B" }}>
                  {nightMethod === "적용"
                    ? `${nightRate.replace(" (법정 기준)", "")} · ${unitLabel(nightUnit)} 이상 발생`
                    : "미적용"}
                </Text>
              </View>

              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 6 }}>휴일 수당</Text>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B" }}>
                  {holidayMethod === "적용"
                    ? `8h이내 ${holidayRateUnder8.replace(" (법정 기준)", "")} · 8h초과 ${holidayRateOver8.replace(" (법정 기준)", "")} · ${unitLabel(holidayUnit)} 이상`
                    : "미적용"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <AnimatedPressable
                onPress={() => setConfirmOpen(false)}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: "#EBEBEB", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { setConfirmOpen(false); handleSave(); }}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>저장하기</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const BASE_R = 90;
const SCALE_MAP: Record<string, number> = { "10m": 0.25, "50m": 0.40, "100m": 0.58, "200m": 0.78, "300m": 0.90, "500m": 1.0 };
const MINI_RADII: Record<string, number> = { "10m": 7, "50m": 11, "100m": 16, "200m": 22, "300m": 27, "500m": 33 };
const DISTANCE_LABELS: Record<string, string> = {
  "10m":  "매장 바로 앞에서만 출퇴근 가능",
  "50m":  "매장 근처 어디서나 출퇴근 가능",
  "100m": "넓은 범위에서 출퇴근 가능",
  "200m": "더 넓은 범위에서 출퇴근 가능",
  "300m": "도보 3~5분 범위에서 출퇴근 가능",
  "500m": "가장 넓은 범위로 설정됨",
};

// 직원 점 3개: 내부(✓), 경계 근처(✓), 외부(✕)
const P0_ANGLE = -Math.PI / 4;    // -45°  upper-right
const P0_RATIO = 0.48;
const P1_ANGLE = (2 * Math.PI) / 3; // 120°  lower-left
const P1_RATIO = 0.85;
const P2_ANGLE = Math.PI / 6;     // 30°   lower-right (outside)
const P2_RATIO = 1.25;

const RadiusPreview: React.FC<{ distance: string }> = ({ distance }) => {
  const circleScale = useSharedValue(SCALE_MAP[distance] ?? 1.0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);

  // distance 바뀌면 spring으로 원 크기 전환
  useEffect(() => {
    circleScale.value = withSpring(SCALE_MAP[distance] ?? 1.0, { damping: 14, stiffness: 120 });
  }, [distance]);

  // 두 맥동 링 (위상 차 900ms)
  useEffect(() => {
    const loop = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: RAEasing.out(RAEasing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    pulse1.value = loop;
    pulse2.value = withDelay(900, loop);
  }, []);

  // 메인 원 크기
  const circleStyle = useAnimatedStyle(() => {
    const r = BASE_R * circleScale.value;
    return {
      width: r * 2, height: r * 2, borderRadius: r,
      transform: [{ translateX: -r }, { translateY: -r }],
    };
  });

  // 맥동 링 1
  const ring1Style = useAnimatedStyle(() => {
    const r = BASE_R * circleScale.value;
    return {
      width: r * 2, height: r * 2, borderRadius: r,
      opacity: 0.35 * (1 - pulse1.value),
      transform: [{ translateX: -r }, { translateY: -r }, { scale: 1 + 0.28 * pulse1.value }],
    };
  });

  // 맥동 링 2
  const ring2Style = useAnimatedStyle(() => {
    const r = BASE_R * circleScale.value;
    return {
      width: r * 2, height: r * 2, borderRadius: r,
      opacity: 0.18 * (1 - pulse2.value),
      transform: [{ translateX: -r }, { translateY: -r }, { scale: 1 + 0.48 * pulse2.value }],
    };
  });

  // 직원 점 3개 — hooks in loops 금지이므로 개별 선언
  const p0Style = useAnimatedStyle(() => {
    const r = BASE_R * circleScale.value;
    return { transform: [{ translateX: Math.cos(P0_ANGLE) * r * P0_RATIO - 11 }, { translateY: Math.sin(P0_ANGLE) * r * P0_RATIO - 11 }] };
  });
  const p1Style = useAnimatedStyle(() => {
    const r = BASE_R * circleScale.value;
    return { transform: [{ translateX: Math.cos(P1_ANGLE) * r * P1_RATIO - 11 }, { translateY: Math.sin(P1_ANGLE) * r * P1_RATIO - 11 }] };
  });
  const p2Style = useAnimatedStyle(() => {
    const r = BASE_R * circleScale.value;
    return { transform: [{ translateX: Math.cos(P2_ANGLE) * r * P2_RATIO - 11 }, { translateY: Math.sin(P2_ANGLE) * r * P2_RATIO - 11 }] };
  });

  const dotStyles  = [p0Style, p1Style, p2Style];
  const dotConfigs = [
    { id: "p0", canIn: true  },
    { id: "p1", canIn: true  },
    { id: "p2", canIn: false },
  ];

  return (
    <View style={{ backgroundColor: "#F7F8FF", borderRadius: 16, padding: 16, marginTop: 12, marginBottom: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF", marginBottom: 2, textAlign: "center" }}>
        허용 반경 {distance} 미리보기
      </Text>
      <Text style={{ fontSize: 11, color: "#AAB4BF", marginBottom: 4, textAlign: "center" }}>
        {DISTANCE_LABELS[distance] ?? ""}
      </Text>

      {/* 메인 원 + 맥동 링 + 직원 점 캔버스 */}
      <View style={{ alignItems: "center", justifyContent: "center", height: 272 }}>
        {/* 맥동 링 2 (바깥) */}
        <Animated.View style={[{ position: "absolute", left: "50%", top: "50%", borderWidth: 1.5, borderColor: "#4261FF" }, ring2Style]} />
        {/* 맥동 링 1 (안쪽) */}
        <Animated.View style={[{ position: "absolute", left: "50%", top: "50%", borderWidth: 2, borderColor: "#4261FF" }, ring1Style]} />
        {/* 메인 원 */}
        <Animated.View style={[{
          position: "absolute", left: "50%", top: "50%",
          backgroundColor: "rgba(66,97,255,0.08)",
          borderWidth: 2.5, borderColor: "#4261FF",
          alignItems: "center", justifyContent: "center",
        }, circleStyle]}>
          {/* 매장 아이콘 */}
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", elevation: 4 }}>
            <Store size={16} color="#FFFFFF" strokeWidth={2} />
          </View>
        </Animated.View>

        {/* 직원 점 3개 */}
        {dotConfigs.map((cfg, i) => (
          <Animated.View
            key={cfg.id}
            style={[{ position: "absolute", left: "50%", top: "50%", alignItems: "center" }, dotStyles[i]]}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: cfg.canIn ? "#1EDC83" : "#FF5959",
              alignItems: "center", justifyContent: "center",
              borderWidth: 2, borderColor: "#FFFFFF", elevation: 3,
            }}>
              <Text style={{ fontSize: 10, color: "#FFFFFF", fontWeight: "700" }}>{cfg.canIn ? "✓" : "✕"}</Text>
            </View>
            <View style={{ backgroundColor: cfg.canIn ? "#1EDC83" : "#FF5959", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#FFFFFF" }}>{cfg.canIn ? "출근 가능" : "출근 불가"}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* 거리별 비교 */}
      <View style={{ borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingTop: 12, marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: "#70737B", marginBottom: 10, textAlign: "center" }}>거리별 비교</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" }}>
          {(["10m", "50m", "100m", "200m", "300m", "500m"] as const).map((d) => {
            const r = MINI_RADII[d];
            const sel = d === distance;
            return (
              <View key={d} style={{ alignItems: "center", gap: 6 }}>
                <View style={{
                  width: r * 2, height: r * 2, borderRadius: r,
                  backgroundColor: sel ? "rgba(66,97,255,0.15)" : "rgba(66,97,255,0.05)",
                  borderWidth: sel ? 2 : 1.5,
                  borderColor: sel ? "#4261FF" : "#C0C8FF",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: sel ? "#4261FF" : "#C0C8FF" }} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: sel ? "700" : "400", color: sel ? "#4261FF" : "#AAB4BF" }}>{d}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 범례 */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#1EDC83" }} />
          <Text style={{ fontSize: 10, color: "#70737B" }}>출근 가능 범위</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5959" }} />
          <Text style={{ fontSize: 10, color: "#70737B" }}>출근 불가 범위</Text>
        </View>
      </View>
    </View>
  );
};

export default OwnerAttendanceStandardScreen;
