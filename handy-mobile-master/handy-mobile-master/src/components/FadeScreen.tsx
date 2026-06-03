import React, { useLayoutEffect } from "react";
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from "react-native-reanimated";

interface FadeScreenProps {
  children: React.ReactNode;
  duration?: number;
}

/**
 * 탭 전환 시 fade-in 효과 제공.
 * useLayoutEffect → mount 시에만 실행 (뒤로가기로 re-focus 시 재실행 안 됨)
 */
const FadeScreen: React.FC<FadeScreenProps> = ({ children, duration = 100 }) => {
  const opacity = useSharedValue(0);

  useLayoutEffect(() => {
    opacity.value = withTiming(1, { duration });
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      {children}
    </Animated.View>
  );
};

export default FadeScreen;
