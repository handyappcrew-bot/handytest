import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Image, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { ChevronLeft, Pencil, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import { useToast } from "@/components/Toast";
import { api, API_BASE_URL } from "@/api/client";
import { getClosingReports, updateClosingReport } from "@/api/owner";
import { getCachedStaffList } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import { DAY_LABELS } from "@/utils/constants";
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

const OwnerSalesDailyDetailScreen: React.FC<ScreenProps<"OwnerSalesDailyDetail">> = ({ route, navigation }) => {
  const { year, month, day } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const { toast } = useToast();

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [reportId, setReportId] = useState<number | null>(null);

  // 수정 폼 상태
  const [editCard, setEditCard] = useState("");
  const [editCash, setEditCash] = useState("");
  const [editTransfer, setEditTransfer] = useState("");
  const [editGift, setEditGift] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editRefund, setEditRefund] = useState("");
  const [editCashOnHand, setEditCashOnHand] = useState("");
  const [editNote, setEditNote] = useState("");

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const emptyData = {
    closing_staff: "-", gross_sales: 0, discount_amount: 0, refund_amount: 0,
    sales_items: [
      { label: "카드 매출", value: 0 }, { label: "현금 매출", value: 0 },
      { label: "계좌이체", value: 0 }, { label: "상품권", value: 0 },
    ],
    cash_on_hand: 0, cash_expected: 0, note: "", receipt_url: null,
  };

  const loadData = () => {
    if (!storeId) { setData(emptyData); return; }
    Promise.all([
      api.get<any>(`/api/owner/store/${storeId}/sales/daily`, { date: dateStr }),
      getClosingReports(storeId, year, month).catch(() => []),
      getCachedStaffList(storeId).catch(() => []),
    ]).then(([d, reports, staff]) => {
      const staffNameMap: Record<number, string> = {};
      (Array.isArray(staff) ? staff : []).forEach((s: any) => {
        if (s.id != null) staffNameMap[s.id] = s.name || "";
      });
      const matched = (Array.isArray(reports) ? reports : []).find((r: any) => r.report_date === dateStr);
      setReportId(matched?.id ?? null);
      const closingStaff = matched?.employee_id ? (staffNameMap[matched.employee_id] || "-") : "-";

      setData({
        closing_staff: closingStaff,
        gross_sales: d.gross_sales ?? 0,
        discount_amount: d.discount_amount ?? 0,
        refund_amount: d.refund_amount ?? 0,
        sales_items: [
          { label: "카드 매출", value: d.card_sales ?? 0 },
          { label: "현금 매출", value: d.cash_sales ?? 0 },
          { label: "계좌이체", value: d.transfer_sales ?? 0 },
          { label: "상품권", value: d.gift_sales ?? 0 },
        ],
        cash_on_hand: d.cash_on_hand ?? 0,
        cash_expected: d.cash_sales ?? 0,
        note: d.manager_note ?? "",
        receipt_url: d.receipt_image_url ?? null,
      });
    }).catch(() => setData(emptyData));
  };

  useEffect(() => { loadData(); }, [year, month, day, storeId]);

  const openEdit = () => {
    if (!data) return;
    setEditCard(String(data.sales_items[0]?.value ?? 0));
    setEditCash(String(data.sales_items[1]?.value ?? 0));
    setEditTransfer(String(data.sales_items[2]?.value ?? 0));
    setEditGift(String(data.sales_items[3]?.value ?? 0));
    setEditDiscount(String(data.discount_amount ?? 0));
    setEditRefund(String(data.refund_amount ?? 0));
    setEditCashOnHand(String(data.cash_on_hand ?? 0));
    setEditNote(data.note ?? "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!reportId || saving) return;
    setSaving(true);
    try {
      await updateClosingReport(storeId, reportId, {
        card_sales: Number(editCard) || 0,
        cash_sales: Number(editCash) || 0,
        transfer_sales: Number(editTransfer) || 0,
        gift_sales: Number(editGift) || 0,
        discount_amount: Number(editDiscount) || 0,
        refund_amount: Number(editRefund) || 0,
        cash_on_hand: Number(editCashOnHand) || 0,
        manager_note: editNote,
      });
      toast({ description: "매출이 수정되었어요." });
      setEditOpen(false);
      loadData();
    } catch {
      toast({ description: "수정에 실패했어요.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const numInput = (label: string, value: string, onChange: (v: string) => void) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: "#70737B", marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, paddingHorizontal: 14, height: 48, backgroundColor: "#FAFAFA" }}>
        <TextInput
          value={value === "0" ? "" : value}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
          placeholder="0"
          placeholderTextColor="#C5C7CA"
          keyboardType="numeric"
          style={{ flex: 1, fontSize: 15, color: "#19191B" }}
        />
        <Text style={{ fontSize: 14, color: "#9EA3AD" }}>원</Text>
      </View>
    </View>
  );

  const date = new Date(year, month - 1, day);
  const dateLabel = `${year}년 ${month}월 ${day}일 (${DAY_LABELS[date.getDay()]})`;

  const netSales = data ? data.gross_sales - data.discount_amount - data.refund_amount : 0;
  const cashDifference = data ? data.cash_on_hand - data.cash_expected : 0;
  const totalDeductions = data ? data.discount_amount + data.refund_amount : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B" }}>매출 상세</Text>
        </View>
        {reportId && (
          <AnimatedPressable onPress={openEdit} style={{ padding: 8 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
            <Pencil size={20} color="#4261FF" />
          </AnimatedPressable>
        )}
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* 날짜 + 담당자 */}
        <View style={{ padding: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4, marginBottom: 8 }}>{dateLabel}</Text>
          <InfoRow label="마감 담당자" value={data?.closing_staff ?? "-"} />
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

        <ThickDivider />

        {/* 마감 영수증 */}
        <View style={{ padding: 16, paddingHorizontal: 20 }}>
          <SectionTitle>마감 영수증</SectionTitle>
          {data?.receipt_url ? (
            <Pressable onPress={() => setReceiptOpen(true)} style={{ width: 100, height: 140, borderRadius: 10, overflow: "hidden" }}>
              <Image
                source={{ uri: data.receipt_url.startsWith("data:") ? data.receipt_url : `${API_BASE_URL}${data.receipt_url}` }}
                style={{ width: 100, height: 140 }}
                resizeMode="cover"
              />
            </Pressable>
          ) : (
            <View style={{ width: 100, height: 140, backgroundColor: "#F7F7F8", borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#DBDCDF", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Text style={{ fontSize: 20, color: "#DBDCDF" }}>🖼</Text>
              <Text style={{ fontSize: 11, color: "#AAB4BF", fontWeight: "500" }}>없음</Text>
            </View>
          )}
        </View>

        <ThickDivider />

        {/* 전달 사항 */}
        <View style={{ padding: 16, paddingHorizontal: 20 }}>
          <SectionTitle>전달 사항</SectionTitle>
          <Text style={{ fontSize: 16, fontWeight: "500", color: data?.note ? "#19191B" : "#9EA3AD", lineHeight: 26 }}>
            {data?.note || "등록된 전달 사항이 없어요"}
          </Text>
        </View>
      </ScrollView>

      {/* 영수증 팝업 */}
      <Modal visible={receiptOpen} transparent animationType="fade" onRequestClose={() => setReceiptOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setReceiptOpen(false)}
        >
          <Pressable
            style={{ width: "90%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden" }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32 }}>마감 영수증</Text>
              <Pressable onPress={() => setReceiptOpen(false)} hitSlop={8}>
                <X size={20} color="#19191B" strokeWidth={2.5} />
              </Pressable>
            </View>
            {data?.receipt_url ? (
              <Image
                source={{ uri: data.receipt_url.startsWith("data:") ? data.receipt_url : `${API_BASE_URL}${data.receipt_url}` }}
                style={{ width: "100%", minHeight: 320 }}
                resizeMode="contain"
              />
            ) : (
              <View style={{ padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F7F8", minHeight: 260 }}>
                <View style={{ width: 64, height: 64, backgroundColor: "#DBDCDF", borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 28, color: "#9EA3AD" }}>🖼</Text>
                </View>
                <Text style={{ fontSize: 14, color: "#9EA3AD", textAlign: "center", lineHeight: 22 }}>{"영수증 이미지가\n아직 등록되지 않았어요"}</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 매출 수정 모달 */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setEditOpen(false)} />
          <View style={{ width: "100%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" }}>
            {/* 시트 헤더 */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>매출 수정</Text>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <X size={20} color="#70737B" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* 영업 매출 */}
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#AAB4BF", letterSpacing: 0.5, marginBottom: 12 }}>영업 매출</Text>
              {numInput("카드 매출", editCard, setEditCard)}
              {numInput("현금 매출", editCash, setEditCash)}
              {numInput("계좌이체", editTransfer, setEditTransfer)}
              {numInput("상품권", editGift, setEditGift)}

              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 8 }} />

              {/* 공제 */}
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#AAB4BF", letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>할인 및 환불</Text>
              {numInput("할인 금액", editDiscount, setEditDiscount)}
              {numInput("환불 금액", editRefund, setEditRefund)}

              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 8 }} />

              {/* 현금 시재 */}
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#AAB4BF", letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>현금</Text>
              {numInput("실제 현금 시재", editCashOnHand, setEditCashOnHand)}

              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 8 }} />

              {/* 전달 사항 */}
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#AAB4BF", letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>전달 사항</Text>
              <TextInput
                value={editNote}
                onChangeText={setEditNote}
                placeholder="사장 메모 입력"
                placeholderTextColor="#C5C7CA"
                multiline
                style={{
                  borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 12,
                  fontSize: 15, color: "#19191B", minHeight: 80,
                  textAlignVertical: "top", backgroundColor: "#FAFAFA",
                  marginBottom: 24,
                }}
              />

              <AnimatedPressable
                onPress={handleSave}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ height: 54, borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
                  {saving ? "저장 중..." : "수정 완료"}
                </Text>
              </AnimatedPressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default OwnerSalesDailyDetailScreen;
