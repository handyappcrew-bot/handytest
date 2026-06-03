import React from "react";
import { View, Text } from "react-native";
import { WifiOff, RotateCw } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";

interface ErrorStateProps {
  message?: string;
  subMessage?: string;
  onRetry?: () => void;
  compact?: boolean;
}

// 데이터 로드 실패 시 공통 에러 화면. EmptyState와 시각적으로 통일하되 재시도 버튼 제공.
const ErrorState: React.FC<ErrorStateProps> = ({
  message = "정보를 불러오지 못했어요",
  subMessage = "네트워크 상태를 확인하고 다시 시도해 주세요",
  onRetry,
  compact = false,
}) => {
  const size = compact ? 44 : 56;
  const iconSize = compact ? 22 : 28;
  return (
    <View
      style={{
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        paddingVertical: compact ? 40 : 80,
        gap: 12,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#F7F7F8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <WifiOff size={iconSize} color="#AAB4BF" strokeWidth={1.6} />
      </View>
      <Text
        style={{
          fontSize: compact ? 13 : 14,
          fontWeight: "500",
          color: "#9EA3AD",
          letterSpacing: -0.28,
          textAlign: "center",
          lineHeight: compact ? 19 : 21,
        }}
      >
        {message}
      </Text>
      {subMessage ? (
        <Text
          style={{
            fontSize: 12,
            color: "#AAB4BF",
            letterSpacing: -0.24,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          {subMessage}
        </Text>
      ) : null}
      {onRetry ? (
        <AnimatedPressable
          onPress={onRetry}
          scaleAmount={0.96}
          opacityAmount={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: "#EEF1FF",
          }}
        >
          <RotateCw size={15} color="#4261FF" strokeWidth={2.2} />
          <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: "#4261FF" }}>
            다시 시도
          </Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
};

export default ErrorState;
