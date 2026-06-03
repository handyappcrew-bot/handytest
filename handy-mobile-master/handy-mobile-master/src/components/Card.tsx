import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 패딩 적용 (기본 16) */
  padding?: number;
}

/**
 * Web 카드 (bg #FFFFFF / border-radius 16 / shadow) 통일.
 */
const Card: React.FC<CardProps> = ({ children, style, padding = 16 }) => (
  <View
    style={[
      {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 2, height: 2 },
        elevation: 2,
        overflow: "hidden",
      },
      style,
    ]}
  >
    {children}
  </View>
);

export default Card;
