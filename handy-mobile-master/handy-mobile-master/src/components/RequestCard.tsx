import React from "react";
import { View, Text } from "react-native";
import PrimaryButton, { ButtonRow } from "./PrimaryButton";

export interface RequestCardSection {
  /** "기존 일정" / "변경 일정" 등 섹션 타이틀 (선택) */
  innerLabel?: string;
  /** 박스 배경 색 톤 — 'gray' (기존) | 'blue' (변경/희망) */
  tone: "gray" | "blue";
  text: string;
  /** 추가 라인 (예: "[휴게] 30분") */
  extra?: string;
}

interface RequestCardProps {
  /** 좌측 상단 배지 (예: 출·퇴근 시간 변경 / 대기중 / 일정 변경 요청) */
  badges: { label: string; bg: string; color: string }[];
  /** 우측 상단 보조 텍스트 (시간 등) */
  rightText?: string;
  /** 우측 액션 (예: 휴지통 버튼) */
  rightSlot?: React.ReactNode;
  /** "요청 직원" 등 메타 영역 */
  meta?: { label: string; value: string }[];
  /** "변경 요청 사항" 라벨 */
  sectionsLabel?: string;
  /** 일정/요청 박스들 */
  sections?: RequestCardSection[];
  /** "요청 사유" */
  reasonLabel?: string;
  reason?: string;
  /** 사장용 액션 (승인/거절). 직원용 카드에는 미사용. */
  onReject?: () => void;
  onApprove?: () => void;
  /** 사장의 처리 시 라벨 */
  rejectLabel?: string;
  approveLabel?: string;
}

/**
 * 요청 류 화면 (사장 근태 건의/일정 변경 + 직원 요청 내역) 통일 카드 UI
 */
const RequestCard: React.FC<RequestCardProps> = ({
  badges, rightText, rightSlot, meta, sectionsLabel, sections, reasonLabel, reason,
  onReject, onApprove, rejectLabel = "거절하기", approveLabel = "승인하기",
}) => {
  const hasActions = !!(onReject || onApprove);

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 2, height: 2 },
        elevation: 2,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 16, paddingBottom: hasActions ? 0 : 16 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {badges.map((b, i) => (
              <View
                key={i}
                style={{
                  paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                  backgroundColor: b.bg, alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: b.color }}>{b.label}</Text>
              </View>
            ))}
          </View>
          {rightSlot ?? (
            rightText ? (
              <Text style={{ fontSize: 12, fontWeight: "500", color: "#AAB4BF", letterSpacing: -0.24 }}>{rightText}</Text>
            ) : null
          )}
        </View>

        {/* Meta */}
        {meta?.map((m, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 2 }}>{m.label}</Text>
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{m.value}</Text>
          </View>
        ))}

        {/* Sections (기존 일정 / 변경 일정 등) */}
        {sections && sections.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            {sectionsLabel ? (
              <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 8 }}>{sectionsLabel}</Text>
            ) : null}
            {sections.map((s, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: s.tone === "blue" ? "#F0F7FF" : "#F7F7F8",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: i < sections.length - 1 ? 8 : 0,
                }}
              >
                {s.innerLabel ? (
                  <Text style={{ fontSize: 13, fontWeight: "600", color: s.tone === "blue" ? "#4261FF" : "#9EA3AD", marginBottom: 4 }}>
                    {s.innerLabel}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{s.text}</Text>
                {s.extra ? (
                  <Text style={{ fontSize: 13, color: s.tone === "blue" ? "#70737B" : "#70737B", marginTop: 2 }}>{s.extra}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Reason */}
        {reasonLabel || reason ? (
          <View style={{ marginBottom: hasActions ? 14 : 0 }}>
            {reasonLabel ? <Text style={{ fontSize: 14, color: "#70737B", marginBottom: 2 }}>{reasonLabel}</Text> : null}
            {reason ? (
              <Text style={{ fontSize: 15, fontWeight: "500", color: "#19191B" }}>{reason}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Actions */}
      {hasActions && (
        <>
          <View style={{ height: 1, backgroundColor: "#EBEBEB", marginHorizontal: 16 }} />
          <View style={{ padding: 16 }}>
            <ButtonRow
              cancelLabel={rejectLabel}
              confirmLabel={approveLabel}
              onCancel={onReject}
              onConfirm={onApprove}
              ratio={[1, 1]}
            />
          </View>
        </>
      )}
    </View>
  );
};

export default RequestCard;
