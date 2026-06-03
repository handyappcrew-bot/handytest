import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Info, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import EmptyState from "@/components/EmptyState";
import BottomSheet from "@/components/BottomSheet";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import { useToast } from "@/components/Toast";
import { getPayslips, getPayslipMonths, transferPayslip, generatePayslips, getOwnerSchedules, getStaffAttendance } from "@/api/owner";
import { getCachedStaffList } from "@/utils/cachedApi";
import type { OwnerSchedule, StaffAttendanceRecord } from "@/api/owner";
import { getShiftStyle } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { DAY_LABELS } from "@/utils/constants";
import type { ScreenProps } from "@/navigation/types";

const PAYSLIP_AVATAR_COLORS = [
  "#5C4033", "#C0392B", "#1ABC9C", "#2C3E50", "#8E44AD",
  "#E67E22", "#E91E63", "#FF9800", "#4261FF", "#27AE60",
];
const getPayslipAvatarColor = (id: number) => PAYSLIP_AVATAR_COLORS[Math.abs(id) % PAYSLIP_AVATAR_COLORS.length];

interface PayslipRow {
  id: number;
  employee_id: number;
  name: string;
  total_pay: number;
  net_pay: number;
  is_published: boolean;
  is_transferred: boolean;
  is_resigned?: boolean;
  working_status?: string;
  shift?: string;
  type?: string;
  salary_day?: string;
  period?: string;
}

