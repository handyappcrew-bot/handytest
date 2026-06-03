import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from "react-native";
import { AlertCircle, CheckCircle } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import { useToast } from "@/components/Toast";
import { formatPhone } from "@/utils/valid";
import { sendFindPasswordCode, verifyFindPasswordCode } from "@/api/findPassword";
import type { ScreenProps } from "@/navigation/types";

const MAX_RESEND = 5;

const FindPasswordVerifyScreen: React.FC<ScreenProps<"FindPasswordVerify">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const phoneDigits = route.params.phone;
  const formattedPhone = formatPhone(phoneDigits);

  const [code, setCode] = useState("");
  const [timer, setTimer] = useState(180);
  const [isVerified, setIsVerified] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const lastSubmittedRef = useRef("");
  const inFlightRef = useRef(false);
  const initialToastShownRef = useRef(false);

  useEffect(() => {
    if (initialToastShownRef.current) return;
    initialToastShownRef.current = true;
    toast({ description: "인증번호를 발송 했어요." });
  }, []);

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
        await verifyFindPasswordCode(phoneDigits, code);
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
      await sendFindPasswordCode(phoneDigits);
      setResendCount((c) => c + 1);
      setTimer(180);
      setCode("");
      setCodeError(false);
      setIsVerified(false);
      lastSubmittedRef.current = "";
      toast({ description: "인증번호를 재발송 했어요." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "재발송에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const handleNoCodePress = () => {
    toast({
      description:
        "스팸 문자함을 확인해 주세요. 통신사 차단 설정이나 수신 거부 서비스에 등록되어 있으면 문자를 받을 수 없어요.",
    });
  };

  const handleNext = () => {
    if (!isVerified) return;
    navigation.navigate("FindPasswordReset", { phone: phoneDigits });
  };

  const codeBorderColor = codeError ? "#FF3D3D" : codeFocused && !isVerified ? "#4261FF" : "#EBEBEB";
  const timerExpired = timer <= 0 && !isVerified;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="비밀번호 찾기"
        title={"인증번호를\n입력해주세요"}
        subtitle="휴대폰으로 발송된 5자리 인증번호를 입력해주세요"
        footer={<PrimaryButton label="다음" onPress={handleNext} disabled={!isVerified} />}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {/* 휴대폰 번호 (읽기 전용) + 재전송 */}
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
                <Text style={{ fontSize: 15, fontWeight: "600", color: resendDisabled ? "#9EA3AD" : "#FFFFFF" }}>
                  재전송
                </Text>
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

          {/* 인증번호 입력 */}
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
  );
};

export default FindPasswordVerifyScreen;
