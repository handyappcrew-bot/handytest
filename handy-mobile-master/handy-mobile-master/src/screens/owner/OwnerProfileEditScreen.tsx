import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from "react-native";

const OWNER_ICON = require("../../../assets/images/icon/owner-icon.png");
import AnimatedPressable from "@/components/AnimatedPressable";
import { ChevronLeft, X, ChevronRight } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import BottomSheet from "@/components/BottomSheet";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import Avatar from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { getOwnerInfo, getOwnerStores, updateOwnerNickname, deleteOwnerProfileImage, uploadOwnerProfileImage } from "@/api/owner";
import { getMe } from "@/api/auth";
import { formatPhone } from "@/utils/valid";
import { localStorage } from "@/utils/storage";
import { getPhotoUrl } from "@/utils/image";
import type { ScreenProps } from "@/navigation/types";

const Divider = () => (
  <View style={{ width: "100%", height: 12, backgroundColor: "#F7F7F8" }} />
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>{label}</Text>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", flex: 1 }}>{value}</Text>
  </View>
);

const StoreInfoRow = ({ label, value, isLink, onPress }: { label: string; value: string; isLink?: boolean; onPress?: () => void }) => (
  <AnimatedPressable onPress={isLink ? onPress : undefined} scaleAmount={0.97} opacityAmount={0.8} style={{ flexDirection: "row", gap: 16 }}>
    <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", width: 72, flexShrink: 0 }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: "500", color: isLink ? "#4261FF" : "#19191B", textDecorationLine: isLink ? "underline" : "none", flex: 1 }}>
      {value}
    </Text>
  </AnimatedPressable>
);


