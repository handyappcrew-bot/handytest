import React, { useEffect, useState } from "react";
import {
  View, Text, Pressable, ScrollView,
  Image, KeyboardAvoidingView, Platform, Keyboard,
} from "react-native";
import FocusInput from "@/components/FocusInput";
import AnimatedPressable from "@/components/AnimatedPressable";
import { ChevronLeft, ChevronDown, X, Camera, Check } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import BottomSheet from "@/components/BottomSheet";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { addBoardPost, modifyBoardPost } from "@/api/public";
import { API_BASE_URL } from "@/api/client";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const BASE_CATEGORIES = ["건의사항", "비품관리", "대타요청", "일반 게시글"];
const OWNER_CATEGORIES = ["공지사항", ...BASE_CATEGORIES];

const BoardWriteScreen: React.FC<ScreenProps<"BoardWrite">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const editPost = route.params?.editPost;
  const isEdit = !!editPost;

  const role = localStorage.getItem("currentRole") ?? "employee";
  const categories = role === "owner" ? OWNER_CATEGORIES : BASE_CATEGORIES;

  const [category, setCategory] = useState(editPost?.category ?? "");
  const [title, setTitle] = useState(editPost?.title ?? "");
  const [content, setContent] = useState(editPost?.content ?? "");
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(editPost?.photos ?? []);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exitDialog, setExitDialog] = useState(false);
  const [deletePhotoIdx, setDeletePhotoIdx] = useState(-1);
  const [deletePhotoDialog, setDeletePhotoDialog] = useState(false);
  const [registerDialog, setRegisterDialog] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const canSubmit = !!category && title.trim().length > 0 && content.trim().length > 0;
  const maxPhotos = 5;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const totalPhotos = existingPhotos.length + images.length;

  const pickFromAlbum = async () => {
    setShowSourceSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: maxPhotos,
    });
    if (!res.canceled) {
      const next = res.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? "image.jpg",
        type: a.mimeType ?? "image/jpeg",
      }));
      setImages((prev) => [...prev, ...next].slice(0, maxPhotos - existingPhotos.length));
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
        [...prev, { uri: a.uri, name: a.fileName ?? "image.jpg", type: a.mimeType ?? "image/jpeg" }]
          .slice(0, maxPhotos - existingPhotos.length)
      );
    }
  };

  const handleDeletePhoto = () => {
    if (deletePhotoIdx < 0) return;
    const existLen = existingPhotos.length;
    if (deletePhotoIdx < existLen) {
      setExistingPhotos((prev) => prev.filter((_, i) => i !== deletePhotoIdx));
    } else {
      setImages((prev) => prev.filter((_, i) => i !== deletePhotoIdx - existLen));
    }
    setDeletePhotoDialog(false);
    setDeletePhotoIdx(-1);
  };

  const handleSubmit = async () => {
    setRegisterDialog(false);
    if (!canSubmit || !storeId || submitting) return;
    setSubmitting(true);
    try {
      if (isEdit && editPost) {
        await modifyBoardPost({ board_id: editPost.id, category, title, content, existing_images: existingPhotos, images });
        toast({ description: "게시글이 수정되었어요" });
      } else {
        await addBoardPost({ store_id: storeId, category, title, content, images });
        toast({ description: "게시글이 등록되었어요" });
      }
      navigation.goBack();
    } catch (err) {
      toast({
        description: err instanceof Error ? err.message : isEdit ? "수정에 실패했어요." : "등록에 실패했어요.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>

      {/* 헤더 */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8,
        borderBottomWidth: 1, borderBottomColor: "#EBEBEB",
        backgroundColor: "#FFFFFF",
      }}>
        <Pressable
          onPress={() => {
            const dirty = title.trim() || content.trim() || images.length > 0
              || existingPhotos.length !== (editPost?.photos?.length ?? 0);
            if (dirty) setExitDialog(true);
            else navigation.goBack();
          }}
          style={{ padding: 4 }}
          hitSlop={8}
        >
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B", flex: 1, marginLeft: 8 }}>
          {isEdit ? "게시글 수정" : "게시글 작성"}
        </Text>
        {keyboardVisible && (
          <Pressable onPress={() => Keyboard.dismiss()} style={{ padding: 4, paddingRight: 8 }} hitSlop={8}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#4261FF" }}>완료</Text>
          </Pressable>
        )}
      </View>

      {/* 스크롤 폼 */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}
          style={{ flex: 1 }}
        >
          {/* 카테고리 — 정적 스타일 */}
          <AnimatedPressable
            scaleAmount={0.97}
            opacityAmount={0.8}
            onPress={() => setShowCategorySheet(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#EBEBEB",
              paddingHorizontal: 16,
              marginBottom: 16,
              backgroundColor: "#FFFFFF",
            }}
          >
            <Text style={{ fontSize: 15, letterSpacing: -0.3, color: category ? "#19191B" : "#AAB4BF" }}>
              {category || "카테고리 선택하기"}
            </Text>
            <ChevronDown size={20} color="#9EA3AD" />
          </AnimatedPressable>

          {/* 제목 */}
          <FocusInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력 해주세요 (최대 20자)"
            placeholderTextColor="#AAB4BF"
            maxLength={20}
            style={{
              fontSize: 16,
              fontWeight: "700",
              letterSpacing: -0.32,
              color: "#19191B",
              paddingBottom: 12,
              marginBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#EBEBEB",
              backgroundColor: "transparent",
            }}
          />

          {/* 내용 */}
          <FocusInput
            value={content}
            onChangeText={setContent}
            placeholder="내용을 입력하세요. (최대 1000자)"
            placeholderTextColor="#AAB4BF"
            maxLength={1000}
            multiline
            style={{
              minHeight: 200,
              fontSize: 14,
              letterSpacing: -0.28,
              color: "#19191B",
              textAlignVertical: "top",
              backgroundColor: "transparent",
            }}
          />
        </ScrollView>

        {/* 하단 고정 */}
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 0,
          paddingBottom: Platform.OS === "ios" ? 24 : 16,
          backgroundColor: "#FFFFFF",
        }}>
        {/* 사진 가로 스크롤 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        >
          {/* 업로드 버튼 */}
          <AnimatedPressable
            onPress={() => { if (totalPhotos < maxPhotos) setShowSourceSheet(true); }}
            disabled={totalPhotos >= maxPhotos}
            scaleAmount={0.97}
            opacityAmount={0.8}
            style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              flexShrink: 0,
              borderWidth: 1,
              borderColor: "#EBEBEB",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              opacity: totalPhotos >= maxPhotos ? 0.4 : 1,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: "#4261FF",
              alignItems: "center", justifyContent: "center",
            }}>
              <Camera size={20} color="#FFFFFF" />
            </View>
            <Text style={{ fontSize: 13, color: "#AAB4BF" }}>{totalPhotos} / {maxPhotos}</Text>
          </AnimatedPressable>

          {/* 기존 사진 */}
          {existingPhotos.map((url, i) => (
            <View key={`e-${i}`} style={{ position: "relative", width: 120, height: 120, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
              <Image
                source={{ uri: url.startsWith("/") ? `${API_BASE_URL}${url}` : url }}
                style={{ width: 120, height: 120 }}
                resizeMode="cover"
              />
              <AnimatedPressable
                onPress={() => { setDeletePhotoIdx(i); setDeletePhotoDialog(true); }}
                scaleAmount={0.88}
                opacityAmount={0.7}
                style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color="#FFFFFF" />
              </AnimatedPressable>
            </View>
          ))}

          {/* 새 사진 */}
          {images.map((img, i) => (
            <View key={`n-${i}`} style={{ position: "relative", width: 120, height: 120, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
              <Image source={{ uri: img.uri }} style={{ width: 120, height: 120 }} resizeMode="cover" />
              <AnimatedPressable
                onPress={() => { setDeletePhotoIdx(existingPhotos.length + i); setDeletePhotoDialog(true); }}
                scaleAmount={0.88}
                opacityAmount={0.7}
                style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color="#FFFFFF" />
              </AnimatedPressable>
            </View>
          ))}
        </ScrollView>

        {/* 등록/수정 버튼 */}
        <AnimatedPressable
          onPress={() => { if (canSubmit) setRegisterDialog(true); }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canSubmit ? "#4261FF" : "#DBDCDF",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
            {isEdit ? "수정하기" : "등록하기"}
          </Text>
        </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      {/* 카테고리 바텀시트 */}
      <BottomSheet isOpen={showCategorySheet} onClose={() => setShowCategorySheet(false)} title="카테고리 선택하기">
        {categories.map((c, idx) => {
          const sel = category === c;
          const isLast = idx === categories.length - 1;
          return (
            <AnimatedPressable
              key={c}
              onPress={() => { setCategory(c); setShowCategorySheet(false); }}
              scaleAmount={0.97}
              opacityAmount={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: "#EBEBEB",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: sel ? "700" : "400", letterSpacing: -0.32, color: sel ? "#4261FF" : "#19191B" }}>
                {c}
              </Text>
              {sel && <Check size={18} color="#4261FF" />}
            </AnimatedPressable>
          );
        })}
      </BottomSheet>

      {/* 사진 소스 선택 */}
      <ImagePickerSheet
        isOpen={showSourceSheet}
        onClose={() => setShowSourceSheet(false)}
        onAlbum={pickFromAlbum}
        onCamera={pickFromCamera}
      />

      {/* 확인 모달 */}
      <ConfirmDialog
        visible={deletePhotoDialog}
        onClose={() => { setDeletePhotoDialog(false); setDeletePhotoIdx(-1); }}
        title="사진 삭제"
        description={"업로드하신 사진을 삭제하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소", onPress: () => { setDeletePhotoDialog(false); setDeletePhotoIdx(-1); }, variant: "cancel" },
          { label: "삭제하기", onPress: handleDeletePhoto, variant: "danger" },
        ]}
      />
      <ConfirmDialog
        visible={exitDialog}
        onClose={() => setExitDialog(false)}
        title="게시글 삭제"
        description={"작성 중인 게시글을 삭제하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소", onPress: () => setExitDialog(false), variant: "cancel" },
          { label: "삭제하기", onPress: () => navigation.goBack(), variant: "danger" },
        ]}
      />
      <ConfirmDialog
        visible={registerDialog}
        onClose={() => setRegisterDialog(false)}
        title={isEdit ? "게시글 수정" : "게시글 등록"}
        description={isEdit ? "해당 게시글이 수정돼요.\n계속하시겠어요?" : "해당 게시글이 게시판에 등록돼요.\n계속하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setRegisterDialog(false), variant: "cancel" },
          { label: isEdit ? "수정하기" : "등록하기", onPress: handleSubmit, variant: "confirm" },
        ]}
      />
    </SafeAreaView>
  );
};

export default BoardWriteScreen;
