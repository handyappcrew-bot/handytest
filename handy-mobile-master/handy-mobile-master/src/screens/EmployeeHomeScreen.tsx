import React, { useCallback, useEffect, useRef, useState } from "react";
import { useScrollToTop, useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, Modal, ActivityIndicator, StyleSheet, Linking, Image, useWindowDimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS, withTiming, withRepeat, withSequence, Easing } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import Svg, { Image as SvgImage, Defs, ClipPath, Path } from "react-native-svg";

import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import EmployeeHomeSkeleton from "@/components/EmployeeHomeSkeleton";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Check, ChevronDown, ChevronRight, Clock, Menu, Plus, User, X } from "lucide-react-native";
import { getMe, getMyStores, MyStore } from "@/api/auth";
import { getShiftStyle, inferShiftName } from "@/utils/shiftStyles";
import {
  getTodayWork, getWorkStatus, getWeeklyWork, getMyWorkLogs,
  getSalaryPreview, clockIn, clockOut, breakStart, breakEnd,
  getStoreNotice, checkClosingReport, getMyEmployeeInfo, getEmployeeStoreInfo,
} from "@/api/employee";
import { getNotifications, markNotificationRead, NotificationItem } from "@/api/public";
import { logout } from "@/api/auth";
import { api } from "@/api/client";
import { localStorage } from "@/utils/storage";
import { hapticHeavy, hapticSelection } from "@/utils/haptics";
import { updateBadge, clearBadge, scheduleClockOutReminder, cancelClockOutReminder, fireUnclosedShiftNotification } from "@/utils/push";
import BottomSheet from "@/components/BottomSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import SideMenu from "@/components/SideMenu";
import { useToast } from "@/components/Toast";
import { useNavToast } from "@/components/NavToast";
import EmployeeBottomNav from "@/components/EmployeeBottomNav";
import LeaveBanner from "@/components/LeaveBanner";
import { getCurrentLocation, isWithinRadius, distanceMeters, requestLocationPermission, GpsError } from "@/utils/gps";
import { registerForPushNotifications } from "@/utils/push";
import { requestReviewIfEligible } from "@/utils/inAppReview";
import WebView from "@/shims/WebView";
import Constants from "expo-constants";
import AdMobNative from "@/components/AdMobNative";
import type { ScreenProps } from "@/navigation/types";

const ICON_IMG = require("../assets/icon.png");
const ICON_IMG_URI: string = typeof Image.resolveAssetSource === "function"
  ? Image.resolveAssetSource(ICON_IMG).uri
  : (typeof ICON_IMG === "string" ? ICON_IMG : "");
const PULL_THRESHOLD        = 80;
const INDICATOR_SIZE        = 52;
const INDICATOR_CONTAINER_H = 96;
const ICON_MARGIN_BOTTOM    = 20;
const ICON_APPEAR_PROGRESS  = ICON_MARGIN_BOTTOM / INDICATOR_CONTAINER_H;
const WAVE_A = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus =
  | "holiday" | "before_work" | "late" | "absent"
  | "working" | "on_break" | "break_done" | "overtime" | "off_work";

interface DaySchedule {
  day: string; date: number;
  isToday: boolean; isWeekend: boolean;
  startTime?: string; endTime?: string; shiftName?: string;
}

interface TodoItem {
  id: number;
  content: string;
  is_done: boolean;
}

interface StoreNotice {
  id: number;
  author_name?: string;
  created_at?: string;
  content?: string;
  title?: string;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { hours: h, minutes: m };
};

const toSec = (t: string) => { const p = parseTime(t); return p.hours * 3600 + p.minutes * 60; };

const getMinsBetween = (a: string, b: string) => {
  const s = parseTime(a), e = parseTime(b);
  let mins = (e.hours * 60 + e.minutes) - (s.hours * 60 + s.minutes);
  if (mins < 0) mins += 1440; // midnight-crossing schedule
  return mins;
};

