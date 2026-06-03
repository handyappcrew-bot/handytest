import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, Image,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, withRepeat, withSpring,
  Easing,
} from "react-native-reanimated";
import AnimatedPressable from "@/components/AnimatedPressable";
import { localStorage } from "@/utils/storage";
import { hapticLight, hapticMedium, hapticSuccess } from "@/utils/haptics";
import type { ScreenProps } from "@/navigation/types";

const SYMBOL = require("../../../assets/images/login/symbol.png");
const TYPO   = require("../../../assets/images/login/typo.png");

// ─── Page 4 (결): WelcomeVisual — 핸디 소개 피날레 ───────────────────────────

const WelcomeVisual: React.FC<{ active: boolean }> = ({ active }) => {
  const fired = useRef(false);
  const logoScale = useSharedValue(0.72);
  const logoOp    = useSharedValue(0);
  const ring1     = useSharedValue(1);
  const ring2     = useSharedValue(1);
  const c0        = useSharedValue(0);
  const c1        = useSharedValue(0);
  const c2        = useSharedValue(0);
  const c3        = useSharedValue(0);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;
    hapticLight();
    setTimeout(() => hapticLight(), 290);
    logoOp.value    = withTiming(1, { duration: 400 });
    logoScale.value = withSpring(1, { damping: 9, stiffness: 110 });
    ring1.value = withDelay(300, withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    ));
    ring2.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(1.22, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    ));
    c0.value = withDelay(280, withSpring(1, { damping: 11, stiffness: 120 }));
    c1.value = withDelay(420, withSpring(1, { damping: 11, stiffness: 120 }));
    c2.value = withDelay(560, withSpring(1, { damping: 11, stiffness: 120 }));
    c3.value = withDelay(700, withSpring(1, { damping: 11, stiffness: 120 }));
  }, [active]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value, transform: [{ scale: logoScale.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({ transform: [{ scale: ring1.value }], opacity: 0.28 }));
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ scale: ring2.value }], opacity: 0.14 }));
  const cs0 = useAnimatedStyle(() => ({ opacity: c0.value, transform: [{ scale: 0.86 + 0.14 * c0.value }, { translateY: (1 - c0.value) * 12 }] }));
  const cs1 = useAnimatedStyle(() => ({ opacity: c1.value, transform: [{ scale: 0.86 + 0.14 * c1.value }, { translateY: (1 - c1.value) * 12 }] }));
  const cs2 = useAnimatedStyle(() => ({ opacity: c2.value, transform: [{ scale: 0.86 + 0.14 * c2.value }, { translateY: (1 - c2.value) * 12 }] }));
  const cs3 = useAnimatedStyle(() => ({ opacity: c3.value, transform: [{ scale: 0.86 + 0.14 * c3.value }, { translateY: (1 - c3.value) * 12 }] }));
  const chipStyles = [cs0, cs1, cs2, cs3];

  const CHIPS = [
    { label: "⏰  출퇴근 기록", bg: "#EEF2FF", fg: "#4261FF" },
    { label: "🔔  실시간 알림", bg: "#FFF7ED", fg: "#D97706" },
    { label: "📅  스케줄 관리", bg: "#F5F3FF", fg: "#7C3AED" },
    { label: "💰  급여 자동계산", bg: "#F0FFF4", fg: "#059669" },
  ];

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{
          position: "absolute",
          width: 264, height: 264, borderRadius: 132,
          borderWidth: 1, borderColor: "rgba(66,97,255,0.25)", borderStyle: "dashed",
        }, ring2Style]} />
        <Animated.View style={[{
          position: "absolute",
          width: 210, height: 210, borderRadius: 105,
          borderWidth: 1.5, borderColor: "rgba(66,97,255,0.38)", borderStyle: "dashed",
        }, ring1Style]} />
        <View style={{
          width: 164, height: 164, borderRadius: 82,
          backgroundColor: "#FFFFFF",
          alignItems: "center", justifyContent: "center",
          shadowColor: "#4261FF", shadowOpacity: 0.18, shadowRadius: 28,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        }}>
          <Animated.View style={[{ alignItems: "center", gap: 10 }, logoStyle]}>
            <Image source={SYMBOL} style={{ width: 44, height: 65 }} resizeMode="contain" />
            <Image source={TYPO}   style={{ width: 68, height: 27 }} resizeMode="contain" />
          </Animated.View>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, paddingHorizontal: 24 }}>
        {CHIPS.map((chip, i) => (
          <Animated.View key={chip.label} style={chipStyles[i]}>
            <View style={{
              backgroundColor: chip.bg, borderRadius: 999,
              paddingHorizontal: 16, paddingVertical: 9,
              shadowColor: chip.fg, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
            }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: chip.fg }}>{chip.label}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

// ─── Page 2: ClockInVisual ────────────────────────────────────────────────────
// 승 — 직원 행동: 버튼 하나로 출퇴근 체크

const ClockInVisual: React.FC<{ width: number; active: boolean }> = ({ width, active }) => {
  const fired = useRef(false);
  const [clockedIn, setClockedIn] = useState(false);

  const cardOp   = useSharedValue(0);
  const cardTX   = useSharedValue(26);
  const infoOp   = useSharedValue(0);
  const btnPulse = useSharedValue(1);
  const btnScale = useSharedValue(1);
  const notifTY  = useSharedValue(20);
  const notifOp  = useSharedValue(0);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;

    hapticLight();
    setTimeout(() => hapticMedium(), 1350);
    setTimeout(() => hapticSuccess(), 1490);

    cardOp.value = withTiming(1, { duration: 340 });
    cardTX.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.ease) });
    infoOp.value = withDelay(280, withTiming(1, { duration: 300 }));

    // 버튼 pulse (탭 유도 느낌)
    btnPulse.value = withDelay(650, withSequence(
      withTiming(1.05, { duration: 240 }),
      withTiming(1,    { duration: 240 }),
      withTiming(1.05, { duration: 240 }),
      withTiming(1,    { duration: 240 }),
    ));

    // 버튼 탭 애니메이션
    btnScale.value = withDelay(1350, withSequence(
      withTiming(0.91, { duration: 100 }),
      withTiming(1,    { duration: 100 }),
    ));

    const tid = setTimeout(() => setClockedIn(true), 1470);

    // 사장님 알림 슬라이드 업
    notifTY.value = withDelay(1900, withSpring(0, { damping: 13 }));
    notifOp.value = withDelay(1900, withTiming(1, { duration: 280 }));

    return () => clearTimeout(tid);
  }, [active]);

  const cardStyle   = useAnimatedStyle(() => ({ opacity: cardOp.value, transform: [{ translateX: cardTX.value }] }));
  const infoStyle   = useAnimatedStyle(() => ({ opacity: infoOp.value }));
  const btnStyle    = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value * btnPulse.value }] }));
  const notifStyle  = useAnimatedStyle(() => ({ opacity: notifOp.value, transform: [{ translateY: notifTY.value }] }));

  const cardW = width - 56;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Animated.View style={[{
        width: cardW, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20,
        shadowColor: "#4261FF", shadowOpacity: 0.12, shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 }, elevation: 8,
      }, cardStyle]}>
        {/* 직원 프로필 헤더 */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <View>
            <Text style={{ fontSize: 11, color: "#AAB4BF", marginBottom: 2 }}>안녕하세요 👋</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>홍길동님</Text>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#FFFFFF" }}>홍</Text>
          </View>
        </View>

        {/* 시간 + 상태 */}
        <Animated.View style={[{ marginBottom: 18 }, infoStyle]}>
          <Text style={{ fontSize: 38, fontWeight: "800", color: "#19191B", letterSpacing: -1.5 }}>09:02</Text>
          <Text style={{ fontSize: 12, color: "#AAB4BF", marginTop: 2 }}>2026년 5월 18일 월요일</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: clockedIn ? "#22C55E" : "#DBDCDF" }} />
            <Text style={{ fontSize: 12, fontWeight: "500", color: clockedIn ? "#16A34A" : "#AAB4BF" }}>
              {clockedIn ? "출근 완료" : "아직 출근 전이에요"}
            </Text>
          </View>
        </Animated.View>

        {/* 출근 버튼 */}
        <Animated.View style={btnStyle}>
          <View style={{
            height: 52, borderRadius: 14,
            backgroundColor: clockedIn ? "#22C55E" : "#4261FF",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.3 }}>
              {clockedIn ? "✓  출근 완료" : "출근하기"}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* 사장님에게 전달 알림 */}
      <Animated.View style={[{
        width: cardW, backgroundColor: "#19191B", borderRadius: 14, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 10,
      }, notifStyle]}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Bell size={15} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 1 }}>사장님께 실시간 전달됨</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>홍길동님이 출근했어요</Text>
        </View>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" }} />
      </Animated.View>
    </View>
  );
};

