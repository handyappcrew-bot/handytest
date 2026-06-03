import { api } from "./client";

// ───────── 게시판 ─────────
export interface BoardItem {
  id: number;
  title: string;
  content?: string;
  category: string;
  writer: string;
  writer_image?: string | null;
  role?: "owner" | "employee";
  created_at: string;
  view_count?: number;
  comment_count?: number;
  thumbnail?: string | null;
}

export const getBoardList = (storeId: number, category?: string) =>
  api.post<BoardItem[]>("/api/common/board", { store_id: storeId, category });

export interface BoardComment {
  id: number;
  writer: string;
  writer_image?: string | null;
  role: "owner" | "employee";
  content: string;
  created_at: string;
  parent_id?: number | null;
  isMyComment?: boolean;
}

export interface BoardDetail extends BoardItem {
  photos?: string[];
  comments?: BoardComment[];
  isMyPost?: boolean;
  currentRole?: "owner" | "employee" | null;
  updated_at?: string | null;
}

export const getBoardDetail = (id: number) =>
  api.get<BoardDetail>(`/api/common/board/${id}`);

export const addBoardPost = (payload: {
  store_id: number;
  category: string;
  title: string;
  content: string;
  images?: { uri: string; name: string; type: string }[];
}) => {
  const fd = new FormData();
  fd.append("store_id", String(payload.store_id));
  fd.append("category", payload.category);
  fd.append("title", payload.title);
  fd.append("content", payload.content);
  if (payload.images?.length) {
    payload.images.forEach((img) => fd.append("images", img as unknown as Blob));
  }
  return api.postForm<{ id: number }>("/api/common/board/add", fd);
};

export const deleteBoard = (id: number) =>
  api.delete(`/api/common/board/${id}`);

export const modifyBoardPost = (payload: {
  board_id: number;
  category: string;
  title: string;
  content: string;
  existing_images?: string[];
  images?: { uri: string; name: string; type: string }[];
}) => {
  const fd = new FormData();
  fd.append("board_id", String(payload.board_id));
  fd.append("category", payload.category);
  fd.append("title", payload.title);
  fd.append("content", payload.content);
  fd.append("existing_images", JSON.stringify(payload.existing_images ?? []));
  fd.append("clear_images", payload.images?.length === 0 && !payload.existing_images?.length ? "true" : "false");
  if (payload.images?.length) {
    payload.images.forEach((img) => fd.append("images", img as unknown as Blob));
  }
  return api.postForm<{ id: number }>("/api/common/board/modify", fd);
};

export const addComment = (boardId: number, content: string, parentId?: number) =>
  api.post<{ id: number }>(`/api/common/board/${boardId}/comment`, { content, parent_id: parentId });

export const deleteComment = (commentId: number) =>
  api.delete(`/api/common/board/comment/${commentId}`);

export interface BoardViewer {
  name: string;
  role: "owner" | "employee";
  viewed_at: string;
}
export const getBoardViewers = (boardId: number) =>
  api.get<BoardViewer[]>(`/api/common/board/${boardId}/viewers`);

// ───────── 알림 ─────────
export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  created_at: string;
  payload?: Record<string, unknown>;
}

export const getNotifications = (read: boolean = true, storeId?: number) =>
  api.get<NotificationItem[]>("/api/common/notification", { read, store_id: storeId });

export const markNotificationRead = (id: number) =>
  api.patch(`/api/common/notification/${id}/read`);

export const deleteNotification = (id: number) =>
  api.delete(`/api/common/notification/${id}`);

// ───────── 서비스 공지 ─────────
export interface NoticeItem {
  id: number;
  title: string;
  content?: string;
  created_at: string;
  images?: string[];
}
export const getNotices = () => api.get<NoticeItem[]>("/api/common/notice");
export const getNoticeDetail = (id: number) => api.get<NoticeItem>(`/api/common/notice/${id}`);

// ───────── FAQ ─────────
export interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
}
export const getFAQ = () => api.get<FaqItem[]>("/api/common/faq");

// ───────── 건의함 ─────────
export interface FeedbackItem {
  id: number;
  title: string;
  content: string;
  status: "pending" | "answered";
  created_at: string;
  answer?: string | null;
  answered_at?: string | null;
}
export const getFeedbacks = () => api.get<FeedbackItem[]>("/api/common/feedback");

export const postFeedback = (payload: {
  title: string;
  content: string;
  images?: { uri: string; name: string; type: string }[];
}) => {
  const fd = new FormData();
  fd.append("title", payload.title);
  fd.append("content", payload.content);
  if (payload.images?.length) {
    payload.images.forEach((img) => fd.append("images", img as unknown as Blob));
  }
  return api.postForm("/api/common/feedback", fd);
};

// ───────── 비밀번호 / 탈퇴 ─────────
export const changePassword = (oldPassword: string, newPassword: string) =>
  api.post("/api/common/password/change", { old_password: oldPassword, new_password: newPassword });

export const withdrawAccount = (memberId: number, reason: string) =>
  api.post("/api/common/withdrawal", { member_id: memberId, reason });

// 인증 측 회원 탈퇴 (소프트 삭제)
export const withdrawAuth = (reason: string) =>
  api.delete("/api/auth/withdrawal", { reason });

// ───────── 약관 ─────────
export interface TermsSection { heading: string; body: string; }
export interface TermsResponse {
  type: string;
  version: string;
  title: string;
  sections: TermsSection[];
  activated_at: string | null;
}

export const getTerms = (type: "service" | "privacy" | "thirdParty" | "location") =>
  api.get<TermsResponse>("/api/common/terms", { type });
