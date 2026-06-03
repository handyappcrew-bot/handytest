import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable, BackHandler } from "react-native";
import { AlertCircle, CheckCircle } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { formatPhone } from "@/utils/valid";
import { sendSignupCode, verifySignupCode } from "@/api/auth";
import type { ScreenProps } from "@/navigation/types";

const MAX_RESEND = 5;

const CodeVerifyScreen: React.FC<ScreenProps<"CodeVerify">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const phoneDigits = route.params.phone;
  const formattedPhone = formatPhone(phoneDigits);
  const type = route.params.type ?? "general";
  const socialToken = route.params.socialToken;

  const [code, setCode] = useState("");
  const [timer, setTimer] = useState(180);
  const [isVerified, setIsVerified] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNoCodeSheet, setShowNoCodeSheet] = useState(false);
  const lastSubmittedRef = useRef("");
  const inFlightRef = useRef(false);
  const initialToastShownRef = useRef(false);
  const hasInputRef = useRef(false);

  hasInputRef.current = code.length > 0;

  useEffect(() => {
    if (initialToastShownRef.current) return;
    initialToastShownRef.current = true;
    toast({ description: "인증번호를 발송 했어요." });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (hasInputRef.current) { setShowCancelDialog(true); return true; }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const handleBack = () => {
    if (hasInputRef.current) { setShowCancelDialog(true); return; }
    if (navigation.canGoBack()) navigation.goBack();
  };

  useEffect(() => {
    if (isVerified || timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [isVerified, timer]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (code.length !== 5 || isVerified) return;
    if (lastSubmittedRef.current === code) return;
    if (inFlightRef.current) return;
    lastSubmittedRef.current = code;
    inFlightRef.current = true;
    (async () => {
      try {
        await verifySignupCode(phoneDigits, code);
        setIsVerified(true);
        setCodeError(false);
      } catch {
        setCodeError(true);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [code, isVerified, phoneDigits]);

  const resendDisabled = isVerified || resendCount >= MAX_RESEND;

  const handleResend = async () => {
    if (resendDisabled) return;
    try {
      await sendSignupCode(phoneDigits);
      setResendCount((c) => c + 1);
      setTimer(180);
      setCode("");
      setCodeError(false);
      setIsVerified(false);
      lastSubmittedRef.current = "";
      toast({ description: "인증번호를 재발송 했어요." });
    } catch (err) {
      console.error(err);
    }
  };

  const handleNoCodePress = () => {
    setShowNoCodeSheet(true);
  };

  const handleNext = () => {
    if (!isVerified) return;
    if (type === "general") {
      navigation.navigate("PasswordPage", { phone: phoneDigits, type, socialToken });
    } else {
      navigation.navigate("ProfileInfo", { phone: phoneDigits, password: "", type, socialToken });
    }
  };

  const codeBorderColor = codeError ? "#FF3D3D" : codeFocused && !isVerified ? "#4261FF" : "#EBEBEB";
  const timerExpired = timer <= 0 && !isVerified;

  return (
    <>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="회원가입"
        onBack={handleBack}
        title={"회원가입을 위해\n본인 인증을 해주세요"}
        subtitle="휴대폰 번호를 아이디로 사용해요"
        footer={<PrimaryButton label="다음" onPress={handleNext} disabled={!isVerified} />}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {/* Phone (read-only) + Resend */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              휴대폰 번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
              <TextInput
                value={formattedPhone}
                editable={false}
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: "#EBEBEB",
                  backgroundColor: "#F7F7F8",
                  color: "#AAB4BF",
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={handleResend}
                disabled={resendDisabled}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 12,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: resendDisabled ? "#E0E0E0" : "#4261FF",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: resendDisabled ? "#9EA3AD" : "#FFFFFF" }}>재전송</Text>
              </Pressable>
            </View>
            {resendCount >= MAX_RESEND ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={14} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>
                  하루 최대 전송 가능한 문자는 5건이에요. 내일 다시 시도해 주세요.
                </Text>
              </View>
            ) : (
              <Text style={{ marginTop: 8, fontSize: 13, color: "#4261FF" }}>
                *위 휴대폰 번호로 발송된 인증 번호를 입력 해주세요
              </Text>
            )}
          </View>

          {/* Code */}
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              인증번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <View style={{ position: "relative", marginTop: 8 }}>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  if (isVerified) return;
                  const next = t.replace(/\D/g, "").slice(0, 5);
                  if (next !== code) {
                    lastSubmittedRef.current = "";
                    setCodeError(false);
                  }
                  setCode(next);
                }}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                placeholder="인증번호 5자리 입력"
                placeholderTextColor="#AAB4BF"
                keyboardType="numeric"
                editable={!isVerified}
                maxLength={5}
                style={{
                  borderWidth: 2,
                  borderColor: codeBorderColor,
                  backgroundColor: isVerified ? "#F7F7F8" : "#FFFFFF",
                  color: isVerified ? "#AAB4BF" : "#19191B",
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  paddingRight: 72,
                  fontSize: 16,
                }}
              />
              {!isVerified && (
                <View style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: timerExpired ? "#FF3D3D" : "#4261FF" }}>
                    {formatTime(timer)}
                  </Text>
                </View>
              )}
            </View>

            {codeError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={16} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>
                  올바르지 않은 인증번호에요. 인증번호를 확인 해주세요
                </Text>
              </View>
            )}

            {timerExpired && !codeError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={16} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>
                  인증 시간이 초과되었어요. 재전송 버튼을 눌러 새 인증번호를 받아주세요.
                </Text>
              </View>
            )}

            {isVerified && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <CheckCircle size={16} color="#10C97D" />
                <Text style={{ fontSize: 13, color: "#10C97D" }}>인증이 완료 되었어요.</Text>
              </View>
            )}

            {!isVerified && (
              <Pressable onPress={handleNoCodePress} hitSlop={8} style={{ marginTop: 12, alignSelf: "flex-start" }}>
                <Text style={{ fontSize: 14, color: "#19191B", textDecorationLine: "underline" }}>
                  인증번호가 오지 않나요?
                </Text>
              </Pressable>
            )}

          </View>
        </View>
      </PageLayout>
    </KeyboardAvoidingView>

    <ConfirmDialog
      visible={showCancelDialog}
      onClose={() => setShowCancelDialog(false)}
      title="회원가입을 취소할까요?"
      description="지금까지 입력한 정보가 모두 지워져요."
      buttons={[
        { label: "계속하기", variant: "cancel", onPress: () => setShowCancelDialog(false) },
        { label: "나가기", variant: "danger", onPress: () => { setShowCancelDialog(false); navigation.goBack(); } },
      ]}
    />

    <BottomSheet isOpen={showNoCodeSheet} onClose={() => setShowNoCodeSheet(false)} title="인증번호가 오지 않나요?">
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>070 번호 차단 확인</Text>
          <Text style={{ fontSize: 14, color: "#6B7280", lineHeight: 20 }}>
            인증 문자는 <Text style={{ fontWeight: "600", color: "#19191B" }}>070 번호</Text>로 발송돼요. 통신사나 스팸 차단 앱에서 070 번호를 차단하고 있으면 문자가 오지 않아요.{"\n"}
            통신사 고객센터 또는 스팸 차단 앱 설정에서 070 번호 차단을 해제해 주세요.
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>스팸 문자함 확인</Text>
          <Text style={{ fontSize: 14, color: "#6B7280", lineHeight: 20 }}>
            인증 문자가 스팸함으로 분류됐을 수 있어요. 문자 앱의 스팸·차단 문자함을 확인해 주세요.
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>수신 거부 서비스 확인</Text>
          <Text style={{ fontSize: 14, color: "#6B7280", lineHeight: 20 }}>
            통신사 수신 거부 서비스(예: 문자 수신 거부)에 등록된 경우 문자를 받을 수 없어요. 통신사 고객센터에서 해제 후 재시도해 주세요.
          </Text>
        </View>
        <View style={{ backgroundColor: "#F7F7F8", borderRadius: 10, padding: 14 }}>
          <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 19 }}>
            위 방법으로도 해결되지 않으면 재전송 버튼을 눌러 인증번호를 다시 받아보세요.
          </Text>
        </View>
      </View>
    </BottomSheet>
    </>
  );
};

export default CodeVerifyScreen;
