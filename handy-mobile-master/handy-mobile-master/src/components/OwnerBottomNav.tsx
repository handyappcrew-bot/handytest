import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  Home, CalendarDays, Clock, TrendingUp,
  Wallet, Users, Store, FileText, User,
} from "lucide-react-native";
import { localStorage } from "@/utils/storage";
import { getMemberRequests, getOwnerScheduleRequests, getOwnerWorklogRequests } from "@/api/owner";
import { badgeEvents } from "@/utils/badgeEvents";

const TABS = [
  { id: "home",       label: "홈",      icon: Home,         screen: "OwnerHome"                 },
  { id: "schedule",   label: "일정관리", icon: CalendarDays, screen: "OwnerScheduleManagement"   },
  { id: "attendance", label: "근태관리", icon: Clock,        screen: "OwnerAttendanceManagement" },
  { id: "sales",      label: "매출관리", icon: TrendingUp,   screen: "OwnerSalesManagement"      },
  { id: "salary",     label: "급여관리", icon: Wallet,       screen: "OwnerSalaryManagement"     },
  { id: "staff",      label: "직원관리", icon: Users,        screen: "OwnerStaffManagement"      },
  { id: "store",      label: "매장관리", icon: Store,        screen: "OwnerStoreInfo"            },
  { id: "board",      label: "게시판",   icon: FileText,     screen: "BoardList"                 },
  { id: "myinfo",     label: "내정보",   icon: User,         screen: "OwnerProfile"              },
] as const;

const ACTIVE_COLOR   = "#4261FF";
const INACTIVE_COLOR = "#9EA3AD";
const NAV_HEIGHT     = 74;
const SCREEN_W       = Dimensions.get("window").width;
const TAB_MIN_W      = 72;

// navigation.reset()으로 컴포넌트가 언마운트/리마운트돼도 스크롤 위치 유지
let _cachedScrollX = 0;

function estimateScrollX(tabId: string): number {
  const idx = TABS.findIndex(t => t.id === tabId);
  if (idx <= 0) return 0;
  return Math.max(0, idx * TAB_MIN_W - (SCREEN_W / 2 - TAB_MIN_W / 2));
}

interface Props {
  activeTab: string;
  navigation: any;
}

const OwnerBottomNav: React.FC<Props> = ({ activeTab, navigation }) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const [badges, setBadges] = useState<Record<string, boolean>>({});
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const fetchBadges = useCallback(() => {
    if (!storeId) return;
    Promise.allSettled([
      getMemberRequests(storeId),
      getOwnerScheduleRequests(storeId),
      getOwnerWorklogRequests(storeId),
    ]).then(([members, schedules, worklogs]) => {
      const b: Record<string, boolean> = {};
      if (members.status === "fulfilled") {
        const list = Array.isArray(members.value) ? members.value : [];
        b.staff = list.length > 0;
      }
      if (schedules.status === "fulfilled") {
        const list = Array.isArray(schedules.value) ? schedules.value : [];
        b.schedule = list.some((r: any) => r.status === "pending");
      }
      if (worklogs.status === "fulfilled") {
        const list = Array.isArray(worklogs.value) ? worklogs.value : [];
        b.attendance = list.some((r: any) => r.status === "pending");
      }
      setBadges(b);
    });
  }, [storeId]);

  // 화면 포커스 시마다 갱신 (다른 화면에서 돌아올 때)
  useFocusEffect(useCallback(() => { fetchBadges(); }, [fetchBadges]));

  // 같은 화면 내 액션 완료 시 즉시 갱신 (이벤트 버스)
  useEffect(() => badgeEvents.subscribe(fetchBadges), [fetchBadges]);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // 정확한 레이아웃 기반 스크롤 (onLayout 완료 후 유효)
  const scrollToActive = useCallback(() => {
    const layout = tabLayouts.current[activeTabRef.current];
    if (!layout) return;
    const targetX = Math.max(0, layout.x - (SCREEN_W / 2 - layout.width / 2));
    scrollRef.current?.scrollTo({ x: targetX, animated: false });
  }, []);

  // 마운트 후 80ms 대기 → onLayout이 tabLayouts를 채운 뒤 정밀 보정
  useEffect(() => {
    const t = setTimeout(scrollToActive, 80);
    return () => clearTimeout(t);
  }, []);

  // activeTab이 바뀔 때 (reset() 없이 전환되는 드문 경우 대비)
  useEffect(() => {
    scrollToActive();
  }, [activeTab]);

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: NAV_HEIGHT + insets.bottom,
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#EBEBEB",
        paddingBottom: insets.bottom,
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "stretch" }}
        // 탭 전환 시 onPress에서 미리 저장한 정확한 위치 복원
        contentOffset={{ x: _cachedScrollX || estimateScrollX(activeTab), y: 0 }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
          const Icon = tab.icon;
          return (
            <AnimatedPressable
              key={tab.id}
              scaleAmount={0.88}
              opacityAmount={0.7}
              onLayout={(e) => {
                tabLayouts.current[tab.id] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
              }}
              onPress={() => {
                if (activeTab === tab.id) return;
                // 언마운트 전에 목표 스크롤 위치 저장 → 리마운트 시 contentOffset으로 복원
                const layout = tabLayouts.current[tab.id];
                _cachedScrollX = layout
                  ? Math.max(0, layout.x - (SCREEN_W / 2 - layout.width / 2))
                  : estimateScrollX(tab.id);
                if (tab.id === "home") {
                  navigation.reset({ index: 0, routes: [{ name: "OwnerHome" }] });
                } else {
                  navigation.reset({ index: 1, routes: [{ name: "OwnerHome" }, { name: tab.screen as any }] });
                }
              }}
              style={{
                minWidth: TAB_MIN_W,
                height: NAV_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                paddingHorizontal: 8,
              }}
              hitSlop={4}
            >
              <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={color} strokeWidth={isActive ? 2.2 : 1.8} />
                {badges[tab.id] && (
                  <View style={{
                    position: "absolute", top: 0, right: 0,
                    width: 7, height: 7, borderRadius: 3.5,
                    backgroundColor: "#FF3D3D",
                    borderWidth: 1.5, borderColor: "#FFFFFF",
                  }} />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? "600" : "400",
                  color,
                  letterSpacing: -0.2,
                  textAlign: "center",
                }}
              >
                {tab.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default OwnerBottomNav;
