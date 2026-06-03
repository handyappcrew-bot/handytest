import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useWindowDimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const STAFF_ICON = require("../../assets/images/icon/staff-icon.png");
const ICON_IMG   = require("../assets/icon.png");
const ICON_IMG_URI: string = typeof Image.resolveAssetSource === "function"
  ? Image.resolveAssetSource(ICON_IMG).uri
  : (typeof ICON_IMG === "string" ? ICON_IMG : "");
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS,
  withTiming, withRepeat, withSequence, Easing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import Svg, { Image as SvgImage, Defs, ClipPath, Path } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AlertCircle,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Menu,
  Pencil,
  Plus,
  X,
} from "lucide-react-native";
import { addDays, format, isToday, subDays } from "date-fns";
import { ko } from "date-fns/locale";

import { useScrollToTop } from "@react-navigation/native";
import { logout, getMyStores, getMe, MyStore } from "@/api/auth";
import { updateBadge, clearBadge } from "@/utils/push";
import { getOwnerInfo, getMemberRequests, getOwnerWorklogRequests, getOwnerScheduleRequests, getTodayAttendance, getPayslips, getClosingReports, AttendanceTodayRow } from "@/api/owner";
import { getCachedStaffList, getCachedStoreInfo } from "@/utils/cachedApi";
import { getBoardList, getNotifications, markNotificationRead, BoardItem, NotificationItem } from "@/api/public";
import { api } from "@/api/client";
import BottomSheet from "@/components/BottomSheet";
import EmptyState from "@/components/EmptyState";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import SideMenu from "@/components/SideMenu";
import { useToast } from "@/components/Toast";
import { useNavToast } from "@/components/NavToast";
import type { ScreenProps } from "@/navigation/types";
import { registerForPushNotifications } from "@/utils/push";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import AdMobNative from "@/components/AdMobNative";
import { localStorage } from "@/utils/storage";
import { getShiftStyle } from "@/utils/shiftStyles";
import OwnerHomeSkeleton from "@/components/OwnerHomeSkeleton";
import Avatar from "@/components/Avatar";
import { hapticLight, hapticHeavy, hapticSelection } from "@/utils/haptics";

// ─── 알림 카테고리 → 한국어 레이블 ─────────────────────────────────────────
const NOTIF_CATEGORY_LABEL: Record<string, string> = {
  staff_mgmt:         "직원관리",
  schedule_change:    "일정변경",
  probation_end:      "수습종료",
  closing_report:     "마감보고",
  salary:             "급여",
  schedule:           "일정",
  board:              "게시판",
  notice:             "공지",
  attendance:         "근태",
  absent:             "결근",
  late:               "지각",
  tardiness:          "지각",
  check_in:           "출근",
  check_out:          "퇴근",
  early_leave:        "조기퇴근",
  store:              "매장",
  service:            "서비스",
  member_status:      "매장",
  vacation:           "일정",
  schedule_approved:  "일정",
  schedule_rejected:  "일정",
};
const resolveNotifType = (n: any): string => {
  const raw: string = n.type ?? n.category ?? "";
  return NOTIF_CATEGORY_LABEL[raw] ?? raw;
};

const normalizeNotifMessage = (msg: string) =>
  msg.replace(/올렸어요/g, "작성했어요").replace(/올렸습니다/g, "작성했습니다");

// ─── Constants ───────────────────────────────────────────────────────────────



// ─── Checklist types ──────────────────────────────────────────────────────────

interface ChecklistItem {
  id: number;
  text: string;
  checked: boolean;
}
interface StoreEmployee {
  id: number;  // store_members.id
  name: string;
  image_url?: string | null;
}
interface ChecklistState {
  commonItems: ChecklistItem[];
  employees: StoreEmployee[];
  employeeItems: Record<number, ChecklistItem[]>;
}

const SHIFT_PALETTE = [
  { color: "#FFB300", bg: "#FDF9DF" },
  { color: "#1EDC83", bg: "#ECFFF1" },
  { color: "#14C1FA", bg: "#E8F9FF" },
  { color: "#7B61FF", bg: "#F0EDFF" },
  { color: "#43A047", bg: "#E8F5E9" },
];
const NAMED_SHIFT_STYLE: Record<string, { color: string; bg: string }> = {
  "오픈":  { color: "#FFB300", bg: "#FDF9DF" },
  "미들":  { color: "#1EDC83", bg: "#ECFFF1" },
  "마감":  { color: "#14C1FA", bg: "#E8F9FF" },
  "오전":  { color: "#FFB300", bg: "#FDF9DF" },
  "오후":  { color: "#1EDC83", bg: "#ECFFF1" },
  "저녁":  { color: "#14C1FA", bg: "#E8F9FF" },
  "1교대": { color: "#FFB300", bg: "#FDF9DF" },
  "2교대": { color: "#1EDC83", bg: "#ECFFF1" },
  "3교대": { color: "#14C1FA", bg: "#E8F9FF" },
};

type SalesChip = "yesterday" | "week" | "month";

// ─── Pull-to-refresh ──────────────────────────────────────────────────────────

