import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFeedbacks, FeedbackItem } from "@/api/public";
import type { ScreenProps } from "@/navigation/types";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const FeedbackDetailScreen: React.FC<ScreenProps<"FeedbackDetail">> = ({ route, navigation }) => {
  const { id } = route.params;
  const [item, setItem] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    getFeedbacks()
      .then((rs) => setItem(rs?.find((f) => f.id === id) ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const isAnswered = item?.status === "answered";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>건의 내역 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {loading || error || !item ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {loading ? (
            <DotsLoader />
          ) : error ? (
            <ErrorState onRetry={load} />
          ) : (
            <EmptyState message="건의 내역을 찾을 수 없어요" />
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Status Banner */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B" }}>
              {"건의 내용이 "}
              <Text style={{ color: isAnswered ? "#16A34A" : "#4261FF" }}>
                {isAnswered ? "답변 완료" : "접수"}
              </Text>
              {"되었어요"}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

          {/* Feedback Content */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B", marginBottom: 16 }}>건의 내용</Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ fontSize: 14, color: "#70737B", width: 64, flexShrink: 0 }}>접수일</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B", flex: 1 }}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ fontSize: 14, color: "#70737B", width: 64, flexShrink: 0 }}>제목</Text>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flex: 1 }}>{item.title}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ fontSize: 14, color: "#70737B", width: 64, flexShrink: 0 }}>건의 내용</Text>
                <Text style={{ fontSize: 14, color: "#19191B", flex: 1, lineHeight: 22 }}>{item.content}</Text>
              </View>
            </View>
          </View>

          {/* Reply Section */}
          {isAnswered && item.answer ? (
            <>
              <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />
              <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B", marginBottom: 16 }}>답변내용</Text>
                <View style={{ gap: 12 }}>
                  {item.answered_at ? (
                    <View style={{ flexDirection: "row" }}>
                      <Text style={{ fontSize: 14, color: "#70737B", width: 64, flexShrink: 0 }}>답변일</Text>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B", flex: 1 }}>{formatDate(item.answered_at)}</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row" }}>
                    <Text style={{ fontSize: 14, color: "#70737B", width: 64, flexShrink: 0 }}>답변 내용</Text>
                    <Text style={{ fontSize: 14, color: "#19191B", flex: 1, lineHeight: 22 }}>{item.answer}</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default FeedbackDetailScreen;
