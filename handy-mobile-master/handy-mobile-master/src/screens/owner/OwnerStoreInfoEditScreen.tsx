import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { Check, ChevronDown, ChevronRight } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import Constants from "expo-constants";
import { updateStoreInfo, updateStoreMap } from "@/api/owner";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FocusInput from "@/components/FocusInput";
import KakaoAddressModal, { AddressCoords } from "@/components/KakaoAddressModal";
import type { ScreenProps } from "@/navigation/types";

const kakaoKey: string = Constants.expoConfig?.extra?.kakaoMapApiKey ?? "";
const kakaoRestKey: string = Constants.expoConfig?.extra?.kakaoRestApiKey ?? "";

async function geocodeAddress(address: string): Promise<AddressCoords | undefined> {
  if (!kakaoRestKey) return undefined;
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${kakaoRestKey}` } },
    );
    const data = await res.json();
    if (data.documents?.length > 0) {
      const { x, y } = data.documents[0];
      return { lat: parseFloat(y), lng: parseFloat(x) };
    }
  } catch {}
  return undefined;
}

const BUSINESS_TYPES = ["음식점 / 카페", "편의점", "판매 / 매장", "서비스업", "교육", "기타"];
const BUSINESS_TYPE_KO: Record<string, string> = {
  food: "음식점 / 카페", convenience: "편의점", retail: "판매 / 매장",
  service: "서비스업", education: "교육", other: "기타",
};

const fieldBase = {
  height: 52,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#DBDCDF",
  paddingHorizontal: 20,
  fontSize: 15,
  color: "#19191B",
  backgroundColor: "#FFFFFF",
} as const;

type EditKey = "storeName" | "addressDetail" | "ownerName" | "phone";

const EDIT_CONFIG: Record<EditKey, { label: string; placeholder: string; keyboard?: "phone-pad" }> = {
  storeName:     { label: "매장명",   placeholder: "매장명 입력" },
  addressDetail: { label: "상세 주소", placeholder: "상세 주소 입력 (선택)" },
  ownerName:     { label: "대표자명", placeholder: "대표자명 입력" },
  phone:         { label: "대표번호", placeholder: "'-' 포함 입력", keyboard: "phone-pad" },
};

const OwnerStoreInfoEditScreen: React.FC<ScreenProps<"OwnerStoreInfoEdit">> = ({
  route,
  navigation,
}) => {
  const { toast } = useToast();
  const initial = route.params.storeInfo ?? {};

  const [storeName, setStoreName] = useState(initial.name ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [addressCoords, setAddressCoords] = useState<AddressCoords | undefined>(undefined);
  const [addressDetail, setAddressDetail] = useState(initial.address_detail ?? "");
  const [industry, setIndustry] = useState(BUSINESS_TYPE_KO[initial.industry] ?? initial.industry ?? "");
  const [ownerName, setOwnerName] = useState(initial.owner_name ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");

  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editField, setEditField] = useState<EditKey | null>(null);
  const [tempValue, setTempValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const valueMap: Record<EditKey, string> = { storeName, addressDetail, ownerName, phone };
  const setterMap: Record<EditKey, (v: string) => void> = {
    storeName: setStoreName, addressDetail: setAddressDetail,
    ownerName: setOwnerName, phone: setPhone,
  };

  const openEdit = (key: EditKey) => {
    setTempValue(valueMap[key]);
    setEditField(key);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const confirmEdit = () => {
    if (editField) setterMap[editField](tempValue);
    setEditField(null);
  };

  const isDirty =
    storeName !== (initial.name ?? "") ||
    address !== (initial.address ?? "") ||
    addressDetail !== (initial.address_detail ?? "") ||
    industry !== (initial.industry ?? "") ||
    ownerName !== (initial.owner_name ?? "") ||
    phone !== (initial.phone ?? "");

  const handleBack = () => {
    if (isDirty) setCancelConfirmOpen(true);
    else if ((navigation as any).canGoBack?.()) navigation.goBack();
  };

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result: any = await updateStoreInfo({
        id: initial.id,
        name: storeName,
        address,
        address_detail: addressDetail || null,
        industry,
        owner_name: ownerName,
        phone,
      });
      // 카카오 모달에서 좌표를 받은 경우 항상 업데이트 (주소가 같더라도 StoreMap이 없을 수 있음)
      if (addressCoords) {
        updateStoreMap(initial.id, addressCoords.lat, addressCoords.lng).catch((e) => console.warn(e));
      }
      setConfirmOpen(false);
      if (result?.warning) {
        toast({ description: "매장 정보는 저장됐지만 출퇴근 위치 좌표 갱신에 실패했어요. 주소 검색에서 주소를 다시 선택해 주세요.", variant: "destructive" });
      } else {
        toast({ description: "매장 정보가 수정되었어요" });
      }
      navigation.goBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "수정 중 오류가 발생했어요.";
      setConfirmOpen(false);
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const activeConfig = editField ? EDIT_CONFIG[editField] : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageLayout
        headerTitle="매장 정보 수정"
        onBack={handleBack}
        footer={
          <AnimatedPressable
            onPress={() => setConfirmOpen(true)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ width: "100%", height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>매장 정보 수정하기</Text>
          </AnimatedPressable>
        }
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>

          {/* 매장명 */}
          <Field label="매장명" required>
            <FieldButton value={storeName} placeholder="매장명 입력" onPress={() => openEdit("storeName")} />
          </Field>

          {/* 주소 */}
          <Field label="주소" required>
            {Platform.OS === "web" ? (
              <AnimatedPressable
                onPress={() => setShowAddressModal(true)}
                scaleAmount={0.98} opacityAmount={0.85}
                style={[fieldBase, { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
              >
                <Text style={{ fontSize: 15, color: address ? "#19191B" : "#AAB4BF", flex: 1 }}>
                  {address || "주소 검색"}
                </Text>
                <ChevronDown size={20} color="#70737B" />
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                onPress={() => setShowAddressModal(true)}
                scaleAmount={0.98} opacityAmount={0.85}
                style={[fieldBase, { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
              >
                <Text style={{ fontSize: 15, color: address ? "#19191B" : "#AAB4BF", flex: 1 }} numberOfLines={1}>
                  {address || "주소 검색"}
                </Text>
                <ChevronRight size={20} color="#70737B" />
              </AnimatedPressable>
            )}
          </Field>

          {/* 상세 주소 */}
          <Field label="상세 주소">
            <FieldButton value={addressDetail} placeholder="상세 주소 입력 (선택)" onPress={() => openEdit("addressDetail")} />
          </Field>

          {/* 업종 */}
          <Field label="업종" required>
            <AnimatedPressable
              onPress={() => setShowTypeSheet(true)}
              scaleAmount={0.98} opacityAmount={0.85}
              style={[fieldBase, { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
            >
              <Text style={{ fontSize: 15, color: industry ? "#19191B" : "#AAB4BF" }}>
                {industry || "업종 선택"}
              </Text>
              <ChevronDown size={20} color="#70737B" />
            </AnimatedPressable>
          </Field>

          {/* 대표자명 */}
          <Field label="대표자명" required>
            <FieldButton value={ownerName} placeholder="대표자명 입력" onPress={() => openEdit("ownerName")} />
          </Field>

          {/* 대표번호 */}
          <Field label="대표번호" required>
            <FieldButton value={phone} placeholder="'-' 포함 입력" onPress={() => openEdit("phone")} />
          </Field>

        </ScrollView>
      </PageLayout>

      {/* 텍스트 입력 바텀시트 */}
      <BottomSheet isOpen={editField !== null} onClose={() => setEditField(null)} title={activeConfig?.label ?? ""}>
        <View style={{ paddingBottom: 8, gap: 12 }}>
          <FocusInput
            ref={inputRef}
            value={tempValue}
            onChangeText={setTempValue}
            placeholder={activeConfig?.placeholder ?? ""}
            placeholderTextColor="#AAB4BF"
            keyboardType={activeConfig?.keyboard ?? "default"}
            returnKeyType="done"
            onSubmitEditing={confirmEdit}
            defaultBorderColor="#DBDCDF"
            style={{ height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: "#19191B" }}
          />
          <AnimatedPressable
            onPress={confirmEdit}
            scaleAmount={0.97} opacityAmount={0.75}
            style={{ height: 52, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>확인</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

      {/* 업종 선택 시트 */}
      <BottomSheet isOpen={showTypeSheet} onClose={() => setShowTypeSheet(false)} title="업종 선택하기">
        <View style={{ paddingBottom: 8 }}>
          {BUSINESS_TYPES.map((t) => {
            const sel = industry === t;
            return (
              <AnimatedPressable
                key={t}
                onPress={() => { setIndustry(t); setShowTypeSheet(false); }}
                scaleAmount={0.98} opacityAmount={0.85}
                style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "#F0F4FF" : "#FFFFFF", marginBottom: 2 }}
              >
                <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{t}</Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* 카카오 주소 검색 */}
      <KakaoAddressModal
        visible={showAddressModal}
        kakaoKey={kakaoKey}
        onSelect={async (addr, coords) => {
          setAddress(addr);
          const resolved = coords ?? await geocodeAddress(addr);
          setAddressCoords(resolved);
        }}
        onClose={() => setShowAddressModal(false)}
      />

      <ConfirmDialog
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="매장 정보 수정"
        description="입력한 내용으로 매장 정보를 수정하시겠어요?"
        buttons={[
          { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
          { label: "수정하기", onPress: handleSave },
        ]}
      />

      <ConfirmDialog
        visible={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="수정 취소"
        description={"수정 중인 내용이 저장되지 않아요.\n정말 취소하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setCancelConfirmOpen(false), variant: "cancel" },
          { label: "확인", onPress: () => { setCancelConfirmOpen(false); navigation.goBack(); } },
        ]}
      />
    </KeyboardAvoidingView>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>
      {label}{required ? <Text style={{ color: "#FF3D3D" }}> *</Text> : null}
    </Text>
    {children}
  </View>
);

const FieldButton: React.FC<{ value: string; placeholder: string; onPress: () => void }> = ({ value, placeholder, onPress }) => (
  <AnimatedPressable
    onPress={onPress}
    scaleAmount={0.98} opacityAmount={0.85}
    style={{
      height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#DBDCDF",
      paddingHorizontal: 20, marginTop: 16,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: "#FFFFFF",
    }}
  >
    <Text style={{ fontSize: 15, color: value ? "#19191B" : "#AAB4BF", flex: 1 }} numberOfLines={1}>
      {value || placeholder}
    </Text>
    <ChevronRight size={18} color="#AAB4BF" />
  </AnimatedPressable>
);

export default OwnerStoreInfoEditScreen;
