import "./global.css";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "@/navigation/RootNavigator";
import { ToastProvider } from "@/components/Toast";
import { NavToastProvider } from "@/components/NavToast";
import { injectWebStyles } from "@/utils/injectWebStyles";
import { initNotificationHandler } from "@/utils/push";
import ErrorBoundary from "@/components/ErrorBoundary";

injectWebStyles();

// 웹에서 SafeAreaProvider가 인식할 기본 inset (상단 노치 영역 모방)
const WEB_INSETS = Platform.OS === "web"
  ? { insets: { top: 20, right: 0, bottom: 0, left: 0 }, frame: { x: 0, y: 0, width: 430, height: 844 } }
  : undefined;

export default function App() {
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    initNotificationHandler();
  }, []);

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: isWeb ? "#F0F0F2" : "#FFFFFF",
        ...(isWeb ? { alignItems: "center" } : {}),
      }}
    >
      {/* 웹: 430px 중앙 컨테이너 */}
      <View
        style={
          isWeb
            ? {
                flex: 1,
                width: "100%",
                maxWidth: 430,
                overflow: "hidden",
                backgroundColor: "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 0 },
                elevation: 8,
              }
            : { flex: 1 }
        }
      >
        <SafeAreaProvider initialMetrics={WEB_INSETS}>
          <ErrorBoundary>
            <ToastProvider>
              <NavToastProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavToastProvider>
            </ToastProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}
