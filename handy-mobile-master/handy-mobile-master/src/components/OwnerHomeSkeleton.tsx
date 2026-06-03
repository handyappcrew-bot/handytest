import React from "react";
import { View } from "react-native";
import SkeletonBlock from "@/components/SkeletonBlock";
import DotsLoader from "@/components/DotsLoader";

const OwnerHomeSkeleton: React.FC = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
    <DotsLoader />
  </View>
);

export default OwnerHomeSkeleton;
