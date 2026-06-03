import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ChevronDown, Check, ChevronRight, ChevronLeft } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import BottomSheet from "@/components/BottomSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import AnimatedPressable from "@/components/AnimatedPressable";
import { loadProfileInfoDraft, saveProfileInfoDraft } from "@/utils/signupDraft";
import { getTerms } from "@/api/public";
import type { ScreenProps } from "@/navigation/types";

// 하드코딩 폴백 — API 실패 시 사용
const TERMS_CONTENT: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  service: {
    title: "서비스 이용약관",
    sections: [
      {
        heading: "제1조 (목적)",
        body: "본 약관은 핸디(이하 '회사')가 제공하는 소상공인 근태·급여·매출 관리 모바일 애플리케이션 'Handy'(이하 '서비스') 이용과 관련하여 회사와 회원의 권리, 의무 및 책임사항을 규정함을 목적으로 해요.",
      },
      {
        heading: "제2조 (용어의 정의)",
        body: "'회원'이란 본 약관에 동의하고 서비스를 이용하는 자를 말해요.\n'사장 회원'이란 사업자등록증을 제출하고 관리자 승인을 받아 매장을 등록한 회원을 말해요.\n'직원 회원'이란 사장 회원이 운영하는 매장에 소속되어 서비스를 이용하는 회원을 말해요.\n'매장'이란 사장 회원이 등록한 사업장으로, 직원 관리의 기본 단위를 말해요.",
      },
      {
        heading: "제3조 (약관의 효력 및 변경)",
        body: "① 본 약관은 회원이 가입 절차에서 동의함으로써 효력이 발생해요.\n② 회사는 '약관의 규제에 관한 법률', '정보통신망 이용촉진 및 정보보호 등에 관한 법률' 등 관련 법령을 준수하는 범위 내에서 본 약관을 변경할 수 있어요.\n③ 약관이 변경되는 경우 회사는 변경 내용과 시행일을 서비스 내 공지사항을 통해 적용일 7일 전에 공지해요. 다만, 회원에게 불리한 변경의 경우 30일 전에 공지해요.\n④ 회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있어요.",
      },
      {
        heading: "제4조 (서비스의 내용)",
        body: "회사는 다음의 서비스를 제공해요.\n① 직원 출퇴근·근태 관리 (GPS 기반 출근 인증 포함)\n② 급여 계산 및 급여명세서 발행\n③ 매출 기록 및 마감 보고 관리\n④ 직원 일정 관리 및 스케줄 조정\n⑤ 사내 게시판 및 공지사항\n⑥ 푸시 알림 서비스",
      },
      {
        heading: "제5조 (서비스 이용 자격)",
        body: "① 본 서비스는 만 15세 이상인 자만 이용할 수 있어요.\n② 사장 회원으로 가입하려면 유효한 사업자등록증을 보유하여야 하며, 관리자의 승인이 필요해요.\n③ 직원 회원은 사장 회원으로부터 매장 코드를 안내받아 가입할 수 있어요.",
      },
      {
        heading: "제6조 (회원의 의무)",
        body: "① 회원은 본 약관 및 관련 법령을 준수하여야 해요.\n② 회원은 타인의 정보를 도용하거나 허위 정보를 등록하여서는 안 돼요.\n③ 회원은 서비스 운영을 방해하거나 회사·다른 회원에게 손해를 끼치는 행위를 하여서는 안 돼요.\n④ 회원은 계정 정보를 제3자에게 양도하거나 공유하여서는 안 돼요.",
      },
      {
        heading: "제7조 (서비스 중단 및 변경)",
        body: "① 회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신 두절 등의 사유가 발생한 경우 서비스 제공을 일시적으로 중단할 수 있어요.\n② 회사는 서비스의 내용, 운영상 또는 기술상의 필요에 따라 제공하는 서비스를 변경할 수 있어요.\n③ 서비스 중단 또는 변경 시 사전에 공지하는 것을 원칙으로 하며, 긴급한 경우 사후 공지할 수 있어요.",
      },
      {
        heading: "제8조 (책임의 제한)",
        body: "① 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중단 등 불가항력으로 서비스를 제공할 수 없는 경우 책임이 면제돼요.\n② 회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않아요.\n③ 회사는 회원이 서비스를 이용하여 기대하는 수익을 얻지 못하거나 손실이 발생하더라도 이에 대한 책임을 지지 않아요.",
      },
      {
        heading: "제9조 (분쟁 해결)",
        body: "① 서비스 이용과 관련하여 회사와 회원 간에 분쟁이 발생한 경우, 회사와 회원은 분쟁 해결을 위해 성실히 협의해요.\n② 협의가 이루어지지 않는 경우 회사의 본사 소재지를 관할하는 법원을 전속 관할 법원으로 해요.\n③ 준거법은 대한민국 법률로 해요.",
      },
    ],
  },
  privacy: {
    title: "개인정보 수집 · 이용 동의",
    sections: [
      {
        heading: "1. 수집하는 개인정보 항목",
        body: "[필수] 휴대폰 번호, 이름, 생년월일, 성별\n[소셜 로그인 시] 소셜 계정 이메일, 소셜 서비스 식별자(카카오·애플·구글)\n[선택] 프로필 사진, 은행명·계좌번호(급여 수령용), 이력서·근로계약서·보건증(직원 서류 등록 시)\n\n※ 서비스 이용 과정에서 다음 정보가 자동 수집될 수 있어요.\n- 기기 정보(OS, 기기 모델), FCM 푸시 알림 토큰, 접속 IP, 접속 로그, 서비스 이용 내역",
      },
      {
        heading: "2. 수집 및 이용 목적",
        body: "① 회원 식별 및 본인 확인\n② 서비스 제공 및 운영 (근태·급여·매출 관리)\n③ 급여명세서 발행 및 급여 이체 처리\n④ 푸시 알림 발송 (출퇴근 알림, 급여 알림, 일정 알림 등)\n⑤ 고객 문의 응대 및 불만 처리\n⑥ 서비스 개선 및 신규 서비스 개발",
      },
      {
        heading: "3. 보유 및 이용 기간",
        body: "회원 탈퇴 시까지 보유하며, 탈퇴 후 30일이 경과하면 모든 개인정보를 복구 불가능한 방법으로 영구 삭제해요.\n\n단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관돼요.\n- 전자상거래법: 거래 기록 5년\n- 통신비밀보호법: 로그인 기록 3개월",
      },
      {
        heading: "4. 동의 거부 권리 및 불이익",
        body: "이용자는 개인정보 수집·이용에 대한 동의를 거부할 권리가 있어요.\n다만, 필수 항목 동의를 거부할 경우 회원가입 및 서비스 이용이 불가해요.\n선택 항목(프로필 사진, 은행정보, 서류)은 동의를 거부하더라도 기본 서비스 이용에는 제한이 없어요.",
      },
      {
        heading: "5. 정보주체의 권리",
        body: "이용자는 언제든지 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있으며, 회사는 관련 법령에 따라 지체 없이 조치해요.\n권리 행사는 서비스 내 [내 정보] 메뉴 또는 아래 개인정보 보호책임자에게 요청할 수 있어요.",
      },
      {
        heading: "6. 개인정보 보호책임자",
        body: "회사는 개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자를 지정하고 있어요.\n- 개인정보 보호책임자: 【성명 / 직책】\n- 연락처: 【이메일 / 전화번호】\n\n※ 개인정보 침해에 관한 상담이 필요하면 개인정보침해신고센터(국번 없이 118), 대검찰청 사이버수사과(1301) 등에 문의할 수 있어요.",
      },
    ],
  },
  thirdParty: {
    title: "개인정보 처리위탁 동의",
    sections: [
      {
        heading: "1. 위탁의 원칙",
        body: "회사는 회원의 개인정보를 외부에 제3자 제공하지 않아요. 다만, 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리업무의 일부를 외부 전문업체에 위탁하고 있어요. (소셜 계정 정보는 카카오·애플·구글 등으로부터 회원 동의 하에 제공받아 수집하는 항목이에요.)",
      },
      {
        heading: "2. SMS 본인확인 인증",
        body: "- 수탁업체: 문자메시지 인증 서비스 사업자\n- 위탁 업무: 휴대폰 번호 본인 확인 인증번호 발송\n- 위탁 항목: 휴대폰 번호\n- 보유 기간: 인증 완료 후 즉시 파기",
      },
      {
        heading: "3. 클라우드 인프라",
        body: "- 수탁업체: 클라우드 인프라 사업자\n- 위탁 업무: 서비스 운영을 위한 서버·데이터 저장 및 처리\n- 위탁 항목: 서비스 이용 정보 전반\n- 보유 기간: 위탁계약 종료 시 또는 회원 탈퇴 시까지",
      },
      {
        heading: "4. 푸시 알림 발송",
        body: "- 수탁업체: 푸시 메시지 발송 사업자(예: Google Firebase)\n- 위탁 업무: 앱 푸시 알림 발송\n- 위탁 항목: 푸시 알림 토큰(FCM)\n- 보유 기간: 회원 탈퇴 시 또는 위탁계약 종료 시까지",
      },
      {
        heading: "5. 수탁업체 관리·감독",
        body: "회사는 위탁계약 시 개인정보의 안전한 관리에 관한 사항을 규정하고, 수탁업체가 개인정보를 안전하게 처리하는지 관리·감독해요. 동의를 거부할 경우 본인확인·푸시 알림 등 관련 기능 이용이 제한될 수 있어요.",
      },
    ],
  },
  location: {
    title: "위치정보 이용 동의",
    sections: [
      {
        heading: "1. 위치정보 수집 항목",
        body: "회원의 스마트폰 GPS 센서를 통해 수집되는 위치 정보(위도, 경도)\n\n※ 본 서비스는 앱 사용 중(Foreground)에만 위치 정보를 수집하며, 백그라운드에서는 수집하지 않아요.",
      },
      {
        heading: "2. 이용 목적",
        body: "매장 출퇴근 인증 시 GPS 반경 검증\n\n회원이 출근 버튼을 누를 때 단말기의 현재 위치와 등록된 매장 위치를 비교하여 출근 인증 가능 여부를 판단해요. 위치 정보는 인증 판단 후 서버에 저장되지 않아요.",
      },
      {
        heading: "3. 위치정보 보유 기간",
        body: "출퇴근 인증 판단 완료 후 즉시 파기해요.\n\n단, 출퇴근 기록(출근 시각, 퇴근 시각)은 근태 관리 목적으로 회원 탈퇴 시까지 보관돼요.",
      },
      {
        heading: "4. 동의 거부 권리 및 불이익",
        body: "위치정보 이용 동의는 거부할 수 있어요. 다만 동의를 거부하는 경우 GPS 기반 출퇴근 인증 기능 이용이 제한되며, 출퇴근 기록이 정상적으로 처리되지 않을 수 있어요.\n\n※ 본 서비스는 '위치정보의 보호 및 이용 등에 관한 법률'에 따라 위치정보를 처리해요.",
      },
    ],
  },
};

