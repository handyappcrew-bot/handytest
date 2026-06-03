import React, { useCallback, useRef, useState } from "react";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { ChevronLeft, Pencil } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/Avatar";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import { useToast } from "@/components/Toast";
import { getOwnerInfo, getOwnerStores } from "@/api/owner";
import { logout, getMe } from "@/api/auth";
import { localStorage } from "@/utils/storage";
import { formatPhone } from "@/utils/valid";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FadeScreen from "@/components/FadeScreen";
import AdMobNative from "@/components/AdMobNative";
import type { ScreenProps } from "@/navigation/types";

const OWNER_ICON = require("../../../assets/images/icon/owner-icon.png");
const SNS_ICONS: Record<string, any> = {
  kakao: require("../../../assets/images/login/kakao.png"),
  google: require("../../../assets/images/login/google.png"),
  apple: require("../../../assets/images/login/apple.png"),
};

const Divider = () => <View style={{ width: "100%", height: 12, backgroundColor: "#F7F7F8" }} />;

const OwnerProfileScreen: React.FC<ScreenProps<"OwnerProfile">> = ({ navigation }) => {
  const { toast } = useToast();
  const [info, setInfo] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storeOrder, setStoreOrder] = useState<number[]>([]);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<number | null>(null);
  const [switchDialog, setSwitchDialog] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const memberId = Number(localStorage.getItem("currentMemberId") ?? 0);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  useFocusEffect(
    useCallback(() => {
      if (!storeId) {
        setLoading(false);
        toast({ description: "로그인 정보를 찾을 수 없어요. 다시 로그인해주세요", variant: "destructive" });
        return;
      }
      setLoading(true);
      const run = async () => {
        let realMemberId = memberId;
        try {
          const me = await getMe();
          if (me?.id) realMemberId = me.id;
        } catch {}
        let done = 0;
        const finish = () => { done++; if (done >= 2) setLoading(false); };
        getOwnerInfo(realMemberId, storeId)
          .then(setInfo)
          .catch((err: any) => {
            const msg = err instanceof Error ? err.message : null;
            toast({ description: msg ?? "내 정보를 불러올 수 없어요", variant: "destructive" });
          })
          .finally(finish);
        getOwnerStores(realMemberId)
          .then((rs: any) => {
            const list = rs ?? [];
            setStores(list);
            setStoreOrder(list.map((_: any, i: number) => i));
          })
          .catch((err: any) => {
            const msg = err instanceof Error ? err.message : null;
            toast({ description: msg ?? "매장 정보를 불러올 수 없어요", variant: "destructive" });
          })
          .finally(finish);
      };
      run();
    }, [storeId]),
  );

  const displayName = info?.nickname ?? info?.name ?? "-";
  const socialProvider = localStorage.getItem("socialProvider");

  const handleLogout = async () => {
    setLogoutDialog(false);
    localStorage.removeItem("socialProvider");
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const handleEditConfirm = () => {
    setEditDialog(null);
    navigation.navigate("OwnerStoreInfo");
  };

  const handleSwitchConfirm = (storeIdx: number) => {
    setSwitchDialog(null);
    const store = stores[storeIdx];
    if (store?.id) {
      localStorage.setItem("currentStoreId", String(store.id));
    }
    toast({ description: "매장이 전환되었어요" });
    navigation.navigate("OwnerHome");
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setStringAsync(code);
    toast({ description: "매장코드가 복사되었어요" });
  };

  const joinDate = info?.created_at ?? stores[0]?.created_at ?? null;
  const joinDays = joinDate
    ? Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const primaryStoreName = stores[0]?.name ?? null;

  return (
    <FadeScreen>
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>내 정보</Text>
        </View>
        <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#4261FF" />
              <Text style={{ marginTop: 12, fontSize: 14, color: "#AAB4BF" }}>정보를 불러오는 중이에요</Text>
            </View>
          ) : (
          <>
          {/* 프로필 카드 */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}>
            <Avatar imageUrl={info?.image} name={displayName} size={80} defaultSource={OWNER_ICON} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4 }}>
                  {displayName}
                </Text>
                {socialProvider && SNS_ICONS[socialProvider] && (
                  <Image source={SNS_ICONS[socialProvider]} style={{ width: 20, height: 20, borderRadius: 10 }} resizeMode="contain" />
                )}
                <Text style={{ fontSize: 16, color: "#70737B" }}>사장님</Text>
              </View>
              {primaryStoreName || joinDays !== null ? (
                <View style={{ marginTop: 4 }}>
                  <View style={{
                    alignSelf: "flex-start",
                    height: 28, borderRadius: 4,
                    paddingHorizontal: 10,
                    backgroundColor: "rgba(66,97,255,0.1)",
                    justifyContent: "center",
                  }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#4261FF", letterSpacing: -0.28 }}>
                      {primaryStoreName ? `${primaryStoreName} 가입` : "가입"}
                      {joinDays !== null ? ` +${joinDays}일` : ""}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
            <AnimatedPressable
              onPress={() => navigation.navigate("OwnerProfileEdit")}
              hitSlop={8}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ padding: 8, alignSelf: "flex-start", marginTop: 4 }}
            >
              <Pencil size={24} color="#70737B" />
            </AnimatedPressable>
          </View>

          <Divider />

          {/* 인적 사항 */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4, marginBottom: 16 }}>
              인적 사항
            </Text>
            <View style={{ gap: 12 }}>
              <InfoRow label="생년월일" value={info?.birth ?? "-"} />
              <InfoRow label="성별" value={info?.gender === "M" || info?.gender === "남자" ? "남자" : info?.gender === "F" || info?.gender === "여자" ? "여자" : info?.gender ?? "-"} />
              <InfoRow label="전화번호" value={info?.phone ? formatPhone(info.phone) : "-"} />
            </View>
          </View>

          <Divider />

          {/* 광고 배너 */}
          <View style={{ paddingVertical: 20 }}>
            <AdMobNative />
          </View>

          <Divider />

          {/* 매장 정보 */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4, marginBottom: 16 }}>
              매장 정보
            </Text>
            <View style={{ gap: 16 }}>
              {stores.length === 0 ? (
                <Text style={{ fontSize: 14, color: "#AAB4BF", textAlign: "center", paddingVertical: 20 }}>
                  등록된 매장이 없어요
                </Text>
              ) : (
                storeOrder.map((storeIdx, orderPos) => {
                  const s = stores[storeIdx];
                  if (!s) return null;
                  const isFirst = orderPos === 0;
                  return (
                    <View
                      key={s.id}
                      style={{
                        borderWidth: 1,
                        borderColor: "#EBEBEB",
                        borderRadius: 12,
                        padding: 16,
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B" }}>
                          {s.name}
                        </Text>
                        {isFirst ? (
                          <AnimatedPressable
                            onPress={() => setEditDialog(storeIdx)}
                            scaleAmount={0.97}
                            opacityAmount={0.75}
                            style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: "#4261FF" }}
                          >
                            <Text style={{ fontSize: 12, color: "#4261FF", fontWeight: "500" }}>
                              수정하기
                            </Text>
                          </AnimatedPressable>
                        ) : (
                          <AnimatedPressable
                            onPress={() => setSwitchDialog(storeIdx)}
                            scaleAmount={0.97}
                            opacityAmount={0.75}
                            style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: "#DBDCDF" }}
                          >
                            <Text style={{ fontSize: 12, color: "#70737B", fontWeight: "500" }}>
                              매장 전환 ↔
                            </Text>
                          </AnimatedPressable>
                        )}
                      </View>
                      <View style={{ gap: 8 }}>
                        <StoreInfoRow label="매장 코드" value={s.code ?? "-"} isLink onPress={() => handleCopyCode(s.code ?? "")} />
                        <StoreInfoRow label="업종" value={s.industry ?? "-"} />
                        <StoreInfoRow label="주소" value={`${s.address ?? ""} ${s.address_detail ?? ""}`.trim() || "-"} />
                        <StoreInfoRow label="대표자명" value={s.owner_name ?? "-"} />
                        <StoreInfoRow label="대표 번호" value={s.phone ? formatPhone(s.phone) : "-"} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <Divider />

          {/* 푸터 */}
          <View style={{ paddingTop: 28, paddingBottom: 4, alignItems: "center", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <AnimatedPressable onPress={() => navigation.navigate("TermsDetail", { id: "service" })} scaleAmount={0.97} opacityAmount={0.75}>
                <Text style={{ fontSize: 13, color: "#70737B" }}>이용약관</Text>
              </AnimatedPressable>
              <View style={{ width: 1, height: 11, backgroundColor: "#DBDCDF" }} />
              <AnimatedPressable onPress={() => navigation.navigate("TermsDetail", { id: "privacy" })} scaleAmount={0.97} opacityAmount={0.75}>
                <Text style={{ fontSize: 13, color: "#70737B", fontWeight: "600" }}>개인정보처리방침</Text>
              </AnimatedPressable>
            </View>
            <Text style={{ fontSize: 12, color: "#C2C7CD" }}>v{Constants.expoConfig?.version ?? "0.1.0"}</Text>
          </View>

          {/* 로그아웃 */}
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <AnimatedPressable onPress={() => setLogoutDialog(true)} scaleAmount={0.97} opacityAmount={0.75}>
              <Text style={{ fontSize: 14, color: "#70737B", textDecorationLine: "underline" }}>로그아웃</Text>
            </AnimatedPressable>
          </View>
          </>
          )}
        </ScrollView>

        {/* 로그아웃 확인 */}
        <ConfirmDialog
          visible={logoutDialog}
          onClose={() => setLogoutDialog(false)}
          title="로그아웃"
          description="로그아웃 하시겠어요?"
          buttons={[
            { label: "취소", onPress: () => setLogoutDialog(false), variant: "cancel" },
            { label: "로그아웃", onPress: handleLogout },
          ]}
        />

        {/* 매장 수정 확인 */}
        <ConfirmDialog
          visible={editDialog !== null}
          onClose={() => setEditDialog(null)}
          title="매장 정보 수정하기"
          description={
            editDialog !== null && stores[editDialog]
              ? `${stores[editDialog].name}\n매장 정보를 수정하시겠어요?`
              : ""
          }
          buttons={[
            { label: "취소", onPress: () => setEditDialog(null), variant: "cancel" },
            { label: "수정하기", onPress: handleEditConfirm },
          ]}
        />

        {/* 매장 전환 확인 */}
        <ConfirmDialog
          visible={switchDialog !== null}
          onClose={() => setSwitchDialog(null)}
          title="매장 전환하기"
          description={
            switchDialog !== null && stores[switchDialog]
              ? `${stores[switchDialog].name} 매장으로\n매장을 전환하시겠어요?`
              : ""
          }
          buttons={[
            { label: "취소", onPress: () => setSwitchDialog(null), variant: "cancel" },
            { label: "전환하기", onPress: () => switchDialog !== null && handleSwitchConfirm(switchDialog) },
          ]}
        />
      </SafeAreaView>
      <OwnerBottomNav activeTab="myinfo" navigation={navigation} />
    </View>
    </FadeScreen>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, letterSpacing: -0.3 }}>
      {label}
    </Text>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", flex: 1, letterSpacing: -0.3 }}>
      {value}
    </Text>
  </View>
);

const StoreInfoRow: React.FC<{
  label: string;
  value: string;
  isLink?: boolean;
  onPress?: () => void;
}> = ({ label, value, isLink, onPress }) => (
  <AnimatedPressable
    onPress={isLink ? onPress : undefined}
    scaleAmount={0.98}
    opacityAmount={0.85}
    style={{ flexDirection: "row", gap: 16 }}
  >
    <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", width: 72, flexShrink: 0 }}>
      {label}
    </Text>
    <Text style={{
      fontSize: 14, fontWeight: "500",
      color: isLink ? "#4261FF" : "#19191B",
      textDecorationLine: isLink ? "underline" : "none",
      flex: 1,
    }}>
      {value}
    </Text>
  </AnimatedPressable>
);

export default OwnerProfileScreen;
