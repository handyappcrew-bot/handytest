import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { ChevronLeft, ChevronDown } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFAQ, FaqItem } from "@/api/public";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import type { ScreenProps } from "@/navigation/types";

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  "멤버십": { bg: "#F0F7FF", color: "#4261FF" },
  "계정": { bg: "#ECFFF1", color: "#1EDC83" },
  "서비스이용": { bg: "#FDF9DF", color: "#FFB300" },
  "기타": { bg: "#F7F7F8", color: "#AAB4BF" },
};

const FAQScreen: React.FC<ScreenProps<"FAQ">> = ({ navigation }) => {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [filter, setFilter] = useState("전체");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    getFAQ()
      .then((rs) => setItems(rs ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category)));
    return ["전체", ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "전체") return items;
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <AnimatedPressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
          <ChevronLeft size={24} color="#19191B" />
        </AnimatedPressable>
        <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: "#19191B" }}>자주 묻는 질문</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      {/* Background area */}
      <View style={{ flex: 1, backgroundColor: "#F7F7F8" }}>
        {/* Category chips */}
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          horizontal
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}
        >
          {categories.map((cat) => {
            const isActive = filter === cat;
            return (
              <AnimatedPressable
                key={cat}
                onPress={() => { setFilter(cat); setExpandedIdx(null); }}
                scaleAmount={0.97}
                opacityAmount={0.8}
                style={{
                  borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: isActive ? "#4261FF" : "#DBDCDF",
                  backgroundColor: isActive ? "#E8F3FF" : "#FFFFFF",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "500", letterSpacing: -0.26, color: isActive ? "#4261FF" : "#AAB4BF" }}>
                  {cat}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/* FAQ items */}
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}>
          {loading ? (
            <View style={{ paddingTop: 120, alignItems: "center" }}>
              <DotsLoader />
            </View>
          ) : error ? (
            <View style={{ paddingTop: 80, alignItems: "center" }}>
              <ErrorState onRetry={load} compact />
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ paddingTop: 80, alignItems: "center" }}>
              <EmptyState message="해당 카테고리의 질문이 없어요" compact />
            </View>
          ) : (
            filtered.map((q, i) => {
              const isOpen = expandedIdx === i;
              const catStyle = CATEGORY_COLORS[q.category] ?? { bg: "#F7F7F8", color: "#AAB4BF" };
              return (
                <View
                  key={i}
                  style={{
                    borderRadius: 16, overflow: "hidden", backgroundColor: "#FFFFFF",
                    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
                  }}
                >
                  {/* Question row */}
                  <AnimatedPressable
                    onPress={() => setExpandedIdx(isOpen ? null : i)}
                    scaleAmount={0.98}
                    opacityAmount={0.85}
                    style={{
                      flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
                      padding: 16,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      {/* Category badge */}
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: catStyle.bg, alignSelf: "flex-start", marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: "500", letterSpacing: -0.22, color: catStyle.color }}>
                          {q.category}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: -0.28, color: "#19191B", lineHeight: 21 }}>
                        Q. {q.question}
                      </Text>
                    </View>
                    <ChevronDown
                      size={20}
                      color="#AAB4BF"
                      style={{ marginTop: 4, transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                    />
                  </AnimatedPressable>

                  {/* Answer panel */}
                  {isOpen && (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
                      <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 24, letterSpacing: -0.28, paddingTop: 12 }}>
                        {q.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

    </SafeAreaView>
  );
};

export default FAQScreen;
