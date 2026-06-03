import React, { useState } from "react";
import {
  View, Text, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Eye, EyeOff, AlertCircle } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import AnimatedPressable from "@/components/AnimatedPressable";
import FocusInput from "@/components/FocusInput";
import ConfirmDialog from "@/components/ConfirmDialog";
import { resetPassword } from "@/api/findPassword";
import type { ScreenProps } from "@/navigation/types";

const PwField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}> = ({ label, value, onChange, show, onToggle, error }) => (
  <View>
    <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>
      {label} <Text style={{ color: "#FF3D3D" }}>*</Text>
    </Text>
    <View style={{ position: "relative", marginTop: 8 }}>
      <FocusInput
        value={value}
        onChangeText={onChange}
        placeholder={label + " 입력"}
        placeholderTextColor="#AAB4BF"
        secureTextEntry={!show}
        maxLength={16}
        error={!!error}
        style={{
          height: 52, borderRadius: 12, borderWidth: 1,
          paddingHorizontal: 16, paddingRight: 48,
          fontSize: 16, color: "#19191B", backgroundColor: "#FFFFFF",
        }}
      />
      <AnimatedPressable
        onPress={onToggle}
        style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center", flex: 1 }}
        hitSlop={8}
        scaleAmount={0.85}
        opacityAmount={0.6}
      >
        {show ? <Eye size={20} color="#70737B" /> : <EyeOff size={20} color="#70737B" />}
      </AnimatedPressable>
    </View>
    {error ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
        <AlertCircle size={16} color="#FF3D3D" />
        <Text style={{ fontSize: 13, color: "#FF3D3D" }}>{error}</Text>
      </View>
    ) : null}
  </View>
);

const FindPasswordResetScreen: React.FC<ScreenProps<"FindPasswordReset">> = ({ route, navigation }) => {
  const { phone } = route.params;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);

  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]{8,16}$/;
  const isNewValid = passwordRegex.test(newPassword);
  const isConfirmMatch = newPassword === confirmPassword && confirmPassword !== "";

  const newError = submitted && newPassword && !isNewValid
    ? "영문, 숫자를 포함한 8~16자를 입력해주세요"
    : undefined;
  const confirmError = submitted && confirmPassword && !isConfirmMatch
    ? "비밀번호가 일치하지 않아요"
    : undefined;

  const canSubmit = newPassword.length > 0 && confirmPassword.length > 0 && !loading;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!isNewValid || !isConfirmMatch) return;
    setLoading(true);
    setApiError("");
    try {
      await resetPassword(phone, newPassword);
      setDoneDialogOpen(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="비밀번호 재설정"
        title={"새 비밀번호를\n입력해주세요"}
        subtitle="영문, 숫자를 조합한 8~16자를 입력해주세요"
        footer={
          <PrimaryButton
            label={loading ? "변경 중..." : "비밀번호 재설정"}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
        }
      >
        <ScrollView showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PwField
            label="새 비밀번호"
            value={newPassword}
            onChange={(v) => { setNewPassword(v); setApiError(""); }}
            show={showNew}
            onToggle={() => setShowNew((s) => !s)}
            error={newError}
          />
          <PwField
            label="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); setApiError(""); }}
            show={showConfirm}
            onToggle={() => setShowConfirm((s) => !s)}
            error={confirmError}
          />

          {apiError ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
              <AlertCircle size={16} color="#FF3D3D" style={{ marginTop: 1 }} />
              <Text style={{ fontSize: 13, color: "#FF3D3D", flex: 1, lineHeight: 18 }}>{apiError}</Text>
            </View>
          ) : null}
        </ScrollView>
      </PageLayout>

      <ConfirmDialog
        visible={doneDialogOpen}
        onClose={() => {}}
        title="비밀번호 재설정 완료"
        description={"비밀번호가 변경되었어요.\n새 비밀번호로 로그인해주세요."}
        buttons={[
          {
            label: "로그인하기",
            onPress: () => {
              setDoneDialogOpen(false);
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            },
            variant: "confirm",
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
};

export default FindPasswordResetScreen;
