import React from "react";
import { View, Text, Pressable } from "react-native";
import { recordError } from "@/utils/crashlytics";

interface State { hasError: boolean; }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    recordError(error, info.componentStack ?? "ErrorBoundary");
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", marginBottom: 8 }}>
          앱에 문제가 발생했어요
        </Text>
        <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center", marginBottom: 24 }}>
          잠시 후 다시 시도해주세요
        </Text>
        <Pressable
          onPress={() => this.setState({ hasError: false })}
          style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: "#4261FF" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
}
