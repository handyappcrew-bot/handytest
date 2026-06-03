import React, { useEffect } from "react";
import { View, Text, Image, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat, withSequence, Easing,
} from "react-native-reanimated";
import { getMyStores, getOnboardingStatus } from "@/api/auth";
import { registerForPushNotifications } from "@/utils/push";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const DOC_IMG = require("../../../assets/images/document.png");
const DOC_H = 210;

const EmployeePendingScreen: React.FC<ScreenProps<"EmployeePending">> = ({ navigation }) => {
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(16);

  const docOpacity = useSharedValue(0);
  const docY = useSharedValue(12);
  const docFloat = useSharedValue(0);

  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(12);

  useEffect(() => {
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);

    // ① 타이틀 등장
    titleOpacity.value = withTiming(1, { duration: 380 });
    titleY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });

    // ② 문서 등장
    docOpacity.value = withDelay(280, withTiming(1, { duration: 480 }));
    docY.value = withDelay(280, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));

    // ③ 등장 완료 후 둥둥 떠다니기
    docFloat.value = withDelay(
      760,
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    // ③ 서브타이틀 등장
    subtitleOpacity.value = withDelay(620, withTiming(1, { duration: 380 }));
    subtitleY.value = withDelay(620, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));

    return () => { backSub.remove(); };
  }, []);

  // 30초마다 승인/거절 여부 폴링
  useEffect(() => {
    registerForPushNotifications().catch((e) => console.warn(e));

    const checkApproval = async () => {
      try {
        const ob = await getOnboardingStatus();
        if (ob.status === "ready") {
          const stores = await getMyStores();
          if (!Array.isArray(stores) || stores.length === 0) return;
          const pendingStoreId = localStorage.getItem("pendingStoreId");
          let active: any;
          if (pendingStoreId) {
            active = stores.find((s: any) => String(s.store_id) === pendingStoreId);
            if (!active) return; // new store not approved yet — stay on pending
          } else {
            active = stores[0];
          }
          localStorage.setItem("currentRole", active.role);
          localStorage.setItem("currentStoreId", String(active.store_id));
          localStorage.setItem("currentMemberId", String(active.store_member_id));
          localStorage.setItem("currentStoreName", active.store_name ?? "");
          localStorage.setItem("pendingStoreName", active.store_name);
          localStorage.removeItem("pendingStoreId");
          // pendingMemberRequest는 EmployeeApprovedScreen에서 사용자가 버튼 탭 시 제거
          navigation.reset({ index: 0, routes: [{ name: "EmployeeApproved", params: { storeName: active.store_name } }] });
        } else if (ob.status === "employee_rejected") {
          localStorage.setItem("pendingStoreName", ob.store_name ?? "");
          // pendingMemberRequest는 EmployeeRejectedScreen에서 제거
          navigation.reset({ index: 0, routes: [{ name: "EmployeeRejected", params: { storeName: ob.store_name ?? "" } }] });
        }
      } catch {}
    };

    checkApproval();
    const interval = setInterval(checkApproval, 30000);
    return () => clearInterval(interval);
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));

  const docStyle = useAnimatedStyle(() => ({
    opacity: docOpacity.value,
    transform: [{ translateY: docY.value + docFloat.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 60 }}>

        <Animated.View style={[{ marginBottom: 52 }, titleStyle]}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: "#19191B", textAlign: "center", letterSpacing: -0.52, lineHeight: 36 }}>
            {"작성한 회원 정보가\n사장님에게 전달됐어요"}
          </Text>
        </Animated.View>

        <Animated.View style={docStyle}>
          <Image source={DOC_IMG} style={{ width: 180, height: DOC_H }} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[{ marginTop: 52 }, subtitleStyle]}>
          <Text style={{ fontSize: 16, fontWeight: "500", color: "#7488FE", textAlign: "center", letterSpacing: -0.32, lineHeight: 25.6 }}>
            {"사장님이 가입 정보를 확인하고 있어요\n승인되면 알림으로 알려드릴게요"}
          </Text>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
};

export default EmployeePendingScreen;
