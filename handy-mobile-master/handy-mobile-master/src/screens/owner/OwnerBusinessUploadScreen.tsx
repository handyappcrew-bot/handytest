import React, { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { Info } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import AnimatedPressable from "@/components/AnimatedPressable";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import { CommonActions } from "@react-navigation/native";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import type { ScreenProps } from "@/navigation/types";

type Screen = "empty" | "preview" | "submitted";

const OwnerBusinessUploadScreen: React.FC<ScreenProps<"OwnerBusinessUpload">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const params = route.params;
  const [screen, setScreen] = useState<Screen>("empty");
  const [image, setImage] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);

  const pickFromAlbum = async () => {
    setShowSourceSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErrorMsg("앨범 접근 권한이 필요해요"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if ((a.fileSize ?? 0) > 5 * 1024 * 1024) { setErrorMsg("이미지 크기는 5MB 이내여야 해요"); return; }
      setImage({ uri: a.uri, name: a.fileName ?? "business.jpg", mimeType: a.mimeType ?? "image/jpeg" });
      setErrorMsg("");
      setScreen("preview");
    }
  };

  const pickFromCamera = async () => {
    setShowSourceSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setErrorMsg("카메라 권한이 필요해요"); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setImage({ uri: a.uri, name: a.fileName ?? "business.jpg", mimeType: a.mimeType ?? "image/jpeg" });
      setErrorMsg("");
      setScreen("preview");
    }
  };

  const handleReupload = () => {
    setScreen("empty");
    setImage(null);
  };

  const handleSubmit = async () => {
    if (!image || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("raw_digits", params.rawDigits);
      fd.append("store_name", params.storeName);
      fd.append("address", params.address);
      if (params.addressDetail) fd.append("address_detail", params.addressDetail);
      fd.append("business_type", params.businessType);
      fd.append("owner_name", params.ownerName);
      fd.append("owner_phone", params.ownerPhone);
      fd.append("image", { uri: image.uri, name: image.name, type: image.mimeType } as unknown as Blob);
      await api.postForm("/api/owner/stores", fd);
      setScreen("submitted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "등록 중 오류가 발생했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (screen === "submitted") {
    return (
      <PageLayout
        hideBackButton
        title={"업로드한 사업자 등록증을\n핸디가 확인하고 있어요"}
        footer={
          <PrimaryButton
            label="확인했어요"
            onPress={() =>
              navigation.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: "MemberType" }] })
              )
            }
          />
        }
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, alignItems: "center", justifyContent: "center" }}>
          {/* 서류 플레이스홀더 */}
          <View style={{ width: 200, height: 260, backgroundColor: "#F4F5F8", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
            <View style={{ width: 120, height: 8, backgroundColor: "#DBDCDF", borderRadius: 4, marginBottom: 12 }} />
            <View style={{ width: 140, height: 8, backgroundColor: "#DBDCDF", borderRadius: 4, marginBottom: 12 }} />
            <View style={{ width: 100, height: 8, backgroundColor: "#DBDCDF", borderRadius: 4, marginBottom: 24 }} />
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#DBDCDF" }} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Info size={16} color="#7488FE" />
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#7488FE" }}>관리자 승인이 필요해요</Text>
          </View>
          <Text style={{ fontSize: 14, color: "#7488FE", textAlign: "center" }}>승인까지 최대 1~2일 걸릴 수 있어요</Text>
          <Text style={{ fontSize: 14, color: "#7488FE", textAlign: "center" }}>완료되는 즉시 알림으로 알려드릴게요</Text>
        </View>
      </PageLayout>
    );
  }

  if (screen === "preview" && image) {
    return (
      <>
        <PageLayout
          headerTitle="사업자 등록증 업로드"
          footer={
            <View style={{ gap: 12 }}>
              <AnimatedPressable
                onPress={handleReupload}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ width: "100%", height: 56, borderRadius: 16, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF" }}>다시 업로드하기</Text>
              </AnimatedPressable>
              <PrimaryButton label="등록하기" onPress={handleSubmit} loading={submitting} />
            </View>
          }
        >
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", letterSpacing: -0.44, lineHeight: 30, marginBottom: 24, alignSelf: "flex-start" }}>
              {"업로드한 사업자 등록증을\n확인 해주세요"}
            </Text>
            <View style={{ width: "100%", maxWidth: 320, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#EBEBEB", backgroundColor: "#F4F5F8", marginBottom: 24 }}>
              <Image source={{ uri: image.uri }} style={{ width: "100%", aspectRatio: 3 / 4 }} resizeMode="contain" />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Info size={16} color="#9EA3AD" />
              <Text style={{ fontSize: 13, color: "#9EA3AD" }}>5MB 이내 JPG, JPEG, PNG</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#9EA3AD", textAlign: "center" }}>이미지 파일만 업로드 할 수 있어요</Text>
          </ScrollView>
        </PageLayout>
      </>
    );
  }

  // empty screen
  return (
    <>
      <PageLayout
        headerTitle="사업자 등록증 업로드"
        footer={
          <PrimaryButton
            label="사업자 등록증 업로드하기"
            onPress={() => setShowSourceSheet(true)}
          />
        }
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", letterSpacing: -0.44, lineHeight: 30, marginBottom: 16 }}>
            {"매장 등록을 위해\n사업자 등록증을 업로드 해주세요"}
          </Text>
          {/* 플레이스홀더 문서 */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 200, height: 260, backgroundColor: "#F4F5F8", borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 120, height: 8, backgroundColor: "#DBDCDF", borderRadius: 4, marginBottom: 12 }} />
              <View style={{ width: 140, height: 8, backgroundColor: "#DBDCDF", borderRadius: 4, marginBottom: 12 }} />
              <View style={{ width: 100, height: 8, backgroundColor: "#DBDCDF", borderRadius: 4, marginBottom: 24 }} />
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "#DBDCDF" }} />
            </View>
          </View>

          {/* 힌트 */}
          <View style={{ alignItems: "center", marginTop: 32, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Info size={16} color="#9EA3AD" />
              <Text style={{ fontSize: 13, color: "#9EA3AD" }}>5MB 이내 JPG, JPEG, PNG</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#9EA3AD", textAlign: "center" }}>이미지 파일만 업로드 할 수 있어요</Text>
          </View>

          {errorMsg ? (
            <Text style={{ fontSize: 13, color: "#FF3D3D", textAlign: "center", marginBottom: 8 }}>{errorMsg}</Text>
          ) : null}
        </View>
      </PageLayout>

      <ImagePickerSheet
        isOpen={showSourceSheet}
        onClose={() => setShowSourceSheet(false)}
        title="사업자 등록증 업로드하기"
        onAlbum={pickFromAlbum}
        onCamera={pickFromCamera}
      />
    </>
  );
};

export default OwnerBusinessUploadScreen;
