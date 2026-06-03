import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { SearchX } from "lucide-react-native";
import PrimaryButton from "@/components/PrimaryButton";

const NotFoundScreen: React.FC = () => {
  const nav = useNavigation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 16 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
          <SearchX size={40} color="#AAB4BF" strokeWidth={1.6} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#19191B", textAlign: "center" }}>
          페이지를 찾을 수 없어요
        </Text>
        <Text style={{ fontSize: 14, color: "#70737B", textAlign: "center" }}>
          요청하신 화면이 존재하지 않거나 이동되었어요.
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <PrimaryButton label="뒤로 가기" onPress={() => nav.canGoBack() ? nav.goBack() : nav.navigate("Login" as never)} />
      </View>
    </SafeAreaView>
  );
};

export default NotFoundScreen;