const OwnerSalaryManagementScreen: React.FC<ScreenProps<"OwnerSalaryManagement">> = ({ navigation }) => {
  const { toast } = useToast();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [schedules, setSchedules] = useState<OwnerSchedule[]>([]);
  const [availableMonths, setAvailableMonths] = useState<{ year: number; month: number }[]>([]);
  const [transferredIds, setTransferredIds] = useState<Set<number>>(new Set());
  const [transferTarget, setTransferTarget] = useState<PayslipRow | null>(null);
  const [dismissedPaydays, setDismissedPaydays] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"급여 캘린더" | "급여명세서 발급">("급여 캘린더");
  const [dayDetailSheet, setDayDetailSheet] = useState<{ day: number; staffList: PayslipRow[] } | null>(null);
  const [generating, setGenerating] = useState(false);

  // 캘린더 필터 & 뷰 모드
  const [salaryFilter, setSalaryFilter] = useState<"전체 직원 급여" | "직원 선택하기">("전체 직원 급여");
  const [selectedPayslipStaff, setSelectedPayslipStaff] = useState<PayslipRow | null>(null);
  const [viewMode, setViewMode] = useState<"월간" | "일간">("월간");
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [calDaySheetOpen, setCalDaySheetOpen] = useState(false);
  const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);
  const [weekCenterDate, setWeekCenterDate] = useState(now);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [staffStatusMap, setStaffStatusMap] = useState<Record<number, string>>({});
  const [staffHourlyRateMap, setStaffHourlyRateMap] = useState<Record<number, number>>({});
  const [staffMonthlySalaryMap, setStaffMonthlySalaryMap] = useState<Record<number, number>>({});
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>([]);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    getCachedStaffList(storeId)
      .then((list: any) => {
        const statusMap: Record<number, string> = {};
        const rateMap: Record<number, number> = {};
        const monthlyMap: Record<number, number> = {};
        (Array.isArray(list) ? list : []).forEach((s: any) => {
          if (s.id != null && s.contract?.working_status) statusMap[s.id] = s.contract.working_status;
          if (s.id != null && s.contract?.hourly_rate) rateMap[s.id] = Number(s.contract.hourly_rate);
          if (s.id != null) {
            const ms = s.contract?.monthly_salary ? Number(s.contract.monthly_salary)
              : s.contract?.annual_salary ? Math.round(Number(s.contract.annual_salary) / 12) : 0;
            if (ms > 0) monthlyMap[s.id] = ms;
          }
        });
        setStaffStatusMap(statusMap);
        setStaffHourlyRateMap(rateMap);
        setStaffMonthlySalaryMap(monthlyMap);
      })
      .catch((e) => { console.warn(e); toast({ description: "직원 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]));

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    getPayslipMonths(storeId)
      .then((months: any) => setAvailableMonths(Array.isArray(months) ? months : []))
      .catch(() => setAvailableMonths([]));
  }, [storeId]));

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    let cancelled = false;
    getPayslips(storeId, selectedYear, selectedMonth)
      .then((rows: any) => {
        if (cancelled) return;
        const mapped: PayslipRow[] = (rows ?? []).map((p: any) => ({
          id: p.id,
          employee_id: p.employee_id,
          name: p.name || "",
          total_pay: p.total_pay ?? 0,
          net_pay: p.net_pay ?? 0,
          is_published: !!p.is_published,
          is_transferred: !!p.is_transferred,
          is_resigned: !!p.is_resigned,
          working_status: p.working_status ?? undefined,
          salary_day: p.salary_day || undefined,
          type: p.employee_type?.includes("시급") ? "알바생" : p.employee_type ? "정규직" : undefined,
          period: p.pay_period_start && p.pay_period_end
            ? `${p.pay_period_start.replace(/-/g, ".")}-${p.pay_period_end.replace(/-/g, ".")}`
            : undefined,
          shift: p.shift_name || undefined,
        }));
        setPayslips(mapped);
      })
      .catch((e) => { if (!cancelled) { console.warn(e); setPayslips([]); toast({ description: "급여 명세서를 불러오지 못했어요.", variant: "destructive" }); } });
    return () => { cancelled = true; };
  }, [storeId, selectedYear, selectedMonth]));

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    let cancelled = false;
    getOwnerSchedules(storeId, selectedYear, selectedMonth)
      .then((data: any) => { if (!cancelled) setSchedules(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setSchedules([]); });
    return () => { cancelled = true; };
  }, [storeId, selectedYear, selectedMonth]));

  useFocusEffect(useCallback(() => {
    if (!storeId || !selectedPayslipStaff) {
      setStaffAttendance([]);
      return;
    }
    let cancelled = false;
    getStaffAttendance(storeId, selectedPayslipStaff.employee_id, selectedYear, selectedMonth)
      .then((records: any) => { if (!cancelled) setStaffAttendance(Array.isArray(records) ? records : []); })
      .catch(() => { if (!cancelled) setStaffAttendance([]); });
    return () => { cancelled = true; };
  }, [storeId, selectedPayslipStaff, selectedYear, selectedMonth]));

  // 월 변경 시 weekCenterDate 리셋
  useEffect(() => {
    const firstOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const today = new Date();
    if (today.getFullYear() === selectedYear && today.getMonth() + 1 === selectedMonth) {
      setWeekCenterDate(today);
    } else {
      setWeekCenterDate(firstOfMonth);
    }
  }, [selectedYear, selectedMonth]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await generatePayslips(storeId, selectedYear, selectedMonth);
      const created = result.created?.length ?? 0;
      const failed = result.failed?.length ?? 0;
      if (created > 0) {
        const msg = failed > 0
          ? `급여명세서 ${created}건 생성 완료, ${failed}건 실패했어요.`
          : `급여명세서 ${created}건이 생성되었어요.`;
        toast({ description: msg, variant: failed > 0 ? "destructive" : undefined });
        getPayslips(storeId, selectedYear, selectedMonth)
          .then((rows: any) => {
            const mapped: PayslipRow[] = (rows ?? []).map((p: any) => ({
              id: p.id,
              employee_id: p.employee_id,
              name: p.name || "",
              total_pay: p.total_pay ?? 0,
              net_pay: p.net_pay ?? 0,
              is_published: !!p.is_published,
              is_transferred: !!p.is_transferred,
              is_resigned: !!p.is_resigned,
              working_status: p.working_status ?? undefined,
              salary_day: p.salary_day || undefined,
              type: p.employee_type?.includes("시급") ? "알바생" : p.employee_type ? "정규직" : undefined,
              period: p.pay_period_start && p.pay_period_end
                ? `${p.pay_period_start.replace(/-/g, ".")}-${p.pay_period_end.replace(/-/g, ".")}`
                : undefined,
              shift: p.shift_name || undefined,
            }));
            setPayslips(mapped);
          })
          .catch((e) => console.warn(e));
      } else if (failed > 0) {
        toast({ description: `일부 명세서 생성에 실패했어요. (${failed}건)`, variant: "destructive" });
      } else {
        toast({ description: "생성할 명세서가 없어요. 이미 모두 생성되었거나 조건이 충족되지 않았어요." });
      }
    } catch (err: any) {
      const msg = err?.status === 409 ? "이미 해당 월 명세서가 존재해요." : "명세서 생성에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleTransfer = async (payslipId: number) => {
    try {
      await transferPayslip(storeId, payslipId);
      setTransferredIds((prev) => new Set([...prev, payslipId]));
      toast({ description: "이체 완료 처리됐어요." });
    } catch {
      toast({ description: "이체 처리에 실패했어요.", variant: "destructive" });
    }
  };

  // staffStatusMap으로 working_status 보강 (백엔드 미반환 시 폴백)
  const enrichedPayslips = useMemo(() =>
    payslips.map((p) => ({
      ...p,
      working_status: p.working_status ?? staffStatusMap[p.employee_id] ?? undefined,
    })),
    [payslips, staffStatusMap],
  );

  const isResignedOrLeave = (p: PayslipRow) =>
    p.working_status === "퇴사" || p.working_status === "앱탈퇴" || p.working_status === "휴직" || p.is_resigned;

  // 퇴사/휴직 직원 명세서는 하단으로 정렬
  const sortPayslips = (list: PayslipRow[]) => [
    ...list.filter((p) => !isResignedOrLeave(p)),
    ...list.filter((p) => isResignedOrLeave(p)),
  ];

  const unpaid = useMemo(() => sortPayslips(enrichedPayslips.filter((p) => !p.is_published)), [enrichedPayslips]);
  const paid = useMemo(() => sortPayslips(enrichedPayslips.filter((p) => p.is_published)), [enrichedPayslips]);

  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

  // 캘린더 그리드
  const calFirstDow = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const calCells: { day: number; isOutside: boolean }[] = [];
  for (let i = calFirstDow; i > 0; i--) calCells.push({ day: 0, isOutside: true });
  for (let d = 1; d <= lastDay; d++) calCells.push({ day: d, isOutside: false });
  while (calCells.length % 7 !== 0) calCells.push({ day: 0, isOutside: true });
  const calWeeks: typeof calCells[] = [];
  for (let i = 0; i < calCells.length; i += 7) calWeeks.push(calCells.slice(i, i + 7));

  // 급여일 데이터
  const paydayData = useMemo(() => {
    const result: Record<number, { total: number; allTransferred: boolean }> = {};
    enrichedPayslips.forEach((p) => {
      if (!p.salary_day) return;
      const days = p.salary_day.split(",").map((d) => {
        const t = d.trim();
        if (t === "말일") return lastDay;
        const n = parseInt(t.replace(/[^0-9]/g, ""));
        return isNaN(n) ? NaN : Math.min(n, lastDay); // 31일 → 말일 clamp
      }).filter((d) => !isNaN(d) && d >= 1);
      days.forEach((day) => {
        if (!result[day]) result[day] = { total: 0, allTransferred: true };
        result[day].total += p.net_pay ?? 0;
        if (!(p.is_transferred || transferredIds.has(p.id))) result[day].allTransferred = false;
      });
    });
    return result;
  }, [enrichedPayslips, transferredIds, lastDay]);

  // 스케줄 → 날짜별 그룹
  const schedulesByDay = useMemo(() => {
    const map: Record<number, OwnerSchedule[]> = {};
    schedules.forEach((s) => {
      const day = new Date(s.work_date).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(s);
    });
    return map;
  }, [schedules]);

  // 선택 직원의 스케줄 날짜 집합
  const selectedStaffScheduledDays = useMemo(() => {
    if (!selectedPayslipStaff) return new Set<number>();
    return new Set(
      schedules
        .filter((s) => s.employee_name === selectedPayslipStaff.name)
        .map((s) => new Date(s.work_date).getDate())
    );
  }, [schedules, selectedPayslipStaff]);

  // 선택 직원의 일별 급여 데이터 (월급 직원은 pay=0으로 포함)
  const dailyPayData = useMemo<Record<number, { clockIn: string; clockOut: string; workMin: number; pay: number }>>(() => {
    if (!selectedPayslipStaff) return {};
    const hourlyRate = staffHourlyRateMap[selectedPayslipStaff.employee_id] ?? 0;
    const result: Record<number, { clockIn: string; clockOut: string; workMin: number; pay: number }> = {};
    staffAttendance.forEach((rec) => {
      if (!rec.clock_in || !rec.clock_out) return;
      const [sh, sm] = rec.clock_in.split(":").map(Number);
      const [eh, em] = rec.clock_out.split(":").map(Number);
      const rawMin = (eh * 60 + em) - (sh * 60 + sm);
      const adjustedMin = rawMin < 0 ? rawMin + 1440 : rawMin; // 자정 넘기는 야간 근무
      const workMin = Math.max(0, adjustedMin - (rec.break_minutes ?? 0));
      if (workMin <= 0) return;
      const pay = hourlyRate > 0 ? Math.round((workMin / 60) * hourlyRate) : 0;
      const day = new Date(rec.date).getDate();
      result[day] = { clockIn: rec.clock_in, clockOut: rec.clock_out, workMin, pay };
    });
    return result;
  }, [staffAttendance, selectedPayslipStaff, staffHourlyRateMap]);

  // 선택 직원의 총 근무 시간
  const totalWorkMin = useMemo(
    () => Object.values(dailyPayData).reduce((sum, d) => sum + d.workMin, 0),
    [dailyPayData],
  );

  // 선택 직원의 예상 급여 (명세서 net_pay → 계약 월급 순 fallback)
  const staffExpectedPay = useMemo(() => {
    if (!selectedPayslipStaff) return 0;
    const netPay = selectedPayslipStaff.net_pay ?? 0;
    if (netPay > 0) return netPay;
    return staffMonthlySalaryMap[selectedPayslipStaff.employee_id] ?? 0;
  }, [selectedPayslipStaff, staffMonthlySalaryMap]);

  // 주간 뷰 날짜
  const weekDays = useMemo(() => {
    const dow = weekCenterDate.getDay();
    const sunday = new Date(weekCenterDate);
    sunday.setDate(weekCenterDate.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  }, [weekCenterDate]);

  const prevWeek = () => {
    const d = new Date(weekCenterDate);
    d.setDate(d.getDate() - 7);
    setWeekCenterDate(d);
  };
  const nextWeek = () => {
    const d = new Date(weekCenterDate);
    d.setDate(d.getDate() + 7);
    setWeekCenterDate(d);
  };

  const handleDayClick = (day: number) => {
    const ldom = new Date(selectedYear, selectedMonth, 0).getDate();
    const staffForDay = enrichedPayslips.filter((p) => {
      if (!p.salary_day) return false;
      const days = p.salary_day.split(",").map((d) => {
        const t = d.trim();
        if (t === "말일") return ldom;
        const n = parseInt(t.replace(/[^0-9]/g, ""));
        return isNaN(n) ? NaN : Math.min(n, ldom); // 31일 → 말일 clamp
      }).filter((d) => !isNaN(d));
      return days.includes(day);
    });
    if (staffForDay.length > 0) {
      setDayDetailSheet({ day, staffList: staffForDay });
      return;
    }
    setSelectedCalDay(day);
    setCalDaySheetOpen(true);
  };

  const goPrev = () => {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12); }
    else setSelectedMonth(m => m - 1);
  };
  const goNext = () => {
    if (selectedYear === currentYear && selectedMonth >= currentMonth) return;
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1); }
    else setSelectedMonth(m => m + 1);
  };
  const canGoNext = !(selectedYear === currentYear && selectedMonth >= currentMonth);

  const getDDay = (payDay: string | undefined): { label: string; color: string } | null => {
    if (!payDay) return null;
    const today = new Date();
    const todayDate = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days = payDay.split(",").map(d => {
      const t = d.trim();
      if (t === "말일") return lastDayOfMonth;
      const n = parseInt(t);
      return isNaN(n) ? NaN : Math.min(n, lastDayOfMonth); // 31일 → 말일 clamp
    }).filter(n => !isNaN(n));
    if (days.length === 0) return null;
    const nearest = days
      .map(day => ({ day, diff: day >= todayDate ? day - todayDate : day + lastDayOfMonth - todayDate }))
      .sort((a, b) => a.diff - b.diff)[0];
    if (!nearest) return null;
    const label = nearest.diff === 0 ? "D-day" : `D-${nearest.diff}`;
    const color = nearest.diff === 0 ? "#FF3D3D" : nearest.diff === 1 ? "#FF8F00" : "#9EA3AD";
    return { label, color };
  };

  const hasMonthData = (year: number, month: number) =>
    availableMonths.some((s) => s.year === year && s.month === month);

  // 예상 총급여 (퇴사/휴직 제외)
  const activePayslips = useMemo(() => enrichedPayslips.filter((p) => !isResignedOrLeave(p)), [enrichedPayslips]);
  const totalExpectedSalary = useMemo(() => activePayslips.reduce((sum, p) => sum + (p.net_pay ?? 0), 0), [activePayslips]);

  // 캘린더 헤더 nav helpers
  const calHeaderYear = selectedYear;
  const calHeaderMonth = selectedMonth;

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>급여 관리</Text>
      </View>
      {/* Tab bar */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", paddingHorizontal: 20, gap: 36 }}>
        {(["급여 캘린더", "급여명세서 발급"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <AnimatedPressable key={tab} onPress={() => setActiveTab(tab)} style={{ paddingVertical: 12, position: "relative" }} hitSlop={4} scaleAmount={0.95} opacityAmount={0.8}>
              <Text style={{ fontSize: 16, fontWeight: isActive ? "700" : "500", letterSpacing: -0.32, color: isActive ? "#4261FF" : "#AAB4BF" }}>
                {tab}
              </Text>
              {isActive && (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 9999, backgroundColor: "#4261FF" }} />
              )}
            </AnimatedPressable>
          );
        })}
      </View>

      {/* 급여 캘린더 탭 */}
      {activeTab === "급여 캘린더" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* D-day 배너 */}
          {(() => {
            const today = new Date();
            const todayDate = today.getDate();
            const lastDay2 = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            if (unpaid.length === 0) return null;
            const parsedDays = unpaid.flatMap((p) =>
              (p.salary_day ?? "").split(",").map((d) => {
                const t = d.trim();
                if (t === "말일") return lastDay2;
                const n = parseInt(t);
                return isNaN(n) ? NaN : Math.min(n, lastDay2); // 31일 → 말일 clamp
              }).filter((n) => !isNaN(n))
            );
            const uniqueDays = [...new Set(parsedDays)].sort((a, b) => {
              const da = a >= todayDate ? a - todayDate : a + lastDay2 - todayDate;
              const db = b >= todayDate ? b - todayDate : b + lastDay2 - todayDate;
              return da - db;
            });
            if (uniqueDays.length === 0) return null;
            const allBanners = uniqueDays.map((day) => {
              const dDay = day >= todayDate ? day - todayDate : day + lastDay2 - todayDate;
              if (dDay > 1) return null;
              const affectedStaff = unpaid.filter((p) =>
                (p.salary_day ?? "").split(",").map((d) => {
                  const t = d.trim();
                  if (t === "말일") return lastDay2;
                  const n = parseInt(t);
                  return isNaN(n) ? NaN : Math.min(n, lastDay2); // 31일 → 말일 clamp
                }).filter((n) => !isNaN(n)).includes(day)
              );
              if (affectedStaff.length === 0) return null;
              return { dDay, day, affectedStaff, totalAmt: affectedStaff.reduce((sum, p) => sum + (p.net_pay ?? 0), 0) };
            }).filter(Boolean) as { dDay: number; day: number; affectedStaff: PayslipRow[]; totalAmt: number }[];
            const seenDDay = new Set<number>();
            const banners = allBanners.filter((b) => {
              if (seenDDay.has(b.dDay)) return false;
              seenDDay.add(b.dDay);
              return true;
            });
            const visibleBanners = banners.filter((b) => !dismissedPaydays.has(b.day));
            if (visibleBanners.length === 0) return null;
            const b = visibleBanners[0];
            const isTodayPayday = b.dDay === 0;
            const bgColor = isTodayPayday ? "#FF3D3D" : "#FF8F00";
            const bgLight = isTodayPayday ? "#FFF0F0" : "#FFF8EC";
            const textColor = isTodayPayday ? "#FF3D3D" : "#FF8F00";
            const emoji = isTodayPayday ? "💸" : "⏰";
            const label = isTodayPayday ? "오늘이 급여일이에요!" : "내일이 급여일이에요!";
            const desc = isTodayPayday ? "급여 명세서를 발급해주세요" : "급여 명세서를 확인해주세요";
            return (
              <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: bgLight, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bgColor, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: textColor, letterSpacing: -0.28 }}>{label}</Text>
                    <Text style={{ fontSize: 13, color: "#70737B", marginTop: 1, letterSpacing: -0.26 }}>{desc}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <AnimatedPressable
                    onPress={() => setActiveTab("급여명세서 발급")}
                    scaleAmount={0.97} opacityAmount={0.75}
                    style={{ height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: bgColor, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.24 }}>명세서 보기</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => setDismissedPaydays((prev) => new Set([...prev, b.day]))}
                    scaleAmount={0.88} opacityAmount={0.7}
                    style={{ width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", opacity: 0.45 }}
                    hitSlop={8}
                  >
                    <X size={14} color={textColor} />
                  </AnimatedPressable>
                </View>
              </View>
            );
          })()}

          {/* 필터 칩 */}
          <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }}>
            <AnimatedPressable
              onPress={() => { setSalaryFilter("전체 직원 급여"); setSelectedPayslipStaff(null); }}
              style={{
                height: 28, borderRadius: 9999, paddingHorizontal: 14,
                backgroundColor: !selectedPayslipStaff ? "#E8F3FF" : "#FFFFFF",
                borderWidth: 1, borderColor: !selectedPayslipStaff ? "#4261FF" : "#DBDCDF",
                alignItems: "center", justifyContent: "center",
              }}
              scaleAmount={0.97} opacityAmount={0.8}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: !selectedPayslipStaff ? "#4261FF" : "#AAB4BF" }}>
                전체 직원 급여
              </Text>
            </AnimatedPressable>

            {selectedPayslipStaff ? (
              <AnimatedPressable
                onPress={() => { setSelectedPayslipStaff(null); setSalaryFilter("전체 직원 급여"); }}
                style={{
                  height: 28, borderRadius: 9999, paddingHorizontal: 14,
                  backgroundColor: "#E8F3FF", borderWidth: 1, borderColor: "#4261FF",
                  flexDirection: "row", alignItems: "center", gap: 4,
                }}
                scaleAmount={0.97} opacityAmount={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: "#4261FF" }}>{selectedPayslipStaff.name}</Text>
                <X size={12} color="#4261FF" />
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                onPress={() => { setSalaryFilter("직원 선택하기"); setStaffPickerOpen(true); }}
                style={{
                  height: 28, borderRadius: 9999, paddingHorizontal: 14,
                  backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DBDCDF",
                  alignItems: "center", justifyContent: "center",
                }}
                scaleAmount={0.97} opacityAmount={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: "#AAB4BF" }}>직원 선택하기</Text>
              </AnimatedPressable>
            )}
          </View>

          {/* 예상 급여 카드 */}
          {selectedPayslipStaff ? (
            // 개별 직원 카드
            <View style={{ marginHorizontal: 20, marginTop: 8, borderRadius: 16, backgroundColor: "#F0F7FF", padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: getPayslipAvatarColor(selectedPayslipStaff.id), alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{selectedPayslipStaff.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B" }}>{selectedPayslipStaff.name}</Text>
                    {selectedPayslipStaff.type && (
                      <View style={{ backgroundColor: "#F7F7F8", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, color: "#70737B" }}>{selectedPayslipStaff.type}</Text>
                      </View>
                    )}
                    <AnimatedPressable onPress={() => setStaffPickerOpen(true)} style={{ padding: 2 }} scaleAmount={0.9} opacityAmount={0.7}>
                      <ChevronDown size={16} color="#70737B" />
                    </AnimatedPressable>
                  </View>
                  {selectedPayslipStaff.period && (
                    <Text style={{ fontSize: 12, color: "#70737B", marginTop: 2 }}>{selectedPayslipStaff.period}</Text>
                  )}
                </View>
              </View>
              <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginBottom: 12 }} />
              {totalWorkMin > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: "#70737B" }}>총 근무 시간</Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#70737B" }}>
                    {(() => {
                      const wh = Math.floor(totalWorkMin / 60);
                      const wm = totalWorkMin % 60;
                      return wm > 0 ? `${wh}시간 ${wm}분` : `${wh}시간`;
                    })()}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>{selectedMonth}월 지급 예정액</Text>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#4261FF" }}>
                  {staffExpectedPay.toLocaleString()}원
                </Text>
              </View>
            </View>
          ) : activePayslips.length > 0 ? (
            // 전체 직원 카드
            <View style={{ marginHorizontal: 20, marginTop: 8, borderRadius: 16, backgroundColor: "#F0F7FF" }}>
              <View style={{ padding: 16, paddingBottom: 0 }}>
                <View style={{ backgroundColor: "#D3DAFF", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: "#7488FE" }}>
                    *{selectedMonth}월 예상 미지급 급여 합계
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>{selectedMonth}월 예상 총 급여</Text>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: "#4261FF" }}>
                    {totalExpectedSalary.toLocaleString()}원
                  </Text>
                </View>
              </View>
              <View style={{ height: 0.5, backgroundColor: "#DBDCDF", margin: 12 }} />
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                {(summaryExpanded ? activePayslips : activePayslips.slice(0, 3)).map((p, i, arr) => (
                  <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: i < arr.length - 1 ? 10 : 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ backgroundColor: p.is_published ? "#F7F7F8" : "#ECFFF1", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: p.is_published ? "#AAB4BF" : "#1EDC83" }}>
                          {p.is_published ? "발급 완료" : "미발급"}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, color: p.is_published ? "#AAB4BF" : "#19191B" }}>{p.name}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: p.is_published ? "#AAB4BF" : "#19191B" }}>
                      {(p.net_pay ?? 0).toLocaleString()}원
                    </Text>
                  </View>
                ))}
                {activePayslips.length > 3 && (
                  <AnimatedPressable
                    onPress={() => setSummaryExpanded(!summaryExpanded)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 12 }}
                    scaleAmount={0.97} opacityAmount={0.8}
                  >
                    <Text style={{ fontSize: 13, color: "#70737B" }}>{summaryExpanded ? "닫기" : "더보기"}</Text>
                    {summaryExpanded ? <ChevronUp size={16} color="#70737B" /> : <ChevronDown size={16} color="#70737B" />}
                  </AnimatedPressable>
                )}
              </View>
            </View>
          ) : null}

          {/* 캘린더 섹션 */}
          <View style={{ height: 12, backgroundColor: "#F7F7F8", marginTop: 16 }} />

          {/* 캘린더 헤더: 날짜 네비 + 월간/주간 토글 */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <AnimatedPressable onPress={goPrev} style={{ padding: 4 }} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { setPickerYear(selectedYear); setMonthPickerOpen(true); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}
                scaleAmount={0.97} opacityAmount={0.8}
              >
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>
                  {calHeaderYear}년 {calHeaderMonth}월
                </Text>
                <ChevronDown size={16} color="#70737B" />
              </AnimatedPressable>
              <AnimatedPressable
                onPress={goNext}
                style={{ padding: 4, opacity: !canGoNext ? 0.3 : 1 }}
                scaleAmount={0.88} opacityAmount={0.7}
              >
                <ChevronRight size={20} color="#19191B" />
              </AnimatedPressable>
            </View>
            {/* 월간 / 주간 토글 */}
            <View style={{ flexDirection: "row" }}>
              <AnimatedPressable
                onPress={() => setViewMode("월간")}
                style={{
                  width: 36, height: 22,
                  borderTopLeftRadius: 4, borderBottomLeftRadius: 4,
                  backgroundColor: viewMode === "월간" ? "#93989E" : "#F7F7F8",
                  alignItems: "center", justifyContent: "center",
                }}
                scaleAmount={0.95} opacityAmount={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: viewMode === "월간" ? "#FFFFFF" : "#93989E" }}>월간</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => setViewMode("일간")}
                style={{
                  width: 36, height: 22,
                  borderTopRightRadius: 4, borderBottomRightRadius: 4,
                  backgroundColor: viewMode === "일간" ? "#93989E" : "#F7F7F8",
                  alignItems: "center", justifyContent: "center",
                }}
                scaleAmount={0.95} opacityAmount={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: viewMode === "일간" ? "#FFFFFF" : "#93989E" }}>일간</Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* 월간 뷰 */}
          {viewMode === "월간" && (
            <View style={{ paddingHorizontal: 12 }}>
              <View style={{ flexDirection: "row", marginBottom: 4 }}>
                {DAY_LABELS.map((d, i) => (
                  <View key={d} style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B" }}>{d}</Text>
                  </View>
                ))}
              </View>
              {calWeeks.map((week, wi) => (
                <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
                  {week.map((cell, ci) => {
                    const isTodayCell = !cell.isOutside && selectedYear === currentYear && selectedMonth === currentMonth && cell.day === now.getDate();
                    const isSun = ci === 0; const isSat = ci === 6;
                    const pdata = !cell.isOutside ? paydayData[cell.day] : null;
                    const hasPdata = !!pdata;
                    const hasScheds = !cell.isOutside && !!(schedulesByDay[cell.day]?.length);
                    const hasDailyPay = !cell.isOutside && !!selectedPayslipStaff && !!dailyPayData[cell.day];
                    const isScheduledDay = !cell.isOutside && !!selectedPayslipStaff && selectedStaffScheduledDays.has(cell.day);
                    const highlightDay = hasDailyPay || isScheduledDay;
                    return (
                      <AnimatedPressable
                        key={ci}
                        onPress={() => !cell.isOutside && handleDayClick(cell.day)}
                        scaleAmount={hasPdata || hasScheds || hasDailyPay ? 0.93 : 1}
                        opacityAmount={hasPdata || hasScheds || hasDailyPay ? 0.8 : 1}
                        style={{ flex: 1, alignItems: "center", paddingVertical: 6, minHeight: 72 }}
                      >
                        <View style={{
                          width: 32, height: 22, borderRadius: 10,
                          backgroundColor: isTodayCell ? "#4261FF" : highlightDay ? "#E8F3FF" : "transparent",
                          alignItems: "center", justifyContent: "center", marginBottom: 4,
                        }}>
                          <Text style={{
                            fontSize: 14, fontWeight: isTodayCell ? "700" : "500", letterSpacing: -0.28,
                            color: cell.isOutside ? "transparent" : isTodayCell ? "#FFFFFF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#70737B",
                          }}>
                            {cell.isOutside ? "" : cell.day}
                          </Text>
                        </View>
                        {pdata && (
                          pdata.allTransferred ? (
                            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#10C97D", alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 11, color: "#FFFFFF", fontWeight: "700" }}>✓</Text>
                            </View>
                          ) : (
                            <View style={{ width: 18, height: 18 }}>
                              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFB300", alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 9, fontWeight: "700", color: "#92400E" }}>₩</Text>
                              </View>
                              <View style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF3D3D", borderWidth: 1, borderColor: "#FFFFFF" }} />
                            </View>
                          )
                        )}
                        {!pdata && !selectedPayslipStaff && hasScheds && (
                          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#4261FF" }}>{schedulesByDay[cell.day].length}</Text>
                          </View>
                        )}
                        {!pdata && !!selectedPayslipStaff && (
                          hasDailyPay ? (
                            dailyPayData[cell.day].pay > 0 ? (
                              <View style={{ width: 40, height: 17, borderRadius: 4, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 11, fontWeight: "500", color: "#AAB4BF" }}>
                                  {(dailyPayData[cell.day].pay / 10000).toFixed(1)}만
                                </Text>
                              </View>
                            ) : (
                              <View style={{ height: 17, borderRadius: 4, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: "500", color: "#4261FF" }}>
                                  {`${Math.floor(dailyPayData[cell.day].workMin / 60)}h`}
                                </Text>
                              </View>
                            )
                          ) : isScheduledDay ? (
                            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 9, fontWeight: "700", color: "#4261FF" }}>✓</Text>
                            </View>
                          ) : null
                        )}
                      </AnimatedPressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* 일간 뷰 */}
          {viewMode === "일간" && (
            <View style={{ borderTopWidth: 1, borderTopColor: "#EBEBEB" }}>
              {selectedPayslipStaff ? (
                Object.keys(dailyPayData).length === 0 ? (
                  <View style={{ padding: 32, alignItems: "center" }}>
                    <EmptyState message="이 달에 출퇴근 기록이 없어요" compact />
                  </View>
                ) : (
                  <>
                    {(Object.entries(dailyPayData) as [string, { clockIn: string; clockOut: string; workMin: number; pay: number }][])
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([dayStr, data], idx) => {
                        const day = Number(dayStr);
                        const dow = new Date(selectedYear, selectedMonth - 1, day).getDay();
                        const hours = Math.floor(data.workMin / 60);
                        const mins = data.workMin % 60;
                        const timeLabel = mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
                        return (
                          <AnimatedPressable
                            key={idx}
                            onPress={() => { setSelectedCalDay(day); setCalDaySheetOpen(true); }}
                            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}
                            scaleAmount={0.98} opacityAmount={0.85}
                          >
                            <View>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>
                                {selectedMonth}월 {day}일 ({DAY_LABELS[dow]})
                              </Text>
                              <Text style={{ fontSize: 12, color: "#AAB4BF", marginTop: 2 }}>
                                {data.clockIn} - {data.clockOut} ({timeLabel})
                              </Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#19191B" }}>
                              {data.pay > 0 ? `${data.pay.toLocaleString()}원` : timeLabel}
                            </Text>
                          </AnimatedPressable>
                        );
                      })}
                  </>
                )
              ) : schedules.length === 0 ? (
                <View style={{ padding: 32, alignItems: "center" }}>
                  <EmptyState message="이 달에 스케줄이 없어요" compact />
                </View>
              ) : (
                <>
                  {(Object.entries(schedulesByDay) as [string, OwnerSchedule[]][])
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .flatMap(([dayStr, dayScheds]) => dayScheds.map((s) => ({ day: Number(dayStr), s })))
                    .map(({ day, s }, idx) => {
                      const dow = new Date(selectedYear, selectedMonth - 1, day).getDay();
                      const sc = getShiftStyle(s.shift_name ?? undefined);
                      return (
                        <AnimatedPressable
                          key={idx}
                          onPress={() => navigation.navigate("SalaryDetail", { name: s.employee_name, year: selectedYear, month: selectedMonth })}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}
                          scaleAmount={0.98} opacityAmount={0.85}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{s.employee_name.charAt(0)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, color: "#AAB4BF", marginBottom: 2 }}>
                                {selectedMonth}월 {day}일 ({DAY_LABELS[dow]})
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{s.employee_name}</Text>
                                {s.shift_name && (
                                  <View style={{ backgroundColor: sc.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "600", color: sc.text }}>{s.shift_name}</Text>
                                  </View>
                                )}
                              </View>
                              {(s.work_start || s.work_end) && (
                                <Text style={{ fontSize: 12, color: "#AAB4BF", marginTop: 2 }}>
                                  {s.work_start?.slice(0, 5) ?? "--:--"} ~ {s.work_end?.slice(0, 5) ?? "--:--"}
                                </Text>
                              )}
                            </View>
                          </View>
                          <ChevronRight size={16} color="#AAB4BF" />
                        </AnimatedPressable>
                      );
                    })}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* 급여명세서 발급 탭 */}
      {activeTab === "급여명세서 발급" && (
        <>
          {/* 월 선택 네비게이터 */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AnimatedPressable onPress={goPrev} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
              <ChevronLeft size={20} color="#19191B" />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => { setPickerYear(selectedYear); setMonthPickerOpen(true); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              hitSlop={4} scaleAmount={0.97} opacityAmount={0.8}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>
                {selectedYear}년 {selectedMonth}월 급여
              </Text>
              <ChevronDown size={16} color="#70737B" />
            </AnimatedPressable>
            <AnimatedPressable onPress={goNext} style={{ padding: 4, opacity: canGoNext ? 1 : 0.3 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
              <ChevronRight size={20} color="#19191B" />
            </AnimatedPressable>
          </View>
          <Text style={{ fontSize: 12, color: "#9EA3AD", textAlign: "center", marginTop: 2, marginBottom: 2 }}>
            {selectedYear}.{String(selectedMonth).padStart(2, "0")}.01 - {selectedYear}.{String(selectedMonth).padStart(2, "0")}.{String(lastDay).padStart(2, "0")}
          </Text>

          {/* 안내 배너 */}
          {isCurrentMonth && (
            <View style={{ marginHorizontal: 20, marginTop: 10, padding: 10, backgroundColor: "#F0F3FF", borderRadius: 10, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Info size={16} color="#4261FF" style={{ marginTop: 1, flexShrink: 0 }} />
              <Text style={{ flex: 1, fontSize: 13, color: "#4261FF", lineHeight: 20 }}>
                {unpaid.length > 0
                  ? <>급여명세서 발급 후 <Text style={{ fontWeight: "700" }}>실제 이체는 별도로</Text> 진행하고 이체 확인을 눌러주세요.</>
                  : <>급여일 <Text style={{ fontWeight: "700" }}>3일 전부터</Text> 발급 대기 목록에 노출돼요.</>
                }
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            {/* 수동 생성 버튼 */}
            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <AnimatedPressable
                onPress={handleGenerate}
                scaleAmount={0.97} opacityAmount={0.75}
                style={{
                  height: 44, borderRadius: 12, borderWidth: 1,
                  borderColor: "#4261FF", alignItems: "center", justifyContent: "center",
                  backgroundColor: generating ? "#F0F3FF" : "#FFFFFF",
                  flexDirection: "row", gap: 6,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>
                  {generating ? "생성 중..." : `${selectedYear}년 ${selectedMonth}월 명세서 일괄 생성`}
                </Text>
              </AnimatedPressable>
            </View>
            {enrichedPayslips.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center", paddingTop: 36 }}>
                <EmptyState message={`${selectedYear}년 ${selectedMonth}월 급여 명세서가 없어요`} />
                <Text style={{ marginTop: 8, fontSize: 13, color: "#AAB4BF", textAlign: "center", lineHeight: 20 }}>
                  {"직원별 급여일 3일 전부터 자동 생성되거나\n위 버튼으로 수동 생성할 수 있어요"}
                </Text>
              </View>
            ) : (
              <>
                {unpaid.length > 0 && (
                  <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#19191B" }}>발급 대기</Text>
                      <View style={{ backgroundColor: "#E8F3FF", borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF" }}>{unpaid.length}명</Text>
                      </View>
                    </View>
                    {unpaid.map((p) => (
                      <PayslipCard
                        key={p.id}
                        p={p}
                        isPaid={false}
                        isTransferred={transferredIds.has(p.id) || p.is_transferred}
                        dDay={getDDay(p.salary_day)}
                        onPress={() => navigation.navigate("PayslipDetail", { payslipId: p.id, name: p.name, year: selectedYear, month: selectedMonth })}
                        onSalaryDetail={() => navigation.navigate("SalaryDetail", { name: p.name, year: selectedYear, month: selectedMonth })}
                        onTransfer={() => setTransferTarget(p)}
                      />
                    ))}
                  </View>
                )}

                {unpaid.length > 0 && paid.length > 0 && (
                  <View style={{ height: 12, backgroundColor: "#F7F7F8", marginVertical: 6 }} />
                )}

                {paid.length > 0 && (
                  <View style={{ paddingHorizontal: 20, paddingTop: unpaid.length > 0 ? 8 : 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#70737B" }}>발급 완료</Text>
                      <View style={{ backgroundColor: "#F7F7F8", borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#AAB4BF" }}>{paid.length}명</Text>
                      </View>
                    </View>
                    {paid.map((p) => (
                      <PayslipCard
                        key={p.id}
                        p={p}
                        isPaid={true}
                        isTransferred={transferredIds.has(p.id) || p.is_transferred}
                        dDay={getDDay(p.salary_day)}
                        onPress={() => navigation.navigate("PayslipDetail", { payslipId: p.id, name: p.name, year: selectedYear, month: selectedMonth })}
                        onSalaryDetail={() => navigation.navigate("SalaryDetail", { name: p.name, year: selectedYear, month: selectedMonth })}
                        onTransfer={() => setTransferTarget(p)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* 이체 완료 확인 팝업 */}
      <Modal visible={!!transferTarget} transparent animationType="fade" onRequestClose={() => setTransferTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }} onPress={() => setTransferTarget(null)}>
          <Pressable style={{ width: "85%", maxWidth: 320, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 28, paddingBottom: 20, alignItems: "center" }} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", textAlign: "center", marginBottom: 8, letterSpacing: -0.36 }}>이체 완료 처리</Text>
            <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", marginBottom: 24, lineHeight: 22, letterSpacing: -0.28 }}>
              {transferTarget?.name}님 급여를 실제로{"\n"}이체하셨나요?
            </Text>
            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
              <AnimatedPressable onPress={() => setTransferTarget(null)} style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.75}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#70737B", letterSpacing: -0.3 }}>취소</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { if (transferTarget) { handleTransfer(transferTarget.id); setTransferTarget(null); } }}
                style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
                scaleAmount={0.97} opacityAmount={0.75}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.3 }}>이체 완료</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 월 선택 팝업 */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, width: 300 }} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <AnimatedPressable onPress={() => setPickerYear(y => y - 1)} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{pickerYear}년</Text>
              <AnimatedPressable onPress={() => { if (pickerYear < currentYear) setPickerYear(y => y + 1); }} style={{ padding: 4, opacity: pickerYear < currentYear ? 1 : 0.3 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronRight size={20} color="#19191B" />
              </AnimatedPressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const isFuture = pickerYear > currentYear || (pickerYear === currentYear && m > currentMonth);
                const isSelected = pickerYear === selectedYear && m === selectedMonth;
                const hasData = hasMonthData(pickerYear, m);
                return (
                  <AnimatedPressable
                    key={m}
                    onPress={() => { if (!isFuture) { setSelectedYear(pickerYear); setSelectedMonth(m); setMonthPickerOpen(false); } }}
                    style={{ width: "22%", paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: isSelected ? "#4261FF" : "#F7F7F8", opacity: isFuture ? 0.35 : 1 }}
                    scaleAmount={0.97} opacityAmount={0.8}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: isSelected ? "#FFFFFF" : "#19191B" }}>{m}월</Text>
                    {hasData && !isSelected && (
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#4261FF", marginTop: 3 }} />
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <OwnerBottomNav activeTab="salary" navigation={navigation} />

      {/* 급여일 직원 목록 바텀시트 */}
      <BottomSheet isOpen={!!dayDetailSheet} onClose={() => setDayDetailSheet(null)} title={dayDetailSheet ? `${selectedMonth}월 ${dayDetailSheet.day}일 급여일` : ""}>
        {dayDetailSheet && (
          <View>
            {dayDetailSheet.staffList.map((p, idx) => {
              const avatarColor = getPayslipAvatarColor(p.id);
              const isTransferred = transferredIds.has(p.id) || p.is_transferred;
              const statusBadge = !p.is_published
                ? { label: "발급 대기", bg: "#E8F3FF", color: "#4261FF" }
                : isTransferred
                  ? { label: "이체 완료", bg: "#F7F7F8", color: "#AAB4BF" }
                  : { label: "발급 완료", bg: "rgba(16,201,125,0.08)", color: "#10C97D" };
              const isLast = idx === dayDetailSheet.staffList.length - 1;
              return (
                <AnimatedPressable
                  key={p.id}
                  onPress={() => {
                    setDayDetailSheet(null);
                    navigation.navigate("SalaryDetail", { name: p.name, year: selectedYear, month: selectedMonth });
                  }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: "#F0F0F0" }}
                  scaleAmount={0.98} opacityAmount={0.85}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: avatarColor, alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: p.is_published ? 0.6 : 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{p.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: p.is_published ? "#9EA3AD" : "#19191B" }}>{p.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <View style={{ backgroundColor: statusBadge.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: statusBadge.color }}>{statusBadge.label}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: p.is_published ? "#9EA3AD" : "#4261FF" }}>
                      {(p.net_pay ?? 0).toLocaleString()}원
                    </Text>
                    <ChevronRight size={16} color="#AAB4BF" />
                  </View>
                </AnimatedPressable>
              );
            })}
            <View style={{ paddingTop: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: "#EBEBEB", flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#70737B" }}>총 지급 예정액</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#4261FF" }}>
                {dayDetailSheet.staffList.reduce((s, p) => s + (p.net_pay ?? 0), 0).toLocaleString()}원
              </Text>
            </View>
          </View>
        )}
      </BottomSheet>

      {/* 날짜 클릭 스케줄 바텀시트 (급여일 아닌 날) */}
      <BottomSheet
        isOpen={calDaySheetOpen}
        onClose={() => setCalDaySheetOpen(false)}
        title={selectedCalDay ? `${selectedMonth}월 ${selectedCalDay}일 근무` : ""}
      >
        {selectedCalDay != null && (() => {
          // If specific staff selected and they have pay data for this day
          if (selectedPayslipStaff && dailyPayData[selectedCalDay]) {
            const data = dailyPayData[selectedCalDay];
            const hours = Math.floor(data.workMin / 60);
            const mins = data.workMin % 60;
            const timeLabel = mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
            const hourlyRate = staffHourlyRateMap[selectedPayslipStaff.employee_id] ?? 0;
            return (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, color: "#AAB4BF" }}>{data.clockIn} - {data.clockOut}</Text>
                  <Text style={{ fontSize: 14, color: "#AAB4BF" }}>({timeLabel})</Text>
                </View>
                {data.pay > 0 ? (
                  <Text style={{ fontSize: 32, fontWeight: "700", letterSpacing: -0.64, color: "#19191B", marginBottom: 16 }}>
                    {data.pay.toLocaleString()}원
                  </Text>
                ) : (
                  <Text style={{ fontSize: 22, fontWeight: "700", color: "#70737B", marginBottom: 16 }}>
                    월급 직원
                  </Text>
                )}
                <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginBottom: 16 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: "#AAB4BF" }}>근무 시간</Text>
                  <Text style={{ fontSize: 14, color: "#19191B" }}>{timeLabel}</Text>
                </View>
                {data.pay > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>당일 급여</Text>
                    <Text style={{ fontSize: 14, color: "#19191B" }}>{data.pay.toLocaleString()}원</Text>
                  </View>
                )}
                {hourlyRate > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>시급</Text>
                    <Text style={{ fontSize: 14, color: "#19191B" }}>{hourlyRate.toLocaleString()}원</Text>
                  </View>
                )}
                <AnimatedPressable
                  onPress={() => {
                    setCalDaySheetOpen(false);
                    navigation.navigate("SalaryDetail", { name: selectedPayslipStaff.name, year: selectedYear, month: selectedMonth });
                  }}
                  style={{ marginTop: 8, height: 44, borderRadius: 12, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
                  scaleAmount={0.97} opacityAmount={0.75}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>급여 상세 보기</Text>
                </AnimatedPressable>
              </View>
            );
          }
          const staffForDay = selectedPayslipStaff
            ? (schedulesByDay[selectedCalDay] ?? []).filter((s) => s.employee_name === selectedPayslipStaff.name)
            : (schedulesByDay[selectedCalDay] ?? []);
          if (staffForDay.length === 0) {
            return (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <EmptyState message="이 날은 스케줄이 없어요" compact />
              </View>
            );
          }
          return (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>근무직원</Text>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>총 {staffForDay.length}명</Text>
              </View>
              {staffForDay.map((s, idx) => {
                const sc = getShiftStyle(s.shift_name ?? undefined);
                const isLast = idx === staffForDay.length - 1;
                return (
                  <AnimatedPressable
                    key={idx}
                    onPress={() => {
                      setCalDaySheetOpen(false);
                      navigation.navigate("SalaryDetail", { name: s.employee_name, year: selectedYear, month: selectedMonth });
                    }}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: "#F0F0F0" }}
                    scaleAmount={0.98} opacityAmount={0.85}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{s.employee_name.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{s.employee_name}</Text>
                          {s.shift_name && (
                            <View style={{ backgroundColor: sc.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 10, fontWeight: "600", color: sc.text }}>{s.shift_name}</Text>
                            </View>
                          )}
                        </View>
                        {(s.work_start || s.work_end) && (
                          <Text style={{ fontSize: 12, color: "#AAB4BF" }}>
                            {s.work_start?.slice(0, 5) ?? "--:--"} ~ {s.work_end?.slice(0, 5) ?? "--:--"}
                          </Text>
                        )}
                      </View>
                    </View>
                    <ChevronRight size={16} color="#AAB4BF" />
                  </AnimatedPressable>
                );
              })}
            </View>
          );
        })()}
      </BottomSheet>

      {/* 직원 선택 바텀시트 */}
      <BottomSheet isOpen={staffPickerOpen} onClose={() => setStaffPickerOpen(false)} title="직원 선택하기">
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 14, color: "#AAB4BF" }}>등록 직원</Text>
          <Text style={{ fontSize: 14, color: "#AAB4BF" }}>총 {enrichedPayslips.filter((p) => !isResignedOrLeave(p)).length}명</Text>
        </View>
        <View style={{ marginHorizontal: -20 }}>
          {enrichedPayslips.filter((p) => !isResignedOrLeave(p)).map((p) => {
            const isSelected = selectedPayslipStaff?.id === p.id;
            const avatarColor = getPayslipAvatarColor(p.id);
            return (
              <AnimatedPressable
                key={p.id}
                onPress={() => {
                  setSelectedPayslipStaff(p);
                  setSalaryFilter("직원 선택하기");
                  setStaffPickerOpen(false);
                }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 10, backgroundColor: isSelected ? "#F0F4FF" : "#FFFFFF" }}
                scaleAmount={0.98} opacityAmount={0.85}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: avatarColor, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{p.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: isSelected ? "#4261FF" : "#19191B" }}>{p.name}</Text>
                      {p.type && (
                        <View style={{ backgroundColor: "#F7F7F8", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 10, color: "#70737B" }}>{p.type}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{(p.net_pay ?? 0).toLocaleString()}원</Text>
                  </View>
                </View>
                {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4261FF", flexShrink: 0 }} />}
              </AnimatedPressable>
            );
          })}
          {enrichedPayslips.length === 0 && (
            <View style={{ padding: 32, alignItems: "center" }}>
              <EmptyState message="이번 달 명세서가 없어요" compact />
            </View>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
    </FadeScreen>
  );
};

/* ── PayslipCard ── */

const PayslipCard: React.FC<{
  p: PayslipRow;
  isPaid: boolean;
  isTransferred: boolean;
  dDay: { label: string; color: string } | null;
  onPress: () => void;
  onSalaryDetail?: () => void;
  onTransfer: () => void;
}> = ({ p, isPaid, isTransferred, dDay, onPress, onSalaryDetail, onTransfer }) => {
  const avatarColor = getPayslipAvatarColor(p.id);
  const sc = getShiftStyle(p.shift);

  return (
    <AnimatedPressable
      onPress={onPress}
      scaleAmount={0.98} opacityAmount={0.85}
      style={{
        backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 10, overflow: "hidden",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
      }}
    >
      <View style={{ padding: 14, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: avatarColor, alignItems: "center", justifyContent: "center", opacity: isPaid ? 0.6 : 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>{p.name.charAt(0)}</Text>
            </View>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: isPaid ? "#9EA3AD" : "#19191B" }}>{p.name}</Text>
                {p.shift ? (
                  <View style={{ backgroundColor: sc.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: sc.text }}>{p.shift}</Text>
                  </View>
                ) : null}
                {p.type ? (
                  <View style={{ backgroundColor: "#F7F7F8", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "500", color: "#70737B" }}>{p.type}</Text>
                  </View>
                ) : null}
                {(p.is_resigned || p.working_status === "퇴사" || p.working_status === "앱탈퇴") && (
                  <View style={{ backgroundColor: "#F0F0F2", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#70737B" }}>퇴사</Text>
                  </View>
                )}
                {p.working_status === "휴직" && (
                  <View style={{ backgroundColor: "#FFF3E0", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#FF9800" }}>휴직</Text>
                  </View>
                )}
              </View>
              {p.period ? (
                <Text style={{ fontSize: 12, color: "#9EA3AD" }}>{p.period} 급여명세서</Text>
              ) : null}
            </View>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: isPaid ? "#9EA3AD" : "#4261FF", letterSpacing: -0.32 }}>
            {(p.net_pay ?? 0).toLocaleString()}원
          </Text>
        </View>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 12, color: "#9EA3AD" }}>급여일</Text>
          {p.salary_day ? (
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#70737B" }}>
              {"매월 " + p.salary_day.split(",").map((d: string) => { const t = d.trim(); return t === "말일" ? "말일" : `${t}일`; }).join(", ")}
            </Text>
          ) : null}
          {!isPaid && dDay ? (
            <Text style={{ fontSize: 11, fontWeight: "700", color: dDay.color }}>({dDay.label})</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {onSalaryDetail && (
            <AnimatedPressable
              onPress={() => { onSalaryDetail(); }}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F0F4FF", borderWidth: 1, borderColor: "#C0CAFF" }}
              scaleAmount={0.97} opacityAmount={0.75}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#4261FF" }}>급여 기준 수정</Text>
            </AnimatedPressable>
          )}
          {!isPaid ? (
            <AnimatedPressable
              onPress={() => { onPress(); }}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#4261FF" }}
              scaleAmount={0.97} opacityAmount={0.75}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}>명세서 발행</Text>
            </AnimatedPressable>
          ) : (
            <AnimatedPressable
              onPress={() => { if (!isTransferred) onTransfer(); }}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                backgroundColor: isTransferred ? "#F7F7F8" : "#FFB300",
                borderWidth: 1, borderColor: isTransferred ? "#DBDCDF" : "#FFB300",
              }}
              scaleAmount={0.97} opacityAmount={0.75}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: isTransferred ? "#AAB4BF" : "#FFFFFF" }}>
                {isTransferred ? "✓ 이체 완료" : "이체 확인"}
              </Text>
            </AnimatedPressable>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
};

export default OwnerSalaryManagementScreen;
