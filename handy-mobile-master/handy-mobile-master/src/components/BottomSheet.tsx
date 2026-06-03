import React, { useEffect } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showHeader?: boolean;
  children?: React.ReactNode;
}

/**
 * Web BottomSheet 와 동일한 시각적 동작:
 * - 160ms slide-in/out + fade
 * - 헤더 (제목 + X 버튼) 옵션
 * - 배경 탭 시 닫힘
 * - 키보드가 올라올 때 시트도 함께 올라감 (KeyboardAvoidingView)
 */
const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, showHeader = true, children }) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(600);
  const opacity = useSharedValue(0);
  const [mounted, setMounted] = React.useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: 160 });
      opacity.value = withTiming(1, { duration: 160 });
    } else if (mounted) {
      translateY.value = withTiming(600, { duration: 160 });
      opacity.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [isOpen]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} statusBarTranslucent onRequestClose={onClose} animationType="none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)" }, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            {
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: insets.bottom + 32,
            },
            sheetStyle,
          ]}
        >
          {showHeader && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              {title ? (
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>{title}</Text>
              ) : <View />}
              <AnimatedPressable scaleAmount={0.85} opacityAmount={0.6} onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
                <X size={24} color="#19191B" strokeWidth={2} />
              </AnimatedPressable>
            </View>
          )}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default BottomSheet;
