import React from "react";
import { View, Text } from "react-native";
import { Info } from "lucide-react-native";

interface Props {
  status: "휴직" | "퇴사";
}

const LeaveBanner: React.FC<Props> = ({ status }) => {
  const isLeave = status === "휴직";
  const bg = isLeave ? "rgba(255,152,0,0.10)" : "rgba(112,115,123,0.10)";
  const color = isLeave ? "#FF9800" : "#70737B";
  const message = isLeave
    ? "휴직 중이에요. 복직 시 정상 이용 가능해요."
    : "퇴사 처리된 계정이에요. 이전 기록만 조회할 수 있어요.";

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Info size={15} color={color} />
      <Text style={{ fontSize: 13, fontWeight: "600", color, flex: 1 }}>{message}</Text>
    </View>
  );
};

export default LeaveBanner;
