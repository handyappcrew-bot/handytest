import React from "react";
import { Modal, Pressable, View, Text } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";

interface PopoverMenuProps {
  visible: boolean;
  onClose: () => void;
  x: number;
  y: number;
  children: React.ReactNode;
  width?: number;
}

const PopoverMenu: React.FC<PopoverMenuProps> = ({ visible, onClose, x, y, children, width = 160 }) => {
  if (!visible) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View
          style={{
            position: "absolute",
            top: y,
            left: Math.max(8, x - width),
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#EBEBEB",
            minWidth: width,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 2, height: 2 },
            elevation: 8,
          }}
        >
          {children}
        </View>
      </Pressable>
    </Modal>
  );
};

interface PopoverMenuItemProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  separator?: boolean;
  danger?: boolean;
}

export const PopoverMenuItem: React.FC<PopoverMenuItemProps> = ({ label, icon, onPress, separator, danger }) => (
  <AnimatedPressable
    onPress={onPress}
    scaleAmount={0.98}
    opacityAmount={0.7}
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: separator ? 1 : 0,
      borderBottomColor: "#EBEBEB",
    }}
  >
    <Text style={{ fontSize: 14, color: danger ? "#FF3D3D" : "#19191B" }}>{label}</Text>
    {icon}
  </AnimatedPressable>
);

export default PopoverMenu;
