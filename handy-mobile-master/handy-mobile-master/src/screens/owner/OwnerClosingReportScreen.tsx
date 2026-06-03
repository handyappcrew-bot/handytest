import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { getClosingReports, updateClosingReport, ClosingReport } from "@/api/owner";
import { getCachedStaffList } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const AVATAR_COLORS = ["#5C4033", "#C0392B", "#1ABC9C", "#2C3E50", "#8E44AD", "#E67E22", "#E91E63", "#4261FF", "#27AE60", "#FF9800"];
const getAvatarColor = (id: number) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

const fmt = (n: number | null | undefined) =>
  n != null ? `${n.toLocaleString()}원` : "-";

const OwnerClosingReportScreen: React.FC<ScreenProps<"OwnerClosingReport">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [reports, setReports] = useState<ClosingReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [detailReport, setDetailReport] = useState<ClosingReport | null>(null);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [staffNameMap, setStaffNameMap] = useState<Record<number, string>>({});

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    if (!storeId) return;
    getCachedStaffList(storeId).then((list: any) => {
      const map: Record<number, string> = {};
      (Array.isArray(list) ? list : []).forEach((s: any) => {
        if (s.id != null) map[s.id] = s.name || "";
      });
      setStaffNameMap(map);
    }).catch((e) => { console.warn(e); toast({ description: "직원 목록을 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]);

  const fetchReports = () => {
    if (!storeId) return;
    setLoading(true);
    setError(false);
    getClosingReports(storeId, selectedYear, selectedMonth)
      .then((data: any) => {
        const enriched = (Array.isArray(data) ? data : []).map((r: any) => ({
          ...r,
          employee_name: r.employee_name || (r.employee_id ? staffNameMap[r.employee_id] : undefined),
        }));
        setReports(enriched);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [storeId, selectedYear, selectedMonth, staffNameMap]);

  const goPrev = () => {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
    else setSelectedMonth(m => m - 1);
  };
  const goNext = () => {
    if (selectedYear === currentYear && selectedMonth >= currentMonth) return;
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
    else setSelectedMonth(m => m + 1);
  };
  const canGoNext = !(selectedYear === currentYear && selectedMonth >= currentMonth);

  const totalNetSales = useMemo(
    () => reports.reduce((s, r) => s + (r.net_sales ?? 0), 0),
    [reports],
  );

  const handleSaveNote = async () => {
    if (!detailReport || saving) return;
    setSaving(true);
    try {
      await updateClosingReport(storeId, detailReport.id, { manager_note: editNote });
      setReports(prev => prev.map(r => r.id === detailReport.id ? { ...r, manager_note: editNote } : r));
      setDetailReport(prev => prev ? { ...prev, manager_note: editNote } : null);
      toast({ description: "메모가 저장되었어요." });
    } catch {
      toast({ description: "저장에 실패했어요.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>마감 보고</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {/* Month Navigator */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AnimatedPressable onPress={goPrev} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronLeft size={20} color="#19191B" />
        </AnimatedPressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>
          {selectedYear}년 {selectedMonth}월
        </Text>
        <AnimatedPressable onPress={goNext} style={{ padding: 4, opacity: canGoNext ? 1 : 0.3 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronRight size={20} color="#19191B" />
        </AnimatedPressable>
      </View>

      {/* Summary bar */}
      {reports.length > 0 && (
        <View style={{ marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: "#F0F3FF", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: "#4261FF" }}>{selectedMonth}월 총 순매출</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>{totalNetSales.toLocaleString()}원</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <DotsLoader />
          </View>
        ) : error ? (
          <View style={{ paddingTop: 48 }}>
            <ErrorState onRetry={fetchReports} />
          </View>
        ) : reports.length === 0 ? (
          <View style={{ paddingTop: 48 }}>
            <EmptyState message={`${selectedYear}년 ${selectedMonth}월\n마감 보고가 없어요`} />
          </View>
        ) : (
          reports.map((r) => {
            const avatarColor = r.employee_id ? getAvatarColor(r.employee_id) : "#9EA3AD";
            const dateStr = r.report_date.replace(/-/g, ".");
            return (
              <AnimatedPressable
                key={r.id}
                onPress={() => { setDetailReport(r); setEditNote(r.manager_note ?? ""); }}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 16,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                  overflow: "hidden",
                }}
              >
                {/* Card header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {r.employee_name ? (
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: avatarColor, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{r.employee_name.charAt(0)}</Text>
                      </View>
                    ) : null}
                    <View>
                      {r.employee_name && (
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>{r.employee_name}</Text>
                      )}
                      <Text style={{ fontSize: 12, color: "#9EA3AD", marginTop: r.employee_name ? 2 : 0 }}>{dateStr}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#4261FF", letterSpacing: -0.3 }}>{fmt(r.net_sales)}</Text>
                    <Text style={{ fontSize: 11, color: "#9EA3AD", marginTop: 2 }}>순매출</Text>
                  </View>
                </View>

                {/* Sales grid */}
                <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingHorizontal: 14, paddingVertical: 10 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <SalesChip label="카드" value={r.card_sales} />
                    <SalesChip label="현금" value={r.cash_sales} />
                    <SalesChip label="이체" value={r.transfer_sales} />
                    <SalesChip label="상품권" value={r.gift_sales} />
                  </View>
                  {(r.discount_amount > 0 || r.refund_amount > 0) && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      {r.discount_amount > 0 && <SalesChip label="할인" value={-r.discount_amount} danger />}
                      {r.refund_amount > 0 && <SalesChip label="환불" value={-r.refund_amount} danger />}
                    </View>
                  )}
                </View>

                {/* Cash on hand */}
                {r.cash_on_hand != null && (
                  <View style={{
                    borderTopWidth: 1, borderTopColor: "#F0F0F0",
                    paddingHorizontal: 14, paddingVertical: 8,
                    flexDirection: "row", justifyContent: "space-between",
                  }}>
                    <Text style={{ fontSize: 12, color: "#9EA3AD" }}>실 현금</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: r.cash_shortage > 0 ? "#FF3D3D" : "#19191B" }}>
                      {fmt(r.cash_on_hand)}
                      {r.cash_shortage !== 0 && (
                        <Text style={{ color: r.cash_shortage > 0 ? "#FF3D3D" : "#10C97D" }}>
                          {r.cash_shortage > 0 ? ` (부족 ${r.cash_shortage.toLocaleString()}원)` : ` (+${Math.abs(r.cash_shortage).toLocaleString()}원)`}
                        </Text>
                      )}
                    </Text>
                  </View>
                )}

                {/* Manager note */}
                {r.manager_note ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 12, color: "#9EA3AD", marginBottom: 2 }}>사장 메모</Text>
                    <Text style={{ fontSize: 13, color: "#19191B" }} numberOfLines={2}>{r.manager_note}</Text>
                  </View>
                ) : null}
              </AnimatedPressable>
            );
          })
        )}
      </ScrollView>

      {/* Detail bottom sheet */}
      <BottomSheet
        isOpen={!!detailReport}
        onClose={() => setDetailReport(null)}
        title={detailReport ? `${detailReport.report_date.replace(/-/g, ".")} 마감 보고` : ""}
      >
        {detailReport && (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            <View style={{ gap: 10 }}>
              {/* Employee */}
              {detailReport.employee_name && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: "#70737B" }}>담당 직원</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>{detailReport.employee_name}</Text>
                </View>
              )}
              <DetailRow label="카드 매출" value={fmt(detailReport.card_sales)} />
              <DetailRow label="현금 매출" value={fmt(detailReport.cash_sales)} />
              <DetailRow label="이체 매출" value={fmt(detailReport.transfer_sales)} />
              <DetailRow label="상품권 매출" value={fmt(detailReport.gift_sales)} />
              <DetailRow label="총 매출" value={fmt(detailReport.gross_sales)} bold />
              {detailReport.discount_amount > 0 && (
                <DetailRow label="할인" value={`-${fmt(detailReport.discount_amount)}`} danger />
              )}
              {detailReport.refund_amount > 0 && (
                <DetailRow label="환불" value={`-${fmt(detailReport.refund_amount)}`} danger />
              )}
              <DetailRow label="순매출" value={fmt(detailReport.net_sales)} bold blue />
              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }} />
              <DetailRow label="실 현금" value={fmt(detailReport.cash_on_hand)} />
              {detailReport.cash_shortage !== 0 && (
                <DetailRow
                  label="현금 과부족"
                  value={detailReport.cash_shortage > 0
                    ? `부족 ${detailReport.cash_shortage.toLocaleString()}원`
                    : `초과 ${Math.abs(detailReport.cash_shortage).toLocaleString()}원`}
                  danger={detailReport.cash_shortage > 0}
                />
              )}
              <View style={{ height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 }} />
              {/* Manager note editable */}
              <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 4 }}>사장 메모</Text>
              <View style={{
                borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10,
                minHeight: 80, padding: 12,
              }}>
                <Text
                  style={{ fontSize: 14, color: editNote ? "#19191B" : "#AAB4BF", lineHeight: 20 }}
                  onPress={() => {}}
                >
                  {editNote || "메모 없음 (탭하여 편집 불가 — 저장 버튼 사용)"}
                </Text>
              </View>
              <AnimatedPressable
                onPress={handleSaveNote}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ marginTop: 12, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#4261FF" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
                  {saving ? "저장 중..." : "메모 저장"}
                </Text>
              </AnimatedPressable>
            </View>
          </ScrollView>
        )}
      </BottomSheet>
    </SafeAreaView>
    </FadeScreen>
  );
};

const SalesChip: React.FC<{ label: string; value: number; danger?: boolean }> = ({ label, value, danger }) => (
  <View style={{ flex: 1, backgroundColor: danger ? "#FFF0EE" : "#F7F7F8", borderRadius: 8, padding: 8, alignItems: "center" }}>
    <Text style={{ fontSize: 10, color: danger ? "#FF5959" : "#9EA3AD", marginBottom: 2 }}>{label}</Text>
    <Text style={{ fontSize: 12, fontWeight: "600", color: danger ? "#FF5959" : "#19191B" }}>
      {value != null ? `${value.toLocaleString()}` : "-"}
    </Text>
  </View>
);

const DetailRow: React.FC<{ label: string; value: string; bold?: boolean; blue?: boolean; danger?: boolean }> = ({ label, value, bold, blue, danger }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
    <Text style={{ fontSize: 14, color: "#70737B" }}>{label}</Text>
    <Text style={{
      fontSize: 14,
      fontWeight: bold ? "700" : "500",
      color: danger ? "#FF3D3D" : blue ? "#4261FF" : "#19191B",
    }}>{value}</Text>
  </View>
);

export default OwnerClosingReportScreen;
