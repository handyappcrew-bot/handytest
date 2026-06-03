import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
  /** 우측 상단에 노출할 카운트 배지 (예: 요청 N건) — 탭별 매핑 */
  badges?: Record<string, number>;
}

/**
 * Web 사장 화면 상단 탭 (sticky 헤더 하단) 통일 UI
 * - 활성: #4261FF / 700 / underline 3px
 * - 비활성: #AAB4BF / 500
 */
const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onChange, badges }) => {
  return (
    <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 24, alignItems: "flex-end" }}
      style={{ borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const badgeCount = badges?.[tab];
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={{ paddingVertical: 12, position: "relative" }}
            hitSlop={4}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {badgeCount != null && badgeCount > 0 && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF3D3D" }} />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? "600" : "500",
                  color: isActive ? "#4261FF" : "#AAB4BF",
                  letterSpacing: -0.28,
                }}
              >
                {tab}
                {badgeCount != null && badgeCount > 0 ? ` ${badgeCount}건` : ""}
              </Text>
            </View>
            {isActive && (
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  borderRadius: 99,
                  backgroundColor: "#4261FF",
                }}
              />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default TabBar;
