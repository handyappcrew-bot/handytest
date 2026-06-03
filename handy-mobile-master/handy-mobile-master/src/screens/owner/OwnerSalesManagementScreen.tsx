import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import { api } from "@/api/client";
import { localStorage } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { DAY_LABELS } from "@/utils/constants";
import type { ScreenProps } from "@/navigation/types";

function formatSales(n: number): string {
  if (n >= 10000) {
    const man = (n / 10000).toFixed(1).replace(/\.0$/, "");
    return `${man}만`;
  }
  return n.toLocaleString();
}

const OwnerSalesManagementScreen: React.FC<ScreenProps<"OwnerSalesManagement">> = ({ navigation }) => {
  const now = new Date();
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [dailySales, setDailySales] = useState<Record<number, { net: number; gross: number }>>({});
  const [totalNet, setTotalNet] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [unreadDays, setUnreadDays] = useState<Set<number>>(new Set());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useFocusEffect(useCallback(() => {
    if (!storeId) return;
    let cancelled = false;
    api.get<any>(`/api/owner/store/${storeId}/sales/monthly`, { year, month: month + 1 })
      .then((res) => {
        if (cancelled) return;
        const daily: Record<number, { net: number; gross: number }> = {};
        Object.entries(res.daily ?? {}).forEach(([k, v]: any) => {
          daily[Number(k)] = { net: v.net ?? 0, gross: v.gross ?? 0 };
        });
        setDailySales(daily);
        setTotalNet(res.total_net ?? 0);
        setTotalGross(res.total_gross ?? 0);
        setReportCount(res.report_count ?? 0);
        setUnreadDays(new Set());
      })
      .catch(() => {
        if (cancelled) return;
        setDailySales({});
        setTotalNet(0);
        setTotalGross(0);
        setReportCount(0);
      });
    return () => { cancelled = true; };
  }, [storeId, year, month]));

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const isToday = (d: number) => isCurrentMonth && today.getDate() === d;
  const isFuture = (d: number) => {
    const cell = new Date(year, month, d);
    const t = new Date(today); t.setHours(0, 0, 0, 0);
    return cell > t;
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; isOutside: boolean }[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isOutside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isOutside: false });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, isOutside: true });
    }
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>매출 관리</Text>
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EBEBEB", paddingHorizontal: 20, gap: 36 }}>
        <View style={{ paddingVertical: 12, position: "relative" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.32, color: "#4261FF" }}>월간 매출</Text>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 99, backgroundColor: "#4261FF" }} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Summary card */}
        <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: "#F0F7FF", borderRadius: 16, padding: 16 }}>
          <View style={{ alignSelf: "flex-start", height: 17, borderRadius: 4, paddingHorizontal: 8, backgroundColor: "#D3DAFF", justifyContent: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#7488FE" }}>
              *{month + 1}월 마감보고 {reportCount}건 기준
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>{month + 1}월 순매출</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#4261FF" }}>
              {totalNet.toLocaleString()}원
            </Text>
          </View>
          <View style={{ height: 0.5, backgroundColor: "#DBDCDF", marginVertical: 12 }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#70737B" }}>총 매출</Text>
            <Text style={{ fontSize: 14, color: "#70737B" }}>
              {totalGross.toLocaleString()}원
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
            <AnimatedPressable
              onPress={() => navigation.navigate("OwnerSalesMonthlyDetail", { year, month: month + 1 })}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              <Text style={{ fontSize: 13, color: "#4261FF", fontWeight: "500" }}>세부 내역 보기</Text>
              <ChevronRight size={14} color="#4261FF" />
            </AnimatedPressable>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 12, backgroundColor: "#F7F7F8", marginTop: 16 }} />

        {/* Month navigation */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
          <AnimatedPressable onPress={prevMonth} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7} style={{ padding: 4 }}>
            <ChevronLeft size={20} color="#19191B" />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { setPickerYear(year); setMonthPickerOpen(true); }}
            scaleAmount={0.95}
            opacityAmount={0.8}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            hitSlop={4}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#19191B" }}>{year}년 {month + 1}월</Text>
            <ChevronDown size={16} color="#9EA3AD" />
          </AnimatedPressable>
          <AnimatedPressable onPress={nextMonth} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7} style={{ padding: 4 }}>
            <ChevronRight size={20} color="#19191B" />
          </AnimatedPressable>
        </View>

        {/* Day headers */}
        <View style={{ flexDirection: "row", paddingHorizontal: 12, marginBottom: 8 }}>
          {DAY_LABELS.map((label, i) => (
            <View key={label} style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: i === 0 ? "#FF5959" : i === 6 ? "#5DB1FF" : "#70737B" }}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ paddingHorizontal: 12 }}>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
              {week.map((cell, ci) => {
                const future = !cell.isOutside && isFuture(cell.day);
                const sales = !cell.isOutside && !future ? dailySales[cell.day] : null;
                const todayCell = isToday(cell.day) && !cell.isOutside;
                const dateColor = cell.isOutside
                  ? "#AAB4BF"
                  : todayCell ? "#FFFFFF"
                  : ci === 0 ? "#FF5959" : ci === 6 ? "#5DB1FF" : "#70737B";

                return (
                  <AnimatedPressable
                    key={ci}
                    onPress={() => {
                      if (cell.isOutside || future) return;
                      const next = new Set(unreadDays);
                      next.delete(cell.day);
                      setUnreadDays(next);
                      navigation.navigate("OwnerSalesDailyDetail", { year, month: month + 1, day: cell.day });
                    }}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                    style={{ flex: 1, minHeight: 72, paddingVertical: 6, alignItems: "center", position: "relative" }}
                  >
                    {/* 미확인 빨간 점 */}
                    {!cell.isOutside && !future && unreadDays.has(cell.day) && (
                      <View style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: "#FF3D3D", zIndex: 1 }} />
                    )}
                    {/* Date number */}
                    <View style={{ height: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <View style={todayCell ? {
                        backgroundColor: "#4261FF", borderRadius: 10,
                        width: 40, height: 22, alignItems: "center", justifyContent: "center",
                      } : { width: 40, height: 22, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 14, fontWeight: todayCell ? "700" : "500", color: dateColor }}>
                          {cell.day}
                        </Text>
                      </View>
                    </View>
                    {/* Sales chips */}
                    {sales && !cell.isOutside && (
                      <View style={{ alignItems: "center", gap: 2 }}>
                        <View style={{ width: 40, height: 17, borderRadius: 4, backgroundColor: "#EEF1FF", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#4261FF" }}>{formatSales(sales.net)}</Text>
                        </View>
                        <View style={{ width: 40, height: 17, borderRadius: 4, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 11, fontWeight: "500", color: "#9EA3AD" }}>{formatSales(sales.gross)}</Text>
                        </View>
                      </View>
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#EEF1FF" }} />
            <Text style={{ fontSize: 11, color: "#4261FF", fontWeight: "500" }}>순매출</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#F7F7F8" }} />
            <Text style={{ fontSize: 11, color: "#9EA3AD", fontWeight: "500" }}>총매출</Text>
          </View>
        </View>
      </ScrollView>

      {/* Month picker modal */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setMonthPickerOpen(false)}
        >
          <Pressable
            style={{ width: 320, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <AnimatedPressable onPress={() => setPickerYear((p) => p - 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronLeft size={20} color="#19191B" />
              </AnimatedPressable>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B" }}>{pickerYear}년</Text>
              <AnimatedPressable onPress={() => setPickerYear((p) => p + 1)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                <ChevronRight size={20} color="#19191B" />
              </AnimatedPressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const isSel = pickerYear === year && i === month;
                return (
                  <AnimatedPressable
                    key={i}
                    onPress={() => {
                      setCurrentDate(new Date(pickerYear, i, 1));
                      setUnreadDays(new Set());
                      setMonthPickerOpen(false);
                    }}
                    scaleAmount={0.95}
                    opacityAmount={0.8}
                    style={{ width: "22%", paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: isSel ? "#4261FF" : "#F7F7F8" }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "500", color: isSel ? "#FFFFFF" : "#19191B" }}>
                      {i + 1}월
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <OwnerBottomNav activeTab="sales" navigation={navigation} />
    </SafeAreaView>
    </FadeScreen>
  );
};

export default OwnerSalesManagementScreen;
