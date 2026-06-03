import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, BackHandler } from "react-native";
import { AlertCircle } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatPhone, validatePhone } from "@/utils/valid";
import { clearProfileInfoDraft } from "@/utils/signupDraft";
import { sendSignupCode } from "@/api/auth";
import type { ScreenProps } from "@/navigation/types";

const SignupScreen: React.FC<ScreenProps<"Signup">> = ({ navigation, route }) => {
  const type = route.params?.type ?? "general";
  const socialToken = route.params?.socialToken;
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const hasInputRef = useRef(false);

  const isValid = validatePhone(phone);
  const showError = !!((touched && phone.length >= 10 && !isValid) || errorMsg);

  hasInputRef.current = phone.trim().length > 0;

  useEffect(() => { clearProfileInfoDraft(); }, []);

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

  const handleChange = (text: string) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
    setTouched(true);
    const valid = validatePhone(formatted);
    setErrorMsg(!valid && formatted.length >= 10 ? "올바르지 않은 휴대폰 번호 형식이에요." : "");
  };

  const handleSubmit = async () => {
    if (!isValid) {
      setErrorMsg("올바르지 않은 휴대폰 번호 형식이에요.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    try {
      await sendSignupCode(digits);
      navigation.navigate("CodeVerify", { phone: digits, type, socialToken });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "요청 처리 중 문제가 발생했어요.";
      setErrorMsg(msg);
    }
  };

  const borderColor = showError ? "#FF3D3D" : phoneFocused ? "#4261FF" : "#EBEBEB";

  return (
    <>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="회원가입"
        onBack={handleBack}
        title={"회원가입을 위해\n본인 인증을 해주세요"}
        subtitle="휴대폰 번호를 아이디로 사용해요"
        footer={<PrimaryButton label="인증번호 문자 보내기" onPress={handleSubmit} disabled={!isValid} />}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
            휴대폰 번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
          </Text>
          <TextInput
            value={phone}
            onChangeText={handleChange}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
            placeholder="숫자만 입력"
            placeholderTextColor="#AAB4BF"
            keyboardType="phone-pad"
            style={{
              marginTop: 8,
              borderWidth: 2,
              borderColor,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              fontSize: 16,
              color: "#19191B",
              backgroundColor: "#FFFFFF",
            }}
          />
          {showError && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <AlertCircle size={16} color="#FF3D3D" />
              <Text style={{ fontSize: 13, color: "#FF3D3D" }}>{errorMsg}</Text>
            </View>
          )}
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
    </>
  );
};

export default SignupScreen;
