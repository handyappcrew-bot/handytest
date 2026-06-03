import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Modal } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { Check, ChevronDown, ChevronLeft, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheet from "@/components/BottomSheet";
import { useToast } from "@/components/Toast";
import { updateStoreShifts, ShiftItem } from "@/api/owner";
import { getCachedStoreInfo, invalidateStoreInfo } from "@/utils/cachedApi";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2); const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// 저녁 파트 마감용: 익일 00:00~06:00 추가 ("익" > "2" 이므로 string 정렬 시 23:30 뒤에 위치)
const EVENING_END_OPTIONS = [
  ...TIME_OPTIONS,
  ...Array.from({ length: 12 }, (_, i) => {
    const h = Math.floor(i / 2); const m = (i % 2) * 30;
    return `익일 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }),
];

const MORNING_NAMES = ["오픈", "오전", "1교대"];
const AFTERNOON_NAMES = ["미들", "오후", "2교대"];
const EVENING_NAMES = ["마감", "저녁", "3교대"];

const OwnerStoreHoursPartsScreen: React.FC<ScreenProps<"OwnerStoreHoursParts">> = ({ navigation }) => {
  const { toast } = useToast();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const isOnboarding = !!localStorage.getItem("owner_onboarding_mode");

  const [morningName, setMorningName] = useState("");
  const [morningStart, setMorningStart] = useState("");
  const [morningEnd, setMorningEnd] = useState("");
  const [afternoonUse, setAfternoonUse] = useState<"사용" | "미사용" | "">("");
  const [afternoonName, setAfternoonName] = useState("");
  const [afternoonStart, setAfternoonStart] = useState("");
  const [afternoonEnd, setAfternoonEnd] = useState("");
  const [eveningName, setEveningName] = useState("");
  const [eveningStart, setEveningStart] = useState("");
  const [eveningEnd, setEveningEnd] = useState("");

  const [storeOpenTime, setStoreOpenTime] = useState("");
  const [storeCloseTime, setStoreCloseTime] = useState("");
  const [storeSetting, setStoreSetting] = useState<any>(null);
  const [showSheet, setShowSheet] = useState<{ key: string; options: string[]; title: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    getCachedStoreInfo(storeId).then((info: any) => {
      if (info?.setting?.open_time) setStoreOpenTime(info.setting.open_time.slice(0, 5));
      if (info?.setting?.close_time) setStoreCloseTime(info.setting.close_time.slice(0, 5));
      if (info?.setting) setStoreSetting(info.setting);
      const shifts = info?.shifts ?? [];
      const m = shifts.find((s: any) => s.sort_order === 1);
      const a = shifts.find((s: any) => s.sort_order === 2);
      const e = shifts.find((s: any) => s.sort_order === 3);
      if (m) { setMorningName(m.name ?? ""); setMorningStart(m.start_time ?? ""); setMorningEnd(m.end_time ?? ""); }
      if (a) {
        setAfternoonName(a.name ?? "");
        setAfternoonStart(a.start_time ?? "");
        setAfternoonEnd(a.end_time ?? "");
        setAfternoonUse(a.is_active === false ? "미사용" : "사용");
      }
      if (e) { setEveningName(e.name ?? ""); setEveningStart(e.start_time ?? ""); setEveningEnd(e.end_time ?? ""); }
    }).catch((e) => { console.warn(e); toast({ description: "근무 시간대 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]);

  const isAfternoonUsed = afternoonUse === "사용";

  const isComplete =
    morningName && morningStart && morningEnd &&
    afternoonUse &&
    eveningName && eveningStart && eveningEnd &&
    (!isAfternoonUsed || (afternoonName && afternoonStart && afternoonEnd));

  const handleSave = async () => {
    if (!isComplete || submitting) return;
    setSubmitting(true);
    try {
      const shifts: ShiftItem[] = [
        { sort_order: 1, name: morningName, start_time: morningStart || null, end_time: morningEnd || null, is_active: true },
        {
          sort_order: 2,
          name: afternoonName || "미들",
          start_time: isAfternoonUsed ? (afternoonStart || null) : null,
          end_time: isAfternoonUsed ? (afternoonEnd || null) : null,
          is_active: isAfternoonUsed,
        },
        { sort_order: 3, name: eveningName, start_time: eveningStart || null, end_time: (eveningEnd ? eveningEnd.replace("익일 ", "") : null), is_active: true },
      ];
      await updateStoreShifts(storeId, shifts);
      invalidateStoreInfo(storeId);
      toast({ description: "영업 시간이 저장되었어요." });
      setConfirmOpen(false);
      if (isOnboarding) {
        navigation.navigate("OwnerAttendanceStandard");
      } else {
        navigation.navigate("OwnerStoreInfo");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const selectorStyle = {
    height: 52, paddingHorizontal: 20, borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10,
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const,
    backgroundColor: "#FFFFFF",
  };

  const setMap: Record<string, (v: any) => void> = {
    morningName: setMorningName,
    morningStart: setMorningStart,
    morningEnd: (v) => {
      setMorningEnd(v);
      if (afternoonStart && afternoonStart < v) setAfternoonStart("");
      if (afternoonEnd && afternoonEnd <= v) setAfternoonEnd("");
      if (eveningStart && eveningStart < v) setEveningStart("");
      if (eveningEnd && eveningEnd <= v) setEveningEnd("");
    },
    afternoonUse: (v) => {
      setAfternoonUse(v);
      if (v === "미사용") { setAfternoonName(""); setAfternoonStart(""); setAfternoonEnd(""); }
    },
    afternoonName: setAfternoonName,
    afternoonStart: (v) => {
      setAfternoonStart(v);
      if (afternoonEnd && afternoonEnd <= v) setAfternoonEnd("");
      if (eveningStart && eveningStart < v) setEveningStart("");
      if (eveningEnd && eveningEnd <= v) setEveningEnd("");
    },
    afternoonEnd: (v) => {
      setAfternoonEnd(v);
      if (eveningStart && eveningStart < v) setEveningStart("");
      if (eveningEnd && eveningEnd <= v) setEveningEnd("");
    },
    eveningName: setEveningName,
    eveningStart: (v) => {
      setEveningStart(v);
      if (eveningEnd && eveningEnd <= v) setEveningEnd("");
    },
    eveningEnd: setEveningEnd,
  };

  const valueMap: Record<string, string> = {
    morningName, morningStart, morningEnd,
    afternoonUse: afternoonUse || "",
    afternoonName, afternoonStart, afternoonEnd,
    eveningName, eveningStart, eveningEnd,
  };

  const SelectField: React.FC<{ value: string; placeholder: string; sheetKey: string; options: string[]; sheetTitle: string }> = ({ value, placeholder, sheetKey, options, sheetTitle }) => (
    <AnimatedPressable
      onPress={() => setShowSheet({ key: sheetKey, options, title: sheetTitle })}
      scaleAmount={0.97}
      opacityAmount={0.8}
      style={selectorStyle}
    >
      <Text style={{ fontSize: 15, color: value ? "#19191B" : "#AAB4BF" }}>{value || placeholder}</Text>
      <ChevronDown size={20} color="#70737B" />
    </AnimatedPressable>
  );

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          {/* Header */}
          <View style={{ backgroundColor: "#FFFFFF" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
              <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 4 }}>
                <ChevronLeft size={24} color="#19191B" />
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>운영 시간 설정</Text>
            </View>

            {/* 진행 표시바 */}
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingBottom: 8 }}>
              <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "#4261FF" }} />
              <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "#4261FF" }} />
              {isOnboarding && <View style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: "#EBEBEB" }} />}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#AAB4BF" }}>① 완료</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF" }}>② 영업 파트</Text>
              {isOnboarding && <Text style={{ fontSize: 12, fontWeight: "600", color: "#AAB4BF" }}>③ 근태 기준</Text>}
            </View>
            <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
            {/* 오전 파트 */}
            <View style={{ marginBottom: 30 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>오전 파트 시간</Text>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  오전 파트명 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <Text style={{ fontSize: 13, color: "#AAB4BF", marginBottom: 8 }}>
                  *매장에서 사용하는 파트 용어를 선택해주세요 (예: 오픈, 오전, 1교대)
                </Text>
                <SelectField value={morningName} placeholder="오전 파트명 선택" sheetKey="morningName" options={MORNING_NAMES} sheetTitle="오전 파트명 선택하기" />
              </View>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  오전 파트 시작 시간 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <SelectField value={morningStart} placeholder="오전 파트 시작 시간 입력" sheetKey="morningStart" options={TIME_OPTIONS} sheetTitle="오전 파트 시작 시간 선택" />
              </View>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  오전 파트 마감 시간 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <SelectField value={morningEnd} placeholder="오전 파트 종료 시간 입력" sheetKey="morningEnd" options={TIME_OPTIONS.filter(t => !morningStart || t > morningStart)} sheetTitle="오전 파트 마감 시간 선택" />
              </View>
            </View>

            {/* 오후 파트 */}
            <View style={{ marginBottom: 30 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>오후 파트 시간</Text>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  오후 파트 여부 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <SelectField value={afternoonUse} placeholder="오후 파트 여부 선택" sheetKey="afternoonUse" options={["사용", "미사용"]} sheetTitle="오후 파트 사용 여부 선택하기" />
                <Text style={{ fontSize: 14, color: "#AAB4BF", marginTop: 8 }}>
                  *오전·저녁 파트만 운영하는 경우 미사용으로 선택해주세요
                </Text>
              </View>

              {isAfternoonUsed && (
                <>
                  <View style={{ marginBottom: 30 }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                      오후 파트명 <Text style={{ color: "#FF3D3D" }}>*</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: "#AAB4BF", marginBottom: 8 }}>
                      *매장에서 사용하는 파트 용어를 선택해주세요 (예: 미들, 오후, 2교대)
                    </Text>
                    <SelectField value={afternoonName} placeholder="오후 파트명 선택" sheetKey="afternoonName" options={AFTERNOON_NAMES} sheetTitle="오후 파트명 선택하기" />
                  </View>

                  <View style={{ marginBottom: 30 }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                      오후 파트 시작 시간 <Text style={{ color: "#FF3D3D" }}>*</Text>
                    </Text>
                    <SelectField value={afternoonStart} placeholder="오후 파트 시작 시간 입력" sheetKey="afternoonStart" options={TIME_OPTIONS.filter(t => !morningEnd || t >= morningEnd)} sheetTitle="오후 파트 시작 시간 선택" />
                  </View>

                  <View style={{ marginBottom: 30 }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                      오후 파트 마감 시간 <Text style={{ color: "#FF3D3D" }}>*</Text>
                    </Text>
                    <SelectField value={afternoonEnd} placeholder="오후 파트 종료 시간 입력" sheetKey="afternoonEnd" options={TIME_OPTIONS.filter(t => { const after = afternoonStart || morningEnd; return !after || t > after; })} sheetTitle="오후 파트 마감 시간 선택" />
                  </View>
                </>
              )}
            </View>

            {/* 저녁 파트 */}
            <View style={{ marginBottom: 30 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>저녁 파트 시간</Text>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  저녁 파트명 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <Text style={{ fontSize: 13, color: "#AAB4BF", marginBottom: 8 }}>
                  *매장에서 사용하는 파트 용어를 선택해주세요 (예: 마감, 저녁, 3교대)
                </Text>
                <SelectField value={eveningName} placeholder="저녁 파트명 선택" sheetKey="eveningName" options={EVENING_NAMES} sheetTitle="저녁 파트명 선택하기" />
              </View>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  저녁 파트 시작 시간 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <SelectField
                  value={eveningStart}
                  placeholder="저녁 파트 시작 시간 입력"
                  sheetKey="eveningStart"
                  options={TIME_OPTIONS.filter(t => {
                    const after = isAfternoonUsed ? (afternoonEnd || afternoonStart || morningEnd) : morningEnd;
                    return !after || t >= after;
                  })}
                  sheetTitle="저녁 파트 시작 시간 선택"
                />
              </View>

              <View style={{ marginBottom: 30 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                  저녁 파트 마감 시간 <Text style={{ color: "#FF3D3D" }}>*</Text>
                </Text>
                <SelectField value={eveningEnd} placeholder="저녁 파트 종료 시간 입력" sheetKey="eveningEnd" options={EVENING_END_OPTIONS.filter(t => !eveningStart || t > eveningStart)} sheetTitle="저녁 파트 마감 시간 선택" />
              </View>
            </View>
          </ScrollView>

          {/* 저장하기 버튼 (Footer) */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, borderTopWidth: 1, borderTopColor: "#F7F7F8", backgroundColor: "#FFFFFF" }}>
            <AnimatedPressable
              onPress={() => isComplete && setConfirmOpen(true)}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{
                width: "100%", height: 56, borderRadius: 16,
                backgroundColor: isComplete ? "#4261FF" : "#DBDCDF",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>저장하기</Text>
            </AnimatedPressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* 옵션 선택 바텀시트 */}
      <BottomSheet
        isOpen={showSheet !== null}
        onClose={() => setShowSheet(null)}
        title={showSheet?.title ?? "선택"}
      >
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ maxHeight: 360 }}>
          <View style={{ gap: 4 }}>
            {showSheet?.options.map((opt) => {
              const sel = valueMap[showSheet.key] === opt;
              return (
                <AnimatedPressable
                  key={opt}
                  onPress={() => { setMap[showSheet.key]?.(opt); setShowSheet(null); }}
                  scaleAmount={0.97}
                  opacityAmount={0.85}
                  style={{
                    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
                    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                    backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{opt}</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheet>

      {/* 저장 확인 팝업 */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setConfirmOpen(false)}
        >
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ width: "85%", maxWidth: 340, backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 4 }}>운영 시간 설정 저장</Text>
            <Text style={{ fontSize: 13, color: "#70737B", textAlign: "center", marginBottom: 16 }}>아래 내용으로 저장할게요. 확인해주세요.</Text>

            {/* 요약 카드 */}
            <View style={{ backgroundColor: "#F7F8FF", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 20 }}>
              {storeOpenTime ? (
                <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 6 }}>영업 시간</Text>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>
                    {storeOpenTime === "00:00" && storeCloseTime === "00:00" ? "24시간 영업" : `${storeOpenTime} ~ ${storeCloseTime}`}
                  </Text>
                </View>
              ) : null}
              {storeSetting ? (
                <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 6 }}>고정 휴무일</Text>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>
                    {!storeSetting.is_fixed_holiday
                      ? "없음"
                      : storeSetting.holiday_days?.length > 0
                      ? (() => {
                          const c: string = storeSetting.holiday_cycle ?? "";
                          const isGukju = c.startsWith("격주");
                          const cycleLabel = isGukju ? "격주" : c;
                          const weekPart = isGukju && c.includes("-") ? ` (${c.split("-")[1]})` : "";
                          return `${cycleLabel}${weekPart} ${(storeSetting.holiday_days as string[]).join(", ")}`.trim();
                        })()
                      : "-"}
                  </Text>
                </View>
              ) : null}
              <View style={{ marginBottom: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 4 }}>오전 파트</Text>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{morningName} · {morningStart} ~ {morningEnd}</Text>
              </View>
              <View style={{ marginBottom: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#EBEBEB" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 4 }}>오후 파트</Text>
                {isAfternoonUsed ? (
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{afternoonName} · {afternoonStart} ~ {afternoonEnd}</Text>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#9EA3AD" }}>미사용</Text>
                )}
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", marginBottom: 4 }}>저녁 파트</Text>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{eveningName} · {eveningStart} ~ {eveningEnd}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <AnimatedPressable
                onPress={() => setConfirmOpen(false)}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: "#EBEBEB", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleSave}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>저장하기</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default OwnerStoreHoursPartsScreen;
