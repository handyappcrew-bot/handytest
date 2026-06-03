import React, { useState } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { withdrawAuth } from "@/api/public";
import type { ScreenProps } from "@/navigation/types";

const REASONS = [
  "사용법이 복잡하고 어려웠어요",
  "더 이상 일을 계속하지 않아요",
  "자주 사용하지 않았어요",
  "사용 중 잦은 오류가 발생했어요",
  "기타 (직접 작성)",
];

const WithdrawalScreen: React.FC<ScreenProps<"Withdrawal">> = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOther = selectedReason === "기타 (직접 작성)";
  const canWithdraw = selectedReason !== null && (!isOther || otherText.trim().length > 0);

  const goBack = () => {
    if (step === 2) setStep(1);
    else navigation.goBack();
  };

  const handleConfirmWithdraw = async () => {
    setConfirmDialogOpen(false);
    setSubmitting(true);
    const finalReason = isOther ? otherText.trim() : selectedReason ?? "";
    try {
      await withdrawAuth(finalReason);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={goBack} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>회원 탈퇴</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 120 }}>

          {/* Step 1 — 유의사항 */}
          {step === 1 && (
            <>
              <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.48, color: "#19191B", lineHeight: 34, marginTop: 16, marginBottom: 32 }}>
                {"회원 탈퇴 전\n유의사항을 확인해주세요"}
              </Text>

              {/* Notice box */}
              <View style={{ backgroundColor: "#F7F7F8", borderRadius: 16, padding: 16, marginBottom: 24 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FF3D3D", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#FF3D3D", lineHeight: 14 }}>!</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "600", letterSpacing: -0.3, color: "#19191B" }}>탈퇴 전 유의사항</Text>
                </View>
                <View style={{ gap: 16 }}>
                  {[
                    "회원 탈퇴 시 근태 기록, 급여 명세서, 출퇴근 내역, 마감 보고, 공지 확인 기록 등 모든 데이터가 삭제되며 복구되지 않아요.",
                    "탈퇴 후 30일 동안 계정 정보가 보관되며, 30일 경과 후 모든 개인정보는 완전 삭제돼요.",
                    "탈퇴 후 재가입 시 탈퇴 시점 기준 1일 후 가능해요.",
                  ].map((text, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 22, flexShrink: 0 }}>{i + 1}.</Text>
                      <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 22, flex: 1 }}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Agree checkbox */}
              <AnimatedPressable onPress={() => setAgreed(!agreed)} scaleAmount={0.97} opacityAmount={0.8} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 6, marginTop: 2,
                  backgroundColor: agreed ? "#4261FF" : "#FFFFFF",
                  borderWidth: 2, borderColor: agreed ? "#4261FF" : "#DBDCDF",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {agreed && (
                    <View style={{ width: 13, height: 10, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>✓</Text>
                    </View>
                  )}
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", letterSpacing: -0.3, color: "#19191B", lineHeight: 24 }}>
                  탈퇴 시 모든 계정 데이터가 삭제되고 복구되지 않음을 이해했어요
                </Text>
              </AnimatedPressable>
            </>
          )}

          {/* Step 2 — 탈퇴 사유 */}
          {step === 2 && (
            <>
              <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.48, color: "#19191B", lineHeight: 34, marginTop: 16 }}>
                {"탈퇴하시는 사유가\n무엇인가요?"}
              </Text>
              <Text style={{ fontSize: 14, color: "#AAB4BF", letterSpacing: -0.28, marginTop: 8, marginBottom: 32 }}>
                더 나은 서비스 제공을 위해 이유를 선택해주세요
              </Text>

              <View style={{ gap: 24 }}>
                {REASONS.map((reason) => (
                  <AnimatedPressable
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    <View style={{
                      width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                      backgroundColor: selectedReason === reason ? "#4261FF" : "#FFFFFF",
                      borderWidth: 2, borderColor: selectedReason === reason ? "#4261FF" : "#DBDCDF",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {selectedReason === reason && (
                        <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>✓</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#19191B" }}>{reason}</Text>
                  </AnimatedPressable>
                ))}
              </View>

              {isOther && (
                <View style={{ marginTop: 16 }}>
                  <TextInput
                    value={otherText}
                    onChangeText={(t) => { if (t.length <= 100) setOtherText(t); }}
                    placeholder="기타 사유 입력 (필수)"
                    placeholderTextColor="#AAB4BF"
                    multiline
                    style={{
                      height: 120, borderRadius: 12, borderWidth: 1, borderColor: "#EBEBEB",
                      paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
                      color: "#19191B", letterSpacing: -0.3, textAlignVertical: "top",
                    }}
                  />
                  <Text style={{ fontSize: 14, color: "#AAB4BF", textAlign: "right", marginTop: 4 }}>{otherText.length}/100</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Footer Buttons */}
        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
          <AnimatedPressable
            onPress={goBack}
            style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: "#E8F3FF", alignItems: "center" }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF" }}>{step === 1 ? "취소" : "이전"}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              if (step === 1) setStep(2);
              else if (canWithdraw) setConfirmDialogOpen(true);
            }}
            disabled={step === 1 ? !agreed : !canWithdraw}
            style={{
              flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: "center",
              backgroundColor: (step === 1 ? agreed : canWithdraw) ? "#4261FF" : "#DBDCDF",
            }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: (step === 1 ? agreed : canWithdraw) ? "#FFFFFF" : "#9EA3AD" }}>
              {step === 1 ? "다음" : "탈퇴하기"}
            </Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title="회원 탈퇴"
        description={"탈퇴 시 모든 계정 데이터가\n삭제되고 복구되지 않아요\n정말 회원 탈퇴를 하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setConfirmDialogOpen(false), variant: "cancel" },
          { label: submitting ? "처리 중..." : "탈퇴하기", onPress: handleConfirmWithdraw, variant: "danger" },
        ]}
      />
    </SafeAreaView>
  );
};

export default WithdrawalScreen;
