import React from "react";
import { View, Text, ScrollView } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";

interface FilterChipsProps {
  /** 필터 키 목록. 첫 번째는 보통 "전체" */
  filters: string[];
  active: string;
  onChange: (f: string) => void;
  /** "전체" 칩에 추가할 카운트 (예: `전체 ${count}`) */
  totalCount?: number;
}

/**
 * Web 요청 류 화면 통일 UI 칩
 * - active: bg #E8F3FF / color #4261FF / border #4261FF
 * - inactive: bg #FFFFFF / color #AAB4BF / border #DBDCDF
 */
const FilterChips: React.FC<FilterChipsProps> = ({ filters, active, onChange, totalCount }) => {
  return (
    <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      style={{ marginBottom: 16, flexGrow: 0 }}
    >
      {filters.map((f) => {
        const isActive = active === f;
        const label = f === "전체" && totalCount != null ? `전체 ${totalCount}` : f;
        return (
          <AnimatedPressable
            key={f}
            onPress={() => onChange(f)}
            scaleAmount={0.94}
            opacityAmount={0.8}
            style={{
              height: 28,
              paddingHorizontal: 14,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: isActive ? "#4261FF" : "#DBDCDF",
              backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: isActive ? "#4261FF" : "#AAB4BF",
                letterSpacing: -0.28,
              }}
            >
              {label}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
};

export default FilterChips;
