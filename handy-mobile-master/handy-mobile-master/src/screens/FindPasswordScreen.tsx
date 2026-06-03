import React, { useState } from "react";
import {
  View, Text, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { AlertCircle } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import { formatPhone } from "@/utils/valid";
import { sendFindPasswordCode } from "@/api/findPassword";
import type { ScreenProps } from "@/navigation/types";

const FindPasswordScreen: React.FC<ScreenProps<"FindPassword">> = ({ navigation }) => {
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const isValid = /^010\d{8}$/.test(digits);

  const handleChange = (raw: string) => {
    const onlyDigits = raw.replace(/[^0-9]/g, "").slice(0, 11);
    setPhone(formatPhone(onlyDigits));
    setError("");
  };

  const handleSend = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError("");
    try {
      await sendFindPasswordCode(digits);
      navigation.navigate("FindPasswordVerify", { phone: digits });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "오류가 발생했어요. 다시 시도해주세요.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const borderColor = error ? "#FF3D3D" : focused ? "#4261FF" : "#EBEBEB";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="비밀번호 찾기"
        title={"가입한 휴대폰 번호를\n입력해주세요"}
        subtitle="본인 인증 후 비밀번호를 재설정할 수 있어요"
        footer={
          <PrimaryButton
            label={loading ? "발송 중..." : "인증번호 받기"}
            onPress={handleSend}
            disabled={!isValid || loading}
          />
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
            휴대폰 번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
          </Text>
          <TextInput
            value={phone}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="010-0000-0000"
            placeholderTextColor="#AAB4BF"
            keyboardType="phone-pad"
            style={{
              marginTop: 8,
              height: 52,
              borderWidth: 2,
              borderColor: borderColor,
              borderRadius: 12,
              paddingHorizontal: 16,
              fontSize: 16,
              color: "#19191B",
              backgroundColor: "#FFFFFF",
            }}
          />
          {error ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 }}>
              <AlertCircle size={15} color="#FF3D3D" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: "#FF3D3D", lineHeight: 18 }}>{error}</Text>
              </View>
            </View>
          ) : (
            <Text style={{ marginTop: 8, fontSize: 13, color: "#70737B", lineHeight: 18 }}>
              가입 시 등록한 휴대폰 번호를 입력해주세요
            </Text>
          )}
        </View>
      </PageLayout>
    </KeyboardAvoidingView>
  );
};

export default FindPasswordScreen;
