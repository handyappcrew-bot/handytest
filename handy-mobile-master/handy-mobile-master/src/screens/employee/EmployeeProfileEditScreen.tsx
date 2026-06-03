import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  Image, KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import FocusInput from "@/components/FocusInput";

const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
import { formatPhone } from "@/utils/valid";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ChevronLeft, ChevronDown, ChevronRight, X, CheckCircle2, AlertCircle } from "lucide-react-native";
import Avatar from "@/components/Avatar";
import BottomSheet from "@/components/BottomSheet";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "@/components/Toast";
import { getMyEmployeeInfo, updateMyEmployeeInfo, deleteEmployeeProfileImage, deleteEmployeeDocument } from "@/api/employee";
import { localStorage } from "@/utils/storage";
import { getPhotoUrl } from "@/utils/image";
import { getShiftStyle } from "@/utils/shiftStyles";
import type { ScreenProps } from "@/navigation/types";

const ALL_BANKS = [
  "국민은행", "신한은행", "농협", "우리은행", "기업은행", "하나은행",
  "토스뱅크", "카카오뱅크", "새마을금고", "케이뱅크", "우체국", "SC제일은행",
  "IM뱅크", "부산은행", "광주은행", "경남은행", "신협", "산업은행",
  "수협은행", "한국씨티은행", "SBI저축은행", "제주은행", "전북은행", "산림조합중앙회",
];

const BANK_CELL_W = Math.floor((Dimensions.get("window").width - 40) / 3);

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
  "신협": require("../../../assets/images/banks/신협.png"),
  "산업은행": require("../../../assets/images/banks/산업은행.png"),
  "수협은행": require("../../../assets/images/banks/수협은행.png"),
  "한국씨티은행": require("../../../assets/images/banks/씨티은행.png"),
  "SBI저축은행": require("../../../assets/images/banks/sbi저축은행.png"),
  "경남은행": require("../../../assets/images/banks/부산은행.png"),
  "제주은행": require("../../../assets/images/banks/신한.png"),
  "전북은행": require("../../../assets/images/banks/광주은행.png"),
  "산림조합중앙회": require("../../../assets/images/banks/산림조합중앙회.png"),
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>{label}</Text>
    <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", flex: 1 }}>{value}</Text>
  </View>
);

const Divider = () => (
  <View style={{ width: "100%", height: 12, backgroundColor: "#F7F7F8" }} />
);


