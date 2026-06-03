import React, { useEffect, useState } from "react";
import { View, Text, Switch, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "@/components/Toast";
import { getPushSettings, updatePushSettings } from "@/api/auth";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

const CATEGORY_LABELS: Record<string, string> = {
  // 공통
  salary:             "급여 알림",
  board:              "게시판 알림",
  service:            "서비스 알림",
  // 직원 전용
  schedule:           "일정 알림",
  notice:             "공지 알림",
  attendance:         "근태 알림",
  store:              "매장 알림",
  // 사장 전용
  schedule_change:    "일정 알림",
  closing_report:     "마감 보고 알림",
  staff_mgmt:         "직원 관리 알림",
  probation_end:      "수습 종료 알림",
};

const OWNER_ORDER = [
  "schedule_change",
  "closing_report",
  "staff_mgmt",
  "probation_end",
  "salary",
  "board",
  "service",
];

const EMPLOYEE_ORDER = [
  "schedule",
  "salary",
  "notice",
  "board",
  "attendance",
  "store",
  "service",
];

const PushNotificationSettingScreen: React.FC<ScreenProps<"PushNotificationSetting">> = ({ navigation }) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const isOwner = localStorage.getItem("currentRole") === "owner";
  const CATEGORY_ORDER = isOwner ? OWNER_ORDER : EMPLOYEE_ORDER;

  useEffect(() => {
    getPushSettings()
      .then(setSettings)
      .catch(() => toast({ description: "설정을 불러올 수 없어요.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    const prev = settings[key];
    setSettings(s => ({ ...s, [key]: value }));
    setSaving(key);
    try {
      const updated = await updatePushSettings({ [key]: value });
      setSettings(updated);
    } catch {
      setSettings(s => ({ ...s, [key]: prev }));
      toast({ description: "설정 변경에 실패했어요.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const orderedKeys = CATEGORY_ORDER.filter(k => k in settings);
  const extraKeys = Object.keys(settings).filter(k => !CATEGORY_ORDER.includes(k) && !(isOwner ? EMPLOYEE_ORDER : OWNER_ORDER).includes(k));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>푸시 알림 설정</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4261FF" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: "#9EA3AD", lineHeight: 20 }}>
              각 카테고리별 푸시 알림 수신 여부를 설정할 수 있어요.
            </Text>
          </View>

          {[...orderedKeys, ...extraKeys].map((key, idx) => {
            const label = CATEGORY_LABELS[key] ?? key;
            const isOn = settings[key] ?? true;
            const isSaving = saving === key;
            return (
              <View key={key}>
                {idx > 0 && <View style={{ height: 1, backgroundColor: "#F7F7F8", marginHorizontal: 20 }} />}
                <View style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingHorizontal: 20, paddingVertical: 16,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B", letterSpacing: -0.3 }}>
                      {label}
                    </Text>
                  </View>
                  <Switch
                    value={isOn}
                    onValueChange={(v) => { if (!isSaving) handleToggle(key, v); }}
                    trackColor={{ false: "#DBDCDF", true: "#4261FF" }}
                    thumbColor="#FFFFFF"
                    disabled={isSaving}
                    style={{ opacity: isSaving ? 0.5 : 1 }}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default PushNotificationSettingScreen;
