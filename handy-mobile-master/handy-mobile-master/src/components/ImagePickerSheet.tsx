import React from "react";
import { View, Text } from "react-native";
import { Image as ImageIcon, Camera, RefreshCw } from "lucide-react-native";
import BottomSheet from "@/components/BottomSheet";
import AnimatedPressable from "@/components/AnimatedPressable";

interface ImagePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onAlbum: () => void;
  onCamera?: () => void;
  /** 기본 이미지로 변경 옵션 (프로필 화면용) */
  onReset?: () => void;
  resetLabel?: string;
}

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}> = ({ icon, label, onPress, danger }) => (
  <AnimatedPressable
    onPress={onPress}
    scaleAmount={0.97}
    opacityAmount={0.75}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: "#F7F7F8",
    }}
  >
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: danger ? "rgba(255,61,61,0.10)" : "rgba(66,97,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </View>
    <Text
      style={{
        fontSize: 16,
        fontWeight: "500",
        letterSpacing: -0.32,
        color: danger ? "#FF3D3D" : "#19191B",
      }}
    >
      {label}
    </Text>
  </AnimatedPressable>
);

const ImagePickerSheet: React.FC<ImagePickerSheetProps> = ({
  isOpen,
  onClose,
  title = "사진 업로드하기",
  onAlbum,
  onCamera,
  onReset,
  resetLabel = "기본 이미지로 변경하기",
}) => (
  <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
    <View style={{ gap: 8 }}>
      <MenuItem
        icon={<ImageIcon size={18} color="#4261FF" />}
        label="앨범에서 선택하기"
        onPress={onAlbum}
      />
      {onCamera && (
        <MenuItem
          icon={<Camera size={18} color="#4261FF" />}
          label="카메라 촬영하기"
          onPress={onCamera}
        />
      )}
      {onReset && (
        <>
          <View style={{ height: 1, backgroundColor: "#EBEBEB", marginVertical: 2 }} />
          <MenuItem
            icon={<RefreshCw size={17} color="#FF3D3D" />}
            label={resetLabel}
            onPress={onReset}
            danger
          />
        </>
      )}
    </View>
  </BottomSheet>
);

export default ImagePickerSheet;
