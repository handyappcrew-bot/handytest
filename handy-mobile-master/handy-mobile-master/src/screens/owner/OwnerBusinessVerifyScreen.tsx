import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { AlertCircle, CheckCircle, Check, ChevronDown } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import BottomSheet from "@/components/BottomSheet";
import KakaoAddressModal from "@/components/KakaoAddressModal";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { openDaumPostcode } from "@/utils/postcode";
import type { ScreenProps } from "@/navigation/types";

const BUSINESS_TYPES = [
  { value: "food", label: "음식점 / 카페" },
  { value: "convenience", label: "편의점" },
  { value: "retail", label: "판매 / 매장" },
  { value: "service", label: "서비스업" },
  { value: "education", label: "교육" },
  { value: "other", label: "기타" },
];


const OwnerBusinessVerifyScreen: React.FC<ScreenProps<"OwnerBusinessVerify">> = ({
  navigation,
}) => {
  const { toast } = useToast();
  const [rawDigits, setRawDigits] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorText, setErrorText] = useState("올바르지 않은 사업자 번호 형식이에요");
  const [bizFocused, setBizFocused] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [storeNameFocused, setStoreNameFocused] = useState(false);
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [addressDetailFocused, setAddressDetailFocused] = useState(false);
  const [businessType, setBusinessType] = useState("");
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerNameFocused, setOwnerNameFocused] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerPhoneFocused, setOwnerPhoneFocused] = useState(false);

  const isComplete = rawDigits.length === 10;
  const isValidFormat = /^\d{10}$/.test(rawDigits);

  const formatBusinessNumber = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const handleChange = (txt: string) => {
    const digits = txt.replace(/\D/g, "").slice(0, 10);
    setRawDigits(digits);
    if (isError) {
      setIsError(false);
      setErrorText("올바르지 않은 사업자 번호 형식이에요");
    }
  };

  const handleVerify = async () => {
    if (!isValidFormat) return;

    try {
      const data = await api.get<{ data?: Array<{ b_stt_cd?: string }> }>(
        `/api/owner/business/${rawDigits}`
      );
      const sttCode = data?.data?.[0]?.b_stt_cd;
      if (sttCode === "01") {
        setIsError(false);
        setIsVerified(true);
      } else if (sttCode === "02" || sttCode === "03") {
        setIsVerified(false);
        setIsError(true);
        setErrorText(
          sttCode === "02" ? "휴업 상태인 사업자 번호에요" : "폐업된 사업자 번호에요"
        );
      } else {
        setIsVerified(false);
        setIsError(true);
        setErrorText("등록되지 않은 사업자 번호에요");
      }
    } catch {
      setIsVerified(false);
      setIsError(true);
      setErrorText("사업자 번호 조회 중 오류가 발생했어요");
    }
  };

  const isStoreFormValid =
    isVerified &&
    storeName.trim() &&
    address.trim() &&
    businessType &&
    ownerName.trim() &&
    ownerPhone.trim();

  const handleSubmit = () => {
    if (!isStoreFormValid) {
      toast({ description: "모든 필수 정보를 입력 해주세요.", variant: "destructive" });
      return;
    }
    navigation.navigate("OwnerBusinessUpload", {
      rawDigits: formatBusinessNumber(rawDigits),
      storeName,
      address,
      addressDetail,
      businessType,
      ownerName,
      ownerPhone,
    });
  };

  const getFieldStyle = (focused: boolean, errored?: boolean) => ({
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: errored ? "#FF3D3D" : focused ? "#4261FF" : "#EBEBEB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#19191B" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  });

  const verifiedFieldStyle = {
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#DBDCDF",
    backgroundColor: "#F7F7F8",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#AAB4BF" as const,
  };

  const selectedTypeLabel = BUSINESS_TYPES.find((t) => t.value === businessType)?.label;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageLayout
        headerTitle="매장 등록"
        footer={
          isVerified ? (
            <AnimatedPressable
              onPress={handleSubmit}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{
                width: "100%",
                height: 56,
                borderRadius: 16,
                backgroundColor: isStoreFormValid ? "#4261FF" : "#DBDCDF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                사업자 등록증 업로드하기
              </Text>
            </AnimatedPressable>
          ) : (
            <AnimatedPressable
              onPress={handleVerify}
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
                  fontWeight: "600",
                  color: "#FFFFFF",
                }}
              >
                사업자 번호 조회하기
              </Text>
            </AnimatedPressable>
          )
        }
      >
        <ScrollView showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#19191B", letterSpacing: -0.48, lineHeight: 32, marginBottom: 24 }}>
            {"등록할 매장의\n사업자 인증을 진행할게요"}
          </Text>
          {/* 사업자 번호 */}
          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B", marginBottom: 8 }}>
              사업자 번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <TextInput
              value={formatBusinessNumber(rawDigits)}
              onChangeText={handleChange}
              onFocus={() => setBizFocused(true)}
              onBlur={() => setBizFocused(false)}
              placeholder="사업자 번호 (숫자만 입력)"
              placeholderTextColor="#AAB4BF"
              keyboardType="numeric"
              editable={!isVerified}
              style={[
                isVerified ? verifiedFieldStyle : {
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isError ? "#FF3D3D" : bizFocused ? "#4261FF" : "#EBEBEB",
                  backgroundColor: "#FFFFFF",
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: "#19191B",
                },
              ]}
            />
            {isVerified && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <CheckCircle size={16} color="#10C97D" />
                <Text style={{ fontSize: 13, color: "#10C97D" }}>
                  조회되었어요
                </Text>
              </View>
            )}
            {isError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={16} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>
                  {errorText}
                </Text>
              </View>
            )}
          </View>

          {/* 매장 정보 (인증 후) */}
          {isVerified && (
            <>
              <View style={{ height: 12, backgroundColor: "#F7F7F8", marginVertical: 24 }} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 20 }}>
                매장 정보
              </Text>

              {/* 매장명 */}
              <Field label="매장명" required>
                <TextInput
                  value={storeName}
                  onChangeText={setStoreName}
                  onFocus={() => setStoreNameFocused(true)}
                  onBlur={() => setStoreNameFocused(false)}
                  placeholder="매장명 입력"
                  placeholderTextColor="#AAB4BF"
                  style={{
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: storeNameFocused ? "#4261FF" : "#EBEBEB",
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 16,
                    fontSize: 16,
                    color: "#19191B",
                  }}
                />
              </Field>

              {/* 주소 */}
              <Field label="주소" required>
                <AnimatedPressable
                  onPress={() => {
                    if (Platform.OS === "web") openDaumPostcode(setAddress);
                    else setShowAddressModal(true);
                  }}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={getFieldStyle(false)}
                >
                  <Text style={{ fontSize: 16, color: address ? "#19191B" : "#AAB4BF", flex: 1 }} numberOfLines={1}>
                    {address || "주소 검색"}
                  </Text>
                  <ChevronDown size={20} color="#9EA3AD" />
                </AnimatedPressable>
              </Field>

              {/* 상세 주소 */}
              <Field label="상세 주소">
                <TextInput
                  value={addressDetail}
                  onChangeText={setAddressDetail}
                  onFocus={() => setAddressDetailFocused(true)}
                  onBlur={() => setAddressDetailFocused(false)}
                  placeholder="상세 주소 입력"
                  placeholderTextColor="#AAB4BF"
                  style={{
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: addressDetailFocused ? "#4261FF" : "#EBEBEB",
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 16,
                    fontSize: 16,
                    color: "#19191B",
                  }}
                />
              </Field>

              {/* 업종 */}
              <Field label="업종" required>
                <AnimatedPressable
                  onPress={() => setShowTypeSheet(true)}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={getFieldStyle(false)}
                >
                  <Text style={{ fontSize: 16, color: businessType ? "#19191B" : "#AAB4BF" }}>
                    {selectedTypeLabel ?? "업종 선택"}
                  </Text>
                  <ChevronDown size={20} color="#9EA3AD" />
                </AnimatedPressable>
              </Field>

              {/* 대표자명 */}
              <Field label="대표자명" required>
                <TextInput
                  value={ownerName}
                  onChangeText={setOwnerName}
                  onFocus={() => setOwnerNameFocused(true)}
                  onBlur={() => setOwnerNameFocused(false)}
                  placeholder="대표자명 입력"
                  placeholderTextColor="#AAB4BF"
                  style={{
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: ownerNameFocused ? "#4261FF" : "#EBEBEB",
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 16,
                    fontSize: 16,
                    color: "#19191B",
                  }}
                />
              </Field>

              {/* 대표번호 */}
              <Field label="대표번호" required>
                <TextInput
                  value={ownerPhone}
                  onChangeText={setOwnerPhone}
                  onFocus={() => setOwnerPhoneFocused(true)}
                  onBlur={() => setOwnerPhoneFocused(false)}
                  placeholder="대표번호 입력"
                  placeholderTextColor="#AAB4BF"
                  keyboardType="phone-pad"
                  style={{
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: ownerPhoneFocused ? "#4261FF" : "#EBEBEB",
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 16,
                    fontSize: 16,
                    color: "#19191B",
                  }}
                />
              </Field>
            </>
          )}
        </ScrollView>
      </PageLayout>

      {/* 카카오 주소 검색 */}
      <KakaoAddressModal
        visible={showAddressModal}
        onSelect={(addr) => setAddress(addr)}
        onClose={() => setShowAddressModal(false)}
      />

      {/* 업종 선택 시트 */}
      <BottomSheet isOpen={showTypeSheet} onClose={() => setShowTypeSheet(false)} title="업종을 선택 해주세요">
        <View style={{ paddingBottom: 8 }}>
          {BUSINESS_TYPES.map((t) => {
            const sel = businessType === t.value;
            return (
              <AnimatedPressable
                key={t.value}
                onPress={() => {
                  setBusinessType(t.value);
                  setShowTypeSheet(false);
                }}
                scaleAmount={0.98}
                opacityAmount={0.85}
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
                  {t.label}
                </Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B", marginBottom: 8 }}>
      {label}
      {required ? <Text style={{ color: "#FF3D3D" }}> *</Text> : null}
    </Text>
    {children}
  </View>
);

export default OwnerBusinessVerifyScreen;
