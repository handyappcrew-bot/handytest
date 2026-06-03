import React, { useState } from "react";
import { View, Text, Pressable, Image, BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AlertCircle } from "lucide-react-native";

const EMPTY_PROFILE = require("../../../assets/images/icon/empty-profile.png");
const CAMERA_UPLOAD = require("../../../assets/images/icon/camera-upload.png");
import * as ImagePicker from "expo-image-picker";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import { signup } from "@/api/auth";
import { clearProfileInfoDraft } from "@/utils/signupDraft";
import type { ScreenProps } from "@/navigation/types";

const ProfilePhotoScreen: React.FC<ScreenProps<"ProfilePhoto">> = ({ route, navigation }) => {
  const { phone, password, name, birthdate, gender, type, socialToken, agreedTerms } = route.params;

  const [photo, setPhoto] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        setShowCancelDialog(true);
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const handleBack = () => setShowCancelDialog(true);

  const pickFromAlbum = async () => {
    setShowSourceSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("앨범 접근 권한이 필요해요");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPhoto({ uri: a.uri, name: a.fileName ?? "profile.jpg", mimeType: a.mimeType ?? "image/jpeg" });
      setErrorMsg("");
    }
  };

  const pickFromCamera = async () => {
    setShowSourceSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("카메라 권한이 필요해요");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPhoto({ uri: a.uri, name: a.fileName ?? "profile.jpg", mimeType: a.mimeType ?? "image/jpeg" });
      setErrorMsg("");
    }
  };

  const submitSignup = async (includePhoto: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      // birthdate "YYYY.MM.DD" → "YYYY-MM-DD"
      const birthIso = birthdate.replace(/\./g, "-");
      await signup({
        phone, name, birth: birthIso,
        gender: gender as "남자" | "여자",
        password: type === "social" ? undefined : password,
        type,
        social_token: socialToken,
        agreed_terms: agreedTerms,
        image: includePhoto && photo
          ? { uri: photo.uri, name: photo.name, type: photo.mimeType }
          : undefined,
      });
      clearProfileInfoDraft();
      // Navigate without resetting submitting — component unmounts on replace
      navigation.reset({ index: 0, routes: [{ name: "SignupComplete", params: { name } }] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "회원가입 중 오류가 발생했어요.";
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageLayout
        headerTitle="회원가입"
        onBack={handleBack}
        title={"프로필 사진을\n업로드 해주세요"}
        subtitle="나중에 업로드하거나 수정할 수 있어요"
        footer={
          <View style={{ gap: 12 }}>
            {!photo && (
              <PrimaryButton
                label="회원가입 후 다음에 등록하기"
                onPress={() => submitSignup(false)}
                loading={submitting}
              />
            )}
            <PrimaryButton
              label="회원가입 완료하기"
              onPress={() => submitSignup(true)}
              disabled={!photo}
              loading={submitting}
            />
          </View>
        }
      >
        <View style={{ alignItems: "center", marginTop: 32, paddingHorizontal: 20 }}>
          {/* Avatar */}
          <View style={{ position: "relative" }}>
            <View style={{
              width: 192,
              height: 192,
              borderRadius: 96,
              overflow: "hidden",
              backgroundColor: "transparent",
            }}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Image source={EMPTY_PROFILE} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              )}
            </View>
            {/* Camera button overlay */}
            <Pressable
              onPress={() => setShowSourceSheet(true)}
              style={{
                position: "absolute",
                bottom: 8,
                right: 8,
                width: 48,
                height: 48,
              }}
              hitSlop={4}
            >
              <Image source={CAMERA_UPLOAD} style={{ width: 48, height: 48 }} resizeMode="contain" />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24 }}>
            <AlertCircle size={16} color="#9EA3AD" />
            <Text style={{ fontSize: 13, color: "#9EA3AD" }}>5MB 이내 JPG, JPEG, PNG</Text>
          </View>
          <Text style={{ fontSize: 13, color: "#9EA3AD", marginTop: 2 }}>이미지 파일만 업로드 할 수 있어요</Text>

          {errorMsg ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 }}>
              <AlertCircle size={16} color="#FF3D3D" />
              <Text style={{ fontSize: 13, color: "#FF3D3D" }}>{errorMsg}</Text>
            </View>
          ) : null}
        </View>
      </PageLayout>

      <ImagePickerSheet
        isOpen={showSourceSheet}
        onClose={() => setShowSourceSheet(false)}
        onAlbum={pickFromAlbum}
        onCamera={pickFromCamera}
      />

      <ConfirmDialog
        visible={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        title="회원가입을 취소할까요?"
        description="지금까지 입력한 정보가 모두 지워져요."
        buttons={[
          { label: "계속하기", variant: "cancel", onPress: () => setShowCancelDialog(false) },
          { label: "나가기", variant: "danger", onPress: () => { setShowCancelDialog(false); navigation.goBack(); } },
        ]}
      />
    </>
  );
};

export default ProfilePhotoScreen;
