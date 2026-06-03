import React, { useEffect } from "react";
import { Text, View, Pressable } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "lg" | "md";
  fullWidth?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label, onPress, disabled = false, loading = false, variant = "primary", size = "lg", fullWidth = true,
}) => {
  const height = size === "lg" ? 56 : 48;
  const radius = size === "lg" ? 16 : 12;

  const palette = {
    primary: { bg: "#4261FF", color: "#FFFFFF" },
    secondary: { bg: "#DEEBFF", color: "#4261FF" },
    danger: { bg: "#FF3D3D", color: "#FFFFFF" },
  }[variant];

  const isInactive = disabled || loading;
  const bgColor = isInactive && variant === "primary" ? "#DBDCDF" : palette.bg;
  const staticOpacity = isInactive && variant !== "primary" ? 0.5 : 1;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(staticOpacity);

  useEffect(() => {
    opacity.value = withTiming(staticOpacity, { duration: 150 });
  }, [staticOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (isInactive) return;
    scale.value = withTiming(0.97, { duration: 80 });
    opacity.value = withTiming(0.75, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = withTiming(staticOpacity, { duration: 200 });
  };

  return (
    <ReanimatedPressable
      onPress={isInactive ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: bgColor,
          alignItems: "center" as const,
          justifyContent: "center" as const,
          width: fullWidth ? ("100%" as const) : undefined,
          paddingHorizontal: fullWidth ? 0 : 16,
        },
        animStyle,
      ] as any}
    >
      {loading ? (
        <DotsLoader color={palette.color} size="sm" />
      ) : (
        <Text style={{
          fontSize: 16,
          fontWeight: "600" as const,
          color: palette.color,
          letterSpacing: -0.32,
        }}>
          {label}
        </Text>
      )}
    </ReanimatedPressable>
  );
};

interface ButtonRowProps {
  cancelLabel?: string;
  confirmLabel: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  ratio?: [number, number];
}

export const ButtonRow: React.FC<ButtonRowProps> = ({
  cancelLabel = "취소", confirmLabel, onCancel, onConfirm,
  confirmDisabled, confirmLoading, ratio = [1, 1.5],
}) => (
  <View style={{ flexDirection: "row", gap: 12 }}>
    <View style={{ flex: ratio[0] }}>
      <PrimaryButton label={cancelLabel} onPress={onCancel} variant="secondary" />
    </View>
    <View style={{ flex: ratio[1] }}>
      <PrimaryButton label={confirmLabel} onPress={onConfirm} disabled={confirmDisabled} loading={confirmLoading} />
    </View>
  </View>
);

export default PrimaryButton;
