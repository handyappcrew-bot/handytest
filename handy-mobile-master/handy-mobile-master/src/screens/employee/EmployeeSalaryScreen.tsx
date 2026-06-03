import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import BottomSheet from "@/components/BottomSheet";
import { SafeAreaView } from "react-native-safe-area-context";
import EmployeeBottomNav from "@/components/EmployeeBottomNav";
import { getEmployeePayslips, getMyWorkLogs, getSalaryPreview, getMyEmployeeInfo, getEmployeePayslipDetail, SalaryPreviewResponse } from "@/api/employee";
import { localStorage } from "@/utils/storage";
import { useToast } from "@/components/Toast";
import { DAY_LABELS as WEEKDAY_HEADERS } from "@/utils/constants";
import { toMin } from "@/utils/timeUtils";
import type { ScreenProps } from "@/navigation/types";

type ActiveTab = "calendar" | "payStub";
type ViewMode = "monthly" | "daily";

interface DayPay {
  date: number;
  dayOfWeek: string;
  workPay?: number;
  weeklyHolidayPay?: number;
  isPayday?: boolean;
  isToday?: boolean;
  isOutside?: boolean;
  detail?: {
    timeRange: string;
    totalHours: string;
    overtimeMinutes?: number;
    totalPay: number;
    salary: number;
    incentive?: number;
    overtimePay?: number;
    nightPay?: number;
    holidayPay?: number;
  };
}


const calcNightOverlapMin = (startMin: number, endMin: number): number => {
  // 야간: 22:00(1320) ~ 06:00(360+1440=1800)
  const totalMin = endMin < startMin ? endMin + 1440 : endMin;
  const s = startMin;
  const e = totalMin;
  let overlap = 0;
  // 22:00 ~ 자정(1440)
  const o1s = Math.max(s, 1320); const o1e = Math.min(e, 1440);
  if (o1e > o1s) overlap += o1e - o1s;
  // 자정 ~ 06:00(360) → 1440~1800
  const o2s = Math.max(s, 1440); const o2e = Math.min(e, 1800);
  if (o2e > o2s) overlap += o2e - o2s;
  return Math.max(0, overlap);
};

const extractTime = (dt: string | null | undefined): string | null => {
  if (!dt) return null;
  const s = String(dt).replace("T", " ");
  const parts = s.split(" ");
  const timePart = parts.length >= 2 ? parts[1] : parts[0];
  return timePart ? timePart.slice(0, 5) : null;
};

const buildCalendar = (year: number, month: number): DayPay[][] => {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const _now = new Date();
  const isCurrentMonth = _now.getFullYear() === year && _now.getMonth() + 1 === month;
  const allDays: DayPay[] = [];
  for (let i = 0; i < firstDay; i++) {
    allDays.push({ date: prevMonthDays - firstDay + 1 + i, dayOfWeek: dayNames[i], isOutside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const isToday = isCurrentMonth && d === _now.getDate();
    allDays.push({ date: d, dayOfWeek: dayNames[dow], ...(isToday ? { isToday: true } : {}) });
  }
  let nextDate = 1;
  while (allDays.length % 7 !== 0) {
    allDays.push({ date: nextDate++, dayOfWeek: dayNames[allDays.length % 7], isOutside: true });
  }
  const weeks: DayPay[][] = [];
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));
  return weeks;
};

