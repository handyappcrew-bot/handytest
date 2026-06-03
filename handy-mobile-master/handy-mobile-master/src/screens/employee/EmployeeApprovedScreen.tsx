import React, { useEffect, useState } from "react";
import { View, Text, BackHandler, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { getMe } from "@/api/auth";
import { localStorage } from "@/utils/storage";
import { registerForPushNotifications } from "@/utils/push";
import type { ScreenProps } from "@/navigation/types";

const DOTS = [
  { dx: 0,   dy: -88, color: "#FFD93D", size: 10 },
  { dx: 72,  dy: -52, color: "#6BCB77", size: 8  },
  { dx: 72,  dy: 52,  color: "#4D96FF", size: 11 },
  { dx: 0,   dy: 88,  color: "#FF6B6B", size: 9  },
  { dx: -72, dy: 52,  color: "#C77DFF", size: 8  },
  { dx: -72, dy: -52, color: "#FF9A3C", size: 10 },
];

const EMOJIS = [
  { emoji: "🎉", endX: -95, endY: -130, delay: 150, size: 28 },
  { emoji: "🎊", endX:  95, endY: -110, delay: 220, size: 26 },
  { emoji: "✨", endX: -50, endY: -170, delay: 100, size: 22 },
  { emoji: "🥳", endX:  60, endY: -145, delay: 310, size: 28 },
  { emoji: "🎈", endX: -85, endY:  -85, delay: 190, size: 24 },
  { emoji: "⭐", endX:  75, endY: -175, delay: 260, size: 22 },
];

const EmployeeApprovedScreen: React.FC<ScreenProps<"EmployeeApproved">> = ({ navigation, route }) => {
  const storeName = route.params?.storeName ?? localStorage.getItem("pendingStoreName") ?? "매장";
  const [userName, setUserName] = useState("");

  const iconScale      = useSharedValue(0);
  const dotProgress    = useSharedValue(0);
  const titleOpacity   = useSharedValue(0);
  const titleY         = useSharedValue(16);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY       = useSharedValue(16);
  const btnOpacity     = useSharedValue(0);
  const btnY           = useSharedValue(16);

  // emoji progress values (hooks must not be in loops)
  const em0 = useSharedValue(0);
  const em1 = useSharedValue(0);
  const em2 = useSharedValue(0);
  const em3 = useSharedValue(0);
  const em4 = useSharedValue(0);
  const em5 = useSharedValue(0);

  // dot animated styles
  const dot0Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dotProgress.value * 1.5),
    transform: [{ translateX: dotProgress.value * DOTS[0].dx }, { translateY: dotProgress.value * DOTS[0].dy }],
  }));
  const dot1Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dotProgress.value * 1.5),
    transform: [{ translateX: dotProgress.value * DOTS[1].dx }, { translateY: dotProgress.value * DOTS[1].dy }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dotProgress.value * 1.5),
    transform: [{ translateX: dotProgress.value * DOTS[2].dx }, { translateY: dotProgress.value * DOTS[2].dy }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dotProgress.value * 1.5),
    transform: [{ translateX: dotProgress.value * DOTS[3].dx }, { translateY: dotProgress.value * DOTS[3].dy }],
  }));
  const dot4Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dotProgress.value * 1.5),
    transform: [{ translateX: dotProgress.value * DOTS[4].dx }, { translateY: dotProgress.value * DOTS[4].dy }],
  }));
  const dot5Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dotProgress.value * 1.5),
    transform: [{ translateX: dotProgress.value * DOTS[5].dx }, { translateY: dotProgress.value * DOTS[5].dy }],
  }));
  const dotStyles = [dot0Style, dot1Style, dot2Style, dot3Style, dot4Style, dot5Style];

  // emoji animated styles: fade in → fly out → fade out
  const em0Style = useAnimatedStyle(() => {
    const p = em0.value;
    const opacity = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    const scale   = p < 0.35 ? (p / 0.35) * 1.3 : Math.max(0.4, 1.3 - ((p - 0.35) / 0.65) * 0.9);
    return { opacity, transform: [{ translateX: p * EMOJIS[0].endX }, { translateY: p * EMOJIS[0].endY }, { scale }] };
  });
  const em1Style = useAnimatedStyle(() => {
    const p = em1.value;
    const opacity = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    const scale   = p < 0.35 ? (p / 0.35) * 1.3 : Math.max(0.4, 1.3 - ((p - 0.35) / 0.65) * 0.9);
    return { opacity, transform: [{ translateX: p * EMOJIS[1].endX }, { translateY: p * EMOJIS[1].endY }, { scale }] };
  });
  const em2Style = useAnimatedStyle(() => {
    const p = em2.value;
    const opacity = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    const scale   = p < 0.35 ? (p / 0.35) * 1.3 : Math.max(0.4, 1.3 - ((p - 0.35) / 0.65) * 0.9);
    return { opacity, transform: [{ translateX: p * EMOJIS[2].endX }, { translateY: p * EMOJIS[2].endY }, { scale }] };
  });
  const em3Style = useAnimatedStyle(() => {
    const p = em3.value;
    const opacity = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    const scale   = p < 0.35 ? (p / 0.35) * 1.3 : Math.max(0.4, 1.3 - ((p - 0.35) / 0.65) * 0.9);
    return { opacity, transform: [{ translateX: p * EMOJIS[3].endX }, { translateY: p * EMOJIS[3].endY }, { scale }] };
  });
  const em4Style = useAnimatedStyle(() => {
    const p = em4.value;
    const opacity = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    const scale   = p < 0.35 ? (p / 0.35) * 1.3 : Math.max(0.4, 1.3 - ((p - 0.35) / 0.65) * 0.9);
    return { opacity, transform: [{ translateX: p * EMOJIS[4].endX }, { translateY: p * EMOJIS[4].endY }, { scale }] };
  });
  const em5Style = useAnimatedStyle(() => {
    const p = em5.value;
    const opacity = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
    const scale   = p < 0.35 ? (p / 0.35) * 1.3 : Math.max(0.4, 1.3 - ((p - 0.35) / 0.65) * 0.9);
    return { opacity, transform: [{ translateX: p * EMOJIS[5].endX }, { translateY: p * EMOJIS[5].endY }, { scale }] };
  });
  const emojiStyles = [em0Style, em1Style, em2Style, em3Style, em4Style, em5Style];
  const emojiValues = [em0, em1, em2, em3, em4, em5];

  useEffect(() => {
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);
    getMe().then((me) => { if (me?.name) setUserName(me.name); }).catch((e) => console.warn(e));
    registerForPushNotifications().catch((e) => console.warn(e));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 아이콘 scale pop
    iconScale.value = withSequence(
      withTiming(1.2, { duration: 380, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(0.92, { duration: 130 }),
      withTiming(1.0, { duration: 150 }),
    );

    // 컨페티 도트 산란
    dotProgress.value = withDelay(80, withTiming(1, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    }));

    // 이모지 폭죽 — 각각 다른 딜레이로 터져 나감
    EMOJIS.forEach(({ delay }, i) => {
      emojiValues[i].value = withDelay(delay, withTiming(1, {
        duration: 950,
        easing: Easing.out(Easing.cubic),
      }));
    });

    // 텍스트 순차 등장
    titleOpacity.value   = withDelay(520, withTiming(1, { duration: 380 }));
    titleY.value         = withDelay(520, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    subtitleOpacity.value = withDelay(700, withTiming(1, { duration: 380 }));
    subtitleY.value       = withDelay(700, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    btnOpacity.value     = withDelay(860, withTiming(1, { duration: 380 }));
    btnY.value           = withDelay(860, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));

    return () => { backSub.remove(); };
  }, []);

  const iconStyle     = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const titleStyle    = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: titleY.value }] }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value, transform: [{ translateY: subtitleY.value }] }));
  const btnStyle      = useAnimatedStyle(() => ({ opacity: btnOpacity.value, transform: [{ translateY: btnY.value }] }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1 }}>

        {/* 아이콘 영역 — absolute로 고정, 텍스트와 독립 */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, top: 160, alignItems: "center" }}
        >
          <View style={{ width: 300, height: 300, alignItems: "center", justifyContent: "center" }}>

            {/* 컨페티 도트 */}
            {DOTS.map((dot, i) => (
              <Animated.View
                key={`dot-${i}`}
                style={[{
                  position: "absolute",
                  width: dot.size, height: dot.size, borderRadius: dot.size / 2,
                  backgroundColor: dot.color,
                }, dotStyles[i]]}
              />
            ))}

            {/* 이모지 폭죽 */}
            {EMOJIS.map((e, i) => (
              <Animated.Text
                key={`emoji-${i}`}
                style={[{ position: "absolute", fontSize: e.size }, emojiStyles[i]]}
              >
                {e.emoji}
              </Animated.Text>
            ))}

            {/* 메인 아이콘 */}
            <Animated.Image
              source={require("../../../assets/images/icon/sign-in-check.png")}
              style={[{ width: 100, height: 100 }, iconStyle]}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* 텍스트 — absolute로 아이콘과 독립 배치 */}
        <View style={{ position: "absolute", left: 24, right: 24, top: 420, alignItems: "center" }}>
          {/* 타이틀 */}
          <Animated.View style={[{ marginBottom: 16 }, titleStyle]}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#19191B", textAlign: "center", letterSpacing: -0.48, lineHeight: 34 }}>
              {`${storeName}\n가입 승인이 완료되었어요`}
            </Text>
          </Animated.View>

          {/* 서브타이틀 */}
          <Animated.View style={subtitleStyle}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#7488FE", textAlign: "center", letterSpacing: -0.3, lineHeight: 24 }}>
              {userName
                ? `${userName}님, 반가워요! 회원가입이 완료됐어요\n오늘 일정을 확인해 볼까요?`
                : "반가워요! 회원가입이 완료됐어요\n오늘 일정을 확인해 볼까요?"}
            </Text>
          </Animated.View>
        </View>

      </View>

      {/* 하단 버튼 */}
      <Animated.View style={[{ paddingHorizontal: 24, paddingBottom: 32 }, btnStyle]}>
        <TouchableOpacity
          onPress={() => {
            localStorage.removeItem("pendingMemberRequest");
            localStorage.removeItem("pendingStoreName");
            navigation.reset({ index: 0, routes: [{ name: "EmployeeHome" }] });
          }}
          style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.34 }}>홈으로 이동하기</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

export default EmployeeApprovedScreen;
