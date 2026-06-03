import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import AnimatedPressable from "@/components/AnimatedPressable";
import PageLayout from "@/components/PageLayout";
import { Calendar, FileText } from "lucide-react-native";
import { api } from "@/api/client";
import type { ScreenProps } from "@/navigation/types";

const NotificationDeepLinkScreen: React.FC<ScreenProps<"NotificationDeepLink">> = ({ route, navigation }) => {
  const { type, id } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = type === "schedule_change"
      ? `/api/employee/schedule-change/${id}`
      : `/api/employee/schedule-work/${id}`;
    api.get(path).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [type, id]);

  const isChange = type === "schedule_change";

  if (loading) {
    return (
      <PageLayout headerTitle="알림">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
          <DotsLoader />
        </View>
      </PageLayout>
    );
  }

  if (!data) {
    return (
      <PageLayout headerTitle={isChange ? "스케줄 변경 요청" : "추가된 스케줄"}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 40 }}>
          <View style={{ borderRadius: 16, backgroundColor: "#F7F7F8", padding: 24, alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#70737B", marginBottom: 8 }}>
              알림 내용을 찾을 수 없어요
            </Text>
            <Text style={{ fontSize: 14, color: "#9EA3AD", textAlign: "center", lineHeight: 20 }}>
              이미 처리됐거나 삭제된 내용이에요.{"\n"}아래에서 직접 확인해 주세요.
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            <AnimatedPressable
              onPress={() => navigation.navigate("OwnerScheduleManagement", { initialTab: isChange ? "일정 변경 요청" : "주간 일정" })}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Calendar size={20} color="#FFFFFF" />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
                {isChange ? "일정 변경 요청 보기" : "일정 관리 보기"}
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout headerTitle={isChange ? "스케줄 변경 요청" : "추가된 스케줄"}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 16 }}>
        {isChange ? (
          <View style={{ gap: 8 }}>
            {/* 변경 전 */}
            <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#9EA3AD", marginBottom: 8 }}>변경 전</Text>
              <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B", lineHeight: 22 }}>
                {data.origin_date ?? "-"}
                {(data.origin_start || data.origin_end) ? `  ${data.origin_start ?? ""} - ${data.origin_end ?? ""}` : ""}
              </Text>
            </View>
            {/* 변경 후 */}
            <View style={{ backgroundColor: "#F0F7FF", borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 8 }}>변경 후</Text>
              <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B", lineHeight: 22 }}>
                {data.desired_date ?? "-"}
                {(data.desired_start || data.desired_end) ? `  ${data.desired_start ?? ""} - ${data.desired_end ?? ""}` : ""}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: "#F0F7FF", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF", marginBottom: 8 }}>추가된 일정</Text>
            <View style={{ alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: data.shift_name ? "#DEEAFF" : "#F0F0F0", marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: data.shift_name ? "#4261FF" : "#70737B" }}>{data.shift_name ?? "일일"}</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B", lineHeight: 22 }}>
              {data.work_date ?? "-"}
              {(data.work_start || data.work_end) ? `  ${data.work_start ?? ""} - ${data.work_end ?? ""}` : ""}
            </Text>
          </View>
        )}

        {data.reason ? (
          <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#9EA3AD", marginBottom: 6 }}>사유</Text>
            <Text style={{ fontSize: 15, color: "#19191B" }}>{data.reason}</Text>
          </View>
        ) : null}

        <AnimatedPressable
          onPress={() => navigation.navigate("OwnerScheduleManagement", { initialTab: isChange ? "일정 변경 요청" : "주간 일정" })}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 52, borderRadius: 14, backgroundColor: "#EEF2FF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}
        >
          <FileText size={18} color="#4261FF" />
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#4261FF" }}>
            {isChange ? "일정 변경 요청 목록 보기" : "일정 관리 보기"}
          </Text>
        </AnimatedPressable>
      </View>
    </PageLayout>
  );
};

export default NotificationDeepLinkScreen;