const EmployeeSalaryScreen: React.FC<ScreenProps<"EmployeeSalary">> = ({ navigation }) => {
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayPay | null>(null);
  const [salaryInfoOpen, setSalaryInfoOpen] = useState(false);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [salaryType, setSalaryType] = useState<string | null>(null);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [annualSalary, setAnnualSalary] = useState(0);
  const [salaryPreview, setSalaryPreview] = useState<SalaryPreviewResponse | null>(null);
  const [payslipDetail, setPayslipDetail] = useState<any>(null);

  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const hasOvertimePay = localStorage.getItem("storeHasOvertimePay") === "true";
  const hasNightPay = localStorage.getItem("storeHasNightPay") === "true";
  const hasHolidayPay = localStorage.getItem("storeHasHolidayPay") === "true";
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const NOW_YEAR = new Date().getFullYear();
  const NOW_MONTH = new Date().getMonth() + 1;
  const isCurrentMonth = calYear === NOW_YEAR && calMonth === NOW_MONTH;

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    getEmployeePayslips(storeId, undefined, undefined, true).then((rows) => setPayslips(rows ?? [])).catch((e) => { console.warn(e); setPayslips([]); toast({ description: "급여 정보를 불러오지 못했어요.", variant: "destructive" }); });
    getMyEmployeeInfo(storeId).then((info: any) => {
      if (info?.hourly_rate) setHourlyRate(Number(info.hourly_rate));
      if (info?.salary_type) setSalaryType(info.salary_type);
      if (info?.monthly_salary) setMonthlySalary(Number(info.monthly_salary));
      if (info?.annual_salary) setAnnualSalary(Number(info.annual_salary));
    }).catch((e) => { console.warn(e); toast({ description: "급여 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId]));

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    let cancelled = false;
    getMyWorkLogs(storeId, calYear, calMonth)
      .then((rows) => { if (!cancelled) setWorkLogs(Array.isArray(rows) ? rows : []); })
      .catch((e) => { if (!cancelled) { console.warn(e); setWorkLogs([]); toast({ description: "근무 기록을 불러오지 못했어요.", variant: "destructive" }); } });
    getSalaryPreview(storeId, calYear, calMonth)
      .then((data) => { if (!cancelled) setSalaryPreview(data); })
      .catch(() => { if (!cancelled) setSalaryPreview(null); });
    return () => { cancelled = true; };
  }, [storeId, calYear, calMonth]));

  // 해당 월에 발급된 급여명세서가 있으면 정확한 수당 포함 상세 데이터 로드
  useEffect(() => {
    if (!storeId) return;
    const published = payslips.find(
      (p: any) => p.year === calYear && p.month === calMonth && p.published_at
    );
    if (!published) { setPayslipDetail(null); return; }
    getEmployeePayslipDetail(published.id, storeId)
      .then(setPayslipDetail)
      .catch(() => setPayslipDetail(null));
  }, [payslips, calYear, calMonth, storeId]);

  const calendar = buildCalendar(calYear, calMonth);

  const logsByDay = useMemo(() => {
    const map: Record<number, any> = {};
    workLogs.forEach((log: any) => {
      const d = log.work_date ? new Date(log.work_date).getDate() : null;
      if (d !== null) map[d] = log;
    });
    return map;
  }, [workLogs]);

  // 주휴수당 발생 일 계산: 주 15시간 이상 + 결근 없는 주 → 해당 주 일요일에 배분
  const weeklyHolidayPayMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (!hourlyRate || hourlyRate <= 0 || workLogs.length === 0) return map;

    const weekMap: Record<string, any[]> = {};
    workLogs.forEach((log: any) => {
      const dStr = String(log.work_date).slice(0, 10);
      const d = new Date(`${dStr}T00:00:00`);
      const dow = d.getDay();
      const daysToMon = dow === 0 ? 6 : dow - 1;
      const mon = new Date(d);
      mon.setDate(d.getDate() - daysToMon);
      const weekKey = mon.toISOString().slice(0, 10);
      if (!weekMap[weekKey]) weekMap[weekKey] = [];
      weekMap[weekKey].push(log);
    });

    Object.entries(weekMap).forEach(([weekKey, logs]) => {
      const weekdayLogs = logs.filter((log: any) => {
        const d = new Date(`${String(log.work_date).slice(0, 10)}T00:00:00`);
        return d.getDay() !== 0;
      });
      if (weekdayLogs.some((log: any) => log.status === "absent")) return;

      let totalMin = 0;
      let workDays = 0;
      weekdayLogs.forEach((log: any) => {
        const start = extractTime(log.start_time);
        const end = extractTime(log.end_time);
        if (!start || !end) return;
        let worked = toMin(end) - toMin(start);
        if (worked < 0) worked += 1440;
        const bst = extractTime(log.break_start_time);
        const bet = extractTime(log.break_end_time);
        if (bst && bet) worked -= toMin(bet) - toMin(bst);
        totalMin += Math.max(0, worked);
        workDays++;
      });
      if (totalMin < 900 || workDays === 0) return; // 주 15시간 미만

      const dailyHours = Math.min(8, totalMin / 60 / workDays);
      const weeklyPay = Math.round(dailyHours * hourlyRate);

      const mon = new Date(`${weekKey}T00:00:00`);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      if (sun.getFullYear() === calYear && sun.getMonth() + 1 === calMonth) {
        map[sun.getDate()] = (map[sun.getDate()] || 0) + weeklyPay / 10000;
      }
    });
    return map;
  }, [workLogs, hourlyRate, calYear, calMonth]);

  const enrichedCalendar = useMemo(() => calendar.map(week =>
    week.map(day => {
      if (day.isOutside) return day;
      const log = logsByDay[day.date];
      const weeklyHP = weeklyHolidayPayMap[day.date];

      if (!log) {
        if (!weeklyHP) return day;
        // 일요일 주휴수당만 있는 경우
        return {
          ...day,
          weeklyHolidayPay: weeklyHP,
          detail: {
            timeRange: "주휴일",
            totalHours: "",
            totalPay: Math.round(weeklyHP * 10000),
            salary: 0,
          },
        };
      }

      const start = extractTime(log.start_time);
      const end = extractTime(log.end_time);
      if (!start || !end) {
        return weeklyHP ? { ...day, weeklyHolidayPay: weeklyHP } : day;
      }
      const breakStart = extractTime(log.break_start_time);
      const breakEnd = extractTime(log.break_end_time);
      let workedMin = toMin(end) - toMin(start);
      if (workedMin < 0) workedMin += 1440;
      if (breakStart && breakEnd) workedMin -= toMin(breakEnd) - toMin(breakStart);
      workedMin = Math.max(0, workedMin);
      const payAmt = hourlyRate > 0 ? Math.round((workedMin / 60) * hourlyRate) : 0;
      const hh = Math.floor(workedMin / 60);
      const mm = workedMin % 60;

      // 수당 계산
      let overtimePay: number | undefined;
      let nightPay: number | undefined;
      let holidayPay: number | undefined;

      const status = log.status ?? "";
      const schedEnd = log.sched_end ? String(log.sched_end).slice(0, 5) : null;

      if (hasOvertimePay && status === "extended" && schedEnd) {
        const schedEndMin = toMin(schedEnd);
        const actualEndMin = toMin(end);
        let otMin = actualEndMin >= schedEndMin
          ? actualEndMin - schedEndMin
          : actualEndMin + 1440 - schedEndMin;
        if (otMin > 0) overtimePay = Math.round((otMin / 60) * hourlyRate * 0.5);
      }
      if (hasNightPay && status === "night") {
        const nightMin = calcNightOverlapMin(toMin(start), toMin(end));
        if (nightMin > 0) nightPay = Math.round((nightMin / 60) * hourlyRate * 0.5);
      }
      if (hasHolidayPay && (status === "holiday" || log.is_holiday)) {
        holidayPay = Math.round((workedMin / 60) * hourlyRate * 0.5);
      }

      return {
        ...day,
        workPay: payAmt > 0 ? payAmt / 10000 : undefined,
        weeklyHolidayPay: weeklyHP,
        detail: {
          timeRange: `${start} - ${end}`,
          totalHours: mm > 0 ? `${hh}시간 ${mm}분` : `${hh}시간`,
          totalPay: payAmt + (overtimePay ?? 0) + (nightPay ?? 0) + (holidayPay ?? 0),
          salary: payAmt,
          overtimePay,
          nightPay,
          holidayPay,
        },
      };
    })
  ), [calendar, logsByDay, hourlyRate, weeklyHolidayPayMap]);

  const _now = new Date();
  const isCurrentCalMonth = _now.getFullYear() === calYear && _now.getMonth() + 1 === calMonth;
  const lastDay = isCurrentCalMonth ? _now.getDate() : new Date(calYear, calMonth, 0).getDate();
  const allCalDays = enrichedCalendar.flat().filter(d => !d.isOutside && d.date >= 1 && d.date <= lastDay);
  const totalPayRaw = payslipDetail?.net_pay != null
    ? payslipDetail.net_pay
    : salaryType === "월급" && monthlySalary > 0
      ? monthlySalary
      : salaryType === "연봉" && annualSalary > 0
        ? Math.round(annualSalary / 12)
        : salaryPreview?.net_pay != null
          ? salaryPreview.net_pay
          : salaryPreview?.estimated_salary != null
            ? salaryPreview.estimated_salary
            : allCalDays.reduce((sum, d) => sum + (d.workPay ? Math.round(d.workPay * 10000) : 0) + (d.weeklyHolidayPay ? Math.round(d.weeklyHolidayPay * 10000) : 0), 0);
  const totalMinutes = allCalDays.reduce((sum, d) => {
    if (!d.detail) return sum;
    const parts = d.detail.timeRange.split(" - ");
    if (parts.length < 2) return sum;
    const [sh, sm] = parts[0].split(":").map(Number);
    const [eh, em] = parts[1].split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return sum + (diff < 0 ? diff + 1440 : diff);
  }, 0);
  const detailWorkHours = payslipDetail?.actual_work_minutes != null
    ? payslipDetail.actual_work_minutes / 60
    : null;
  const totalHoursDisplay = detailWorkHours != null
    ? `${Math.floor(detailWorkHours)}h ${Math.round((detailWorkHours % 1) * 60)}m`
    : salaryPreview?.total_hours != null
      ? `${Math.floor(salaryPreview.total_hours)}h ${Math.round((salaryPreview.total_hours % 1) * 60)}m`
      : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  const isSettled = !!payslipDetail;
  const effectiveSalaryType = salaryType ?? (hourlyRate > 0 ? "시급" : null);
  const periodLabel = isSettled
    ? `${calMonth}/1 ~ ${calMonth}/말 확정 급여`
    : effectiveSalaryType === "월급" || effectiveSalaryType === "연봉"
      ? `${calYear}년 ${calMonth}월 ${effectiveSalaryType}`
      : `${calMonth}/1 ~ ${calMonth}/${lastDay} 기준 예상 급여`;

  const isTodayDate = (date: number, isOutside?: boolean) => {
    if (isOutside) return false;
    return _now.getFullYear() === calYear && _now.getMonth() + 1 === calMonth && _now.getDate() === date;
  };

  const goPrevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); } else setCalMonth(calMonth - 1);
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); } else setCalMonth(calMonth + 1);
  };

  const handleDayClick = (day: DayPay) => {
    if (day.isOutside || (!day.detail && !day.weeklyHolidayPay)) return;
    setSelectedDay(day);
    setBottomSheetOpen(true);
  };

  const unconfirmedCount = payslips.filter((s: any) => !s.published_at).length;

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ backgroundColor: "#FFFFFF" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={() => navigation.navigate("EmployeeHome")} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>급여 관리</Text>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", paddingHorizontal: 20, gap: 36 }}>
          {[
            { key: "calendar" as ActiveTab, label: "급여 캘린더" },
            { key: "payStub" as ActiveTab, label: `급여 명세서${unconfirmedCount > 0 ? ` ${unconfirmedCount}건` : ""}` },
          ].map(({ key, label }) => (
            <AnimatedPressable key={key} onPress={() => setActiveTab(key)} style={{ paddingVertical: 12, position: "relative" }} scaleAmount={0.95} opacityAmount={0.8}>
              <Text style={{ fontSize: 16, fontWeight: activeTab === key ? "700" : "500", letterSpacing: -0.32, color: activeTab === key ? "#4261FF" : "#AAB4BF" }}>{label}</Text>
              {activeTab === key && (
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 9999, backgroundColor: "#4261FF" }} />
              )}
            </AnimatedPressable>
          ))}
        </View>
      </View>

      {/* Calendar tab */}
      {activeTab === "calendar" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Summary card */}
          <View style={{ margin: 20, borderRadius: 16, backgroundColor: "#F0F7FF" }}>
            <View style={{ padding: 16, paddingBottom: 0 }}>
              <View style={{ alignSelf: "flex-start", height: 17, borderRadius: 4, paddingHorizontal: 8, backgroundColor: isSettled ? "#D3DAFF" : "#D3DAFF", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: "#7488FE" }}>{periodLabel}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>
                  {calMonth}월 {isSettled ? "실 지급액" : "예상 급여"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {!isSettled && (
                    <AnimatedPressable onPress={() => setSalaryInfoOpen(true)} hitSlop={8} scaleAmount={0.97} opacityAmount={0.75}>
                      <Info size={18} color="#4261FF" />
                    </AnimatedPressable>
                  )}
                  <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#4261FF" }}>{totalPayRaw.toLocaleString()}원</Text>
                </View>
              </View>
            </View>
            <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginHorizontal: 16, marginVertical: 12 }} />
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>총 근무 시간</Text>
                <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{totalHoursDisplay}</Text>
              </View>
              {!isSettled && (salaryType === "시급" || (!salaryType && hourlyRate > 0)) && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>시급</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{hourlyRate > 0 ? `${hourlyRate.toLocaleString()}원` : "-원"}</Text>
                </View>
              )}
              {!isSettled && salaryType === "월급" && monthlySalary > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>기본급</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{monthlySalary.toLocaleString()}원</Text>
                </View>
              )}
              {!isSettled && salaryType === "연봉" && annualSalary > 0 && (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>연봉</Text>
                    <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{annualSalary.toLocaleString()}원</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>월 환산</Text>
                    <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{Math.round(annualSalary / 12).toLocaleString()}원</Text>
                  </View>
                </>
              )}
              {!isSettled && hasOvertimePay && salaryPreview?.overtime_pay != null && salaryPreview.overtime_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>연장수당 (예상)</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{salaryPreview.overtime_pay.toLocaleString()}원</Text>
                </View>
              )}
              {!isSettled && hasNightPay && salaryPreview?.night_pay != null && salaryPreview.night_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>야간수당 (예상)</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{salaryPreview.night_pay.toLocaleString()}원</Text>
                </View>
              )}
              {!isSettled && hasHolidayPay && salaryPreview?.holiday_pay != null && salaryPreview.holiday_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>휴일수당 (예상)</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{salaryPreview.holiday_pay.toLocaleString()}원</Text>
                </View>
              )}
              {!isSettled && salaryPreview?.weekly_leave_pay != null && salaryPreview.weekly_leave_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>주휴수당 (예상)</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{salaryPreview.weekly_leave_pay.toLocaleString()}원</Text>
                </View>
              )}
              {!isSettled && salaryPreview?.total_deduction != null && salaryPreview.total_deduction > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>공제 합계</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#FF5959" }}>-{salaryPreview.total_deduction.toLocaleString()}원</Text>
                </View>
              )}
              {isSettled && payslipDetail.overtime_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>연장수당</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{payslipDetail.overtime_pay.toLocaleString()}원</Text>
                </View>
              )}
              {isSettled && payslipDetail.night_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>야간수당</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{payslipDetail.night_pay.toLocaleString()}원</Text>
                </View>
              )}
              {isSettled && payslipDetail.holiday_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>휴일수당</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{payslipDetail.holiday_pay.toLocaleString()}원</Text>
                </View>
              )}
              {isSettled && payslipDetail.weekly_leave_pay > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>주휴수당</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#70737B" }}>{payslipDetail.weekly_leave_pay.toLocaleString()}원</Text>
                </View>
              )}
              {isSettled && payslipDetail.total_deduction > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: "#AAB4BF" }}>공제 합계</Text>
                  <Text style={{ fontSize: 14, letterSpacing: -0.28, color: "#FF5959" }}>-{payslipDetail.total_deduction.toLocaleString()}원</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

          {/* Month nav + toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <AnimatedPressable onPress={goPrevMonth} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{calYear}년 {calMonth}월</Text>
              <AnimatedPressable onPress={goNextMonth} style={{ padding: 4 }} hitSlop={8} disabled={isCurrentMonth} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronRight size={20} color={isCurrentMonth ? "#D1D5DB" : "#19191B"} />
              </AnimatedPressable>
            </View>
            <View style={{ flexDirection: "row" }}>
              <AnimatedPressable onPress={() => setViewMode("monthly")} style={{ width: 36, height: 22, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, backgroundColor: viewMode === "monthly" ? "#93989E" : "#F7F7F8", alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: -0.24, color: viewMode === "monthly" ? "#FFFFFF" : "#93989E" }}>월간</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => setViewMode("daily")} style={{ width: 36, height: 22, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: viewMode === "daily" ? "#93989E" : "#F7F7F8", alignItems: "center", justifyContent: "center" }} scaleAmount={0.97} opacityAmount={0.8}>
                <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: -0.24, color: viewMode === "daily" ? "#FFFFFF" : "#93989E" }}>일간</Text>
              </AnimatedPressable>
            </View>
          </View>

          {viewMode === "monthly" ? (
            <>
              <View style={{ paddingHorizontal: 12 }}>
                <View style={{ flexDirection: "row" }}>
                  {WEEKDAY_HEADERS.map((day, i) => (
                    <View key={day} style={{ flex: 1, alignItems: "center", paddingBottom: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B" }}>{day}</Text>
                    </View>
                  ))}
                </View>
                {enrichedCalendar.map((week, wi) => (
                  <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
                    {week.map((day, di) => {
                      const isSun = di === 0;
                      const isSat = di === 6;
                      const isToday = isTodayDate(day.date, day.isOutside);
                      const dateColor = day.isOutside ? "#AAB4BF" : isToday ? "#FFFFFF" : isSun ? "#FF5959" : isSat ? "#5DB1FF" : "#70737B";
                      return (
                        <View key={di} style={{ flex: 1, alignItems: "center", paddingVertical: 6, minHeight: 72 }}>
                          <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                            <View style={isToday ? { backgroundColor: "#4261FF", borderRadius: 10, minWidth: 40, width: 40, height: 22, alignItems: "center", justifyContent: "center" } : {}}>
                              <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: -0.28, color: dateColor }}>{day.date}</Text>
                            </View>
                          </View>
                          {day.workPay && !day.isOutside && (
                            <AnimatedPressable onPress={() => handleDayClick(day)} style={{ width: 40, height: 17, borderRadius: 4, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center", marginBottom: day.weeklyHolidayPay ? 4 : 0 }} scaleAmount={0.98} opacityAmount={0.85}>
                              <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: "#AAB4BF" }}>{typeof day.workPay === "number" ? day.workPay.toFixed(1) : day.workPay}만</Text>
                            </AnimatedPressable>
                          )}
                          {day.weeklyHolidayPay && !day.isOutside && (
                            <AnimatedPressable onPress={() => handleDayClick(day)} style={{ width: 40, height: 17, borderRadius: 4, backgroundColor: "#E8F3FF", alignItems: "center", justifyContent: "center" }} scaleAmount={0.98} opacityAmount={0.85}>
                              <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: "#7488FE" }}>{day.weeklyHolidayPay}만</Text>
                            </AnimatedPressable>
                          )}
                          {day.isPayday && !day.isOutside && (
                            <Text style={{ fontSize: 14, marginTop: day.workPay ? 2 : 0 }}>🪙</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: "#AAB4BF", paddingHorizontal: 20, marginTop: 8 }}>*금액은 만 원 단위로 반올림되어 표시돼요</Text>
            </>
          ) : (
            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              {allCalDays.filter(d => d.detail || d.weeklyHolidayPay).sort((a, b) => b.date - a.date).flatMap((d, idx) => {
                const items: { date: string; subtitle: string; amount: number; isBlue?: boolean; isRed?: boolean; dayRef: DayPay }[] = [];
                const dateLabel = `${calMonth}월 ${d.date}일 (${d.dayOfWeek})`;
                if (d.detail && d.detail.salary > 0) items.push({ date: dateLabel, subtitle: `${d.detail.timeRange} (${d.detail.totalHours})`, amount: d.detail.salary, dayRef: d });
                if (d.detail?.overtimePay) items.push({ date: dateLabel, subtitle: "연장수당", amount: d.detail.overtimePay, isBlue: true, dayRef: d });
                if (d.detail?.nightPay) items.push({ date: dateLabel, subtitle: "야간수당", amount: d.detail.nightPay, isBlue: true, dayRef: d });
                if (d.detail?.holidayPay) items.push({ date: dateLabel, subtitle: "휴일수당", amount: d.detail.holidayPay, isBlue: true, dayRef: d });
                if (d.weeklyHolidayPay) items.push({ date: dateLabel, subtitle: `주휴수당 (평균 근로시간: ${d.detail?.totalHours || ""})`, amount: Math.round(d.weeklyHolidayPay * 10000), isBlue: true, dayRef: d });
                if (d.detail?.incentive) items.push({ date: dateLabel, subtitle: "기타 인센티브", amount: d.detail.incentive, isRed: true, dayRef: d });
                return items;
              }).map((item, idx) => (
                <AnimatedPressable key={idx} onPress={() => handleDayClick(item.dayRef)} style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F3F5" }} scaleAmount={0.98} opacityAmount={0.85}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: item.isBlue ? "#4261FF" : item.isRed ? "#FF3D3D" : "#19191B" }}>{item.date}</Text>
                    <Text style={{ fontSize: 12, color: "#AAB4BF", marginTop: 2 }}>{item.subtitle}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: item.isBlue ? "#4261FF" : item.isRed ? "#FF3D3D" : "#19191B" }}>{item.amount.toLocaleString()}원</Text>
                </AnimatedPressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Pay stub tab */}
      {activeTab === "payStub" && (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, backgroundColor: "#F7F7F8", flexGrow: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
            <View style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1, borderColor: "#4261FF", backgroundColor: "#E8F3FF", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>총 {payslips.length}건</Text>
            </View>
          </View>

          <View style={{ gap: 12, paddingHorizontal: 20 }}>
            {payslips.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>발급된 급여명세서가 없어요</Text>
              </View>
            ) : (
              payslips.map((p: any) => {
                const isPublished = !!p.published_at;
                return (
                <AnimatedPressable
                  key={p.id}
                  onPress={() => { if (isPublished) navigation.navigate("EmployeePayStubDetail", { payslipId: p.id }); }}
                  style={{
                    borderRadius: 16, backgroundColor: "#FFFFFF", padding: 20,
                    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
                    opacity: isPublished ? 1 : 0.7,
                  }}
                  scaleAmount={isPublished ? 0.98 : 1}
                  opacityAmount={isPublished ? 0.85 : 1}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 18 }}>📁</Text>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#292B2E" }} numberOfLines={1}>
                        {p.year}년 {p.month}월 급여 명세서
                      </Text>
                      <View style={{
                        paddingHorizontal: 8, height: 20, borderRadius: 4,
                        backgroundColor: isPublished ? "#F7F7F8" : "#FDF9DF",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: isPublished ? "#AAB4BF" : "#FFB300" }}>
                          {isPublished ? "확인 완료" : "지급 예정"}
                        </Text>
                      </View>
                    </View>
                    {isPublished && <ChevronRight size={20} color="#AAB4BF" />}
                  </View>
                  <View style={{ marginTop: 16, gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 14, color: "#93989E" }}>실 지급액</Text>
                      <Text style={{ fontSize: 14, color: "#70737B" }}>{(p.net_pay ?? 0).toLocaleString()}원</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 14, color: "#93989E" }}>기간</Text>
                      <Text style={{ fontSize: 14, color: "#70737B" }}>{p.pay_period_start ?? "-"} - {p.pay_period_end ?? "-"}</Text>
                    </View>
                    {p.pay_date && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 14, color: "#93989E" }}>급여일</Text>
                        <Text style={{ fontSize: 14, color: "#70737B" }}>{p.pay_date}</Text>
                      </View>
                    )}
                  </View>
                </AnimatedPressable>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Day detail bottom sheet */}
      <BottomSheet isOpen={bottomSheetOpen && !!(selectedDay?.detail || selectedDay?.weeklyHolidayPay)} onClose={() => setBottomSheetOpen(false)} showHeader={false}>
        {(selectedDay?.detail || selectedDay?.weeklyHolidayPay) && (() => {
          const hasWeekly = !!selectedDay.weeklyHolidayPay;
          const weeklyAmount = hasWeekly ? Math.round((selectedDay.weeklyHolidayPay || 0) * 10000) : 0;
          const totalAmount = selectedDay.detail!.salary + (selectedDay.detail!.incentive || 0) + weeklyAmount;
          return (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>
                  {calYear}년 {calMonth}월 {selectedDay.date}일 ({selectedDay.dayOfWeek})
                </Text>
                <AnimatedPressable onPress={() => setBottomSheetOpen(false)} hitSlop={8} scaleAmount={0.97} opacityAmount={0.75}>
                  <X size={20} color="#19191B" />
                </AnimatedPressable>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>{selectedDay.detail!.timeRange}</Text>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>{selectedDay.detail!.totalHours}</Text>
                {selectedDay.detail!.overtimeMinutes && (
                  <Text style={{ fontSize: 14, color: "#4261FF" }}>(+{selectedDay.detail!.overtimeMinutes}분)</Text>
                )}
              </View>
              <Text style={{ fontSize: 32, fontWeight: "700", letterSpacing: -0.64, color: "#19191B", marginBottom: 16 }}>
                {totalAmount.toLocaleString()}원
              </Text>
              <View style={{ height: 0.5, backgroundColor: "#AAB4BF", marginBottom: 16 }} />
              <View style={{ gap: 12 }}>
                {(selectedDay.detail?.salary ?? 0) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>기본 급여</Text>
                    <Text style={{ fontSize: 14, color: "#19191B" }}>{(selectedDay.detail!.salary).toLocaleString()}원</Text>
                  </View>
                )}
                {(selectedDay.detail?.overtimePay ?? 0) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>연장수당</Text>
                    <Text style={{ fontSize: 14, color: "#7488FE" }}>{selectedDay.detail!.overtimePay!.toLocaleString()}원</Text>
                  </View>
                )}
                {(selectedDay.detail?.nightPay ?? 0) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>야간수당</Text>
                    <Text style={{ fontSize: 14, color: "#6B4FEC" }}>{selectedDay.detail!.nightPay!.toLocaleString()}원</Text>
                  </View>
                )}
                {(selectedDay.detail?.holidayPay ?? 0) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>휴일수당</Text>
                    <Text style={{ fontSize: 14, color: "#E05C00" }}>{selectedDay.detail!.holidayPay!.toLocaleString()}원</Text>
                  </View>
                )}
                {(selectedDay.detail?.incentive || 0) > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, color: "#AAB4BF" }}>기타 인센티브</Text>
                    <Text style={{ fontSize: 14, color: "#19191B" }}>{(selectedDay.detail!.incentive || 0).toLocaleString()}원</Text>
                  </View>
                )}
                {hasWeekly && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View>
                      <Text style={{ fontSize: 14, color: "#AAB4BF" }}>주휴수당</Text>
                      {selectedDay?.detail?.totalHours ? <Text style={{ fontSize: 12, color: "#AAB4BF" }}>(평균 근로시간: {selectedDay.detail.totalHours})</Text> : null}
                    </View>
                    <Text style={{ fontSize: 14, color: "#4261FF" }}>{weeklyAmount.toLocaleString()}원</Text>
                  </View>
                )}
              </View>
            </>
          );
        })()}
      </BottomSheet>

      {/* Salary info dialog */}
      <Modal visible={salaryInfoOpen} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }} onPress={() => setSalaryInfoOpen(false)}>
          <Pressable style={{ width: "85%", maxWidth: 335, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24 }} onPress={() => {}}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, position: "relative" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Info size={18} color="#AAB4BF" />
                <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>이번 달 예상 급여</Text>
              </View>
              <AnimatedPressable onPress={() => setSalaryInfoOpen(false)} style={{ position: "absolute", right: 0 }} hitSlop={8} scaleAmount={0.97} opacityAmount={0.75}>
                <X size={20} color="#292B2E" />
              </AnimatedPressable>
            </View>
            <Text style={{ fontSize: 15, color: "#70737B", letterSpacing: -0.3, lineHeight: 25, textAlign: "center" }}>
              {effectiveSalaryType === "월급"
                ? `등록된 기본급 기준으로\n이번 달 예상 급여를 보여줘요`
                : effectiveSalaryType === "연봉"
                  ? `등록된 연봉을 12개월로 나눈\n월 환산 금액을 보여줘요`
                  : `매달 1일부터 어제까지\n근무를 기준으로 계산해요\n세금을 공제한 예상 급여를 보여줘요`}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <EmployeeBottomNav activeTab="salary" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

export default EmployeeSalaryScreen;
