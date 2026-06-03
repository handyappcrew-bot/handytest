import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
import { View, Text, ScrollView, Pressable, Share, TextInput } from "react-native";
import { ChevronLeft, Edit2, Share2 } from "lucide-react-native";
import { formatPhone } from "@/utils/valid";
import BottomSheet from "@/components/BottomSheet";
import AnimatedPressable from "@/components/AnimatedPressable";
import ConfirmDialog from "@/components/ConfirmDialog";
import FadeScreen from "@/components/FadeScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/Avatar";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import { getMemberRequests, acceptMemberRequest, rejectMemberRequest, updateStaffContract } from "@/api/owner";
import { getCachedStaffList, getCachedStoreInfo } from "@/utils/cachedApi";
import { badgeEvents } from "@/utils/badgeEvents";
import { getShiftStyle, inferShiftName, StoreShift } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import { useToast } from "@/components/Toast";
import type { ScreenProps } from "@/navigation/types";

interface StaffRow {
  id: number;
  name: string;
  phone: string;
  gender?: string;
  age?: number;
  birth?: string;
  image_url?: string;
  is_new?: boolean;
  work_status?: string;
  hire_date?: string;
  hire_days_ago?: number;
  contract?: {
    employee_type?: string;
    salary_type?: string;
    hourly_rate?: number;
    monthly_salary?: number;
    annual_salary?: number;
    salary_cycle?: string;
    working_status?: string;
    pay_day?: string;
    memo?: string;
    work_days?: string;
    work_schedule?: Array<{ day?: string; time?: string; part_name?: string; start_time?: string; shift_id?: number }>;
  };
}

interface MemberRequest {
  id: number;
  name: string;
  phone: string;
  birth?: string;
  gender?: string;
  bank?: string;
  account_number?: string;
  created_at?: string;
}

const resolveShifts = (s: StaffRow, shifts: StoreShift[]): string[] =>
  [...new Set(
    (s.contract?.work_schedule ?? []).map((ws) => {
      if (ws.part_name) return ws.part_name;
      if (ws.shift_id) {
        const found = (shifts as any[]).find((sf) => sf.id === ws.shift_id);
        if (found?.name) return found.name;
      }
      if (ws.start_time) return inferShiftName(ws.start_time, shifts) || undefined;
      return undefined;
    }).filter(Boolean)
  )] as string[];

const calcAge = (birth?: string): number | null => {
  if (!birth) return null;
  const cleaned = birth.replace(/\./g, "-");
  const b = new Date(cleaned);
  if (isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age > 0 ? age : null;
};

type FilterType = string;

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

const mapGender = (g?: string): string => {
  if (!g) return "";
  if (["male", "M", "m", "남자", "남"].includes(g)) return "남자";
  if (["female", "F", "f", "여자", "여"].includes(g)) return "여자";
  return g;
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr.replace(" ", "T"));
  if (isNaN(date.getTime())) return dateStr;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
};

const addCommas = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const formatWage = (amount: number, type?: string): string => {
  if (type === "월급" || type === "연봉") {
    return `${Math.round(amount / 10000)}만원`;
  }
  if (amount >= 100000) {
    return `${Math.round(amount / 10000)}만원`;
  }
  return `${addCommas(amount)}원`;
};

const mapApiStaff = (s: any): StaffRow => {
  const topSchedule =
    (s.work_schedule ?? []).map((ws: any) => ({
      day: DAY_NAMES[ws.day_of_week] ?? "",
      time: ws.start_time && ws.end_time ? `${ws.start_time} ~ ${ws.end_time}` : undefined,
      part_name: ws.shift_name ?? undefined,
      start_time: ws.start_time ?? undefined,
      shift_id: ws.shift_id ?? undefined,
    }));
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    gender: ["male", "M", "m", "남자", "남"].includes(s.gender) ? "남자" : ["female", "F", "f", "여자", "여"].includes(s.gender) ? "여자" : (s.gender ?? ""),
    birth: s.birth,
    image_url: s.image_url,
    is_new: s.contract?.working_status === "신규",
    work_status: s.contract?.working_status ?? "",
    hire_date: s.joined_at ? String(s.joined_at).slice(0, 10) : undefined,
    hire_days_ago: s.joined_at
      ? Math.floor((Date.now() - new Date(s.joined_at).getTime()) / 86400000)
      : undefined,
    contract: s.contract
      ? {
          employee_type: s.contract.employee_type,
          salary_type: s.contract.salary_type
            ?? (s.contract.annual_salary ? "연봉" : s.contract.hourly_rate ? "시급" : s.contract.monthly_salary ? "월급" : ""),
          hourly_rate: s.contract.hourly_rate,
          monthly_salary: s.contract.monthly_salary,
          annual_salary: s.contract.annual_salary,
          salary_cycle: s.contract.salary_cycle,
          working_status: s.contract.working_status,
          pay_day: s.contract.salary_day,
          memo: s.contract.memo,
          work_schedule: topSchedule.length > 0 ? topSchedule : (s.contract.work_schedule ?? []),
        }
      : undefined,
  };
};


