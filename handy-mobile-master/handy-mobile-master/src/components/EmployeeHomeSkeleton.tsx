import React from "react";
import { View } from "react-native";
import SkeletonBlock from "@/components/SkeletonBlock";

const EmployeeHomeSkeleton: React.FC = () => (
  <View style={{ flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 20 }}>
    {/* Header */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 20, paddingBottom: 16 }}>
      <SkeletonBlock width={120} height={24} borderRadius={8} delay={0} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SkeletonBlock width={32} height={32} borderRadius={16} delay={50} />
        <SkeletonBlock width={32} height={32} borderRadius={16} delay={100} />
      </View>
    </View>

    {/* Date row */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <SkeletonBlock width={160} height={18} borderRadius={6} delay={100} />
      <SkeletonBlock width={48} height={28} borderRadius={8} delay={150} />
    </View>

    {/* Attendance card */}
    <View style={{ backgroundColor: "#F7F7F8", borderRadius: 20, padding: 20, marginBottom: 16 }}>
      <SkeletonBlock width={100} height={16} borderRadius={6} delay={150} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="100%" height={8} borderRadius={4} delay={200} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SkeletonBlock width="48%" height={44} borderRadius={12} delay={250} />
        <SkeletonBlock width="48%" height={44} borderRadius={12} delay={300} />
      </View>
    </View>

    {/* Schedule card */}
    <View style={{ backgroundColor: "#F7F7F8", borderRadius: 20, padding: 20, marginBottom: 16 }}>
      <SkeletonBlock width={80} height={16} borderRadius={6} delay={200} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: i < 2 ? 12 : 0 }}>
          <SkeletonBlock width={120} height={14} borderRadius={5} delay={250 + i * 50} />
          <SkeletonBlock width={60} height={14} borderRadius={5} delay={280 + i * 50} />
        </View>
      ))}
    </View>

    {/* Salary card */}
    <View style={{ backgroundColor: "#F7F7F8", borderRadius: 20, padding: 20 }}>
      <SkeletonBlock width={80} height={16} borderRadius={6} delay={300} style={{ marginBottom: 12 }} />
      <SkeletonBlock width={140} height={28} borderRadius={8} delay={350} />
    </View>
  </View>
);

export default EmployeeHomeSkeleton;
