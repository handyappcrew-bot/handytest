import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { hapticSuccess, hapticWarning } from "@/utils/haptics";

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastOptions {
  description: string;
  title?: string;
  variant?: "default" | "destructive";
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastOptions, "description" | "variant" | "duration">> {
  id: number;
  title?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

// ── Single toast item ─────────────────────────────────────────────────────────
const ToastItemView: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-14);
  const dismissed = useRef(false);

  const runDismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(-8, { duration: 180 });
    setTimeout(onDismiss, 185);
  }, [onDismiss]);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withTiming(0, { duration: 220 });
    const t = setTimeout(runDismiss, item.duration);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isDestructive = item.variant === "destructive";
  const iconColor  = isDestructive ? "#FF3D3D" : "#4261FF";
  const iconBg     = isDestructive ? "rgba(255,61,61,0.15)" : "rgba(66,97,255,0.15)";

  return (
    <Pressable onPress={runDismiss}>
      <Animated.View
        style={[
          {
            backgroundColor: "#19191B",
            borderRadius: 16,
            paddingVertical: 14,
            paddingLeft: 14,
            paddingRight: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.28,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          },
          animStyle,
        ]}
      >
        {/* Icon circle */}
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isDestructive
            ? <X size={15} color={iconColor} strokeWidth={2.5} />
            : <Check size={15} color={iconColor} strokeWidth={2.5} />
          }
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          {item.title ? (
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", lineHeight: 20, marginBottom: 2 }}>
              {item.title}
            </Text>
          ) : null}
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "500", lineHeight: 20 }}>
            {item.description}
          </Text>
        </View>

        {/* Action button */}
        {item.action ? (
          <Pressable
            onPress={() => { item.action!.onPress(); runDismiss(); }}
            hitSlop={6}
            style={{ paddingHorizontal: 6, paddingVertical: 4 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700", textDecorationLine: "underline" }}>
              {item.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Pressable>
  );
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions) => {
    if (opts.variant === "destructive") hapticWarning();
    else hapticSuccess();
    const id = nextId++;
    const item: ToastItem = {
      id,
      description: opts.description,
      title: opts.title,
      variant: opts.variant ?? "default",
      duration: opts.duration ?? (opts.action ? 3500 : 2000),
      action: opts.action,
    };
    setItems((prev) => [...prev, item]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          top: insets.top + 28,
          gap: 8,
        }}
      >
        {items.map((it) => (
          <ToastItemView key={it.id} item={it} onDismiss={() => dismiss(it.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
