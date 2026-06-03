import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  Image, KeyboardAvoidingView, Platform,
} from "react-native";
import { ChevronLeft, ChevronRight, Camera, X } from "lucide-react-native";
import BottomSheet from "@/components/BottomSheet";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getFeedbacks, postFeedback, FeedbackItem } from "@/api/public";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import type { ScreenProps } from "@/navigation/types";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const FeedbackScreen: React.FC<ScreenProps<"Feedback">> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<"submit" | "history">("submit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isFormValid = title.trim().length > 0 && content.trim().length > 0;

  const fetchFeedbacks = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getFeedbacks();
      setFeedbackList(data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const pickFromAlbum = async () => {
    setShowUploadSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 2,
    });
    if (!res.canceled) {
      const newImgs = res.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? "image.jpg",
        type: a.mimeType ?? "image/jpeg",
      }));
      setImages((prev) => [...prev, ...newImgs].slice(0, 2));
    }
  };

  const pickFromCamera = async () => {
    setShowUploadSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setImages((prev) =>
        [...prev, { uri: a.uri, name: a.fileName ?? "image.jpg", type: a.mimeType ?? "image/jpeg" }].slice(0, 2)
      );
    }
  };

  const handleDeleteImage = () => {
    if (deleteTargetIndex !== null) {
      setImages((prev) => prev.filter((_, i) => i !== deleteTargetIndex));
    }
    setDeleteTargetIndex(null);
    setShowDeleteDialog(false);
  };

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    try {
      await postFeedback({ title: title.trim(), content: content.trim(), images });
      setTitle("");
      setContent("");
      setImages([]);
      setShowSubmitDialog(false);
      await fetchFeedbacks();
      setActiveTab("history");
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>고객 건의함</Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 36, borderBottomWidth: 1, borderBottomColor: "#AAB4BF", backgroundColor: "#FFFFFF" }}>
        {(["submit", "history"] as const).map((tab) => (
          <AnimatedPressable key={tab} onPress={() => setActiveTab(tab)} style={{ paddingVertical: 12, position: "relative" }} scaleAmount={0.95} opacityAmount={0.8}>
            <Text style={{ fontSize: 16, fontWeight: activeTab === tab ? "700" : "500", letterSpacing: -0.32, color: activeTab === tab ? "#4261FF" : "#AAB4BF" }}>
              {tab === "submit" ? "건의 접수" : "건의 내역"}
            </Text>
            {activeTab === tab && (
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 9999, backgroundColor: "#4261FF" }} />
            )}
          </AnimatedPressable>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {activeTab === "submit" ? (
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, backgroundColor: "#FFFFFF" }}>
            {/* Info box */}
            <View style={{ backgroundColor: "#F7F7F8", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 16, alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22 }}>
                {"핸디에 바라는 내용이나\n서비스 개선 사항이 있다면 작성해주세요."}
              </Text>
            </View>

            {/* Title input */}
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={20}
              placeholder="제목을 입력해주세요 (최대 20자)"
              placeholderTextColor="#AAB4BF"
              style={{
                fontSize: 16, fontWeight: "600", color: "#4261FF",
                borderBottomWidth: 2, borderBottomColor: "#4261FF",
                paddingBottom: 12, marginBottom: 0,
              }}
            />

            {/* Content input */}
            <TextInput
              value={content}
              onChangeText={setContent}
              maxLength={500}
              placeholder="내용을 입력해주세요. (최대 500자)"
              placeholderTextColor="#AAB4BF"
              multiline
              style={{
                fontSize: 14, color: "#19191B",
                paddingTop: 16, paddingBottom: 12,
                minHeight: 120, textAlignVertical: "top",
              }}
            />

            {/* Image strip */}
            <ScrollView showsVerticalScrollIndicator={false} horizontal contentContainerStyle={{ gap: 12, marginTop: 16 }}>
              <AnimatedPressable
                onPress={() => images.length < 2 && setShowUploadSheet(true)}
                disabled={images.length >= 2}
                scaleAmount={0.94}
                opacityAmount={0.8}
                style={{
                  width: 100, height: 100, borderRadius: 16,
                  backgroundColor: images.length >= 2 ? "#D9D9D9" : "rgba(66,97,255,0.1)",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <Camera size={32} color={images.length >= 2 ? "#B0B0B0" : "#4261FF"} strokeWidth={1.5} />
                <Text style={{ fontSize: 12, fontWeight: "500", color: images.length >= 2 ? "#B0B0B0" : "#70737B", marginTop: 6 }}>
                  {images.length} / 2
                </Text>
              </AnimatedPressable>

              {images.map((img, idx) => (
                <View key={idx} style={{ position: "relative", width: 100, height: 100, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                  <Image source={{ uri: img.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  <AnimatedPressable
                    onPress={() => { setDeleteTargetIndex(idx); setShowDeleteDialog(true); }}
                    scaleAmount={0.88}
                    opacityAmount={0.7}
                    style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={16} color="#FFFFFF" />
                  </AnimatedPressable>
                </View>
              ))}
            </ScrollView>

            <Text style={{ fontSize: 12, color: "#70737B", marginTop: 16, lineHeight: 18 }}>
              {"* 건의 내용을 작성해주시면 고객센터에서 확인 후\n답변해드립니다."}
            </Text>
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, backgroundColor: "#FFFFFF" }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: "#F7F7F8", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>총 {feedbackList.length}건</Text>
            </View>

            {loading ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
                <DotsLoader />
              </View>
            ) : error ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <ErrorState onRetry={fetchFeedbacks} compact />
              </View>
            ) : (
            <View style={{ gap: 12 }}>
              {feedbackList.map((item) => (
                <AnimatedPressable
                  key={item.id}
                  onPress={() => navigation.navigate("FeedbackDetail", { id: item.id })}
                  scaleAmount={0.98}
                  opacityAmount={0.85}
                  style={{
                    backgroundColor: "#F7F7F8", borderRadius: 12,
                    paddingHorizontal: 20, paddingVertical: 16,
                    flexDirection: "row", alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <View style={{
                        paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999,
                        backgroundColor: item.status === "answered" ? "#DCFCE7" : "rgba(66,97,255,0.1)",
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: item.status === "answered" ? "#16A34A" : "#4261FF" }}>
                          {item.status === "answered" ? "완료" : "접수"}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: "#70737B" }}>{formatDate(item.created_at)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <ChevronRight size={20} color="#70737B" />
                </AnimatedPressable>
              ))}

              {feedbackList.length === 0 && (
                <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                  <EmptyState message="건의 내역이 없어요" compact />
                </View>
              )}
            </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {activeTab === "submit" && (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 24 : 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
          <AnimatedPressable
            disabled={!isFormValid}
            onPress={() => setShowSubmitDialog(true)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ height: 56, borderRadius: 16, backgroundColor: isFormValid ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>건의하기</Text>
          </AnimatedPressable>
        </View>
      )}

      {/* FAB: 건의 내역 탭에서 글쓰기 버튼 */}
      {activeTab === "history" && (
        <AnimatedPressable
          onPress={() => navigation.navigate("FeedbackWrite")}
          scaleAmount={0.92}
          opacityAmount={0.75}
          style={{
            position: "absolute",
            bottom: 32,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#4261FF",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#4261FF",
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Text style={{ fontSize: 28, color: "#FFFFFF", lineHeight: 32, fontWeight: "300" }}>+</Text>
        </AnimatedPressable>
      )}

      {/* Upload Source Sheet */}
      <ImagePickerSheet
        isOpen={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        onAlbum={pickFromAlbum}
        onCamera={pickFromCamera}
      />

      <ConfirmDialog
        visible={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="사진 삭제"
        description={"업로드하신 사진을 삭제하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소", onPress: () => setShowDeleteDialog(false), variant: "cancel" },
          { label: "삭제하기", onPress: handleDeleteImage, variant: "danger" },
        ]}
      />

      <ConfirmDialog
        visible={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)}
        title="건의하기"
        description={"건의를 등록하시겠어요?\n등록 시 수정이 불가해요"}
        buttons={[
          { label: "취소", onPress: () => setShowSubmitDialog(false), variant: "cancel" },
          { label: submitting ? "제출 중..." : "건의하기", onPress: handleSubmit },
        ]}
      />
    </SafeAreaView>
  );
};

export default FeedbackScreen;
