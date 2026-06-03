import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, Modal } from "react-native";
import { ChevronLeft, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getNoticeDetail, NoticeItem } from "@/api/public";
import AnimatedPressable from "@/components/AnimatedPressable";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import EmptyState from "@/components/EmptyState";
import type { ScreenProps } from "@/navigation/types";

const DetailHeader = ({ onBack }: { onBack: () => void }) => (
  <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
      <Pressable onPress={onBack} style={{ padding: 4 }} hitSlop={8}>
        <ChevronLeft size={24} color="#19191B" />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>공지사항</Text>
    </View>
    <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
  </>
);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const AnnouncementDetailScreen: React.FC<ScreenProps<"AnnouncementDetail">> = ({ route, navigation }) => {
  const { id } = route.params;
  const [item, setItem] = useState<NoticeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    getNoticeDetail(id)
      .then(setItem)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  // 로딩 중
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <DetailHeader onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
      </SafeAreaView>
    );
  }

  // 로드 실패 → 재시도
  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <DetailHeader onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ErrorState onRetry={load} />
        </View>
      </SafeAreaView>
    );
  }

  // 정상 응답인데 데이터 없음 → 찾을 수 없음
  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <DetailHeader onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <EmptyState message="공지사항을 찾을 수 없어요" />
        </View>
      </SafeAreaView>
    );
  }

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

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B", lineHeight: 27 }}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 13, color: "#AAB4BF", letterSpacing: -0.26, marginTop: 4 }}>
          {formatDate(item.created_at)}
        </Text>

        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 15, color: "#70737B", letterSpacing: -0.3, lineHeight: 25 }}>
            {item.content ?? ""}
          </Text>
        </View>

        {/* Images */}
        {item.images && item.images.length > 0 && (
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
            horizontal
            contentContainerStyle={{ gap: 12, marginTop: 24 }}
          >
            {item.images.map((img: string, idx: number) => (
              <AnimatedPressable key={idx} onPress={() => setLightboxPhoto(img)} scaleAmount={0.97} opacityAmount={0.8} style={{ flexShrink: 0 }}>
                <Image
                  source={{ uri: img }}
                  style={{ width: 160, height: 160, borderRadius: 12 }}
                  resizeMode="cover"
                />
              </AnimatedPressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      {/* Lightbox modal */}
      <Modal visible={lightboxPhoto != null} transparent animationType="fade" onRequestClose={() => setLightboxPhoto(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setLightboxPhoto(null)}
        >
          <Pressable
            style={{ position: "absolute", top: 48, right: 16, padding: 8, zIndex: 10 }}
            onPress={() => setLightboxPhoto(null)}
          >
            <X size={28} color="#FFFFFF" />
          </Pressable>
          {lightboxPhoto && (
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Image
                source={{ uri: lightboxPhoto }}
                style={{ width: "90%", maxHeight: "85%", borderRadius: 12 }}
                resizeMode="contain"
              />
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default AnnouncementDetailScreen;