const OwnerProfileEditScreen: React.FC<ScreenProps<"OwnerProfileEdit">> = ({ navigation }) => {
  const { toast } = useToast();

  const memberId = Number(localStorage.getItem("currentMemberId") ?? 0);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const socialProvider = localStorage.getItem("socialProvider");

  const [info, setInfo] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newPhoto, setNewPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);

  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showNameSheet, setShowNameSheet] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      let realMemberId = memberId;
      try {
        const me = await getMe();
        if (me?.id) realMemberId = me.id;
      } catch {}
      if (!realMemberId) return;
      getOwnerInfo(realMemberId, storeId)
        .then((res: any) => {
          setInfo(res);
          setName(res?.nickname ?? res?.name ?? "");
          setPhotoUri(getPhotoUrl(res?.image));
        })
        .catch((e) => { console.warn(e); toast({ description: "사용자 정보를 불러오지 못했어요.", variant: "destructive" }); });
      getOwnerStores(realMemberId)
        .then((rs: any) => setStores(rs ?? []))
        .catch((e) => console.warn(e));
    })();
  }, [memberId, storeId]);

  const joinDate = info?.created_at ?? stores[0]?.created_at ?? null;
  const joinDays = joinDate
    ? Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const primaryStoreName = stores[0]?.name ?? null;

  const handleNameSave = async () => {
    if (!nameInput.trim()) return;
    try {
      await updateOwnerNickname(storeId, memberId, nameInput.trim());
      setName(nameInput.trim());
      setShowNameSheet(false);
      toast({ description: "이름이 변경되었어요" });
    } catch {
      toast({ description: "이름 변경에 실패했어요.", variant: "destructive" });
    }
  };

  const handlePickPhoto = async () => {
    setShowPhotoSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPhotoUri(a.uri);
      setNewPhoto({ uri: a.uri, name: a.fileName ?? "profile.jpg", type: a.mimeType ?? "image/jpeg" });
    }
  };

  const handleResetPhoto = async () => {
    setShowPhotoSheet(false);
    try {
      await deleteOwnerProfileImage(storeId, memberId);
      setPhotoUri(null);
      setNewPhoto(null);
      toast({ description: "기본 프로필로 변경되었어요" });
    } catch {
      toast({ description: "프로필 사진 삭제에 실패했어요.", variant: "destructive" });
    }
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setStringAsync(code);
    toast({ description: "매장코드가 복사되었어요" });
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (newPhoto) {
        await uploadOwnerProfileImage(storeId, memberId, newPhoto);
      }
      toast({ description: "내 정보가 수정되었어요." });
      navigation.goBack();
    } catch (err: any) {
      const msg = err?.detail || err?.message || "프로필 사진 저장에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>내 정보 수정</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

          {/* Profile Card */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 24 }}>
            <AnimatedPressable onPress={() => setShowPhotoSheet(true)} scaleAmount={0.95} opacityAmount={0.8} style={{ position: "relative", flexShrink: 0 }}>
              <Avatar imageUrl={photoUri} name={name} size={80} defaultSource={OWNER_ICON} />
              <View style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", lineHeight: 18 }}>+</Text>
              </View>
            </AnimatedPressable>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B" }}>{name || "-"}</Text>
                <Text style={{ fontSize: 16, color: "#70737B" }}>사장님</Text>
              </View>
              {(primaryStoreName !== null || joinDays !== null) && (
                <View style={{ marginTop: 4, alignSelf: "flex-start", height: 28, paddingHorizontal: 10, borderRadius: 4, backgroundColor: "rgba(66,97,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#4261FF", letterSpacing: -0.28 }}>
                    {primaryStoreName ? `${primaryStoreName} 가입` : "가입"}
                    {joinDays !== null ? ` +${joinDays}일` : ""}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Divider />

          {/* 인적 사항 */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>인적 사항</Text>
            <View style={{ gap: 12 }}>
              {/* 이름 — editable */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0 }}>이름</Text>
                <AnimatedPressable
                  onPress={() => { setNameInput(name); setShowNameSheet(true); }}
                  scaleAmount={0.98}
                  opacityAmount={0.85}
                  style={{ flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: "#EBEBEB", paddingHorizontal: 12, justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{name || "이름 없음"}</Text>
                </AnimatedPressable>
              </View>

              <InfoRow label="생년월일" value={info?.birth ?? "-"} />
              <InfoRow label="성별" value={info?.gender === "M" || info?.gender === "남자" ? "남자" : info?.gender === "F" || info?.gender === "여자" ? "여자" : info?.gender ?? "-"} />
              <InfoRow label="전화번호" value={info?.phone ? formatPhone(info.phone) : "-"} />

              {/* 비밀번호 변경 — SNS 회원 제외 */}
              {!socialProvider && (
                <AnimatedPressable
                  onPress={() => navigation.navigate("PasswordChange")}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>비밀번호 변경</Text>
                  <ChevronRight size={20} color="#70737B" />
                </AnimatedPressable>
              )}

              {/* 회원 탈퇴 */}
              <AnimatedPressable
                onPress={() => navigation.navigate("Withdrawal")}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#FF3D3D" }}>회원 탈퇴</Text>
                <ChevronRight size={20} color="#FF3D3D" />
              </AnimatedPressable>
            </View>
          </View>

          <Divider />

          {/* 매장 정보 */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>매장 정보</Text>
            <View style={{ gap: 16 }}>
              {stores.length === 0 ? (
                <Text style={{ fontSize: 14, color: "#9EA3AD", textAlign: "center", paddingVertical: 20 }}>
                  등록된 매장이 없어요
                </Text>
              ) : (
                stores.map((s: any) => (
                  <View
                    key={s.id}
                    style={{ borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 16, padding: 20, backgroundColor: "#FFFFFF" }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>{s.name}</Text>
                      <AnimatedPressable
                        onPress={() => navigation.navigate("OwnerStoreDelete", { storeId: s.id })}
                        scaleAmount={0.88}
                        opacityAmount={0.7}
                        style={{ padding: 6, backgroundColor: "#F7F7F8", borderRadius: 999 }}
                        hitSlop={4}
                      >
                        <X size={14} color="#70737B" />
                      </AnimatedPressable>
                    </View>
                    <View style={{ gap: 10 }}>
                      <StoreInfoRow label="매장 코드" value={String(s.code ?? "-")} isLink onPress={() => handleCopyCode(s.code ?? "")} />
                      <StoreInfoRow label="업종" value={s.industry ?? "-"} />
                      <StoreInfoRow label="주소" value={`${s.address ?? ""} ${s.address_detail ?? ""}`.trim() || "-"} />
                      <StoreInfoRow label="대표자명" value={s.owner_name ?? "-"} />
                      <StoreInfoRow label="대표 번호" value={s.phone ? formatPhone(s.phone) : "-"} />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Save Button */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 24 : 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
        <AnimatedPressable
          onPress={handleSave}
          disabled={saving}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, backgroundColor: saving ? "#DBDCDF" : "#4261FF", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
            {saving ? "저장 중..." : "수정 완료"}
          </Text>
        </AnimatedPressable>
      </View>

      {/* Photo Sheet */}
      <ImagePickerSheet
        isOpen={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        onAlbum={handlePickPhoto}
        onReset={handleResetPhoto}
      />

      {/* Name Sheet */}
      <BottomSheet isOpen={showNameSheet} onClose={() => setShowNameSheet(false)} title="이름 입력하기">
        <TextInput
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="이름 입력"
          placeholderTextColor="#AAB4BF"
          style={{ height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#EBEBEB", paddingHorizontal: 16, fontSize: 16, color: "#19191B" } as any}
        />
        <Text style={{ marginTop: 8, fontSize: 13, color: "#4261FF", lineHeight: 20 }}>
          * 닉네임을 사용할 경우 '닉네임(이름)' 형식으로 작성해주세요
        </Text>
        <Text style={{ fontSize: 13, color: "#19191B" }}>예) 핸디(홍길동)</Text>
        <AnimatedPressable
          onPress={handleNameSave}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ marginTop: 24, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: nameInput.trim() ? "#4261FF" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
        </AnimatedPressable>
      </BottomSheet>
    </SafeAreaView>
  );
};

export default OwnerProfileEditScreen;
