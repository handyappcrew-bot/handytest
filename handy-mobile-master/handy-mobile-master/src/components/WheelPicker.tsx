import React, { useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";

interface WheelPickerProps {
  values: (string | number)[];
  selected: string | number;
  onChange: (v: string | number) => void;
  itemHeight?: number;
  visibleCount?: number;
  width?: number;
}

/**
 * iOS 스타일 wheel picker.
 * snap-to-item, 가운데 강조 표시.
 */
const WheelPicker: React.FC<WheelPickerProps> = ({
  values, selected, onChange,
  itemHeight = 40, visibleCount = 5, width = 80,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const containerHeight = itemHeight * visibleCount;
  const padding = (containerHeight - itemHeight) / 2;

  useEffect(() => {
    const idx = values.findIndex((v) => v === selected);
    if (idx >= 0) {
      scrollRef.current?.scrollTo({ y: idx * itemHeight, animated: false });
    }
  }, [selected, values, itemHeight]);

  return (
    <View style={{ height: containerHeight, width, position: "relative" }}>
      {/* 중앙 하이라이트 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0,
          top: padding, height: itemHeight,
          backgroundColor: "rgba(66, 97, 255, 0.06)",
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#EBEBEB",
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: padding }}
        onMomentumScrollEnd={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const idx = Math.round(y / itemHeight);
          const clamped = Math.max(0, Math.min(values.length - 1, idx));
          onChange(values[clamped]);
        }}
        onScrollEndDrag={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const idx = Math.round(y / itemHeight);
          const clamped = Math.max(0, Math.min(values.length - 1, idx));
          onChange(values[clamped]);
        }}
      >
        {values.map((v, i) => {
          const isSelected = v === selected;
          return (
            <Pressable
              key={`${v}-${i}`}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * itemHeight, animated: true });
                onChange(v);
              }}
              style={{ height: itemHeight, alignItems: "center", justifyContent: "center" }}
            >
              <Text
                style={{
                  fontSize: isSelected ? 17 : 15,
                  fontWeight: isSelected ? "600" : "400",
                  color: isSelected ? "#19191B" : "#AAB4BF",
                }}
              >
                {String(v)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default WheelPicker;
