import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DotsLoader from "@/components/DotsLoader";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { getMonthlySalesDetail } from "@/api/owner";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#70737B", width: 114, flexShrink: 0 }}>{label}</Text>
    <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: valueColor ?? "#19191B", flex: 1, textAlign: "right" }}>{value}</Text>
  </View>
);

const SectionTitle: React.FC<{ children: string }> = ({ children }) => (
  <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4, marginBottom: 16 }}>{children}</Text>
);

const ThickDivider = () => <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />;
const ThinDivider = () => <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }} />;

const OwnerSalesMonthlyDetailScreen: React.FC<ScreenProps<"OwnerSalesMonthlyDetail">> = ({ route, navigation }) => {
  const { year, month } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    getMonthlySalesDetail(storeId, year, month)
      .then((res: any) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [storeId, year, month]);

  const cashDifference = data ? data.cash_on_hand - data.cash_expected : 0;
  const totalDeductions = data ? data.discount_amount + data.refund_amount : 0;
  const netSales = data ? data.gross_sales - data.discount_amount - data.refund_amount : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B" }}>월간 매출 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ErrorState onRetry={load} />
        </View>
      ) : !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <EmptyState message="월간 매출 정보가 없어요" />
        </View>
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* 날짜 */}
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4 }}>{year}년 {month}월</Text>
          <Text style={{ fontSize: 13, color: "#9EA3AD", marginTop: 4 }}>
            {year}/{String(month).padStart(2, "0")}/01 ~ {year}/{String(month).padStart(2, "0")}/{String(new Date(year, month, 0).getDate()).padStart(2, "0")} 기준
          </Text>
        </View>

        {/* 순매출 카드 */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ backgroundColor: "#F0F7FF", borderRadius: 16, padding: 16 }}>
            <View style={{ alignSelf: "flex-start", height: 17, borderRadius: 4, paddingHorizontal: 8, backgroundColor: "#D3DAFF", justifyContent: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: "#7488FE" }}>순 매출액</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#70737B" }}>순 매출</Text>
              <Text style={{ fontSize: 22, fontWeight: "700", letterSpacing: -0.44, color: "#4261FF" }}>{netSales.toLocaleString()}원</Text>
            </View>
            <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginVertical: 12 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, color: "#70737B" }}>총 매출액</Text>
              <Text style={{ fontSize: 14, color: "#70737B" }}>{data?.gross_sales?.toLocaleString() ?? 0}원</Text>
            </View>
          </View>
        </View>

        <ThickDivider />

        {/* 영업 매출 */}
        <View style={{ padding: 16, paddingHorizontal: 20 }}>
          <SectionTitle>영업 매출</SectionTitle>
          {(data?.sales_items ?? []).map((item: any, i: number) => (
            <InfoRow key={i} label={item.label} value={`${item.value.toLocaleString()}원`} />
          ))}
          <ThinDivider />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>합계</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>
              {(data?.sales_items ?? []).reduce((s: number, it: any) => s + it.value, 0).toLocaleString()}원
            </Text>
          </View>
        </View>

        <ThickDivider />

        {/* 할인 및 환불 내역 */}
        <View style={{ padding: 16, paddingHorizontal: 20 }}>
          <SectionTitle>할인 및 환불 내역</SectionTitle>
          <InfoRow
            label="할인 금액"
            value={data?.discount_amount === 0 ? "없음" : `-${data?.discount_amount?.toLocaleString()}원`}
            valueColor={data?.discount_amount > 0 ? "#FF8F00" : "#AAB4BF"}
          />
          <InfoRow
            label="환불 금액"
            value={data?.refund_amount === 0 ? "없음" : `-${data?.refund_amount?.toLocaleString()}원`}
            valueColor={data?.refund_amount > 0 ? "#FF3D3D" : "#AAB4BF"}
          />
          <ThinDivider />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>합계 공제</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: totalDeductions > 0 ? "#FF3D3D" : "#AAB4BF" }}>
              -{totalDeductions.toLocaleString()}원
            </Text>
          </View>
        </View>

        <ThickDivider />

        {/* 현금 내역 */}
        <View style={{ padding: 16, paddingHorizontal: 20 }}>
          <SectionTitle>현금 내역</SectionTitle>
          <InfoRow label="현금 매출 예상" value={`${data?.cash_expected?.toLocaleString() ?? 0}원`} />
          <InfoRow label="실제 현금 시재" value={`${data?.cash_on_hand?.toLocaleString() ?? 0}원`} />
          <ThinDivider />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>과부족</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: cashDifference === 0 ? "#10C97D" : cashDifference > 0 ? "#4261FF" : "#FF3D3D" }}>
              {cashDifference === 0 ? "정상" : `${cashDifference > 0 ? "+" : ""}${cashDifference.toLocaleString()}원`}
            </Text>
          </View>
          {cashDifference !== 0 && (
            <Text style={{ fontSize: 13, color: cashDifference < 0 ? "#FF3D3D" : "#4261FF", marginTop: 6, fontWeight: "500" }}>
              *현금이 {Math.abs(cashDifference).toLocaleString()}원 {cashDifference < 0 ? "부족해요" : "초과해요"}
            </Text>
          )}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default OwnerSalesMonthlyDetailScreen;
