import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { ChevronLeft, Search, MessageSquare, Plus } from "lucide-react-native";
import FocusInput from "@/components/FocusInput";
import AnimatedPressable from "@/components/AnimatedPressable";
import FadeScreen from "@/components/FadeScreen";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import EmployeeBottomNav from "@/components/EmployeeBottomNav";
import OwnerBottomNav from "@/components/OwnerBottomNav";
import { getBoardList, BoardItem } from "@/api/public";
import { localStorage } from "@/utils/storage";
import { API_BASE_URL } from "@/api/client";
import type { ScreenProps } from "@/navigation/types";

const CATEGORIES = ["전체", "공지사항", "건의사항", "비품관리", "대타요청", "일반 게시글"];

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  "공지사항": { bg: "#E8F3FF", color: "#4261FF" },
  "건의사항": { bg: "#ECFFF1", color: "#1EDC83" },
  "비품관리": { bg: "#FDF9DF", color: "#FFB300" },
  "대타요청": { bg: "#FFEAE6", color: "#FF3D3D" },
  "일반 게시글": { bg: "#F7F7F8", color: "#AAB4BF" },
};

const BoardListScreen: React.FC<ScreenProps<"BoardList">> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<BoardItem[]>([]);
  const [filter, setFilter] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);
  const currentRole = localStorage.getItem("currentRole");
  const isResigned = currentRole !== "owner" && localStorage.getItem("employeeWorkingStatus") === "퇴사";

  const load = useCallback(() => {
    if (!storeId) { setLoading(false); return; }
    setError(false);
    getBoardList(storeId)
      .then((rs) => setPosts(rs ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [storeId]);

  useFocusEffect(
    useCallback(() => { load(); }, [load])
  );

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const categoryMatch = filter === "전체" || p.category === filter;
      const searchMatch =
        searchQuery === "" ||
        p.title?.includes(searchQuery) ||
        p.content?.includes(searchQuery);
      return categoryMatch && searchMatch;
    });
  }, [posts, filter, searchQuery]);

  const notices = filtered.filter((p) => p.category === "공지사항");
  const others = filtered.filter((p) => p.category !== "공지사항");

  return (
    <FadeScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>게시판</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          {/* Search bar */}
          <View style={{ position: "relative", marginBottom: 16 }}>
            <FocusInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="게시글 검색"
              placeholderTextColor="#AAB4BF"
              defaultBorderColor="#DBDCDF"
              style={{
                height: 44, borderRadius: 12, borderWidth: 1,
                backgroundColor: "#FFFFFF", paddingLeft: 16, paddingRight: 44,
                fontSize: 14, color: "#19191B",
              }}
            />
            <View style={{ position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" }}>
              <Search size={20} color="#AAB4BF" />
            </View>
          </View>

          {/* Category chips */}
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            {CATEGORIES.map((cat) => {
              const isActive = filter === cat;
              return (
                <AnimatedPressable
                  key={cat}
                  onPress={() => setFilter(cat)}
                  scaleAmount={0.94}
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

          {loading && posts.length === 0 ? (
            <View style={{ paddingTop: 100, alignItems: "center", justifyContent: "center" }}>
              <DotsLoader />
            </View>
          ) : error && posts.length === 0 ? (
            <View style={{ paddingTop: 80, alignItems: "center", justifyContent: "center" }}>
              <ErrorState onRetry={load} compact />
            </View>
          ) : (
            <>
              {/* Notices section */}
              {notices.length > 0 && (filter === "전체" || filter === "공지사항") && (
                <>
                  <Text style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.32, color: "#19191B", marginBottom: 12 }}>공지사항</Text>
                  <View style={{ gap: 12, marginBottom: 24 }}>
                    {notices.map((post) => (
                      <PostCard key={post.id} post={post} onPress={() => navigation.navigate("BoardDetail", { id: post.id })} />
                    ))}
                  </View>
                </>
              )}

              {/* Others section */}
              {others.length > 0 && (
                <>
                  {filter === "전체" && (
                    <Text style={{ fontSize: 16, fontWeight: "700", letterSpacing: -0.32, color: "#19191B", marginBottom: 12 }}>전체 게시글</Text>
                  )}
                  <View style={{ gap: 12 }}>
                    {others.map((post) => (
                      <PostCard key={post.id} post={post} onPress={() => navigation.navigate("BoardDetail", { id: post.id })} />
                    ))}
                  </View>
                </>
              )}

              {filtered.length === 0 && (
                <View style={{ paddingTop: 80, alignItems: "center", justifyContent: "center" }}>
                  <EmptyState message="게시글이 없어요" compact />
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB — 퇴사 직원 비노출 */}
      {!isResigned && (
        <AnimatedPressable
          onPress={() => navigation.navigate("BoardWrite")}
          scaleAmount={0.92}
          opacityAmount={0.75}
          style={{
            position: "absolute", bottom: 90 + insets.bottom, right: 24,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: "#4261FF",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#4261FF", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 2, height: 4 }, elevation: 6,
          }}
        >
          <Plus size={24} color="#FFFFFF" />
        </AnimatedPressable>
      )}

      {currentRole === "owner" ? (
        <OwnerBottomNav activeTab="board" navigation={navigation} />
      ) : (
        <EmployeeBottomNav activeTab="board" navigation={navigation} />
      )}
    </SafeAreaView>
    </FadeScreen>
  );
};

function PostCard({ post, onPress }: { post: BoardItem; onPress: () => void }) {
  const catStyle = CATEGORY_STYLE[post.category] ?? { bg: "#F7F7F8", color: "#AAB4BF" };
  return (
    <AnimatedPressable
      onPress={onPress}
      scaleAmount={0.98}
      opacityAmount={0.85}
      style={{
        borderRadius: 16, backgroundColor: "#FFFFFF", padding: 16,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
      }}
    >
      {/* Title row */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <Text
          style={{ flex: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.3, color: "#19191B", marginRight: 8 }}
          numberOfLines={1}
        >
          {post.title}
        </Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: catStyle.bg, flexShrink: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: "500", letterSpacing: -0.24, color: catStyle.color }}>{post.category}</Text>
        </View>
      </View>

      {/* Content preview */}
      {post.content ? (
        <Text
          style={{ fontSize: 13, color: "#70737B", lineHeight: 19, letterSpacing: -0.26, marginBottom: 12 }}
          numberOfLines={2}
        >
          {post.content}
        </Text>
      ) : null}

      {/* Footer */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {post.role === "owner" ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#E8F3FF" }}>
              <Text style={{ fontSize: 12, color: "#4261FF" }}>사장님</Text>
            </View>
          ) : (
            <>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#F7F7F8" }}>
                <Text style={{ fontSize: 12, color: "#70737B" }}>{post.writer}</Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#F7F7F8" }}>
                <Text style={{ fontSize: 12, color: "#70737B" }}>알바생</Text>
              </View>
            </>
          )}
          <Text style={{ fontSize: 12, color: "#AAB4BF" }}>
            | {new Date(post.created_at).toLocaleDateString("ko-KR")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <MessageSquare size={16} color="#AAB4BF" />
          <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{(post as any).comments ?? post.comment_count ?? 0}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default BoardListScreen;
