import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable,
} from "react-native";
import DotsLoader from "@/components/DotsLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronDown, Check } from "lucide-react-native";
import { formatPhone } from "@/utils/valid";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/components/Toast";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getPayslipDetail, publishPayslip, transferPayslip } from "@/api/owner";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

// ─── 헬퍼 컴포넌트 ──────────────────────────────────────────────

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

const InfoRow: React.FC<{
  label: React.ReactNode;
  children: React.ReactNode;
  bold?: boolean;
}> = ({ label, children, bold }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 114, flexShrink: 0, letterSpacing: -0.32 }}>
      {label}
    </Text>
    <View style={{ flex: 1 }}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={{ fontSize: 16, fontWeight: bold ? "700" : "500", color: "#19191B", letterSpacing: -0.32 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  </View>
);

// ─── 메인 화면 ──────────────────────────────────────────────────

const PayslipDetailScreen: React.FC<ScreenProps<"PayslipDetail">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const { payslipId } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [error, setError] = useState(false);

  const load = () => {
    if (!storeId || !payslipId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    getPayslipDetail(storeId, payslipId)
      .then(setP)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [storeId, payslipId]);

  const handlePublish = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await publishPayslip(storeId, payslipId);
      toast({ description: "급여명세서가 발급되었어요." });
      const fresh = await getPayslipDetail(storeId, payslipId);
      setP(fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "발급에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await transferPayslip(storeId, payslipId);
      toast({ description: "이체 완료로 기록되었어요." });
      const fresh = await getPayslipDetail(storeId, payslipId);
      setP(fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "이체 처리에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setTransferConfirmOpen(false);
    }
  };

  if (!loading && (error || !p)) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여명세서 확인</Text>
        </View>
        <Divider />
        {error ? <ErrorState onRetry={load} /> : <EmptyState message="급여명세서를 찾을 수 없어요" />}
      </SafeAreaView>
    );
  }

  if (!p) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
      </SafeAreaView>
    );
  }

  const isPublished = !!p.is_published;
  const isTransferred = !!p.is_transferred;

  const actualHours = p.actual_work_minutes != null ? Math.round(p.actual_work_minutes / 60 * 10) / 10 : null;
  const overtimeHours = p.overtime_minutes != null ? Math.round(p.overtime_minutes / 60 * 10) / 10 : null;
  const nightHours = p.night_minutes != null ? Math.round(p.night_minutes / 60 * 10) / 10 : null;
  const holidayHours = p.holiday_minutes != null ? Math.round(p.holiday_minutes / 60 * 10) / 10 : null;
  const weeklyLeaveHours = p.weekly_leave_minutes != null ? Math.round(p.weekly_leave_minutes / 60 * 10) / 10 : null;

  const totalPay =
    (p.base_pay ?? 0) + (p.overtime_pay ?? 0) + (p.night_pay ?? 0) +
    (p.holiday_pay ?? 0) + (p.weekly_leave_pay ?? 0) + (p.other_allowance ?? 0);
  const totalDeduction =
    (p.income_tax ?? 0) + (p.local_income_tax ?? 0) +
    (p.national_pension ?? 0) + (p.health_insurance ?? 0) +
    (p.long_term_care ?? 0) + (p.employment_insurance ?? 0);
  const netPay = p.net_pay ?? 0;
  const incomeTaxTotal = (p.income_tax ?? 0) + (p.local_income_tax ?? 0);
  const socialTotal = (p.national_pension ?? 0) + (p.health_insurance ?? 0) +
    (p.long_term_care ?? 0) + (p.employment_insurance ?? 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* 헤더 */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여명세서 확인</Text>
        </View>
        <Divider />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        {/* ── 발행 시각 안내 배너 ── */}
        {isPublished ? (
          <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#F7F8FF", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
            <Text style={{ fontSize: 13, color: "#7488FE" }}>
              {p.published_at
                ? (() => {
                    const d = new Date(p.published_at);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const hh = String(d.getHours()).padStart(2, "0");
                    const min = String(d.getMinutes()).padStart(2, "0");
                    return `${yyyy}.${mm}.${dd} ${hh}:${min}에 발급된 급여명세서예요`;
                  })()
                : "급여 명세서가 발급된 건이에요"}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#F7F8FF", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
            <Text style={{ fontSize: 13, color: "#7488FE" }}>급여명세서를 확인 후 발급해주세요</Text>
          </View>
        )}

        {/* ── 이체 상태 배너 ── */}
        {isPublished && (
          isTransferred ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#ECFFF1", borderBottomWidth: 1, borderBottomColor: "#A7F3D0", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 13 }}>✅</Text>
              <Text style={{ fontSize: 13, fontWeight: "500", color: "#065F46" }}>이체 처리 완료</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#FFF8E1", borderBottomWidth: 1, borderBottomColor: "#FFE082", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 16 }}>💸</Text>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#92400E", lineHeight: 20 }}>{"급여 이체 후 이체 확인 버튼을\n눌러주세요"}</Text>
              </View>
              <AnimatedPressable
                onPress={() => setTransferConfirmOpen(true)}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ height: 34, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#FFB300", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>이체 확인</Text>
              </AnimatedPressable>
            </View>
          )
        )}

        {/* ── 직원 정보 ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, backgroundColor: "#FFFFFF" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.avatar_color ?? "#5C4033", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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

        {/* ── 계약 정보 ── */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
          <SectionTitle>계약 정보</SectionTitle>
          {p.salary_day ? (
            <InfoRow label="급여일">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>{p.salary_day}</Text>
                {!isPublished && (() => {
                  const today = new Date();
                  const todayDate = today.getDate();
                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                  const days = String(p.salary_day).split(",").map((d: string) => {
                    const t = d.trim().replace("일", "");
                    if (t === "말") return lastDay;
                    return parseInt(t);
                  }).filter((n: number) => !isNaN(n));
                  const nearest = days.map((day: number) => ({ day, diff: day >= todayDate ? day - todayDate : day + lastDay - todayDate })).sort((a: any, b: any) => a.diff - b.diff)[0];
                  if (!nearest) return null;
                  const label = nearest.diff === 0 ? "D-day" : `D-${nearest.diff}`;
                  const color = nearest.diff === 0 ? "#FF3D3D" : nearest.diff === 1 ? "#FF8F00" : "#9EA3AD";
                  return <Text style={{ fontSize: 12, fontWeight: "700", color }}>({label})</Text>;
                })()}
              </View>
            </InfoRow>
          ) : null}
          {p.work_days_text ? (
            <InfoRow label="근무일">
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>{p.work_days_text}</Text>
            </InfoRow>
          ) : null}
          {p.hourly_wage ? (
            <InfoRow label="시급">{Number(p.hourly_wage).toLocaleString()}원</InfoRow>
          ) : null}
          {p.bank ? <InfoRow label="은행">{p.bank}</InfoRow> : null}
          {p.account_number ? (
            <InfoRow label="계좌번호">
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32, textDecorationLine: "underline" }}>
                {p.account_number}
              </Text>
            </InfoRow>
          ) : null}
        </View>

        <Divider thick />

        {/* ── 급여 정보 카드 ── */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
          <SectionTitle>급여 정보</SectionTitle>
          <View style={{ backgroundColor: "#F0F4FF", borderRadius: 14, padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B" }}>지급될 급여</Text>
              <Text style={{ fontSize: 12, color: "#9EA3AD" }}>({p.pay_period_start} ~ {p.pay_period_end})</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 8 }}>
              지급액 합계 {totalPay.toLocaleString()}원 - 총 공제액 {totalDeduction.toLocaleString()}원
            </Text>
            <Text style={{ textAlign: "right", fontSize: 22, fontWeight: "700", color: "#4261FF" }}>
              총 {netPay.toLocaleString()}원
            </Text>
          </View>
        </View>

        {/* ── 상세 보기 / 닫기 토글 ── */}
        {!expanded ? (
          <AnimatedPressable
            onPress={() => setExpanded(true)}
            scaleAmount={0.98}
            opacityAmount={0.85}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 16 }}
          >
            <Text style={{ fontSize: 14, color: "#9EA3AD" }}>상세 보기</Text>
            <ChevronDown size={16} color="#9EA3AD" />
          </AnimatedPressable>
        ) : (
          <>
            <Divider thick />

            {/* ── 근무 내역 ── */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
              <SectionTitle>근무 내역</SectionTitle>
              {p.work_days != null ? <InfoRow label="근로일수">{p.work_days}일</InfoRow> : null}
              {actualHours != null ? <InfoRow label="실근로시간">{actualHours}시간</InfoRow> : null}
              {overtimeHours != null ? <InfoRow label="연장근로시간">{overtimeHours}시간</InfoRow> : null}
              {nightHours != null ? <InfoRow label="야간근로시간">{nightHours}시간</InfoRow> : null}
              {holidayHours != null ? <InfoRow label="휴일근로시간">{holidayHours}시간</InfoRow> : null}
              {weeklyLeaveHours != null ? (
                <InfoRow label="주휴수당시간">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>{weeklyLeaveHours}시간</Text>
                    {p.weekly_leave_note ? (
                      <Text style={{ fontSize: 12, color: "#9EA3AD" }}>{p.weekly_leave_note}</Text>
                    ) : null}
                  </View>
                </InfoRow>
              ) : null}
              {p.total_pay_hours != null ? <InfoRow label="총 지급시간">{p.total_pay_hours}시간</InfoRow> : null}
            </View>

            <Divider thick />

            {/* ── 지급 내역 ── */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
              <SectionTitle>지급 내역</SectionTitle>
              <InfoRow label="기본급">
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                    {(p.base_pay ?? 0).toLocaleString()}원
                  </Text>
                  {p.proration_days != null && (
                    <Text style={{ fontSize: 12, color: "#9EA3AD", marginTop: 2 }}>
                      {`입사 첫 달 일할 (${p.proration_days}일, ${Math.round((p.proration_ratio ?? 0) * 1000) / 10}%)`}
                    </Text>
                  )}
                </View>
              </InfoRow>
              {(p.overtime_pay ?? 0) > 0 && (
                <InfoRow label="연장수당">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                      {p.overtime_pay.toLocaleString()}원
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>시급 × 1.5배 (법정 기준)</Text>
                  </View>
                </InfoRow>
              )}
              {(p.night_pay ?? 0) > 0 && (
                <InfoRow label="야간수당">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                      {p.night_pay.toLocaleString()}원
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>시급 × 0.5배 추가 (법정 기준)</Text>
                  </View>
                </InfoRow>
              )}
              {(p.holiday_pay ?? 0) > 0 && (
                <InfoRow label="휴일수당">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                      {p.holiday_pay.toLocaleString()}원
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>시급 × 1.5배 (8시간 이내, 법정 기준)</Text>
                  </View>
                </InfoRow>
              )}
              {(p.weekly_leave_pay ?? 0) > 0 && (
                <InfoRow label="주휴수당">
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                    {p.weekly_leave_pay.toLocaleString()}원
                  </Text>
                </InfoRow>
              )}
              {(p.other_allowance ?? 0) > 0 && (
                <InfoRow label={"기타 수당\n(인센티브)"}>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                    {p.other_allowance.toLocaleString()}원
                  </Text>
                </InfoRow>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginTop: 4 }}>
                <InfoRow label="지급액 합계" bold>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32 }}>
                    {totalPay.toLocaleString()}원
                  </Text>
                </InfoRow>
              </View>
            </View>

            <Divider thick />

            {/* ── 공제 내역 ── */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
              <SectionTitle>공제 내역</SectionTitle>

              <SubSectionTitle>소득세</SubSectionTitle>
              {(p.income_tax ?? 0) > 0 && (
                <InfoRow label="소득세">
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{p.income_tax.toLocaleString()}원</Text>
                </InfoRow>
              )}
              {(p.local_income_tax ?? 0) > 0 && (
                <InfoRow label="지방소득세">
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{p.local_income_tax.toLocaleString()}원</Text>
                </InfoRow>
              )}
              <InfoRow label="소득세 합계">
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B" }}>{incomeTaxTotal.toLocaleString()}원</Text>
              </InfoRow>

              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 }} />

              <SubSectionTitle>4대 보험</SubSectionTitle>
              {(p.national_pension ?? 0) > 0 && (
                <InfoRow label="국민연금">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{p.national_pension.toLocaleString()}원</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>근로자 부담 4.5%</Text>
                  </View>
                </InfoRow>
              )}
              {(p.health_insurance ?? 0) > 0 && (
                <InfoRow label="건강보험">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{p.health_insurance.toLocaleString()}원</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>근로자 부담 3.545%</Text>
                  </View>
                </InfoRow>
              )}
              {(p.long_term_care ?? 0) > 0 && (
                <InfoRow label="장기요양보험">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{p.long_term_care.toLocaleString()}원</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>건강보험료의 12.81%</Text>
                  </View>
                </InfoRow>
              )}
              {(p.employment_insurance ?? 0) > 0 && (
                <InfoRow label="고용보험">
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{p.employment_insurance.toLocaleString()}원</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>근로자 부담 0.9%</Text>
                  </View>
                </InfoRow>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginTop: 4 }}>
                <InfoRow label="4대보험 합계">
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B" }}>{socialTotal.toLocaleString()}원</Text>
                </InfoRow>
              </View>

              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 }} />

              <InfoRow label="총 공제액">
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32 }}>
                  {totalDeduction.toLocaleString()}원
                </Text>
              </InfoRow>
            </View>

            <Divider thick />

            {/* ── 누적 급여 ── */}
            {p.cumulative_salary != null && (
              <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
                <View style={{ backgroundColor: "#F0F4FF", borderRadius: 14, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>지급까지 누적 급여</Text>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>({p.pay_period_start} ~ {p.pay_period_end})</Text>
                  </View>
                  <Text style={{ textAlign: "right", fontSize: 22, fontWeight: "700", color: "#4261FF" }}>
                    {Number(p.cumulative_salary).toLocaleString()}원
                  </Text>
                </View>
              </View>
            )}

            <Divider thick />

            {/* ── 고지 문구 ── */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF" }}>
              <Text style={{ fontSize: 12, color: "#9EA3AD", lineHeight: 20 }}>
                본 급여명세서는 국민연금(4.5%), 건강보험(3.545%), 장기요양보험(건강보험료의 12.81%), 고용보험(0.9%) 등 법정 4대 보험 요율을 적용하여 공제하였으며, 근로소득세 및 지방소득세가 함께 공제됐어요.
              </Text>
            </View>

            <AnimatedPressable
              onPress={() => setExpanded(false)}
              scaleAmount={0.98}
              opacityAmount={0.85}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 16 }}
            >
              <Text style={{ fontSize: 14, color: "#9EA3AD" }}>닫기</Text>
              <View style={{ transform: [{ rotate: "180deg" }] }}>
                <ChevronDown size={16} color="#9EA3AD" />
              </View>
            </AnimatedPressable>
          </>
        )}

        {/* ── 이체 완료 여부 (발행 후만 노출) ── */}
        {isPublished && (
          <>
            <Divider thick />
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B", marginBottom: 2 }}>실제 이체 완료 여부</Text>
                <Text style={{ fontSize: 13, color: isTransferred ? "#10C97D" : "#9EA3AD", fontWeight: isTransferred ? "500" : "400" }}>
                  {isTransferred ? "이체 처리 완료" : "명세서 전송과 별개로 이체 여부를 기록해요"}
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => { if (!isTransferred && !submitting) setTransferConfirmOpen(true); }}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  height: 40, paddingHorizontal: 14, borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isTransferred ? "rgba(16,201,125,0.3)" : "#DBDCDF",
                  backgroundColor: isTransferred ? "rgba(16,201,125,0.08)" : "#FFFFFF",
                  opacity: isTransferred || submitting ? 0.5 : 1,
                }}
              >
                {isTransferred && <Check size={14} color="#10C97D" />}
                <Text style={{ fontSize: 14, fontWeight: "600", color: isTransferred ? "#10C97D" : "#70737B" }}>
                  {isTransferred ? "이체 완료" : "이체 확인"}
                </Text>
              </AnimatedPressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── 하단 버튼 ── */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#F7F7F8", backgroundColor: "#FFFFFF" }}>
        {isPublished ? (
          <View style={{ height: 56, borderRadius: 16, backgroundColor: "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>급여 명세서 발급 완료</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AnimatedPressable
              onPress={() => navigation.navigate("PayslipEdit", { payslipId })}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ width: 122, height: 56, borderRadius: 16, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>수정하기</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handlePublish}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", opacity: submitting ? 0.6 : 1 }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>급여명세서 발급하기</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>

      <ConfirmDialog
        visible={transferConfirmOpen}
        onClose={() => setTransferConfirmOpen(false)}
        title="이체 완료 처리"
        description={`${p.name}님 급여를 실제로\n이체하셨나요?`}
        buttons={[
          { label: "취소", onPress: () => setTransferConfirmOpen(false), variant: "cancel" },
          { label: "이체 완료", onPress: handleTransfer },
        ]}
      />
    </SafeAreaView>
  );
};

export default PayslipDetailScreen;
