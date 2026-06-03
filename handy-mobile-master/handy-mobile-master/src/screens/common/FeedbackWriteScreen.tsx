import React, { useState } from "react";
import {
  View, Text, Pressable, ScrollView,
  Image, KeyboardAvoidingView, Platform,
} from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import FocusInput from "@/components/FocusInput";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Camera, X } from "lucide-react-native";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useToast } from "@/components/Toast";
import { postFeedback } from "@/api/public";
import type { ScreenProps } from "@/navigation/types";

const FeedbackWriteScreen: React.FC<ScreenProps<"FeedbackWrite">> = ({ navigation }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isValid = title.trim().length > 0 && content.trim().length > 0;

  const pickFromAlbum = async () => {
    setShowSourceSheet(false);
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
      const newImages = res.assets.map((a) => ({
        uri: a.uri, name: a.fileName ?? "image.jpg", type: a.mimeType ?? "image/jpeg",
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, 2));
    }
  };

  const pickFromCamera = async () => {
    setShowSourceSheet(false);
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
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await postFeedback({ title, content, images });
      toast({ description: "건의가 제출되었어요." });
      navigation.goBack();
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "제출에 실패했어요.", variant: "destructive" });
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, backgroundColor: "#FFFFFF" }}>
          {/* Info box */}
          <View style={{ backgroundColor: "#F4F5F8", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 16, alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22 }}>
              {"핸디에 바라는 내용이나\n서비스 개선 사항이 있다면 작성해주세요."}
            </Text>
          </View>

          {/* Title input */}
          <FocusInput
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
          <FocusInput
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

          {/* Camera button + images */}
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 16 }}>
            <AnimatedPressable
              onPress={() => images.length < 2 && setShowSourceSheet(true)}
              disabled={images.length >= 2}
              scaleAmount={0.97}
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
      </KeyboardAvoidingView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 24 : 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
        <AnimatedPressable
          onPress={() => { if (isValid) setShowSubmitDialog(true); }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, backgroundColor: isValid ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>건의하기</Text>
        </AnimatedPressable>
      </View>

      {/* Upload Source Sheet */}
      <ImagePickerSheet
        isOpen={showSourceSheet}
        onClose={() => setShowSourceSheet(false)}
        onAlbum={pickFromAlbum}
        onCamera={pickFromCamera}
      />

      {/* Delete Confirm Dialog */}
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

      {/* Submit Confirm Dialog */}
      <ConfirmDialog
        visible={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)}
        title="건의하기"
        description={"건의를 등록하시겠어요?\n등록 시 수정이 불가해요"}
        buttons={[
          { label: "취소", onPress: () => setShowSubmitDialog(false), variant: "cancel" },
          { label: "건의하기", onPress: handleSubmit, variant: "confirm" },
        ]}
      />
    </SafeAreaView>
  );
};

export default FeedbackWriteScreen;