const PULL_THRESHOLD        = 80;
const INDICATOR_SIZE        = 52;
const INDICATOR_CONTAINER_H = 96;
const ICON_MARGIN_BOTTOM    = 20;
const ICON_APPEAR_PROGRESS  = ICON_MARGIN_BOTTOM / INDICATOR_CONTAINER_H;
const WAVE_A = 6;

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
      backgroundColor: "#F7F7F8",
    }, containerStyle]}>
      <Animated.View style={[{
        width: INDICATOR_SIZE, height: INDICATOR_SIZE,
        borderRadius: 14, overflow: "hidden",
        marginBottom: ICON_MARGIN_BOTTOM,
      }, iconContainerStyle]}>
        <Svg width={INDICATOR_SIZE} height={INDICATOR_SIZE} style={{ position: "absolute" }}>
          <Defs>
            <ClipPath id="ownerWaterClip">
              <Path d={waveClipD} />
            </ClipPath>
          </Defs>
          <SvgImage
            href={ICON_IMG_URI}
            x={0} y={0}
            width={INDICATOR_SIZE} height={INDICATOR_SIZE}
            clipPath="url(#ownerWaterClip)"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const OwnerHomeScreen: React.FC<ScreenProps<"OwnerHome">> = ({ navigation }) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth, 430) - 40;
  const cardSlot  = cardWidth + 8;
  const attendSnapOffsets    = [0, cardSlot, 2 * cardSlot, 3 * cardSlot];
  const checklistSnapOffsets = [0, cardSlot, 2 * cardSlot];

  const { toast } = useToast();
  const { showNavToast } = useNavToast();
  const insets = useSafeAreaInsets();
  // ── Store / User info ──
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerImageUrl, setOwnerImageUrl] = useState<string | null>(null);

  const memberId = Number(localStorage.getItem("currentMemberId") ?? 0);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  // ── Pull-to-refresh ──
  const [refreshKey, setRefreshKey] = useState(0);
  const fillProgress = useSharedValue(0);
  const hapticFired  = useSharedValue(0);
  const iconScale    = useSharedValue(1);
  const barProgress  = useSharedValue(0);
  const barOpacity   = useSharedValue(0);
  const bellRotate   = useSharedValue(0);

  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellRotate.value}deg` }],
  }));

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<"현황" | "관리">("현황");
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Date ──
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  // ── Attendance ──
  const [attendance, setAttendance] = useState<AttendanceTodayRow[]>([]);
  const [attendanceCardIndex, setAttendanceCardIndex] = useState(0);

  // ── Notifications ──
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

  // ── Sales ──
  const [salesChip, setSalesChip] = useState<SalesChip>("yesterday");
  const [salesData, setSalesData] = useState<{ yesterday: number | null; week: number | null; month: number | null }>({ yesterday: null, week: null, month: null });

  // ── Board ──
  const [boardPosts, setBoardPosts] = useState<BoardItem[]>([]);
  const [todayBoardCount, setTodayBoardCount] = useState(0);

  // ── Checklist ──
  const [checklistData, setChecklistData] = useState<ChecklistState>({ commonItems: [], employees: [], employeeItems: {} });
  const [checklistCardIndex, setChecklistCardIndex] = useState(0);
  const [checklistSelectedEmployee, setChecklistSelectedEmployee] = useState<Record<string, number>>({});
  const [storeShiftDefs, setStoreShiftDefs] = useState<Array<{ key: string; label: string; color: string; bg: string; timeRange: string }>>([]);
  const [staffPerShift, setStaffPerShift] = useState<Record<string, StoreEmployee[]>>({});
  const [checklistSheet, setChecklistSheet] = useState<{ mode: "add" | "edit"; item?: ChecklistItem } | null>(null);
  const [checklistText, setChecklistText] = useState("");
  const checklistScrollRef = useRef<ScrollView>(null);

  // ── Management data ──
  const [memberRequestCount, setMemberRequestCount] = useState(0);
  const [worklogRequestCount, setWorklogRequestCount] = useState(0);
  const [scheduleRequestCount, setScheduleRequestCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [monthlySalaryTotal, setMonthlySalaryTotal] = useState<number | null>(null);

  // ── Info modal ──
  interface InfoModalConfig {
    title: string;
    desc: string;
    statusDots?: { color: string; label: string }[];
  }
  const [infoModal, setInfoModal] = useState<InfoModalConfig | null>(null);

  // ── Checklist info modal ──
  const [checklistInfoVisible, setChecklistInfoVisible] = useState(false);

  // ── Account sheet ──
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [myStores, setMyStores] = useState<MyStore[]>([]);

  // ── Store shifts ──
  const [storeShifts, setStoreShifts] = useState<{ name: string; start_time: string | null; end_time: string | null; sort_order: number; is_active: boolean }[]>([]);

  // ── Skeleton loading ──
  const [dataLoaded, setDataLoaded] = useState(false);

  // ─── Checklist fetch helper ───────────────────────────────────────────────

  const fetchChecklistData = useCallback(async () => {
    if (!storeId) return;
    try {
      const [staffRes, todoRes, storeInfoRes] = await Promise.all([
        getCachedStaffList(storeId),
        api.post("/api/owner/todo/list", { store_id: storeId }).catch(() => []),
        getCachedStoreInfo(storeId).catch(() => null),
      ]);

      // 매장 파트 정의 (동적)
      const rawShifts: any[] = (storeInfoRes?.shifts ?? []).filter((sh: any) => sh.is_active !== false && sh.name);
      const defs = rawShifts.map((sh: any, i: number) => {
        const style = NAMED_SHIFT_STYLE[sh.name] ?? SHIFT_PALETTE[i % SHIFT_PALETTE.length];
        const start = sh.start_time?.slice(0, 5) ?? "";
        const end   = sh.end_time?.slice(0, 5)   ?? "";
        return { key: sh.name, label: sh.name, color: style.color, bg: style.bg, timeRange: start && end ? `${start}~${end}` : "" };
      });
      setStoreShiftDefs(defs);

      // 파트별 등록 직원 매핑
      const activeStaff: any[] = (Array.isArray(staffRes) ? staffRes : []).filter((s: any) => !s.is_deleted && s.name && s.contract?.working_status !== "퇴사" && s.contract?.working_status !== "앱탈퇴");
      const shiftMap: Record<string, StoreEmployee[]> = {};
      defs.forEach((d) => { shiftMap[d.key] = []; });
      activeStaff.forEach((s: any) => {
        const schedule: any[] = s.work_schedule ?? [];
        const shiftNames = [...new Set(schedule.map((ws: any) => ws.shift_name).filter(Boolean))] as string[];
        shiftNames.forEach((shiftName) => {
          if (!shiftMap[shiftName]) shiftMap[shiftName] = [];
          shiftMap[shiftName].push({ id: s.id, name: s.name as string, image_url: s.image_url ?? null });
        });
      });
      setStaffPerShift(shiftMap);

      const employees: StoreEmployee[] = activeStaff.map((s: any) => ({ id: s.id, name: s.name as string, image_url: s.image_url ?? null }));
      const todosArr: any[] = Array.isArray(todoRes) ? todoRes : [];
      // 백엔드 /todo/list는 type 필드 없이 공용 todo만 반환하므로 전체를 commonItems로 처리
      const commonItems = todosArr
        .filter((t) => !t.employee_id && t.type !== "personal")
        .map((t) => ({ id: t.id, text: t.content, checked: t.is_achieved }));
      const employeeItems: Record<number, ChecklistItem[]> = {};
      employees.forEach((emp) => {
        employeeItems[emp.id] = todosArr.filter((t) => t.employee_id === emp.id).map((t) => ({ id: t.id, text: t.content, checked: t.is_achieved }));
      });
      setChecklistData({ commonItems, employees, employeeItems });
      setStaffCount(employees.length);
    } catch {}
  }, [storeId]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!storeId) { setDataLoaded(true); return; }
    (async () => {
      let resolvedStoreName = "";
      let realMemberId = memberId;
      try {
        const me = await getMe();
        if (me?.id) realMemberId = me.id;
        if (me?.name) localStorage.setItem("currentUserName", me.name);
        if (me?.image_url) setOwnerImageUrl(me.image_url);
      } catch {}
      try {
        const info = await getOwnerInfo(realMemberId, storeId);
        resolvedStoreName = (info as any)?.store_name ?? "";
        setStoreName(resolvedStoreName);
        setOwnerName((info as any)?.nickname ?? (info as any)?.name ?? "");
      } catch {}
      registerForPushNotifications().catch((e) => console.warn(e));

      try {
        const stores = await getMyStores();
        const storeArr = Array.isArray(stores) ? stores : [];
        setMyStores(storeArr);
        if (!resolvedStoreName) {
          const match = storeArr.find((s) => s.store_id === storeId && s.role === "owner") ?? storeArr.find((s) => s.store_id === storeId);
          if (match?.store_name) setStoreName(match.store_name);
        }
      } catch { setMyStores([]); }

      // notifications
      try {
        const notifs = await getNotifications(false, storeId);
        const unread = Array.isArray(notifs) ? notifs.filter((n) => !n.is_read) : [];
        setNotifications(unread);
      } catch { setNotifications([]); }

      // board
      try {
        const posts = await getBoardList(storeId);
        const allPosts = Array.isArray(posts) ? posts : [];
        setBoardPosts(allPosts.slice(0, 3));
        const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const todayKstStr = nowKst.toISOString().slice(0, 10);
        setTodayBoardCount(allPosts.filter((p: BoardItem) => (p.created_at ?? "").slice(0, 10) === todayKstStr).length);
      } catch { setBoardPosts([]); }

      // management counts
      try {
        const reqs = await getMemberRequests(storeId);
        setMemberRequestCount(Array.isArray(reqs) ? reqs.length : 0);
      } catch {}

      let badgeCount = 0;
      try {
        const wReqs = await getOwnerWorklogRequests(storeId);
        const wCount = Array.isArray(wReqs) ? wReqs.filter((r) => r.status === "pending").length : 0;
        setWorklogRequestCount(wCount);
        badgeCount += wCount;
      } catch {}

      try {
        const sReqs = await getOwnerScheduleRequests(storeId);
        const sCount = Array.isArray(sReqs) ? sReqs.filter((r) => r.status === "pending").length : 0;
        setScheduleRequestCount(sCount);
        badgeCount += sCount;
      } catch {}

      try {
        const now = new Date();
        const payslips = await getPayslips(storeId, now.getFullYear(), now.getMonth() + 1);
        const pList = Array.isArray(payslips) ? payslips : [];
        const pTotal = pList.reduce((sum: number, p: any) => sum + (p.total_pay ?? p.estimated_pay ?? p.base_pay ?? 0), 0);
        setMonthlySalaryTotal(pTotal);
      } catch {}

      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const yesterday = subDays(now, 1);
        const yesterdayStr = format(yesterday, "yyyy-MM-dd");
        const todayStr = format(now, "yyyy-MM-dd");

        const dayOfWeek = now.getDay();
        const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = subDays(now, daysToMon);
        const weekStartStr = format(weekStart, "yyyy-MM-dd");

        const currentReports: any[] = (await getClosingReports(storeId, year, month) as any) ?? [];
        let weekReports = currentReports;

        const wYear = weekStart.getFullYear();
        const wMonth = weekStart.getMonth() + 1;
        if (wYear !== year || wMonth !== month) {
          const prevReports: any[] = (await getClosingReports(storeId, wYear, wMonth) as any) ?? [];
          weekReports = [...prevReports, ...currentReports];
        }

        const yesterdayTotal = currentReports
          .filter((r: any) => r.report_date === yesterdayStr)
          .reduce((s: number, r: any) => s + (r.net_sales ?? 0), 0);
        const weekTotal = weekReports
          .filter((r: any) => r.report_date >= weekStartStr && r.report_date <= todayStr)
          .reduce((s: number, r: any) => s + (r.net_sales ?? 0), 0);
        const monthTotal = currentReports.reduce((s: number, r: any) => s + (r.net_sales ?? 0), 0);

        setSalesData({ yesterday: yesterdayTotal, week: weekTotal, month: monthTotal });
      } catch {}

      try {
        const storeData = await getCachedStoreInfo(storeId);
        const shifts = ((storeData as any)?.shifts ?? []).filter((s: any) => s.is_active !== false);
        if (shifts.length > 0) setStoreShifts(shifts);
      } catch {}

      updateBadge(badgeCount);
      await fetchChecklistData();
      setDataLoaded(true);
    })();
  }, [storeId, memberId, refreshKey]);

  useEffect(() => {
    if (!storeId || activeTab !== "현황") return;
    (async () => {
      try {
        const rows = await getTodayAttendance(storeId, format(selectedDate, "yyyy-MM-dd"));
        setAttendance(Array.isArray(rows) ? rows : []);
      } catch { setAttendance([]); }
    })();
  }, [storeId, selectedDate, activeTab, refreshKey]);

  // ─── Pull-to-refresh handlers ─────────────────────────────────────────────

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

  // ─── Computed ─────────────────────────────────────────────────────────────

  const checklistGroups = useMemo(() =>
    storeShiftDefs.length > 0
      ? storeShiftDefs.map((sg) => ({ ...sg, employees: staffPerShift[sg.key] ?? [] }))
      : [{ key: "전체", label: "전체", color: "#4261FF", bg: "#EEF2FF", timeRange: "", employees: checklistData.employees }],
    [storeShiftDefs, staffPerShift, checklistData.employees]
  );

  const activeGroupKey = checklistGroups[checklistCardIndex]?.key ?? checklistGroups[0]?.key ?? "";
  const activeSelectedEmpId = checklistSelectedEmployee[activeGroupKey] ?? 0;
  const activeGroup = checklistGroups[checklistCardIndex];
  const activeSelectedEmpName = activeGroup?.employees.find((e) => e.id === activeSelectedEmpId)?.name ?? "";

  const {
    checkin, late, checkout, absent, workingNow, onBreak, totalAttendance,
  } = useMemo(() => ({
    checkin:        attendance.filter((a) => a.status !== "absent"),
    late:           attendance.filter((a) => a.clock_in && a.work_start && a.clock_in > a.work_start),
    checkout:       attendance.filter((a) => a.status === "off_work"),
    absent:         attendance.filter((a) => a.status === "absent"),
    workingNow:     attendance.filter((a) => a.status === "working" || a.status === "on_break"),
    onBreak:        attendance.filter((a) => a.status === "on_break"),
    totalAttendance: attendance.length,
  }), [attendance]);

  const shiftTagGroups = useMemo(() =>
    checklistGroups.map((g) => ({ label: g.label, count: g.employees.length })).filter((g) => g.count > 0),
    [checklistGroups]
  );

  const attendanceCards = useMemo(() => [
    {
      key: "working",
      label: "근무중",
      desc: "근무중이에요",
      emptyMsg: "근무중인 직원이 없어요",
      dotColor: "#1EDC83",
      rows: workingNow,
    },
    {
      key: "checkin",
      label: "출근",
      desc: "출근 했어요",
      emptyMsg: "출근한 직원이 없어요",
      dotColor: "#10C97D",
      rows: checkin,
    },
    {
      key: "checkout",
      label: "퇴근",
      desc: "퇴근 했어요",
      emptyMsg: "퇴근한 직원이 없어요",
      dotColor: "#4261FF",
      rows: checkout,
    },
    {
      key: "absent",
      label: "결근",
      desc: "결근 했어요",
      emptyMsg: "결근한 직원이 없어요",
      dotColor: "#FF3D3D",
      rows: absent,
    },
  ], [workingNow, checkin, checkout, absent]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDate = (d: Date) => {
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dayName = format(d, "EEEE", { locale: ko }).charAt(0);
    return `${yy}.${mm}.${dd} (${dayName})`;
  };

  const timeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "방금";
      if (mins < 60) return `${mins}분 전`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}시간 전`;
      const days = Math.floor(hrs / 24);
      return `${days}일 전`;
    } catch { return ""; }
  };

  const salesLabel = () => {
    const now = new Date();
    if (salesChip === "yesterday") {
      const y = subDays(now, 1);
      return `${y.getMonth() + 1}월 ${y.getDate()}일 총매출`;
    }
    if (salesChip === "week") return "이번주 총매출";
    return `${now.getMonth() + 1}월 총매출`;
  };

  const handleLogout = async () => {
    clearBadge();
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const dismissNotification = async (id: number) => {
    try { await markNotificationRead(id); } catch {}
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleChecklistAdd = async () => {
    if (!checklistText.trim()) return;
    const isCommon = activeSelectedEmpId === 0;
    const isEdit = checklistSheet?.mode === "edit" && checklistSheet?.item;
    try {
      if (isEdit) {
        await api.post("/api/owner/todo/delete", { store_id: storeId, id: checklistSheet!.item!.id });
      }
      await api.post("/api/owner/todo/add", {
        store_id: storeId,
        content: checklistText.trim(),
        type: isCommon ? "public" : "personal",
        employee_id: isCommon ? null : activeSelectedEmpId,
      });

      await fetchChecklistData();

      toast({ description: isEdit ? "체크리스트가 수정되었어요." : "체크리스트가 등록되었어요." });
      setChecklistSheet(null);
      setChecklistText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "처리에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const handleChecklistDelete = async (itemId: number) => {
    try {
      await api.post("/api/owner/todo/delete", { store_id: storeId, id: itemId });
      await fetchChecklistData();
      toast({ description: "체크리스트가 삭제되었어요." });
      setChecklistSheet(null);
      setChecklistText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    }
  };

  const menuItems = [
    { label: "내 정보", onPress: () => navigation.navigate("OwnerProfile") },
    { label: "공지사항", onPress: () => navigation.navigate("Announcements") },
    { label: "자주 묻는 질문", onPress: () => navigation.navigate("FAQ") },
    { label: "건의함", onPress: () => navigation.navigate("Feedback") },
  ];

  const menuSubItems: { label: string; onPress: () => void; danger?: boolean }[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!dataLoaded) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <OwnerHomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>

      {/* ── 헤더 ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: "#FFFFFF",
        }}
      >
        <AnimatedPressable onPress={() => setAccountSheetOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={8} scaleAmount={0.97} opacityAmount={0.8}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#292B2E", letterSpacing: -0.2 }}>
            {storeName || "매장"}
          </Text>
          <View
            style={{
              minWidth: 33,
              height: 20,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: "#4261FF",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 6,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#FFFFFF" }}>사장님</Text>
          </View>
          <ChevronDown size={16} color="#9EA3AD" />
        </AnimatedPressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <AnimatedPressable onPress={() => { navigation.navigate("Notifications"); }} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7} style={{ position: "relative" }}>
            <Animated.View style={bellAnimStyle}>
              <Bell size={20} color="#19191B" />
            </Animated.View>
            {notifications.length > 0 && (
              <View style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3D3D", borderWidth: 1.5, borderColor: "#FFFFFF" }} />
            )}
          </AnimatedPressable>
          <AnimatedPressable onPress={() => setMenuOpen(true)} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7}>
            <Menu size={20} color="#19191B" />
          </AnimatedPressable>
        </View>
      </View>

      {/* ── 탭 ── */}
      <View style={{ flexDirection: "row", paddingLeft: 20, gap: 20, backgroundColor: "#FFFFFF" }}>
        {(["현황", "관리"] as const).map((tab) => (
          <AnimatedPressable key={tab} onPress={() => setActiveTab(tab)} hitSlop={4} scaleAmount={0.95} opacityAmount={0.8}>
            <Text
              style={{
                paddingTop: 6,
                paddingBottom: 10,
                fontSize: 20,
                fontWeight: "700",
                color: activeTab === tab ? "#19191B" : "#AAB4BF",
                letterSpacing: -0.4,
              }}
            >
              매장 {tab}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {/* ── 콘텐츠 ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: "#F7F7F8" }}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        <PullRefreshIndicator fillProgress={fillProgress} iconScale={iconScale} />
        {/* ── 알림 카드 — 웹앱과 동일한 스타일 ── */}
        {notifications.length > 0 && (
          <View style={{ backgroundColor: "#FFFFFF" }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8 }}
            >
              {notifications.slice(0, 5).map((n) => {
                const notifType: string = resolveNotifType(n);
                const notifMsg: string = normalizeNotifMessage((n as any).message ?? n.body ?? "");
                const refId: number | undefined = (n as any).reference_id;
                const handleCardPress = () => {
                  dismissNotification(n.id);
                  if (notifType === "게시판") { showNavToast("게시글로 이동했어요"); navigation.navigate(refId ? "BoardDetail" : "BoardList", refId ? { id: refId } : undefined as any); }
                  else if (notifType === "공지") { showNavToast("공지사항으로 이동했어요"); navigation.navigate(refId ? "AnnouncementDetail" : "Announcements", refId ? { id: refId } : undefined as any); }
                  else if (notifType === "직원관리") { showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement", { initialTab: "가입요청" }); }
                  else if (notifType === "일정변경") { showNavToast("일정 관리로 이동했어요"); navigation.navigate("OwnerScheduleManagement", { initialTab: "일정 변경 요청" }); }
                  else if (notifType === "수습종료") { showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement", { initialTab: "관리" }); }
                  else if (notifType === "마감보고") { showNavToast("매출 관리로 이동했어요"); navigation.navigate("OwnerSalesManagement"); }
                  else if (notifType === "일정") {
                    if (refId && notifMsg.includes("변경")) { showNavToast("일정 변경으로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_change", id: refId }); }
                    else if (refId && notifMsg.includes("추가")) { showNavToast("일정 추가로 이동했어요"); navigation.navigate("NotificationDeepLink", { type: "schedule_added", id: refId }); }
                    else { showNavToast("일정 관리로 이동했어요"); navigation.navigate("OwnerScheduleManagement"); }
                  }
                  else if (notifType === "급여") { showNavToast(refId ? "급여명세서로 이동했어요" : "급여 관리로 이동했어요"); navigation.navigate(refId ? "PayslipDetail" : "OwnerSalaryManagement", refId ? { payslipId: refId } : undefined as any); }
                  else if (["근태", "결근", "지각", "출근", "퇴근", "조기퇴근"].includes(notifType)) { showNavToast("근태 현황으로 이동했어요"); navigation.navigate("OwnerAttendanceManagement"); }
                  else if (notifType === "매장") { showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement", { initialTab: "관리" }); }
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
                        <Text style={{ fontSize: 12 }}>{notifType === "게시판" ? "📌" : "📁"}</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF", letterSpacing: -0.28 }} numberOfLines={1}>
                          {notifType}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", letterSpacing: -0.28, lineHeight: 20 }} numberOfLines={2}>
                        {notifMsg}
                      </Text>
                    </View>
                    <AnimatedPressable onPress={(e: any) => { e?.stopPropagation?.(); dismissNotification(n.id); }} hitSlop={8} scaleAmount={0.85} opacityAmount={0.7} style={{ position: "absolute", top: 8, right: 8 }}>
                      <X size={16} color="#788A9F" />
                    </AnimatedPressable>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ════════════ 현황 탭 ════════════ */}
        {activeTab === "현황" ? (
          <>
            {/* ── 날짜 선택 ── */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 10,
                backgroundColor: "#FFFFFF",
                borderBottomWidth: 1,
                borderBottomColor: "#EBEBEB",
              }}
            >
              <AnimatedPressable
                onPress={() => setSelectedDate((d) => subDays(d, 1))}
                hitSlop={8}
                scaleAmount={0.88}
                opacityAmount={0.7}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <ChevronLeft size={18} color="#9EA3AD" />
              </AnimatedPressable>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <AnimatedPressable
                  onPress={() => {
                    setPickerMonth(
                      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
                    );
                    setCalendarOpen(true);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  hitSlop={8}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                >
                  {isToday(selectedDate) && (
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF", letterSpacing: -0.32 }}>
                      [오늘]
                    </Text>
                  )}
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#19191B", letterSpacing: -0.32 }}>
                    {formatDate(selectedDate)}
                  </Text>
                  <ChevronDown size={18} color="#9EA3AD" />
                </AnimatedPressable>
                {!isToday(selectedDate) && (
                  <AnimatedPressable
                    onPress={() => { hapticSelection(); setSelectedDate(new Date()); }}
                    scaleAmount={0.93}
                    opacityAmount={0.75}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#EEF2FF" }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF", letterSpacing: -0.24 }}>오늘로</Text>
                  </AnimatedPressable>
                )}
              </View>
              <AnimatedPressable
                onPress={() => setSelectedDate((d) => addDays(d, 1))}
                hitSlop={8}
                scaleAmount={0.88}
                opacityAmount={0.7}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <ChevronRight size={18} color="#9EA3AD" />
              </AnimatedPressable>
            </View>

            {/* ═══ 1. 근태 현황 섹션 ═══ */}
            <>
              {/* 섹션 헤더 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 20,
                  paddingBottom: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.sectionTitle}>근태 현황</Text>
                  <AnimatedPressable
                    onPress={() =>
                      setInfoModal({
                        title: "출퇴근 현황 확인",
                        desc: "직원들의 출퇴근 현황을 한 눈에 확인할 수 있어요.\n직원 프로필 사진 왼쪽 상단 아이콘 색상으로 상태를 구분해요",
                        statusDots: [
                          { color: "#10C97D", label: "정상 출근" },
                          { color: "#FF862D", label: "지각" },
                          { color: "#4261FF", label: "퇴근" },
                          { color: "#FF3D3D", label: "결근" },
                        ],
                      })
                    }
                    hitSlop={8}
                    scaleAmount={0.88}
                    opacityAmount={0.7}
                  >
                    <Info size={14} color="#AAB4BF" />
                  </AnimatedPressable>
                </View>
                <AnimatedPressable
                  onPress={() => { showNavToast("근태 관리로 이동했어요"); navigation.navigate("OwnerAttendanceManagement"); }}
                  hitSlop={8}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                >
                  <Text style={styles.moreBtn}>근태관리</Text>
                  <ChevronRight size={14} color="#9EA3AD" />
                </AnimatedPressable>
              </View>

              {/* Stats 2-box row */}
              <View style={{ paddingHorizontal: 20, marginBottom: 12, flexDirection: "row", gap: 8 }}>
                {/* Left box: 출근 + 지각 */}
                <View style={[styles.statBox, { flex: 1, flexDirection: "row", padding: 0, overflow: "hidden" }]}>
                  {[
                    { label: "출근", value: checkin.length, color: "#10C97D", bg: "#E5F9EC", borderColor: "#10C97D", valueColor: "#19191B" },
                    { label: "지각", value: late.length, color: "#FF862D", bg: "#FFEEE2", borderColor: "#FF862D", valueColor: "#FF862D" },
                  ].map((stat, i) => (
                    <React.Fragment key={stat.label}>
                      {i > 0 && <View style={{ width: 1, backgroundColor: "#EBEBEB" }} />}
                      <View style={{ flex: 1, alignItems: "center", paddingVertical: 16 }}>
                        <View style={{
                          borderWidth: 1.2, borderColor: stat.borderColor,
                          backgroundColor: stat.bg, borderRadius: 9999,
                          paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6,
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: stat.color }}>{stat.label}</Text>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: stat.valueColor }}>{stat.value}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                {/* Right box: 퇴근 + 결근 */}
                <View style={[styles.statBox, { flex: 1, flexDirection: "row", padding: 0, overflow: "hidden" }]}>
                  {[
                    { label: "퇴근", value: checkout.length, color: "#4261FF", bg: "#E8F3FF", borderColor: "#4261FF", valueColor: "#19191B" },
                    { label: "결근", value: absent.length, color: "#FF3D3D", bg: "#FFEAE6", borderColor: "#FF3D3D", valueColor: "#FF3D3D" },
                  ].map((stat, i) => (
                    <React.Fragment key={stat.label}>
                      {i > 0 && <View style={{ width: 1, backgroundColor: "#EBEBEB" }} />}
                      <View style={{ flex: 1, alignItems: "center", paddingVertical: 16 }}>
                        <View style={{
                          borderWidth: 1.2, borderColor: stat.borderColor,
                          backgroundColor: stat.bg, borderRadius: 9999,
                          paddingHorizontal: 10, paddingVertical: 3, marginBottom: 6,
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: stat.color }}>{stat.label}</Text>
                        </View>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: stat.valueColor }}>{stat.value}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </View>

              {/* 근태 카드 스크롤 (4개) */}
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToOffsets={attendSnapOffsets}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                  onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / cardSlot);
                    setAttendanceCardIndex(Math.max(0, Math.min(idx, attendanceCards.length - 1)));
                  }}
                  scrollEventThrottle={16}
                >
                  {attendanceCards.map((card) => (
                    <AttendanceCard key={card.key} card={card} cardWidth={cardWidth} />
                  ))}
                </ScrollView>
                {/* Dot indicator */}
                <DotIndicator count={attendanceCards.length} activeIndex={attendanceCardIndex} />
              </View>
            </>

            {/* ═══ 2. 배너 섹션 ═══ */}
            <View style={{ height: 20 }} />
            <AdMobNative />

            {/* ═══ 3. 직원 체크리스트 섹션 ═══ */}
            <View style={{ height: 20 }} />
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingBottom: 12,
                  gap: 6,
                }}
              >
                <Text style={styles.sectionTitle}>직원 체크 리스트</Text>
                <AnimatedPressable
                  onPress={() => setChecklistInfoVisible(true)}
                  hitSlop={8}
                  scaleAmount={0.88}
                  opacityAmount={0.7}
                >
                  <Info size={14} color="#AAB4BF" />
                </AnimatedPressable>
              </View>

              <View>
                <ScrollView
                  ref={checklistScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToOffsets={checklistSnapOffsets}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                  onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / cardSlot);
                    setChecklistCardIndex(Math.max(0, Math.min(idx, checklistGroups.length - 1)));
                  }}
                  scrollEventThrottle={16}
                  onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const x = e.nativeEvent.contentOffset.x;
                    const idx = Math.round(x / cardSlot);
                    const clamped = Math.max(0, Math.min(idx, checklistGroups.length - 1));
                    checklistScrollRef.current?.scrollTo({ x: clamped * cardSlot, animated: true });
                    if (clamped !== checklistCardIndex) hapticLight();
                    setChecklistCardIndex(clamped);
                  }}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const x = e.nativeEvent.contentOffset.x;
                    const idx = Math.round(x / cardSlot);
                    const clamped = Math.max(0, Math.min(idx, checklistGroups.length - 1));
                    checklistScrollRef.current?.scrollTo({ x: clamped * cardSlot, animated: true });
                    if (clamped !== checklistCardIndex) hapticLight();
                    setChecklistCardIndex(clamped);
                  }}
                >
                  {checklistGroups.map((group) => (
                    <ChecklistCard
                      key={group.key}
                      group={group}
                      commonItems={checklistData.commonItems}
                      employeeItems={checklistData.employeeItems}
                      selectedEmployee={checklistSelectedEmployee[group.key] ?? 0}
                      onSelectEmployee={(id) => {
                        hapticSelection();
                        setChecklistSelectedEmployee((prev) => ({ ...prev, [group.key]: id }));
                      }}
                      onAdd={() => { setChecklistText(""); setChecklistSheet({ mode: "add" }); }}
                      onEdit={(item) => { setChecklistText(item.text); setChecklistSheet({ mode: "edit", item }); }}
                      cardWidth={cardWidth}
                    />
                  ))}
                </ScrollView>
                <DotIndicator count={checklistGroups.length} activeIndex={checklistCardIndex} />
              </View>
            </>

            {/* ═══ 4. 매출 현황 섹션 ═══ */}
            <View style={{ height: 20 }} />
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingBottom: 12,
                }}
              >
                <Text style={styles.sectionTitle}>매출 현황</Text>
                <AnimatedPressable
                  onPress={() => { showNavToast("매출 관리로 이동했어요"); navigation.navigate("OwnerSalesManagement"); }}
                  hitSlop={8}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                >
                  <Text style={styles.moreBtn}>매출관리</Text>
                  <ChevronRight size={14} color="#9EA3AD" />
                </AnimatedPressable>
              </View>

              {/* 칩 3개 */}
              <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 }}>
                {(
                  [
                    { key: "yesterday", label: "전날" },
                    { key: "week", label: "이번주" },
                    { key: "month", label: "이번달" },
                  ] as { key: SalesChip; label: string }[]
                ).map((chip) => {
                  const active = salesChip === chip.key;
                  return (
                    <AnimatedPressable
                      key={chip.key}
                      onPress={() => setSalesChip(chip.key)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 5,
                        borderRadius: 100,
                        borderWidth: 1,
                        backgroundColor: active ? "#E8F3FF" : "#FFFFFF",
                        borderColor: active ? "#4261FF" : "#DBDCDF",
                      }}
                      scaleAmount={0.94}
                      opacityAmount={0.8}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: active ? "#4261FF" : "#AAB4BF",
                          letterSpacing: -0.28,
                        }}
                      >
                        {chip.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              {/* 매출 박스 */}
              <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                <View style={styles.shadowCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B", letterSpacing: -0.28 }}>
                      {salesLabel()}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#4261FF", letterSpacing: -0.36 }}>
                      {(() => {
                        const val = salesChip === "yesterday" ? salesData.yesterday : salesChip === "week" ? salesData.week : salesData.month;
                        return val !== null ? `${val.toLocaleString()}원` : "— 원";
                      })()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: "#AAB4BF", marginTop: 6 }}>
                    직원 마감 보고 기준 순매출 합산
                  </Text>
                </View>
              </View>
            </>

            {/* ═══ 5. 최근 등록된 게시글 ═══ */}
            <View style={{ height: 20 }} />
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingBottom: 12,
                }}
              >
                <Text style={styles.sectionTitle}>최근 등록된 게시글</Text>
                <AnimatedPressable
                  onPress={() => { showNavToast("게시판으로 이동했어요"); navigation.navigate("BoardList"); }}
                  hitSlop={8}
                  scaleAmount={0.97}
                  opacityAmount={0.8}
                  style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                >
                  <Text style={styles.moreBtn}>게시판</Text>
                  <ChevronRight size={14} color="#9EA3AD" />
                </AnimatedPressable>
              </View>

              <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}>
                {boardPosts.length === 0 ? (
                  <View style={styles.shadowCard}>
                    <EmptyState message="등록된 게시글이 없어요" compact />
                  </View>
                ) : (
                  boardPosts.map((post) => {
                    return (
                      <AnimatedPressable
                        key={post.id}
                        onPress={() => { showNavToast("게시글로 이동했어요"); navigation.navigate("BoardDetail", { id: post.id }); }}
                        style={[styles.shadowCard, { flexDirection: "row", alignItems: "center", gap: 10 }]}
                        scaleAmount={0.98}
                        opacityAmount={0.85}
                      >
                        <Avatar name={post.writer} imageUrl={post.writer_image} size={44} style={{ flexShrink: 0 }} />
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: "#19191B",
                                letterSpacing: -0.26,
                              }}
                            >
                              {post.writer}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#9EA3AD" }}>
                              {timeAgo(post.created_at)}
                            </Text>
                          </View>
                          <Text
                            style={{ fontSize: 13, color: "#70737B", letterSpacing: -0.26 }}
                            numberOfLines={1}
                          >
                            {post.content || post.title}
                          </Text>
                        </View>
                      </AnimatedPressable>
                    );
                  })
                )}
              </View>
            </>
            <View style={{ height: 20 }} />
          </>
        ) : (
          /* ════════════ 관리 탭 ════════════ */
          <>
            {/* 배너 */}
            <View style={{ height: 20 }} />
            <AdMobNative />
            <View style={{ height: 20 }} />

            {/* ── 7개 관리 카드 ── */}
            <View style={{ paddingHorizontal: 20, gap: 12 }}>

              {/* 1. 근태 관리 */}
              <ManagementCard
                title="근태 관리"
                onPress={() => { showNavToast("근태 관리로 이동했어요"); navigation.navigate("OwnerAttendanceManagement"); }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.emojiCircle}>
                    <Text style={{ fontSize: 20 }}>📋</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#9EA3AD", marginBottom: 6 }}>
                      {new Date().getMonth() + 1}월 {String(new Date().getDate()).padStart(2, "0")}일 근태 현황
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <StatusPill label={`출근 ${checkin.length}명`} color="#10C97D" bg="#E5F9EC" />
                      <StatusPill label={`지각 ${late.length}명`} color="#FF862D" bg="#FFEEE2" />
                      <StatusPill label={`퇴근 ${checkout.length}명`} color="#4261FF" bg="#E8F3FF" />
                      <StatusPill label={`결근 ${absent.length}명`} color="#FF3D3D" bg="#FFEAE6" />
                    </View>
                  </View>
                </View>
              </ManagementCard>

              {/* 2. 직원 관리 */}
              <ManagementCard
                title="직원 관리"
                onPress={() => { showNavToast("직원 관리로 이동했어요"); navigation.navigate("OwnerStaffManagement"); }}
              >
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={styles.emojiCircle}>
                      <Text style={{ fontSize: 20 }}>👥</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: "#9EA3AD", marginBottom: 6 }}>
                        총 직원 {staffCount}명
                      </Text>
                      <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                        {shiftTagGroups.length > 0
                          ? shiftTagGroups.map((g) => {
                              const shiftStyle = getShiftStyle(g.label, storeShifts);
                              return (
                                <View key={g.label} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: shiftStyle.bg }}>
                                  <Text style={{ fontSize: 11, fontWeight: "600", color: shiftStyle.color }}>
                                    {g.label} {g.count}명
                                  </Text>
                                </View>
                              );
                            })
                          : (
                              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: "#E8F3FF" }}>
                                <Text style={{ fontSize: 11, fontWeight: "600", color: "#4261FF" }}>
                                  활성 {staffCount}명
                                </Text>
                              </View>
                            )
                        }
                      </View>
                    </View>
                  </View>
                  {memberRequestCount > 0 && (
                    <>
                      <View style={{ height: 1, backgroundColor: "#F2F3F5", marginVertical: 2 }} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={styles.emojiCircle}>
                          <Text style={{ fontSize: 20 }}>📝</Text>
                        </View>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 13, color: "#70737B" }}>
                            가입 승인 요청{" "}
                            <Text style={{ fontWeight: "700", color: "#19191B" }}>
                              {memberRequestCount}명
                            </Text>
                          </Text>
                          <AlertBadge label="요청 확인 필요" />
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </ManagementCard>

              {/* 3. 일정 관리 */}
              <ManagementCard
                title="일정 관리"
                onPress={() => { showNavToast("일정 관리로 이동했어요"); navigation.navigate("OwnerScheduleManagement"); }}
              >
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={styles.emojiCircle}>
                      <Text style={{ fontSize: 20 }}>🗓️</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: "#70737B" }}>직원 일정 관리하기</Text>
                  </View>
                  {scheduleRequestCount > 0 && (
                    <>
                      <View style={{ height: 1, backgroundColor: "#F2F3F5", marginVertical: 2 }} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={styles.emojiCircle}>
                          <Text style={{ fontSize: 20 }}>📅</Text>
                        </View>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 13, color: "#70737B" }}>
                            일정 변경 요청{" "}
                            <Text style={{ fontWeight: "700", color: "#19191B" }}>
                              {scheduleRequestCount}건
                            </Text>
                          </Text>
                          <AlertBadge label="요청 확인 필요" />
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </ManagementCard>

              {/* 4. 매출 관리 */}
              <ManagementCard
                title="매출 관리"
                onPress={() => { showNavToast("매출 관리로 이동했어요"); navigation.navigate("OwnerSalesManagement"); }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.emojiCircle}>
                    <Text style={{ fontSize: 20 }}>📊</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: "#70737B" }}>
                      {new Date().getMonth() + 1}월 총 매출
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginTop: 2 }}>
                      {salesData.month !== null ? `${salesData.month.toLocaleString()}원` : "— 원"}
                    </Text>
                  </View>
                </View>
              </ManagementCard>

              {/* 5. 급여 관리 */}
              <ManagementCard
                title="급여 관리"
                onPress={() => { showNavToast("급여 관리로 이동했어요"); navigation.navigate("OwnerSalaryManagement"); }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.emojiCircle}>
                    <Text style={{ fontSize: 20 }}>🪙</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: "#70737B" }}>
                      {new Date().getMonth() + 1}월 예상 전체 직원 급여
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginTop: 2 }}>
                      {monthlySalaryTotal !== null ? `${monthlySalaryTotal.toLocaleString()}원` : "— 원"}
                    </Text>
                  </View>
                </View>
              </ManagementCard>

              {/* 6. 게시판 관리 */}
              <ManagementCard
                title="게시판 관리"
                onPress={() => { showNavToast("게시판으로 이동했어요"); navigation.navigate("BoardList"); }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.emojiCircle}>
                    <Text style={{ fontSize: 20 }}>📌</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: "#70737B" }}>오늘 등록된 게시물</Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginTop: 2 }}>
                      {todayBoardCount}건
                    </Text>
                  </View>
                </View>
              </ManagementCard>

              {/* 7. 매장 관리 */}
              <ManagementCard
                title="매장 관리"
                onPress={() => { showNavToast("매장 관리로 이동했어요"); navigation.navigate("OwnerStoreInfo"); }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.emojiCircle}>
                    <Text style={{ fontSize: 20 }}>🏪</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>매장 정보 관리하기</Text>
                </View>
              </ManagementCard>

            </View>
          </>
        )}
      </ScrollView>

      {/* ── 달력 모달 ── */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setCalendarOpen(false)}
        >
          <Pressable
            style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, width: 320 }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* 월 네비게이터 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <AnimatedPressable
                onPress={() =>
                  setPickerMonth(
                    new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1),
                  )
                }
                hitSlop={8}
                scaleAmount={0.88}
                opacityAmount={0.7}
              >
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>
                {pickerMonth.getFullYear()}년 {pickerMonth.getMonth() + 1}월
              </Text>
              <AnimatedPressable
                onPress={() =>
                  setPickerMonth(
                    new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1),
                  )
                }
                hitSlop={8}
                scaleAmount={0.88}
                opacityAmount={0.7}
              >
                <ChevronRight size={20} color="#19191B" />
              </AnimatedPressable>
            </View>
            {/* 요일 헤더 */}
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                <View key={d} style={{ flex: 1, alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "500",
                      color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B",
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>
            {/* 날짜 그리드 */}
            {(() => {
              const py = pickerMonth.getFullYear(), pm = pickerMonth.getMonth();
              const firstDay = new Date(py, pm, 1).getDay();
              const daysInMonth = new Date(py, pm + 1, 0).getDate();
              const cells: { y: number; m: number; d: number; outside: boolean }[] = [];
              const prevDays = new Date(py, pm, 0).getDate();
              for (let i = firstDay - 1; i >= 0; i--) {
                const dt = new Date(py, pm - 1, prevDays - i);
                cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), outside: true });
              }
              for (let d = 1; d <= daysInMonth; d++) cells.push({ y: py, m: pm, d, outside: false });
              const rem = 7 - (cells.length % 7);
              if (rem < 7)
                for (let i = 1; i <= rem; i++) {
                  const dt = new Date(py, pm + 1, i);
                  cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), outside: true });
                }
              const weeks: typeof cells[] = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
              const today = new Date();
              return weeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
                  {week.map((cell, di) => {
                    const isSel =
                      !cell.outside &&
                      selectedDate.getFullYear() === cell.y &&
                      selectedDate.getMonth() === cell.m &&
                      selectedDate.getDate() === cell.d;
                    const isTodayCell =
                      !cell.outside &&
                      today.getFullYear() === cell.y &&
                      today.getMonth() === cell.m &&
                      today.getDate() === cell.d;
                    const isSun = di === 0, isSat = di === 6;
                    const textColor = cell.outside
                      ? "#AAB4BF"
                      : isSel
                      ? "#FFFFFF"
                      : isTodayCell
                      ? "#FFFFFF"
                      : isSun
                      ? "#FF5959"
                      : isSat
                      ? "#5DB1FF"
                      : "#19191B";
                    return (
                      <AnimatedPressable
                        key={di}
                        disabled={cell.outside}
                        onPress={() => {
                          setSelectedDate(new Date(cell.y, cell.m, cell.d));
                          setCalendarOpen(false);
                        }}
                        style={{ flex: 1, height: 40, alignItems: "center", justifyContent: "center" }}
                        scaleAmount={0.85}
                        opacityAmount={0.7}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            backgroundColor: isSel
                              ? "#4261FF"
                              : isTodayCell
                              ? "rgba(66,97,255,0.45)"
                              : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "500", color: textColor }}>
                            {cell.d}
                          </Text>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              ));
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Info 모달 ── */}
      <Modal
        visible={!!infoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModal(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setInfoModal(null)}
        >
          <Pressable
            style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: 320, gap: 0 }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* 제목 (Info 아이콘 포함) */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Info size={16} color="#AAB4BF" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B", letterSpacing: -0.3 }}>
                {infoModal?.title}
              </Text>
            </View>
            {/* 본문 */}
            <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 22, letterSpacing: -0.28, textAlign: "center", marginBottom: 16 }}>
              {infoModal?.desc}
            </Text>
            {/* 상태 도트 (근태현황용) */}
            {infoModal?.statusDots && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                {infoModal.statusDots.map((dot) => (
                  <View key={dot.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot.color }} />
                    <Text style={{ fontSize: 13, color: "#19191B" }}>{dot.label}</Text>
                  </View>
                ))}
              </View>
            )}
            <AnimatedPressable
              onPress={() => setInfoModal(null)}
              style={{ backgroundColor: "#4261FF", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
              scaleAmount={0.97}
              opacityAmount={0.8}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>확인</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Checklist Info 팝업 ── */}
      <ChecklistInfoModal
        visible={checklistInfoVisible}
        onClose={() => setChecklistInfoVisible(false)}
      />

      {/* ── SideMenu ── */}
      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={ownerName}
        storeName={storeName}
        roleLabel="사장님"
        imageUrl={ownerImageUrl}
        items={menuItems}
        subItems={menuSubItems}
      />

      {/* ── Checklist Sheet ── */}
      <BottomSheet
        isOpen={!!checklistSheet}
        onClose={() => { setChecklistSheet(null); setChecklistText(""); }}
        title={checklistSheet?.mode === "edit" ? "직원 체크리스트 수정" : `${activeSelectedEmpId === 0 ? "공통" : activeSelectedEmpName} 체크리스트 등록`}
      >
        <View style={{ position: "relative" }}>
          <TextInput
            multiline
            style={{
              height: 140, borderRadius: 12, borderWidth: 1,
              borderColor: "#DBDCDF", padding: 16,
              fontSize: 14, color: "#19191B", textAlignVertical: "top",
              backgroundColor: "#FFFFFF",
            }}
            placeholder="체크리스트 내용을 입력해주세요"
            placeholderTextColor="#AAB4BF"
            value={checklistText}
            onChangeText={(t) => { if (t.length <= 50) setChecklistText(t); }}
            maxLength={50}
          />
          <Text style={{ position: "absolute", bottom: 10, right: 14, fontSize: 12, color: "#AAB4BF" }}>
            {checklistText.length}/50
          </Text>
        </View>

        {checklistSheet?.mode === "edit" ? (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <AnimatedPressable
              onPress={() => checklistSheet?.item && handleChecklistDelete(checklistSheet.item.id)}
              style={{ flex: 1, height: 56, borderRadius: 16, borderWidth: 1, borderColor: "#DBDCDF", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#FF3D3D" }}>삭제하기</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleChecklistAdd}
              style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: checklistText.trim() ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}
              scaleAmount={0.97}
              opacityAmount={0.75}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>수정하기</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <AnimatedPressable
            onPress={handleChecklistAdd}
            style={{
              marginTop: 24, height: 56, borderRadius: 16,
              backgroundColor: checklistText.trim() ? "#4261FF" : "#DBDCDF",
              alignItems: "center", justifyContent: "center",
            }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: checklistText.trim() ? "#FFFFFF" : "#AAB4BF" }}>등록하기</Text>
          </AnimatedPressable>
        )}
      </BottomSheet>

      {/* ── Account Sheet ── */}
      <BottomSheet isOpen={accountSheetOpen} onClose={() => setAccountSheetOpen(false)} title="계정 유형 선택">
        {myStores.map((store) => {
          const isSelected = store.store_id === storeId && store.role === "owner";
          const roleLabel = store.role === "owner" ? "사장님" : store.employee_type ?? "직원";
          return (
            <AnimatedPressable
              key={`${store.store_id}-${store.role}`}
              onPress={() => {
                if (isSelected) return;
                hapticHeavy();
                toast({ description: "계정 유형이 전환 되었어요" });
                setAccountSheetOpen(false);
                if (store.role === "employee") {
                  localStorage.setItem("currentStoreId", String(store.store_id));
                  localStorage.setItem("currentMemberId", String(store.store_member_id));
                  localStorage.setItem("currentRole", "employee");
                  navigation.reset({ index: 0, routes: [{ name: "EmployeeHome" }] });
                } else {
                  localStorage.setItem("currentStoreId", String(store.store_id));
                  localStorage.setItem("currentMemberId", String(store.store_member_id));
                  localStorage.setItem("currentRole", "owner");
                  navigation.reset({ index: 0, routes: [{ name: "OwnerHome" }] });
                }
              }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: isSelected ? "#E8F3FF" : "transparent", marginBottom: 4 }}
              scaleAmount={0.97}
              opacityAmount={0.8}
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
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16, marginTop: 12 }}
          scaleAmount={0.97}
          opacityAmount={0.8}
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

      <OwnerBottomNav activeTab="home" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── Section block wrapper ──
const SectionBlock: React.FC<{ children: React.ReactNode; style?: object }> = ({
  children,
  style,
}) => (
  <View
    style={[
      {
        backgroundColor: "#FFFFFF",
        marginHorizontal: 0,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
      style,
    ]}
  >
    {children}
  </View>
);

// ── Attendance badge (stat box badge) ──
const AttendanceBadge: React.FC<{
  value: number;
  color: string;
  bg: string;
  borderColor: string;
}> = ({ value, color, bg, borderColor }) => (
  <View
    style={{
      borderWidth: 1,
      borderColor,
      backgroundColor: bg,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignItems: "center",
      minWidth: 50,
    }}
  >
    <Text style={{ fontSize: 18, fontWeight: "700", color }}>{value}</Text>
  </View>
);

// ── Attendance card (snap scroll) ──
interface AttendanceCardData {
  key: string;
  label: string;
  desc: string;
  emptyMsg: string;
  dotColor: string;
  rows: AttendanceTodayRow[];
}

const AttendanceCard: React.FC<{ card: AttendanceCardData; cardWidth: number }> = ({ card, cardWidth }) => {
  const shiftBadgeStyle = (shift: string | null) => {
    const style = getShiftStyle(shift);
    return { bg: style.bg, color: style.color, label: shift ?? "일반" };
  };

  const statusDotColor = (status: AttendanceTodayRow["status"]) => {
    if (status === "working") return "#1EDC83";
    if (status === "on_break") return "#FFB300";
    if (status === "off_work") return "#4261FF";
    return "#FF3D3D";
  };

  return (
    <View
      style={{
        width: cardWidth,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        paddingVertical: 18,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
        marginBottom: 4,
      }}
    >
      {/* 카드 상단 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 15, color: "#19191B", letterSpacing: -0.28 }}>
          현재{" "}
          <Text style={{ fontWeight: "700", color: "#4261FF" }}>{card.rows.length}명</Text>
          {`이 ${card.desc}`}
        </Text>
      </View>

      {/* 직원 가로 스크롤 */}
      {card.rows.length === 0 ? (
        <View style={{ minHeight: 120, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 13, color: "#AAB4BF" }}>{card.emptyMsg}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}
        >
          {card.rows.map((row) => {
            const sb = shiftBadgeStyle(row.shift);
            const dotColor = statusDotColor(row.status);
            return (
              <View key={row.id} style={{ alignItems: "center", width: 76 }}>
                {/* shift badge */}
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 2,
                    borderRadius: 100,
                    backgroundColor: sb.bg,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "600", color: sb.color, letterSpacing: -0.2 }}>
                    {sb.label}
                  </Text>
                </View>
                {/* avatar with status dot */}
                <View style={{ position: "relative", marginBottom: 8 }}>
                  <Avatar name={row.name} imageUrl={(row as any).image_url} size={52} defaultSource={STAFF_ICON} />
                  {/* status dot */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: dotColor,
                      borderWidth: 2,
                      borderColor: "#FFFFFF",
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: "#19191B",
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                >
                  {row.name}
                </Text>
                <Text
                  style={{ fontSize: 11, color: "#9EA3AD", textAlign: "center", marginTop: 2 }}
                  numberOfLines={1}
                >
                  {row.clock_in ? row.clock_in.slice(0, 5) : "--:--"}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

// ── Checklist card ──
const ChecklistCard: React.FC<{
  group: { key: string; label: string; color: string; bg: string; timeRange: string; employees: StoreEmployee[] };
  commonItems: ChecklistItem[];
  employeeItems: Record<number, ChecklistItem[]>;
  selectedEmployee: number;
  onSelectEmployee: (id: number) => void;
  onAdd: () => void;
  onEdit: (item: ChecklistItem) => void;
  cardWidth: number;
}> = ({ group, commonItems, employeeItems, selectedEmployee, onSelectEmployee, onAdd, onEdit, cardWidth }) => {
  const tabs: Array<StoreEmployee | { id: 0; name: string; image_url?: null }> = [{ id: 0, name: "공통", image_url: null }, ...group.employees];
  const currentItems = selectedEmployee === 0 ? commonItems : (employeeItems[selectedEmployee] ?? []);
  const selectedTabIndex = tabs.findIndex((t) => t.id === selectedEmployee);
  const TAB_ITEM_WIDTH = 52 + 14; // avatar width + gap

  return (
    <View
      style={{
        width: cardWidth,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
        marginBottom: 4,
      }}
    >
      {/* 카드 헤더 — 웹앱과 동일: [오픈] 체크 리스트 */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", letterSpacing: -0.3 }}>
          <Text style={{ color: group.color }}>[{group.label}]</Text>
          <Text style={{ color: "#19191B" }}> 체크 리스트</Text>
        </Text>
        <Text style={{ fontSize: 13, color: "#9EA3AD", marginTop: 3, letterSpacing: -0.26 }}>
          총 {group.employees.length}명 | {group.timeRange}
        </Text>
      </View>

      {/* 직원 아바타 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingRight: 4 }}
        style={{ marginBottom: 0 }}
      >
        {tabs.map((tab) => {
          const sel = selectedEmployee === tab.id;
          return (
            <AnimatedPressable
              key={tab.id}
              onPress={() => onSelectEmployee(tab.id)}
              style={{ alignItems: "center", flexShrink: 0 }}
              scaleAmount={0.92}
              opacityAmount={0.8}
            >
              {tab.id === 0 ? (
                <View
                  style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: "#EEF2FF",
                    borderWidth: 2.5,
                    borderColor: sel ? "#4261FF" : "transparent",
                    overflow: "hidden",
                  }}
                >
                  <Image source={STAFF_ICON} style={{ width: 52, height: 52 }} resizeMode="cover" />
                </View>
              ) : (
                <Avatar
                  name={tab.name}
                  imageUrl={tab.image_url}
                  size={52}
                  borderColor={sel ? "#4261FF" : "transparent"}
                  borderWidth={2.5}
                />
              )}
              <Text style={{ fontSize: 11, fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : "#19191B", marginTop: 4, letterSpacing: -0.22 }} numberOfLines={1}>
                {tab.name}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {/* 슬라이딩 인디케이터 라인 — 웹앱과 동일 */}
      <View style={{ height: 2, backgroundColor: "#EBEBEB", marginTop: 8, marginBottom: 12, position: "relative" }}>
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: selectedTabIndex * TAB_ITEM_WIDTH,
            width: 52,
            height: 2,
            backgroundColor: "#4261FF",
            borderRadius: 2,
          }}
        />
      </View>

      {/* 체크리스트 항목 + 추가 버튼 */}
      <ScrollView
        style={{ maxHeight: 200 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={{ gap: 8 }}>
          {currentItems.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>등록된 체크 리스트가 없어요</Text>
              <Text style={{ fontSize: 12, color: "#AAB4BF" }}>체크 리스트를 등록 해주세요</Text>
            </View>
          ) : (
            currentItems.map((item) => (
              <AnimatedPressable
                key={item.id}
                onPress={() => onEdit(item)}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  paddingVertical: 11, paddingHorizontal: 14,
                  borderWidth: 1, borderColor: "#EBEBEB", borderRadius: 10, backgroundColor: "#FFFFFF",
                }}
                scaleAmount={0.98}
                opacityAmount={0.85}
              >
                <Text style={{ fontSize: 14, color: "#19191B", flex: 1, letterSpacing: -0.28 }}>{item.text}</Text>
                <Pencil size={15} color="#B0B3BB" />
              </AnimatedPressable>
            ))
          )}
          <AnimatedPressable
            onPress={onAdd}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
              paddingVertical: 11, borderWidth: 1.5, borderColor: "#DBDCDF",
              borderStyle: "dashed", borderRadius: 10,
            }}
            scaleAmount={0.97}
            opacityAmount={0.75}
          >
            <Plus size={14} color="#9EA3AD" />
            <Text style={{ fontSize: 13, color: "#9EA3AD", letterSpacing: -0.26 }}>추가하기</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </View>
  );
};

// ── Dot indicator ──
const DotIndicator: React.FC<{ count: number; activeIndex: number }> = ({
  count,
  activeIndex,
}) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={i}
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: i === activeIndex ? "#4261FF" : "#EBEBEB",
        }}
      />
    ))}
  </View>
);

