import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import PageLayout from "@/components/PageLayout";
import { AlertCircle, Check } from "lucide-react-native";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { deleteStore } from "@/api/owner";
import { getCachedStoreInfo } from "@/utils/cachedApi";
import { formatPhone } from "@/utils/valid";
import type { ScreenProps } from "@/navigation/types";

const CAUTION_ITEMS = [
  "해당 매장에서 근무 중인 모든 직원의 정보가 삭제되어 조회할 수 없어요.",
  "등록된 매장의 매출 및 급여 정보가 삭제되고 복구되지 않아요.",
  "지금까지 누적된 직원 근태 정보를 더 이상 확인할 수 없어요.",
  "매장에 등록된 전 직원에게서도 매장 정보가 삭제되어 중요한 정보를 열람할 수 없어요.",
  "매장에 등록된 직원 계정도 함께 매장 이용이 제한 돼요.",
];

const OwnerStoreDeleteScreen: React.FC<ScreenProps<"OwnerStoreDelete">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const { storeId } = route.params;
  const [step, setStep] = useState<"caution" | "confirm">("caution");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    if (!storeId) return;
    getCachedStoreInfo(storeId)
      .then((info: any) => {
        setStore({
          name: info.name,
          code: info.code,
          category: info.industry,
          address: `${info.address ?? ""} ${info.address_detail ?? ""}`.trim(),
          ceo: info.owner_name,
          phone: info.phone,
          staffCount: info.staff_count != null ? `${info.staff_count}명` : null,
          openDate: info.open_date ?? null,
        });
      })
      .catch((e) => { console.warn(e); toast({ description: "매장 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]);

  const handleDelete = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await deleteStore(storeId);
      setDeleteDialogOpen(false);
      toast({ description: "매장이 삭제되었어요" });
      navigation.reset({ index: 0, routes: [{ name: "OwnerHome" }] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "매장 삭제에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── step 1: 유의사항 ── */
  if (step === "caution") {
    return (
      <PageLayout
        headerTitle="매장 삭제"
        onBack={() => navigation.goBack()}
        footer={
          <View style={{ flexDirection: "row", gap: 12 }}>
            <AnimatedPressable
              onPress={() => navigation.goBack()}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ flex: 1, height: 56, borderRadius: 16, borderWidth: 2, borderColor: "#DBDCDF", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B" }}>취소</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => agreed && setStep("confirm")}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: agreed ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>계속하기</Text>
            </AnimatedPressable>
          </View>
        }
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 24 }}>
            매장 삭제 전{"\n"}유의사항을 확인해 주세요
          </Text>

          {/* 유의사항 카드 */}
          <View style={{ backgroundColor: "#F7F7F8", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertCircle size={18} color="#70737B" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>유의사항</Text>
            </View>
            <View style={{ gap: 14 }}>
              {CAUTION_ITEMS.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={{ fontSize: 14, color: "#70737B", minWidth: 16 }}>{i + 1}.</Text>
                  <Text style={{ fontSize: 14, color: "#70737B", flex: 1, lineHeight: 21 }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 동의 체크박스 */}
          <AnimatedPressable
            onPress={() => setAgreed(!agreed)}
            scaleAmount={0.97}
            opacityAmount={0.8}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 6, borderWidth: 2,
              borderColor: agreed ? "#4261FF" : "#DBDCDF",
              backgroundColor: agreed ? "#4261FF" : "transparent",
              alignItems: "center", justifyContent: "center", marginTop: 2,
            }}>
              {agreed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={{ fontSize: 14, color: "#19191B", flex: 1, lineHeight: 21 }}>
              매장 삭제 시 모든 데이터가 삭제되며 복구되지 않음을 확인했어요.
            </Text>
          </AnimatedPressable>
        </View>
      </PageLayout>
    );
  }

  /* ── step 2: 매장 정보 확인 ── */
  return (
    <PageLayout
      headerTitle="매장 삭제"
      onBack={() => setStep("caution")}
      footer={
        <View style={{ flexDirection: "row", gap: 12 }}>
          <AnimatedPressable
            onPress={() => setStep("caution")}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flex: 1, height: 56, borderRadius: 16, borderWidth: 2, borderColor: "#DBDCDF", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B" }}>이전으로</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => setDeleteDialogOpen(true)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#FF3D3D", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>삭제하기</Text>
          </AnimatedPressable>
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", lineHeight: 30, marginBottom: 24 }}>
          삭제할 매장 정보를{"\n"}다시 한 번 확인해 주세요
        </Text>

        {/* 매장 정보 카드 */}
        <View style={{ borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 16, padding: 20 }}>
          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{store?.name ?? "매장"}</Text>
          </View>
          <View style={{ gap: 12 }}>
            <ConfirmRow label="업종"    value={store?.category ?? "-"} />
            <ConfirmRow label="주소"    value={store?.address ?? "-"} />
            <ConfirmRow label="대표자명" value={store?.ceo ?? "-"} />
            <ConfirmRow label="대표 번호" value={store?.phone ? formatPhone(store.phone) : "-"} />
            <ConfirmRow label="매장 코드" value={store?.code ?? "-"} isCode />
            {store?.staffCount && <ConfirmRow label="총 직원 수" value={store.staffCount} />}
            {store?.openDate  && <ConfirmRow label="개업일" value={store.openDate} />}
          </View>
        </View>

        <View style={{ marginTop: 16, backgroundColor: "#FFF5F5", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 13, color: "#FF3D3D", lineHeight: 20 }}>
            삭제하면 모든 데이터가 영구 삭제되며 복구할 수 없어요.
          </Text>
        </View>
      </View>

      {/* 최종 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        visible={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="매장 삭제"
        description={"정말로 매장을 삭제하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소",   onPress: () => setDeleteDialogOpen(false), variant: "cancel" },
          { label: "삭제하기", onPress: handleDelete, variant: "danger" },
        ]}
      />
    </PageLayout>
  );
};

const ConfirmRow: React.FC<{ label: string; value: string; isCode?: boolean }> = ({ label, value, isCode }) => (
  <View style={{ flexDirection: "row", gap: 16 }}>
    <Text style={{ fontSize: 14, color: "#70737B", minWidth: 72 }}>{label}</Text>
    <Text style={{ fontSize: 14, color: isCode ? "#4261FF" : "#19191B", fontWeight: isCode ? "600" : "400", flex: 1 }}>{value}</Text>
  </View>
);

export default OwnerStoreDeleteScreen;
