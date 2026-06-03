import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView } from "react-native";
import DotsLoader from "@/components/DotsLoader";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { Building2, Clock, MapPin, ChevronRight, ChevronDown, ChevronUp, X } from "lucide-react-native";
import PageLayout from "@/components/PageLayout";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import { useToast } from "@/components/Toast";
import { getCachedStoreInfo } from "@/utils/cachedApi";
import { formatPhone } from "@/utils/valid";
import { localStorage } from "@/utils/storage";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import type { ScreenProps } from "@/navigation/types";

const cardStyle = {
  borderRadius: 16,
  backgroundColor: "#FFFFFF",
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 2, height: 2 },
  elevation: 2,
  padding: 20,
  marginBottom: 12,
};

const OwnerStoreInfoScreen: React.FC<ScreenProps<"OwnerStoreInfo">> = ({ navigation }) => {
  const { toast } = useToast();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const load = useCallback(() => {
    if (!storeId) { setLoading(false); return; }
    setError(false);
    getCachedStoreInfo(storeId)
      .then(setInfo)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [storeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!loading && (error || !info)) {
    return (
      <View style={{ flex: 1 }}>
        <PageLayout headerTitle="매장 관리">
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {error ? (
              <ErrorState onRetry={load} />
            ) : (
              <EmptyState message="매장 정보를 찾을 수 없어요" />
            )}
          </View>
        </PageLayout>
        <OwnerBottomNav activeTab="store" navigation={navigation} />
      </View>
    );
  }

  if (!info) {
    return (
      <View style={{ flex: 1 }}>
        <PageLayout headerTitle="매장 관리">
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <DotsLoader />
          </View>
        </PageLayout>
        <OwnerBottomNav activeTab="store" navigation={navigation} />
      </View>
    );
  }

  const openTimeStr = (() => {
    const o = info.setting?.open_time?.slice(0, 5);
    const c = info.setting?.close_time?.slice(0, 5);
    if (!o || !c) return "-";
    if (o === "00:00" && c === "00:00") return "24시간 영업";
    return `${o} ~ ${c}`;
  })();

  const holidayStr = (() => {
    const s = info.setting;
    if (!s || s.is_fixed_holiday == null) return "-";
    if (!s.is_fixed_holiday) return "없음";
    if (!s.holiday_days?.length) return "-";
    const days = (s.holiday_days as string[]).join(", ");
    const rawCycle: string = s.holiday_cycle ?? "";
    const isGukju = rawCycle.startsWith("격주");
    const cycleLabel = isGukju ? "격주" : rawCycle;
    const weekPart = isGukju && rawCycle.includes("-") ? ` (${rawCycle.split("-")[1]})` : "";
    return `${cycleLabel}${weekPart} ${days}`.trim();
  })();

  return (
    <FadeScreen>
    <View style={{ flex: 1 }}>
    <PageLayout headerTitle="매장 관리">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 배너 */}
        {bannerVisible && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 2, height: 2 },
              elevation: 2,
              borderWidth: 1,
              borderColor: "#EBEBEB",
              marginBottom: 12,
            }}
          >
            {/* 헤더 그라데이션 영역 */}
            <View
              style={{
                backgroundColor: "#4261FF",
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 16,
              }}
            >
              <AnimatedPressable
                onPress={() => setBannerVisible(false)}
                hitSlop={8}
                scaleAmount={0.97}
                opacityAmount={0.75}
                style={{ position: "absolute", top: 10, right: 12 }}
              >
                <X size={16} color="rgba(255,255,255,0.7)" />
              </AnimatedPressable>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginBottom: 2 }}>
                매장 관리
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                매장의 모든 운영 정보를 한 곳에서 설정해요
              </Text>
            </View>

            {/* 바로가기 목록 */}
            {[
              {
                label: "매장 정보",
                desc: "매장명 · 주소 · 대표자",
                onPress: () => navigation.navigate("OwnerStoreInfoEdit", { storeInfo: info }),
              },
              {
                label: "운영 시간",
                desc: "영업시간 · 휴무일 · 파트",
                onPress: () => navigation.navigate("OwnerStoreHours"),
              },
              {
                label: "근태 기준",
                desc: "출퇴근 거리 · 지각 · 수당",
                onPress: () => navigation.navigate("OwnerAttendanceStandard"),
              },
            ].map(({ label, desc, onPress }, i, arr) => (
              <AnimatedPressable
                key={label}
                onPress={onPress}
                scaleAmount={0.98}
                opacityAmount={0.85}
                style={{ paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: "#F1F2F4", backgroundColor: "#FFFFFF" }}
              >
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B" }}>{label}</Text>
                  <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{desc}</Text>
                </View>
                <ChevronRight size={16} color="#DBDCDF" />
              </AnimatedPressable>
            ))}
          </View>
        )}

        {/* 매장 정보 카드 */}
        <View style={cardStyle}>
          <AnimatedPressable
            onPress={() => navigation.navigate("OwnerStoreInfoEdit", { storeInfo: info })}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Building2 size={20} color="#4261FF" />
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>매장 정보</Text>
            </View>
            <ChevronRight size={20} color="#70737B" />
          </AnimatedPressable>
          <View style={{ borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingTop: 12, gap: 10 }}>
            <InfoRow label="매장명" value={info.name ?? "-"} />
            <InfoRow label="매장코드" value={info.code ?? "-"} isLink onCopy={() => toast({ description: "매장코드가 복사되었어요" })} />
            {expanded && (
              <>
                <InfoRow
                  label="주소"
                  value={`${info.address ?? ""} ${info.address_detail ?? ""}`.trim() || "-"}
                />
                <InfoRow label="업종" value={info.industry ?? "-"} />
                <InfoRow label="대표자명" value={info.owner_name ?? "-"} />
                <InfoRow label="대표번호" value={info.phone ? formatPhone(info.phone) : "-"} />
                <InfoRow label="사업자번호" value={info.rawDigits ?? info.business_number ?? "-"} />
              </>
            )}
          </View>
          <AnimatedPressable
            onPress={() => setExpanded(!expanded)}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12 }}
          >
            <Text style={{ fontSize: 13, color: "#70737B" }}>{expanded ? "접기" : "더보기"}</Text>
            {expanded ? (
              <ChevronUp size={16} color="#70737B" />
            ) : (
              <ChevronDown size={16} color="#70737B" />
            )}
          </AnimatedPressable>
        </View>

        {/* 운영 시간 설정 카드 */}
        <View style={cardStyle}>
          <AnimatedPressable
            onPress={() => navigation.navigate("OwnerStoreHours")}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Clock size={20} color="#4261FF" />
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>운영 시간 설정</Text>
            </View>
            <ChevronRight size={20} color="#70737B" />
          </AnimatedPressable>
          <View style={{ borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingTop: 12, gap: 10 }}>
            <InfoRow label="영업 시간" value={openTimeStr} />
            <InfoRow label="고정 휴무일" value={holidayStr} />
            {(info.shifts ?? []).length > 0 ? (
              (info.shifts as { name: string; start_time?: string; end_time?: string }[]).map((s) => (
                <InfoRow
                  key={s.name}
                  label={s.name}
                  value={s.start_time && s.end_time ? `${s.start_time} ~ ${s.end_time}` : "-"}
                />
              ))
            ) : (
              <InfoRow label="영업 파트" value="-" />
            )}
          </View>
        </View>

        {/* 근태 기준 설정 카드 */}
        <View style={cardStyle}>
          <AnimatedPressable
            onPress={() => navigation.navigate("OwnerAttendanceStandard")}
            scaleAmount={0.97}
            opacityAmount={0.75}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MapPin size={20} color="#4261FF" />
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>근태 기준 설정</Text>
            </View>
            <ChevronRight size={20} color="#70737B" />
          </AnimatedPressable>
          <View style={{ borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingTop: 12, gap: 10 }}>
            <InfoRow
              label="출퇴근 거리"
              value={info.radius != null ? `${info.radius}m` : "-"}
            />
            <InfoRow
              label="지각 기준"
              value={
                info.setting?.late_minutes != null
                  ? `출근시간 +${info.setting.late_minutes}분 초과 시`
                  : "-"
              }
            />
            <InfoRow
              label="연장 수당"
              value={
                info.setting?.has_overtime_pay
                  ? `적용 · ${info.setting.overtime_multiplier}배${info.setting.overtime_threshold_minutes != null ? ` (${info.setting.overtime_threshold_minutes}분 단위)` : ""}`
                  : "미적용"
              }
            />
            <InfoRow
              label="야간 수당"
              value={
                info.setting?.has_night_pay
                  ? `적용 · ${info.setting.night_multiplier}배${info.setting.night_threshold_minutes != null ? ` (${info.setting.night_threshold_minutes}분 단위)` : ""}`
                  : "미적용"
              }
            />
            <InfoRow
              label="휴일 수당"
              value={
                info.setting?.has_holiday_pay
                  ? info.setting.holiday_multiplier_under_8h != null
                    ? `적용 · 8시간 이내 ${info.setting.holiday_multiplier_under_8h}배\n8시간 초과 ${info.setting.holiday_multiplier_over_8h ?? "-"}배${info.setting.holiday_threshold_minutes != null ? ` (${info.setting.holiday_threshold_minutes}분 단위)` : ""}`
                    : "적용"
                  : "미적용"
              }
            />
          </View>
        </View>

      </ScrollView>
    </PageLayout>
    <OwnerBottomNav activeTab="store" navigation={navigation} />
    </View>
    </FadeScreen>
  );
};

const InfoRow: React.FC<{ label: string; value: string; isLink?: boolean; onCopy?: () => void }> = ({
  label,
  value,
  isLink,
  onCopy,
}) => {
  const handlePress = () => {
    if (isLink && onCopy) {
      onCopy();
    }
  };
  return (
    <AnimatedPressable onPress={isLink ? handlePress : undefined} scaleAmount={0.98} opacityAmount={0.85} style={{ flexDirection: "row", gap: 16 }}>
      <Text
        style={{
          fontSize: 14,
          color: "#70737B",
          minWidth: 80,
          flexShrink: 0,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: isLink ? "#4261FF" : "#19191B",
          textDecorationLine: isLink ? "underline" : "none",
          flex: 1,
          flexWrap: "wrap",
        }}
      >
        {value}
      </Text>
    </AnimatedPressable>
  );
};

export default OwnerStoreInfoScreen;