// ── StatusPill ──
const StatusPill: React.FC<{ label: string; color: string; bg: string }> = ({
  label,
  color,
  bg,
}) => (
  <View
    style={{ flex: 1, height: 26, borderRadius: 4, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
  >
    <Text style={{ fontSize: 12, fontWeight: "600", color, letterSpacing: -0.26, includeFontPadding: false }}>{label}</Text>
  </View>
);

// ── AlertBadge ──
const AlertBadge: React.FC<{ label: string }> = ({ label }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "#FFEAE6",
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    }}
  >
    <AlertCircle size={12} color="#FF3D3D" />
    <Text style={{ fontSize: 14, fontWeight: "500", color: "#FF3D3D", letterSpacing: -0.24 }}>
      {label}
    </Text>
  </View>
);

// ── ManagementCard ──
const ManagementCard: React.FC<{
  title: string;
  children: React.ReactNode;
  onPress: () => void;
}> = ({ title, children, onPress }) => (
  <AnimatedPressable
    onPress={onPress}
    style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, paddingHorizontal: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 2 }}
    scaleAmount={0.97}
    opacityAmount={0.85}
  >
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <Text
        style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32 }}
      >
        {title}
      </Text>
      <ChevronRight size={18} color="#B0B3BB" />
    </View>
    {children}
  </AnimatedPressable>
);

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#19191B",
    letterSpacing: -0.4,
  },
  moreBtn: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: "#9EA3AD",
    letterSpacing: -0.26,
  },
  statBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statBoxLabel: {
    fontSize: 12,
    color: "#70737B",
    letterSpacing: -0.24,
  },
  shadowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 1, height: 1 },
    elevation: 2,
  },
  emojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F3F5",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};

