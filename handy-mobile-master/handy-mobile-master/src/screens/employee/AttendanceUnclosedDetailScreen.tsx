import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import type { ScreenProps } from "@/navigation/types";

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

const formatDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${y}년 ${m}월 ${d}일 (${DAYS_KR[dow]})`;
};

const AttendanceUnclosedDetailScreen: React.FC<ScreenProps<"AttendanceUnclosedDetail">> = ({ route, navigation }) => {
  const { workDate, startTime } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("EmployeeHome"); }} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>근태 알림 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 28 }}>
        {/* 배지 */}
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: "#ECFFF1" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#10C97D" }}>근태</Text>
          </View>
        </View>

        <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>
          {formatDate(workDate)}
        </Text>
        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 32 }}>
          퇴근 처리가 되지 않았어요
        </Text>

        {/* 내역 카드 */}
        <View style={{ borderRadius: 16, backgroundColor: "#F7F7F8", padding: 20, gap: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#70737B" }}>출근</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>
              {startTime ?? "-"}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#70737B" }}>퇴근</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FF3D3D" }}>미처리</Text>
          </View>
        </View>

        {/* 안내 */}
        <Text style={{ fontSize: 13, color: "#AAB4BF", marginTop: 16, lineHeight: 19 }}>
          퇴근 기록이 없는 경우 사장님이 직접 확인합니다. 수정이 필요하면 근무 기록 수정을 요청해 주세요.
        </Text>
      </View>

      {/* 하단 버튼 */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
        <AnimatedPressable
          onPress={() => navigation.navigate("EmployeeAttendance")}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>출근 관리 확인하기</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
};

export default AttendanceUnclosedDetailScreen;
