import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";

interface DotProps { color: string; dotSize: number; delay: number }

const Dot: React.FC<DotProps> = ({ color, dotSize, delay }) => {
  const opacity = useSharedValue(0.3);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 288 }),
        withTiming(0.3, { duration: 288 }),
        withTiming(0.3, { duration: 144 }),
      ), -1, false,
    ));
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-4, { duration: 288 }),
        withTiming(0, { duration: 288 }),
        withTiming(0, { duration: 144 }),
      ), -1, false,
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
        animStyle,
      ]}
    />
  );
};

interface DotsLoaderProps {
  color?: string;
  size?: "sm" | "md";
}

const DotsLoader: React.FC<DotsLoaderProps> = ({ color = "#4261FF", size = "md" }) => {
  const dotSize = size === "sm" ? 6 : 8;
  const gap = size === "sm" ? 4 : 6;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      <Dot color={color} dotSize={dotSize} delay={0} />
      <Dot color={color} dotSize={dotSize} delay={120} />
      <Dot color={color} dotSize={dotSize} delay={240} />
    </View>
  );
};

export default DotsLoader;
