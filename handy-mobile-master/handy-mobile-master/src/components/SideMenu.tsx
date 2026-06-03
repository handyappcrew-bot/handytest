import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet, Image } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, LogOut } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { API_BASE_URL } from "@/api/client";

interface MenuItem {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  storeName?: string;
  /** "사장님" / "직원" */
  roleLabel?: string;
  imageUrl?: string | null;
  items: MenuItem[];
  subItems?: MenuItem[];
  onLogout?: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  onClose,
  userName,
  storeName,
  roleLabel,
  imageUrl,
  items,
  subItems,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const tx = useSharedValue(-400);
  const opacity = useSharedValue(0);
  const [modalVisible, setModalVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setModalVisible(true);
      tx.value = withTiming(0, { duration: 220 });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      tx.value = withTiming(-400, { duration: 220 });
      opacity.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setModalVisible)(false);
      });
    }
  }, [isOpen]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal transparent visible={modalVisible} statusBarTranslucent onRequestClose={onClose} animationType="none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }, overlayStyle]} />
      </Pressable>
      <Animated.View
        style={[
          {
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: "82%", backgroundColor: "#FFFFFF",
            paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16,
          },
          panelStyle,
        ]}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}` }}
                  style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#F7F7F8" }}
                />
              ) : (
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 26, fontWeight: "700", color: "#4261FF" }}>
                    {userName ? userName[0] : "?"}
                  </Text>
                </View>
              )}
              <View>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B" }}>{userName ?? "회원"}</Text>
                {roleLabel ? <Text style={{ fontSize: 14, color: "#70737B", marginTop: 2 }}>{roleLabel}</Text> : null}
                {storeName ? <Text style={{ fontSize: 14, color: "#9EA3AD", marginTop: 2 }}>{storeName}</Text> : null}
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4, marginTop: 4 }}>
              <X size={24} color="#19191B" />
            </Pressable>
          </View>
        </View>

        {/* Menu items */}
        <View style={{ flex: 1, marginTop: 8 }}>
          {items.map((it, i) => (
            <AnimatedPressable
              key={i}
              onPress={() => { it.onPress(); onClose(); }}
              style={{ paddingHorizontal: 24, paddingVertical: 14 }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: it.danger ? "#FF3D3D" : "#19191B" }}>{it.label}</Text>
            </AnimatedPressable>
          ))}

          {/* Sub items section */}
          {subItems && subItems.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: "#EBEBEB", marginVertical: 24, marginHorizontal: 24 }} />
              {subItems.map((it, i) => (
                <AnimatedPressable
                  key={`sub-${i}`}
                  onPress={() => { it.onPress(); onClose(); }}
                  style={{ paddingHorizontal: 24, paddingVertical: 10 }}
                  scaleAmount={0.97}
                  opacityAmount={0.75}
                >
                  <Text style={{ fontSize: 15, color: it.danger ? "#FF3D3D" : "#70737B" }}>{it.label}</Text>
                </AnimatedPressable>
              ))}
            </>
          )}
        </View>

        {/* Logout */}
        {onLogout && (
          <AnimatedPressable
            onPress={() => { onLogout(); onClose(); }}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingHorizontal: 24, paddingVertical: 14,
              borderTopWidth: 1, borderTopColor: "#EBEBEB",
            }}
          >
            <LogOut size={18} color="#FF3D3D" />
            <Text style={{ fontSize: 15, color: "#FF3D3D" }}>로그아웃</Text>
          </AnimatedPressable>
        )}
      </Animated.View>
    </Modal>
  );
};

export default SideMenu;
