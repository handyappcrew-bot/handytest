import React from "react";
import { View, Text } from "react-native";
import PageLayout from "@/components/PageLayout";
import EmptyState from "@/components/EmptyState";
import { useRoute } from "@react-navigation/native";

interface PendingRouteParams {
  title?: string;
  message?: string;
  subMessage?: string;
}

/**
 * 백엔드 미존재 / 합의 보류 항목용 통일 placeholder.
 * 매출 관리, 사장 측 직원별 월간 출퇴근 등 backend 부재 영역.
 */
const PendingScreen: React.FC = () => {
  const route = useRoute();
  const params = (route.params ?? {}) as PendingRouteParams;
  return (
    <PageLayout headerTitle={params.title ?? "준비 중"}>
      <View style={{ flex: 1 }}>
        <EmptyState
          message={params.message ?? "이 화면은 준비 중이에요"}
          subMessage={params.subMessage ?? "백엔드 합의 후 제공돼요"}
        />
      </View>
    </PageLayout>
  );
};

export default PendingScreen;