// ── ChecklistInfoModal ──────────────────────────────────────────────────────

// 애니메이션 체크박스
const AnimCheckbox: React.FC<{
  progress: SharedValue<number>;
  scaleVal: SharedValue<number>;
  color: string;
}> = ({ progress, scaleVal, color }) => {
  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
    backgroundColor: progress.value > 0.5 ? color : "transparent",
    borderColor: progress.value > 0.5 ? color : "#DBDCDF",
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: progress.value > 0.5 ? progress.value : 0,
    transform: [{ scale: progress.value > 0.5 ? progress.value : 0 }],
  }));
  return (
    <Animated.View style={[{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }, boxStyle]}>
      <Animated.View style={iconStyle}>
        <Check size={10} color="#FFFFFF" strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  );
};

const CL_COMMON_ITEMS   = ["청소 및 위생 점검", "마감 영수증 정리"];
const CL_NEW_ITEM       = "냉난방 확인";
const CL_PERSONAL_ITEMS = ["냉장고 온도 체크", "음료 재고 확인"];

const ChecklistInfoModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [stepIndex, setStepIndex]       = useState(0);
  const [addBtnActive, setAddBtnActive] = useState(false);
  const TOTAL_STEPS = 2;

  // 카드 전환
  const slideX      = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  // 스텝 1 (공통)
  const newItemOpacity = useSharedValue(0);
  const newItemSlideY  = useSharedValue(10);
  const check1Progress = useSharedValue(0);
  const check1Scale    = useSharedValue(1);
  const check2Progress = useSharedValue(0);
  const check2Scale    = useSharedValue(1);

  // 스텝 2 (개별)
  const check3Progress       = useSharedValue(0);
  const check3Scale          = useSharedValue(1);
  const check4Progress       = useSharedValue(0);
  const check4Scale          = useSharedValue(1);
  const personalItemsOpacity = useSharedValue(1);
  const resetLabelOpacity    = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timers.current.push(id); };

  const doCheck = (prog: SharedValue<number>, sc: SharedValue<number>) => {
    prog.value = withTiming(1, { duration: 220 });
    sc.value = withSequence(
      withTiming(1.4, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1,   { duration: 110, easing: Easing.in(Easing.quad) }),
    );
    hapticSelection();
  };

  const resetStep1 = () => {
    setAddBtnActive(false);
    newItemOpacity.value = 0;
    newItemSlideY.value  = 10;
    check1Progress.value = 0; check1Scale.value = 1;
    check2Progress.value = 0; check2Scale.value = 1;
  };

  const resetStep2 = () => {
    check3Progress.value = 0; check3Scale.value = 1;
    check4Progress.value = 0; check4Scale.value = 1;
    personalItemsOpacity.value = 1;
    resetLabelOpacity.value    = 0;
  };

  // 스텝 1 루프: + 탭 → 새 항목 등장 → 항목 1·2 체크 → 리셋
  const startStep1Loop = () => {
    resetStep1();
    after(() => { setAddBtnActive(true);  hapticLight(); }, 900);
    after(() => {
      setAddBtnActive(false);
      newItemOpacity.value = withTiming(1, { duration: 320 });
      newItemSlideY.value  = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) });
    }, 1150);
    after(() => doCheck(check1Progress, check1Scale), 2150);
    after(() => doCheck(check2Progress, check2Scale), 3050);
    after(() => {
      check1Progress.value = withTiming(0, { duration: 260 });
      check2Progress.value = withTiming(0, { duration: 260 });
      newItemOpacity.value = withTiming(0, { duration: 260 });
      newItemSlideY.value  = withTiming(10, { duration: 260 });
    }, 4650);
    after(startStep1Loop, 5400);
  };

  // 스텝 2 루프: 항목 1·2 체크 → 초기화 → 리셋
  const startStep2Loop = () => {
    resetStep2();
    after(() => doCheck(check3Progress, check3Scale), 900);
    after(() => doCheck(check4Progress, check4Scale), 1800);
    after(() => {
      personalItemsOpacity.value = withTiming(0, { duration: 450 });
      hapticLight();
    }, 3300);
    after(() => { resetLabelOpacity.value = withTiming(1, { duration: 280 }); }, 3700);
    after(() => {
      resetLabelOpacity.value = withTiming(0, { duration: 260 });
      check3Progress.value = 0;
      check4Progress.value = 0;
    }, 4900);
    after(() => { personalItemsOpacity.value = withTiming(1, { duration: 380 }); }, 5200);
    after(startStep2Loop, 6000);
  };

  useEffect(() => {
    clearTimers();
    if (!visible) { setStepIndex(0); resetStep1(); resetStep2(); return; }
    if (stepIndex === 0) startStep1Loop();
    else startStep2Loop();
    return clearTimers;
  }, [stepIndex, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const goStep = (next: number, dir: 1 | -1) => {
    const afterFade = () => {
      setStepIndex(next);
      slideX.value = dir * 36;
      slideX.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
      cardOpacity.value = withTiming(1, { duration: 240 });
    };
    cardOpacity.value = withTiming(0, { duration: 90 }, () => runOnJS(afterFade)());
  };

  const cardStyle         = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }], opacity: cardOpacity.value }));
  const newItemStyle      = useAnimatedStyle(() => ({ opacity: newItemOpacity.value, transform: [{ translateY: newItemSlideY.value }] }));
  const personalItemStyle = useAnimatedStyle(() => ({ opacity: personalItemsOpacity.value }));
  const resetLabelStyle   = useAnimatedStyle(() => ({ opacity: resetLabelOpacity.value }));

  if (!visible) return null;
  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === TOTAL_STEPS - 1;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: "#FFFFFF", borderRadius: 24, width: 312, overflow: "hidden" }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Info size={15} color="#4261FF" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B", letterSpacing: -0.3 }}>체크리스트 사용 가이드</Text>
            </View>
            <AnimatedPressable onPress={onClose} hitSlop={10} scaleAmount={0.85} opacityAmount={0.7}>
              <X size={18} color="#9EA3AD" />
            </AnimatedPressable>
          </View>

          {/* 카드 */}
          <Animated.View style={[{ paddingHorizontal: 20, paddingBottom: 4 }, cardStyle]}>
            {isFirst ? (
              /* ── 스텝 1: 공통 체크리스트 ── */
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>📋</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B", letterSpacing: -0.28 }}>공통 체크리스트</Text>
                    <Text style={{ fontSize: 11, color: "#9EA3AD", marginTop: 1 }}>모든 직원 · 매일 자동 노출</Text>
                  </View>
                  <View style={{ marginLeft: "auto", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: "#EEF2FF" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#4261FF" }}>공통</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: "#F4F6FF", borderRadius: 14, padding: 10, gap: 6, marginBottom: 14 }}>
                  {/* 기존 항목 2개 (체크 애니메이션) */}
                  {CL_COMMON_ITEMS.map((label, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
                      <AnimCheckbox
                        progress={i === 0 ? check1Progress : check2Progress}
                        scaleVal={i === 0 ? check1Scale : check2Scale}
                        color="#4261FF"
                      />
                      <Text style={{ flex: 1, fontSize: 12, color: "#19191B" }}>{label}</Text>
                    </View>
                  ))}

                  {/* 새로 추가되는 항목 (슬라이드 인) */}
                  <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, newItemStyle]}>
                    <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: "#DBDCDF" }} />
                    <Text style={{ flex: 1, fontSize: 12, color: "#19191B" }}>{CL_NEW_ITEM}</Text>
                  </Animated.View>

                  {/* + 추가 버튼 (탭 시 파란색 전환) */}
                  <View style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
                    borderRadius: 10, paddingVertical: 9,
                    backgroundColor: addBtnActive ? "#4261FF" : "#EEF2FF",
                    ...(addBtnActive ? {} : { borderWidth: 1.2, borderColor: "#BCC7FF", borderStyle: "dashed" as const }),
                  }}>
                    <Plus size={13} color={addBtnActive ? "#FFFFFF" : "#4261FF"} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: addBtnActive ? "#FFFFFF" : "#4261FF" }}>항목 추가하기</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 13, color: "#70737B", lineHeight: 20, letterSpacing: -0.26 }}>
                  한 번 등록하면 <Text style={{ color: "#4261FF", fontWeight: "600" }}>모든 직원 홈에 매일 자동으로</Text> 표시돼요. 삭제하기 전까지 계속 유지돼요.
                </Text>
              </View>

            ) : (
              /* ── 스텝 2: 개별 체크리스트 ── */
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#E5F9EC", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>👤</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B", letterSpacing: -0.28 }}>개별 체크리스트</Text>
                    <Text style={{ fontSize: 11, color: "#9EA3AD", marginTop: 1 }}>특정 직원 · 오늘 하루만</Text>
                  </View>
                  <View style={{ marginLeft: "auto", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: "#E5F9EC" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#10C97D" }}>개별</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: "#F2FCF6", borderRadius: 14, padding: 10, gap: 6, marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, paddingBottom: 2 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#10C97D22", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 10 }}>👤</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#19191B" }}>김직원</Text>
                    <Text style={{ fontSize: 11, color: "#AAB4BF" }}>의 오늘 할 일</Text>
                  </View>

                  <View style={{ position: "relative", minHeight: 78 }}>
                    <Animated.View style={[{ gap: 6 }, personalItemStyle]}>
                      {CL_PERSONAL_ITEMS.map((label, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
                          <AnimCheckbox
                            progress={i === 0 ? check3Progress : check4Progress}
                            scaleVal={i === 0 ? check3Scale : check4Scale}
                            color="#10C97D"
                          />
                          <Text style={{ flex: 1, fontSize: 12, color: "#19191B" }}>{label}</Text>
                        </View>
                      ))}
                    </Animated.View>

                    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }, resetLabelStyle]}>
                      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1.5, borderColor: "#A8EFD0" }}>
                        <Text style={{ fontSize: 15 }}>↻</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#10C97D" }}>자동 초기화됨</Text>
                      </View>
                    </Animated.View>
                  </View>

                  <View style={{ paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 11, color: "#AAB4BF" }}>마감 4시간 후 항목이 자동으로 사라져요</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 13, color: "#70737B", lineHeight: 20, letterSpacing: -0.26, marginBottom: 10 }}>
                  직원별로 <Text style={{ color: "#10C97D", fontWeight: "600" }}>오늘 할 일</Text>을 따로 지정할 수 있어요.
                </Text>

                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: "#FFFBEC", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <AlertCircle size={13} color="#E8A000" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: "#A06000", lineHeight: 18, letterSpacing: -0.24 }}>
                    직원이 체크했는지는 현재 사장님 화면에서 확인이 안 돼요. 추후 업데이트 예정이에요.
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* 네비게이션 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
            <AnimatedPressable
              onPress={() => !isFirst && goStep(stepIndex - 1, -1)}
              scaleAmount={0.88}
              opacityAmount={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isFirst ? "#F4F5F8" : "#EEF2FF", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={18} color={isFirst ? "#DBDCDF" : "#4261FF"} />
            </AnimatedPressable>

            <View style={{ flexDirection: "row", gap: 7 }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View key={i} style={{ width: i === stepIndex ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === stepIndex ? "#4261FF" : "#DBDCDF" }} />
              ))}
            </View>

            <AnimatedPressable
              onPress={() => isLast ? onClose() : goStep(stepIndex + 1, 1)}
              scaleAmount={0.88}
              opacityAmount={0.7}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
            >
              {isLast ? <Check size={18} color="#FFFFFF" /> : <ChevronRight size={18} color="#FFFFFF" />}
            </AnimatedPressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default OwnerHomeScreen;
