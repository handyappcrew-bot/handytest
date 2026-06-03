import {
  Inbox, Bell, FileText, MessageSquare, MessageCircle, Megaphone, Clock, Calendar,
  FileEdit, Users, UserPlus, Receipt, SearchX, Eye, HelpCircle, Palmtree,
} from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";

interface EmptyStateProps {
  message: string;
  subMessage?: string;
  icon?: React.ReactNode;
  compact?: boolean;
}

const pickIconType = (m: string) => {
  if (m.includes("찾을 수 없")) return SearchX;
  if (m.includes("조회한") || m.includes("조회자")) return Eye;
  if (m.includes("질문")) return HelpCircle;
  if (m.includes("댓글")) return MessageSquare;
  if (m.includes("공지")) return Megaphone;
  if (m.includes("알림")) return Bell;
  if (m.includes("가입 요청") || m.includes("가입요청")) return UserPlus;
  if (m.includes("변경 요청") || m.includes("수정 요청") || m.includes("건의 요청") || m.includes("요청 내역")) return FileEdit;
  if (m.includes("게시글")) return FileText;
  if (m.includes("휴가")) return Palmtree;
  if (m.includes("급여") || m.includes("명세서")) return Receipt;
  if (m.includes("직원")) return Users;
  if (m.includes("근무") || m.includes("일정")) return Calendar;
  if (m.includes("출근") || m.includes("근태")) return Clock;
  if (m.includes("건의")) return MessageCircle;
  return Inbox;
};

const EmptyState: React.FC<EmptyStateProps> = ({ message, subMessage, icon, compact = false }) => {
  const IconCmp = !icon ? pickIconType(message) : null;
  const size = compact ? 44 : 56;
  const iconSize = compact ? 22 : 28;
  return (
    <View
      style={{
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        paddingVertical: compact ? 40 : 80,
        gap: 12,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#F7F7F8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon ?? (IconCmp ? <IconCmp size={iconSize} color="#AAB4BF" strokeWidth={1.6} /> : null)}
      </View>
      <Text
        style={{
          fontSize: compact ? 13 : 14,
          fontWeight: "500",
          color: "#9EA3AD",
          letterSpacing: -0.28,
          textAlign: "center",
          lineHeight: compact ? 19 : 21,
        }}
      >
        {message}
      </Text>
      {subMessage ? (
        <Text
          style={{
            fontSize: 12,
            color: "#AAB4BF",
            letterSpacing: -0.24,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          {subMessage}
        </Text>
      ) : null}
    </View>
  );
};

export default EmptyState;
