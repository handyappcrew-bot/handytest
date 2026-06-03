import React, { useState } from "react";
import { View, Text, Image, ViewStyle, ImageStyle } from "react-native";
import { photoSource } from "@/utils/image";

const PALETTE = [
  "#5C4033", "#C0392B", "#1ABC9C", "#2C3E50", "#8E44AD",
  "#E67E22", "#E91E63", "#FF9800", "#4261FF",
];

const colorFromName = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

export interface AvatarProps {
  /** 백엔드 image_url (`/uploads/...` 또는 절대 URL). 없으면 이니셜 표시. */
  imageUrl?: string | null;
  /** 이름 — 이니셜 + 배경색 hash 에 사용. */
  name?: string;
  /** 정사각 변. 기본 40. */
  size?: number;
  /** 명시적 배경색. 없으면 이름 hash 기반. */
  bgColor?: string;
  /** 외곽선 (선택). */
  borderColor?: string;
  borderWidth?: number;
  style?: ViewStyle;
  /** imageUrl 없을 때 이니셜 대신 표시할 기본 이미지 (require). */
  defaultSource?: any;
}

/**
 * 직원 카드 / 프로필 / 가입요청 등에서 통일적으로 사용하는 아바타.
 * - imageUrl 있으면 사진 표시
 * - 없으면 name 첫 글자 + 결정적 배경색
 */
const Avatar: React.FC<AvatarProps> = ({
  imageUrl, name, size = 40, bgColor, borderColor, borderWidth = 0, style, defaultSource,
}) => {
  const [imgError, setImgError] = useState(false);
  const photo = photoSource(imageUrl);
  const showPhoto = photo && !imgError;
  const initial = (name ?? "?").trim().charAt(0) || "?";
  const fontSize = Math.max(11, Math.round(size * 0.4));
  const bg = bgColor ?? (defaultSource && !showPhoto ? "transparent" : (name ? colorFromName(name) : "#DBDCDF"));

  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          borderWidth, borderColor,
        },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={photo}
          style={{ width: "100%", height: "100%" } as ImageStyle}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : defaultSource ? (
        <Image source={defaultSource} style={{ width: "100%", height: "100%" } as ImageStyle} resizeMode="cover" />
      ) : (
        <Text style={{ fontSize, fontWeight: "700", color: "#FFFFFF" }}>{initial}</Text>
      )}
    </View>
  );
};

export default Avatar;
