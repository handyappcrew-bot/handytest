import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
import { View, Text, ScrollView, Pressable, Modal, TouchableWithoutFeedback, Image } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import { ChevronLeft, ChevronRight, Copy, Check, Info, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar from "@/components/Avatar";
import AnimatedPressable from "@/components/AnimatedPressable";
import BottomSheet from "@/components/BottomSheet";
import FocusInput from "@/components/FocusInput";
import { getStaffDetail, updateStaffContract, getOwnerSchedules } from "@/api/owner";
import { getCachedStoreInfo } from "@/utils/cachedApi";
import { API_BASE_URL } from "@/api/client";
import { inferShiftName, getShiftStyle } from "@/utils/shiftStyles";
import { formatPhone } from "@/utils/valid";
import { localStorage } from "@/utils/storage";
import * as Clipboard from "expo-clipboard";
import { useToast } from "@/components/Toast";
import type { ScreenProps } from "@/navigation/types";


const OwnerStaffDetailScreen: React.FC<ScreenProps<"OwnerStaffDetail">> = ({ route, navigation }) => {
  const { staffId } = route.params;
  const { toast } = useToast();
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completionPopup, setCompletionPopup] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; label: string } | null>(null);
  const [showMemoSheet, setShowMemoSheet] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [memoSubmitting, setMemoSubmitting] = useState(false);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [workScheduleDisplay, setWorkScheduleDisplay] = useState<{ day: string; shifts: string[]; time: string }[]>([]);
  const [storeShifts, setStoreShifts] = useState<any[]>([]);

  const loadStaff = useCallback(() => {
    if (!storeId || !staffId) return;
    setLoading(true);
    const now = new Date();
    Promise.all([
      getStaffDetail(storeId, staffId),
      getOwnerSchedules(storeId, now.getFullYear(), now.getMonth() + 1).catch(() => []),
      getCachedStoreInfo(storeId).catch(() => null),
    ]).then(([d, scheduleData, storeData]: [any, any, any]) => {
        if (!d) { setStaff(null); return; }
        const normalizeGender = (g: string) =>
          ["male", "M", "m", "남자"].includes(g) ? "남" : ["female", "F", "f", "여자"].includes(g) ? "여" : g;
        // API가 계약 필드를 flat(루트 레벨)으로 반환 — contract 객체로 재구성
        const contract = {
          employee_type: d.employee_type,
          working_status: d.working_status,
          hire_date: d.hire_date,
          retired_at: d.retired_at,
          salary_type: d.salary_type ?? (d.hourly_rate ? "시급" : d.monthly_salary ? "월급" : ""),
          hourly_rate: d.hourly_rate,
          monthly_salary: d.monthly_salary,
          annual_salary: d.annual_salary,
          salary_cycle: d.salary_cycle,
          salary_day: d.salary_day,
          is_probation: d.is_probation,
          probation_rate: d.probation_rate,
          probation_start: d.probation_start,
          probation_end: d.probation_end,
          deduction_type: d.deduction_type,
          income_tax: d.income_tax,
          income_tax_rate: d.income_tax_rate,
          local_income_tax: d.local_income_tax,
          national_pension: d.national_pension,
          health_insurance: d.health_insurance,
          long_term_care: d.long_term_care,
          employment_insurance: d.employment_insurance,
          industrial_accident: d.industrial_accident,
          break_minutes: d.break_minutes,
          include_holiday_pay: d.include_holiday_pay,
          include_break_time: d.include_break_time,
          memo: d.memo,
          resume: d.resume,
          employment_contract: d.employment_contract,
          health_certificate: d.health_certificate,
        };
        setStaff({
          ...d,
          gender: normalizeGender(d.gender ?? ""),
          work_status: d.working_status ?? "",
          contract,
        });
        const storeShiftsSnap = storeData?.shifts ?? [];
        setStoreShifts(storeShiftsSnap);
        const WORK_DAYS_DISP = ["월", "화", "수", "목", "금", "토", "일"];
        const empScheds = (Array.isArray(scheduleData) ? scheduleData : []).filter((s: any) => s.employee_id === staffId);
        const dayMap: Record<number, { shifts: string[]; time: string }> = {};
        empScheds.forEach((s: any) => {
          const jsDay = new Date(s.work_date).getDay();
          const wdIdx = jsDay === 0 ? 6 : jsDay - 1;
          if (!dayMap[wdIdx]) dayMap[wdIdx] = { shifts: [], time: "" };
          let shiftName = s.shift_name;
          if (!shiftName && s.shift_id) {
            const found = storeShiftsSnap.find((sf: any) => sf.id === s.shift_id);
            if (found?.name) shiftName = found.name;
          }
          if (!shiftName && s.work_start) {
            shiftName = inferShiftName(s.work_start, storeShiftsSnap);
          }
          if (shiftName && !dayMap[wdIdx].shifts.includes(shiftName)) dayMap[wdIdx].shifts.push(shiftName);
          if (!dayMap[wdIdx].time && s.work_start && s.work_end) dayMap[wdIdx].time = `${s.work_start} ~ ${s.work_end}`;
        });
        setWorkScheduleDisplay(
          Object.entries(dayMap)
            .map(([idx, { shifts, time }]) => ({ day: WORK_DAYS_DISP[Number(idx)] ?? "", shifts, time }))
            .filter(e => e.day)
            .sort((a, b) => WORK_DAYS_DISP.indexOf(a.day) - WORK_DAYS_DISP.indexOf(b.day))
        );
      })
      .catch(() => setStaff(null))
      .finally(() => setLoading(false));
  }, [storeId, staffId]);

  useFocusEffect(loadStaff);

  if (!loading && !staff) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>직원 정보 상세</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, color: "#9EA3AD" }}>직원 정보를 찾을 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!staff) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>직원 정보 상세</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <DotsLoader />
        </View>
      </SafeAreaView>
    );
  }

  const isGhost = staff.work_status === "앱탈퇴" || staff.contract?.working_status === "앱탈퇴";
  const isLeave = staff.work_status === "휴직" || staff.contract?.working_status === "휴직";
  const isResigned = !isGhost && (staff.work_status === "퇴사" || staff.contract?.working_status === "퇴사");
  const hasContractForNew = !!(staff.contract?.salary_type || staff.contract?.hourly_rate || staff.contract?.monthly_salary || staff.contract?.annual_salary);
  const isNew = staff.work_status === "신규" || staff.contract?.working_status === "신규" || (!hasContractForNew && !isGhost);
  const hasContract = !!(staff.contract?.employee_type || staff.contract?.hourly_rate || staff.contract?.monthly_salary || staff.contract?.annual_salary || staff.contract?.salary_cycle || staff.contract?.salary_day);
  const hasTax = !!(staff.contract?.income_tax != null || staff.contract?.local_income_tax != null || staff.contract?.national_pension != null || staff.contract?.health_insurance != null || staff.contract?.employment_insurance != null || staff.contract?.income_tax_enabled || staff.contract?.social_insurance_enabled);
  const hasPersonal = !!staff.phone;
  const hasMemo = !!staff.contract?.memo;
  const hasDoc = !!(staff.contract?.resume || staff.contract?.employment_contract || staff.contract?.health_certificate);

  const goEdit = (section?: "계약정보" | "세금" | "인적사항" | "계약서" | "근무상태") =>
    navigation.navigate("OwnerStaffEdit", { staffId, section });

  const openMemoSheet = () => {
    setMemoInput(staff?.contract?.memo ?? "");
    setShowMemoSheet(true);
  };

  const saveMemo = async () => {
    if (memoSubmitting) return;
    setMemoSubmitting(true);
    try {
      await updateStaffContract(storeId, staffId, { memo: memoInput });
      setStaff((prev: any) => ({ ...prev, contract: { ...(prev?.contract ?? {}), memo: memoInput } }));
      setShowMemoSheet(false);
      toast({ description: "메모를 저장했어요." });
    } catch {
      toast({ description: "저장에 실패했어요.", variant: "destructive" });
    } finally {
      setMemoSubmitting(false);
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    toast({ description: "계좌번호가 복사되었어요." });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Sticky Header */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36, flex: 1 }}>직원 정보 상세</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* 아바타 + 이름 */}
        <View style={{ alignItems: "center", paddingTop: 16, paddingBottom: 0 }}>
          <View style={{ position: "relative" }}>
            <Avatar
              name={staff.name}
              imageUrl={staff.image_url}
              size={110}
              bgColor={isGhost ? "#B0B8C1" : undefined}
              style={{ opacity: isGhost ? 0.7 : 1 }}
              defaultSource={STAFF_ICON}
            />
            {isLeave && !isNew && (
              <View style={{ position: "absolute", bottom: -2, left: "50%", transform: [{ translateX: -20 }], backgroundColor: "#FF9800", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>휴직</Text>
              </View>
            )}
            {isNew && (
              <View style={{ position: "absolute", bottom: -2, left: "50%", transform: [{ translateX: -26 }], backgroundColor: "#4261FF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>신규 직원</Text>
              </View>
            )}
            {isResigned && !isNew && (
              <View style={{ position: "absolute", bottom: -2, left: "50%", transform: [{ translateX: -18 }], backgroundColor: "#70737B", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>퇴사</Text>
              </View>
            )}
            {isGhost && !isNew && (
              <View style={{ position: "absolute", bottom: -2, left: "50%", transform: [{ translateX: -22 }], backgroundColor: "#70737B", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>앱 탈퇴</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4 }}>{staff.name ?? "이름없음"}</Text>
            {isLeave && !isNew && (
              <View style={{ backgroundColor: "rgba(255,152,0,0.12)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF9800" }}>휴직 중</Text>
              </View>
            )}
            {isNew && (
              <View style={{ backgroundColor: "rgba(66,97,255,0.1)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF" }}>신규 직원</Text>
              </View>
            )}
            {isResigned && !isNew && (
              <View style={{ backgroundColor: "#F0F0F2", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>퇴사</Text>
              </View>
            )}
            {isGhost && !isNew && (
              <View style={{ backgroundColor: "#EAECEF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>앱 탈퇴</Text>
              </View>
            )}
          </View>

          {/* 앱탈퇴 안내 */}
          {isGhost && (
            <View style={{ marginHorizontal: 20, marginBottom: 20, padding: 18, alignSelf: "stretch", backgroundColor: "#F4F5F7", borderRadius: 16, borderWidth: 1, borderColor: "#C8CDD6" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Text style={{ fontSize: 18 }}>👻</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#70737B" }}>이 직원은 앱을 탈퇴했어요</Text>
              </View>
              <Text style={{ fontSize: 13, color: "#9EA3AD", lineHeight: 20, marginBottom: 14 }}>
                {"직원이 앱에서 탈퇴했지만 아직 퇴사 처리가 완료되지 않았어요.\n미지급 급여나 계약 내역을 확인한 후 퇴사 처리를 해주세요."}
              </Text>
              {[
                { icon: "💸", text: "미지급 급여가 있는지 확인해주세요" },
                { icon: "📋", text: "근로계약서 및 계약 내역을 보관해주세요" },
                { icon: "✅", text: "확인 후 아래 근무 상태에서 퇴사 처리하세요" },
              ].map(({ icon, text }, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>{icon}</Text>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>{text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 신규 직원 온보딩 진행 카드 */}
          {isNew && (() => {
            const steps = [
              { label: "고용 형태 · 급여 · 근무일", done: hasContract },
              { label: "세금 항목", done: hasTax },
            ];
            const doneCount = steps.filter((s) => s.done).length;
            const allDone = doneCount === steps.length;
            const progress = Math.round((doneCount / steps.length) * 100);
            return (
              <View style={{ marginHorizontal: 20, marginBottom: 20, padding: 18, alignSelf: "stretch", backgroundColor: "#F0F4FF", borderRadius: 16, borderWidth: 1, borderColor: "rgba(66,97,255,0.25)" }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 8 }}>
                  <Info size={13} color="#4261FF" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#4261FF" }}>
                      {allDone ? "등록 완료! 신규 직원 태그가 곧 사라져요" : `항목을 모두 등록하면 신규 직원 태그가 사라져요 (${doneCount}/${steps.length})`}
                    </Text>
                  </View>
                </View>
                <View style={{ height: 4, backgroundColor: "rgba(66,97,255,0.15)", borderRadius: 99, marginBottom: 10, overflow: "hidden" }}>
                  <View style={{ height: 4, width: `${progress}%` as any, backgroundColor: "#4261FF", borderRadius: 99 }} />
                </View>
                {steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: i < steps.length - 1 ? 6 : 0 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: s.done ? "#4261FF" : "rgba(66,97,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                      {s.done && <Check size={10} color="#FFFFFF" />}
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: s.done ? "#4261FF" : "#9EA3AD", textDecorationLine: s.done ? "line-through" : "none" }}>{s.label}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        <Divider />

        {/* 계약 정보 */}
        <View style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 0 }}>
          <SectionHeader
            title="계약 정보"
            isRegistered={hasContract}
            onEdit={(isGhost || isResigned) ? undefined : () => goEdit("계약정보")}
          />
          {!hasContract ? (
            <View style={{ marginBottom: 16, padding: 14, backgroundColor: "#F0F4FF", borderRadius: 12, borderWidth: 1, borderColor: "#4261FF", borderStyle: "dashed" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#4261FF", marginBottom: 4 }}>계약 정보가 등록되지 않았어요</Text>
              <Text style={{ fontSize: 13, color: "#70737B", lineHeight: 20, marginBottom: 12 }}>
                {"고용 형태 · 급여 · 근무일 정보를 등록해야\n급여 계산과 일정 관리가 가능해요"}
              </Text>
              <AnimatedPressable
                onPress={() => goEdit("계약정보")}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{
                  alignSelf: "flex-start",
                  height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#4261FF",
                  flexDirection: "row", alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>지금 계약 정보 등록하기 →</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <>
              {staff.joined_at && (
                <InfoRow label="입사일">
                  {String(staff.joined_at).slice(0, 10)}
                </InfoRow>
              )}
              <InfoRow label="고용 형태">{staff.contract?.employee_type ?? "-"}</InfoRow>
              {staff.contract?.salary_type && (
                <InfoRow label="급여 형태">{staff.contract.salary_type}</InfoRow>
              )}
              {staff.contract?.salary_type === "시급" ? (
                <InfoRow label="시급">
                  {staff.contract.hourly_rate ? `${staff.contract.hourly_rate.toLocaleString()}원` : "-"}
                </InfoRow>
              ) : staff.contract?.salary_type === "연봉" ? (
                <InfoRow label="연봉">
                  {staff.contract.annual_salary ? `${Math.round(staff.contract.annual_salary / 10000)}만원` : "-"}
                </InfoRow>
              ) : (staff.contract?.salary_type === "월급" || staff.contract?.salary_type === "월급 (연봉 포함)") ? (
                <InfoRow label="월급">
                  {staff.contract.monthly_salary ? `${Math.round(staff.contract.monthly_salary / 10000)}만원` : "-"}
                </InfoRow>
              ) : (
                <>
                  {staff.contract?.hourly_rate ? (
                    <InfoRow label="시급">{`${staff.contract.hourly_rate.toLocaleString()}원`}</InfoRow>
                  ) : null}
                  {staff.contract?.annual_salary ? (
                    <InfoRow label="연봉">{`${Math.round(staff.contract.annual_salary / 10000)}만원`}</InfoRow>
                  ) : null}
                  {staff.contract?.monthly_salary ? (
                    <InfoRow label="월급">{`${Math.round(staff.contract.monthly_salary / 10000)}만원`}</InfoRow>
                  ) : null}
                </>
              )}
              {staff.contract?.salary_cycle && (
                <InfoRow label="급여 주기">{staff.contract.salary_cycle}</InfoRow>
              )}
              {staff.contract?.salary_day && (
                <InfoRow label="급여일">{staff.contract.salary_day}</InfoRow>
              )}
              {(staff.contract?.is_probation ?? staff.contract?.probation) && (
                <InfoRow label="수습 비율">{staff.contract?.probation_rate ? `${staff.contract.probation_rate}%` : "-"}</InfoRow>
              )}
              {staff.contract?.include_holiday_pay && (
                <InfoRow label="주휴">포함</InfoRow>
              )}
              {staff.contract?.include_break_time && (
                <InfoRow label="휴게">{staff.contract.break_minutes ? `${staff.contract.break_minutes}분` : "포함"}</InfoRow>
              )}
              {workScheduleDisplay.length > 0 && (
                <InfoRow label="근무일" mb={16}>
                  <View style={{ gap: 8 }}>
                    {workScheduleDisplay.map((ws) => (
                      <View key={ws.day} style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {ws.shifts.map(s => {
                          const st = getShiftStyle(s, storeShifts);
                          return (
                            <View key={s} style={{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: st.bg }}>
                              <Text style={{ fontSize: 12, fontWeight: "600", color: st.text }}>{s}</Text>
                            </View>
                          );
                        })}
                        <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>
                          {ws.day}{ws.time ? ` (${ws.time})` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                </InfoRow>
              )}
            </>
          )}
        </View>

        <Divider />

        {/* 세금 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
          <SectionHeader
            title="세금"
            isRegistered={hasTax}
            onEdit={(isGhost || isResigned) ? undefined : () => goEdit("세금")}
          />
          {!hasTax ? (
            <View style={{ marginBottom: 16, padding: 14, backgroundColor: "#FFF8F0", borderRadius: 12, borderWidth: 1, borderColor: "#FFB347", borderStyle: "dashed" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FF8F00", marginBottom: 4 }}>세금 항목이 설정되지 않았어요</Text>
              <Text style={{ fontSize: 13, color: "#70737B", lineHeight: 20, marginBottom: 12 }}>
                {"소득세·4대보험 항목을 설정하지 않으면\n급여에서 세금이 공제되지 않아요"}
              </Text>
              <AnimatedPressable
                onPress={() => goEdit("세금")}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{
                  alignSelf: "flex-start",
                  height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#FF8F00",
                  flexDirection: "row", alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>지금 세금 설정하기 →</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <>
              {[
                { label: "소득세", val: staff.contract?.income_tax },
                { label: "지방소득세", val: staff.contract?.local_income_tax },
                { label: "국민연금", val: staff.contract?.national_pension },
                { label: "건강보험", val: staff.contract?.health_insurance },
                { label: "장기요양보험", val: staff.contract?.long_term_care, isLongterm: true },
                { label: "고용보험", val: staff.contract?.employment_insurance },
                { label: "산재보험", val: staff.contract?.industrial_accident },
              ].filter(item => item.val != null).map((item, i, arr) => (
                <InfoRow key={item.label} label={item.label} mb={i === arr.length - 1 ? 16 : 12}>
                  {item.isLongterm ? `건강보험의 ${item.val}%` : `${item.val}%`}
                </InfoRow>
              ))}
              {staff.contract?.income_tax == null && staff.contract?.income_tax_rate && (
                <InfoRow label="소득세" mb={12}>{`${staff.contract.income_tax_rate}%`}</InfoRow>
              )}
              {staff.contract?.income_tax == null && !staff.contract?.income_tax_rate && staff.contract?.social_insurance_enabled && (
                <InfoRow label="4대 보험" mb={16}>적용</InfoRow>
              )}
            </>
          )}
        </View>

        <Divider />

        {/* 인적 사항 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
          <SectionHeader
            title="인적 사항"
            isRegistered={hasPersonal}
            onEdit={(isGhost || isResigned) ? undefined : () => goEdit("인적사항")}
          />
          <InfoRow label="생년월일">{staff.birth ?? "-"}</InfoRow>
          <InfoRow label="성별">
            {staff.gender === "male" || staff.gender === "남" ? "남자" : staff.gender === "female" || staff.gender === "여" ? "여자" : "-"}
          </InfoRow>
          <InfoRow label="전화번호">{staff.phone ? formatPhone(staff.phone) : "-"}</InfoRow>
          <InfoRow label="은행">{staff.bank ?? "-"}</InfoRow>
          <InfoRow label="계좌번호" mb={16}>
            {staff.account_number ? (
              <AnimatedPressable
                onPress={() => handleCopy(staff.account_number)}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#4261FF", textDecorationLine: "underline", letterSpacing: -0.32 }}>
                  {staff.account_number}
                </Text>
                <Copy size={14} color="#4261FF" />
              </AnimatedPressable>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD", letterSpacing: -0.32 }}>-</Text>
            )}
          </InfoRow>
        </View>

        <Divider />

        {/* 메모 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
          <SectionHeader
            title="메모"
            isRegistered={hasMemo}
            onEdit={isGhost ? undefined : openMemoSheet}
          />
          <InfoRow label="메모 내용" mb={16}>
            {staff.contract?.memo ? (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B", letterSpacing: -0.32 }}>{staff.contract.memo}</Text>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD", letterSpacing: -0.32 }}>메모를 입력해주세요</Text>
            )}
          </InfoRow>
        </View>

        <Divider />

        {/* 계약서 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
          <SectionHeader
            title="계약서"
            isRegistered={hasDoc}
            onEdit={(isGhost || isResigned) ? undefined : () => goEdit("계약서")}
          />
          <InfoRow label="이력서">
            {staff.contract?.resume ? (
              <AnimatedPressable onPress={() => setImagePreview({ url: staff.contract.resume, label: "이력서" })} scaleAmount={0.97} opacityAmount={0.75}
                style={{ alignSelf: "flex-start", height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#F0F3FF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>이력서 보기</Text>
              </AnimatedPressable>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD", letterSpacing: -0.32 }}>미등록</Text>
            )}
          </InfoRow>
          <InfoRow label="근로계약서">
            {staff.contract?.employment_contract ? (
              <AnimatedPressable onPress={() => setImagePreview({ url: staff.contract.employment_contract, label: "근로계약서" })} scaleAmount={0.97} opacityAmount={0.75}
                style={{ alignSelf: "flex-start", height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#F0F3FF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>근로계약서 보기</Text>
              </AnimatedPressable>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD", letterSpacing: -0.32 }}>미등록</Text>
            )}
          </InfoRow>
          <InfoRow label="보건증" mb={16}>
            {staff.contract?.health_certificate ? (
              <AnimatedPressable onPress={() => setImagePreview({ url: staff.contract.health_certificate, label: "보건증" })} scaleAmount={0.97} opacityAmount={0.75}
                style={{ alignSelf: "flex-start", height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#F0F3FF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>보건증 보기</Text>
              </AnimatedPressable>
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD", letterSpacing: -0.32 }}>미등록</Text>
            )}
          </InfoRow>
        </View>

        <Divider />

        {/* 근무 상태 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <SectionHeader
            title="근무 상태"
            isRegistered={!!(staff.contract?.working_status || staff.work_status)}
            onEdit={(isGhost || isResigned) ? undefined : () => goEdit("근무상태")}
          />
          {isGhost ? (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#70737B", width: 114, flexShrink: 0 }}>근무 상태</Text>
                <View style={{ backgroundColor: "#EAECEF", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>앱 탈퇴</Text>
                </View>
              </View>
              <AnimatedPressable
                onPress={() => goEdit("근무상태")}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{
                  height: 52, borderRadius: 14, backgroundColor: "#19191B", alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.32 }}>퇴사 처리하기 →</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <InfoRow label="근무 상태" mb={16}>
              {staff.contract?.working_status ?? staff.work_status ?? "-"}
            </InfoRow>
          )}
        </View>

      </ScrollView>

      {/* 등록 완료 팝업 */}
      <Modal visible={completionPopup} transparent animationType="fade" onRequestClose={() => setCompletionPopup(false)}>
        <TouchableWithoutFeedback onPress={() => setCompletionPopup(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ width: "85%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 24, paddingTop: 32, paddingHorizontal: 24, paddingBottom: 20, alignItems: "center" }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 8 }}>직원 등록 완료!</Text>
                <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 24, marginBottom: 24 }}>
                  {"모든 정보가 등록되었어요.\n이제 급여 계산과 일정 관리를\n시작할 수 있어요."}
                </Text>
                <AnimatedPressable
                  onPress={() => { setCompletionPopup(false); navigation.goBack(); }}
                  scaleAmount={0.97}
                  opacityAmount={0.75}
                  style={{ width: "100%", height: 52, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", marginBottom: 10 }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.32 }}>직원 관리하러 가기 →</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => setCompletionPopup(false)}
                  scaleAmount={0.97}
                  opacityAmount={0.75}
                  style={{ width: "100%", height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#9EA3AD" }}>계속 정보 확인하기</Text>
                </AnimatedPressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 파일/이미지 미리보기 팝업 */}
      <Modal visible={!!imagePreview} transparent animationType="fade" onRequestClose={() => setImagePreview(null)}>
        <TouchableWithoutFeedback onPress={() => setImagePreview(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ width: "90%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32, flex: 1 }}>{imagePreview?.label}</Text>
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

      <BottomSheet isOpen={showMemoSheet} onClose={() => setShowMemoSheet(false)} title="메모">
        <View style={{ gap: 16 }}>
          <FocusInput
            value={memoInput}
            onChangeText={setMemoInput}
            placeholder="메모를 입력해주세요"
            placeholderTextColor="#AAB4BF"
            multiline
            style={[{
              borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10,
              height: 160, paddingHorizontal: 16, paddingTop: 12,
              fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF",
              textAlignVertical: "top", outline: "none", boxShadow: "none",
            } as any]}
          />
          <AnimatedPressable
            onPress={saveMemo}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ height: 52, borderRadius: 14, backgroundColor: memoSubmitting ? "#AAB4BF" : "#4261FF", alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{memoSubmitting ? "저장 중..." : "저장하기"}</Text>
          </AnimatedPressable>
        </View>
      </BottomSheet>

    </SafeAreaView>
  );
};

/* ─── 공통 서브 컴포넌트 ─── */

function Divider() {
  return <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />;
}

const SectionHeader: React.FC<{
  title: string;
  isRegistered?: boolean;
  onEdit?: () => void;
}> = ({ title, isRegistered = true, onEdit }) => (
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <Text style={{ fontSize: 20, fontWeight: "700", color: "#19191B", letterSpacing: -0.4 }}>{title}</Text>
    {onEdit && (
      <AnimatedPressable onPress={onEdit} scaleAmount={0.97} opacityAmount={0.75} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={8}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: isRegistered ? "#70737B" : "#4261FF" }}>
          {isRegistered ? "수정하기" : "등록하기"}
        </Text>
        <ChevronRight size={14} color={isRegistered ? "#70737B" : "#4261FF"} />
      </AnimatedPressable>
    )}
  </View>
);

const InfoRow: React.FC<{ label: string; children: React.ReactNode; mb?: number }> = ({ label, children, mb }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: mb !== undefined ? mb : 12 }}>
    <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#70737B", width: 114, flexShrink: 0 }}>{label}</Text>
    <View style={{ flex: 1 }}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={{ fontSize: 16, fontWeight: "500", letterSpacing: -0.32, color: "#19191B" }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  </View>
);

export default OwnerStaffDetailScreen;
