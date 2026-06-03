import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { ChevronLeft, Info } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getEmployeePayslipDetail } from "@/api/employee";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const minutesToHours = (m: number | null | undefined): number => Math.round(((m ?? 0) / 60) * 10) / 10;

const SectionDivider = () => <View style={{ height: 8, backgroundColor: "#F7F7F8" }} />;

const PayRow: React.FC<{
  label: string;
  labelSub?: string;
  value: string;
  sub?: string;
  bold?: boolean;
}> = ({ label, labelSub, value, sub, bold }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 5 }}>
    <View style={{ width: 100, flexShrink: 0 }}>
      <Text style={{ fontSize: 15, fontWeight: bold ? "700" : "400", color: bold ? "#19191B" : "#9EA3AD" }}>{label}</Text>
      {labelSub && <Text style={{ fontSize: 12, color: "#9EA3AD", marginTop: 1 }}>{labelSub}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 15, fontWeight: bold ? "700" : "400", color: "#19191B" }}>
        {value}
        {sub && <Text style={{ fontSize: 12, color: "#70737B" }}> {sub}</Text>}
      </Text>
    </View>
  </View>
);

const EmployeePayStubDetailScreen: React.FC<ScreenProps<"EmployeePayStubDetail">> = ({ route, navigation }) => {
  const { payslipId } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const hasOvertimePay = localStorage.getItem("storeHasOvertimePay") === "true";
  const hasNightPay = localStorage.getItem("storeHasNightPay") === "true";
  const hasHolidayPay = localStorage.getItem("storeHasHolidayPay") === "true";
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    if (!payslipId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    getEmployeePayslipDetail(payslipId, storeId)
      .then(setP)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [payslipId, storeId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("EmployeeSalary"); }} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>급여명세서</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
      </SafeAreaView>
    );
  }

  if (!p) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("EmployeeSalary"); }} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>급여명세서</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {error ? (
            <ErrorState onRetry={load} />
          ) : (
            <EmptyState message="급여명세서를 찾을 수 없어요" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const hasSocialInsurance = !!(p.national_pension || p.health_insurance || p.long_term_care || p.employment_insurance);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("EmployeeSalary"); }} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>급여명세서</Text>
      </View>

      {/* 퇴사 직원 명세서 안내 배너 — B5 납품 후 is_resigned 필드로 자동 활성화 */}
      {p.is_resigned && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "rgba(112,115,123,0.08)", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Info size={14} color="#70737B" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#70737B" }}>퇴사 처리된 직원의 명세서예요. 퇴사일 기준 일할 계산이 적용됐어요.</Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Title section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>
            {p.year}년 {p.month}월{" "}
            <Text style={{ fontSize: 14, fontWeight: "400", color: "#70737B" }}>
              ({p.pay_period_start} - {p.pay_period_end})
            </Text>
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginTop: 2 }}>
            {p.name ?? "직원"}님의 급여명세서
          </Text>
          <View style={{ marginTop: 16, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 12, color: "#4261FF" }}>실 지급액</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#4261FF" }}>
              {(p.net_pay ?? 0).toLocaleString()}원
            </Text>
          </View>
        </View>

        <SectionDivider />

        {/* 근무 내역 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>근무 내역</Text>
          <View style={{ gap: 2 }}>
            <PayRow label="근로일수" value={`${p.work_days ?? 0}일`} />
            <PayRow label="실근로시간" value={`${minutesToHours(p.actual_work_minutes)}시간`} />
            {p.overtime_minutes ? (
              <PayRow label="연장근로시간" value={`${minutesToHours(p.overtime_minutes)}시간`} />
            ) : null}
            {p.night_minutes ? (
              <PayRow label="야간근로시간" value={`${minutesToHours(p.night_minutes)}시간`} />
            ) : null}
            {p.holiday_minutes ? (
              <PayRow label="휴일근로시간" value={`${minutesToHours(p.holiday_minutes)}시간`} />
            ) : null}
            {p.weekly_leave_minutes ? (
              <View>
                <PayRow label="주휴수당시간" value={`${minutesToHours(p.weekly_leave_minutes)}시간`} />
                <Text style={{ marginLeft: 100, fontSize: 12, color: "#70737B", marginTop: 2 }}>
                  (1일 평균 근로시간 × 주수)
                </Text>
              </View>
            ) : null}
            <PayRow label="총 지급시간" value={`${minutesToHours((p.actual_work_minutes ?? 0) + (p.weekly_leave_minutes ?? 0))}시간`} />
          </View>
        </View>

        <SectionDivider />

        {/* 지급 내역 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>지급 내역</Text>
          <View style={{ gap: 2 }}>
            <PayRow
              label="기본급"
              value={`${(p.base_pay ?? 0).toLocaleString()}원`}
              sub={p.actual_work_minutes ? `(${minutesToHours(p.actual_work_minutes)}시간)` : undefined}
            />
            {p.weekly_leave_pay ? (
              <PayRow
                label="주휴수당"
                value={`${p.weekly_leave_pay.toLocaleString()}원`}
                sub={p.weekly_leave_minutes ? `(${minutesToHours(p.weekly_leave_minutes)}시간)` : undefined}
              />
            ) : null}
            {hasOvertimePay && p.overtime_pay ? (
              <PayRow label="연장수당" value={`${p.overtime_pay.toLocaleString()}원`} sub="시급 × 1.5배 (법정 기준)" />
            ) : null}
            {hasNightPay && p.night_pay ? (
              <PayRow label="야간수당" value={`${p.night_pay.toLocaleString()}원`} sub="시급 × 0.5배 추가 (법정 기준)" />
            ) : null}
            {hasHolidayPay && p.holiday_pay ? (
              <PayRow label="휴일수당" value={`${p.holiday_pay.toLocaleString()}원`} sub="시급 × 1.5배 (8시간 이내, 법정 기준)" />
            ) : null}
            {p.other_allowance ? (
              <PayRow
                label="기타 수당"
                labelSub="(인센티브)"
                value={`${p.other_allowance.toLocaleString()}원`}
              />
            ) : null}
            <PayRow
              label="지급액 합계"
              value={`${(p.total_pay ?? 0).toLocaleString()}원`}
              bold
            />
          </View>
        </View>

        <SectionDivider />

        {/* 공제 내역 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>공제 내역</Text>
          <View style={{ gap: 2 }}>
            {p.income_tax ? (
              <PayRow
                label="소득세"
                value={`${p.income_tax.toLocaleString()}원`}
                sub={`(근로자 부담 3%)`}
              />
            ) : null}
            {p.local_income_tax ? (
              <PayRow
                label="지방소득세"
                value={`${p.local_income_tax.toLocaleString()}원`}
                sub={`(소득세의 10%)`}
              />
            ) : null}
            {(p.income_tax || p.local_income_tax) ? (
              <PayRow
                label="소득세 합계"
                value={`${((p.income_tax ?? 0) + (p.local_income_tax ?? 0)).toLocaleString()}원`}
                bold
              />
            ) : null}
            {hasSocialInsurance && (
              <>
                {p.national_pension ? (
                  <PayRow
                    label="국민연금"
                    value={`${p.national_pension.toLocaleString()}원`}
                    sub="(근로자 부담 4.5%)"
                  />
                ) : null}
                {p.health_insurance ? (
                  <PayRow
                    label="건강보험"
                    value={`${p.health_insurance.toLocaleString()}원`}
                    sub="(근로자 부담 3.545%)"
                  />
                ) : null}
                {p.long_term_care ? (
                  <PayRow
                    label="장기요양보험"
                    value={`${p.long_term_care.toLocaleString()}원`}
                    sub="(건강보험료의 12.81%)"
                  />
                ) : null}
                {p.employment_insurance ? (
                  <PayRow
                    label="고용보험"
                    value={`${p.employment_insurance.toLocaleString()}원`}
                    sub="(근로자 부담 0.9%)"
                  />
                ) : null}
              </>
            )}
            <PayRow
              label="총 공제액"
              value={`${(p.total_deduction ?? 0).toLocaleString()}원`}
              bold
            />
          </View>
        </View>

        <SectionDivider />

        {/* 누적 급여 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <View style={{ backgroundColor: "#F0F4FF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>지급까지 누적 급여</Text>
              <Text style={{ fontSize: 12, color: "#9EA3AD" }}>({p.pay_period_start ?? ""} - {p.pay_period_end ?? ""})</Text>
            </View>
            <Text style={{ textAlign: "right", fontSize: 22, fontWeight: "700", color: "#4261FF" }}>
              {(p.total_pay ?? 0).toLocaleString()}원
            </Text>
          </View>
        </View>

        {/* Comment */}
        {p.comment && (
          <>
            <SectionDivider />
            <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 12 }}>전달 코멘트</Text>
              <Text style={{ fontSize: 15, color: "#19191B", lineHeight: 22 }}>{p.comment}</Text>
            </View>
          </>
        )}

        {/* Disclaimer */}
        <SectionDivider />
        {!hasSocialInsurance ? (
          <View style={{ backgroundColor: "#F7F7F8", paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 12, lineHeight: 20, color: "#4261FF" }}>
              본 급여명세서는 주당 소정근로시간이 15시간 미만이거나
              법정 4대보험 적용 대상에 해당하지 않는 근로자에
              대한 급여 내역으로, 국민연금, 건강보험, 장기요양보험,
              고용보험은 공제되지 않았으며, 근로소득세 및 지방소득세만
              공제됐어요.
            </Text>
          </View>
        ) : (
          <View style={{ backgroundColor: "#F7F7F8", paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 12, lineHeight: 20, color: "#9EA3AD" }}>
              본 급여명세서는 국민연금(4.5%), 건강보험(3.545%), 장기요양보험(건강보험료의 12.81%), 고용보험(0.9%) 등 법정 4대 보험 요율을 적용하여 공제하였으며, 근로소득세 및 지방소득세가 함께 공제됐어요.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default EmployeePayStubDetailScreen;
