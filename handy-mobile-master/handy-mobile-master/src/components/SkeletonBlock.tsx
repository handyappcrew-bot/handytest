import React, { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";

interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  delay?: number;
  style?: ViewStyle;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  delay = 0,
  style,
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.4, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ), -1, false,
    ));
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { backgroundColor: "#EBEBEB" } as ViewStyle,
        style,
        { width, height, borderRadius } as ViewStyle,
        animStyle,
      ]}
    />
  );
};

export default SkeletonBlock;
