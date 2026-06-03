import React, { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, BackHandler } from "react-native";
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { ScreenProps } from "@/navigation/types";

const PasswordScreen: React.FC<ScreenProps<"PasswordPage">> = ({ route, navigation }) => {
  const phone = route.params.phone;
  const type = route.params.type ?? "general";
  const socialToken = route.params.socialToken;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const hasInputRef = useRef(false);
  hasInputRef.current = password.length > 0;

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

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const validLength = password.length >= 8 && password.length <= 16;
  const pwValid = hasLetter && hasNumber && validLength;
  const mismatch = confirm.length > 0 && password !== confirm;
  const confirmMatch = confirm.length > 0 && password === confirm;
  const canNext = pwValid && confirmMatch;
  const pwError = password.length > 0 && !pwValid;

  const pwBorderColor = pwError ? "#FF3D3D" : pwFocused ? "#4261FF" : "#EBEBEB";
  const confirmBorderColor = mismatch ? "#FF3D3D" : confirmFocused ? "#4261FF" : "#EBEBEB";

  const handleNext = () => {
    if (!canNext) return;
    navigation.navigate("ProfileInfo", { phone, password, type, socialToken });
  };

  return (
    <>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="회원가입"
        onBack={handleBack}
        title={"비밀번호를\n입력 해주세요"}
        subtitle="영문, 숫자를 조합한 8~16자를 입력 해주세요."
        footer={<PrimaryButton label="다음" onPress={handleNext} disabled={!canNext} />}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {/* Password */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              비밀번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <View style={{ position: "relative", marginTop: 8 }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                placeholder="비밀번호 입력"
                placeholderTextColor="#AAB4BF"
                secureTextEntry={!showPw}
                maxLength={16}
                style={{
                  borderWidth: 2,
                  borderColor: pwBorderColor,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  paddingRight: 48,
                  fontSize: 16,
                  color: "#19191B",
                  backgroundColor: "#FFFFFF",
                }}
              />
              <Pressable
                onPress={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}
                hitSlop={8}
              >
                {showPw ? <Eye size={20} color="#70737B" /> : <EyeOff size={20} color="#70737B" />}
              </Pressable>
            </View>
            {pwError && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={16} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>올바르지 않은 비밀번호 형식이에요</Text>
              </View>
            )}
            {pwValid && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <CheckCircle size={16} color="#10C97D" />
                <Text style={{ fontSize: 13, color: "#10C97D" }}>사용 가능한 비밀번호에요</Text>
              </View>
            )}
          </View>

          {/* Confirm */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              비밀번호 확인 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <View style={{ position: "relative", marginTop: 8 }}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                placeholder="비밀번호 확인"
                placeholderTextColor="#AAB4BF"
                secureTextEntry={!showConfirm}
                maxLength={16}
                style={{
                  borderWidth: 2,
                  borderColor: confirmBorderColor,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  paddingRight: 48,
                  fontSize: 16,
                  color: "#19191B",
                  backgroundColor: "#FFFFFF",
                }}
              />
              <Pressable
                onPress={() => setShowConfirm(!showConfirm)}
                style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}
                hitSlop={8}
              >
                {showConfirm ? <Eye size={20} color="#70737B" /> : <EyeOff size={20} color="#70737B" />}
              </Pressable>
            </View>
            {mismatch && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={16} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>비밀번호가 일치하지 않아요</Text>
              </View>
            )}
            {confirmMatch && pwValid && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <CheckCircle size={16} color="#10C97D" />
                <Text style={{ fontSize: 13, color: "#10C97D" }}>비밀번호가 일치해요</Text>
              </View>
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
    </>
  );
};

export default PasswordScreen;
