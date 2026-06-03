import React, { useEffect } from "react";
import { View, Text, BackHandler, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, Easing,
} from "react-native-reanimated";
import { AlertCircle } from "lucide-react-native";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const EmployeeRejectedScreen: React.FC<ScreenProps<"EmployeeRejected">> = ({ navigation, route }) => {
  const storeName = route.params?.storeName ?? localStorage.getItem("pendingStoreName") ?? "매장";

  const iconScale       = useSharedValue(0);
  const titleOpacity    = useSharedValue(0);
  const titleY          = useSharedValue(16);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY       = useSharedValue(16);
  const btnOpacity      = useSharedValue(0);
  const btnY            = useSharedValue(16);

  useEffect(() => {
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);

    iconScale.value = withSequence(
      withTiming(1.12, { duration: 380, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(1.0, { duration: 200 }),
    );

    titleOpacity.value    = withDelay(320, withTiming(1, { duration: 380 }));
    titleY.value          = withDelay(320, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    subtitleOpacity.value = withDelay(500, withTiming(1, { duration: 380 }));
    subtitleY.value       = withDelay(500, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    btnOpacity.value      = withDelay(680, withTiming(1, { duration: 380 }));
    btnY.value            = withDelay(680, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));

    return () => { backSub.remove(); };
  }, []);

  const iconStyle     = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const titleStyle    = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: titleY.value }] }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value, transform: [{ translateY: subtitleY.value }] }));
  const btnStyle      = useAnimatedStyle(() => ({ opacity: btnOpacity.value, transform: [{ translateY: btnY.value }] }));

  const handleMemberType = () => {
    localStorage.removeItem("pendingMemberRequest");
    localStorage.removeItem("pendingStoreName");
    navigation.reset({ index: 0, routes: [{ name: "MemberType" }] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1 }}>

        {/* 아이콘 — 승인 화면과 동일 위치 (시각적 중심 310px) */}
        <Animated.Image
          source={require("../../../assets/images/icon/no-icon.png")}
          style={[{ position: "absolute", width: 100, height: 100, alignSelf: "center", top: 260 }, iconStyle]}
          resizeMode="contain"
        />

        {/* 텍스트 — 승인 화면과 동일 위치 */}
        <View style={{ position: "absolute", left: 24, right: 24, top: 420, alignItems: "center" }}>
          <Animated.View style={[{ marginBottom: 16 }, titleStyle]}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#19191B", textAlign: "center", letterSpacing: -0.48, lineHeight: 34 }}>
              {`${storeName}\n가입 승인이 거절되었어요`}
            </Text>
          </Animated.View>

          <Animated.View style={subtitleStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
              <AlertCircle size={16} color="#7488FE" />
              <Text style={{ fontSize: 15, fontWeight: "500", color: "#7488FE", letterSpacing: -0.3, lineHeight: 24 }}>
                매장 가입 요청이 거절되었어요
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#7488FE", textAlign: "center", letterSpacing: -0.3, lineHeight: 24 }}>
              매장 코드를 확인한 뒤 다시 요청해 주세요
            </Text>
          </Animated.View>
        </View>

      </View>

      {/* 하단 버튼 */}
      <Animated.View style={[{ paddingHorizontal: 24, paddingBottom: 32 }, btnStyle]}>
        <TouchableOpacity
          onPress={handleMemberType}
          style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.34 }}>회원 유형 선택 화면 이동하기</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

export default EmployeeRejectedScreen;