const fmtDuration = (mins: number) => {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

const fmtDurationKo = (mins: number) => {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  if (h > 0 && m > 0) return `${h}시간 ${String(m).padStart(2, "0")}분`;
  if (h > 0) return `${h}시간 00분`;
  return `${m}분`;
};

const formatDate = () => {
  const now = new Date();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
};

const getShiftLabel = (start?: string, shiftName?: string) => {
  if (shiftName) return shiftName;
  if (!start) return "무일정";
  return inferShiftName(start) || "무일정";
};

// ─── AttendanceCard ───────────────────────────────────────────────────────────

const BADGE_COLORS: Record<AttendanceStatus, { bg: string; text: string }> = {
  holiday:    { bg: "#F4F5F8", text: "#70737B" },
  before_work:{ bg: "#F4F5F8", text: "#70737B" },
  late:       { bg: "#FFEEE2", text: "#FF862D" },
  absent:     { bg: "#FFEAE6", text: "#FF3D3D" },
  working:    { bg: "#E5F9EC", text: "#10C97D" },
  on_break:   { bg: "#EEE5FF", text: "#8A61FF" },
  break_done: { bg: "#E5F9EC", text: "#10C97D" },
  overtime:   { bg: "rgba(66,97,255,0.1)", text: "#4261FF" },
  off_work:   { bg: "rgba(66,97,255,0.1)", text: "#4261FF" },
};

const BADGE_LABELS: Record<AttendanceStatus, string> = {
  holiday: "휴일", before_work: "근무전", late: "지각", absent: "결근",
  working: "근무중", on_break: "휴게중", break_done: "근무중",
  overtime: "퇴근", off_work: "퇴근",
};

interface AttendanceCardProps {
  status: AttendanceStatus;
  scheduleStart?: string; scheduleEnd?: string;
  clockInTime?: string; breakStartTime?: string; breakEndTime?: string;
  wasLate?: boolean; wasAbsent?: boolean;
  onClockIn: () => void; onClockOut: () => void;
  onBreakStart: () => void; onBreakEnd: () => void;
  onSubstituteClockIn: () => void;
}

const AttendanceCardNative: React.FC<AttendanceCardProps> = ({
  status, scheduleStart, scheduleEnd, clockInTime,
  breakStartTime, breakEndTime, wasLate, wasAbsent,
  onClockIn, onClockOut, onBreakStart, onBreakEnd, onSubstituteClockIn,
}) => {
  const [now, setNow] = useState(new Date());
  const [barWidth, setBarWidth] = useState(0);
  const [showBreakStartConfirm, setShowBreakStartConfirm] = useState(false);
  const [showBreakEndConfirm, setShowBreakEndConfirm] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const totalMins = (scheduleStart && scheduleEnd) ? getMinsBetween(scheduleStart, scheduleEnd) : 0;
  const totalSec = totalMins * 60;
  const schedStartSec = scheduleStart ? toSec(scheduleStart) : 0;
  const rawSchedEndSec = scheduleEnd ? toSec(scheduleEnd) : 0;
  const isMidnightCross = scheduleStart && scheduleEnd && rawSchedEndSec < schedStartSec;
  const schedEndSec = isMidnightCross ? rawSchedEndSec + 86400 : rawSchedEndSec;
  const rawNowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const nowSec = (isMidnightCross && rawNowSec < rawSchedEndSec) ? rawNowSec + 86400 : rawNowSec;

  const progress = (() => {
    if (["holiday", "before_work"].includes(status)) return 0;
    if (["absent", "off_work", "overtime"].includes(status)) return 100;
    if (wasAbsent) return 0;
    return totalSec > 0
      ? Math.min(100, Math.max(0, ((nowSec - schedStartSec) / totalSec) * 100))
      : 0;
  })();

  const lateW = (() => {
    if (!wasLate || !clockInTime) return 0;
    const ci = parseTime(clockInTime);
    const ciSec = ci.hours * 3600 + ci.minutes * 60;
    return Math.max(0, Math.min(100, ((ciSec - schedStartSec) / totalSec) * 100));
  })();

  const breakSeg = (() => {
    if (!breakStartTime || !clockInTime || !scheduleEnd) return null;
    const barTotal = schedEndSec - schedStartSec;
    const adjBreakSec = (t: string) => {
      const p = parseTime(t);
      const s = p.hours * 3600 + p.minutes * 60;
      return (isMidnightCross && s < rawSchedEndSec) ? s + 86400 : s;
    };
    const bsOff = (adjBreakSec(breakStartTime) - schedStartSec) / barTotal * 100;
    const beOff = breakEndTime
      ? (adjBreakSec(breakEndTime) - schedStartSec) / barTotal * 100
      : (nowSec - schedStartSec) / barTotal * 100;
    return { left: Math.max(0, bsOff), width: Math.max(0, beOff - bsOff) };
  })();

  const greenStart = wasLate ? lateW : 0;
  const greenProgress = Math.max(0, progress - greenStart);
  const bsp = breakSeg?.left ?? 0;
  const bep = breakSeg ? breakSeg.left + breakSeg.width : 0;
  const workBefore = breakSeg ? Math.max(0, Math.min(greenProgress, bsp - greenStart)) : greenProgress;
  const breakW = breakSeg ? Math.max(0, Math.min(progress, bep) - bsp) : 0;
  const workAfter = breakSeg ? Math.max(0, progress - bep) : 0;
  const completedBreakMins = (breakStartTime && breakEndTime) ? Math.max(0, getMinsBetween(breakStartTime, breakEndTime)) : 0;

  // Real-time overtime: child re-renders every second, parent may not — override locally
  const rtStatus: AttendanceStatus = (() => {
    if ((status === "working" || status === "break_done") && !wasAbsent && schedEndSec > 0 && nowSec >= schedEndSec)
      return "overtime";
    return status;
  })();

  // 매장에서 연장수당을 설정하지 않은 경우 연장 상태를 표시하지 않음
  const hasOvertimePay = localStorage.getItem("storeHasOvertimePay") === "true";
  const hasNightPay = localStorage.getItem("storeHasNightPay") === "true";
  const displayStatus: AttendanceStatus = (!hasOvertimePay && rtStatus === "overtime") ? "working" : rtStatus;

  const workFill = ["absent"].includes(displayStatus) ? "#FF3D3D" : ["late"].includes(displayStatus) ? "#FF862D" : ["overtime", "off_work"].includes(displayStatus) ? "#4261FF" : "#10C97D";

  const getMessage = () => {
    switch (displayStatus) {
      case "holiday": return "등록된 근무 일정이 없어요 😂";
      case "before_work": case "late": case "absent": return "오늘은 근무 일정이 있는 날이에요 🙌";
      case "working": case "break_done": {
        if (!clockInTime) return "근무중이에요";
        const ci = parseTime(clockInTime);
        const elapsed = (now.getHours() * 60 + now.getMinutes()) - (ci.hours * 60 + ci.minutes);
        if (wasAbsent) return `${fmtDurationKo(Math.max(0, elapsed))} 근무 했어요`;
        if (totalMins === 0) return `${fmtDurationKo(Math.max(0, elapsed))}째 근무중이에요`;
        const rem = totalMins - elapsed;
        return rem <= 0 ? "퇴근 시간이 되었어요!" : `퇴근까지 ${fmtDurationKo(rem)} 남았어요`;
      }
      case "on_break": {
        if (!breakStartTime) return "휴게중이에요 ☕";
        const bs = parseTime(breakStartTime);
        const bMins = (now.getHours() * 60 + now.getMinutes()) - (bs.hours * 60 + bs.minutes);
        return `${bMins}분째 휴게중이에요 ☕`;
      }
      case "overtime": {
        if (!scheduleEnd) return "퇴근 시간이 초과 되었어요⏳";
        const se = parseTime(scheduleEnd);
        const over = (now.getHours() * 60 + now.getMinutes()) - (se.hours * 60 + se.minutes);
        return `퇴근 시간이 ${Math.max(0, over)}분 초과 되었어요⏳`;
      }
      case "off_work": return "오늘 근무도 수고하셨어요!";
    }
  };

  const getDurationLabel = () => {
    if (["holiday", "before_work", "late", "absent"].includes(displayStatus)) return fmtDuration(totalMins);
    if (displayStatus === "overtime") {
      if (!scheduleEnd) return fmtDuration(0);
      const se = parseTime(scheduleEnd);
      const overMins = (now.getHours() * 60 + now.getMinutes()) - (se.hours * 60 + se.minutes);
      return `+ ${fmtDuration(Math.max(0, overMins))}`;
    }
    if (displayStatus === "off_work") return fmtDuration(0);
    if (!clockInTime) return fmtDuration(totalMins);
    const ci = parseTime(clockInTime);
    const el = (now.getHours() * 60 + now.getMinutes()) - (ci.hours * 60 + ci.minutes);
    return fmtDuration(Math.max(0, totalMins - el));
  };

  const badge = BADGE_COLORS[displayStatus];
  const leftLabel = ["holiday", "before_work", "late", "absent"].includes(displayStatus)
    ? scheduleStart : (clockInTime || scheduleStart);
  const leftColor = ["holiday", "before_work", "late"].includes(displayStatus) ? "#93989E"
    : displayStatus === "absent" ? "#FF3D3D"
    : ["overtime", "off_work"].includes(displayStatus) ? "#4261FF" : "#10C97D";
  const rightColor = ["overtime", "off_work"].includes(displayStatus) ? "#4261FF" : "#93989E";
  const durBg = displayStatus === "on_break" ? "#EEE5FF"
    : ["overtime", "off_work"].includes(displayStatus) ? "#D3DAFF"
    : ["working", "break_done"].includes(displayStatus) ? "#E5F9EC" : "#DBDCDF";
  const durColor = displayStatus === "on_break" ? "#8A61FF"
    : ["overtime", "off_work"].includes(displayStatus) ? "#4261FF"
    : ["working", "break_done"].includes(displayStatus) ? "#10C97D" : "#93989E";

  return (
    <View style={{ marginHorizontal: 20, borderRadius: 16, backgroundColor: "#FFFFFF", padding: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
      {/* Badge */}
      <View style={{ height: 28, borderRadius: 14, paddingHorizontal: 10, backgroundColor: badge.bg, alignSelf: "flex-start", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: badge.text }}>{BADGE_LABELS[status]}</Text>
      </View>

      {/* Message */}
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#292B2E", marginBottom: 4 }}>{getMessage()}</Text>

      {/* Clock */}
      <Text style={{ fontSize: 42, fontWeight: "700", color: "#19191B", letterSpacing: -1, marginBottom: 16, lineHeight: 50 }}>{timeStr}</Text>

      {/* Time bar labels */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 14, color: leftColor }}>{leftLabel}</Text>
        <View style={{ height: 20, borderRadius: 16, paddingHorizontal: 6, backgroundColor: durBg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, flexShrink: 0 }}>
          <Clock size={10} color={durColor} />
          <Text numberOfLines={1} style={{ fontSize: 12, color: durColor }}>{getDurationLabel()}</Text>
        </View>
        {!wasAbsent && <Text style={{ fontSize: 14, color: rightColor }}>{scheduleEnd}</Text>}
      </View>

      {/* Progress bar — onLayout으로 픽셀 계산 (Android Fabric % 문자열 불안정) */}
      <View
        style={{ height: 8, borderRadius: 99, backgroundColor: "#EBEBEB", overflow: "hidden", marginBottom: 20 }}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {barWidth > 0 && lateW > 0 && (
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.min(progress, lateW) / 100 * barWidth, backgroundColor: "#FF862D" }} />
        )}
        {barWidth > 0 && workBefore > 0 && (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: greenStart / 100 * barWidth, width: workBefore / 100 * barWidth, backgroundColor: workFill }} />
        )}
        {barWidth > 0 && breakW > 0 && (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: bsp / 100 * barWidth, width: breakW / 100 * barWidth, backgroundColor: "#8A61FF" }} />
        )}
        {barWidth > 0 && workAfter > 0 && (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: bep / 100 * barWidth, width: workAfter / 100 * barWidth, backgroundColor: workFill }} />
        )}
      </View>

      <ConfirmDialog
        visible={showBreakStartConfirm}
        onClose={() => setShowBreakStartConfirm(false)}
        title="휴게 시작"
        description="휴게를 시작할까요?"
        buttons={[
          { label: "취소", onPress: () => setShowBreakStartConfirm(false), variant: "cancel" },
          { label: "휴게 시작하기", onPress: () => { setShowBreakStartConfirm(false); onBreakStart(); } },
        ]}
      />
      <ConfirmDialog
        visible={showBreakEndConfirm}
        onClose={() => setShowBreakEndConfirm(false)}
        title="휴게 종료"
        description="휴게를 종료할까요?"
        buttons={[
          { label: "취소", onPress: () => setShowBreakEndConfirm(false), variant: "cancel" },
          { label: "휴게 종료하기", onPress: () => { setShowBreakEndConfirm(false); onBreakEnd(); } },
        ]}
      />

      {/* Buttons */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {rtStatus === "holiday" && (
          <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={onSubstituteClockIn} style={[BTN_PRIMARY, { flex: 1 }]}>
            <Text style={BTN_PRIMARY_TXT}>무일정 출근하기</Text>
          </AnimatedPressable>
        )}
        {["before_work", "late", "absent"].includes(rtStatus) && (
          <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={onClockIn} style={[BTN_PRIMARY, { flex: 1 }]}>
            <Text style={BTN_PRIMARY_TXT}>출근하기</Text>
          </AnimatedPressable>
        )}
        {displayStatus === "working" && (
          <>
            <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={() => setShowBreakStartConfirm(true)} style={[BTN_PRIMARY, { flex: 1 }]}>
              <Text style={BTN_PRIMARY_TXT}>휴게 시작하기</Text>
            </AnimatedPressable>
            <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={onClockOut} style={[BTN_SECONDARY, { flex: 1 }]}>
              <Text style={BTN_SECONDARY_TXT}>퇴근하기</Text>
            </AnimatedPressable>
          </>
        )}
        {rtStatus === "on_break" && (
          <>
            <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={() => setShowBreakEndConfirm(true)} style={[BTN_PRIMARY, { flex: 1 }]}>
              <Text style={BTN_PRIMARY_TXT}>휴게 종료하기</Text>
            </AnimatedPressable>
            <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={onClockOut} style={[BTN_SECONDARY, { flex: 1 }]}>
              <Text style={BTN_SECONDARY_TXT}>퇴근하기</Text>
            </AnimatedPressable>
          </>
        )}
        {rtStatus === "break_done" && (
          <>
            <View style={[BTN_DISABLED, { flex: 1 }]}>
              <Text style={BTN_DISABLED_TXT}>{completedBreakMins}분 휴게 완료</Text>
            </View>
            <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={onClockOut} style={[BTN_SECONDARY, { flex: 1 }]}>
              <Text style={BTN_SECONDARY_TXT}>퇴근하기</Text>
            </AnimatedPressable>
          </>
        )}
        {displayStatus === "overtime" && (
          <>
            {completedBreakMins > 0 && (
              <View style={[BTN_DISABLED, { flex: 1 }]}>
                <Text style={BTN_DISABLED_TXT}>{completedBreakMins}분 휴게 완료</Text>
              </View>
            )}
            <AnimatedPressable scaleAmount={0.97} opacityAmount={0.75} onPress={onClockOut} style={[BTN_PRIMARY, completedBreakMins > 0 ? { flex: 1 } : { width: "100%" }]}>
              <Text style={BTN_PRIMARY_TXT}>퇴근하기</Text>
            </AnimatedPressable>
          </>
        )}
        {displayStatus === "off_work" && (
          <View style={[BTN_DISABLED, { flex: 1 }]}>
            <Text style={BTN_DISABLED_TXT}>근무완료</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const BTN_BASE = { height: 48, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const };
const BTN_PRIMARY = { ...BTN_BASE, backgroundColor: "#4261FF" };
const BTN_PRIMARY_TXT = { fontSize: 16, fontWeight: "600" as const, color: "#FFFFFF" };
const BTN_SECONDARY = { ...BTN_BASE, backgroundColor: "#DEEBFF" };
const BTN_SECONDARY_TXT = { fontSize: 16, fontWeight: "600" as const, color: "#4261FF" };
const BTN_DISABLED = { ...BTN_BASE, backgroundColor: "#DBDCDF" };
const BTN_DISABLED_TXT = { fontSize: 16, fontWeight: "600" as const, color: "#93989E" };

// ─── ChecklistSection ─────────────────────────────────────────────────────────

interface ChecklistSectionProps {
  userName: string;
  items: TodoItem[];
  onToggle: (item: TodoItem) => void;
}

const ChecklistSectionNative: React.FC<ChecklistSectionProps> = ({ userName, items, onToggle }) => {
  const doneCount = items.filter((i) => i.is_done).length;
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Title */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>오늘 할 일</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>
          <Text style={{ color: "#4261FF" }}>체크리스트</Text>
          <Text>를 확인 해주세요</Text>
        </Text>
      </View>
      {/* Card */}
      <View style={{ borderRadius: 16, backgroundColor: "#FFFFFF", padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#444444", marginBottom: 12, letterSpacing: -0.16 }}>
          {userName} 님의 체크리스트{" "}
          <Text style={{ color: "#70737B" }}>
            (<Text style={{ color: "#10C97D" }}>{doneCount}</Text>/{items.length})
          </Text>
        </Text>
        <View style={{ height: 1, backgroundColor: "#EBEBEB", marginBottom: 12 }} />
        {items.length === 0 ? (
          <Text style={{ fontSize: 14, color: "#AAB4BF", textAlign: "center", paddingVertical: 16 }}>오늘의 체크리스트가 없어요</Text>
        ) : (
          items.map((item) => (
            <AnimatedPressable
              key={item.id}
              onPress={() => onToggle(item)}
              scaleAmount={0.98}
              opacityAmount={0.85}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: item.is_done ? "#E5F9EC" : "#F7F7F8", paddingHorizontal: 16, marginBottom: 10, borderWidth: item.is_done ? 1 : 0, borderColor: "#10C97D" }}
            >
              {/* Circle */}
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: item.is_done ? "#10C97D" : "#FFFFFF",
                borderWidth: item.is_done ? 0 : 1,
                borderColor: item.is_done ? "#10C97D" : "#DBDCDF",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Check size={14} color={item.is_done ? "#FFFFFF" : "#DBDCDF"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: item.is_done ? "#10C97D" : "#70737B" }}>
                  {item.content}
                </Text>
              </View>
            </AnimatedPressable>
          ))
        )}
      </View>
    </View>
  );
};


// ─── StoreNotices ─────────────────────────────────────────────────────────────

const formatNoticeTime = (createdAt?: string): string => {
  if (!createdAt) return "";
  try {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  } catch {
    return "";
  }
};

interface StoreNoticesProps {
  notices: StoreNotice[];
  onPressMore: () => void;
  onPressItem: (id: number) => void;
}

const StoreNoticesNative: React.FC<StoreNoticesProps> = ({ notices, onPressMore, onPressItem }) => (
  <View style={{ paddingHorizontal: 20 }}>
    {/* Title row */}
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
      <View>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>새롭게 등록된</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>
          <Text style={{ color: "#4261FF" }}>매장 공지</Text>
          <Text>가 있어요</Text>
        </Text>
      </View>
      <AnimatedPressable onPress={onPressMore} style={{ flexDirection: "row", alignItems: "center" }} scaleAmount={0.92} opacityAmount={0.7}>
        <Text style={{ fontSize: 14, color: "#9EA3AD" }}>더보기</Text>
        <ChevronRight size={14} color="#9EA3AD" />
      </AnimatedPressable>
    </View>
    {/* Notice list */}
    {notices.length === 0 ? (
      <View style={{ borderRadius: 12, backgroundColor: "#FFFFFF", padding: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
        <Text style={{ fontSize: 14, color: "#AAB4BF" }}>등록된 매장 공지가 없어요</Text>
      </View>
    ) : (
      notices.slice(0, 3).map((notice) => (
        <AnimatedPressable
          key={notice.id}
          onPress={() => onPressItem(notice.id)}
          scaleAmount={0.98}
          opacityAmount={0.85}
          style={{ borderRadius: 12, backgroundColor: "#FFFFFF", padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2, marginBottom: 12 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* Avatar */}
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "#F4F5F8", alignItems: "center", justifyContent: "center" }}>
              <User size={20} color="#9EA3AD" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{notice.author_name ?? "관리자"}</Text>
                <Text style={{ fontSize: 12, color: "#9EA3AD" }}>{formatNoticeTime(notice.created_at)}</Text>
              </View>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: "#19191B", marginTop: 4 }}>
                {notice.title ?? notice.content ?? ""}
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      ))
    )}
  </View>
);

