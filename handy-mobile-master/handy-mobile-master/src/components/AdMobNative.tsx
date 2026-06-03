import React, { useState } from "react";
import { Platform, View, Text } from "react-native";
import NativeAdView, {
  HeadlineView,
  TaglineView,
  IconView,
  CallToActionView,
  AdvertiserView,
} from "react-native-google-mobile-ads";

const AD_UNIT_ID = Platform.select({
  ios: "ca-app-pub-2835570189350834/6040048322",
  android: "ca-app-pub-2835570189350834/2187747464",
}) as string;

const AdMobNative: React.FC = () => {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <NativeAdView
        adUnitId={AD_UNIT_ID}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
        style={{ opacity: loaded ? 1 : 0, height: loaded ? undefined : 0 }}
      >
        <View style={{
          borderRadius: 16,
          backgroundColor: "#F4F5F8",
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}>
          <IconView style={{ width: 44, height: 44, borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 3 }}>
            <HeadlineView style={{ fontSize: 14, fontWeight: "600", color: "#19191B" }} />
            <TaglineView style={{ fontSize: 12, color: "#70737B" }} numberOfLines={1} />
            <AdvertiserView style={{ fontSize: 11, color: "#AAB4BF" }} />
          </View>
          <CallToActionView
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: "#4261FF",
              alignItems: "center",
              justifyContent: "center",
            }}
            textStyle={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}
          />
        </View>
      </NativeAdView>

      {/* 광고 로드 전 플레이스홀더 */}
      {!loaded && (
        <View style={{ borderRadius: 16, backgroundColor: "#F4F5F8", height: 72, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 12, color: "#C8CDD6" }}>광고 불러오는 중...</Text>
        </View>
      )}
    </View>
  );
};

export default AdMobNative;
