import React from "react";
import { View, Text } from "react-native";

const WebViewStub: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5F8" }, style]}>
    <Text style={{ fontSize: 14, color: "#70737B" }}>지도는 앱에서 확인 가능합니다</Text>
  </View>
);

export default WebViewStub;
