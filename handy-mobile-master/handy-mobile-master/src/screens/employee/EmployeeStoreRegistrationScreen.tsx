import React, { useState, useEffect } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions } from "react-native";
import { AlertCircle, ChevronRight } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import BottomSheet from "@/components/BottomSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import FocusInput from "@/components/FocusInput";
import { useToast } from "@/components/Toast";
import { api } from "@/api/client";
import { getMe } from "@/api/auth";
import { localStorage } from "@/utils/storage";
import { formatPhone } from "@/utils/valid";
import Constants from "expo-constants";
import { WebView } from "react-native-webview";
import type { ScreenProps } from "@/navigation/types";

const buildCoordMapHtml = (lat: number, lng: number, kakaoKey: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%;overflow:hidden}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function(){
      try{
        var map=new kakao.maps.Map(document.getElementById('map'),{
          center:new kakao.maps.LatLng(${lat},${lng}),
          level:4
        });
        new kakao.maps.Marker({map:map,position:new kakao.maps.LatLng(${lat},${lng})});
      }catch(e){}
    })();
  </script>
</body>
</html>`;

const ALL_BANKS = [
  "국민은행", "신한은행", "농협", "우리은행", "기업은행", "하나은행",
  "토스뱅크", "카카오뱅크", "새마을금고", "케이뱅크", "우체국", "SC제일은행",
  "IM뱅크", "부산은행", "광주은행", "경남은행", "신협", "산업은행",
  "수협은행", "한국씨티은행", "SBI저축은행", "제주은행", "전북은행", "산림조합중앙회",
];

const BANK_LOGOS: Record<string, any> = {
  "국민은행": require("../../../assets/images/banks/국민.png"),
  "신한은행": require("../../../assets/images/banks/신한.png"),
  "농협": require("../../../assets/images/banks/농협.png"),
  "우리은행": require("../../../assets/images/banks/우리.png"),
  "기업은행": require("../../../assets/images/banks/기업.png"),
  "하나은행": require("../../../assets/images/banks/하나.png"),
  "토스뱅크": require("../../../assets/images/banks/토스.png"),
  "카카오뱅크": require("../../../assets/images/banks/카카오뱅크.png"),
  "새마을금고": require("../../../assets/images/banks/새마을금고.png"),
  "케이뱅크": require("../../../assets/images/banks/케이뱅크.png"),
  "우체국": require("../../../assets/images/banks/우체국.png"),
  "SC제일은행": require("../../../assets/images/banks/sc제일은행.png"),
  "IM뱅크": require("../../../assets/images/banks/im뱅크.png"),
  "부산은행": require("../../../assets/images/banks/부산은행.png"),
  "광주은행": require("../../../assets/images/banks/광주은행.png"),
  "경남은행": require("../../../assets/images/banks/부산은행.png"),
  "신협": require("../../../assets/images/banks/신협.png"),
  "산업은행": require("../../../assets/images/banks/산업은행.png"),
  "수협은행": require("../../../assets/images/banks/수협은행.png"),
  "한국씨티은행": require("../../../assets/images/banks/씨티은행.png"),
  "SBI저축은행": require("../../../assets/images/banks/sbi저축은행.png"),
  "제주은행": require("../../../assets/images/banks/신한.png"),
  "전북은행": require("../../../assets/images/banks/광주은행.png"),
  "산림조합중앙회": require("../../../assets/images/banks/산림조합중앙회.png"),
};

const BANK_CELL_W = Math.floor((Dimensions.get("window").width - 40) / 3);

interface StoreInfo {
  id: number;
  name: string;
  address: string;
  address_detail?: string;
  phone: string;
  industry?: string;
  owner_name?: string;
  business_number?: string;
}

const EmployeeStoreRegistrationScreen: React.FC<ScreenProps<"EmployeeStoreRegistration">> = ({ navigation }) => {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);

  // step 1
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeVerifying, setCodeVerifying] = useState(false);

  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  const geocodeAddress = async (address: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
        { headers: { "User-Agent": "HandyStaffApp/1.0" } },
      );
      const data = await res.json();
      if (data.length > 0) {
        setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      }
    } catch {}
  };

  // step 3
  const [bank, setBank] = useState("");
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [accountHolderSheetOpen, setAccountHolderSheetOpen] = useState(false);
  const [accountHolderInput, setAccountHolderInput] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [accountInput, setAccountInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMe().then((me) => { if (me?.name) setAccountHolder(me.name); }).catch((e) => console.warn(e));
  }, []);

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
    else navigation.goBack();
  };

  const verifyCode = async () => {
    if (!code.trim() || codeVerifying) return;
    setCodeVerifying(true);
    setCodeError("");
    try {
      const data = await api.post<StoreInfo>("/api/employee/verify-code", { code: code.trim() });
      setStoreInfo({
        id: data.id,
        name: data.name,
        address: data.address,
        address_detail: data.address_detail,
        phone: data.phone,
        industry: data.industry,
        owner_name: data.owner_name,
        business_number: data.business_number,
      });
      if (data.address) geocodeAddress(data.address);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "올바르지 않은 매장 코드에요";
      setCodeError(msg);
    } finally {
      setCodeVerifying(false);
    }
  };

  const submitRequest = async () => {
    if (!storeInfo || !bank || !accountHolder || !accountNumber || submitting) return;
    setSubmitting(true);
    try {
      await api.post("/api/employee/member/request", {
        store_id: storeInfo.id,
        bank,
        account_name: accountHolder,
        account_number: accountNumber,
      });
      localStorage.setItem("pendingMemberRequest", "true");
      localStorage.setItem("pendingStoreId", String(storeInfo.id));
      navigation.reset({ index: 0, routes: [{ name: "EmployeePending" }] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "신청에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = (focused: boolean, errored?: boolean) => ({
    height: 52, borderRadius: 12,
    borderWidth: focused || errored ? 2 : 1,
    borderColor: errored ? "#FF3D3D" : focused ? "#4261FF" : "#DBDCDF",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16, fontSize: 16, color: "#19191B",
  });

  // ─── Step 1: 매장 코드 ───
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <PageLayout
          headerTitle="매장 등록"
          progressStep={{ current: 1, total: 3 }}
          title={"사장님에게 받은\n매장 코드를 입력 해주세요"}
          onBack={handleBack}
          footer={<PrimaryButton label="매장 코드 조회하기" onPress={verifyCode} disabled={!code.trim()} loading={codeVerifying} />}
        >
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              매장 코드 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <TextInput
              value={code} onChangeText={(t) => { setCode(t); setCodeError(""); }}
              onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)}
              placeholder="매장 코드 입력" placeholderTextColor="#AAB4BF"
              autoCapitalize="characters"
              style={[{ marginTop: 8 }, fieldStyle(codeFocused, !!codeError)]}
            />
            {codeError ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                <AlertCircle size={16} color="#FF3D3D" />
                <Text style={{ fontSize: 13, color: "#FF3D3D" }}>{codeError}</Text>
              </View>
            ) : null}
          </View>
        </PageLayout>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step 2: 매장 정보 확인 ───
  if (step === 2 && storeInfo) {
    const kakaoKey = Constants.expoConfig?.extra?.kakaoMapApiKey ?? "";
    const fullAddress = [storeInfo.address, storeInfo.address_detail].filter(Boolean).join(" ");
    return (
      <PageLayout
        headerTitle="매장 등록"
        progressStep={{ current: 2, total: 3 }}
        title={"가입 신청할\n매장 정보를 확인해주세요"}
        onBack={handleBack}
        footer={<PrimaryButton label="매장 선택하기" onPress={() => setStep(3)} />}
      >
        <View style={{ gap: 14 }}>

          {/* 매장 정보 카드 — 엣지 투 엣지, 내부 padding 20으로 타이틀과 좌측 정렬 */}
          <View style={{
            backgroundColor: "#FFFFFF",
            shadowColor: "#000",
            shadowOpacity: 0.07,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}>
            {/* 매장명 헤더 */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", letterSpacing: -0.44 }}>
                {storeInfo.name}
              </Text>
              {storeInfo.industry ? (
                <View style={{
                  marginTop: 8, alignSelf: "flex-start",
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 6, backgroundColor: "#F0F3FF",
                }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF" }}>
                    {storeInfo.industry}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ height: 1, backgroundColor: "#F4F5F8" }} />

            {/* 상세 정보 */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}>
              {fullAddress ? <InfoRow label="주소" value={fullAddress} /> : null}
              {storeInfo.owner_name ? <InfoRow label="대표자명" value={storeInfo.owner_name} /> : null}
              {storeInfo.phone ? <InfoRow label="대표번호" value={formatPhone(storeInfo.phone)} /> : null}
            </View>
          </View>

          {/* 지도 */}
          {mapCoords && kakaoKey ? (
            <View style={{ height: 200, borderRadius: 12, overflow: "hidden", marginHorizontal: 20 }}>
              <WebView
                source={{ html: buildCoordMapHtml(mapCoords.lat, mapCoords.lng, kakaoKey) }}
                style={{ flex: 1 }}
                scrollEnabled={false}
                javaScriptEnabled
              />
            </View>
          ) : fullAddress ? (
            <View style={{ height: 200, borderRadius: 12, backgroundColor: "#F4F5F8", marginHorizontal: 20, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 13, color: "#9EA3AD" }}>지도를 불러오지 못했어요</Text>
            </View>
          ) : null}

        </View>
      </PageLayout>
    );
  }

  // ─── Step 3: 계좌 등록 ───
  if (step === 3) {
    const canNext = !!bank && !!accountHolder.trim() && !!accountNumber.trim();
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <PageLayout
          headerTitle="매장 등록"
          progressStep={{ current: 3, total: 3 }}
          title={"급여를 받을\n계좌번호를 입력 해주세요"}
          subtitle="본인 명의의 계좌번호만 등록할 수 있어요"
          onBack={handleBack}
          footer={<PrimaryButton label="가입신청 하기" onPress={() => setConfirmOpen(true)} disabled={!canNext} loading={submitting} />}
        >
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
              은행 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <AnimatedPressable
              onPress={() => setBankSheetOpen(true)}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={[{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, fieldStyle(false)]}
            >
              <Text style={{ fontSize: 16, color: bank ? "#19191B" : "#AAB4BF" }}>{bank || "은행 선택"}</Text>
              <ChevronRight size={20} color="#9EA3AD" />
            </AnimatedPressable>

            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                예금주 <Text style={{ color: "#FF3D3D" }}>*</Text>
              </Text>
              <AnimatedPressable
                onPress={() => { setAccountHolderInput(accountHolder); setAccountHolderSheetOpen(true); }}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={[{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, fieldStyle(false)]}
              >
                <Text style={{ fontSize: 16, color: accountHolder ? "#19191B" : "#AAB4BF" }}>{accountHolder || "이름"}</Text>
                <ChevronRight size={20} color="#9EA3AD" />
              </AnimatedPressable>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                계좌번호 <Text style={{ color: "#FF3D3D" }}>*</Text>
              </Text>
              <AnimatedPressable
                onPress={() => { setAccountInput(accountNumber); setAccountSheetOpen(true); }}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={[{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, fieldStyle(false)]}
              >
                <Text style={{ fontSize: 16, color: accountNumber ? "#19191B" : "#AAB4BF" }}>{accountNumber || "'-' 포함 입력"}</Text>
                <ChevronRight size={20} color="#9EA3AD" />
              </AnimatedPressable>
            </View>
          </View>
        </PageLayout>

        <BottomSheet isOpen={bankSheetOpen} onClose={() => setBankSheetOpen(false)} title="은행을 선택해주세요">
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ maxHeight: 420 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {ALL_BANKS.map((b) => {
                const sel = bank === b;
                const logo = BANK_LOGOS[b];
                return (
                  <AnimatedPressable
                    key={b}
                    onPress={() => { setBank(b); setBankSheetOpen(false); }}
                    scaleAmount={0.97}
                    opacityAmount={0.85}
                    style={{ width: BANK_CELL_W, alignItems: "center", paddingVertical: 12 }}
                  >
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: sel ? "#EEF2FF" : "#F7F7F8", borderWidth: 2, borderColor: sel ? "#4261FF" : "transparent", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {logo ? (
                        <Image source={logo} style={{ width: 38, height: 38 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: 15, fontWeight: "700", color: sel ? "#4261FF" : "#70737B" }}>{b.charAt(0)}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : "#19191B", marginTop: 6, textAlign: "center" }} numberOfLines={2}>{b}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </ScrollView>
        </BottomSheet>

        <BottomSheet isOpen={accountHolderSheetOpen} onClose={() => setAccountHolderSheetOpen(false)} title="예금주 입력">
          <View style={{ gap: 16 }}>
            <FocusInput
              value={accountHolderInput}
              onChangeText={setAccountHolderInput}
              placeholder="이름"
              placeholderTextColor="#AAB4BF"
              autoFocus
              style={{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF" }}
            />
            <AnimatedPressable
              onPress={() => { if (accountHolderInput.trim()) { setAccountHolder(accountHolderInput.trim()); setAccountHolderSheetOpen(false); } }}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: accountHolderInput.trim() ? "#4261FF" : "#DBDCDF" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
            </AnimatedPressable>
          </View>
        </BottomSheet>

        <BottomSheet isOpen={accountSheetOpen} onClose={() => setAccountSheetOpen(false)} title="계좌번호 입력하기">
          <View style={{ gap: 16 }}>
            <FocusInput
              value={accountInput}
              onChangeText={(t) => setAccountInput(t.replace(/[^0-9-]/g, ""))}
              placeholder="'-' 포함 입력"
              placeholderTextColor="#AAB4BF"
              keyboardType="numbers-and-punctuation"
              autoFocus
              style={{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF" }}
            />
            <AnimatedPressable
              onPress={() => { if (accountInput.trim()) { setAccountNumber(accountInput.trim()); setAccountSheetOpen(false); } }}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: accountInput.trim() ? "#4261FF" : "#DBDCDF" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
            </AnimatedPressable>
          </View>
        </BottomSheet>

        <ConfirmDialog
          visible={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="가입 신청 확인"
          description={`아래 정보로 ${storeInfo?.name ?? "매장"}에\n가입 신청하시겠어요?`}
          buttons={[
            { label: "취소", onPress: () => setConfirmOpen(false), variant: "cancel" },
            { label: "신청하기", onPress: () => { setConfirmOpen(false); submitRequest(); } },
          ]}
        >
          <View style={{ backgroundColor: "#F7F8FA", borderRadius: 12, padding: 16, gap: 10 }}>
            {[
              { label: "은행", value: bank },
              { label: "예금주", value: accountHolder },
              { label: "계좌번호", value: accountNumber },
            ].map(({ label, value }) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: "#9EA3AD", width: 56, flexShrink: 0 }}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#19191B", flex: 1 }}>{value}</Text>
              </View>
            ))}
          </View>
        </ConfirmDialog>
      </KeyboardAvoidingView>
    );
  }

  return null;
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
    <Text style={{ fontSize: 14, color: "#9EA3AD", width: 72, flexShrink: 0, paddingTop: 1 }}>
      {label}
    </Text>
    <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flex: 1, lineHeight: 20 }}>
      {value}
    </Text>
  </View>
);

export default EmployeeStoreRegistrationScreen;