const EmployeeProfileEditScreen: React.FC<ScreenProps<"EmployeeProfileEdit">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const initial = route.params?.profileData ?? {};

  const [name, setName] = useState(initial.name ?? "");
  const [bank, setBank] = useState(initial.bank ?? "");
  const [accountNumber, setAccountNumber] = useState(initial.account_number ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(getPhotoUrl(initial.image_url));
  const [photoFile, setPhotoFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [resetImage, setResetImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sheet / dialog states
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showNameSheet, setShowNameSheet] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [accountInput, setAccountInput] = useState(accountNumber);
  const [showBankSheet, setShowBankSheet] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // 직접 진입 또는 params 없을 때 API로 보완
  useEffect(() => {
    if (initial.name || initial.bank || initial.account_number) return;
    const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
    if (!storeId) return;
    getMyEmployeeInfo(storeId).then((res: any) => {
      if (!res) return;
      setName(res.name ?? "");
      setBank(res.bank ?? "");
      setAccountNumber(res.account_number ?? "");
      setNameInput(res.name ?? "");
      setAccountInput(res.account_number ?? "");
      setPhotoUri(getPhotoUrl(res.image_url));
      setDocumentItems((prev) => prev.map((d) => ({
        ...d,
        fileName: res[d.key] ?? null,
        uploaded: res[d.key] != null,
      })));
    }).catch((e) => console.warn(e));
  }, []);

  const socialProvider = localStorage.getItem("socialProvider");

  const isDirty =
    name !== (initial.name ?? "") ||
    bank !== (initial.bank ?? "") ||
    accountNumber !== (initial.account_number ?? "") ||
    photoFile !== null ||
    resetImage;

  const handleBack = () => {
    if (isDirty) setCancelConfirmOpen(true);
    else navigation.goBack();
  };

  // Document items
  const [documentItems, setDocumentItems] = useState([
    { label: "이력서", key: "resume", fileName: initial.resume ?? null, uploaded: initial.resume != null, file: null as { uri: string; name: string; type: string } | null },
    { label: "근로계약서", key: "employment_contract", fileName: initial.employment_contract ?? null, uploaded: initial.employment_contract != null, file: null as { uri: string; name: string; type: string } | null },
    { label: "보건증", key: "health_certificate", fileName: initial.health_certificate ?? null, uploaded: initial.health_certificate != null, file: null as { uri: string; name: string; type: string } | null },
  ]);
  const [showDocSheet, setShowDocSheet] = useState(false);
  const [docUploadIndex, setDocUploadIndex] = useState<number | null>(null);
  const [deleteDocDialog, setDeleteDocDialog] = useState(false);
  const [deleteDocIndex, setDeleteDocIndex] = useState<number | null>(null);

  const allSubmitted = documentItems.every((d) => d.uploaded);
  const isFormValid = name.trim() !== "" && bank.trim() !== "" && accountNumber.trim() !== "";

  const contract = {
    employmentType: initial.employee_type ?? "",
    joinDate: initial.joined_at ?? "",
    joinDays: initial.days_since_joined ?? 0,
    probation: initial.is_probation ? "수습 적용" : "수습 미적용",
    salaryType: initial.salary_cycle ?? "",
    salaryDay: initial.salary_day != null ? `${initial.salary_day}일` : "",
    hourlyWage: initial.hourly_rate != null ? `${initial.hourly_rate.toLocaleString()}원` : "",
  };

  const formatRate = (value: number | null) => (value != null ? `(${value}%)` : "");
  const tax = {
    incomeTax: [
      { label: "소득세", rate: formatRate(initial.income_tax) },
      { label: "지방소득세", rate: formatRate(initial.local_income_tax) },
    ],
    insurance: [
      { label: "국민연금", rate: formatRate(initial.national_pension_tax) },
      { label: "건강보험", rate: formatRate(initial.health_insurance_tax) },
      { label: "장기요양보험", rate: formatRate(initial.long_term_care_tax) },
      { label: "고용보험", rate: formatRate(initial.employment_insurance_tax) },
      { label: "산재보험", rate: formatRate(initial.industrial_accident_tax) },
    ],
  };

  const pickDocFromAlbum = async () => {
    setShowDocSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!res.canceled && res.assets[0] && docUploadIndex !== null) {
      const a = res.assets[0];
      const fileEntry = { uri: a.uri, name: a.fileName ?? "doc.jpg", type: a.mimeType ?? "image/jpeg" };
      setDocumentItems((prev) =>
        prev.map((item, i) =>
          i === docUploadIndex ? { ...item, fileName: fileEntry.name, uploaded: true, file: fileEntry } : item
        )
      );
      setDocUploadIndex(null);
    }
  };

  const pickDocFromCamera = async () => {
    setShowDocSheet(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0] && docUploadIndex !== null) {
      const a = res.assets[0];
      const fileEntry = { uri: a.uri, name: a.fileName ?? "doc.jpg", type: a.mimeType ?? "image/jpeg" };
      setDocumentItems((prev) =>
        prev.map((item, i) =>
          i === docUploadIndex ? { ...item, fileName: fileEntry.name, uploaded: true, file: fileEntry } : item
        )
      );
      setDocUploadIndex(null);
    }
  };

  const handleDeleteDocument = async () => {
    if (deleteDocIndex === null) return;
    const doc = documentItems[deleteDocIndex];
    const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
    // server-stored file: call DELETE API; locally-picked file: no API call needed
    if (doc.file === null && doc.uploaded) {
      try {
        await deleteEmployeeDocument(doc.key, storeId);
      } catch {
        // proceed with local state clear regardless
      }
    }
    setDocumentItems((prev) =>
      prev.map((item, i) =>
        i === deleteDocIndex ? { ...item, fileName: null, uploaded: false, file: null } : item
      )
    );
    setDeleteDocDialog(false);
    setDeleteDocIndex(null);
  };

  const handleEditConfirm = async () => {
    setEditConfirmOpen(false);
    if (submitting) return;
    setSubmitting(true);
    try {
      const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
      if (resetImage) {
        await deleteEmployeeProfileImage(storeId).catch((e) => console.warn(e));
      }
      const docFile = (key: string) => documentItems.find((d) => d.key === key)?.file ?? undefined;
      await updateMyEmployeeInfo({
        name,
        bank,
        account_number: accountNumber,
        store_id: storeId,
        image: photoFile ?? undefined,
        resume: docFile("resume"),
        employment_contract: docFile("employment_contract"),
        health_certificate: docFile("health_certificate"),
      });
      toast({ description: "내 정보가 수정되었어요." });
      navigation.goBack();
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "수정에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={handleBack} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>내 정보 수정</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>

          {/* Profile Card */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 24 }}>
            <AnimatedPressable onPress={() => setShowPhotoSheet(true)} scaleAmount={0.95} opacityAmount={0.8} style={{ position: "relative", flexShrink: 0 }}>
              <Avatar imageUrl={photoUri} name={name} size={80} defaultSource={STAFF_ICON} />
              <View style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", lineHeight: 18 }}>+</Text>
              </View>
            </AnimatedPressable>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B" }}>{name}</Text>
                <Text style={{ fontSize: 16, color: "#70737B" }}>{contract.employmentType}</Text>
              </View>
              <View style={{ marginTop: 4, alignSelf: "flex-start", height: 28, paddingHorizontal: 10, borderRadius: 4, backgroundColor: "rgba(66,97,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#4261FF" }}>
                  {initial.store_name ?? "매장"} 입사 +{contract.joinDays}일
                </Text>
              </View>
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
                  style={{
                    flex: 1, height: 44, borderRadius: 8, borderWidth: 1,
                    borderColor: "#EBEBEB", paddingHorizontal: 12,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{name}</Text>
                </AnimatedPressable>
              </View>

              <InfoRow label="생년월일" value={initial.birth ? `${initial.birth}${initial.age != null ? ` (${initial.age}세)` : ""}` : "-"} />
              <InfoRow label="성별" value={initial.gender ?? "-"} />
              <InfoRow label="전화번호" value={initial.phone ? formatPhone(initial.phone) : "-"} />

              {/* 은행 — editable */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0 }}>은행</Text>
                <AnimatedPressable
                  onPress={() => setShowBankSheet(true)}
                  scaleAmount={0.98}
                  opacityAmount={0.85}
                  style={{
                    flex: 1, height: 44, borderRadius: 8, borderWidth: 1,
                    borderColor: !bank ? "#FF3D3D" : "#EBEBEB",
                    paddingHorizontal: 12, flexDirection: "row",
                    alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: bank ? "#19191B" : "#FF3D3D" }}>{bank || "미선택"}</Text>
                  <ChevronDown size={20} color="#70737B" />
                </AnimatedPressable>
              </View>

              {/* 계좌번호 — editable */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0 }}>계좌번호</Text>
                <AnimatedPressable
                  onPress={() => { setAccountInput(accountNumber); setShowAccountSheet(true); }}
                  scaleAmount={0.98}
                  opacityAmount={0.85}
                  style={{
                    flex: 1, height: 44, borderRadius: 8, borderWidth: 1,
                    borderColor: !accountNumber ? "#FF3D3D" : "#EBEBEB",
                    paddingHorizontal: 12, justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "500", color: accountNumber ? "#19191B" : "#FF3D3D" }}>
                    {accountNumber || "미입력"}
                  </Text>
                </AnimatedPressable>
              </View>

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
            </View>
          </View>

          <Divider />

          {/* 계약 정보 */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginBottom: 16 }}>계약 정보</Text>
            <View style={{ gap: 12 }}>
              <InfoRow label="고용형태" value={contract.employmentType || "-"} />
              <InfoRow label="입사일" value={contract.joinDate ? `${contract.joinDate} (+${contract.joinDays}일)` : "-"} />
              <InfoRow label="수습" value={contract.probation} />
              <InfoRow label="급여주기" value={contract.salaryType || "-"} />
              <InfoRow label="시급" value={contract.hourlyWage || "-"} />
              <InfoRow label="급여일" value={contract.salaryDay || "-"} />
              {Array.isArray(initial.schedule) && initial.schedule.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>근무일</Text>
                  <View style={{ flex: 1, gap: 8 }}>
                    {initial.schedule.map((s: { day: string; time: string; tags: string[] }, i: number) => (
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
                  {tax.incomeTax.map((item) => (
                    <Text key={item.label} style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                      {item.label} <Text style={{ fontWeight: "400", color: "#70737B" }}>{item.rate}</Text>
                    </Text>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0, paddingTop: 2 }}>4대 보험</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  {tax.insurance.map((item) => (
                    <Text key={item.label} style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>
                      {item.label} <Text style={{ fontWeight: "400", color: "#70737B" }}>{item.rate}</Text>
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
                {allSubmitted
                  ? <CheckCircle2 size={20} color="#22C55E" />
                  : <AlertCircle size={20} color="#EF4444" />}
                <Text style={{ fontSize: 14, fontWeight: "500", color: allSubmitted ? "#22C55E" : "#EF4444" }}>
                  {allSubmitted ? "필수 계약서 제출 완료" : "필수 계약서 제출 미완료"}
                </Text>
              </View>
            </View>
            <View style={{ gap: 12 }}>
              {documentItems.map((doc, idx) => (
                <View key={doc.label} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", width: 100, flexShrink: 0 }}>{doc.label}</Text>
                  {doc.uploaded && doc.fileName ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: "#4261FF", flex: 1 }} numberOfLines={1}>{doc.fileName}</Text>
                      <AnimatedPressable
                        onPress={() => { setDeleteDocIndex(idx); setDeleteDocDialog(true); }}
                        scaleAmount={0.88} opacityAmount={0.7}
                        style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF0EE", alignItems: "center", justifyContent: "center" }}>
                        <X size={15} color="#FF5959" />
                      </AnimatedPressable>
                    </View>
                  ) : (
                    <AnimatedPressable
                      onPress={() => { setDocUploadIndex(idx); setShowDocSheet(true); }}
                      scaleAmount={0.96}
                      opacityAmount={0.75}
                      style={{
                        flex: 1, height: 44, borderRadius: 8, borderWidth: 1,
                        borderColor: "#EBEBEB", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{doc.label} 업로드하기</Text>
                    </AnimatedPressable>
                  )}
                </View>
              ))}
            </View>
          </View>

          <Divider />

          {/* 회원탈퇴 */}
          <View style={{ paddingHorizontal: 20 }}>
            <AnimatedPressable
              onPress={() => navigation.navigate("Withdrawal")}
              scaleAmount={0.97}
              opacityAmount={0.8}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 }}
            >
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>회원탈퇴</Text>
              <ChevronRight size={20} color="#70737B" />
            </AnimatedPressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Save Button */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 24 : 16, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
        <AnimatedPressable
          onPress={() => { if (isFormValid && !submitting) setEditConfirmOpen(true); }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{
            height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
            backgroundColor: isFormValid ? "#4261FF" : "#DBDCDF",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
            {submitting ? "저장 중..." : "수정하기"}
          </Text>
        </AnimatedPressable>
      </View>

      {/* Photo Sheet */}
      <ImagePickerSheet
        isOpen={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        onAlbum={async () => {
          setShowPhotoSheet(false);
          await new Promise<void>((resolve) => setTimeout(resolve, 350));
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsEditing: true, aspect: [1, 1] });
          if (!res.canceled && res.assets[0]) {
            const a = res.assets[0];
            setPhotoUri(a.uri);
            setPhotoFile({ uri: a.uri, name: a.fileName ?? "profile.jpg", type: a.mimeType ?? "image/jpeg" });
            setResetImage(false);
          }
        }}
        onReset={() => {
          setResetImage(true);
          setPhotoUri(null);
          setPhotoFile(null);
          setShowPhotoSheet(false);
        }}
      />

      {/* Name Sheet */}
      <BottomSheet isOpen={showNameSheet} onClose={() => setShowNameSheet(false)} title="이름 입력하기">
        <TextInput
          value={nameInput}
          onChangeText={setNameInput}
          placeholder="이름 입력"
          placeholderTextColor="#AAB4BF"
          style={{ height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#EBEBEB", paddingHorizontal: 16, fontSize: 16, color: "#19191B", outline: "none", boxShadow: "none" } as any}
        />
        <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: "#4261FF" }}>닉네임을 사용할 경우 '닉네임(이름)' 형식으로 작성해주세요</Text>
        <Text style={{ fontSize: 13, color: "#19191B" }}>예) 핸디(홍길동)</Text>
        <AnimatedPressable
          onPress={() => { if (nameInput.trim()) { setName(nameInput.trim()); setShowNameSheet(false); } }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ marginTop: 24, paddingVertical: 16, borderRadius: 12, alignItems: "center", backgroundColor: nameInput.trim() ? "#4261FF" : "#DBDCDF" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
        </AnimatedPressable>
      </BottomSheet>

      {/* Account Sheet */}
      <BottomSheet isOpen={showAccountSheet} onClose={() => setShowAccountSheet(false)} title="계좌번호 입력하기">
        <View style={{ gap: 16 }}>
          <FocusInput
            value={accountInput}
            onChangeText={(t) => setAccountInput(t.replace(/[^0-9-]/g, ""))}
            placeholder="'-' 포함 입력"
            placeholderTextColor="#AAB4BF"
            keyboardType="default"
            style={[{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", outline: "none", boxShadow: "none" } as any]}
          />
          <AnimatedPressable
            onPress={() => { if (accountInput.trim()) { setAccountNumber(accountInput.trim()); setShowAccountSheet(false); } }}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: accountInput.trim() ? "#4261FF" : "#DBDCDF" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

      {/* Bank Sheet */}
      <BottomSheet isOpen={showBankSheet} onClose={() => setShowBankSheet(false)} title="은행을 선택해주세요">
        <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {ALL_BANKS.map((b) => {
              const sel = bank === b;
              const logo = BANK_LOGOS[b];
              return (
                <AnimatedPressable
                  key={b}
                  onPress={() => { setBank(b); setShowBankSheet(false); }}
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

      {/* Document Upload Sheet */}
      <ImagePickerSheet
        isOpen={showDocSheet}
        onClose={() => setShowDocSheet(false)}
        title={docUploadIndex !== null ? `${documentItems[docUploadIndex]?.label} 업로드하기` : "업로드하기"}
        onAlbum={pickDocFromAlbum}
        onCamera={pickDocFromCamera}
      />

      {/* Delete Document Dialog */}
      <ConfirmDialog
        visible={deleteDocDialog}
        onClose={() => setDeleteDocDialog(false)}
        title="계약서 삭제"
        description={"계약서를 삭제하시겠어요?\n해당 계약서는 필수 계약서로\n삭제 시 사장님이 열람할 수 없어요"}
        buttons={[
          { label: "취소", onPress: () => setDeleteDocDialog(false), variant: "cancel" },
          { label: "삭제하기", onPress: handleDeleteDocument, variant: "danger" },
        ]}
      />

      {/* Edit Confirm Dialog */}
      <ConfirmDialog
        visible={editConfirmOpen}
        onClose={() => setEditConfirmOpen(false)}
        title="회원정보 수정"
        description="회원정보를 수정하시겠어요?"
        buttons={[
          { label: "취소", onPress: () => setEditConfirmOpen(false), variant: "cancel" },
          { label: "수정하기", onPress: handleEditConfirm, variant: "confirm" },
        ]}
      />

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        visible={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="수정 취소"
        description={"수정 중인 내용이 저장되지 않아요.\n정말 취소하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setCancelConfirmOpen(false), variant: "cancel" },
          { label: "확인", onPress: () => { setCancelConfirmOpen(false); navigation.goBack(); } },
        ]}
      />
    </SafeAreaView>
  );
};

export default EmployeeProfileEditScreen;
