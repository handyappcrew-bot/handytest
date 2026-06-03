import React from "react";
import { View, Text, Pressable, ScrollView, Platform, StatusBar } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

interface PageLayoutProps {
  headerTitle?: string;
  headerRight?: React.ReactNode;
  hideBackButton?: boolean;
  onBack?: () => void;
  scrollable?: boolean;
  progressStep?: { current: number; total: number };
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  headerTitle, headerRight, hideBackButton, onBack, scrollable = true,
  progressStep, title, subtitle, children, footer,
}) => {
  const nav = useNavigation();

  const handleBack = () => {
    if (onBack) onBack();
    else if (nav.canGoBack()) nav.goBack();
  };

  const Body = scrollable ? ScrollView : View;
  const bodyProps = scrollable
    ? { contentContainerStyle: { paddingBottom: 24, flexGrow: 1 }, showsVerticalScrollIndicator: false, style: { flex: 1 } as const }
    : { style: { flex: 1 } as const };

  // headerTitle 모드: web PageHeader 스타일 (h-14, px-4, font-semibold)
  // title 모드: web PageLayout 스타일 (pt-14 공간, 큰 타이틀, 파란 back)
  const isHeaderMode = !!headerTitle;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── 헤더 바 ── */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: isHeaderMode ? (hideBackButton ? 20 : 8) : 16,
        paddingRight: isHeaderMode ? 8 : 16,
        minHeight: isHeaderMode ? 48 : 52,
        paddingTop: isHeaderMode ? 16 : (Platform.OS === "android" ? 16 : 4),
        paddingBottom: isHeaderMode ? 8 : 8,
      }}>
        {!hideBackButton && (
          <Pressable
            onPress={handleBack}
            hitSlop={8}
            style={{
              padding: 4,
              marginLeft: -4,
              marginRight: isHeaderMode ? 8 : 0,
            }}
          >
            <ChevronLeft
              size={isHeaderMode ? 24 : 28}
              strokeWidth={isHeaderMode ? 2 : 2.5}
              color={isHeaderMode ? "#19191B" : "#4261FF"}
            />
          </Pressable>
        )}
        {isHeaderMode && (
          <Text style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#19191B",
            letterSpacing: -0.36,
            flex: 1,
          }}>
            {headerTitle}
          </Text>
        )}
        {isHeaderMode && headerRight ? (
          <View style={{ marginLeft: 8 }}>{headerRight}</View>
        ) : null}
      </View>

      {/* 헤더 구분선 */}
      {isHeaderMode && <View style={{ height: 1, backgroundColor: "#EBEBEB" }} />}

      {/* 진행 표시바 */}
      {progressStep ? (
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingVertical: 8 }}>
          {Array.from({ length: progressStep.total }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 99,
                backgroundColor: i < progressStep.current ? "#4261FF" : "#EBEBEB",
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Body */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Body {...(bodyProps as any)}>
        {(title || subtitle) && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
            {title ? (
              <Text style={{ fontSize: 26, fontWeight: "700", color: "#19191B", letterSpacing: -0.52, lineHeight: 34 }}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={{ fontSize: 15, color: "#70737B", marginTop: 8, lineHeight: 22 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}
        {children}
      </Body>

      {/* Footer */}
      {footer ? (
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 32,
          borderTopWidth: 1,
          borderTopColor: "#EBEBEB",
          backgroundColor: "#FFFFFF",
        }}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
};

export default PageLayout;