// ─── Page 3: OwnerNotifVisual ─────────────────────────────────────────────────
// 전 — 사장 리턴: 직원 행동이 알림으로 바로 도착

const NOTIF_DATA = [
  {
    initial: "홍", color: "#4261FF",
    type: "근태", typeBg: "#ECFFF1", typeColor: "#16A34A",
    msg: "홍길동님이 출근했어요", sub: "예정 09:00 → 실제 09:02", time: "09:02",
  },
  {
    initial: "이", color: "#7C3AED",
    type: "마감보고", typeBg: "#DCFCE7", typeColor: "#16A34A",
    msg: "이서연님이 마감 보고를 제출했어요", sub: "총 매출 1,570,000원", time: "22:15",
  },
  {
    initial: "박", color: "#D97706",
    type: "대타요청", typeBg: "#FEF3C7", typeColor: "#D97706",
    msg: "박지호님이 대타를 요청했어요", sub: "5월 20일 (수) 오전 9시~", time: "14:30",
  },
];

const OwnerNotifVisual: React.FC<{ width: number; active: boolean }> = ({ width, active }) => {
  const fired  = useRef(false);
  const titleO = useSharedValue(0);
  const n0tx   = useSharedValue(28);  const n0op = useSharedValue(0);
  const n1tx   = useSharedValue(28);  const n1op = useSharedValue(0);
  const n2tx   = useSharedValue(28);  const n2op = useSharedValue(0);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;
    setTimeout(() => hapticLight(), 200);
    setTimeout(() => hapticLight(), 440);
    setTimeout(() => hapticLight(), 680);
    titleO.value = withTiming(1, { duration: 300 });
    n0tx.value = withDelay(180, withTiming(0, { duration: 360, easing: Easing.out(Easing.ease) }));
    n0op.value = withDelay(180, withTiming(1, { duration: 300 }));
    n1tx.value = withDelay(420, withTiming(0, { duration: 360, easing: Easing.out(Easing.ease) }));
    n1op.value = withDelay(420, withTiming(1, { duration: 300 }));
    n2tx.value = withDelay(660, withTiming(0, { duration: 360, easing: Easing.out(Easing.ease) }));
    n2op.value = withDelay(660, withTiming(1, { duration: 300 }));
  }, [active]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleO.value }));
  const ns0 = useAnimatedStyle(() => ({ opacity: n0op.value, transform: [{ translateX: n0tx.value }] }));
  const ns1 = useAnimatedStyle(() => ({ opacity: n1op.value, transform: [{ translateX: n1tx.value }] }));
  const ns2 = useAnimatedStyle(() => ({ opacity: n2op.value, transform: [{ translateX: n2tx.value }] }));
  const notifStyles = [ns0, ns1, ns2];

  const cardW = width - 56;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
      {/* 헤더 라벨 */}
      <Animated.View style={[{ width: cardW, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }, titleStyle]}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E" }}>사장님 알림함</Text>
        <View style={{ backgroundColor: "#FCD34D", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400E" }}>읽지 않음 3</Text>
        </View>
      </Animated.View>

      {/* 알림 카드 3개 */}
      {NOTIF_DATA.map((item, i) => (
        <Animated.View key={item.initial + i} style={[{
          width: cardW, backgroundColor: "#FFFFFF", borderRadius: 14,
          paddingHorizontal: 14, paddingVertical: 12,
          flexDirection: "row", alignItems: "center", gap: 12,
          shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12,
          shadowOffset: { width: 0, height: 3 }, elevation: 3,
        }, notifStyles[i]]}>
          {/* 아바타 */}
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{item.initial}</Text>
          </View>

          {/* 내용 */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <View style={{ backgroundColor: item.typeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: item.typeColor }}>{item.type}</Text>
              </View>
              <Text style={{ fontSize: 11, color: "#AAB4BF" }}>{item.time}</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#19191B" }} numberOfLines={1}>{item.msg}</Text>
            <Text style={{ fontSize: 11, color: "#AAB4BF", marginTop: 2 }} numberOfLines={1}>{item.sub}</Text>
          </View>

          {/* 읽지 않음 도트 */}
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#4261FF" }} />
        </Animated.View>
      ))}
    </View>
  );
};

// ─── Page 4: PayslipVisual ────────────────────────────────────────────────────
// 결 — 최종 가치: 기록이 쌓이면 급여가 자동 완성

const formatKRW = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";

const SALARY_ROWS = [
  { label: "기본급",    value: "1,200,000원", color: "#19191B" },
  { label: "시간외수당", value: "+ 48,000원",  color: "#22C55E" },
  { label: "4대보험",   value: "- 52,000원",  color: "#FF3D3D" },
  { label: "소득세",    value: "- 60,000원",  color: "#FF3D3D" },
];

const PayslipVisual: React.FC<{ width: number; active: boolean }> = ({ width, active }) => {
  const fired = useRef(false);
  const [displayAmt, setDisplayAmt] = useState(0);

  const headerTY  = useSharedValue(-22);
  const headerOp  = useSharedValue(0);
  const r0        = useSharedValue(0);
  const r1        = useSharedValue(0);
  const r2        = useSharedValue(0);
  const r3        = useSharedValue(0);
  const totalScale = useSharedValue(0.88);
  const totalOp   = useSharedValue(0);
  const badgeOp   = useSharedValue(0);
  const badgeS    = useSharedValue(0.8);

  useEffect(() => {
    if (!active || fired.current) return;
    fired.current = true;

    hapticLight();
    setTimeout(() => hapticSuccess(), 800);

    headerTY.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.ease) });
    headerOp.value = withTiming(1, { duration: 320 });

    const TARGET = 1136000;
    let step = 0;
    const STEPS = 40;
    const id = setInterval(() => {
      step++;
      const p = step / STEPS;
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayAmt(Math.round(eased * TARGET));
      if (step >= STEPS) clearInterval(id);
    }, 22);

    r0.value = withDelay(180, withTiming(1, { duration: 220 }));
    r1.value = withDelay(320, withTiming(1, { duration: 220 }));
    r2.value = withDelay(460, withTiming(1, { duration: 220 }));
    r3.value = withDelay(600, withTiming(1, { duration: 220 }));
    totalScale.value = withDelay(760, withSpring(1, { damping: 12 }));
    totalOp.value    = withDelay(760, withTiming(1, { duration: 240 }));
    badgeS.value     = withDelay(980, withSpring(1, { damping: 10 }));
    badgeOp.value    = withDelay(980, withTiming(1, { duration: 220 }));

    return () => clearInterval(id);
  }, [active]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOp.value, transform: [{ translateY: headerTY.value }],
  }));
  const rs0 = useAnimatedStyle(() => ({ opacity: r0.value }));
  const rs1 = useAnimatedStyle(() => ({ opacity: r1.value }));
  const rs2 = useAnimatedStyle(() => ({ opacity: r2.value }));
  const rs3 = useAnimatedStyle(() => ({ opacity: r3.value }));
  const rowStyles = [rs0, rs1, rs2, rs3];
  const totalStyle = useAnimatedStyle(() => ({
    opacity: totalOp.value, transform: [{ scale: totalScale.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOp.value, transform: [{ scale: badgeS.value }],
  }));

  const cardW = width - 56;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <View style={{
        width: cardW, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden",
        shadowColor: "#059669", shadowOpacity: 0.1, shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 }, elevation: 8,
      }}>
        {/* 급여 헤더 */}
        <Animated.View style={[{ backgroundColor: "#4261FF", paddingHorizontal: 20, paddingVertical: 18 }, headerStyle]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 4 }}>2025년 5월 급여 명세서</Text>
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF" }}>{formatKRW(displayAmt)}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>실수령액</Text>
            </View>
            <Animated.View style={[{
              backgroundColor: "#22C55E", borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 4,
            }, badgeStyle]}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>자동 계산</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* 급여 상세 */}
        <View style={{ padding: 18, gap: 11 }}>
          {SALARY_ROWS.map((row, i) => (
            <Animated.View key={row.label} style={[{ flexDirection: "row", justifyContent: "space-between" }, rowStyles[i]]}>
              <Text style={{ fontSize: 13, color: "#70737B" }}>{row.label}</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: row.color }}>{row.value}</Text>
            </Animated.View>
          ))}
          <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />
          <Animated.View style={[{
            backgroundColor: "rgba(66,97,255,0.08)", borderRadius: 10, padding: 12,
            flexDirection: "row", justifyContent: "space-between",
          }, totalStyle]}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#4261FF" }}>실수령액</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#4261FF" }}>1,136,000원</Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

