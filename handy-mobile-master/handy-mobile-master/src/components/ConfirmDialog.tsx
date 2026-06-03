import React, { useEffect } from "react";
import { Modal, View, Text, Pressable, useWindowDimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";
import AnimatedPressable from "@/components/AnimatedPressable";

interface Button {
  label: string;
  onPress: () => void;
  variant?: "confirm" | "cancel" | "danger";
}

interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  buttons: Button[];
}

const btnBg = (variant: Button["variant"] = "confirm") => {
  if (variant === "cancel") return "#EBEBEB";
  if (variant === "danger") return "#FF5959";
  return "#4261FF";
};

const btnColor = (variant: Button["variant"] = "confirm") =>
  variant === "cancel" ? "#70737B" : "#FFFFFF";

const DURATION = 150;

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ visible, onClose, title, description, children, buttons }) => {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 320);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: DURATION });
      scale.value = withTiming(1, { duration: DURATION });
    } else {
      opacity.value = withTiming(0, { duration: DURATION });
      scale.value = withTiming(0.92, { duration: DURATION });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }, backdropStyle]}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
        />
        <Animated.View
          style={[{
            width: cardWidth,
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            paddingTop: 28,
            paddingHorizontal: 16,
            paddingBottom: 16,
            alignItems: "center",
          }, cardStyle]}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B", textAlign: "center", marginBottom: 8 }}>
            {title}
          </Text>
          {description ? (
            <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 21, textAlign: "center", marginBottom: children ? 16 : 20 }}>
              {description}
            </Text>
          ) : null}
          {children ? <View style={{ width: "100%", marginBottom: 20 }}>{children}</View> : null}
          <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
            {buttons.map((btn, i) => (
              <AnimatedPressable
                key={i}
                onPress={btn.onPress}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: btnBg(btn.variant),
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: btnColor(btn.variant) }}>
                  {btn.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ConfirmDialog;
