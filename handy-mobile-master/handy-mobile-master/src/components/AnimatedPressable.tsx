import React from "react";
import { Pressable, PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

// Animate the Pressable directly — no inner Animated.View needed.
// This avoids the Android Fabric layout bug where Animated.View inside
// Pressable fails to inherit the parent's flex/width context.
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  scaleAmount?: number;
  opacityAmount?: number;
}

const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPressIn,
  onPressOut,
  style,
  disabled,
  scaleAmount = 0.97,
  opacityAmount = 0.75,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => {
    const s = scale.value;
    const o = opacity.value;
    if (s === 1 && o === 1) return {};
    return { transform: [{ scale: s }], opacity: o };
  });

  const handlePressIn = (e: any) => {
    if (!disabled) {
      scale.value = withTiming(scaleAmount, { duration: 80 });
      opacity.value = withTiming(opacityAmount, { duration: 80 });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = withTiming(1, { duration: 200 });
    onPressOut?.(e);
  };

  return (
    <AnimatedPressableBase
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style as any, animStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
};

export default AnimatedPressable;
