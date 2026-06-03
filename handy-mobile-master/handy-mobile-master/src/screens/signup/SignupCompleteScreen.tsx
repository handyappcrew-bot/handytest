import React, { useEffect } from "react";
import { View, Text, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "@/components/PrimaryButton";
import type { ScreenProps } from "@/navigation/types";
import { hapticHeavy } from "@/utils/haptics";

const SIGN_IN_CHECK = require("../../../assets/images/icon/sign-in-check.png");

const SignupCompleteScreen: React.FC<ScreenProps<"SignupComplete">> = ({ route, navigation }) => {
  const name = route.params?.name ?? "회원";

  useEffect(() => { hapticHeavy(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
        {/* Check icon */}
        <Image
          source={SIGN_IN_CHECK}
          style={{ width: 80, height: 80, marginBottom: 32 }}
          resizeMode="contain"
        />

        <Text style={{
          fontSize: 24,
          fontWeight: "600",
          color: "#19191B",
          letterSpacing: -0.48,
          textAlign: "center",
          lineHeight: 34,
        }}>
          {name}님 반가워요
        </Text>
        <Text style={{
          fontSize: 24,
          fontWeight: "600",
          color: "#19191B",
          letterSpacing: -0.48,
          textAlign: "center",
          lineHeight: 34,
        }}>
          회원가입이 완료됐어요!
        </Text>

        <Text style={{
          marginTop: 16,
          fontSize: 16,
          fontWeight: "500",
          color: "#7488FE",
          letterSpacing: -0.32,
          textAlign: "center",
        }}>
          서비스 이용을 위해 회원 유형을 선택 해주세요
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <PrimaryButton label="회원 유형 선택하기" onPress={() => navigation.replace("MemberType", {})} />
      </View>
    </SafeAreaView>
  );
};

export default SignupCompleteScreen;
