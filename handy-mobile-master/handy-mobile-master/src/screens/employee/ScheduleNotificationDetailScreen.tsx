import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronDown, Clock, Calendar } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { getMySchedule } from "@/api/employee";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

const formatWorkDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${y}년 ${m}월 ${d}일 (${DAYS_KR[dow]})`;
};

const TYPE_CONFIG = {
  added:   { label: "일정 추가됨", color: "#4261FF", badgeBg: "#EEF2FF", cardBg: "#F0F7FF", shiftBg: "#DEEAFF", clockColor: "#4261FF",  timeColor: "#4261FF"  },
  changed: { label: "일정 수정됨", color: "#FF862D", badgeBg: "#FFF3EB", cardBg: "#F0F7FF", shiftBg: "#DEEAFF", clockColor: "#4261FF",  timeColor: "#4261FF"  },
  deleted: { label: "일정 삭제됨", color: "#FF3D3D", badgeBg: "#FFF0EE", cardBg: "#FFF0EE", shiftBg: "#FFD9D2", clockColor: "#FF9898",  timeColor: "#FF9898"  },
};

const ScheduleNotificationDetailScreen: React.FC<ScreenProps<"ScheduleNotificationDetail">> = ({ route, navigation }) => {
  const {
    notifType, workDate, message,
    workStart, workEnd, shiftName,
    oldStart, oldEnd, newStart, newEnd,
  } = route.params;

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [fetched, setFetched] = useState<{ work_start?: string | null; work_end?: string | null; shift_name?: string | null } | null>(null);
  const needsFetch = notifType !== "deleted" && !workStart;
  const [loading, setLoading] = useState(needsFetch);

  useEffect(() => {
    if (!needsFetch || !workDate) { setLoading(false); return; }
    const [y, m] = workDate.split("-").map(Number);
    getMySchedule(storeId, y, m)
      .then((res: any) => {
        const schedules: Record<string, any> = res?.schedules ?? res ?? {};
        const [yr, mo, dy] = workDate.split("-").map(Number);
        const entry = schedules[workDate] ?? schedules[`${yr}-${mo}-${dy}`] ?? null;
        setFetched(entry);
      })
      .catch(() => setFetched(null))
      .finally(() => setLoading(false));
  }, []);

  const cfg = TYPE_CONFIG[notifType];

  // Resolved display values
  const displayStart   = workStart ?? fetched?.work_start ?? null;
  const displayEnd     = workEnd   ?? fetched?.work_end   ?? null;
  const displayShift   = shiftName ?? fetched?.shift_name ?? null;
  const displayNewStart = newStart  ?? fetched?.work_start ?? null;
  const displayNewEnd   = newEnd    ?? fetched?.work_end   ?? null;

  const renderShiftBadge = (bg: string, color: string) => (
    <View style={{ alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: displayShift ? bg : "#F0F0F0", marginBottom: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: displayShift ? color : "#70737B" }}>{displayShift ?? "일일"}</Text>
    </View>
  );

  const renderTime = (start: string | null, end: string | null, color: string, clockColor: string, strikethrough: boolean) =>
    start ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Clock size={18} color={clockColor} />
        <Text style={{ fontSize: 20, fontWeight: "700", color, textDecorationLine: strikethrough ? "line-through" : "none" }}>
          {start} – {end ?? "-"}
        </Text>
      </View>
    ) : (
      <Text style={{ fontSize: 14, color: "#AAB4BF" }}>일정 정보를 불러올 수 없어요</Text>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <AnimatedPressable onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("EmployeeHome"); }} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronLeft size={24} color="#19191B" />
        </AnimatedPressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>일정 알림 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* 타입 뱃지 */}
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: cfg.badgeBg }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", marginBottom: 4 }}>{formatWorkDate(workDate)}</Text>
        <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 28, lineHeight: 20 }}>{message}</Text>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color="#4261FF" />
          </View>
        ) : (
          <>
            {/* ── 추가됨 ── */}
            {notifType === "added" && (
              <View style={{ borderRadius: 16, backgroundColor: "#F0F7FF", padding: 20 }}>
                <Text style={{ fontSize: 12, color: "#4261FF", fontWeight: "600", marginBottom: 12 }}>추가된 일정</Text>
                {renderTime(displayStart, displayEnd, "#4261FF", "#4261FF", false)}
              </View>
            )}

            {/* ── 수정됨 ── */}
            {notifType === "changed" && (
              <View style={{ gap: 8 }}>
                {/* 변경 전 */}
                <View style={{ borderRadius: 16, backgroundColor: "#F7F7F8", padding: 20 }}>
                  <Text style={{ fontSize: 12, color: "#9EA3AD", fontWeight: "600", marginBottom: 12 }}>변경 전</Text>
                  {oldStart ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Clock size={18} color="#C8CDD6" />
                      <Text style={{ fontSize: 20, fontWeight: "700", color: "#C8CDD6", textDecorationLine: "line-through" }}>
                        {oldStart} – {oldEnd ?? "-"}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>이전 일정 정보를 불러올 수 없어요</Text>
                  )}
                </View>

                {/* 화살표 */}
                <View style={{ alignItems: "center", paddingVertical: 4 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" }}>
                    <ChevronDown size={18} color="#4261FF" />
                  </View>
                </View>

                {/* 변경 후 */}
                <View style={{ borderRadius: 16, backgroundColor: "#F0F7FF", padding: 20 }}>
                  <Text style={{ fontSize: 12, color: "#4261FF", fontWeight: "600", marginBottom: 12 }}>변경 후</Text>
                  {renderTime(displayNewStart, displayNewEnd, "#4261FF", "#4261FF", false)}
                </View>
              </View>
            )}

            {/* ── 삭제됨 ── */}
            {notifType === "deleted" && (
              <>
                <View style={{ borderRadius: 16, backgroundColor: "#FFF0EE", padding: 20, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: "#FF3D3D", fontWeight: "600", marginBottom: 12 }}>삭제된 일정</Text>
                  {displayStart ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Clock size={18} color="#FF9898" />
                      <Text style={{ fontSize: 20, fontWeight: "700", color: "#FF9898", textDecorationLine: "line-through" }}>
                        {displayStart} – {displayEnd ?? "-"}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>삭제된 일정 정보를 불러올 수 없어요</Text>
                  )}
                </View>

                <View style={{ borderRadius: 10, backgroundColor: "#FFF8EE", padding: 14 }}>
                  <Text style={{ fontSize: 12, color: "#FF862D", lineHeight: 18 }}>
                    삭제된 일정은 복구할 수 없어요. 일정 추가가 필요하면 사장님께 문의해 주세요.
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* 하단 CTA */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
        <AnimatedPressable
          onPress={() => navigation.navigate("EmployeeSchedule")}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{
            height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
            backgroundColor: notifType === "deleted" ? "#F7F7F8" : "#4261FF",
            flexDirection: "row", gap: 8,
          }}
        >
          <Calendar size={20} color={notifType === "deleted" ? "#70737B" : "#FFFFFF"} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: notifType === "deleted" ? "#70737B" : "#FFFFFF" }}>
            내 일정 확인하기
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
};

export default ScheduleNotificationDetailScreen;
