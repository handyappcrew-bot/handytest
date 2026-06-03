import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { updateStoreSetting } from "@/api/owner";
import { getCachedStoreInfo, invalidateStoreInfo } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import AnimatedPressable from "@/components/AnimatedPressable";
import type { ScreenProps } from "@/navigation/types";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const fieldStyle = {
  height: 52,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#DBDCDF",
  paddingHorizontal: 20,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  backgroundColor: "#FFFFFF",
  outline: "none",
  boxShadow: "none",
} as const;

const OwnerStoreHoursScreen: React.FC<ScreenProps<"OwnerStoreHours">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  // 온보딩 플로우: 초기 화면(뒤로 갈 곳 없음)일 때만 활성화
  // 매장관리(OwnerStoreInfo)에서 진입 시에는 canGoBack() = true → 비활성
  const isOnboarding = !!localStorage.getItem("owner_onboarding_mode") && !navigation.canGoBack();
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [hasHoliday, setHasHoliday] = useState("없음");
  const [holidayCycle, setHolidayCycle] = useState("");
  const [biweeklyWeek, setBiweeklyWeek] = useState("");
  const [holidayDays, setHolidayDays] = useState<string[]>([]);
  const [drawerType, setDrawerType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    getCachedStoreInfo(storeId)
      .then((info: any) => {
        if (info?.setting?.open_time) setOpenTime(info.setting.open_time.slice(0, 5));
        if (info?.setting?.close_time) setCloseTime(info.setting.close_time.slice(0, 5));
        if (info?.setting?.is_fixed_holiday != null)
          setHasHoliday(info.setting.is_fixed_holiday ? "있음" : "없음");
        const rawCycle: string = info?.setting?.holiday_cycle ?? "";
        if (rawCycle.startsWith("격주")) {
          setHolidayCycle("격주");
          const weekPart = rawCycle.split("-")[1];
          if (weekPart) setBiweeklyWeek(weekPart);
        } else if (rawCycle) {
          setHolidayCycle(rawCycle);
        }
        if (Array.isArray(info?.setting?.holiday_days))
          setHolidayDays(info.setting.holiday_days);
      })
      .catch((e) => { console.warn(e); toast({ description: "매장 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]);

  const isComplete =
    openTime &&
    closeTime &&
    hasHoliday &&
    (hasHoliday === "없음" ||
      (holidayCycle &&
        (holidayCycle !== "격주" || biweeklyWeek) &&
        holidayDays.length > 0));

  const handleSave = async () => {
    if (submitting || !isComplete) return;
    setSubmitting(true);
    try {
      await updateStoreSetting(storeId, {
        open_time: openTime,
        close_time: closeTime,
        is_fixed_holiday: hasHoliday === "있음",
        holiday_cycle: hasHoliday === "있음"
          ? (holidayCycle === "격주" && biweeklyWeek ? `격주-${biweeklyWeek}` : holidayCycle)
          : "",
        holiday_days: hasHoliday === "있음" ? holidayDays : [],
      });
      invalidateStoreInfo(storeId);
      toast({ description: "영업시간이 저장되었어요." });
      navigation.navigate("OwnerStoreHoursParts");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const is24h = openTime === "00:00" && closeTime === "00:00";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageLayout
        headerTitle="운영 시간 설정"
        hideBackButton={isOnboarding}
        progressStep={isOnboarding ? { current: 1, total: 3 } : undefined}
        footer={
          <AnimatedPressable
            onPress={isComplete ? handleSave : undefined}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 16,
              backgroundColor: isComplete ? "#4261FF" : "#DBDCDF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              다음
            </Text>
          </AnimatedPressable>
        }
      >
        {/* 진행 표시바 */}
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingTop: 0, paddingBottom: 8 }}>
          <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "#4261FF" }} />
          <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "#DBDCDF" }} />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingBottom: 10,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF" }}>
            ① 영업 시간 · 휴무일
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#AAB4BF" }}>② 영업 파트</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 영업 시간 섹션 */}
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>
            영업 시간
          </Text>

          <Field label="매장 오픈 시간" required>
            <AnimatedPressable
              onPress={() => setDrawerType("openTime")}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={[fieldStyle, { marginTop: 16 }]}
            >
              <Text style={{ fontSize: 15, color: openTime ? "#19191B" : "#AAB4BF" }}>
                {openTime || "오픈 시간 입력"}
              </Text>
              <ChevronDown size={20} color="#70737B" />
            </AnimatedPressable>
          </Field>

          <Field label="매장 마감 시간" required>
            <AnimatedPressable
              onPress={() => !is24h && setDrawerType("closeTime")}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={[fieldStyle, { marginTop: 16, backgroundColor: is24h ? "#F7F8FA" : "#FFFFFF" }]}
            >
              <Text style={{ fontSize: 15, color: is24h ? "#AAB4BF" : closeTime ? "#19191B" : "#AAB4BF" }}>
                {closeTime || "마감 시간 입력"}
              </Text>
              <ChevronDown size={20} color="#70737B" />
            </AnimatedPressable>
          </Field>

          {/* 24시간 영업 토글 */}
          <View style={{ marginTop: -10, marginBottom: 30, gap: 8 }}>
            <AnimatedPressable
              onPress={() => {
                if (is24h) {
                  setOpenTime("09:00");
                  setCloseTime("22:00");
                } else {
                  setOpenTime("00:00");
                  setCloseTime("00:00");
                }
              }}
              scaleAmount={0.96}
              opacityAmount={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 100,
                borderWidth: 1.5,
                borderColor: is24h ? "#4261FF" : "#DBDCDF",
                backgroundColor: is24h ? "#EEF1FF" : "#FFFFFF",
              }}
            >
              {is24h && <Check size={14} color="#4261FF" />}
              <Text style={{ fontSize: 13, fontWeight: "600", color: is24h ? "#4261FF" : "#70737B" }}>
                24시간 영업
              </Text>
            </AnimatedPressable>
            <Text style={{ fontSize: 13, color: "#AAB4BF", lineHeight: 19 }}>
              *24시간 운영하는 매장은 위 버튼을 선택해 주세요
            </Text>
          </View>

          {/* 고정 휴무일 섹션 */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#19191B",
              marginBottom: 16,
              marginTop: 30,
            }}
          >
            고정 휴무일
          </Text>

          <Field label="고정 휴무일 여부" required>
            <AnimatedPressable
              onPress={() => setDrawerType("hasHoliday")}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={[fieldStyle, { marginTop: 16 }]}
            >
              <Text style={{ fontSize: 15, color: hasHoliday ? "#19191B" : "#AAB4BF" }}>
                {hasHoliday || "고정 휴무일 여부 선택"}
              </Text>
              <ChevronDown size={20} color="#70737B" />
            </AnimatedPressable>
          </Field>

          {hasHoliday === "있음" && (
            <>
              <Field label="고정 휴무일 주기" required>
                <AnimatedPressable
                  onPress={() => setDrawerType("holidayCycle")}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={[fieldStyle, { marginTop: 16 }]}
                >
                  <Text style={{ fontSize: 15, color: holidayCycle ? "#19191B" : "#AAB4BF" }}>
                    {holidayCycle || "주기 선택"}
                  </Text>
                  <ChevronDown size={20} color="#70737B" />
                </AnimatedPressable>
              </Field>

              {holidayCycle === "격주" && (
                <Field label="격주 주차 선택" required>
                  <AnimatedPressable
                    onPress={() => setDrawerType("biweeklyWeek")}
                    scaleAmount={0.97}
                    opacityAmount={0.8}
                    style={[fieldStyle, { marginTop: 16 }]}
                  >
                    <Text style={{ fontSize: 15, color: biweeklyWeek ? "#19191B" : "#AAB4BF" }}>
                      {biweeklyWeek || "1,3주차 또는 2,4주차 선택"}
                    </Text>
                    <ChevronDown size={20} color="#70737B" />
                  </AnimatedPressable>
                </Field>
              )}

              <Field label="고정 휴무일 요일" required>
                <AnimatedPressable
                  onPress={() => setDrawerType("holidayDays")}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={[fieldStyle, { marginTop: 16 }]}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: holidayDays.length > 0 ? "#19191B" : "#AAB4BF",
                    }}
                  >
                    {holidayDays.length > 0 ? holidayDays.join(", ") : "휴무일 요일 선택"}
                  </Text>
                  <ChevronDown size={20} color="#70737B" />
                </AnimatedPressable>
              </Field>
            </>
          )}
        </ScrollView>
      </PageLayout>

      {/* 오픈 시간 선택 */}
      <BottomSheet
        isOpen={drawerType === "openTime"}
        onClose={() => setDrawerType(null)}
        title="매장 오픈 시간 선택"
      >
        <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => {
            const sel = openTime === t;
            return (
              <AnimatedPressable
                key={t}
                onPress={() => {
                  setOpenTime(t);
                  setDrawerType(null);
                }}
                scaleAmount={0.94}
                opacityAmount={0.8}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: sel ? "#F0F4FF" : "#FFFFFF",
                  marginBottom: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    color: sel ? "#4261FF" : "#19191B",
                    fontWeight: sel ? "500" : "400",
                  }}
                >
                  {t}
                </Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* 마감 시간 선택 */}
      <BottomSheet
        isOpen={drawerType === "closeTime"}
        onClose={() => setDrawerType(null)}
        title="매장 마감 시간 선택"
      >
        <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => {
            const sel = closeTime === t;
            const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
            const isDisabled = !is24h && !!openTime && toMin(t) <= toMin(openTime);
            return (
              <AnimatedPressable
                key={t}
                onPress={() => {
                  if (isDisabled) return;
                  setCloseTime(t);
                  setDrawerType(null);
                }}
                scaleAmount={isDisabled ? 1 : 0.94}
                opacityAmount={isDisabled ? 1 : 0.8}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: sel ? "#F0F4FF" : "#FFFFFF",
                  marginBottom: 2,
                  opacity: isDisabled ? 0.3 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    color: sel ? "#4261FF" : "#19191B",
                    fontWeight: sel ? "500" : "400",
                  }}
                >
                  {t}
                </Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* 고정 휴무일 여부 */}
      <BottomSheet
        isOpen={drawerType === "hasHoliday"}
        onClose={() => setDrawerType(null)}
        title="고정 휴무일 여부 선택하기"
      >
        <View style={{ paddingBottom: 8 }}>
          {["있음", "없음"].map((opt) => {
            const sel = hasHoliday === opt;
            return (
              <AnimatedPressable
                key={opt}
                onPress={() => {
                  setHasHoliday(opt);
                  if (opt === "없음") {
                    setHolidayCycle("");
                    setHolidayDays([]);
                  }
                  setDrawerType(null);
                }}
                scaleAmount={0.94}
                opacityAmount={0.8}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: sel ? "#F0F4FF" : "#FFFFFF",
                  marginBottom: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    color: sel ? "#4261FF" : "#19191B",
                    fontWeight: sel ? "500" : "400",
                  }}
                >
                  {opt}
                </Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* 주기 선택 */}
      <BottomSheet
        isOpen={drawerType === "holidayCycle"}
        onClose={() => setDrawerType(null)}
        title="고정 휴무일 주기 선택하기"
      >
        <View style={{ paddingBottom: 8 }}>
          {["매주", "격주"].map((opt) => {
            const sel = holidayCycle === opt;
            return (
              <AnimatedPressable
                key={opt}
                onPress={() => {
                  setHolidayCycle(opt);
                  if (opt !== "격주") setBiweeklyWeek("");
                  setDrawerType(null);
                }}
                scaleAmount={0.94}
                opacityAmount={0.8}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: sel ? "#F0F4FF" : "#FFFFFF",
                  marginBottom: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    color: sel ? "#4261FF" : "#19191B",
                    fontWeight: sel ? "500" : "400",
                  }}
                >
                  {opt}
                </Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* 격주 주차 선택 */}
      <BottomSheet
        isOpen={drawerType === "biweeklyWeek"}
        onClose={() => setDrawerType(null)}
        title="격주 주차 선택하기"
      >
        <View style={{ paddingBottom: 8 }}>
          {["1,3주차", "2,4주차"].map((opt) => {
            const sel = biweeklyWeek === opt;
            return (
              <AnimatedPressable
                key={opt}
                onPress={() => {
                  setBiweeklyWeek(opt);
                  setDrawerType(null);
                }}
                scaleAmount={0.94}
                opacityAmount={0.8}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: sel ? "#F0F4FF" : "#FFFFFF",
                  marginBottom: 2,
                }}
              >
                <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>
                  {opt}
                </Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* 요일 선택 */}
      <BottomSheet
        isOpen={drawerType === "holidayDays"}
        onClose={() => setDrawerType(null)}
        title="고정 휴무일 요일 선택하기"
      >
        <DayPickerContent
          selectedDays={holidayDays}
          onConfirm={(days) => {
            setHolidayDays(days);
            setDrawerType(null);
          }}
          onClose={() => setDrawerType(null)}
        />
      </BottomSheet>
    </KeyboardAvoidingView>
  );
};

const DayPickerContent: React.FC<{
  selectedDays: string[];
  onConfirm: (days: string[]) => void;
  onClose: () => void;
}> = ({ selectedDays, onConfirm, onClose }) => {
  const [localDays, setLocalDays] = useState<string[]>(selectedDays);

  const toggleDay = (day: string) => {
    setLocalDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const hasSelection = localDays.length > 0;

  return (
    <View style={{ paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {DAYS.map((day) => {
          const sel = localDays.includes(day);
          return (
            <AnimatedPressable
              key={day}
              onPress={() => toggleDay(day)}
              scaleAmount={0.94}
              opacityAmount={0.8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: sel ? "#4261FF" : "#EBEBEB",
                backgroundColor: sel ? "#4261FF" : "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: sel ? "#FFFFFF" : "#19191B",
                }}
              >
                {day}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <AnimatedPressable
          onPress={onClose}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: "#F0F4FF",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "500", color: "#4261FF" }}>이전</Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={hasSelection ? () => onConfirm(localDays) : undefined}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: hasSelection ? "#4261FF" : "#DBDCDF",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            선택 완료
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <View style={{ marginBottom: 30 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>
      {label}
      {required ? <Text style={{ color: "#FF3D3D" }}> *</Text> : null}
    </Text>
    {children}
  </View>
);

export default OwnerStoreHoursScreen;
