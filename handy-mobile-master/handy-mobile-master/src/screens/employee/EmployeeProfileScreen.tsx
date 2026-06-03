import React, { useCallback, useRef, useState } from "react";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, Modal, TouchableWithoutFeedback, Image } from "react-native";
import Constants from "expo-constants";
import DotsLoader from "@/components/DotsLoader";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FadeScreen from "@/components/FadeScreen";
import { useToast } from "@/components/Toast";
import * as Clipboard from "expo-clipboard";
import { formatPhone } from "@/utils/valid";
import { ChevronLeft, Pencil, CheckCircle2, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EmployeeBottomNav from "@/components/EmployeeBottomNav";
import Avatar from "@/components/Avatar";
import { getMyEmployeeInfo, getEmployeeStoreInfo } from "@/api/employee";
import LeaveBanner from "@/components/LeaveBanner";
import { API_BASE_URL } from "@/api/client";
import { getShiftStyle } from "@/utils/shiftStyles";
import { logout } from "@/api/auth";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
const SNS_ICONS: Record<string, any> = {
  kakao: require("../../../assets/images/login/kakao.png"),
  google: require("../../../assets/images/login/google.png"),
  apple: require("../../../assets/images/login/apple.png"),
};

const Divider = () => (
  <View style={{ width: "100%", height: 12, backgroundColor: "#F7F7F8" }} />
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>{label}</Text>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", flex: 1 }}>{value}</Text>
  </View>
);

const EmployeeProfileScreen: React.FC<ScreenProps<"EmployeeProfile">> = ({ navigation }) => {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { toast } = useToast();
  const [info, setInfo] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; label: string } | null>(null);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getMyEmployeeInfo(storeId),
        getEmployeeStoreInfo(storeId).catch(() => null),
      ])
        .then(([data, sInfo]) => {
          setInfo(data);
          setStoreInfo(sInfo);
          if (data?.working_status != null) {
            localStorage.setItem("employeeWorkingStatus", data.working_status);
          }
        })
        .catch(() => setInfo(null))
        .finally(() => setLoaded(true));
    }, [storeId]),
  );

  const workingStatus = localStorage.getItem("employeeWorkingStatus") ?? "";

  const socialProvider = localStorage.getItem("socialProvider");

  const handleLogout = async () => {
    setLogoutOpen(false);
    localStorage.removeItem("socialProvider");
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const handleCopyAccount = async () => {
    const num = (info?.account_number ?? "").replace(/-/g, "");
    if (num) await Clipboard.setStringAsync(num);
    toast({ description: "계좌번호가 복사됐어요." });
  };

  const allDocsSubmitted = info
    ? [info.resume, info.employment_contract, info.health_certificate].every(Boolean)
    : false;

  const Header = () => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
      <Pressable onPress={() => navigation.navigate("EmployeeHome")} style={{ padding: 4 }} hitSlop={8}>
        <ChevronLeft size={24} color="#19191B" />
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>내 정보</Text>
    </View>
  );

  if (!loaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <Header />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
        <EmployeeBottomNav activeTab="myinfo" navigation={navigation} />
      </SafeAreaView>
    );
  }

  if (!info) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <Header />
        <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: "#9EA3AD" }}>정보를 불러올 수 없어요</Text>
        </View>
        <EmployeeBottomNav activeTab="myinfo" navigation={navigation} />
      </SafeAreaView>
    );
  }

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      <Header />
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
      {(workingStatus === "퇴사" || workingStatus === "휴직") && (
        <LeaveBanner status={workingStatus as "퇴사" | "휴직"} />
      )}

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Profile Card */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Avatar imageUrl={info.image_url} name={info.name} size={80} defaultSource={STAFF_ICON} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B" }}>{info.name ?? "이름없음"}</Text>
              {socialProvider && SNS_ICONS[socialProvider] && (
                <Image source={SNS_ICONS[socialProvider]} style={{ width: 20, height: 20, borderRadius: 10 }} resizeMode="contain" />
              )}
              <Text style={{ fontSize: 16, color: "#70737B" }}>{info.employee_type ?? "직원"}</Text>
            </View>
            <View style={{ marginTop: 4 }}>
              <View style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 10, borderRadius: 4, backgroundColor: "rgba(66,97,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#4261FF" }}>
                  {info.store_name ?? "매장"} 입사 +{info.days_since_joined ?? 0}일
                </Text>
              </View>
            </View>
          </View>
          <AnimatedPressable
            onPress={() => navigation.navigate("EmployeeProfileEdit", { profileData: info })}
            hitSlop={8}
            style={{ padding: 8, alignSelf: "flex-start", marginTop: 4 }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Pencil size={24} color="#70737B" />
          </AnimatedPressable>
        </View>

        <Divider />

        {/* 인적 사항 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>인적 사항</Text>
          <View style={{ gap: 12 }}>
            <InfoRow label="생년월일" value={`${info.birth ?? "-"}${info.age != null ? ` (${info.age}세)` : ""}`} />
            <InfoRow label="성별" value={info.gender ?? "-"} />
            <InfoRow label="전화번호" value={info.phone ? formatPhone(info.phone) : "-"} />
            <InfoRow label="은행" value={info.bank ?? "-"} />
            {/* 계좌번호 — 탭하면 복사 (계좌번호가 있을 때만 언더라인/터치) */}
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>계좌번호</Text>
              {info.account_number ? (
                <AnimatedPressable onPress={handleCopyAccount} scaleAmount={0.98} opacityAmount={0.85}>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", textDecorationLine: "underline" }}>
                    {info.account_number}
                  </Text>
                </AnimatedPressable>
              ) : (
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>-</Text>
              )}
            </View>
          </View>
        </View>

        <Divider />

        {/* 계약 정보 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>계약 정보</Text>
          <View style={{ gap: 12 }}>
            <InfoRow label="고용형태" value={info.employee_type ?? "-"} />
            <InfoRow label="입사일" value={info.joined_at ? `${info.joined_at} (+${info.days_since_joined ?? 0}일)` : "-"} />
            {/* 수습 */}
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>수습</Text>
              {info.is_probation ? (
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#FFF3EB", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF862D" }}>수습 적용</Text>
                    </View>
                    {info.probation_rate != null && (
                      <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B" }}>
                        {info.probation_rate}%
                      </Text>
                    )}
                  </View>
                  {(info.probation_start || info.probation_end) && (
                    <Text style={{ fontSize: 14, color: "#70737B" }}>
                      {info.probation_start?.replace(/-/g, ".") ?? "-"}
                      {" ~ "}
                      {info.probation_end?.replace(/-/g, ".") ?? "-"}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD" }}>수습 미적용</Text>
              )}
            </View>
            <InfoRow label="급여주기" value={info.salary_cycle ?? "-"} />
            <InfoRow label="시급" value={info.hourly_rate ? `${info.hourly_rate.toLocaleString()}원` : "-"} />
            <InfoRow label="급여일" value={info.salary_day ?? "-"} />
            {/* 근무일 */}
            {Array.isArray(info.schedule) && info.schedule.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>근무일</Text>
                <View style={{ flex: 1, gap: 8 }}>
                  {info.schedule.map((s: { day: string; time: string; tags: string[] }, i: number) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B", width: 24 }}>{s.day}</Text>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{s.time}</Text>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {(s.tags ?? []).map((tag: string) => {
                          const tagStyle = getShiftStyle(tag);
                          return (
                            <View key={tag} style={{ borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: tagStyle.bg }}>
                              <Text style={{ fontSize: 11, fontWeight: "500", color: tagStyle.text }}>{tag}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        <Divider />

        {/* 세금 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>세금</Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>소득세</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                  소득세 <Text style={{ fontWeight: "400", color: "#70737B" }}>{info.income_tax != null ? `${info.income_tax}%` : "-"}</Text>
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                  지방소득세 <Text style={{ fontWeight: "400", color: "#70737B" }}>{info.local_income_tax != null ? `${info.local_income_tax}%` : "-"}</Text>
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>4대 보험</Text>
              <View style={{ flex: 1, gap: 4 }}>
                {[
                  { label: "국민연금", val: info.national_pension_tax },
                  { label: "건강보험", val: info.health_insurance_tax },
                  { label: "장기요양", val: info.long_term_care_tax },
                  { label: "고용보험", val: info.employment_insurance_tax },
                  { label: "산재보험", val: info.industrial_accident_tax },
                ].map(({ label, val }) => (
                  <Text key={label} style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                    {label} <Text style={{ fontWeight: "400", color: "#70737B" }}>{val != null ? `${val}%` : "-"}</Text>
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        <Divider />

        {/* 계약서 */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", width: 100, flexShrink: 0 }}>계약서</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={20} color={allDocsSubmitted ? "#22C55E" : "#EF4444"} />
              <Text style={{ fontSize: 14, fontWeight: "500", color: allDocsSubmitted ? "#22C55E" : "#EF4444" }}>
                {allDocsSubmitted ? "필수 계약서 제출 완료" : "필수 계약서 제출 미완료"}
              </Text>
            </View>
          </View>
          <View style={{ gap: 12 }}>
            {[
              { label: "이력서", url: info.resume },
              { label: "근로계약서", url: info.employment_contract },
              { label: "보건증", url: info.health_certificate },
            ].map(({ label, url }) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0 }}>{label}</Text>
                {url ? (
                  <AnimatedPressable
                    onPress={() => setImagePreview({ url, label })}
                    scaleAmount={0.97}
                    opacityAmount={0.75}
                    style={{ alignSelf: "flex-start", height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#F0F3FF", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>{label} 보기</Text>
                  </AnimatedPressable>
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD" }}>미제출</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <Divider />

        {/* 매장 정보 */}
        {(() => {
          const openTimeStr = (() => {
            const o = storeInfo?.open_time;
            const c = storeInfo?.close_time;
            if (!o || !c) return "-";
            if (o === "00:00" && c === "00:00") return "24시간 영업";
            return `${o} ~ ${c}`;
          })();
          const holidayStr = (() => {
            if (!storeInfo) return "-";
            const days = (storeInfo.holidays as string[] | null) ?? [];
            if (days.length === 0) return "없음";
            return days.join(", ");
          })();
          const shifts: { name: string; start_time?: string; end_time?: string }[] = storeInfo?.shifts ?? [];
          return (
            <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>매장 정보</Text>
              <View style={{ gap: 12 }}>
                <InfoRow label="매장명" value={info?.store_name ?? "-"} />
                <InfoRow label="주소" value={storeInfo ? (`${storeInfo.address ?? ""}${storeInfo.address_detail ? ` ${storeInfo.address_detail}` : ""}`).trim() || "-" : "-"} />
                <InfoRow label="대표자명" value={storeInfo?.owner_name ?? "-"} />
                <InfoRow label="영업시간" value={openTimeStr} />
                <InfoRow label="고정휴무일" value={holidayStr} />
                {shifts.length > 0
                  ? shifts.map((s) => (
                      <InfoRow
                        key={s.name}
                        label={s.name}
                        value={s.start_time && s.end_time ? `${s.start_time} ~ ${s.end_time}` : "-"}
                      />
                    ))
                  : <InfoRow label="시프트" value="-" />
                }
              </View>
            </View>
          );
        })()}

        <Divider />

        {/* 푸터 */}
        <View style={{ paddingTop: 28, paddingBottom: 4, alignItems: "center", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <AnimatedPressable onPress={() => navigation.navigate("TermsDetail", { id: "service" })} scaleAmount={0.97} opacityAmount={0.75}>
              <Text style={{ fontSize: 13, color: "#70737B" }}>이용약관</Text>
            </AnimatedPressable>
            <View style={{ width: 1, height: 11, backgroundColor: "#DBDCDF" }} />
            <AnimatedPressable onPress={() => navigation.navigate("TermsDetail", { id: "privacy" })} scaleAmount={0.75} opacityAmount={0.75}>
              <Text style={{ fontSize: 13, color: "#70737B", fontWeight: "600" }}>개인정보처리방침</Text>
            </AnimatedPressable>
          </View>
          <Text style={{ fontSize: 12, color: "#C2C7CD" }}>v{Constants.expoConfig?.version ?? "0.1.0"}</Text>
        </View>

        {/* 로그아웃 */}
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <AnimatedPressable onPress={() => setLogoutOpen(true)} scaleAmount={0.97} opacityAmount={0.75}>
            <Text style={{ fontSize: 14, color: "#70737B", textDecorationLine: "underline" }}>로그아웃</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>

      {/* 계약서 미리보기 모달 */}
      <Modal visible={!!imagePreview} transparent animationType="fade" onRequestClose={() => setImagePreview(null)}>
        <TouchableWithoutFeedback onPress={() => setImagePreview(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ width: "90%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", flex: 1 }}>{imagePreview?.label}</Text>
                  <AnimatedPressable onPress={() => setImagePreview(null)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                    <X size={20} color="#19191B" />
                  </AnimatedPressable>
                </View>
                <View style={{ padding: 20, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: "100%", aspectRatio: 3 / 4, backgroundColor: "#E8E8E8", borderRadius: 12, overflow: "hidden" }}>
                    {imagePreview && (
                      <Image
                        source={{ uri: (imagePreview.url.startsWith("http") || imagePreview.url.startsWith("file") || imagePreview.url.startsWith("content"))
                          ? imagePreview.url
                          : `${API_BASE_URL}${imagePreview.url.startsWith("/") ? imagePreview.url : `/${imagePreview.url}`}` }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ConfirmDialog
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="로그아웃"
        description="로그아웃 하시겠어요?"
        buttons={[
          { label: "취소", onPress: () => setLogoutOpen(false), variant: "cancel" },
          { label: "확인", onPress: handleLogout },
        ]}
      />

      <EmployeeBottomNav activeTab="myinfo" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

export default EmployeeProfileScreen;
