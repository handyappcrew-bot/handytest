import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, Image } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import AnimatedPressable from "@/components/AnimatedPressable";
import { Eye, EyeOff, AlertCircle } from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { useToast } from "@/components/Toast";
import { login, getMyStores, appleNativeLogin } from "@/api/auth";
import { localStorage } from "@/utils/storage";
import { logLogin } from "@/utils/analytics";
import { setUser } from "@/utils/crashlytics";
import { formatPhone } from "@/utils/valid";
import { API_BASE_URL } from "@/api/client";
import type { ScreenProps } from "@/navigation/types";


const SYMBOL = require("../../assets/images/login/symbol.png");
const TYPO = require("../../assets/images/login/typo.png");
const KAKAO = require("../../assets/images/login/kakao.png");
const APPLE = require("../../assets/images/login/apple.png");
const GOOGLE = require("../../assets/images/login/google.png");

const LoginScreen: React.FC<ScreenProps<"Login">> = ({ navigation }) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const hasInput = /^010\d{8}$/.test(digits) && password.length > 0;

  // 자동 로그인: 토큰이 있고 stores 가 있으면 home 으로
  useEffect(() => {
    (async () => {
      try {
        const stores = await getMyStores();
        if (!stores || stores.length === 0) return;
        const savedMemberId = localStorage.getItem("currentMemberId");
        const savedRole = localStorage.getItem("currentRole");
        const stillValid = savedMemberId
          ? stores.find((s: any) => String(s.store_member_id) === savedMemberId)
          : null;
        const hasOwner = stores.some((s: any) => s.role === "owner");
        const savedRoleMatch = savedRole ? stores.find((s: any) => s.role === savedRole) : null;
        const fallbackRole = savedRoleMatch?.role ?? (hasOwner ? "owner" : "employee");
        const active = stillValid ?? savedRoleMatch ?? stores.find((s: any) => s.role === fallbackRole) ?? stores[0];
        localStorage.setItem("currentRole", active.role);
        localStorage.setItem("currentStoreId", String(active.store_id));
        localStorage.setItem("currentMemberId", String(active.store_member_id));
        navigation.replace(active.role === "owner" ? "OwnerHome" : "EmployeeHome");
      } catch {
        // 토큰 없거나 만료 → 화면 유지
      }
    })();
  }, []);

  const handlePhoneChange = (raw: string) => {
    const onlyDigits = raw.replace(/[^0-9]/g, "").slice(0, 11);
    setPhone(formatPhone(onlyDigits));
    setError(false);
  };
  const handlePasswordChange = (v: string) => {
    setPassword(v);
    setError(false);
  };

  // 로그인 성공 후 매장 조회 → 적절한 홈으로 이동 (없으면 유형 선택)
  const navigateAfterAuth = async () => {
    const stores = await getMyStores();
    if (!stores || stores.length === 0) {
      toast({ description: "계정 유형을 선택해 서비스를 이용해보세요" });
      navigation.replace("MemberType");
      return;
    }
    const hasOwner = stores.some((s: any) => s.role === "owner");
    const preferRole = hasOwner ? "owner" : "employee";
    const active = stores.find((s: any) => s.role === preferRole) ?? stores[0];
    localStorage.setItem("currentRole", active.role);
    localStorage.setItem("currentStoreId", String(active.store_id));
    localStorage.setItem("currentMemberId", String(active.store_member_id));
    setUser(String(active.store_member_id));
    navigation.replace(active.role === "owner" ? "OwnerHome" : "EmployeeHome");
  };

  const handleLogin = async () => {
    if (!hasInput || submitting) return;
    setSubmitting(true);
    setError(false);
    setErrorMsg("");
    try {
      await login(digits, password);
      logLogin("phone");
      await navigateAfterAuth();
    } catch (err) {
      const msg = err instanceof TypeError
        ? "서버에 오류가 있어요. 잠시 후 다시 시도해주세요"
        : err instanceof Error ? err.message : "로그인 중 오류가 발생했어요.";
      setErrorMsg(msg);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        toast({ description: "애플 로그인에 실패했어요.", variant: "destructive" });
        return;
      }
      const res = await appleNativeLogin(credential.identityToken);
      if (res.redirect === "signup") {
        // 신규 회원 → 소셜 가입 플로우
        navigation.reset({
          index: 0,
          routes: [{ name: "Signup", params: { type: "social", socialToken: res.signup_token } }],
        });
      } else {
        // 기존 회원 → 토큰 저장 완료, 홈으로
        localStorage.setItem("socialProvider", "apple");
        logLogin("apple");
        await navigateAfterAuth();
      }
    } catch (e: any) {
      // 사용자가 취소한 경우(ERR_REQUEST_CANCELED)는 조용히 무시
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      toast({ description: "애플 로그인 중 오류가 발생했어요.", variant: "destructive" });
    }
  };

  const phoneBorder = error ? "#FF3D3D" : phoneFocused ? "#4261FF" : "#EBEBEB";
  const passwordBorder = error ? "#FF3D3D" : passwordFocused ? "#4261FF" : "#EBEBEB";

  const handleSocial = async (provider: "kakao" | "apple" | "google") => {
    if (provider === "apple") {
      await handleAppleLogin();
      return;
    }
    localStorage.setItem("pendingSocialProvider", provider);
    const url = `${API_BASE_URL}/api/auth/${provider}/login?platform=mobile`;
    const result = await WebBrowser.openAuthSessionAsync(url, "handytest://");
    if (result.type !== "success") {
      localStorage.removeItem("pendingSocialProvider");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          {/* 로고 영역 (mt-80, mb-48) */}
          <View style={{ alignItems: "center", marginTop: 80, marginBottom: 48 }}>
            <Image source={SYMBOL} style={{ width: 52, height: 77 }} resizeMode="contain" />
            <Image source={TYPO} style={{ width: 103, height: 41, marginTop: 12 }} resizeMode="contain" />
          </View>

          {/* 휴대폰 */}
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
            placeholder="휴대폰 번호"
            placeholderTextColor="#AAB4BF"
            keyboardType="phone-pad"
            style={{
              width: "100%", height: 56, borderRadius: 16, borderWidth: 2, borderColor: phoneBorder,
              paddingHorizontal: 20, fontSize: 16, color: "#19191B", backgroundColor: "#FFFFFF",
            }}
          />

          {/* 비밀번호 */}
          <View style={{ position: "relative", marginTop: 16 }}>
            <TextInput
              value={password}
              onChangeText={handlePasswordChange}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="비밀번호"
              placeholderTextColor="#AAB4BF"
              secureTextEntry={!showPassword}
              style={{
                width: "100%", height: 56, borderRadius: 16, borderWidth: 2, borderColor: passwordBorder,
                paddingHorizontal: 20, paddingRight: 56, fontSize: 16, color: "#19191B", backgroundColor: "#FFFFFF",
              }}
            />
            <AnimatedPressable
              onPress={() => setShowPassword(v => !v)}
              hitSlop={8}
              scaleAmount={0.85}
              opacityAmount={0.6}
              style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center", flex: 1 }}
            >
              {showPassword ? <Eye size={20} color="#AAB4BF" /> : <EyeOff size={20} color="#AAB4BF" />}
            </AnimatedPressable>
          </View>

          {/* 에러 메시지 */}
          {error && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
              <AlertCircle size={16} color="#FF3D3D" />
              <Text style={{ fontSize: 13, color: "#FF3D3D" }}>{errorMsg}</Text>
            </View>
          )}

          {/* 로그인 버튼 */}
          <View style={{ marginTop: 30 }}>
            <PrimaryButton label="로그인" onPress={handleLogin} disabled={!hasInput} loading={submitting} />
          </View>

          {/* 비밀번호 찾기 | 회원가입 하기 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 30 }}>
            <Pressable hitSlop={8} onPress={() => navigation.navigate("FindPassword")}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B" }}>비밀번호 찾기</Text>
            </Pressable>
            <View style={{ width: 1, height: 12, backgroundColor: "#EBEBEB" }} />
            <AnimatedPressable hitSlop={8} onPress={() => navigation.navigate("Signup")} scaleAmount={0.97} opacityAmount={0.8}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#3E3E46" }}>회원가입 하기</Text>
            </AnimatedPressable>
          </View>

          {/* 하단 간편 로그인 영역 */}
          <View style={{ marginTop: "auto", paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 60, marginBottom: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#EBEBEB" }} />
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#AAB4BF" }}>간편 로그인</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#EBEBEB" }} />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
              <AnimatedPressable onPress={() => handleSocial("kakao")} hitSlop={8} scaleAmount={0.97} opacityAmount={0.8} style={{ width: 56, height: 56 }}>
                <Image source={KAKAO} style={{ width: 56, height: 56 }} resizeMode="contain" />
              </AnimatedPressable>
              {/* 애플 로그인은 iOS 전용 (Sign in with Apple) */}
              {Platform.OS === "ios" && (
                <AnimatedPressable onPress={() => handleSocial("apple")} hitSlop={8} scaleAmount={0.97} opacityAmount={0.8} style={{ width: 56, height: 56 }}>
                  <Image source={APPLE} style={{ width: 56, height: 56 }} resizeMode="contain" />
                </AnimatedPressable>
              )}
              <AnimatedPressable onPress={() => handleSocial("google")} hitSlop={8} scaleAmount={0.97} opacityAmount={0.8} style={{ width: 56, height: 56 }}>
                <Image source={GOOGLE} style={{ width: 56, height: 56 }} resizeMode="contain" />
              </AnimatedPressable>
            </View>

            <Pressable hitSlop={8} onPress={() => navigation.navigate("Onboarding")} style={{ alignItems: "center", marginTop: 20 }}>
              <Text style={{ fontSize: 13, color: "#AAB4BF" }}>온보딩 다시 보기</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