const OwnerStaffManagementScreen: React.FC<ScreenProps<"OwnerStaffManagement">> = ({ navigation, route }) => {
  const { toast } = useToast();
  const [staffs, setStaffs] = useState<StaffRow[]>([]);
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [tab, setTab] = useState<"관리" | "가입요청" | "초대">(route.params?.initialTab ?? "관리");
  const [activeFilter, setActiveFilter] = useState<FilterType>("전체");
  const [storeCode, setStoreCode] = useState<string>("");
  const [storeShifts, setStoreShifts] = useState<StoreShift[]>([]);
  const [confirmPopup, setConfirmPopup] = useState<{ open: boolean; type: "accept" | "reject"; requestId: number }>({ open: false, type: "accept", requestId: 0 });
  const [memoSheetOpen, setMemoSheetOpen] = useState(false);
  const [memoSheetStaffId, setMemoSheetStaffId] = useState<number | null>(null);
  const [memoInput, setMemoInput] = useState("");
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const load = () => {
    if (!storeId) return;
    getCachedStaffList(storeId)
      .then((rows: any) => setStaffs((rows ?? []).map(mapApiStaff)))
      .catch(() => setStaffs([]));
    getMemberRequests(storeId)
      .then((rows: any) => setRequests(rows ?? []))
      .catch(() => setRequests([]));
  };

  useFocusEffect(useCallback(() => { load(); }, [storeId]));
  useEffect(() => {
    if (!storeId) return;
    getCachedStoreInfo(storeId).then((info: any) => {
      setStoreCode(info?.code ?? "");
      setStoreShifts(info?.shifts ?? []);
    }).catch((e) => console.warn(e));
  }, [storeId]);

  const handleInvite = async () => {
    try {
      await Share.share({
        message: `Handy Staff 매장에 합류하세요!\n매장 코드: ${storeCode || "(미설정)"}\n앱에서 가입 후 매장 코드를 입력하면 가입 요청이 보내져요.`,
      });
    } catch {
      // 사용자 취소
    }
  };

  const handleConfirm = async () => {
    const { type, requestId } = confirmPopup;
    try {
      if (type === "accept") await acceptMemberRequest(storeId, requestId);
      else await rejectMemberRequest(storeId, requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      badgeEvents.emit();
      load();
      toast({ description: type === "accept" ? "가입 요청을 승인했어요" : "가입 요청을 거절했어요" });
      if (type === "accept") setTimeout(() => setTab("관리"), 300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "처리에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    }
    setConfirmPopup({ open: false, type: "accept", requestId: 0 });
  };

  const hasJoinRequests = requests.length > 0;

  const shiftFilterNames = storeShifts.length > 0
    ? storeShifts.filter((s: any) => s.is_active !== false).map((s: any) => s.name)
    : ["오픈", "미들", "마감"];
  const allFilters = ["전체", ...shiftFilterNames];

  const isHiddenStaff = (s: StaffRow) =>
    s.work_status === "앱탈퇴" || s.contract?.working_status === "앱탈퇴" ||
    s.work_status === "퇴사"   || s.contract?.working_status === "퇴사";

  const filterCounts: Record<string, number> = Object.fromEntries(
    allFilters.map((f) => [
      f,
      f === "전체"
        ? staffs.filter((s) => !isHiddenStaff(s)).length
        : staffs.filter((s) => !isHiddenStaff(s) && resolveShifts(s, storeShifts).includes(f)).length,
    ])
  );

  const isNewStaff = (s: StaffRow) => {
    const isGhost = s.work_status === "앱탈퇴" || s.contract?.working_status === "앱탈퇴";
    // hire_date(joined_at)는 가입 즉시 세팅되므로 계약 존재 여부 판단에서 제외
    const hasContract = !!(s.contract?.salary_type || s.contract?.hourly_rate || s.contract?.monthly_salary || s.contract?.annual_salary);
    return s.is_new === true || s.work_status === "신규" || s.contract?.working_status === "신규" || (!hasContract && !isGhost);
  };

  const filteredStaffs = (activeFilter === "전체"
    ? staffs.filter((s) => !isHiddenStaff(s))
    : staffs.filter((s) => !isHiddenStaff(s) && resolveShifts(s, storeShifts).includes(activeFilter))
  ).slice().sort((a, b) => (isNewStaff(b) ? 1 : 0) - (isNewStaff(a) ? 1 : 0));

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8" }} edges={["top"]}>
      {/* Header */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>직원 관리</Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", paddingHorizontal: 20, gap: 24 }}>
          {(["관리", "가입요청", "초대"] as const).map((t) => {
            const isActive = tab === t;
            const label = t === "관리" ? "직원 관리"
              : t === "가입요청" ? `가입 요청 ${requests.length}건`
              : "직원 초대하기";
            return (
              <AnimatedPressable key={t} onPress={() => setTab(t)} style={{ paddingVertical: 12, position: "relative" }} hitSlop={4} scaleAmount={0.95} opacityAmount={0.8}>
                {t === "가입요청" && hasJoinRequests && (
                  <View style={{ position: "absolute", top: 10, left: -6, width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF3D3D" }} />
                )}
                <Text style={{ fontSize: 16, fontWeight: isActive ? "700" : "500", letterSpacing: -0.32, color: isActive ? "#4261FF" : "#AAB4BF" }}>
                  {label}
                </Text>
                {isActive && (
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, borderRadius: 99, backgroundColor: "#4261FF" }} />
                )}
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {/* 직원 관리 탭 */}
      {tab === "관리" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* 필터 칩 */}
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}
          >
            {allFilters.map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <AnimatedPressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  scaleAmount={0.95}
                  opacityAmount={0.8}
                  style={{
                    height: 28,
                    borderRadius: 9999,
                    paddingHorizontal: 14,
                    backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: isActive ? "#4261FF" : "#DBDCDF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: isActive ? "#4261FF" : "#AAB4BF", letterSpacing: -0.28 }}>
                    {filter} {filterCounts[filter]}명
                  </Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>

          {filteredStaffs.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Text style={{ fontSize: 14, color: "#9EA3AD" }}>등록된 직원이 없어요</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {filteredStaffs.map((s) => {
                const shifts = resolveShifts(s, storeShifts);
                const workDays = [...new Set((s.contract?.work_schedule ?? []).map(ws => ws.day).filter(Boolean))].join(", ");
                const isGhost = s.work_status === "앱탈퇴" || s.contract?.working_status === "앱탈퇴";
                const hasContract = !!(s.contract?.salary_type || s.contract?.hourly_rate || s.contract?.monthly_salary || s.contract?.annual_salary);
                const isNew = s.is_new === true || s.work_status === "신규" || s.contract?.working_status === "신규" || (!hasContract && !isGhost);
                const isLeave = s.work_status === "휴직" || s.contract?.working_status === "휴직";
                const isResigned = !isGhost && (s.work_status === "퇴사" || s.contract?.working_status === "퇴사");
                const CYCLE_LABEL: Record<string, string> = {
                  hourly: "시급", daily: "일급", monthly: "월급",
                  시급: "시급", 일급: "일급", 월급: "월급",
                  "월 1회 (월급)": "월급", "주급": "주급", "월 2회": "월급",
                };
                const wageLabel = CYCLE_LABEL[s.contract?.salary_cycle ?? ""] ?? (s.contract?.salary_type ?? "시급");

                // 카드 스타일 (웹앱 기준)
                const displayGender = ["male", "M", "m", "남자", "남"].includes(s.gender ?? "") ? "남자"
                  : ["female", "F", "f", "여자", "여"].includes(s.gender ?? "") ? "여자"
                  : (s.gender ?? "");
                const displayAge = s.age ?? calcAge(s.birth);

                const cardBorderWidth = isNew ? 2 : isGhost ? 1.5 : 0;
                const cardBorderColor = isNew ? "#4261FF" : isGhost ? "#C8CDD6" : "transparent";
                const cardBorderStyle: "dashed" | "solid" = isGhost ? "dashed" : "solid";
                const cardShadowColor = isNew ? "#4261FF" : "#000";
                const cardShadowOpacity = isNew ? 0.15 : isGhost ? 0 : 0.06;
                const cardShadowRadius = isNew ? 16 : 12;
                const cardBg = isNew ? "#F5F7FF" : isGhost ? "#F7F8FA" : "#FFFFFF";

                return (
                  <AnimatedPressable
                    key={s.id}
                    onPress={() => navigation.navigate("OwnerStaffDetail", { staffId: s.id })}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: 16,
                      padding: 16,
                      shadowColor: cardShadowColor,
                      shadowOpacity: cardShadowOpacity,
                      shadowRadius: cardShadowRadius,
                      shadowOffset: { width: 2, height: 2 },
                      elevation: cardShadowOpacity > 0 ? 2 : 0,
                      opacity: isGhost ? 0.6 : isResigned ? 0.55 : isLeave ? 0.75 : 1,
                      borderWidth: cardBorderWidth,
                      borderColor: cardBorderColor,
                      borderStyle: cardBorderStyle as any,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 20 }}>
                      {/* Avatar column */}
                      <View style={{ alignItems: "center", minWidth: 60 }}>
                        <View style={{ position: "relative" }}>
                          <Avatar
                            name={s.name}
                            imageUrl={s.image_url}
                            size={60}
                            bgColor={isGhost ? "#B0B8C1" : undefined}
                            defaultSource={STAFF_ICON}
                          />
                          {isLeave && !isNew && (
                            <View style={{ position: "absolute", bottom: -4, left: 0, right: 0, alignItems: "center" }}>
                              <View style={{ backgroundColor: "#FF9800", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>휴직</Text>
                              </View>
                            </View>
                          )}
                          {isResigned && !isNew && (
                            <View style={{ position: "absolute", bottom: -4, left: 0, right: 0, alignItems: "center" }}>
                              <View style={{ backgroundColor: "#70737B", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>퇴사</Text>
                              </View>
                            </View>
                          )}
                          {isNew && (
                            <View style={{ position: "absolute", bottom: -4, left: 0, right: 0, alignItems: "center" }}>
                              <View style={{ backgroundColor: "#4261FF", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>신규</Text>
                              </View>
                            </View>
                          )}
                          {isGhost && !isNew && (
                            <View style={{ position: "absolute", bottom: -4, left: 0, right: 0, alignItems: "center" }}>
                              <View style={{ backgroundColor: "#70737B", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>앱탈퇴</Text>
                              </View>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: isNew ? "#4261FF" : isGhost ? "#70737B" : "#19191B", marginTop: 10, textAlign: "center" }}>{s.name}</Text>
                        {isNew ? (
                          <View style={{ marginTop: 4, backgroundColor: "rgba(66,97,255,0.1)", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#4261FF" }}>신규 직원</Text>
                          </View>
                        ) : isGhost ? (
                          <View style={{ marginTop: 4, backgroundColor: "#EAECEF", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#70737B" }}>앱 탈퇴</Text>
                          </View>
                        ) : isResigned ? (
                          <View style={{ marginTop: 4, backgroundColor: "#F0F0F2", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#70737B" }}>퇴사</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 12, fontWeight: "500", color: "#9EA3AD", textAlign: "center", marginTop: 2 }}>
                            {`(${[displayGender, displayAge ? `${displayAge}세` : null, s.contract?.employee_type].filter(Boolean).join(" · ")})`}
                          </Text>
                        )}
                      </View>

                      {/* Info column */}
                      <View style={{ flex: 1 }}>
                        {isGhost ? (
                          <View style={{ flex: 1, justifyContent: "center", gap: 10, paddingTop: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>직원이 앱을 탈퇴했어요</Text>
                            <Text style={{ fontSize: 12, color: "#9EA3AD", lineHeight: 18 }}>{"급여 지급 내역 등을 확인한 후\n퇴사 처리를 완료해주세요"}</Text>
                            <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, height: 28, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#EAECEF" }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#70737B" }}>퇴사 처리하기 →</Text>
                            </View>
                          </View>
                        ) : isNew ? (
                          <View style={{ flex: 1, justifyContent: "center", gap: 8, paddingTop: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF" }}>가입 요청이 수락된 신규 직원이에요</Text>
                            <Text style={{ fontSize: 12, color: "#70737B", lineHeight: 18 }}>{"고용형태 · 급여 · 근무일을\n등록해야 급여 계산이 시작돼요"}</Text>
                            <View style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 10, borderRadius: 6, backgroundColor: "#4261FF", justifyContent: "center" }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>계약 정보 등록하기 →</Text>
                            </View>
                          </View>
                        ) : (
                          <View>
                            {/* 파트 태그 */}
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: shifts.length > 0 ? 8 : 0 }}>
                              {shifts.map((shift) => {
                                const style = getShiftStyle(shift, storeShifts);
                                return (
                                  <View key={shift} style={{ backgroundColor: style.bg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: style.text }}>{shift}</Text>
                                  </View>
                                );
                              })}
                            </View>
                            <View style={{ gap: 6 }}>
                              <View style={{ flexDirection: "row", gap: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", flexShrink: 0 }}>근무일</Text>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flex: 1 }}>{workDays || "-"}</Text>
                              </View>
                              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", flexShrink: 0 }}>입사일</Text>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>
                                  {s.hire_date ? s.hire_date.replace(/-/g, ".") : "-"}
                                </Text>
                                {s.hire_days_ago != null && (
                                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#4261FF" }}>(+{s.hire_days_ago}일)</Text>
                                )}
                              </View>
                              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", flexShrink: 0 }}>
                                  {s.contract?.salary_type || wageLabel}
                                </Text>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>
                                  {(() => {
                                    const type = s.contract?.salary_type;
                                    if (type === "연봉") {
                                      return s.contract?.annual_salary ? formatWage(s.contract.annual_salary, "연봉") : "-";
                                    }
                                    if (type === "월급") {
                                      return s.contract?.monthly_salary ? formatWage(s.contract.monthly_salary, "월급") : "-";
                                    }
                                    return s.contract?.hourly_rate ? formatWage(s.contract.hourly_rate, "시급") : "-";
                                  })()}
                                </Text>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", flexShrink: 0 }}>급여일</Text>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", flexShrink: 0 }}>{s.contract?.pay_day || "-"}</Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Memo row */}
                    <AnimatedPressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setMemoSheetStaffId(s.id);
                        setMemoInput(s.contract?.memo ?? "");
                        setMemoSheetOpen(true);
                      }}
                      scaleAmount={0.97}
                      opacityAmount={0.75}
                      style={{ marginTop: 10, backgroundColor: "#FFFFFF", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#DBDCDF" }}
                    >
                      <Text style={{ fontSize: 14, color: s.contract?.memo ? "#19191B" : "#9EA3AD" }}>
                        {s.contract?.memo || "메모를 입력해주세요"}
                      </Text>
                      <Edit2 size={16} color="#AAB4BF" />
                    </AnimatedPressable>
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* 가입 요청 탭 */}
      {tab === "가입요청" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 120 }}>
          {requests.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>가입 요청한 직원이 없어요</Text>
              <Text style={{ fontSize: 13, color: "#9EA3AD", textAlign: "center", lineHeight: 20 }}>{"직원을 초대해서 관리를 시작해보세요"}</Text>
              <AnimatedPressable
                onPress={() => setTab("초대")}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ marginTop: 4, height: 44, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>초대하기</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <>
              <View style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 14, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F3FF", borderWidth: 1, borderColor: "#4261FF", marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>전체 {requests.length}명</Text>
              </View>
              <View style={{ gap: 12 }}>
                {requests.map((req) => (
                  <View key={req.id} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", paddingTop: 16, paddingHorizontal: 16 }}>
                      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#AAB4BF", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>{req.name.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <View style={{ width: 52, height: 21, backgroundColor: "#E8F3FF", borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 12, fontWeight: "500", color: "#4261FF" }}>가입 요청</Text>
                          </View>
                          {req.created_at && (
                            <Text style={{ fontSize: 12, fontWeight: "500", color: "#AAB4BF" }}>{formatRelativeTime(req.created_at)}</Text>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                          <Text style={{ fontSize: 16, fontWeight: "600", color: "#292B2E", letterSpacing: -0.32 }}>{req.name}</Text>
                          {req.gender && (
                            <Text style={{ fontSize: 14, color: "#70737B", marginLeft: 8 }}>{mapGender(req.gender)}</Text>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginTop: 12, marginHorizontal: 16 }} />

                    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                      {req.birth && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: "500", color: "#292B2E", width: 56 }}>생년월일</Text>
                          <Text style={{ fontSize: 14, color: "#70737B", marginLeft: 20 }}>{req.birth}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#292B2E", width: 56 }}>전화번호</Text>
                        <Text style={{ fontSize: 14, color: "#70737B", marginLeft: 20 }}>{req.phone ? formatPhone(req.phone) : "-"}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginHorizontal: 16, marginBottom: 16 }}>
                      <AnimatedPressable
                        onPress={() => setConfirmPopup({ open: true, type: "reject", requestId: req.id })}
                        scaleAmount={0.97}
                        opacityAmount={0.75}
                        style={{ flex: 1, height: 48, backgroundColor: "#DEEBFF", borderRadius: 10, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF", letterSpacing: -0.32 }}>거절하기</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => setConfirmPopup({ open: true, type: "accept", requestId: req.id })}
                        scaleAmount={0.97}
                        opacityAmount={0.75}
                        style={{ flex: 1, height: 48, backgroundColor: "#4261FF", borderRadius: 10, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.32 }}>승인하기</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* 초대 탭 */}
      {tab === "초대" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 120 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, paddingVertical: 28, paddingHorizontal: 24, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8F3FF", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Share2 size={32} color="#4261FF" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 8, textAlign: "center" }}>직원을 초대해보세요</Text>
            <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
              {"초대 링크를 공유하면 직원이 앱에서\n가입 요청을 보낼 수 있어요"}
            </Text>
            <AnimatedPressable
              onPress={handleInvite}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{
                width: "100%", height: 52, borderRadius: 14, backgroundColor: "#4261FF",
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
              }}
            >
              <Share2 size={18} color="#FFFFFF" />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>초대 링크 공유하기</Text>
            </AnimatedPressable>
            <Text style={{ fontSize: 12, color: "#AAB4BF", textAlign: "center", lineHeight: 18 }}>
              {"카카오톡, 문자, AirDrop 등\n다양한 방법으로 공유할 수 있어요"}
            </Text>
          </View>

          <View style={{ marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B", marginBottom: 14 }}>초대 방법 안내</Text>
            {[
              { step: "1", text: "초대 링크 공유하기 버튼을 눌러요" },
              { step: "2", text: "카카오톡 · 문자 등으로 직원에게 링크를 보내요" },
              { step: "3", text: "직원이 링크로 앱에 가입하면 가입 요청 탭에 노출돼요" },
              { step: "4", text: "사장님이 승인하면 직원 관리가 시작돼요 🎉" },
            ].map(({ step, text }) => (
              <View key={step} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8F3FF", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#4261FF" }}>{step}</Text>
                </View>
                <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 22, paddingTop: 2, flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <ConfirmDialog
        visible={confirmPopup.open}
        onClose={() => setConfirmPopup({ open: false, type: "accept", requestId: 0 })}
        title={confirmPopup.type === "accept" ? "가입 요청 승인하기" : "가입 요청 거절하기"}
        description={confirmPopup.type === "accept" ? "가입 요청을 승인하시겠어요?" : "가입 요청을 거절하시겠어요?"}
        buttons={[
          { label: "취소", onPress: () => setConfirmPopup({ open: false, type: "accept", requestId: 0 }), variant: "cancel" },
          { label: confirmPopup.type === "accept" ? "승인하기" : "거절하기", onPress: handleConfirm },
        ]}
      />

      {/* 메모 바텀시트 */}
      <BottomSheet isOpen={memoSheetOpen} onClose={() => setMemoSheetOpen(false)} title="메모 입력하기">
        <View style={{ position: "relative", marginBottom: 12 }}>
          <TextInput
            value={memoInput}
            onChangeText={(t) => { if (t.length <= 50) setMemoInput(t); }}
            placeholder="등록하실 메모를 입력해 주세요"
            placeholderTextColor="#AAB4BF"
            multiline
            numberOfLines={5}
            style={{ fontSize: 14, color: "#19191B", borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, height: 120, textAlignVertical: "top" }}
            autoFocus
          />
          <Text style={{ position: "absolute", bottom: 14, right: 14, fontSize: 12, color: "#9EA3AD" }}>
            {memoInput.length}/50
          </Text>
        </View>
        <AnimatedPressable
          onPress={async () => {
            if (memoSheetStaffId != null) {
              try {
                await updateStaffContract(storeId, memoSheetStaffId, { memo: memoInput });
                load();
                toast({ description: "메모가 저장되었어요." });
              } catch {
                toast({ description: "메모 저장에 실패했어요.", variant: "destructive" });
              }
            }
            setMemoSheetOpen(false);
          }}
          scaleAmount={0.97}
          opacityAmount={0.75}
          style={{ height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력완료</Text>
        </AnimatedPressable>
      </BottomSheet>

      <OwnerBottomNav activeTab="staff" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

export default OwnerStaffManagementScreen;
