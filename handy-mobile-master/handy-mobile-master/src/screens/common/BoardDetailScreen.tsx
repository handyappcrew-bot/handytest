import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView, Pressable, Image, TextInput, Platform, Keyboard } from "react-native";
import { ChevronLeft, MoreVertical, Pencil, Send, MessageSquare, Trash2, Eye, X, CornerDownRight, MessageCircle } from "lucide-react-native";
import AnimatedPressable from "@/components/AnimatedPressable";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import DotsLoader from "@/components/DotsLoader";
import PopoverMenu, { PopoverMenuItem } from "@/components/PopoverMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { getBoardDetail, addComment, deleteBoard, deleteComment, getBoardViewers, BoardDetail, BoardComment } from "@/api/public";
import { API_BASE_URL } from "@/api/client";
import { localStorage } from "@/utils/storage";
import Avatar from "@/components/Avatar";
import BottomSheet from "@/components/BottomSheet";
import type { ScreenProps } from "@/navigation/types";

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  "공지사항": { bg: "#E8F3FF", color: "#4261FF" },
  "건의사항": { bg: "#ECFFF1", color: "#1EDC83" },
  "비품관리": { bg: "#FDF9DF", color: "#FFB300" },
  "대타요청": { bg: "#FFEAE6", color: "#FF3D3D" },
  "일반 게시글": { bg: "#F7F7F8", color: "#AAB4BF" },
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const BoardDetailScreen: React.FC<ScreenProps<"BoardDetail">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const [post, setPost] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postMenu, setPostMenu] = useState<{ x: number; y: number } | null>(null);
  const [commentMenu, setCommentMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const [deletePostConfirm, setDeletePostConfirm] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<BoardComment | null>(null);
  const [viewerSheetOpen, setViewerSheetOpen] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(56);

  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    getBoardDetail(id).then(setPost).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useFocusEffect(useCallback(() => { load(); }, [id]));

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => { setKeyboardHeight(e.endCoordinates.height); setKeyboardVisible(true); });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => { setKeyboardHeight(0); setKeyboardVisible(false); });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleAddComment = async () => {
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(id, comment.trim(), replyTo?.id ?? undefined);
      setReplyTo(null);
      toast({ description: "댓글이 등록되었어요." });
      setComment("");
      load();
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "댓글 등록에 실패했어요.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    try {
      await deleteBoard(id);
      toast({ description: "게시글이 삭제되었어요." });
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate(localStorage.getItem("currentRole") === "owner" ? "OwnerHome" : "EmployeeHome");
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "게시글 삭제에 실패했어요.", variant: "destructive" });
    }
  };

  const handleOpenViewers = async () => {
    try {
      const data = await getBoardViewers(id);
      setViewers(data);
      setViewerSheetOpen(true);
    } catch {
      toast({ description: "조회자 목록을 불러오지 못했어요.", variant: "destructive" });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    setCommentMenu(null);
    try {
      await deleteComment(commentId);
      toast({ description: "댓글이 삭제되었어요." });
      load();
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : "댓글 삭제에 실패했어요.", variant: "destructive" });
    }
  };

  if (loading && !post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
        <DotsLoader />
      </SafeAreaView>
    );
  }
  if (error && !post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
        <ErrorState onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
        <EmptyState message="게시글을 찾을 수 없어요" />
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_STYLE[post.category] ?? { bg: "#F7F7F8", color: "#AAB4BF" };
  const isOwner = localStorage.getItem("currentRole") === "owner";
  const isResigned = !isOwner && localStorage.getItem("employeeWorkingStatus") === "퇴사";
  const currentUserName = localStorage.getItem("currentUserName") ?? "";
  const isMyPost = post.isMyPost ?? (currentUserName !== "" && post.writer === currentUserName);
  const canDeletePost = isMyPost || isOwner;

  const displayDate = post.created_at
    ? post.created_at.split("T")[0].replace(/-/g, ".")
    : "";
  const isEdited = !!post.updated_at && post.updated_at !== post.created_at;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8" }} edges={["top"]}>
      {/* Header */}
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
        <Pressable onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate(isOwner ? "OwnerHome" : "EmployeeHome"); }} style={{ padding: 4 }} hitSlop={8}>
          <ChevronLeft size={24} color="#19191B" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>게시글 상세</Text>
      </View>
      <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />

      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: isResigned ? 20 + insets.bottom : 80 + (keyboardVisible ? keyboardHeight : insets.bottom) }}>
          {/* Post card */}
          <View style={{
            borderRadius: 16, backgroundColor: "#FFFFFF", padding: 16, marginBottom: 12,
            shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
          }}>
            {/* Category badge */}
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: cat.bg, alignSelf: "flex-start", marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: cat.color }}>{post.category}</Text>
            </View>

            {/* Author row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={post.writer} imageUrl={post.writer_image} size={44} />
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {post.role === "owner" ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#E8F3FF" }}>
                        <Text style={{ fontSize: 12, color: "#4261FF" }}>사장님</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={{ fontSize: 15, fontWeight: "600", letterSpacing: -0.3, color: "#19191B" }}>{post.writer}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#F7F7F8" }}>
                          <Text style={{ fontSize: 12, color: "#70737B" }}>알바생</Text>
                        </View>
                      </>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{displayDate}</Text>
                    {isEdited && <Text style={{ fontSize: 12, color: "#AAB4BF" }}>(수정됨)</Text>}
                  </View>
                </View>
              </View>

              {canDeletePost && (
                <AnimatedPressable
                  onPress={(e) => { const { pageX, pageY } = e.nativeEvent as any; setPostMenu({ x: pageX, y: pageY }); }}
                  scaleAmount={0.88}
                  opacityAmount={0.7}
                  style={{ padding: 4 }}
                  hitSlop={8}
                >
                  <MoreVertical size={20} color="#70737B" />
                </AnimatedPressable>
              )}
            </View>

            {/* Title */}
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 12, letterSpacing: -0.36 }}>
              {post.title}
            </Text>

            {/* Content */}
            <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 22, letterSpacing: -0.28, marginBottom: 16 }}>
              {post.content}
            </Text>

            {/* Photos horizontal scroll */}
            {post.photos && post.photos.length > 0 && (
              <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} horizontal contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {post.photos.map((p, i) => (
                  <Image
                    key={i}
                    source={{ uri: `${API_BASE_URL}${p}` }}
                    style={{ width: 180, height: 220, borderRadius: 12, flexShrink: 0 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}

            {/* Comment count + view count */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MessageSquare size={16} color="#AAB4BF" />
                <Text style={{ fontSize: 13, color: "#AAB4BF" }}>{post.comment_count ?? 0}</Text>
              </View>
              {isOwner && (
                <AnimatedPressable onPress={handleOpenViewers} scaleAmount={0.97} opacityAmount={0.8} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Eye size={16} color="#AAB4BF" />
                  <Text style={{ fontSize: 13, color: "#AAB4BF" }}>{(post as any).view_count ?? 0}</Text>
                </AnimatedPressable>
              )}
            </View>
          </View>

          {/* Comments card */}
          <View style={{
            borderRadius: 16, backgroundColor: "#FFFFFF", padding: 16,
            shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 2, height: 2 }, elevation: 2,
          }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", marginBottom: 16 }}>
              댓글 {post.comment_count ?? post.comments?.length ?? 0}
            </Text>

            {(!post.comments || post.comments.length === 0) ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: "#AAB4BF" }}>등록된 댓글이 없어요.</Text>
              </View>
            ) : (
              <View>
                {(() => {
                  // Build tree: root comments + replies
                  const roots = post.comments!.filter((c) => !c.parent_id);
                  const getReplies = (parentId: number) =>
                    post.comments!.filter((c) => c.parent_id === parentId);
                  return roots.map((c: BoardComment) => (
                    <View key={c.id}>
                      {/* Root comment */}
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F7F7F8" }}>
                        <Avatar name={c.writer} imageUrl={c.writer_image} size={40} style={{ flexShrink: 0 }} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>{c.writer}</Text>
                              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: c.role === "owner" ? "#E8F3FF" : "#F7F7F8" }}>
                                <Text style={{ fontSize: 11, color: c.role === "owner" ? "#4261FF" : "#70737B" }}>{c.role === "owner" ? "사장님" : "알바생"}</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{formatTime(c.created_at)}</Text>
                              <AnimatedPressable onPress={(e) => { const { pageX, pageY } = e.nativeEvent as any; setCommentMenu({ id: c.id, x: pageX, y: pageY }); }} scaleAmount={0.88} opacityAmount={0.7} hitSlop={4}>
                                <MoreVertical size={16} color="#9EA3AD" />
                              </AnimatedPressable>
                            </View>
                          </View>
                          <AnimatedPressable onPress={() => setReplyTo(c)} scaleAmount={0.98} opacityAmount={0.85}>
                            <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 20 }}>{c.content}</Text>
                          </AnimatedPressable>
                        </View>
                      </View>
                      {/* Replies */}
                      {getReplies(c.id).map((reply) => (
                        <View key={reply.id} style={{ flexDirection: "row", alignItems: "flex-start", paddingLeft: 24, paddingVertical: 10, backgroundColor: "rgba(247,247,248,0.5)" }}>
                          <CornerDownRight size={16} color="#AAB4BF" style={{ marginTop: 12, flexShrink: 0 }} />
                          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, marginLeft: 8 }}>
                            <Avatar name={reply.writer} imageUrl={reply.writer_image} size={36} style={{ flexShrink: 0 }} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }}>{reply.writer}</Text>
                                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: reply.role === "owner" ? "#E8F3FF" : "#F7F7F8" }}>
                                    <Text style={{ fontSize: 11, color: reply.role === "owner" ? "#4261FF" : "#70737B" }}>{reply.role === "owner" ? "사장님" : "알바생"}</Text>
                                  </View>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{formatTime(reply.created_at)}</Text>
                                  <AnimatedPressable onPress={(e) => { const { pageX, pageY } = e.nativeEvent as any; setCommentMenu({ id: reply.id, x: pageX, y: pageY }); }} scaleAmount={0.88} opacityAmount={0.7} hitSlop={4}>
                                    <MoreVertical size={16} color="#9EA3AD" />
                                  </AnimatedPressable>
                                </View>
                              </View>
                              <Text style={{ fontSize: 14, color: "#70737B", lineHeight: 20 }}>{reply.content}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ));
                })()}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Comment input — 퇴사 직원 비노출 */}
        {!isResigned && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: keyboardVisible ? keyboardHeight : insets.bottom, borderTopWidth: 1, borderTopColor: "#EBEBEB", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: "#FFFFFF" }}>
          {replyTo && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: "#4261FF", fontWeight: "500" }}>{replyTo.writer}님에게 답글 작성 중</Text>
              <AnimatedPressable onPress={() => setReplyTo(null)} scaleAmount={0.88} opacityAmount={0.7} hitSlop={8}>
                <X size={16} color="#9EA3AD" />
              </AnimatedPressable>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={replyTo ? "답글 입력하기" : "댓글 입력하기"}
              placeholderTextColor="#AAB4BF"
              style={{
                flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: inputFocused ? "#4261FF" : "#DBDCDF",
                paddingHorizontal: 16, fontSize: 14, color: "#19191B", backgroundColor: "#FFFFFF",
              }}
            />
            <AnimatedPressable
              onPress={() => { if (comment.trim() && !submitting) handleAddComment(); }}
              scaleAmount={0.97}
              opacityAmount={0.75}
              style={{
                width: 44, height: 44, alignItems: "center", justifyContent: "center",
              }}
            >
              <Send size={20} color={comment.trim() ? "#4261FF" : "#9EA3AD"} />
            </AnimatedPressable>
          </View>
        </View>
        )}
      </View>

      {/* 게시글 팝오버 메뉴 */}
      {/* 게시글 팝오버 메뉴 */}
      <PopoverMenu visible={!!postMenu} onClose={() => setPostMenu(null)} x={postMenu?.x ?? 0} y={postMenu?.y ?? 0}>
        {isMyPost && (
          <PopoverMenuItem
            label="게시글 수정"
            icon={<Pencil size={16} color="#9EA3AD" />}
            separator
            onPress={() => {
              setPostMenu(null);
              navigation.navigate("BoardWrite", {
                editPost: { id: post.id, category: post.category, title: post.title, content: post.content ?? "", photos: post.photos ?? [] },
              });
            }}
          />
        )}
        {canDeletePost && (
          <PopoverMenuItem
            label="게시글 삭제"
            icon={<Trash2 size={16} color="#9EA3AD" />}
            danger
            onPress={() => { setPostMenu(null); setDeletePostConfirm(true); }}
          />
        )}
      </PopoverMenu>

      {/* 댓글 팝오버 메뉴 */}
      {(() => {
        const targetComment = post.comments?.find((c) => c.id === commentMenu?.id);
        const canDelete = targetComment ? (targetComment.isMyComment || isOwner) : false;
        return (
          <PopoverMenu visible={!!commentMenu} onClose={() => setCommentMenu(null)} x={commentMenu?.x ?? 0} y={commentMenu?.y ?? 0}>
            <PopoverMenuItem
              label="답글달기"
              icon={<MessageCircle size={16} color="#9EA3AD" />}
              separator={canDelete}
              onPress={() => { setCommentMenu(null); if (targetComment) setReplyTo(targetComment); }}
            />
            {canDelete && (
              <PopoverMenuItem
                label="삭제하기"
                icon={<Trash2 size={16} color="#9EA3AD" />}
                onPress={() => { setDeleteCommentId(commentMenu?.id ?? null); setCommentMenu(null); }}
              />
            )}
          </PopoverMenu>
        );
      })()}

      {/* 게시글 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        visible={deletePostConfirm}
        onClose={() => setDeletePostConfirm(false)}
        title="게시글 삭제"
        description={"해당 게시글을 삭제하시겠어요?\n삭제 시 복구가 불가해요"}
        buttons={[
          { label: "취소", variant: "cancel", onPress: () => setDeletePostConfirm(false) },
          { label: "삭제하기", variant: "confirm", onPress: () => { setDeletePostConfirm(false); handleDeletePost(); } },
        ]}
      />

      {/* 댓글 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        visible={deleteCommentId != null}
        onClose={() => setDeleteCommentId(null)}
        title="댓글 삭제"
        description="댓글을 삭제하시겠어요?"
        buttons={[
          { label: "취소", variant: "cancel", onPress: () => setDeleteCommentId(null) },
          { label: "삭제하기", variant: "confirm", onPress: () => { if (deleteCommentId != null) handleDeleteComment(deleteCommentId); } },
        ]}
      />

      {/* 조회자 목록 바텀시트 */}
      <BottomSheet isOpen={viewerSheetOpen} onClose={() => setViewerSheetOpen(false)} title="조회자 목록">
        {viewers.length === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#AAB4BF" }}>아직 조회한 사람이 없어요</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {viewers.map((v, i) => {
              const roleLabel = v.role === "owner" ? "사장님" : "알바생";
              const d = new Date(v.viewed_at);
              const timeStr = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: "#19191B" }}>{v.name} ({roleLabel})</Text>
                  <Text style={{ fontSize: 12, color: "#AAB4BF" }}>{timeStr} 읽음</Text>
                </View>
              );
            })}
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
};

export default BoardDetailScreen;