const TERMS = [
  { id: "service", label: "서비스 이용약관 동의", required: true },
  { id: "privacy", label: "개인정보 수집 · 이용 동의", required: true },
  { id: "thirdParty", label: "개인정보 처리위탁 동의", required: true },
  { id: "location", label: "위치 정보 이용 동의", required: true },
];

const ProfileInfoScreen: React.FC<ScreenProps<"ProfileInfo">> = ({ route, navigation }) => {
  const { phone, password, type, socialToken } = route.params;
  const initialDraft = loadProfileInfoDraft();

  const [name, setName] = useState(initialDraft?.name ?? "");
  const [birthYear, setBirthYear] = useState<number | null>(initialDraft?.birthYear ?? null);
  const [birthMonth, setBirthMonth] = useState<number | null>(initialDraft?.birthMonth ?? null);
  const [birthDay, setBirthDay] = useState<number | null>(initialDraft?.birthDay ?? null);
  const [showBirthSheet, setShowBirthSheet] = useState(false);
  const [tempYear, setTempYear] = useState<number | null>(initialDraft?.birthYear ?? null);
  const [tempMonth, setTempMonth] = useState<number | null>(initialDraft?.birthMonth ?? null);
  const [tempDay, setTempDay] = useState<number | null>(initialDraft?.birthDay ?? null);
  const [gender, setGender] = useState<string>(initialDraft?.gender ?? "");
  const [showGenderSheet, setShowGenderSheet] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [agreed, setAgreed] = useState<Record<string, boolean>>(initialDraft?.agreed ?? {});
  const [termsModalId, setTermsModalId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNameSheet, setShowNameSheet] = useState(false);
  const [nameInput, setNameInput] = useState(initialDraft?.name ?? "");
  const [termsContent, setTermsContent] = useState<typeof TERMS_CONTENT>(TERMS_CONTENT);
  const hasInputRef = useRef(false);

  hasInputRef.current = name.trim().length > 0 || birthdate !== "" || gender !== "";

  // 약관 API 로드 (실패 시 하드코딩 폴백 유지)
  useEffect(() => {
    const types = ["service", "privacy", "thirdParty", "location"] as const;
    Promise.allSettled(types.map(t => getTerms(t))).then(results => {
      const loaded: typeof TERMS_CONTENT = { ...TERMS_CONTENT };
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          loaded[types[i]] = { title: r.value.title, sections: r.value.sections };
        }
      });
      setTermsContent(loaded);
    });
  }, []);

  useEffect(() => {
    saveProfileInfoDraft({ name, birthYear, birthMonth, birthDay, gender: gender as "남자" | "여자" | "", agreed });
  }, [name, birthYear, birthMonth, birthDay, gender, agreed]);

  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (hasInputRef.current) { setShowCancelDialog(true); return true; }
        return false;
      });
      return () => sub.remove();
    }, [])
  );

  const handleBack = () => {
    if (hasInputRef.current) { setShowCancelDialog(true); return; }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const birthdate =
    birthYear && birthMonth && birthDay
      ? `${birthYear}.${String(birthMonth).padStart(2, "0")}.${String(birthDay).padStart(2, "0")}`
      : "";

  const canNext = name.trim().length > 0 && birthdate !== "" && gender !== "";

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  // 만 15세 이상 법적 요건: 오늘 기준 15년 전 날짜까지만 선택 가능
  const MAX_BIRTH_YEAR = currentYear - 15;

  const years = Array.from({ length: MAX_BIRTH_YEAR - 1900 + 1 }, (_, i) => MAX_BIRTH_YEAR - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

  // MAX_BIRTH_YEAR 선택 시 currentMonth 이하 월만 허용
  const availableMonths =
    tempYear === MAX_BIRTH_YEAR ? months.filter((m) => m <= currentMonth) : months;

  // MAX_BIRTH_YEAR + currentMonth 선택 시 currentDay 이하 일만 허용
  const baseMaxDay = daysInMonth(tempYear ?? MAX_BIRTH_YEAR, tempMonth ?? 1);
  const dayLimit =
    tempYear === MAX_BIRTH_YEAR && tempMonth === currentMonth
      ? Math.min(currentDay, baseMaxDay)
      : baseMaxDay;
  const days = Array.from({ length: dayLimit }, (_, i) => i + 1);

  const allRequiredAgreed = TERMS.filter((t) => t.required).every((t) => agreed[t.id]);
  const allAgreed = TERMS.every((t) => agreed[t.id]);

  const toggleAll = () => {
    if (allAgreed) setAgreed({});
    else {
      const all: Record<string, boolean> = {};
      TERMS.forEach((t) => (all[t.id] = true));
      setAgreed(all);
    }
  };
  const toggleTerm = (id: string) => setAgreed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleNextClick = () => {
    if (!canNext) return;
    setShowTermsSheet(true);
  };

  const handleAgreeSubmit = () => {
    if (!allRequiredAgreed) return;
    setShowTermsSheet(false);
    navigation.navigate("ProfilePhoto", { phone, password, name, birthdate, gender, type, socialToken, agreedTerms: true });
  };

  const handleBirthConfirm = () => {
    if (tempYear === null || tempMonth === null || tempDay === null) return;
    // 만 15세 미만이면 확정 불가 (UI 필터링이 정상이면 도달하지 않음)
    const birthDateObj = new Date(tempYear, tempMonth - 1, tempDay);
    const cutoff = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
    if (birthDateObj > cutoff) return;
    setBirthYear(tempYear);
    setBirthMonth(tempMonth);
    setBirthDay(tempDay);
    setShowBirthSheet(false);
  };

  return (
    <>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <PageLayout
        headerTitle="회원가입"
        onBack={handleBack}
        title={"회원 정보를\n입력 해주세요"}
        subtitle="회원 식별을 위해 정보를 입력 해주세요."
        footer={<PrimaryButton label="다음" onPress={handleNextClick} disabled={!canNext} />}
      >
        <View style={{ paddingHorizontal: 20 }}>
          {/* Name */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              이름 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <Pressable
              onPress={() => { setNameInput(name); setShowNameSheet(true); }}
              style={{
                marginTop: 8,
                height: 52,
                borderWidth: 2,
                borderRadius: 12,
                paddingHorizontal: 16,
                borderColor: name ? "#4261FF" : "#EBEBEB",
                backgroundColor: "#FFFFFF",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 16, color: name ? "#19191B" : "#AAB4BF" }}>
                {name || "이름 입력"}
              </Text>
              <ChevronRight size={18} color="#AAB4BF" />
            </Pressable>
          </View>

          {/* Birth */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              생년월일 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <AnimatedPressable
              onPress={() => setShowBirthSheet(true)}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={{
                marginTop: 8,
                borderWidth: 2,
                borderColor: "#EBEBEB",
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text style={{ fontSize: 16, color: birthdate ? "#19191B" : "#AAB4BF" }}>
                {birthdate || "생년월일 선택"}
              </Text>
              <ChevronDown size={20} color="#9EA3AD" />
            </AnimatedPressable>
          </View>

          {/* Gender */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>
              성별 <Text style={{ color: "#FF3D3D" }}>*</Text>
            </Text>
            <AnimatedPressable
              onPress={() => setShowGenderSheet(true)}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={{
                marginTop: 8,
                borderWidth: 2,
                borderColor: "#EBEBEB",
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text style={{ fontSize: 16, color: gender ? "#19191B" : "#AAB4BF" }}>
                {gender || "성별 선택"}
              </Text>
              <ChevronDown size={20} color="#9EA3AD" />
            </AnimatedPressable>
          </View>
        </View>
      </PageLayout>

      {/* 이름 입력 시트 */}
      <BottomSheet isOpen={showNameSheet} onClose={() => setShowNameSheet(false)} title="이름 입력하기">
        <TextInput
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="이름 입력"
          placeholderTextColor="#AAB4BF"
          autoFocus
          style={{ height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#EBEBEB", paddingHorizontal: 16, fontSize: 16, color: "#19191B" } as any}
        />
        <Text style={{ marginTop: 8, fontSize: 13, color: "#4261FF", lineHeight: 20 }}>
          * 닉네임을 사용할 경우 '닉네임(이름)' 형식으로 작성해주세요
        </Text>
        <Text style={{ fontSize: 13, color: "#19191B" }}>예) 핸디(홍길동)</Text>
        <AnimatedPressable
          onPress={() => { if (nameInput.trim()) { setName(nameInput.trim()); setShowNameSheet(false); } }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ marginTop: 24, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: nameInput.trim() ? "#4261FF" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
        </AnimatedPressable>
      </BottomSheet>

      {/* 생년월일 시트 */}
      <BottomSheet isOpen={showBirthSheet} onClose={() => setShowBirthSheet(false)} title="생년월일을 선택해주세요">
        <Text style={{ fontSize: 13, color: "#70737B", marginTop: -12, marginBottom: 16 }}>
          만 15세 이상만 가입할 수 있어요
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Year */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 6 }}>년</Text>
            <ScrollView
              style={{ height: 200, borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {years.map((y) => {
                const sel = tempYear !== null && tempYear === y;
                return (
                  <AnimatedPressable
                    key={y}
                    onPress={() => {
                      setTempYear(y);
                      // MAX_BIRTH_YEAR 선택 시 허용 범위 벗어난 월/일 초기화
                      if (y === MAX_BIRTH_YEAR) {
                        if (tempMonth !== null && tempMonth > currentMonth) {
                          setTempMonth(null);
                          setTempDay(null);
                        } else if (tempMonth === currentMonth && tempDay !== null && tempDay > currentDay) {
                          setTempDay(null);
                        }
                      }
                    }}
                    scaleAmount={0.97}
                    opacityAmount={0.8}
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: sel ? "#EEF2FF" : "transparent" }}
                  >
                    <Text style={{ fontSize: 15, textAlign: "center", fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : "#19191B" }}>
                      {y}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
          {/* Month */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 6 }}>월</Text>
            <ScrollView
              style={{ height: 200, borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {availableMonths.map((m) => {
                const sel = tempMonth !== null && tempMonth === m;
                return (
                  <AnimatedPressable
                    key={m}
                    onPress={() => {
                      setTempMonth(m);
                      // 일이 해당 월의 최대 일수 또는 오늘 날짜 제한을 초과하면 초기화
                      const maxDay =
                        tempYear === MAX_BIRTH_YEAR && m === currentMonth
                          ? Math.min(currentDay, daysInMonth(tempYear, m))
                          : daysInMonth(tempYear ?? MAX_BIRTH_YEAR, m);
                      if (tempDay !== null && tempDay > maxDay) setTempDay(null);
                    }}
                    scaleAmount={0.97}
                    opacityAmount={0.8}
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: sel ? "#EEF2FF" : "transparent" }}
                  >
                    <Text style={{ fontSize: 15, textAlign: "center", fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : "#19191B" }}>
                      {m}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
          {/* Day */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 6 }}>일</Text>
            <ScrollView showsHorizontalScrollIndicator={false}
              style={{ height: 200, borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {days.map((d) => {
                const sel = tempDay !== null && tempDay === d;
                return (
                  <AnimatedPressable
                    key={d}
                    onPress={() => setTempDay(d)}
                    scaleAmount={0.97}
                    opacityAmount={0.8}
                    style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: sel ? "#EEF2FF" : "transparent" }}
                  >
                    <Text style={{ fontSize: 15, textAlign: "center", fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : "#19191B" }}>
                      {d}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
        <View style={{ marginTop: 20 }}>
          <PrimaryButton label="선택 완료" onPress={handleBirthConfirm} disabled={tempYear === null || tempMonth === null || tempDay === null} />
        </View>
      </BottomSheet>

      {/* 성별 시트 */}
      <BottomSheet isOpen={showGenderSheet} onClose={() => setShowGenderSheet(false)} title="성별을 선택해주세요">
        <View style={{ gap: 4 }}>
          {(["남자", "여자"] as const).map((g) => {
            const sel = gender === g;
            return (
              <AnimatedPressable
                key={g}
                onPress={() => { setGender(g); setShowGenderSheet(false); }}
                scaleAmount={0.94}
                opacityAmount={0.8}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: sel ? "#EEF2FF" : "#FFFFFF",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 16, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "600" : "400" }}>{g}</Text>
                {sel && <Check size={20} color="#4261FF" />}
              </AnimatedPressable>
            );
          })}
        </View>
      </BottomSheet>

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

      {/* 약관 동의 시트 */}
      <BottomSheet
        isOpen={showTermsSheet}
        onClose={() => { setShowTermsSheet(false); setTermsModalId(null); }}
        title={termsModalId ? (termsContent[termsModalId]?.title ?? "약관 상세") : "약관 동의"}
      >
        {!termsModalId ? (
          /* ── 약관 목록 ── */
          <>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <AnimatedPressable
                onPress={toggleAll}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
                }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 4, borderWidth: 1.5,
                  borderColor: allAgreed ? "#4261FF" : "#DBDCDF",
                  backgroundColor: allAgreed ? "#4261FF" : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {allAgreed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B" }}>전체 약관 동의하기</Text>
              </AnimatedPressable>

              {TERMS.map((t) => {
                const checked = !!agreed[t.id];
                return (
                  <View key={t.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 4 }}>
                    <AnimatedPressable onPress={() => toggleTerm(t.id)} scaleAmount={0.97} opacityAmount={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }} hitSlop={4}>
                      <Check size={18} color={checked ? "#4261FF" : "#DBDCDF"} />
                      <Text style={{ fontSize: 15, color: "#19191B" }}>
                        {t.label}{" "}
                        <Text style={{ fontSize: 13, color: "#70737B" }}>({t.required ? "필수" : "선택"})</Text>
                      </Text>
                    </AnimatedPressable>
                    <AnimatedPressable onPress={() => setTermsModalId(t.id)} scaleAmount={0.97} opacityAmount={0.8} hitSlop={8}>
                      <ChevronRight size={16} color="#9EA3AD" />
                    </AnimatedPressable>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ marginTop: 20 }}>
              <PrimaryButton label="약관 동의하기" onPress={handleAgreeSubmit} disabled={!allRequiredAgreed} />
            </View>
          </>
        ) : (
          /* ── 약관 상세 ── */
          <>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8, gap: 20 }}>
              {(termsContent[termsModalId]?.sections ?? []).map((section, idx) => (
                <View key={idx}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B", marginBottom: 8 }}>{section.heading}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 24, color: "#70737B" }}>{section.body}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
              <AnimatedPressable
                onPress={() => setTermsModalId(null)}
                scaleAmount={0.97} opacityAmount={0.75}
                style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 }}
              >
                <ChevronLeft size={16} color="#70737B" />
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#70737B" }}>목록으로</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { toggleTerm(termsModalId); setTermsModalId(null); }}
                scaleAmount={0.97} opacityAmount={0.75}
                style={{ flex: 2, height: 52, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>동의하기</Text>
              </AnimatedPressable>
            </View>
          </>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>

    </>
  );
};

export default ProfileInfoScreen;
