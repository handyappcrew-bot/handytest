import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getNotices, NoticeItem } from "@/api/public";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import AnimatedPressable from "@/components/AnimatedPressable";
import type { ScreenProps } from "@/navigation/types";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const AnnouncementsScreen: React.FC<ScreenProps<"Announcements">> = ({ navigation }) => {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    getNotices()
      .then((rs) => setItems(rs ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>공지사항</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {/* List area with background */}
      <View style={{ flex: 1, backgroundColor: "#F7F7F8" }}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 12 }}>
          {loading ? (
            <View style={{ paddingTop: 120, alignItems: "center" }}>
              <DotsLoader />
            </View>
          ) : error ? (
            <View style={{ paddingTop: 80, alignItems: "center" }}>
              <ErrorState onRetry={load} compact />
            </View>
          ) : items.length === 0 ? (
            <View style={{ paddingTop: 80, alignItems: "center" }}>
              <EmptyState message="공지사항이 없어요" compact />
            </View>
          ) : (
            items.map((n) => (
              <AnimatedPressable
                key={n.id}
                onPress={() => navigation.navigate("AnnouncementDetail", { id: n.id })}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  borderRadius: 16, backgroundColor: "#FFFFFF",
                  paddingHorizontal: 20, paddingVertical: 16,
                  shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: "600", letterSpacing: -0.3, color: "#19191B" }}
                    numberOfLines={1}
                  >
                    {n.title}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "400", letterSpacing: -0.26, color: "#AAB4BF", marginTop: 4 }}>
                    {formatDate(n.created_at)}
                  </Text>
                </View>
                <ChevronRight size={20} color="#AAB4BF" />
              </AnimatedPressable>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default AnnouncementsScreen;
