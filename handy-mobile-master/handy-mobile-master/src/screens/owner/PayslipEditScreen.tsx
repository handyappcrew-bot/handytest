import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView, KeyboardAvoidingView,
  Platform, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { formatPhone } from "@/utils/valid";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FocusInput from "@/components/FocusInput";
import { getPayslipDetail, updatePayslip } from "@/api/owner";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

// ─── 타입 ────────────────────────────────────────────────────────

interface FormState {
  base_pay: string;
  overtime_pay: string;
  night_pay: string;
  holiday_pay: string;
  weekly_leave_pay: string;
  other_allowance: string;
  income_tax: string;
  local_income_tax: string;
  national_pension: string;
  health_insurance: string;
  long_term_care: string;
  employment_insurance: string;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────

const toFormatted = (raw: string) => {
  const num = parseInt(raw.replace(/,/g, "").replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? "0" : num.toLocaleString();
};

const fmt = (n: any) => (n ?? 0).toLocaleString();
const parse = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
const parseAmt = (s: string) => parseInt(s.replace(/,/g, ""), 10) || 0;

// ─── 헬퍼 컴포넌트 ───────────────────────────────────────────────

const Divider: React.FC<{ thick?: boolean }> = ({ thick }) => (
  <View style={{ height: thick ? 12 : 1, backgroundColor: thick ? "#F7F7F8" : "#F0F0F0", marginVertical: thick ? 0 : 4 }} />
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36, marginBottom: 16 }}>
    {children}
  </Text>
);

const SubSectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32, marginBottom: 10, marginTop: 4 }}>
    {children}
  </Text>
);

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 114, flexShrink: 0, letterSpacing: -0.32 }}>
      {label}
    </Text>
    <View style={{ flex: 1 }}>
      {typeof children === "string" ? (
        <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  </View>
);

// ─── 메인 화면 ───────────────────────────────────────────────────

const PayslipEditScreen: React.FC<ScreenProps<"PayslipEdit">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const { payslipId } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const [p, setP] = useState<any>(null);
  const [form, setForm] = useState<FormState>({
    base_pay: "", overtime_pay: "", night_pay: "", holiday_pay: "",
    weekly_leave_pay: "", other_allowance: "",
    income_tax: "", local_income_tax: "",
    national_pension: "", health_insurance: "", long_term_care: "", employment_insurance: "",
  });
  const [initialForm, setInitialForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeSheet, setActiveSheet] = useState<keyof FormState | null>(null);
  const [sheetValue, setSheetValue] = useState("0");
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    if (!storeId || !payslipId) return;
    getPayslipDetail(storeId, payslipId).then((data: any) => {
      setP(data);
      const loaded: FormState = {
        base_pay: fmt(data.base_pay),
        overtime_pay: fmt(data.overtime_pay),
        night_pay: fmt(data.night_pay),
        holiday_pay: fmt(data.holiday_pay),
        weekly_leave_pay: fmt(data.weekly_leave_pay),
        other_allowance: fmt(data.other_allowance),
        income_tax: fmt(data.income_tax),
        local_income_tax: fmt(data.local_income_tax),
        national_pension: fmt(data.national_pension),
        health_insurance: fmt(data.health_insurance),
        long_term_care: fmt(data.long_term_care),
        employment_insurance: fmt(data.employment_insurance),
      };
      setForm(loaded);
      setInitialForm(loaded);
    }).catch((e) => { console.warn(e); toast({ description: "급여명세서 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId, payslipId]);

  const handleSave = async () => {
    setSaveConfirmOpen(false);
    if (submitting) return;
    setSubmitting(true);
    try {
      const tp =
        parse(form.base_pay) + parse(form.overtime_pay) + parse(form.night_pay) +
        parse(form.holiday_pay) + parse(form.weekly_leave_pay) + parse(form.other_allowance);
      const td =
        parse(form.income_tax) + parse(form.local_income_tax) +
        parse(form.national_pension) + parse(form.health_insurance) +
        parse(form.long_term_care) + parse(form.employment_insurance);
      await updatePayslip(storeId, payslipId, {
        base_pay: parse(form.base_pay),
        overtime_pay: parse(form.overtime_pay),
        night_pay: parse(form.night_pay),
        holiday_pay: parse(form.holiday_pay),
        weekly_leave_pay: parse(form.weekly_leave_pay),
        other_allowance: parse(form.other_allowance),
        income_tax: parse(form.income_tax),
        local_income_tax: parse(form.local_income_tax),
        national_pension: parse(form.national_pension),
        health_insurance: parse(form.health_insurance),
        long_term_care: parse(form.long_term_care),
        employment_insurance: parse(form.employment_insurance),
        total_pay: tp,
        total_deduction: td,
        net_pay: tp - td,
      });
      toast({ description: "급여명세서가 수정되었어요." });
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "수정에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty = initialForm
    ? Object.keys(form).some((k) => form[k as keyof FormState] !== initialForm[k as keyof FormState])
    : false;

  const workActualHours = p?.actual_work_minutes != null ? Math.round(p.actual_work_minutes / 60 * 10) / 10 : null;
  const workOvertimeHours = p?.overtime_minutes != null ? Math.round(p.overtime_minutes / 60 * 10) / 10 : null;
  const workNightHours = p?.night_minutes != null ? Math.round(p.night_minutes / 60 * 10) / 10 : null;
  const workHolidayHours = p?.holiday_minutes != null ? Math.round(p.holiday_minutes / 60 * 10) / 10 : null;
  const workWeeklyLeaveHours = p?.weekly_leave_minutes != null ? Math.round(p.weekly_leave_minutes / 60 * 10) / 10 : null;

  const handleBack = () => {
    if (isDirty) setCancelConfirmOpen(true);
    else navigation.goBack();
  };

  const openSheet = (key: keyof FormState) => {
    setActiveSheet(key);
    setSheetValue(toFormatted(form[key]));
  };

  const totalPay =
    parseAmt(form.base_pay) + parseAmt(form.overtime_pay) + parseAmt(form.night_pay) +
    parseAmt(form.holiday_pay) + parseAmt(form.weekly_leave_pay) + parseAmt(form.other_allowance);
  const incomeTaxTotal = parseAmt(form.income_tax) + parseAmt(form.local_income_tax);
  const socialTotal =
    parseAmt(form.national_pension) + parseAmt(form.health_insurance) +
    parseAmt(form.long_term_care) + parseAmt(form.employment_insurance);
  const totalDeduction = incomeTaxTotal + socialTotal;
  const netPay = totalPay - totalDeduction;

  // 바텀시트 메타데이터
  const sheetMeta: Record<keyof FormState, { label: string; subNote?: string }> = {
    base_pay: { label: "기본급" },
    overtime_pay: { label: "연장수당", subNote: "시급 × 1.5배 (법정 기준)" },
    night_pay: { label: "야간수당", subNote: "시급 × 0.5배 추가 (법정 기준)" },
    holiday_pay: { label: "휴일수당", subNote: "시급 × 1.5배 (8시간 이내, 법정 기준)" },
    weekly_leave_pay: { label: "주휴수당" },
    other_allowance: { label: "기타 수당 (인센티브)" },
    income_tax: { label: "소득세", subNote: "근로자 부담 3%" },
    local_income_tax: { label: "지방소득세", subNote: "소득세의 10%" },
    national_pension: { label: "국민연금", subNote: "근로자 부담 4.5%" },
    health_insurance: { label: "건강보험", subNote: "근로자 부담 3.545%" },
    long_term_care: { label: "장기요양보험", subNote: "건강보험료의 12.81%" },
    employment_insurance: { label: "고용보험", subNote: "근로자 부담 0.9%" },
  };

  // ── 수정 가능한 행 컴포넌트 ──
  const EditRow: React.FC<{
    fieldKey: keyof FormState;
    label: React.ReactNode;
    subNote?: string;
  }> = ({ fieldKey, label, subNote }) => {
    const value = form[fieldKey];
    const isChanged = initialForm ? value !== initialForm[fieldKey] : false;
    const [pressed, setPressed] = useState(false);

    const borderColor = pressed ? "#4261FF" : isChanged ? "#FF8F00" : "#DBDCDF";
    const borderWidth = pressed || isChanged ? 2 : 1;

    return (
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 114, flexShrink: 0, paddingTop: 14 }}>
            {typeof label === "string" ? (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", letterSpacing: -0.32 }}>{label}</Text>
            ) : (
              label
            )}
          </View>
          <AnimatedPressable
            onPress={() => openSheet(fieldKey)}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            scaleAmount={0.98}
            opacityAmount={0.85}
            style={{
              flex: 1, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
              paddingHorizontal: 16, borderRadius: 10,
              borderWidth,
              borderColor,
              backgroundColor: isChanged ? "#FFFBF5" : "#FFFFFF",
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{value}</Text>
            <Text style={{ fontSize: 16, color: "#AAB4BF" }}>원</Text>
          </AnimatedPressable>
        </View>
        {isChanged && initialForm ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: "#9EA3AD" }}>{initialForm[fieldKey]}원</Text>
            <Text style={{ fontSize: 11, color: "#9EA3AD" }}>→</Text>
            <Text style={{ fontSize: 12, color: "#FF8F00", fontWeight: "600" }}>{value}원으로 수정</Text>
          </View>
        ) : subNote ? (
          <Text style={{ fontSize: 12, color: "#9EA3AD", textAlign: "right", marginTop: 4 }}>{subNote}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>

          {/* 헤더 */}
          <View style={{ backgroundColor: "#FFFFFF" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
              <Pressable onPress={handleBack} style={{ padding: 4 }} hitSlop={8}>
                <ChevronLeft size={24} color="#19191B" />
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여명세서 수정</Text>
            </View>
            <Divider />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

            {/* ── 직원 정보 ── */}
            {p && (
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, backgroundColor: "#FFFFFF" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.avatar_color ?? "#F4D03F", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>
                        {(p.name ?? "?").charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", flex: 1, alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>{p.name}</Text>
                      {p.employment_type ? (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#F7F7F8" }}>
                          <Text style={{ fontSize: 10, fontWeight: "500", color: "#70737B" }}>{p.employment_type}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {p.birth ? <InfoRow label="생년월일">{p.birth}</InfoRow> : null}
                  {p.phone ? <InfoRow label="전화번호">{formatPhone(p.phone)}</InfoRow> : null}
                </View>

                <Divider thick />

                {/* ── 근무 내역 (읽기 전용) ── */}
                <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
                  <SectionTitle>근무 내역</SectionTitle>
                  {p.work_days != null ? <InfoRow label="근로일수">{p.work_days}일</InfoRow> : null}
                  {workActualHours != null ? <InfoRow label="실근로시간">{workActualHours}시간</InfoRow> : null}
                  {workOvertimeHours != null ? <InfoRow label="연장근로시간">{workOvertimeHours}시간</InfoRow> : null}
                  {workNightHours != null ? <InfoRow label="야간근로시간">{workNightHours}시간</InfoRow> : null}
                  {workHolidayHours != null ? <InfoRow label="휴일근로시간">{workHolidayHours}시간</InfoRow> : null}
                  {workWeeklyLeaveHours != null ? (
                    <InfoRow label="주휴수당시간">
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>{workWeeklyLeaveHours}시간</Text>
                        {p.weekly_leave_note ? (
                          <Text style={{ fontSize: 12, color: "#9EA3AD" }}>{p.weekly_leave_note}</Text>
                        ) : null}
                      </View>
                    </InfoRow>
                  ) : null}
                  {p.total_pay_hours != null ? <InfoRow label="총 지급시간">{p.total_pay_hours}시간</InfoRow> : null}
                </View>

                <Divider thick />
              </>
            )}

            {/* ── 지급 내역 ── */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: "#FFFFFF" }}>
              <SectionTitle>지급 내역</SectionTitle>

              <EditRow fieldKey="base_pay" label="기본급" subNote={workActualHours != null ? `${workActualHours}시간` : undefined} />
              <EditRow
                fieldKey="overtime_pay"
                label={
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", letterSpacing: -0.32 }}>연장수당</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>× 1.5배 (법정)</Text>
                  </View>
                }
                subNote="시급 × 1.5배 (법정 기준)"
              />
              <EditRow
                fieldKey="night_pay"
                label={
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", letterSpacing: -0.32 }}>야간수당</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>× 0.5배 추가</Text>
                  </View>
                }
                subNote="시급 × 0.5배 추가 (법정 기준)"
              />
              <EditRow
                fieldKey="holiday_pay"
                label={
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", letterSpacing: -0.32 }}>휴일수당</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>× 1.5배 (8h↓)</Text>
                  </View>
                }
                subNote="시급 × 1.5배 (8시간 이내, 법정 기준)"
              />
              <EditRow
                fieldKey="weekly_leave_pay"
                label={
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", letterSpacing: -0.32 }}>주휴수당</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>평균 5.8h × 5주</Text>
                  </View>
                }
                subNote="29시간"
              />
              <EditRow
                fieldKey="other_allowance"
                label={
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", letterSpacing: -0.32 }}>기타 수당</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>(인센티브)</Text>
                  </View>
                }
              />

              {/* 지급액 합계 카드 */}
              <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 16, marginTop: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B" }}>지급액 합계</Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#4261FF", letterSpacing: -0.36 }}>
                    {totalPay.toLocaleString()}원
                  </Text>
                </View>
              </View>
            </View>

            <Divider thick />

            {/* ── 공제 내역 ── */}
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: "#FFFFFF" }}>
              <SectionTitle>공제 내역</SectionTitle>

              <SubSectionTitle>소득세</SubSectionTitle>
              <View style={{ paddingLeft: 8 }}>
                <EditRow fieldKey="income_tax" label="소득세" subNote="근로자 부담 3%" />
                <EditRow fieldKey="local_income_tax" label="지방소득세" subNote="소득세의 10%" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>소득세 합계</Text>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{incomeTaxTotal.toLocaleString()}원</Text>
              </View>

              <SubSectionTitle>4대 보험</SubSectionTitle>
              <View style={{ paddingLeft: 8 }}>
                <EditRow fieldKey="national_pension" label="국민연금" subNote="근로자 부담 4.5%" />
                <EditRow fieldKey="health_insurance" label="건강보험" subNote="근로자 부담 3.545%" />
                <EditRow fieldKey="long_term_care" label="장기요양보험" subNote="건강보험료의 12.81%" />
                <EditRow fieldKey="employment_insurance" label="고용보험" subNote="근로자 부담 0.9%" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>4대보험 합계</Text>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>{socialTotal.toLocaleString()}원</Text>
              </View>

              {/* 총 공제액 카드 */}
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, padding: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B" }}>총 공제액</Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>
                    {totalDeduction.toLocaleString()}원
                  </Text>
                </View>
              </View>

              {/* 실지급액 카드 */}
              <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 16, marginTop: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#4261FF" }}>실 지급액</Text>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: "#4261FF", letterSpacing: -0.44 }}>
                    {netPay.toLocaleString()}원
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: "rgba(66,97,255,0.15)", marginBottom: 10 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>지급액 합계</Text>
                  <Text style={{ fontSize: 13, color: "#19191B", fontWeight: "500" }}>{totalPay.toLocaleString()}원</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>총 공제액</Text>
                  <Text style={{ fontSize: 13, color: "#19191B", fontWeight: "500" }}>- {totalDeduction.toLocaleString()}원</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* ── 하단 버튼 ── */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#F7F7F8", backgroundColor: "#FFFFFF" }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AnimatedPressable
                onPress={handleBack}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ width: 122, height: 56, borderRadius: 16, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => setSaveConfirmOpen(true)}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", opacity: submitting ? 0.6 : 1 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
                  {p?.is_published ? "급여명세서 수정하기" : "수정하기"}
                </Text>
              </AnimatedPressable>
            </View>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── 금액 입력 바텀시트 ── */}
      <BottomSheet
        isOpen={activeSheet !== null}
        onClose={() => setActiveSheet(null)}
        title={activeSheet ? sheetMeta[activeSheet].label : ""}
      >
        {activeSheet && (
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", height: 52, paddingHorizontal: 16, borderWidth: 2, borderColor: "#4261FF", borderRadius: 10, backgroundColor: "#FFFFFF", marginBottom: 16 }}>
              <FocusInput
                value={sheetValue}
                onChangeText={(t) => {
                  const raw = t.replace(/,/g, "").replace(/[^0-9]/g, "");
                  if (raw === "") { setSheetValue("0"); return; }
                  const num = parseInt(raw, 10);
                  setSheetValue(num.toLocaleString());
                }}
                keyboardType="numeric"
                autoFocus
                style={{
                  flex: 1, textAlign: "right", fontSize: 18, fontWeight: "600", color: "#19191B",
                  outline: "none", boxShadow: "none",
                } as any}
              />
              <Text style={{ fontSize: 16, color: "#AAB4BF", marginLeft: 8 }}>원</Text>
            </View>
            {sheetMeta[activeSheet].subNote && (
              <Text style={{ fontSize: 12, color: "#9EA3AD", marginBottom: 12 }}>
                {sheetMeta[activeSheet].subNote}
              </Text>
            )}
            <AnimatedPressable
              onPress={() => {
                if (activeSheet) {
                  setForm((prev) => ({ ...prev, [activeSheet]: sheetValue }));
                }
                setActiveSheet(null);
              }}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
            </AnimatedPressable>
          </View>
        )}
      </BottomSheet>

      <ConfirmDialog
        visible={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title="급여명세서 수정"
        description={"입력한 내용으로 급여 명세서를\n수정하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setSaveConfirmOpen(false), variant: "cancel" },
          { label: "확인", onPress: handleSave },
        ]}
      />

      <ConfirmDialog
        visible={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="급여명세서 수정 취소"
        description={"수정 중인 내용이 저장되지 않아요.\n정말 취소하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setCancelConfirmOpen(false), variant: "cancel" },
          { label: "확인", onPress: () => { setCancelConfirmOpen(false); navigation.goBack(); } },
        ]}
      />
    </>
  );
};

export default PayslipEditScreen;
