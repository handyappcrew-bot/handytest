import React, { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import PageLayout from "@/components/PageLayout";
import PrimaryButton from "@/components/PrimaryButton";
import type { ScreenProps } from "@/navigation/types";

const OWNER_ICON = require("../../../assets/images/icon/owner.png");
const STAFF_ICON = require("../../../assets/images/icon/staff.png");

type MemberType = "owner" | "employee";

interface CardProps {
  type: MemberType;
  iconSource: ReturnType<typeof require>;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (t: MemberType) => void;
}

const TypeCard: React.FC<CardProps> = ({ type, iconSource, title, description, selected, onSelect }) => (
  <Pressable
    onPress={() => onSelect(type)}
    style={{ borderWidth: 2, borderColor: selected ? "#7488FE" : "#DBDCDF", backgroundColor: selected ? "#EEF2FF" : "#FFFFFF", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "center", gap: 16 }}
  >
    <Image source={iconSource} style={{ width: 76, height: 76 }} resizeMode="contain" />
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.36, color: selected ? "#7488FE" : "#19191B", marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 20, letterSpacing: -0.28, color: "#70737B" }}>{description}</Text>
    </View>
  </Pressable>
);

const MemberTypeScreen: React.FC<ScreenProps<"MemberType">> = ({ route, navigation }) => {
  const [selected, setSelected] = useState<MemberType | null>(null);
  const canBack = route.params?.canBack === true;

  const handleNext = () => {
    if (!selected) return;
    if (selected === "owner") navigation.navigate("OwnerBusinessVerify");
    else navigation.navigate("EmployeeStoreRegistration");
  };

  return (
    <PageLayout
      hideBackButton={!canBack}
      headerTitle="회원 유형 선택"
      footer={<PrimaryButton label="다음" onPress={handleNext} disabled={!selected} />}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: "#19191B", letterSpacing: -0.52, lineHeight: 34 }}>
          {"회원 유형을\n선택 해주세요"}
        </Text>
        <Text style={{ fontSize: 15, color: "#70737B", marginTop: 8, lineHeight: 22 }}>
          서비스 이용을 위해 회원 유형을 선택 해주세요
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
        <TypeCard
          type="owner"
          iconSource={OWNER_ICON}
          title="사장 회원"
          description={"핸디에 매장을 등록하실\n사장님이라면 선택 해주세요"}
          selected={selected === "owner"}
          onSelect={setSelected}
        />
        <TypeCard
          type="employee"
          iconSource={STAFF_ICON}
          title="직원 회원"
          description={"핸디를 사용중인 매장의\n직원이라면 선택 해주세요"}
          selected={selected === "employee"}
          onSelect={setSelected}
        />
      </View>
    </PageLayout>
  );
};

export default MemberTypeScreen;
