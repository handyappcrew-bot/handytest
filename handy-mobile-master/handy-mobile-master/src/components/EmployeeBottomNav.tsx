import React from "react";
import { View, Text } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, CalendarDays, Wallet, Clock, MessageSquare, User } from "lucide-react-native";
import { localStorage } from "@/utils/storage";

const ALL_TABS = [
  { id: "home",       label: "홈",      icon: Home,          screen: "EmployeeHome" },
  { id: "schedule",   label: "일정확인", icon: CalendarDays,  screen: "EmployeeSchedule" },
  { id: "salary",     label: "급여관리", icon: Wallet,        screen: "EmployeeSalary" },
  { id: "attendance", label: "출근관리", icon: Clock,         screen: "EmployeeAttendance" },
  { id: "board",      label: "게시판",   icon: MessageSquare, screen: "BoardList" },
  { id: "myinfo",     label: "내정보",   icon: User,          screen: "EmployeeProfile" },
] as const;

const ACTIVE_COLOR   = "#4261FF";
const INACTIVE_COLOR = "#9EA3AD";
const NAV_HEIGHT     = 74;

interface Props {
  activeTab: string;
  navigation: any;
}

const EmployeeBottomNav: React.FC<Props> = ({ activeTab, navigation }) => {
  const insets = useSafeAreaInsets();
  const workingStatus = localStorage.getItem("employeeWorkingStatus") ?? "";
  // 퇴사 시 게시판 탭 제거 (B6/B7 납품 후 자동 활성화)
  const TABS = workingStatus === "퇴사"
    ? ALL_TABS.filter((t) => t.id !== "board")
    : ALL_TABS;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: NAV_HEIGHT + insets.bottom,
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#EBEBEB",
        paddingBottom: insets.bottom,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
          const Icon = tab.icon;
          return (
            <AnimatedPressable
              key={tab.id}
              scaleAmount={0.88}
              opacityAmount={0.7}
              onPress={() => {
                if (activeTab === tab.id) return;
                navigation.navigate(tab.screen as any);
              }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}
              hitSlop={4}
            >
              <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={color} strokeWidth={isActive ? 2.2 : 1.8} />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? "600" : "400",
                  color,
                  letterSpacing: -0.2,
                }}
              >
                {tab.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
};

export default EmployeeBottomNav;
