import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { hapticLight } from "@/utils/haptics";

interface NavToastContextValue {
  showNavToast: (message: string) => void;
}

const NavToastContext = createContext<NavToastContextValue | null>(null);

export const NavToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState("");
  const opacity   = useSharedValue(0);
  const slideY    = useSharedValue(-10);
  const iconScale = useSharedValue(0.7);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useSafeAreaInsets();

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideY.value }],
  }));

  const iconCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const runAnimations = useCallback(() => {
    opacity.value   = withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) });
    slideY.value    = withTiming(0, { duration: 220, easing: Easing.out(Easing.ease) });
    iconScale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });

    hideTimerRef.current = setTimeout(() => {
      opacity.value = withTiming(0,   { duration: 160, easing: Easing.in(Easing.ease) });
      slideY.value  = withTiming(-10, { duration: 160, easing: Easing.in(Easing.ease) });
    }, 2200);
  }, []);

  const showNavToast = useCallback((msg: string) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);

    hapticLight();
    opacity.value   = 0;
    slideY.value    = -10;
    iconScale.value = 0.7;

    setMessage(msg);
    animTimerRef.current = setTimeout(runAnimations, 300);
  }, [runAnimations]);

  const toastPill = (
    <Animated.View style={[styles.toastContainer, { top: insets.top + 28 }, containerStyle]}>
      <View style={styles.pill}>
        <Animated.View style={[styles.iconCircle, iconCircleStyle]}>
          <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
        </Animated.View>
        <Text style={styles.label}>{message}</Text>
      </View>
    </Animated.View>
  );

  const overlay =
    Platform.OS === "ios" ? (
      <FullWindowOverlay>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {toastPill}
        </View>
      </FullWindowOverlay>
    ) : (
      <View pointerEvents="none" style={styles.overlay}>
        {toastPill}
      </View>
    );

  return (
    <NavToastContext.Provider value={{ showNavToast }}>
      <View style={styles.root}>
        {children}
        {overlay}
      </View>
    </NavToastContext.Provider>
  );
};

export const useNavToast = (): NavToastContextValue => {
  const ctx = useContext(NavToastContext);
  if (!ctx) throw new Error("useNavToast must be used within NavToastProvider");
  return ctx;
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#16213e",
    borderRadius: 9999,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 18,
    borderWidth: 1,
    borderColor: "rgba(66, 97, 255, 0.35)",
    shadowColor: "#4261FF",
    shadowOpacity: 0.30,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 24,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#4261FF",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
});
