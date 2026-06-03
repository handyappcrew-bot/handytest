import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import { ChevronLeft, Info, Pencil } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { getPayslips, getPayslipDetail, generatePayslips } from "@/api/owner";
import { localStorage } from "@/utils/storage";
import AnimatedPressable from "@/components/AnimatedPressable";
import type { ScreenProps } from "@/navigation/types";

const SalaryDetailScreen: React.FC<ScreenProps<"SalaryDetail">> = ({ route, navigation }) => {
  const { name, year, month } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // 이름으로 payslip 찾기
  useEffect(() => {
    if (!storeId || !name) return;
    (async () => {
      try {
        const list = await getPayslips(storeId, year ?? new Date().getFullYear(), month ?? new Date().getMonth() + 1) as any[];
        const found = list?.find((p) => p.name === name);
        if (found) {
          const detail = await getPayslipDetail(storeId, found.id);
          setPayslip(detail);
        }
      } catch {
        setPayslip(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId, name, year, month]);

  const isPublished = !!payslip?.is_published;

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await generatePayslips(storeId, year ?? new Date().getFullYear(), month ?? new Date().getMonth() + 1);
      setLoading(true);
      const list = await getPayslips(storeId, year ?? new Date().getFullYear(), month ?? new Date().getMonth() + 1) as any[];
      const found = list?.find((p: any) => p.name === name);
      if (found) {
        const detail = await getPayslipDetail(storeId, found.id);
        setPayslip(detail);
      }
    } catch {
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  if (!loading && !payslip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여 상세</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#F0F0F0" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <EmptyState message="급여 명세서가 없어요" />
          <Text style={{ fontSize: 13, color: "#AAB4BF", textAlign: "center", marginTop: 8, marginBottom: 24, lineHeight: 20 }}>
            {"직원별 계약 정보를 바탕으로\n명세서를 생성할 수 있어요"}
          </Text>
          <AnimatedPressable
            onPress={handleGenerate}
            scaleAmount={0.97} opacityAmount={0.75}
            style={{ height: 48, borderRadius: 14, backgroundColor: generating ? "#F0F3FF" : "#4261FF", paddingHorizontal: 28, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: generating ? "#4261FF" : "#FFFFFF" }}>
              {generating ? "생성 중..." : "급여명세서 생성하기"}
            </Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!payslip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여 상세</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#F0F0F0" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#F0F0F0" }} />

      {/* 발급 완료 배너 */}
      {isPublished && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#F7F8FF", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
          <Text style={{ fontSize: 13, color: "#7488FE" }}>
            {payslip.published_at
              ? (() => {
                  const d = new Date(payslip.published_at);
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
      )}

      {/* 퇴사 직원 명세서 안내 배너 — B5 납품 후 is_resigned 필드로 자동 활성화 */}
      {payslip.is_resigned && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "rgba(112,115,123,0.08)", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Info size={14} color="#70737B" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#70737B" }}>퇴사 처리된 직원의 명세서예요. 퇴사일 기준 일할 계산이 적용됐어요.</Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* 날짜 + 발급 상태 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4 }}>
              {payslip.year ?? year}년 {payslip.month ?? month}월
            </Text>
            {isPublished ? (
              <View style={{ backgroundColor: "rgba(16,201,125,0.08)", borderWidth: 1, borderColor: "rgba(16,201,125,0.3)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#10C97D" }}>발급 완료</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: "#ECFFF1", borderWidth: 1, borderColor: "#1EDC83", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#1EDC83" }}>미발급</Text>
              </View>
            )}
          </View>

          {/* 직원 이름 */}
          {name ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>{name.charAt(0)}</Text>
              </View>
              <View style={{ flexDirection: "row", flex: 1, alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>{name}</Text>
                {payslip.employment_type ? (
                  <View style={{ backgroundColor: "#F7F7F8", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: "500", color: "#70737B" }}>{payslip.employment_type}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {payslip.pay_period_start && payslip.pay_period_end && (
            <InfoRow label="급여 기간">
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                {payslip.pay_period_start} ~ {payslip.pay_period_end}
              </Text>
            </InfoRow>
          )}
          {payslip.salary_day ? (
            <InfoRow label="급여일">
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>매월 {payslip.salary_day}일</Text>
            </InfoRow>
          ) : null}
        </View>

        <Divider thick />

        {/* 실 지급액 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <SectionTitle>실 지급액</SectionTitle>
          <View style={{ backgroundColor: "#F0F4FF", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 8 }}>
              기본급 {(payslip.base_pay ?? 0).toLocaleString()}원
              {payslip.overtime_pay ? ` + 연장 ${payslip.overtime_pay.toLocaleString()}원` : ""}
              {payslip.night_pay ? ` + 야간 ${payslip.night_pay.toLocaleString()}원` : ""}
              {payslip.holiday_pay ? ` + 휴일 ${payslip.holiday_pay.toLocaleString()}원` : ""}
              {payslip.weekly_leave_pay ? ` + 주휴 ${payslip.weekly_leave_pay.toLocaleString()}원` : ""}
              {payslip.other_allowance ? ` + 기타 ${payslip.other_allowance.toLocaleString()}원` : ""}
            </Text>
            <Text style={{ textAlign: "right", fontSize: 22, fontWeight: "700", color: "#4261FF", letterSpacing: -0.44 }}>
              {(payslip.net_pay ?? 0).toLocaleString()}원
            </Text>
          </View>
        </View>

        <Divider thick />

        {/* 지급 내역 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <SectionTitle>지급 내역</SectionTitle>
          <InfoRow label="기본급">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.base_pay ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "600", color: "#FF862D" }}>연장수당</Text>}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: payslip.overtime_pay ? "#FF862D" : "#AAB4BF" }}>
              {payslip.overtime_pay ? `+${payslip.overtime_pay.toLocaleString()}원` : "0원"}
            </Text>
          </InfoRow>
          <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "600", color: "#6B4FEC" }}>야간수당</Text>}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: payslip.night_pay ? "#6B4FEC" : "#AAB4BF" }}>
              {payslip.night_pay ? `+${payslip.night_pay.toLocaleString()}원` : "0원"}
            </Text>
          </InfoRow>
          <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "600", color: "#E05C00" }}>휴일수당</Text>}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: payslip.holiday_pay ? "#E05C00" : "#AAB4BF" }}>
              {payslip.holiday_pay ? `+${payslip.holiday_pay.toLocaleString()}원` : "0원"}
            </Text>
          </InfoRow>
          <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "600", color: "#213DD9" }}>주휴수당</Text>}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: payslip.weekly_leave_pay ? "#213DD9" : "#AAB4BF" }}>
              {payslip.weekly_leave_pay ? `+${payslip.weekly_leave_pay.toLocaleString()}원` : "0원"}
            </Text>
          </InfoRow>
          <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>기타 수당{"\n"}<Text style={{ fontSize: 12, color: "#9EA3AD" }}>(인센티브)</Text></Text>}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: payslip.other_allowance ? "#10C97D" : "#AAB4BF" }}>
              {payslip.other_allowance ? `+${payslip.other_allowance.toLocaleString()}원` : "0원"}
            </Text>
          </InfoRow>
          <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginTop: 4 }}>
            <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>총 지급액</Text>}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>
                {(payslip.total_pay ?? 0).toLocaleString()}원
              </Text>
            </InfoRow>
          </View>
        </View>

        <Divider thick />

        {/* 공제 내역 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <SectionTitle>공제 내역</SectionTitle>
          <InfoRow label="소득세">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.income_tax ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <InfoRow label="지방소득세">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.local_income_tax ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <InfoRow label="국민연금">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.national_pension ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <InfoRow label="건강보험">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.health_insurance ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <InfoRow label="장기요양보험">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.long_term_care ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <InfoRow label="고용보험">
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              {(payslip.employment_insurance ?? 0).toLocaleString()}원
            </Text>
          </InfoRow>
          <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12, marginTop: 4 }}>
            <InfoRow label={<Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>총 공제액</Text>}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>
                {(payslip.total_deduction ?? 0).toLocaleString()}원
              </Text>
            </InfoRow>
          </View>
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={{ borderTopWidth: 1, borderTopColor: "#F7F7F8", backgroundColor: "#FFFFFF" }}>
        <View style={{ padding: 20, gap: 8 }}>
          {isPublished ? (
            <AnimatedPressable
              onPress={() => navigation.navigate("PayslipDetail", { payslipId: payslip.id, name, year, month })}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.32 }}>급여명세서 보기</Text>
            </AnimatedPressable>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AnimatedPressable
                onPress={() => navigation.navigate("PayslipEdit", { payslipId: payslip.id })}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#F0F4FF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
              >
                <Pencil size={18} color="#4261FF" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF", letterSpacing: -0.32 }}>급여 정보 수정하기</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => navigation.navigate("PayslipDetail", { payslipId: payslip.id, name, year, month })}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.32 }}>급여명세서 확인</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

/* ── 공통 컴포넌트 ── */

const Divider: React.FC<{ thick?: boolean }> = ({ thick }) =>
  thick ? (
    <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />
  ) : (
    <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }} />
  );

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36, marginBottom: 16 }}>
    {children}
  </Text>
);

const InfoRow: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
    <View style={{ width: 114, flexShrink: 0 }}>
      {typeof label === "string" ? (
        <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#70737B" }}>{label}</Text>
      ) : (
        label
      )}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
  </View>
);

export default SalaryDetailScreen;