// ─── Pages config ─────────────────────────────────────────────────────────────
// 기승전결: 직원 행동 → 사장 실시간 파악 → 급여 자동화 → 핸디 브랜드 피날레

const PAGES = [
  {
    key: "clockin",
    bg: "#E8EDFF",
    title: "직원은 탭 하나로\n출퇴근을 기록해요",
    description: "스케줄 확인부터 출퇴근 기록까지\n앱 하나로 간편하게 해결해요",
  },
  {
    key: "ownernotif",
    bg: "#FFF3E0",
    title: "사장님은 놓치는 게 없어요",
    description: "직원 출퇴근, 마감 보고, 대타 요청까지\n실시간 알림으로 즉시 파악해요",
  },
  {
    key: "payslip",
    bg: "#E8FFF2",
    title: "급여는 자동으로\n완성되고 전달돼요",
    description: "기록이 쌓이면 급여 명세서가 자동 계산되고\n직원에게 바로 공유돼요",
  },
  {
    key: "welcome",
    bg: "#F0F4FF",
    title: "이제 핸디 하나로\n스마트하게 운영하세요",
    description: "사장님과 직원 모두가 편한\n올인원 매장 관리 앱, 핸디",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const HEADER_H  = 52;
const DOTS_H    = 40;
const BUTTON_H  = 100;

const OnboardingScreen: React.FC<ScreenProps<"Onboarding">> = ({ navigation }) => {
  const { width: rawW, height: H } = useWindowDimensions();
  const W = Math.min(rawW, 430);
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);

  const CONTENT_H = H - insets.top - insets.bottom - HEADER_H - DOTS_H - BUTTON_H;
  const IMAGE_H   = Math.round(CONTENT_H * 0.58);
  const TEXT_H    = CONTENT_H - IMAGE_H;

  const isLast = pageIndex === PAGES.length - 1;

  const translateX = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    translateX.value = withTiming(-W * pageIndex, { duration: 320, easing: Easing.out(Easing.ease) });
  }, [pageIndex, W]);

  const finish = useCallback(() => {
    localStorage.setItem("onboarding_seen", "true");
    navigation.replace("Login");
  }, [navigation]);

  const goNext = useCallback(() => {
    hapticLight();
    if (isLast) { finish(); return; }
    setPageIndex(prev => prev + 1);
  }, [isLast, finish]);

  const renderVisual = (key: string, active: boolean) => {
    if (key === "welcome")    return <WelcomeVisual active={active} />;
    if (key === "clockin")    return <ClockInVisual width={W} active={active} />;
    if (key === "ownernotif") return <OwnerNotifVisual width={W} active={active} />;
    if (key === "payslip")    return <PayslipVisual width={W} active={active} />;
    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* 건너뛰기 */}
      <View style={{ height: HEADER_H, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 24 }}>
        {!isLast && (
          <Pressable onPress={finish} hitSlop={10}>
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#AAB4BF" }}>건너뛰기</Text>
          </Pressable>
        )}
      </View>

      {/* 페이지 도트 (상단) */}
      <View style={{ height: DOTS_H, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === pageIndex ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === pageIndex ? "#4261FF" : "#DBDCDF",
            }}
          />
        ))}
      </View>

      {/* 페이지 슬라이더 */}
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Animated.View style={[{ flexDirection: "row", width: W * PAGES.length, flex: 1 }, slideStyle]}>
          {PAGES.map((item, itemIndex) => (
            <View key={item.key} style={{ width: W, flex: 1 }}>
              {/* 컬러 이미지 패널 */}
              <View style={{ width: W, height: IMAGE_H, backgroundColor: item.bg, overflow: "hidden" }}>
                {renderVisual(item.key, pageIndex === itemIndex)}
              </View>

              {/* 텍스트 영역 */}
              <View style={{ height: TEXT_H, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingTop: 4 }}>
                <Text style={{
                  fontSize: 26, fontWeight: "800", color: "#19191B",
                  lineHeight: 36, textAlign: "center", letterSpacing: -0.7, marginBottom: 12,
                }}>
                  {item.title}
                </Text>
                <Text style={{
                  fontSize: 15, color: "#70737B",
                  lineHeight: 24, textAlign: "center", letterSpacing: -0.2,
                }}>
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* 하단 풀버튼 */}
      <View style={{ height: BUTTON_H, paddingHorizontal: 20, justifyContent: "center" }}>
        <AnimatedPressable
          onPress={goNext}
          scaleAmount={0.97}
          opacityAmount={0.85}
          style={{ height: 56, backgroundColor: "#4261FF", borderRadius: 16, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.34 }}>
            {isLast ? "핸디 시작하기" : "다음"}
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;