// ─── WeeklySchedule ───────────────────────────────────────────────────────────

const WeeklyScheduleNative: React.FC<{ days: DaySchedule[]; dateRange: string; onPress: () => void }> = ({ days, dateRange, onPress }) => (
  <View style={{ paddingHorizontal: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
      <View>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>오늘부터</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>
          <Text style={{ color: "#4261FF" }}>근무 일정</Text>
          <Text>이에요 </Text>
          <Text style={{ fontSize: 14, fontWeight: "400", color: "#AAB4BF" }}>({dateRange})</Text>
        </Text>
      </View>
      <AnimatedPressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center" }} scaleAmount={0.92} opacityAmount={0.7}>
        <Text style={{ fontSize: 14, color: "#9EA3AD" }}>더보기</Text>
        <ChevronRight size={14} color="#9EA3AD" />
      </AnimatedPressable>
    </View>
    <View style={{ borderRadius: 16, backgroundColor: "#FFFFFF", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: 490 }}>
          {/* Days + Dates */}
          <View style={{ flexDirection: "row", paddingTop: 16, paddingBottom: 12 }}>
            {days.map((d) => {
              const c = d.isToday ? "#FFFFFF" : d.day === "토" ? "#5DB1FF" : d.day === "일" ? "#FF5959" : "#19191B";
              return (
                <View key={d.day} style={{ width: 70, alignItems: "center" }}>
                  {d.isToday ? (
                    <View style={{ width: 40, height: 54, borderRadius: 10, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: "#FFFFFF" }}>{d.day}</Text>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF", marginTop: 2 }}>{d.date}</Text>
                    </View>
                  ) : (
                    <View style={{ width: 40, height: 54, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 16, fontWeight: "500", color: c }}>{d.day}</Text>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: c, marginTop: 2 }}>{d.date}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#EBEBEB", marginHorizontal: 16 }} />
          {/* Shift labels */}
          <View style={{ flexDirection: "row", paddingTop: 12, paddingBottom: 8 }}>
            {days.map((d) => {
              const label = getShiftLabel(d.startTime, d.shiftName);
              const s = getShiftStyle(label);
              return (
                <View key={d.day + "s"} style={{ width: 70, alignItems: "center" }}>
                  <View style={{ borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: s.bg }}>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: s.text }}>{label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          {/* Times */}
          <View style={{ flexDirection: "row", paddingBottom: 16 }}>
            {days.map((d) => (
              <View key={d.day + "t"} style={{ width: 70, alignItems: "center", justifyContent: "center", minHeight: 36 }}>
                {d.startTime ? (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#AAB4BF", lineHeight: 20 }}>{d.startTime}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#AAB4BF", lineHeight: 20 }}>{d.endTime}</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#AAB4BF" }}>-</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  </View>
);

// ─── SalaryPreview ────────────────────────────────────────────────────────────

const SalaryPreviewNative: React.FC<{
  userName: string; month: string; totalAmount: number;
  storeName: string; hours: string; dateRange: string; onPress: () => void;
  salaryType?: string | null;
}> = ({ userName, month, totalAmount, storeName, hours, dateRange, onPress, salaryType }) => {
  const salaryLabel = salaryType === "월급" ? "월급" : salaryType === "연봉" ? "연봉 환산" : "예상 급여";
  const titleLabel = salaryType === "월급" ? "월급이에요" : salaryType === "연봉" ? "연봉 환산이에요" : "예상 급여에요";
  const bottomRightLabel = salaryType === "월급" ? "기본급" : salaryType === "연봉" ? "월 환산" : `총 ${hours} 근무`;
  return (
  <View style={{ paddingHorizontal: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
      <View>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>{userName} 님의</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: "#1E1E1E" }}>
          {"이번달 "}<Text style={{ color: "#4261FF" }}>{salaryLabel}</Text>{titleLabel}
        </Text>
      </View>
      <AnimatedPressable onPress={onPress} scaleAmount={0.97} opacityAmount={0.75} style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontSize: 14, color: "#70737B" }}>더보기</Text>
        <ChevronRight size={14} color="#70737B" />
      </AnimatedPressable>
    </View>
    <AnimatedPressable onPress={onPress} scaleAmount={0.98} opacityAmount={0.85} style={{ borderRadius: 16, backgroundColor: "#FFFFFF", padding: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>₩ {month} {salaryLabel}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 32, fontWeight: "600", color: "#19191B" }}>{totalAmount.toLocaleString()}원</Text>
        <ChevronRight size={24} color="#70737B" />
      </View>
      {storeName ? (
        <View style={{ marginTop: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4261FF" }} />
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>{storeName}</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#AAB4BF", marginTop: 6, marginLeft: 14 }}>{dateRange}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>{totalAmount.toLocaleString()}원</Text>
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#AAB4BF", marginTop: 6 }}>{bottomRightLabel}</Text>
          </View>
        </View>
      ) : null}
    </AnimatedPressable>
  </View>
  );
};

// ─── KakaoMapModal helpers ────────────────────────────────────────────────────

const buildKakaoMapHtml = (
  storeLat: number, storeLng: number, radius: number,
  kakaoKey: string,
  userLat?: number, userLng?: number,
): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;overflow:hidden}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function(){
      try{
        var map=new kakao.maps.Map(document.getElementById('map'),{
          center:new kakao.maps.LatLng(${storeLat},${storeLng}),
          level:4
        });
        new kakao.maps.Marker({map:map,position:new kakao.maps.LatLng(${storeLat},${storeLng})});
        new kakao.maps.Circle({
          map:map,
          center:new kakao.maps.LatLng(${storeLat},${storeLng}),
          radius:${radius},
          strokeWeight:2,strokeColor:'#4261FF',strokeOpacity:0.8,
          fillColor:'#4261FF',fillOpacity:0.12
        });
        ${userLat != null && userLng != null ? `
        new kakao.maps.CustomOverlay({
          map:map,
          position:new kakao.maps.LatLng(${userLat},${userLng}),
          content:'<div style="width:14px;height:14px;border-radius:50%;background:#FF3D3D;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>',
          yAnchor:0.5,xAnchor:0.5
        });
        var bounds=new kakao.maps.LatLngBounds();
        bounds.extend(new kakao.maps.LatLng(${storeLat},${storeLng}));
        bounds.extend(new kakao.maps.LatLng(${userLat},${userLng}));
        map.setBounds(bounds,80);
        ` : ''}
      }catch(e){
        document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:sans-serif;color:#70737B;font-size:14px;padding:20px;text-align:center;">지도를 불러오지 못했어요<br/>Kakao Maps API 키를 확인해주세요</div>';
      }
    })();
  </script>
</body>
</html>`;

// ─── PullRefreshIndicator ────────────────────────────────────────────────────

const PullRefreshIndicator: React.FC<{ fillProgress: SharedValue<number>; iconScale: SharedValue<number> }> = ({ fillProgress, iconScale }) => {
  const wavePhase = useSharedValue(0);
  const [waveClipD, setWaveClipD] = useState(`M ${-INDICATOR_SIZE} ${INDICATOR_SIZE} L ${2 * INDICATOR_SIZE} ${INDICATOR_SIZE} Z`);

  useEffect(() => {
    wavePhase.value = withRepeat(
      withSequence(
        withTiming(INDICATOR_SIZE / 4, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(-INDICATOR_SIZE / 4, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false,
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    height: fillProgress.value * INDICATOR_CONTAINER_H,
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const updateWaveD = useCallback((fp: number, phi: number) => {
    const waterPct = Math.max(0, Math.min(1,
      (fp - ICON_APPEAR_PROGRESS) / (1 - ICON_APPEAR_PROGRESS)
    ));
    const W = INDICATOR_SIZE;
    const A = WAVE_A;
    const H = W * (1 - waterPct) - A * waterPct;
    const d =
      "M " + (-W) + " " + W +
      " L " + (-W) + " " + H +
      " Q " + (-3 * W / 4 + phi) + " " + (H - A) + " " + (-W / 2 + phi) + " " + H +
      " Q " + (-W / 4 + phi) + " " + (H + A) + " " + phi + " " + H +
      " Q " + (W / 4 + phi) + " " + (H - A) + " " + (W / 2 + phi) + " " + H +
      " Q " + (3 * W / 4 + phi) + " " + (H + A) + " " + (W + phi) + " " + H +
      " Q " + (5 * W / 4 + phi) + " " + (H - A) + " " + (3 * W / 2 + phi) + " " + H +
      " L " + (2 * W) + " " + H +
      " L " + (2 * W) + " " + W +
      " Z";
    setWaveClipD(d);
  }, []);

  useAnimatedReaction(
    () => ({ fp: fillProgress.value, phi: wavePhase.value }),
    ({ fp, phi }) => { runOnJS(updateWaveD)(fp, phi); },
  );

  return (
    <Animated.View style={[{
      overflow: "hidden", alignItems: "center", justifyContent: "flex-end",
      backgroundColor: "#F4F5F8",
    }, containerStyle]}>
      <Animated.View style={[{
        width: INDICATOR_SIZE, height: INDICATOR_SIZE,
        borderRadius: 14, overflow: "hidden",
        marginBottom: ICON_MARGIN_BOTTOM,
      }, iconContainerStyle]}>
        <Svg width={INDICATOR_SIZE} height={INDICATOR_SIZE} style={{ position: "absolute" }}>
          <Defs>
            <ClipPath id="employeeWaterClip">
              <Path d={waveClipD} />
            </ClipPath>
          </Defs>
          <SvgImage
            href={ICON_IMG_URI}
            x={0} y={0}
            width={INDICATOR_SIZE} height={INDICATOR_SIZE}
            clipPath="url(#employeeWaterClip)"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};


// ─── EmployeeHomeScreen ───────────────────────────────────────────────────────

const EmployeeHomeScreen: React.FC<ScreenProps<"EmployeeHome">> = ({ navigation }) => {
  const { width: windowWidth } = useWindowDimensions();
  const { toast } = useToast();
  const { showNavToast } = useNavToast();
  const [name, setName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [myStores, setMyStores] = useState<MyStore[]>([]);

  const [workSchedule, setWorkSchedule] = useState<{ work_start: string; work_end: string } | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>("before_work");
  const [clockInTime, setClockInTime] = useState<string | undefined>();
  const [breakStartTime, setBreakStartTime] = useState<string | undefined>();
  const [breakEndTime, setBreakEndTime] = useState<string | undefined>();
  const [wasLate, setWasLate] = useState(false);
  const [wasAbsent, setWasAbsent] = useState(false);

  const [weeklyDays, setWeeklyDays] = useState<DaySchedule[]>([]);
  const [dateRange, setDateRange] = useState("");
  const [salaryTotal, setSalaryTotal] = useState(0);
  const [salaryHours, setSalaryHours] = useState("");
  const [salaryType, setSalaryType] = useState<string | null>(null);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [annualSalary, setAnnualSalary] = useState(0);
  const [storeLocation, setStoreLocation] = useState<{ latitude: number; longitude: number; radius: number } | null>(null);
  const [storeLocationFailed, setStoreLocationFailed] = useState(false);
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapModalAction, setMapModalAction] = useState<"clock_in" | "clock_out" | null>(null);
  const [mapUserLocation, setMapUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapDistance, setMapDistance] = useState<number | null>(null);
  const [mapWithinRange, setMapWithinRange] = useState(false);
  const [mapGpsLoading, setMapGpsLoading] = useState(false);

  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [storeNotices, setStoreNotices] = useState<StoreNotice[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (notifications.length === 0) return;
    const shake = () => {
      bellRotate.value = withSequence(
        withTiming(-14, { duration: 60 }),
        withTiming(14,  { duration: 80 }),
        withTiming(-10, { duration: 80 }),
        withTiming(10,  { duration: 80 }),
        withTiming(-6,  { duration: 80 }),
        withTiming(6,   { duration: 80 }),
        withTiming(0,   { duration: 60 }),
      );
    };
    const first = setTimeout(shake, 200);
    const interval = setInterval(shake, 5000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [notifications.length]);

  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [closingDone, setClosingDone] = useState(false);
  const [unclosedShift, setUnclosedShift] = useState<{
    work_log_id: number;
    work_date: string;
    start_time: string;
    sched_start: string | null;
    sched_end: string | null;
  } | null>(null);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const workingStatus = localStorage.getItem("employeeWorkingStatus") ?? "";
  const isResigned = workingStatus === "퇴사";
  const isOnLeave = workingStatus === "휴직";
  const scrollRef = useRef<ScrollView>(null);
  const unclosedAlertShownRef = useRef(false);
  useScrollToTop(scrollRef);

  const fillProgress = useSharedValue(0);
  const hapticFired  = useSharedValue(0);
  const iconScale    = useSharedValue(1);
  const barProgress  = useSharedValue(0);
  const barOpacity   = useSharedValue(0);
  const bellRotate   = useSharedValue(0);

  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellRotate.value}deg` }],
  }));

  const [refreshKey, setRefreshKey] = useState(0);
  const insets = useSafeAreaInsets();

  const dismissNotification = async (id: number) => {
    try { await markNotificationRead(id); } catch {}
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // 화면 포커스 시 미읽음 알림 재조회 (다른 화면에서 알림이 추가/변경될 수 있음)
  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    let cancelled = false;
    getNotifications(false, storeId)
      .then((notifs) => {
        if (cancelled) return;
        const unread = Array.isArray(notifs) ? notifs.filter((n) => !n.is_read) : [];
        setNotifications(unread);
        updateBadge(unread.length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storeId]));

  const getNowTime = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  const buildWeeklyDays = (ww: any[]): DaySchedule[] => {
    const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dow = date.getDay(); // 0=일 … 6=토
      const work = ww.find((w: any) => w.day_of_week === dow);
      return {
        day: DAY_NAMES[dow],
        date: date.getDate(),
        isToday: i === 0,
        isWeekend: dow === 0 || dow === 6,
        startTime: work?.work_start?.slice(0, 5),
        endTime: work?.work_end?.slice(0, 5),
        shiftName: work?.shift_name ?? undefined,
      };
    });
  };

  const buildDateRange = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    return `${fmt(today)}~${fmt(end)}`;
  };

  useEffect(() => {
    if (!storeId) { setDataLoaded(true); return; }
    setStoreName(localStorage.getItem("currentStoreName") ?? "");
    setDateRange(buildDateRange());
    setWeeklyDays(buildWeeklyDays([]));
    registerForPushNotifications().catch((e) => console.warn(e));
    (async () => {
      try {
        const me = await getMe();
        setName(me.name);
        if (me.id) setEmployeeId(me.id);
        if (me.name) localStorage.setItem("currentUserName", me.name);
        if (me.image_url) setProfileImageUrl(me.image_url);
      } catch {}
      let todayWorkData: any = null;
      try {
        const w = await getTodayWork(storeId) as any;
        if (w?.work_start) { setWorkSchedule(w); todayWorkData = w; }
      } catch {}
      try {
        const s = await getWorkStatus(storeId);
        // B7 납품 후 working_status 필드가 추가되면 자동 저장됨
        if (s?.working_status != null) {
          localStorage.setItem("employeeWorkingStatus", s.working_status);
        }
        const isoToHHMM = (iso?: string | null) => {
          if (!iso) return undefined;
          const d = new Date(iso);
          return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        };
        // 재진입 시 지각 여부 복원: 출근 시간이 스케줄 시작보다 늦으면 지각
        const restoreWasLate = (ciHHMM: string | undefined) => {
          if (ciHHMM && todayWorkData?.work_start) {
            const sched = String(todayWorkData.work_start).slice(0, 5);
            if (ciHHMM > sched) setWasLate(true);
          }
        };
        if (s?.status === "working") {
          setAttendanceStatus("working");
          const ci = isoToHHMM(s.clock_in_time);
          if (ci) setClockInTime(ci);
          restoreWasLate(ci);
        } else if (s?.status === "on_break") {
          setAttendanceStatus("on_break");
          const ci = isoToHHMM(s.clock_in_time);
          if (ci) setClockInTime(ci);
          if (s.break_start_time) setBreakStartTime(isoToHHMM(s.break_start_time));
          restoreWasLate(ci);
        } else if (s?.status === "off_work") {
          setAttendanceStatus("off_work");
          const ci = isoToHHMM(s.clock_in_time);
          if (ci) setClockInTime(ci);
          if (s.break_start_time) setBreakStartTime(isoToHHMM(s.break_start_time));
          if (s.break_end_time) setBreakEndTime(isoToHHMM(s.break_end_time));
        }
      } catch {}
      try {
        const ww = await getWeeklyWork(storeId) as any[];
        setWeeklyDays(buildWeeklyDays(Array.isArray(ww) ? ww : []));
      } catch {}
      let currentSalaryType: string | null = null;
      let currentMonthlySalary = 0;
      let currentAnnualSalary = 0;
      try {
        const info = await getMyEmployeeInfo(storeId) as any;
        if (info?.salary_type) { currentSalaryType = info.salary_type; setSalaryType(info.salary_type); }
        if (info?.monthly_salary) { currentMonthlySalary = Number(info.monthly_salary); setMonthlySalary(currentMonthlySalary); }
        if (info?.annual_salary) { currentAnnualSalary = Number(info.annual_salary); setAnnualSalary(currentAnnualSalary); }
        if (info?.joined_at) localStorage.setItem("currentHireDate", String(info.joined_at).slice(0, 10).replace(/\./g, "-"));
      } catch {}
      try {
        const p = await getSalaryPreview(storeId);
        const h = p.total_hours ?? 0;
        const totalMins = Math.round(h * 60);
        const hh = Math.floor(totalMins / 60);
        const mm = totalMins % 60;
        setSalaryHours(mm > 0 ? `${hh}시간 ${mm}분` : `${hh}시간`);
        if (currentSalaryType === "월급" && currentMonthlySalary > 0) {
          setSalaryTotal(currentMonthlySalary);
        } else if (currentSalaryType === "연봉" && currentAnnualSalary > 0) {
          setSalaryTotal(Math.round(currentAnnualSalary / 12));
        } else {
          setSalaryTotal(p.net_pay ?? p.estimated_salary ?? 0);
        }
      } catch {
        setSalaryHours("-");
        setSalaryTotal(0);
      }
      try {
        const loc = await api.post<any>("/api/common/store/map", { store_id: storeId });
        const lat = loc?.lat ?? loc?.latitude;
        const lng = loc?.lng ?? loc?.longitude;
        const radius = loc?.radius ?? loc?.attendance_radius;
        if (lat && lng && radius) {
          setStoreLocation({ latitude: lat, longitude: lng, radius });
        } else {
          setStoreLocationFailed(true);
        }
      } catch {
        setStoreLocationFailed(true);
      }
      try {
        const info = await getEmployeeStoreInfo(storeId) as any;
        const addr = [info?.address, info?.address_detail].filter(Boolean).join(" ");
        if (addr) setStoreAddress(addr);
        localStorage.setItem("storeHasOvertimePay", String(info?.has_overtime_pay ?? false));
        localStorage.setItem("storeHasNightPay", String(info?.has_night_pay ?? false));
        localStorage.setItem("storeHasHolidayPay", String(info?.has_holiday_pay ?? false));
      } catch {}
      try {
        const notices = await getStoreNotice(storeId) as any;
        if (Array.isArray(notices)) setStoreNotices(notices);
        else if (notices?.data && Array.isArray(notices.data)) setStoreNotices(notices.data);
      } catch { setStoreNotices([]); }
      try {
        const cr = await checkClosingReport(storeId);
        setClosingDone(cr?.is_completed ?? false);
      } catch {}
      try {
        const notifs = await getNotifications(false, storeId);
        const unread = Array.isArray(notifs) ? notifs.filter((n) => !n.is_read) : [];
        setNotifications(unread);
        updateBadge(unread.length);
      } catch { setNotifications([]); updateBadge(0); }
      try {
        const stores = await getMyStores();
        const storeArr = Array.isArray(stores) ? stores : [];
        setMyStores(storeArr);
        const match = storeArr.find((s) => s.store_id === storeId && s.role === "employee")
          ?? storeArr.find((s) => s.store_id === storeId);
        if (match?.store_name) setStoreName(match.store_name);
      } catch { setMyStores([]); }

      // 미퇴근 알림 체크
      if (!unclosedAlertShownRef.current) {
        try {
          const now = new Date();
          const y = now.getFullYear();
          const mo = now.getMonth() + 1;
          const todayStr = `${y}-${String(mo).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          let allLogs: any[] = [];
          try {
            const logs = await getMyWorkLogs(storeId, y, mo) as any[];
            if (Array.isArray(logs)) allLogs = logs;
          } catch {}
          // 월초(1~2일)면 전달도 확인
          if (now.getDate() <= 2) {
            const prevMo = mo === 1 ? 12 : mo - 1;
            const prevY = mo === 1 ? y - 1 : y;
            try {
              const prev = await getMyWorkLogs(storeId, prevY, prevMo) as any[];
              if (Array.isArray(prev)) allLogs = [...prev, ...allLogs];
            } catch {}
          }
          const found = allLogs.find(log => {
            if (!log.start_time || log.end_time !== null) return false;
            const wdStr = String(log.work_date).slice(0, 10);
            if (wdStr >= todayStr) return false;
            if (localStorage.getItem(`unclosed_dismissed_${wdStr}`) === "1") return false;
            const schedEnd = log.sched_end ? String(log.sched_end).slice(0, 5) : null;
            const schedStart = log.sched_start ? String(log.sched_start).slice(0, 5) : "00:00";
            if (schedEnd) {
              const [wy2, wm2, wd2] = wdStr.split("-").map(Number);
              const [eh, em] = schedEnd.split(":").map(Number);
              const isNight = schedEnd < schedStart;
              const endDt = new Date(wy2, wm2 - 1, wd2);
              if (isNight) endDt.setDate(endDt.getDate() + 1);
              endDt.setHours(eh, em, 0, 0);
              if (Date.now() < endDt.getTime() + 2 * 3600 * 1000) return false;
            }
            return true;
          });
          if (found) {
            const foundDate = String(found.work_date).slice(0, 10);
            setUnclosedShift({
              work_log_id: found.id,
              work_date: foundDate,
              start_time: String(found.start_time),
              sched_start: found.sched_start ? String(found.sched_start).slice(0, 5) : null,
              sched_end: found.sched_end ? String(found.sched_end).slice(0, 5) : null,
            });
            localStorage.setItem("pending_unclosed_shift", JSON.stringify({ work_log_id: found.id, work_date: foundDate }));
            unclosedAlertShownRef.current = true;
            fireUnclosedShiftNotification(foundDate);
          }
        } catch {}
      }

      setDataLoaded(true);
    })();
  }, [storeId, refreshKey]);

  useEffect(() => {
    if (!storeId || !employeeId) return;
    (async () => {
      try {
        const todos = await api.post<any>("/api/employee/todo", { store_id: storeId, employee_id: employeeId });
        const raw = Array.isArray(todos) ? todos : (todos?.data ?? []);
        setTodoItems(raw.map((t: any) => ({
          id: t.id,
          content: t.content,
          is_done: t.is_achieved ?? t.is_done ?? false,
        })));
      } catch {}
    })();
  }, [storeId, employeeId, refreshKey]);

  const handleTodoToggle = async (item: TodoItem) => {
    hapticSelection();
    setTodoItems((prev) =>
      prev.map((t) => t.id === item.id ? { ...t, is_done: !t.is_done } : t)
    );
    try {
      await api.post("/api/employee/todo/modify", { store_id: storeId, id: item.id });
    } catch {
      // Revert on failure
      setTodoItems((prev) =>
        prev.map((t) => t.id === item.id ? { ...t, is_done: item.is_done } : t)
      );
    }
  };

  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y < 0) {
      const progress = Math.min(1, Math.abs(y) / PULL_THRESHOLD);
      fillProgress.value = progress;
      if (progress >= 1 && hapticFired.value === 0) {
        hapticFired.value = 1;
        hapticHeavy();
      }
    } else {
      fillProgress.value = 0;
      hapticFired.value = 0;
      iconScale.value = 1;
    }
  }, [fillProgress, hapticFired, iconScale]);

  const handleScrollEndDrag = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y <= -PULL_THRESHOLD) {
      setRefreshKey(k => k + 1);
      iconScale.value = withSequence(
        withTiming(1.25, { duration: 160, easing: Easing.out(Easing.ease) }),
        withTiming(0,    { duration: 200, easing: Easing.in(Easing.ease) }),
      );
      fillProgress.value = withSequence(
        withTiming(1,    { duration: 50 }),                                          // 꽉 채움
        withTiming(1,    { duration: 360 }),                                         // 아이콘 인터랙션 동안 고정
        withTiming(0,    { duration: 480, easing: Easing.out(Easing.ease) }),        // 스크롤 복구
      );
      barProgress.value = 0;
      barOpacity.value = 1;
      barProgress.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.ease) });
      barOpacity.value = withSequence(
        withTiming(1,    { duration: 480 }),
        withTiming(0,    { duration: 320 }),
      );
    } else {
      fillProgress.value = withTiming(0, { duration: 300 });
    }
    hapticFired.value = 0;
  }, [fillProgress, hapticFired, iconScale, barProgress, barOpacity]);

  const refreshBarStyle = useAnimatedStyle(() => ({
    width: barProgress.value * windowWidth,
    opacity: barOpacity.value,
  }));

  const verifyLocation = async () => {
    if (!storeLocation) return true;
    try {
      const cur = await getCurrentLocation();
      if (!isWithinRadius(cur, storeLocation, storeLocation.radius)) {
        toast({ description: `매장 반경 ${storeLocation.radius}m 밖에서는 출퇴근할 수 없어요.`, variant: "destructive" });
        return false;
      }
      return true;
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "위치 확인에 실패했어요.", variant: "destructive" });
      return false;
    }
  };

  const computeStatus = (): AttendanceStatus => {
    const now = new Date();
    const rawNSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const hasSched = workSchedule !== null;
    const sSec = hasSched ? toSec(workSchedule!.work_start) : null;
    const rawESec = hasSched ? toSec(workSchedule!.work_end) : null;
    // Midnight-crossing: work_end < work_start (e.g. 22:00–06:00)
    const eSec = (hasSched && rawESec! < sSec!) ? rawESec! + 86400 : rawESec;
    // Post-midnight portion of the shift: add 24h so comparisons are consistent
    const nSec = (hasSched && rawESec! < sSec! && rawNSec < rawESec!) ? rawNSec + 86400 : rawNSec;
    const isLate = hasSched && attendanceStatus === "before_work" && nSec > sSec! && nSec < eSec!;
    const isAbsent = hasSched && attendanceStatus === "before_work" && nSec >= eSec!;
    const isOT = hasSched && ["working", "break_done"].includes(attendanceStatus) && nSec >= eSec! && !wasAbsent;
    if (!hasSched && attendanceStatus === "before_work") return "holiday";
    if (isAbsent) return "absent";
    if (isLate) return "late";
    if (isOT) return "overtime";
    return attendanceStatus;
  };

  const executeClockIn = async () => {
    setSubmitting(true);
    try {
      const eff = computeStatus();
      if (eff === "late") setWasLate(true);
      if (eff === "absent") setWasAbsent(true);
      await clockIn(storeId);
      setClockInTime(getNowTime());
      setAttendanceStatus("working");
      if (workSchedule?.work_end) {
        scheduleClockOutReminder(workSchedule.work_end, workSchedule.work_start ?? null);
      }
      toast({ description: "출근을 완료 했어요. 오늘 근무도 파이팅!" });
      requestReviewIfEligible();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "출근 처리에 실패했어요.";
      if (msg.includes("이미 오늘") || msg.startsWith("409:")) {
        setAttendanceStatus("working");
        toast({ description: "이미 오늘 출근 처리됐어요." });
      } else {
        toast({ description: msg, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const executeClockOut = async () => {
    setSubmitting(true);
    try {
      await clockOut(storeId);
      setAttendanceStatus("off_work");
      cancelClockOutReminder();
      toast({ description: "퇴근을 완료 했어요. 오늘도 수고하셨어요!" });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "퇴근 처리에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openMapModal = async (action: "clock_in" | "clock_out") => {
    hapticHeavy();
    if (submitting) return;
    const hasStore = !!storeLocation;
    setMapModalAction(action);
    setMapUserLocation(null);
    setMapDistance(null);
    setMapWithinRange(false);
    setMapGpsLoading(hasStore);
    setMapModalOpen(true);
    if (!hasStore) return;
    try {
      const gpsTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new GpsError("timeout", "GPS 시간 초과")), 10000),
      );
      const cur = await Promise.race([getCurrentLocation(), gpsTimeout]);
      const dist = distanceMeters(cur, storeLocation!);
      setMapUserLocation(cur);
      setMapDistance(Math.round(dist));
      setMapWithinRange(dist <= storeLocation!.radius);
    } catch (e) {
      // 권한 거부는 차단, GPS 신호 없음/타임아웃은 경고만 표시하고 확인 허용
      if (e instanceof GpsError && e.code === "permission_denied") {
        setMapWithinRange(false);
        toast({ description: "위치 권한이 거부됐어요. 아래 버튼으로 허용해주세요.", variant: "destructive" });
      } else {
        setMapWithinRange(true); // GPS 불가 시 경고만, 차단하지 않음
      }
    } finally {
      setMapGpsLoading(false);
    }
  };

  const handleMapConfirm = async () => {
    if (!mapWithinRange) return;
    setMapModalOpen(false);
    if (mapModalAction === "clock_in") await executeClockIn();
    else if (mapModalAction === "clock_out") await executeClockOut();
  };

  const retryGps = async () => {
    if (!storeLocation) return;
    setMapGpsLoading(true);
    setMapDistance(null);
    setMapWithinRange(false);
    try {
      const status = await requestLocationPermission();
      if (status === "denied") {
        await Linking.openSettings();
        setMapGpsLoading(false);
        return;
      }
      const gpsTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new GpsError("timeout", "GPS 시간 초과")), 10000),
      );
      const cur = await Promise.race([getCurrentLocation(), gpsTimeout]);
      const dist = distanceMeters(cur, storeLocation);
      setMapUserLocation(cur);
      setMapDistance(Math.round(dist));
      setMapWithinRange(dist <= storeLocation.radius);
    } catch (e) {
      if (e instanceof GpsError && e.code === "permission_denied") {
        setMapWithinRange(false);
        toast({ description: "위치 권한이 거부됐어요. 설정 앱에서 허용해주세요.", variant: "destructive" });
      } else {
        setMapWithinRange(true);
      }
    } finally {
      setMapGpsLoading(false);
    }
  };

  const handleClockIn = () => openMapModal("clock_in");
  const handleClockOut = () => openMapModal("clock_out");

  const handleBreakStart = async () => {
    hapticHeavy();
    if (submitting) return;
    setSubmitting(true);
    try {
      await breakStart(storeId);
      setBreakStartTime(getNowTime());
      setAttendanceStatus("on_break");
      toast({ description: "휴게 시간이 시작 되었어요" });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "휴게 처리에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBreakEnd = async () => {
    hapticHeavy();
    if (submitting) return;
    setSubmitting(true);
    try {
      await breakEnd(storeId);
      setBreakEndTime(getNowTime());
      setAttendanceStatus("break_done");
      toast({ description: "휴게 시간이 종료 되었어요" });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "휴게 종료 처리에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnclosedClockOut = async () => {
    if (!unclosedShift) return;
    const [wy, wm, wd] = unclosedShift.work_date.split("-").map(Number);
    const logDate = new Date(wy, wm - 1, wd);
    let endDt: Date;
    if (unclosedShift.sched_end) {
      const [eh, em] = unclosedShift.sched_end.split(":").map(Number);
      const isNight = unclosedShift.sched_end < (unclosedShift.sched_start ?? "00:00");
      endDt = new Date(logDate);
      if (isNight) endDt.setDate(endDt.getDate() + 1);
      endDt.setHours(eh, em, 0, 0);
    } else {
      const timePart = unclosedShift.start_time.split(" ")[1] ?? unclosedShift.start_time;
      const [sh, sm] = timePart.slice(0, 5).split(":").map(Number);
      endDt = new Date(logDate);
      endDt.setHours(sh + 8, sm, 0, 0);
    }
    try {
      await api.post("/api/employee/work/clock-out-auto", {
        store_id: storeId,
        work_log_id: unclosedShift.work_log_id,
        end_time: endDt.toISOString(),
      });
      toast({ description: "퇴근 처리가 완료됐어요." });
    } catch {
      toast({ description: "퇴근 처리에 실패했어요. 관리자에게 문의해주세요.", variant: "destructive" });
    } finally {
      localStorage.setItem(`unclosed_dismissed_${unclosedShift.work_date}`, "1");
      localStorage.removeItem("pending_unclosed_shift");
      setUnclosedShift(null);
    }
  };

  const handleUnclosedDismiss = () => {
    if (!unclosedShift) return;
    localStorage.setItem(`unclosed_dismissed_${unclosedShift.work_date}`, "1");
    setUnclosedShift(null);
  };

  const handleLogout = async () => {
    clearBadge();
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const now = new Date();
  const month = `${now.getMonth() + 1}월`;
  const firstDay = `${String(now.getMonth() + 1).padStart(2, "0")}.01`;
  const todayStr = `${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const effectiveStatus = computeStatus();

  // 미퇴근 모달 라벨 계산
  const unclosedDateLabel = (() => {
    if (!unclosedShift) return "";
    const [wy, wm, wd] = unclosedShift.work_date.split("-").map(Number);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.getFullYear() === wy && yesterday.getMonth() + 1 === wm && yesterday.getDate() === wd) return "어제";
    return `${wm}월 ${wd}일`;
  })();

  const unclosedEndLabel = (() => {
    if (!unclosedShift?.sched_end) return "";
    const [eh, em] = unclosedShift.sched_end.split(":").map(Number);
    const ampm = eh < 12 ? "오전" : "오후";
    const h12 = eh === 0 ? 12 : eh > 12 ? eh - 12 : eh;
    const isNight = unclosedShift.sched_end < (unclosedShift.sched_start ?? "00:00");
    return `${isNight ? "익일 " : ""}${ampm} ${h12}:${String(em).padStart(2, "0")}`;
  })();

  const menuItems = [
    { label: "내 정보", onPress: () => navigation.navigate("EmployeeProfile") },
    { label: "공지사항", onPress: () => navigation.navigate("Announcements") },
    { label: "자주 묻는 질문", onPress: () => navigation.navigate("FAQ") },
    { label: "건의함", onPress: () => navigation.navigate("Feedback") },
  ];

  const menuSubItems: { label: string; onPress: () => void; danger?: boolean }[] = [];

  if (!dataLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F5F8" }} edges={["top"]}>
        <EmployeeHomeSkeleton />
        <EmployeeBottomNav activeTab="home" navigation={navigation} />
      </SafeAreaView>
    );
  }

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F5F8" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#F4F5F8" }}>
        <AnimatedPressable onPress={() => setAccountSheetOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }} hitSlop={8} scaleAmount={0.97} opacityAmount={0.8}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#292B2E" }}>{storeName || "매장"}</Text>
          <View style={{ minWidth: 33, height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#FFFFFF" }}>직원</Text>
          </View>
          <ChevronDown size={16} color="#9EA3AD" />
        </AnimatedPressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <AnimatedPressable onPress={() => { navigation.navigate("Notifications"); }} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7} style={{ position: "relative" }}>
            <Animated.View style={bellAnimStyle}>
              <Bell size={20} color="#19191B" />
            </Animated.View>
            {notifications.length > 0 && (
              <View style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3D3D", borderWidth: 1.5, borderColor: "#F4F5F8" }} />
            )}
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setMenuOpen(true)} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7}>
            <Menu size={20} color="#19191B" />
          </AnimatedPressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: "#F4F5F8" }}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        <PullRefreshIndicator fillProgress={fillProgress} iconScale={iconScale} />
        {/* Date */}
        <Text style={{ paddingHorizontal: 20, paddingVertical: 12, fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: "#292B2E" }}>
          {formatDate()}
        </Text>

        {/* 휴직/퇴사 배너 */}
        {(isResigned || isOnLeave) && (
          <LeaveBanner status={isResigned ? "퇴사" : "휴직"} />
        )}

        {/* 알림 카드 — 웹앱과 동일한 스타일 */}
        {(notifications.length > 0 || unclosedShift) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={163}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 8 }}
          >
            {/* 미퇴근 알림 카드 */}
            {unclosedShift && (
              <AnimatedPressable
                onPress={() => { handleUnclosedDismiss(); navigation.navigate("EmployeeAttendance"); }}
                scaleAmount={0.96} opacityAmount={0.8}
                style={{ width: 155, height: 104, backgroundColor: "#FFF3EB", borderRadius: 12, padding: 12, justifyContent: "space-between" }}
              >
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <View style={{ height: 18, paddingHorizontal: 6, backgroundColor: "#FFE0CC", borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#FF862D" }}>미퇴근</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: "#19191B", lineHeight: 18 }} numberOfLines={2}>
                    퇴근 처리가{"\n"}완료되지 않았어요
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: "#FF862D", fontWeight: "600" }}>수정 요청하기 →</Text>
              </AnimatedPressable>
            )}
            {notifications.slice(0, 5).map((n) => {
              const notifType: string = (n as any).type ?? n.title ?? "";
              const notifMsg: string = (n as any).message ?? n.body ?? "";
              const refId: number | undefined = (n as any).reference_id;
              const NOTIF_LABEL: Record<string, string> = {
                salary: "급여", schedule: "일정", board: "게시판", notice: "공지",
                late: "출퇴근", clock_in: "출퇴근", clock_out: "출퇴근", early_leave: "출퇴근",
                attendance: "출퇴근", absent: "출퇴근", tardiness: "출퇴근",
                check_in: "출퇴근", check_out: "출퇴근", worklog: "출퇴근",
                member_status: "매장", staff_mgmt: "직원관리", probation_end: "직원관리",
                schedule_change: "일정", vacation: "일정",
                schedule_approved: "일정", schedule_rejected: "일정",
                store: "매장", service: "서비스",
                closing_report: "마감보고",
              };
              const notifLabel = NOTIF_LABEL[notifType] ?? notifType;
              const handleCardPress = () => {
                dismissNotification(n.id);
                if ((notifType === "board" || notifType === "게시판") && refId && !isResigned) { showNavToast("게시글로 이동했어요"); navigation.navigate("BoardDetail", { id: refId }); }
                else if ((notifType === "salary" || notifType === "급여") && refId) { showNavToast("급여명세서로 이동했어요"); navigation.navigate("EmployeePayStubDetail", { payslipId: refId }); }
                else if ((notifType === "notice" || notifType === "공지") && refId) { showNavToast("공지사항으로 이동했어요"); navigation.navigate("AnnouncementDetail", { id: refId }); }
                else if ((notifType === "schedule" || notifType === "일정") && refId) {
                  if (notifMsg.includes("변경")) { showNavToast("일정 변경으로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_change", id: refId }); }
                  else if (/\d+건/.test(notifMsg)) { showNavToast("내 일정으로 이동했어요"); navigation.navigate("EmployeeSchedule"); }
                  else if (notifMsg.includes("추가")) { showNavToast("일정 추가로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_added", id: refId }); }
                }
                else if (notifType === "member_status") { showNavToast("가입 승인으로 이동했어요"); navigation.navigate("EmployeeApproved"); }
                else if (notifType === "schedule_change" && refId) { showNavToast("일정 변경으로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_change", id: refId }); }
                else if (["vacation", "schedule_approved", "schedule_rejected"].includes(notifType)) { showNavToast("내 일정으로 이동했어요"); navigation.navigate("EmployeeSchedule"); }
                else if (notifType === "store") { showNavToast("내 정보로 이동했어요"); navigation.navigate("EmployeeProfile"); }
                else if (["late", "clock_in", "clock_out", "early_leave", "attendance", "absent", "tardiness", "check_in", "check_out", "worklog"].includes(notifType)) { showNavToast("출퇴근 기록으로 이동했어요"); navigation.navigate("EmployeeAttendance"); }
                else if (notifType === "closing_report") { showNavToast("마감 보고로 이동했어요"); navigation.navigate("ClosingReport"); }
                else if (notifType === "service" && refId) {
                  if (notifMsg.includes("답변이 등록됐어요")) { showNavToast("건의함으로 이동했어요"); navigation.navigate("FeedbackDetail", { id: refId }); }
                  else { showNavToast("공지사항으로 이동했어요"); navigation.navigate("AnnouncementDetail", { id: refId }); }
                }
              };
              return (
                <AnimatedPressable
                  key={n.id}
                  onPress={handleCardPress}
                  scaleAmount={0.96}
                  opacityAmount={0.8}
                  style={{
                    width: 155, height: 104,
                    backgroundColor: "#DBE6FF",
                    borderRadius: 12, padding: 12,
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ paddingRight: 20 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>{(notifType === "board" || notifType === "게시판") ? "📌" : "📁"}</Text>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF", letterSpacing: -0.28 }} numberOfLines={1}>
                        {notifLabel}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", letterSpacing: -0.28, lineHeight: 20 }} numberOfLines={2}>
                      {/\d+건/.test(notifMsg) ? "일정이 배정되었어요" : notifMsg}
                    </Text>
                  </View>
                  <AnimatedPressable onPress={(e: any) => { e?.stopPropagation?.(); dismissNotification(n.id); }} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7} style={{ position: "absolute", top: 8, right: 8 }}>
                    <X size={16} color="#788A9F" />
                  </AnimatedPressable>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        )}

        {/* Attendance card */}
        {!(isResigned || isOnLeave) && (
          <AttendanceCardNative
            status={effectiveStatus}
            scheduleStart={workSchedule?.work_start?.slice(0, 5)}
            scheduleEnd={workSchedule?.work_end?.slice(0, 5)}
            clockInTime={clockInTime}
            breakStartTime={breakStartTime}
            breakEndTime={breakEndTime}
            wasLate={wasLate}
            wasAbsent={wasAbsent}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onBreakStart={handleBreakStart}
            onBreakEnd={handleBreakEnd}
            onSubstituteClockIn={handleClockIn}
          />
        )}

        {/* Checklist section */}
        <View style={{ marginTop: 32 }}>
          <ChecklistSectionNative
            userName={name}
            items={todoItems}
            onToggle={handleTodoToggle}
          />
        </View>

        {/* Ad banner */}
        <View style={{ marginTop: 24 }}>
          <AdMobNative />
        </View>

        {/* Weekly schedule */}
        <View style={{ marginTop: 32 }}>
          <WeeklyScheduleNative
            days={weeklyDays}
            dateRange={dateRange}
            onPress={() => { showNavToast("일정 확인으로 이동했어요"); navigation.navigate("EmployeeSchedule"); }}
          />
        </View>

        {/* Store notices */}
        {!isResigned && (
          <View style={{ marginTop: 32 }}>
            <StoreNoticesNative
              notices={storeNotices}
              onPressMore={() => { showNavToast("게시판으로 이동했어요"); navigation.navigate("BoardList"); }}
              onPressItem={(id) => { showNavToast("게시글로 이동했어요"); navigation.navigate("BoardDetail", { id }); }}
            />
          </View>
        )}

        {/* Salary preview */}
        <View style={{ marginTop: 32 }}>
          <SalaryPreviewNative
            userName={name}
            month={month}
            totalAmount={salaryTotal}
            storeName={storeName}
            hours={salaryHours}
            dateRange={`${firstDay}~${todayStr}`}
            onPress={() => { showNavToast("급여 확인으로 이동했어요"); navigation.navigate("EmployeeSalary"); }}
            salaryType={salaryType}
          />
        </View>

        {/* Closing report */}
        {!(isResigned || isOnLeave) && (
          <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
            <AnimatedPressable
              onPress={() => { showNavToast("마감 보고로 이동했어요"); navigation.navigate("ClosingReport"); }}
              scaleAmount={0.98}
              opacityAmount={0.85}
              style={{ borderRadius: 16, backgroundColor: closingDone ? "#F7F7F8" : "#FFFFFF", padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: closingDone ? 0 : 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: closingDone ? 0 : 2, borderWidth: closingDone ? 1 : 0, borderColor: "#EBEBEB" }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: closingDone ? "#AAB4BF" : "#19191B" }}>마감보고</Text>
                  {closingDone && (
                    <View style={{ backgroundColor: "#E8F5E9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#2E7D32" }}>완료</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 14, color: "#AAB4BF", marginTop: 4 }}>
                  {closingDone ? "오늘 마감보고가 완료됐어요" : "마감 직원은 오늘의 마감보고를 해주세요"}
                </Text>
              </View>
              <ChevronRight size={20} color="#D1D5DB" />
            </AnimatedPressable>
          </View>
        )}
      </ScrollView>

      {/* ── Kakao Map Clock Modal ── */}
      {mapModalOpen && (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 9999, backgroundColor: "#000" }]}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: "#FFFFFF" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>
              {mapModalAction === "clock_in" ? "출근하기" : "퇴근하기"}
            </Text>
            <AnimatedPressable onPress={() => setMapModalOpen(false)} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7}>
              <X size={22} color="#19191B" />
            </AnimatedPressable>
          </View>

          {/* Map area */}
          <View style={{ flex: 1 }}>
            {storeLocation ? (
              <>
                <WebView
                  source={{ html: buildKakaoMapHtml(
                    storeLocation.latitude, storeLocation.longitude, storeLocation.radius,
                    Constants.expoConfig?.extra?.kakaoMapApiKey ?? "",
                    mapUserLocation?.latitude, mapUserLocation?.longitude,
                  )}}
                  style={{ flex: 1 }}
                  originWhitelist={["*"]}
                  javaScriptEnabled
                  domStorageEnabled
                />
                {mapGpsLoading && (
                  <View style={{ position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" }}>
                    <View style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 13, color: "#FFFFFF" }}>내 위치 확인 중...</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5F8" }}>
                {mapGpsLoading ? (
                  <>
                    <ActivityIndicator color="#4261FF" size="large" />
                    <Text style={{ marginTop: 12, fontSize: 14, color: "#70737B" }}>위치를 확인하고 있어요...</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 14, color: "#70737B" }}>매장 위치 정보를 가져오지 못했어요</Text>
                )}
              </View>
            )}
          </View>

          {/* Bottom info card */}
          <View style={{ backgroundColor: "#FFFFFF", paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 }}>
            {mapGpsLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <ActivityIndicator color="#4261FF" />
                <Text style={{ marginTop: 8, fontSize: 14, color: "#70737B" }}>GPS 위치 확인 중...</Text>
              </View>
            ) : !storeLocation ? (
              <>
                <View style={{ borderRadius: 10, backgroundColor: "#FFEAE6", paddingVertical: 10, paddingHorizontal: 14, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: "#FF3D3D", textAlign: "center" }}>
                    {"매장 위치 정보를 불러올 수 없어요\n관리자에게 매장 주소 설정을 요청해주세요"}
                  </Text>
                </View>
                <View style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#DBDCDF" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#93989E" }}>
                    {mapModalAction === "clock_in" ? "출근 확인하기" : "퇴근 확인하기"}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {storeAddress ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: "#AAB4BF", marginBottom: 2 }}>매장 주소</Text>
                    <Text style={{ fontSize: 14, color: "#19191B", fontWeight: "500" }}>{storeAddress}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: "#70737B" }}>매장까지 거리</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: mapWithinRange ? "#10C97D" : (mapDistance != null ? "#FF3D3D" : "#70737B") }}>
                    {mapDistance != null ? `${mapDistance.toLocaleString()}m` : "위치 확인 실패"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: "#70737B" }}>출퇴근 허용 반경</Text>
                  <Text style={{ fontSize: 14, color: "#70737B" }}>{storeLocation.radius.toLocaleString()}m 이내</Text>
                </View>
                {!mapWithinRange && mapDistance != null && (
                  <View style={{ borderRadius: 10, backgroundColor: "#FFEAE6", paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, color: "#FF3D3D", textAlign: "center" }}>
                      매장 반경 {storeLocation.radius.toLocaleString()}m 밖에 있어요
                    </Text>
                  </View>
                )}
                {!mapWithinRange && mapDistance == null && (
                  <View style={{ marginBottom: 14 }}>
                    <View style={{ borderRadius: 10, backgroundColor: "#FFEAE6", paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10 }}>
                      <Text style={{ fontSize: 13, color: "#FF3D3D", textAlign: "center" }}>위치 정보를 가져오지 못했어요</Text>
                    </View>
                    <AnimatedPressable
                      onPress={retryGps}
                      scaleAmount={0.97} opacityAmount={0.8}
                      style={{ borderRadius: 10, borderWidth: 1.5, borderColor: "#4261FF", paddingVertical: 10, alignItems: "center" }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>위치 권한 허용하기</Text>
                    </AnimatedPressable>
                  </View>
                )}
                <AnimatedPressable
                  onPress={mapWithinRange ? handleMapConfirm : undefined}
                  scaleAmount={mapWithinRange ? 0.97 : 1}
                  opacityAmount={mapWithinRange ? 0.85 : 1}
                  style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: mapWithinRange ? "#4261FF" : "#DBDCDF" }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: mapWithinRange ? "#FFFFFF" : "#93989E" }}>
                    {mapModalAction === "clock_in" ? "출근 확인하기" : "퇴근 확인하기"}
                  </Text>
                </AnimatedPressable>
              </>
            )}
          </View>
      </View>
      )}

      {/* ── 미퇴근 알림 모달 ── */}
      {unclosedShift && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 9998, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }]}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFF3EA", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 }}>
              <Clock size={26} color="#FF862D" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 8 }}>
              {unclosedDateLabel} 퇴근을 안 하셨어요
            </Text>
            <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
              근태 수정 요청을 통해{"\n"}관리자에게 처리를 요청할 수 있어요
            </Text>
            <View style={{ gap: 10 }}>
              <AnimatedPressable
                onPress={() => { handleUnclosedDismiss(); navigation.navigate("EmployeeAttendance"); }}
                scaleAmount={0.97} opacityAmount={0.85}
                style={{ height: 52, borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>근태 수정 요청하기</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleUnclosedDismiss}
                scaleAmount={0.97} opacityAmount={0.85}
                style={{ height: 52, borderRadius: 14, backgroundColor: "#F4F5F8", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#70737B" }}>나중에 처리할게요</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      )}

      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={name}
        storeName={storeName}
        roleLabel="직원"
        imageUrl={profileImageUrl}
        items={menuItems}
        subItems={menuSubItems}
      />

      {/* ── Account Sheet ── */}
      <BottomSheet isOpen={accountSheetOpen} onClose={() => setAccountSheetOpen(false)} title="계정 유형 선택">
        {myStores.map((store) => {
          const isSelected = store.store_id === storeId && store.role === "employee";
          const roleLabel = store.role === "owner" ? "사장님" : store.employee_type ?? "직원";
          return (
            <AnimatedPressable
              key={`${store.store_id}-${store.role}`}
              onPress={() => {
                if (isSelected) return;
                hapticHeavy();
                toast({ description: "계정 유형이 전환 되었어요" });
                setAccountSheetOpen(false);
                if (store.role === "owner") {
                  localStorage.setItem("currentStoreId", String(store.store_id));
                  localStorage.setItem("currentMemberId", String(store.store_member_id));
                  localStorage.setItem("currentRole", "owner");
                  navigation.reset({ index: 0, routes: [{ name: "OwnerHome" }] });
                } else {
                  localStorage.setItem("currentStoreId", String(store.store_id));
                  localStorage.setItem("currentMemberId", String(store.store_member_id));
                  localStorage.setItem("currentRole", "employee");
                  navigation.reset({ index: 0, routes: [{ name: "EmployeeHome" }] });
                }
              }}
              scaleAmount={0.98}
              opacityAmount={0.8}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: isSelected ? "#E8F3FF" : "transparent", marginBottom: 4 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{store.store_name}</Text>
                <View style={{
                  borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2,
                  backgroundColor: isSelected ? "#4261FF" : "#F7F7F8",
                }}>
                  <Text style={{ fontSize: 12, color: isSelected ? "#FFFFFF" : "#70737B" }}>{roleLabel}</Text>
                </View>
              </View>
              {isSelected && <Check size={20} color="#4261FF" />}
            </AnimatedPressable>
          );
        })}
        <AnimatedPressable
          onPress={() => {
            setAccountSheetOpen(false);
            navigation.navigate("MemberType", { canBack: true });
          }}
          scaleAmount={0.97}
          opacityAmount={0.8}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12 }}
        >
          <Plus size={20} color="#19191B" />
          <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>계정 유형 추가하기</Text>
        </AnimatedPressable>
      </BottomSheet>

      <Animated.View
        pointerEvents="none"
        style={[{
          position: "absolute", top: 0, left: 0,
          height: 3, borderRadius: 1.5,
          backgroundColor: "#4261FF", zIndex: 999,
        }, refreshBarStyle]}
      />

      <EmployeeBottomNav activeTab="home" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

export default EmployeeHomeScreen;
