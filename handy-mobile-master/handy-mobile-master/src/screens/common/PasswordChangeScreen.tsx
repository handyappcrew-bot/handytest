import React, { useState } from "react";
import {
  View, Text, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { ChevronLeft, Eye, EyeOff, AlertCircle } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { changePassword } from "@/api/public";
import ConfirmDialog from "@/components/ConfirmDialog";
import FocusInput from "@/components/FocusInput";
import AnimatedPressable from "@/components/AnimatedPressable";
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

const PasswordChangeScreen: React.FC<ScreenProps<"PasswordChange">> = ({ navigation }) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oldPasswordError, setOldPasswordError] = useState<string | undefined>();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,16}$/;
  const isNewValid = passwordRegex.test(newPassword);
  const isConfirmMatch = newPassword === confirmPassword && confirmPassword !== "";
  const isClientValid = isNewValid && isConfirmMatch;

  const handleSubmit = () => {
    setSubmitted(true);
    if (isClientValid) setConfirmDialogOpen(true);
  };

  const handleConfirmChange = async () => {
    setConfirmDialogOpen(false);
    setIsLoading(true);
    setOldPasswordError(undefined);
    try {
      await changePassword(oldPassword, newPassword);
      setCompleteDialogOpen(true);
    } catch (e) {
      setOldPasswordError(e instanceof Error ? e.message : "오류가 발생했어요. 다시 시도해주세요");
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = oldPassword && newPassword && confirmPassword && !isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>비밀번호 변경</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#19191B", lineHeight: 34 }}>
              {"변경할 비밀번호를\n입력해주세요"}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: "#70737B" }}>영문, 숫자를 조합한 8~16자를 입력해주세요</Text>
          </View>

          <View style={{ paddingHorizontal: 20, marginTop: 32, gap: 24, paddingBottom: 32 }}>
            <PwField
              label="기존 비밀번호"
              value={oldPassword}
              onChange={(v) => { setOldPassword(v); setOldPasswordError(undefined); }}
              show={showOld}
              onToggle={() => setShowOld(!showOld)}
              error={oldPasswordError ?? (submitted && !oldPassword ? "기존 비밀번호를 입력해주세요" : undefined)}
            />
            <PwField
              label="새 비밀번호"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew(!showNew)}
              error={submitted && !isNewValid && newPassword ? "올바르지 않은 비밀번호 형식이에요" : undefined}
            />
            <PwField
              label="새 비밀번호 확인"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm(!showConfirm)}
              error={submitted && !isConfirmMatch && confirmPassword ? "비밀번호가 일치하지 않아요" : undefined}
            />
          </View>
        </ScrollView>

        {/* Footer Button */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF" }}>
          <AnimatedPressable
            onPress={handleSubmit}
            disabled={!canProceed}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{
              width: "100%", paddingVertical: 16, borderRadius: 12, alignItems: "center",
              backgroundColor: canProceed ? "#4261FF" : "#DBDCDF",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
              {isLoading ? "변경 중..." : "변경하기"}
            </Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title="비밀번호 변경"
        description="새로 입력한 비밀번호로 변경 하시겠어요?"
        buttons={[
          { label: "취소", onPress: () => setConfirmDialogOpen(false), variant: "cancel" },
          { label: "변경하기", onPress: handleConfirmChange, variant: "confirm" },
        ]}
      />

      {/* Complete Dialog */}
      <ConfirmDialog
        visible={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        title="비밀번호 변경 완료"
        description={"비밀번호 변경이 완료되었어요\n로그아웃 하시겠어요?"}
        buttons={[
          { label: "아니요", onPress: () => { setCompleteDialogOpen(false); navigation.goBack(); }, variant: "cancel" },
          { label: "로그아웃", onPress: () => { setCompleteDialogOpen(false); navigation.reset({ index: 0, routes: [{ name: "Login" }] }); }, variant: "confirm" },
        ]}
      />
    </SafeAreaView>
  );
};

export default PasswordChangeScreen;
