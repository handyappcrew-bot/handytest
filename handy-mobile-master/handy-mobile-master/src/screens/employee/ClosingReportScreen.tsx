import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Pressable, Image, ActivityIndicator,
} from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ChevronLeft, X, Upload, RefreshCw, CheckCircle } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import PrimaryButton from "@/components/PrimaryButton";
import BottomSheet from "@/components/BottomSheet";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import { useToast } from "@/components/Toast";
import { submitClosingReport, checkClosingReport } from "@/api/employee";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const ClosingReportScreen: React.FC<ScreenProps<"ClosingReport">> = ({ navigation }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [submittedByName, setSubmittedByName] = useState<string | null>(null);

  useEffect(() => {
    const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
    checkClosingReport(storeId)
      .then((res) => {
        setAlreadyDone(res?.is_completed ?? false);
        setSubmittedByName(res?.submitted_by_name ?? null);
      })
      .catch((e) => { console.warn(e); toast({ description: "마감 보고 정보를 불러오지 못했어요.", variant: "destructive" }); })
      .finally(() => setChecking(false));
  }, []);

  const [cardSales, setCardSales] = useState("");
  const [cashSales, setCashSales] = useState("");
  const [transferSales, setTransferSales] = useState("");
  const [voucherSales, setVoucherSales] = useState("");

  const [discountAmount, setDiscountAmount] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [cashOnHand, setCashOnHand] = useState("");

  const [receiptImage, setReceiptImage] = useState<{ uri: string; base64: string } | null>(null);

  const [additionalMessage, setAdditionalMessage] = useState("");
  const [messageSheetText, setMessageSheetText] = useState("");
  const [messageInputFocused, setMessageInputFocused] = useState(false);

  const [showReceiptSheet, setShowReceiptSheet] = useState(false);
  const [showMessageSheet, setShowMessageSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const parseAmt = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;

  const displayValue = (value: string) => {
    if (!value) return "";
    return Number(value).toLocaleString();
  };

  const handleNumberInput = (value: string, setter: (v: string) => void) => {
    setter(value.replace(/[^0-9]/g, ""));
  };

  const pickFromAlbum = async () => {
    setShowReceiptSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (a.base64) setReceiptImage({ uri: a.uri, base64: `data:image/jpeg;base64,${a.base64}` });
    }
  };

  const pickFromCamera = async () => {
    setShowReceiptSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (a.base64) setReceiptImage({ uri: a.uri, base64: `data:image/jpeg;base64,${a.base64}` });
    }
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setShowConfirmModal(false);
    try {
      const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
      const today = new Date();
      const reportDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await submitClosingReport({
        store_id: storeId,
        report_date: reportDate,
        card_sales: parseAmt(cardSales),
        cash_sales: parseAmt(cashSales),
        transfer_sales: parseAmt(transferSales),
        gift_sales: parseAmt(voucherSales),
        discount_amount: parseAmt(discountAmount),
        refund_amount: parseAmt(refundAmount),
        cash_on_hand: parseAmt(cashOnHand),
        manager_note: additionalMessage,
        receipt_image_url: receiptImage?.base64 ?? null,
      });
      toast({ description: "마감 보고가 완료 되었어요." });
      navigation.goBack();
    } catch (err: any) {
      const raw = err instanceof Error ? err.message : null;
      const msg = (raw && raw !== "[object Object]") ? raw : "마감 보고 중 오류가 발생했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dateLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} (${days[now.getDay()]})`;

  const inputContainerStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  };

  const renderInput = (label: string, value: string, onChange: (v: string) => void, placeholder = "숫자만 입력") => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280", marginBottom: 8 }}>{label}</Text>
      <View style={inputContainerStyle}>
        <TextInput
          value={displayValue(value)}
          onChangeText={(t) => handleNumberInput(t, onChange)}
          placeholder={placeholder}
          placeholderTextColor="#AAB4BF"
          keyboardType="numeric"
          style={{ flex: 1, fontSize: 16, color: "#292B2E" }}
        />
        <Text style={{ fontSize: 16, color: "#6B7280", marginLeft: 8 }}>원</Text>
      </View>
    </View>
  );

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <ActivityIndicator size="large" color="#4261FF" />
      </SafeAreaView>
    );
  }

  if (alreadyDone) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>마감 보고</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <CheckCircle size={36} color="#2E7D32" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", marginBottom: 12, textAlign: "center" }}>마감보고 완료</Text>
          <Text style={{ fontSize: 15, color: "#70737B", textAlign: "center", lineHeight: 22 }}>
            {submittedByName
              ? `${submittedByName}님이 오늘 마감보고를 완료했어요.`
              : "오늘 마감보고가 이미 완료됐어요."}
            {"\n"}다음 영업일 오픈 후 다시 이용할 수 있어요.
          </Text>
          <AnimatedPressable
            onPress={() => navigation.goBack()}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ marginTop: 40, height: 52, width: "100%", borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={handleBack} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>마감 보고</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#292B2E", lineHeight: 30 }}>{dateLabel}</Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#292B2E", lineHeight: 30, marginBottom: 8 }}>마감 보고하기</Text>

          {step === 1 && (
            <>
              <Text style={{ fontSize: 14, color: "#8E8E93", marginBottom: 32 }}>매출이 없는 항목은 입력하지 않아도 돼요</Text>
              {renderInput("카드 매출 금액", cardSales, setCardSales)}
              {renderInput("현금 매출 금액", cashSales, setCashSales)}
              {renderInput("계좌이체 매출 금액", transferSales, setTransferSales)}
              {renderInput("상품권 매출 금액", voucherSales, setVoucherSales)}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={{ fontSize: 14, color: "#8E8E93", marginBottom: 32 }}>매출이 없는 항목은 입력하지 않아도 돼요</Text>
              {renderInput("할인 금액", discountAmount, setDiscountAmount)}
              {renderInput("환불금액", refundAmount, setRefundAmount)}
              {renderInput("현금 시재", cashOnHand, setCashOnHand)}

              {/* 현금 과부족 자동 계산 */}
              {(cashOnHand || cashSales) ? (() => {
                const onHand = parseAmt(cashOnHand);
                const sales  = parseAmt(cashSales);
                const diff   = onHand - sales;
                const isOver  = diff > 0;
                const isShort = diff < 0;
                const diffColor = diff === 0 ? "#22C55E" : isShort ? "#EF4444" : "#4261FF";
                const diffBg    = diff === 0 ? "#F0FDF4" : isShort ? "#FEF2F2" : "#EEF2FF";
                return (
                  <View style={{ marginBottom: 24, borderRadius: 14, backgroundColor: diffBg, padding: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: diffColor, marginBottom: 12 }}>
                      {diff === 0 ? "현금이 딱 맞아요" : isShort ? `현금이 ${Math.abs(diff).toLocaleString()}원 부족해요` : `현금이 ${Math.abs(diff).toLocaleString()}원 더 있어요`}
                    </Text>
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#6B7280" }}>현금 시재 (실제)</Text>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#292B2E" }}>{onHand.toLocaleString()}원</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#6B7280" }}>현금 매출 (예상)</Text>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#292B2E" }}>− {sales.toLocaleString()}원</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: diffColor, opacity: 0.2, marginVertical: 2 }} />
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: diffColor }}>과부족</Text>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: diffColor }}>
                          {diff === 0 ? "0원" : `${isOver ? "+" : ""}${diff.toLocaleString()}원`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })() : null}
            </>
          )}

          {step === 3 && (
            <>
              <Text style={{ fontSize: 14, color: "#8E8E93", marginBottom: 32 }}>
                매출액이 포함된 마감 영수증이 있다면{"\n"}함께 업로드 해주세요
              </Text>
              <View style={{ alignItems: "center", marginTop: 32 }}>
                {receiptImage ? (
                  <View style={{ width: 220, gap: 12 }}>
                    <Image source={{ uri: receiptImage.uri }} style={{ width: 220, height: 320, borderRadius: 12 }} resizeMode="cover" />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <AnimatedPressable
                        onPress={() => setShowReceiptSheet(true)}
                        scaleAmount={0.88} opacityAmount={0.7}
                        style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}
                      >
                        <RefreshCw size={15} color="#70737B" />
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => setReceiptImage(null)}
                        scaleAmount={0.88} opacityAmount={0.7}
                        style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF0EE", alignItems: "center", justifyContent: "center" }}
                      >
                        <X size={15} color="#FF5959" />
                      </AnimatedPressable>
                    </View>
                  </View>
                ) : (
                  <AnimatedPressable
                    onPress={() => setShowReceiptSheet(true)}
                    scaleAmount={0.97}
                    opacityAmount={0.75}
                    style={{
                      width: 220, height: 320, borderRadius: 12,
                      borderWidth: 1, borderColor: "#EBEBEB",
                      borderStyle: "dashed",
                      alignItems: "center", justifyContent: "center", gap: 12,
                    }}
                  >
                    <Upload size={36} color="#AAB4BF" />
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#70737B", textAlign: "center", lineHeight: 22 }}>
                      마감 영수증{"\n"}사진 업로드하기
                    </Text>
                  </AnimatedPressable>
                )}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={{ fontSize: 14, color: "#8E8E93", marginBottom: 32 }}>사장님께 전달할 내용이 있다면 입력해 주세요</Text>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280", marginBottom: 8 }}>추가 전달 내용(선택)</Text>
              <AnimatedPressable
                onPress={() => { setMessageSheetText(additionalMessage); setShowMessageSheet(true); }}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  minHeight: 52,
                }}
              >
                <Text style={{ fontSize: 16, color: additionalMessage ? "#292B2E" : "#C5C7CA" }}>
                  {additionalMessage || "전달내용 입력"}
                </Text>
              </AnimatedPressable>
              <Text style={{ fontSize: 13, color: "#8E8E93", textAlign: "right", marginTop: 4 }}>{additionalMessage.length}/100</Text>
            </>
          )}
        </ScrollView>

        {/* Bottom Button */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF" }}>
          {step < 4 ? (
            <AnimatedPressable
              onPress={() => setStep(step + 1)}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{
                height: 56,
                borderRadius: 14,
                backgroundColor: "#4261FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "600", color: "#FFFFFF" }}>다음</Text>
            </AnimatedPressable>
          ) : (
            <AnimatedPressable
              onPress={() => setShowConfirmModal(true)}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{
                height: 56,
                borderRadius: 14,
                backgroundColor: "#4261FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "600", color: "#FFFFFF" }}>마감 보고하기</Text>
            </AnimatedPressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* 영수증 업로드 */}
      <ImagePickerSheet
        isOpen={showReceiptSheet}
        onClose={() => setShowReceiptSheet(false)}
        title="마감 영수증 업로드"
        onAlbum={pickFromAlbum}
        onCamera={pickFromCamera}
      />

      {/* 추가 전달 내용 입력 시트 */}
      <BottomSheet isOpen={showMessageSheet} onClose={() => setShowMessageSheet(false)} title="추가 전달 내용 입력">
        <View style={{ position: "relative" }}>
          <TextInput
            value={messageSheetText}
            onChangeText={(t) => { if (t.length <= 100) setMessageSheetText(t); }}
            placeholder="전달할 내용을 입력해 주세요"
            placeholderTextColor="#AAB4BF"
            multiline
            maxLength={100}
            onFocus={() => setMessageInputFocused(true)}
            onBlur={() => setMessageInputFocused(false)}
            style={{
              minHeight: 160,
              borderWidth: 2,
              borderColor: messageInputFocused ? "#4261FF" : "#EBEBEB",
              borderRadius: 12,
              backgroundColor: "#FFFFFF",
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingBottom: 28,
              fontSize: 15,
              color: "#19191B",
              textAlignVertical: "top",
            }}
          />
          <Text style={{ position: "absolute", bottom: 10, right: 12, fontSize: 13, color: "#AAB4BF" }}>{messageSheetText.length}/100</Text>
        </View>
        <Text style={{ marginBottom: 24 }}></Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <AnimatedPressable
            onPress={() => setShowMessageSheet(false)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flex: 1, height: 56, borderRadius: 10, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>취소</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { setAdditionalMessage(messageSheetText); setShowMessageSheet(false); }}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flex: 1, height: 56, borderRadius: 10, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>입력하기</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

      {/* Confirm Modal */}
      <ConfirmDialog
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="마감 보고하기"
        description={"마감 보고를 진행하시겠어요?\n작성한 내용은 사장님께 전달돼요."}
        buttons={[
          { label: "취소", onPress: () => setShowConfirmModal(false), variant: "cancel" },
          { label: "확인", onPress: handleConfirm, variant: "confirm" },
        ]}
      >
        <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 }}>
          {[
            { label: "카드매출", value: cardSales ? `${Number(cardSales).toLocaleString()}원` : "-" },
            { label: "현금매출", value: cashSales ? `${Number(cashSales).toLocaleString()}원` : "-" },
            { label: "계좌이체", value: transferSales ? `${Number(transferSales).toLocaleString()}원` : "-" },
            { label: "상품권", value: voucherSales ? `${Number(voucherSales).toLocaleString()}원` : "-" },
            { label: "할인금액", value: discountAmount ? `${Number(discountAmount).toLocaleString()}원` : "-" },
            { label: "환불금액", value: refundAmount ? `${Number(refundAmount).toLocaleString()}원` : "-" },
            { label: "현금시재", value: cashOnHand ? `${Number(cashOnHand).toLocaleString()}원` : "-" },
            { label: "현금과부족", value: (() => { const d = parseAmt(cashOnHand) - parseAmt(cashSales); if (!cashOnHand && !cashSales) return "-"; return d === 0 ? "없음" : d > 0 ? `+${d.toLocaleString()}원 (초과)` : `${d.toLocaleString()}원 (부족)`; })() },
            { label: "영수증", value: receiptImage ? "있음" : "없음" },
            { label: "추가전달내용", value: additionalMessage ? (additionalMessage.length > 18 ? additionalMessage.slice(0, 18) + "…" : additionalMessage) : "-" },
          ].map(({ label, value }, i, arr) => (
            <View
              key={label}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: "#EBEBEB" }}
            >
              <Text style={{ fontSize: 13, color: "#70737B" }}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#19191B" }}>{value}</Text>
            </View>
          ))}
        </View>
      </ConfirmDialog>
    </SafeAreaView>
  );
};

export default ClosingReportScreen;
