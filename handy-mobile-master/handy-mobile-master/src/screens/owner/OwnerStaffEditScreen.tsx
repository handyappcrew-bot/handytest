import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { ChevronLeft, ChevronDown, Check, RefreshCw, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import BottomSheet from "@/components/BottomSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import ImagePickerSheet from "@/components/ImagePickerSheet";
import { useToast } from "@/components/Toast";
import AnimatedPressable from "@/components/AnimatedPressable";
import FocusInput from "@/components/FocusInput";
import { getStaffDetail, updateStaffContract, updateStaffWorkSchedule, updateStaffDocuments, getOwnerSchedules, deleteOwnerSchedule, bulkCreateOwnerSchedules } from "@/api/owner";
import { getCachedStoreInfo, invalidateStaffList } from "@/utils/cachedApi";
import { API_BASE_URL } from "@/api/client";
import Avatar from "@/components/Avatar";
const STAFF_ICON = require("../../../assets/images/icon/staff-icon.png");
import { getShiftStyle as getShiftStyleUtil, inferShiftName } from "@/utils/shiftStyles";
import { localStorage } from "@/utils/storage";
import type { ScreenProps } from "@/navigation/types";

type TaxItem = { key: string; label: string; active: boolean; value: string };
type WorkEntry = { day: string; time: string; shifts: string[] };

const EMPLOYEE_TYPES = ["알바생", "정규직", "계약직"];
const SALARY_TYPES = ["시급", "월급 (연봉 포함)"];
const SALARY_CYCLES = ["월 1회 (월급)", "주급", "월 2회"];
const PAY_DAY_OPTIONS: Record<string, string[]> = {
  "월 1회 (월급)": ["1일","2일","3일","4일","5일","6일","7일","8일","9일","10일","11일","12일","13일","14일","15일","16일","17일","18일","19일","20일","21일","22일","23일","24일","25일","26일","27일","28일","29일","30일","31일","매달 말일"],
  "월 2회": ["1일, 15일", "1일, 16일", "7일, 21일"],
  "주급": ["매주 월요일", "매주 화요일", "매주 수요일", "매주 목요일", "매주 금요일", "매주 토요일", "매주 일요일"],
};
const PROBATION_RATES = ["95%", "90%", "85%", "80%", "75%", "70%"];
const BREAK_TIME_OPTIONS = [15, 30, 60, 90, 120];
const WORK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WORKING_STATUSES = ["재직", "휴직", "퇴사"];
const WORK_STATUS_CONFIRM: Record<string, { title: string; description: string }> = {
  "재직": {
    title: "재직 상태로 변경하기",
    description: "재직 상태로 변경하시겠어요?\n일정, 급여 등 직원 기능을\n다시 사용할 수 있어요",
  },
  "휴직": {
    title: "휴직 상태로 변경하기",
    description: "휴직 상태로 변경하시겠어요?\n휴직 상태가 되면 일정, 급여 등\n모든 기능에서 제외돼요",
  },
  "퇴사": {
    title: "퇴사 처리하기",
    description: "퇴사 처리 시 이전 근무 데이터는 그대로 유지되며,\n해당 직원은 직원 관리 목록에서 제외됩니다.\n\n정말 퇴사 처리하시겠어요?",
  },
};
const BANK_LIST = ["국민은행", "신한은행", "농협", "우리은행", "기업은행", "하나은행", "토스뱅크", "카카오뱅크", "새마을금고", "케이뱅크", "우체국", "SC제일은행", "IM뱅크", "부산은행", "광주은행", "경남은행", "신협", "산업은행", "수협은행", "한국씨티은행", "SBI저축은행", "제주은행", "전북은행", "산림조합중앙회"];

const BANK_LOGOS: Record<string, any> = {
  "국민은행": require("../../../assets/images/banks/국민.png"),
  "신한은행": require("../../../assets/images/banks/신한.png"),
  "농협": require("../../../assets/images/banks/농협.png"),
  "우리은행": require("../../../assets/images/banks/우리.png"),
  "기업은행": require("../../../assets/images/banks/기업.png"),
  "하나은행": require("../../../assets/images/banks/하나.png"),
  "토스뱅크": require("../../../assets/images/banks/토스.png"),
  "카카오뱅크": require("../../../assets/images/banks/카카오뱅크.png"),
  "새마을금고": require("../../../assets/images/banks/새마을금고.png"),
  "케이뱅크": require("../../../assets/images/banks/케이뱅크.png"),
  "우체국": require("../../../assets/images/banks/우체국.png"),
  "SC제일은행": require("../../../assets/images/banks/sc제일은행.png"),
  "IM뱅크": require("../../../assets/images/banks/im뱅크.png"),
  "부산은행": require("../../../assets/images/banks/부산은행.png"),
  "광주은행": require("../../../assets/images/banks/광주은행.png"),
  "신협": require("../../../assets/images/banks/신협.png"),
  "산업은행": require("../../../assets/images/banks/산업은행.png"),
  "수협은행": require("../../../assets/images/banks/수협은행.png"),
  "한국씨티은행": require("../../../assets/images/banks/씨티은행.png"),
  "SBI저축은행": require("../../../assets/images/banks/sbi저축은행.png"),
  "경남은행": require("../../../assets/images/banks/부산은행.png"),
  "제주은행": require("../../../assets/images/banks/신한.png"),
  "전북은행": require("../../../assets/images/banks/광주은행.png"),
  "산림조합중앙회": require("../../../assets/images/banks/산림조합중앙회.png"),
};

const SECTION_TITLES_EDIT: Record<string, string> = {
  "계약정보": "계약 정보 수정", "세금": "세금 수정", "인적사항": "인적 사항 수정",
  "메모": "메모 수정", "계약서": "계약서 수정", "근무상태": "근무 상태 수정",
};
const SECTION_TITLES_NEW: Record<string, string> = {
  "계약정보": "계약 정보 등록", "세금": "세금 등록", "인적사항": "인적 사항 등록",
  "메모": "메모 등록", "계약서": "계약서 등록", "근무상태": "근무 상태 수정",
};

const INCOME_TAX_DEFAULTS: TaxItem[] = [
  { key: "income", label: "소득세", active: false, value: "3" },
  { key: "local", label: "지방소득세", active: false, value: "0.3" },
];
const SOCIAL_INS_DEFAULTS: TaxItem[] = [
  { key: "national", label: "국민연금", active: false, value: "4.75" },
  { key: "health", label: "건강보험", active: false, value: "3.595" },
  { key: "longterm", label: "장기요양보험", active: false, value: "4.75" },
  { key: "employment", label: "고용보험", active: false, value: "1.8" },
  { key: "industrial", label: "산재보험", active: false, value: "1.47" },
];

function buildIncomeTax(contract: any): TaxItem[] {
  return [
    { key: "income", label: "소득세", active: contract?.income_tax != null, value: contract?.income_tax != null ? String(contract.income_tax) : "3" },
    { key: "local", label: "지방소득세", active: contract?.local_income_tax != null, value: contract?.local_income_tax != null ? String(contract.local_income_tax) : "0.3" },
  ];
}
function buildSocialIns(contract: any): TaxItem[] {
  return [
    { key: "national", label: "국민연금", active: contract?.national_pension != null, value: contract?.national_pension != null ? String(contract.national_pension) : "4.75" },
    { key: "health", label: "건강보험", active: contract?.health_insurance != null, value: contract?.health_insurance != null ? String(contract.health_insurance) : "3.595" },
    { key: "longterm", label: "장기요양보험", active: contract?.long_term_care != null, value: contract?.long_term_care != null ? String(contract.long_term_care) : "4.75" },
    { key: "employment", label: "고용보험", active: contract?.employment_insurance != null, value: contract?.employment_insurance != null ? String(contract.employment_insurance) : "1.8" },
    { key: "industrial", label: "산재보험", active: contract?.industrial_accident != null, value: contract?.industrial_accident != null ? String(contract.industrial_accident) : "1.47" },
  ];
}

// ── 드럼롤 스크롤 피커 ──────────────────────────────────────
function ScrollPickerNative({ items, selected, onSelect, suffix }: {
  items: number[]; selected: number; onSelect: (v: number) => void; suffix: string;
}) {
  const ITEM_H = 44;
  const VISIBLE = 5;
  const scrollRef = useRef<ScrollView>(null);
  const [local, setLocal] = useState(selected);

  useEffect(() => {
    setLocal(selected);
    const idx = items.indexOf(selected);
    if (idx >= 0) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 80);
    }
  }, [selected, items.length]);

  const snap = (y: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
    setLocal(items[idx]);
    onSelect(items[idx]);
  };

  const pad = suffix === "월" || suffix === "일";

  return (
    <View style={{ flex: 1, height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H, backgroundColor: "#F0F3FF", borderRadius: 8 }} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={e => snap(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => snap(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}
      >
        {items.map(item => (
          <Pressable
            key={item}
            onPress={() => {
              setLocal(item);
              onSelect(item);
              scrollRef.current?.scrollTo({ y: items.indexOf(item) * ITEM_H, animated: true });
            }}
            style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 17, fontWeight: item === local ? "700" : "400", color: item === local ? "#4261FF" : "#70737B" }}>
              {pad ? String(item).padStart(2, "0") : String(item)}{suffix}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ── 날짜 선택 바텀시트 ───────────────────────────────────────
function DatePickerSheet({ isOpen, onClose, title, value, onConfirm, minDate }: {
  isOpen: boolean; onClose: () => void; title: string; value: string; onConfirm: (v: string) => void; minDate?: string;
}) {
  const now = new Date();
  const parse = (v: string) => {
    const p = v.split(".");
    return { y: parseInt(p[0]) || now.getFullYear(), m: parseInt(p[1]) || now.getMonth() + 1, d: parseInt(p[2]) || now.getDate() };
  };
  const minP = minDate ? parse(minDate) : null;
  const clamp = (vals: { y: number; m: number; d: number }) => {
    if (!minP) return vals;
    let { y, m, d } = vals;
    if (y < minP.y) return { y: minP.y, m: minP.m, d: minP.d };
    if (y === minP.y && m < minP.m) return { y, m: minP.m, d: minP.d };
    if (y === minP.y && m === minP.m && d < minP.d) return { y, m, d: minP.d };
    return { y, m, d };
  };
  const getInit = () => {
    const base = value ? parse(value) : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    return clamp(base);
  };
  const init = getInit();
  const [year, setYear] = useState(init.y);
  const [month, setMonth] = useState(init.m);
  const [day, setDay] = useState(init.d);

  useEffect(() => {
    if (isOpen) { const p = getInit(); setYear(p.y); setMonth(p.m); setDay(p.d); }
  }, [isOpen]);

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - 2 + i)
    .filter(y => !minP || y >= minP.y);
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter(m => !minP || year > minP.y || m >= minP.m);
  const daysInMonth = new Date(year, month, 0).getDate();
  const minDay = minP && year === minP.y && month === minP.m ? minP.d : 1;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d >= minDay);
  const safeDay = Math.max(Math.min(day, daysInMonth), minDay);

  const handleYear = (y: number) => { const c = clamp({ y, m: month, d: day }); setYear(c.y); setMonth(c.m); setDay(c.d); };
  const handleMonth = (m: number) => { const maxD = new Date(year, m, 0).getDate(); const c = clamp({ y: year, m, d: Math.min(day, maxD) }); setYear(c.y); setMonth(c.m); setDay(c.d); };

  const formatted = `${year}.${String(month).padStart(2, "0")}.${String(safeDay).padStart(2, "0")}`;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
        <ScrollPickerNative items={years} selected={year} onSelect={handleYear} suffix="년" />
        <ScrollPickerNative items={months} selected={month} onSelect={handleMonth} suffix="월" />
        <ScrollPickerNative items={days} selected={safeDay} onSelect={setDay} suffix="일" />
      </View>
      <AnimatedPressable
        onPress={() => { onConfirm(formatted); onClose(); }}
        scaleAmount={0.97} opacityAmount={0.75}
        style={{ height: 52, borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>선택 완료</Text>
      </AnimatedPressable>
    </BottomSheet>
  );
}

// ── 급여 입력 바텀시트 ───────────────────────────────────────
function SalaryInputSheet({ isOpen, onClose, title, value, onConfirm, placeholder, subText, minAmount, errorText }: {
  isOpen: boolean; onClose: () => void; title: string; value: string;
  onConfirm: (v: string) => void; placeholder?: string; subText?: string; minAmount?: number; errorText?: string;
}) {
  const fmt = (v: string) => { const n = v.replace(/[^0-9]/g, ""); return n ? Number(n).toLocaleString() : ""; };
  const [val, setVal] = useState("");

  useEffect(() => { if (isOpen) setVal(fmt(value)); }, [isOpen]);

  const raw = Number(val.replace(/,/g, ""));
  const belowMin = minAmount !== undefined && val.length > 0 && raw < minAmount;
  const hasVal = val.length > 0 && !belowMin;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <View style={{ gap: 8 }}>
        <FocusInput
          value={val}
          onChangeText={t => setVal(fmt(t))}
          placeholder={placeholder || "숫자만 입력"}
          placeholderTextColor="#AAB4BF"
          keyboardType="numeric"
          style={[{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", outline: "none", boxShadow: "none" } as any]}
        />
        {belowMin && <Text style={{ fontSize: 13, fontWeight: "600", color: "#FF3D3D" }}>{errorText ?? "최저 금액 미만은 입력할 수 없어요"}</Text>}
        {!belowMin && subText ? <Text style={{ fontSize: 13, fontWeight: "600", color: "#4261FF" }}>{subText}</Text> : null}
      </View>
      <AnimatedPressable
        onPress={() => { if (!hasVal) return; onConfirm(val.replace(/,/g, "")); onClose(); }}
        scaleAmount={0.97} opacityAmount={0.75}
        style={{ height: 52, borderRadius: 14, backgroundColor: hasVal ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center", marginTop: 20 }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
      </AnimatedPressable>
    </BottomSheet>
  );
}

// ── 공용 UI 컴포넌트 ────────────────────────────────────────
function FieldBlock({ label, required, children, error, onLayout }: { label: string; required?: boolean; children: React.ReactNode; error?: string; onLayout?: (e: any) => void }) {
  return (
    <View style={{ marginBottom: 16 }} onLayout={onLayout}>
      <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 8 }}>
        {label}{required && <Text style={{ color: "#FF3D3D" }}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={{ fontSize: 13, color: "#FF3D3D", marginTop: 6 }}>{error}</Text> : null}
    </View>
  );
}

function SelectFieldRow({ label, required, value, placeholder, onTap, error, onLayout }: { label: string; required?: boolean; value: string; placeholder: string; onTap: () => void; error?: string; onLayout?: (e: any) => void }) {
  return (
    <FieldBlock label={label} required={required} error={error} onLayout={onLayout}>
      <AnimatedPressable onPress={onTap} scaleAmount={0.98} opacityAmount={0.85}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: error ? "#FF3D3D" : "#DBDCDF", backgroundColor: "#FFFFFF" }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: value ? "#19191B" : "#AAB4BF" }}>{value || placeholder}</Text>
        <ChevronDown size={16} color="#9EA3AD" />
      </AnimatedPressable>
    </FieldBlock>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <FieldBlock label={label}>
      <View style={{ height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#F0F0F0", backgroundColor: "#F7F7F8", justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: "#9EA3AD" }}>{value}</Text>
      </View>
    </FieldBlock>
  );
}

function ToggleRow({ label, value, onChange, subText }: { label: string; value: boolean; onChange: (v: boolean) => void; subText?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: "#19191B" }}>{label}</Text>
        <AnimatedPressable onPress={() => onChange(!value)} scaleAmount={0.97} opacityAmount={0.8}
          style={{ width: 52, height: 28, borderRadius: 14, backgroundColor: value ? "#4261FF" : "#DBDCDF", justifyContent: "center", paddingHorizontal: 2 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", alignSelf: value ? "flex-end" : "flex-start" }} />
        </AnimatedPressable>
      </View>
      {subText ? <Text style={{ fontSize: 14, color: "#70737B", marginTop: 6 }}>{subText}</Text> : null}
    </View>
  );
}

function TaxItemRow({ tax, onToggle, onEdit, isError, isFocused }: {
  tax: TaxItem; onToggle: () => void; onEdit: () => void;
  isError?: boolean; isFocused?: boolean;
}) {
  const isIndustrial = tax.key === "industrial";
  const valueBorderColor = tax.active && !isIndustrial
    ? isError ? "#FF3D3D" : isFocused ? "#4261FF" : "#DBDCDF"
    : "#DBDCDF";
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AnimatedPressable onPress={onToggle} scaleAmount={0.97} opacityAmount={0.85}
          style={{ width: 130, height: 48, borderRadius: 10, borderWidth: 1, borderColor: tax.active ? "rgba(16,201,125,0.3)" : "#DBDCDF", backgroundColor: tax.active ? "rgba(16,201,125,0.1)" : "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
          {tax.active && <Check size={14} color="#10C97D" />}
          <Text style={{ fontSize: 14, fontWeight: "500", color: tax.active ? "#10C97D" : "#9EA3AD" }}>{tax.label}</Text>
        </AnimatedPressable>
        <AnimatedPressable onPress={onEdit} disabled={!tax.active || isIndustrial} scaleAmount={0.98} opacityAmount={0.85}
          style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: valueBorderColor, backgroundColor: tax.active && !isIndustrial ? "#FFFFFF" : "#F7F7F8", flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 12, gap: 4 }}>
          {isIndustrial ? (
            <Text style={{ fontSize: 13, fontWeight: "500", color: "#9EA3AD", flex: 1, textAlign: "center" }}>사업주 전액 부담</Text>
          ) : (
            <>
              {tax.key === "longterm" && <Text style={{ fontSize: 13, color: "#70737B", marginRight: 4 }}>건강보험의</Text>}
              <Text style={{ fontSize: 14, fontWeight: "500", color: tax.active ? (isError ? "#FF3D3D" : "#19191B") : "#C0C4CC", flex: 1, textAlign: "right" }}>{tax.active ? (tax.value || "미입력") : "미입력"}</Text>
              <Text style={{ fontSize: 14, color: tax.active ? "#70737B" : "#C0C4CC" }}>%</Text>
            </>
          )}
        </AnimatedPressable>
      </View>
      {isError && (
        <Text style={{ fontSize: 12, color: "#FF3D3D", marginTop: 4, marginLeft: 138 }}>세율을 입력해주세요</Text>
      )}
    </View>
  );
}

// ── 메인 화면 ────────────────────────────────────────────────
const OwnerStaffEditScreen: React.FC<ScreenProps<"OwnerStaffEdit">> = ({ route, navigation }) => {
  const { toast } = useToast();
  const { staffId, section = "계약정보" } = route.params;
  const storeId = Number(localStorage.getItem("currentStoreId") ?? 0);

  const [staffName, setStaffName] = useState("");
  const [staffImageUrl, setStaffImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldYPos = useRef<Record<string, number>>({});
  const mainScrollRef = useRef<ScrollView>(null);

  // 계약정보
  const [employeeType, setEmployeeType] = useState("");
  const [salaryType, setSalaryType] = useState("");
  const [isAnnualSalary, setIsAnnualSalary] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [annualSalary, setAnnualSalary] = useState("");
  const [probation, setProbation] = useState(false);
  const [probationRate, setProbationRate] = useState("");
  const [probationStart, setProbationStart] = useState("");
  const [probationEnd, setProbationEnd] = useState("");
  const [salaryCycle, setSalaryCycle] = useState("");
  const [salaryDay, setSalaryDay] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [includeHolidayPay, setIncludeHolidayPay] = useState(false);
  const [includeBreakTime, setIncludeBreakTime] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [workSchedule, setWorkSchedule] = useState<WorkEntry[]>([]);
  const [storeShifts, setStoreShifts] = useState<{ id: number; name: string; sort_order: number; start_time: string | null; end_time: string | null; is_active: boolean }[]>([]);

  // 세금
  const [incomeTax, setIncomeTax] = useState<TaxItem[]>(INCOME_TAX_DEFAULTS.map(t => ({ ...t })));
  const [socialInsurance, setSocialInsurance] = useState<TaxItem[]>(SOCIAL_INS_DEFAULTS.map(t => ({ ...t })));
  const [taxRateKey, setTaxRateKey] = useState<{ type: "income" | "social"; key: string; title: string } | null>(null);
  const [taxRateInput, setTaxRateInput] = useState("");
  const [showTaxRateSheet, setShowTaxRateSheet] = useState(false);
  const [focusedTaxKey, setFocusedTaxKey] = useState<string | null>(null);
  const [taxErrorField, setTaxErrorField] = useState<string | null>(null);
  const [taxErrorMsg, setTaxErrorMsg] = useState("");

  // 인적사항
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // 메모
  const [memo, setMemo] = useState("");

  // 근무상태
  const [workingStatus, setWorkingStatus] = useState("");

  // 등록 모드 여부 (최초 계약 정보 없는 신규 직원)
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  // 계약서
  type DocKey = "resume" | "laborContract" | "healthCert";
  type DocFile = { uri: string; name: string; type: string; webFile?: File };
  type DocEntry = { name: string; file: DocFile | null; url?: string } | null;
  const DOC_BACKEND_KEY: Record<DocKey, string> = { resume: "resume", laborContract: "employment_contract", healthCert: "health_certificate" };
  const [docs, setDocs] = useState<Record<DocKey, DocEntry>>({ resume: null, laborContract: null, healthCert: null });
  const [deletedDocKeys, setDeletedDocKeys] = useState<string[]>([]);
  const [docUploadTarget, setDocUploadTarget] = useState<DocKey | null>(null);
  const [showDocSheet, setShowDocSheet] = useState(false);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<{ open: boolean; key: DocKey | null }>({ open: false, key: null });
  const [docPreview, setDocPreview] = useState<{ uri: string; label: string } | null>(null);
  const DOC_LIST: { key: DocKey; label: string }[] = [
    { key: "resume", label: "이력서" },
    { key: "laborContract", label: "근로계약서" },
    { key: "healthCert", label: "보건증" },
  ];

  // BottomSheet states
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [showSalaryTypeSheet, setShowSalaryTypeSheet] = useState(false);
  const [showCycleSheet, setShowCycleSheet] = useState(false);
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [showBankSheet, setShowBankSheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [accountInput, setAccountInput] = useState("");
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [workStatusConfirm, setWorkStatusConfirm] = useState<{ open: boolean; status: string }>({ open: false, status: "" });
  const [showProbationSheet, setShowProbationSheet] = useState(false);
  const [showBreakSheet, setShowBreakSheet] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // 날짜 피커 sheets
  const [showHireDateSheet, setShowHireDateSheet] = useState(false);
  const [showProbStartSheet, setShowProbStartSheet] = useState(false);
  const [showProbEndSheet, setShowProbEndSheet] = useState(false);

  // 급여 입력 sheets
  const [showSalaryInputSheet, setShowSalaryInputSheet] = useState(false);
  const [showAnnualInputSheet, setShowAnnualInputSheet] = useState(false);

  // 근무일 sheet — 4단계: list → day → shifts → time
  const [showWorkDaySheet, setShowWorkDaySheet] = useState(false);
  const [wdStep, setWdStep] = useState<"list" | "day" | "shifts" | "time" | "deleteConfirm">("list");
  const [wdDay, setWdDay] = useState("");
  const [wdShifts, setWdShifts] = useState<string[]>([]);
  const [wdStart, setWdStart] = useState("09:00");
  const [wdEnd, setWdEnd] = useState("18:00");
  const [wdListSel, setWdListSel] = useState<string[]>([]);
  const [wdIsEdit, setWdIsEdit] = useState(false);

  const initialSnap = useRef<Record<string, unknown>>({});

  // ── 데이터 로드 ──────────────────────────────────────────
  useEffect(() => {
    if (!storeId || !staffId) return;
    const loadNow = new Date();
    Promise.all([
      getStaffDetail(storeId, staffId),
      getCachedStoreInfo(storeId),
      getOwnerSchedules(storeId, loadNow.getFullYear(), loadNow.getMonth() + 1).catch(() => []),
    ]).then(([d, storeData, scheduleData]: [any, any, any]) => {
      if (!d) return;
      setStoreShifts(storeData?.shifts ?? []);
      // API가 계약 필드를 flat(루트 레벨)으로 반환 — d를 직접 참조
      const hasExistingContract = !!(d?.employee_type || d?.hourly_rate || d?.monthly_salary || d?.annual_salary);
      setIsNewRegistration(section === "계약정보" && !hasExistingContract);
      const it = buildIncomeTax(d);
      const si = buildSocialIns(d);
      const rawSalaryType = d?.salary_type ?? "";
      const detectedSalaryType = rawSalaryType === "월급" ? "월급 (연봉 포함)"
        : rawSalaryType === "연봉" ? "월급 (연봉 포함)"
        : rawSalaryType || (d?.hourly_rate ? "시급" : d?.monthly_salary ? "월급 (연봉 포함)" : "");
      const normalizeSchedule = (ws: any): WorkEntry => ({
        day: ws.day ?? WORK_DAYS[ws.day_of_week] ?? "",
        time: ws.time ?? (ws.start_time && ws.end_time ? `${ws.start_time} ~ ${ws.end_time}` : ""),
        shifts: ws.shifts ?? (ws.shift_name ? [ws.shift_name] : ws.part_name ? [ws.part_name] : []),
      });
      const snap = {
        employeeType: d?.employee_type ?? "",
        salaryType: detectedSalaryType,
        isAnnualSalary: rawSalaryType === "연봉",
        hourlyRate: d?.hourly_rate ? String(d.hourly_rate) : "",
        monthlySalary: d?.monthly_salary ? String(d.monthly_salary) : "",
        annualSalary: d?.annual_salary ? String(d.annual_salary) : "",
        probation: !!(d?.is_probation ?? d?.probation),
        probationRate: d?.probation_rate ? `${d.probation_rate}%` : "",
        probationStart: d?.probation_start ?? "",
        probationEnd: d?.probation_end ?? "",
        salaryCycle: d?.salary_cycle ?? "",
        salaryDay: d?.salary_day ?? "",
        hireDate: d?.joined_at ? String(d.joined_at).slice(0, 10).replace(/-/g, ".") : "",
        incomeTax: JSON.stringify(it),
        socialInsurance: JSON.stringify(si),
        birth: d?.birth ?? "",
        gender: d?.gender === "male" || d?.gender === "남" ? "남자"
          : d?.gender === "female" || d?.gender === "여" ? "여자"
          : d?.gender ?? "",
        phone: d?.phone ?? "",
        bank: d?.bank ?? "",
        accountNumber: d?.account_number ?? "",
        memo: d?.memo ?? "",
        workingStatus: d?.working_status ?? d?.work_status ?? "재직",
        workSchedule: JSON.stringify(
          (d?.work_schedule ?? []).length > 0
            ? (() => {
                // 백엔드가 day당 shift별로 행을 분리해 반환할 수 있으므로 day 기준으로 그룹화
                const byDay: Record<string, WorkEntry> = {};
                (d.work_schedule as any[]).map(normalizeSchedule).forEach(entry => {
                  if (!entry.day) return;
                  if (!byDay[entry.day]) {
                    byDay[entry.day] = { ...entry, shifts: [...entry.shifts] };
                  } else {
                    entry.shifts.forEach((s: string) => {
                      if (!byDay[entry.day].shifts.includes(s)) byDay[entry.day].shifts.push(s);
                    });
                    if (!byDay[entry.day].time && entry.time) byDay[entry.day].time = entry.time;
                  }
                });
                return WORK_DAYS.filter(d => byDay[d]).map(d => byDay[d]);
              })()
            : (() => {
                const storeShiftsSnap = storeData?.shifts ?? [];
                const resolveShiftName = (s: any): string => {
                  if (s.shift_name) return s.shift_name;
                  if (s.shift_id) {
                    const found = storeShiftsSnap.find((sf: any) => sf.id === s.shift_id);
                    if (found?.name) return found.name;
                  }
                  if (s.work_start) return inferShiftName(s.work_start, storeShiftsSnap);
                  return "";
                };
                const empScheds = (Array.isArray(scheduleData) ? scheduleData : []).filter((s: any) => s.employee_id === staffId);
                const dayMap: Record<number, { shifts: string[]; time: string }> = {};
                empScheds.forEach((s: any) => {
                  const jsDay = new Date(s.work_date).getDay();
                  const wdIdx = jsDay === 0 ? 6 : jsDay - 1;
                  if (!dayMap[wdIdx]) dayMap[wdIdx] = { shifts: [], time: "" };
                  const shiftName = resolveShiftName(s);
                  if (shiftName && !dayMap[wdIdx].shifts.includes(shiftName)) dayMap[wdIdx].shifts.push(shiftName);
                  if (!dayMap[wdIdx].time && s.work_start && s.work_end) dayMap[wdIdx].time = `${s.work_start} ~ ${s.work_end}`;
                });
                return Object.entries(dayMap)
                  .map(([idx, { shifts, time }]) => ({ day: WORK_DAYS[Number(idx)], shifts, time }))
                  .filter(e => e.day);
              })()
        ),
      };
      initialSnap.current = snap;
      setStaffName(d?.name ?? "");
      setStaffImageUrl(d?.image_url ?? null);
      setEmployeeType(snap.employeeType);
      setSalaryType(snap.salaryType);
      setIsAnnualSalary(snap.isAnnualSalary);
      setHourlyRate(snap.hourlyRate);
      setMonthlySalary(snap.monthlySalary);
      setAnnualSalary(snap.annualSalary);
        setProbation(snap.probation);
      setProbationRate(snap.probationRate);
      setProbationStart(snap.probationStart);
      setProbationEnd(snap.probationEnd);
      setSalaryCycle(snap.salaryCycle);
      // cycle-day 불일치 방어: 시급일 때만 적용 (월급/연봉은 cycle 선택 UI 없어서 무시)
      const validDayOpts = PAY_DAY_OPTIONS[snap.salaryCycle] ?? [];
      const cycleIsHourly = detectedSalaryType === "시급";
      const dayMismatch = cycleIsHourly && validDayOpts.length > 0 && !validDayOpts.includes(snap.salaryDay);
      setSalaryDay(dayMismatch ? "" : snap.salaryDay);
      setHireDate(snap.hireDate);
      setIncomeTax(it);
      setSocialInsurance(si);
      setBirth(snap.birth);
      setGender(snap.gender);
      setPhone(snap.phone);
      setBank(snap.bank);
      setAccountNumber(snap.accountNumber);
      setMemo(snap.memo);
      setWorkingStatus(snap.workingStatus);
      if ((d?.work_schedule ?? []).length > 0) {
        const byDay: Record<string, WorkEntry> = {};
        (d.work_schedule as any[]).map(normalizeSchedule).forEach(entry => {
          if (!entry.day) return;
          if (!byDay[entry.day]) {
            byDay[entry.day] = { ...entry, shifts: [...entry.shifts] };
          } else {
            entry.shifts.forEach((s: string) => {
              if (!byDay[entry.day].shifts.includes(s)) byDay[entry.day].shifts.push(s);
            });
            if (!byDay[entry.day].time && entry.time) byDay[entry.day].time = entry.time;
          }
        });
        setWorkSchedule(WORK_DAYS.filter(d => byDay[d]).map(d => byDay[d]));
      } else {
        const storeShiftsSnap = storeData?.shifts ?? [];
        const resolveShiftName = (s: any): string => {
          if (s.shift_name) return s.shift_name;
          if (s.shift_id) {
            const found = storeShiftsSnap.find((sf: any) => sf.id === s.shift_id);
            if (found?.name) return found.name;
          }
          if (s.work_start) return inferShiftName(s.work_start, storeShiftsSnap);
          return "";
        };
        const empScheds = (Array.isArray(scheduleData) ? scheduleData : []).filter((s: any) => s.employee_id === staffId);
        const dayMap: Record<number, { shifts: string[]; time: string }> = {};
        empScheds.forEach((s: any) => {
          const jsDay = new Date(s.work_date).getDay();
          const wdIdx = jsDay === 0 ? 6 : jsDay - 1;
          if (!dayMap[wdIdx]) dayMap[wdIdx] = { shifts: [], time: "" };
          const shiftName = resolveShiftName(s);
          if (shiftName && !dayMap[wdIdx].shifts.includes(shiftName)) dayMap[wdIdx].shifts.push(shiftName);
          if (!dayMap[wdIdx].time && s.work_start && s.work_end) dayMap[wdIdx].time = `${s.work_start} ~ ${s.work_end}`;
        });
        setWorkSchedule(
          Object.entries(dayMap)
            .map(([idx, { shifts, time }]) => ({ day: WORK_DAYS[Number(idx)], shifts, time }))
            .filter(e => e.day)
        );
      }
      setBreakMinutes(d?.contract?.break_minutes ?? storeData?.setting?.break_minutes ?? 30);
      setIncludeBreakTime(d?.include_break_time != null ? !!d.include_break_time : !!storeData?.setting?.include_break_time);
      setIncludeHolidayPay(d?.include_holiday_pay != null ? !!d.include_holiday_pay : !!storeData?.setting?.include_holiday_pay);
      const toEntry = (url: string | null | undefined): DocEntry =>
        url ? { name: url.split("/").pop() ?? url, file: null, url } : null;
      setDocs({
        resume: toEntry(d?.contract?.resume),
        laborContract: toEntry(d?.contract?.employment_contract),
        healthCert: toEntry(d?.contract?.health_certificate),
      });
    }).catch((e) => { console.warn(e); toast({ description: "직원 정보를 불러오지 못했어요.", variant: "destructive" }); });
  }, [storeId, staffId]);

  const getShiftStyle = (name: string) => getShiftStyleUtil(name, storeShifts);

  // ── 저장 ────────────────────────────────────────────────
  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (section === "계약정보") {
        if (employeeType) payload.employee_type = employeeType;
        if (salaryType) payload.salary_type = isAnnualSalary ? "연봉" : salaryType === "월급 (연봉 포함)" ? "월급" : salaryType;
        if (hireDate) payload.hire_date = hireDate.replace(/\./g, "-");
        if (salaryCycle) payload.salary_cycle = salaryCycle;
        if (salaryDay) payload.salary_day = salaryDay;
        payload.is_probation = probation;
        if (probation && probationRate) payload.probation_rate = parseFloat(probationRate) || 0;
        if (probation && probationStart) payload.probation_start = probationStart.replace(/\./g, "-");
        if (probation && probationEnd) payload.probation_end = probationEnd.replace(/\./g, "-");
        payload.include_holiday_pay = includeHolidayPay;
        payload.include_break_time = includeBreakTime;
        if (includeBreakTime) payload.break_minutes = breakMinutes;
        if (salaryType === "시급") {
          const rate = parseInt(hourlyRate.replace(/[^0-9]/g, ""), 10);
          payload.hourly_rate = (!isNaN(rate) && rate > 0) ? rate : null;
          payload.monthly_salary = null;
          payload.annual_salary = null;
        } else if (isAnnualSalary) {
          const ann = parseInt(annualSalary.replace(/[^0-9]/g, ""), 10);
          payload.annual_salary = (!isNaN(ann) && ann > 0) ? ann : null;
          payload.hourly_rate = null;
          payload.monthly_salary = null;
          payload.salary_cycle = "월 1회 (월급)";
        } else {
          const sal = parseInt(monthlySalary.replace(/[^0-9]/g, ""), 10);
          payload.monthly_salary = (!isNaN(sal) && sal > 0) ? sal : null;
          payload.hourly_rate = null;
          payload.annual_salary = null;
          payload.salary_cycle = "월 1회 (월급)";
        }
      } else if (section === "세금") {
        const findVal = (list: TaxItem[], key: string) => {
          const item = list.find(t => t.key === key);
          if (!item?.active || !item.value) return null;
          const n = parseFloat(item.value);
          return isNaN(n) ? null : n;
        };
        payload.deduction_type = "percent";
        payload.income_tax = findVal(incomeTax, "income");
        payload.local_income_tax = findVal(incomeTax, "local");
        payload.national_pension = findVal(socialInsurance, "national");
        payload.health_insurance = findVal(socialInsurance, "health");
        payload.long_term_care = findVal(socialInsurance, "longterm");
        payload.employment_insurance = findVal(socialInsurance, "employment");
        payload.industrial_accident = findVal(socialInsurance, "industrial");
      } else if (section === "인적사항") {
        payload.bank = bank;
        payload.account_number = accountNumber;
      } else if (section === "메모") {
        payload.memo = memo;
      } else if (section === "계약서") {
        const newFiles: Record<string, DocFile> = {};
        (["resume", "laborContract", "healthCert"] as DocKey[]).forEach((key) => {
          const entry = docs[key];
          if (entry?.file) newFiles[DOC_BACKEND_KEY[key]] = entry.file;
        });
        const hasChanges = Object.keys(newFiles).length > 0 || deletedDocKeys.length > 0;
        if (hasChanges) {
          await updateStaffDocuments(storeId, staffId, {
            resume: newFiles.resume ?? undefined,
            employment_contract: newFiles.employment_contract ?? undefined,
            health_certificate: newFiles.health_certificate ?? undefined,
            delete_fields: deletedDocKeys.length > 0 ? deletedDocKeys : undefined,
          });
        }
        invalidateStaffList(storeId);
        toast({ description: "계약서를 저장했어요." });
        setSubmitting(false);
        navigation.goBack();
        return;
      } else if (section === "근무상태") {
        payload.working_status = workingStatus;
        if (workingStatus === "퇴사") {
          const today = new Date();
          payload.retired_at = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        }
      }
      const SAVE_MESSAGES: Record<string, string> = {
        "계약정보": "계약 정보를 저장했어요.", "세금": "세금 정보를 저장했어요.",
        "인적사항": "인적 사항을 저장했어요.", "메모": "메모를 저장했어요.", "근무상태": "근무 상태를 저장했어요.",
      };
      await updateStaffContract(storeId, staffId, payload);
      // 계약정보 섹션: 근무일 패턴 + 이후 12개월 스케줄 동기화
      if (section === "계약정보") {
        try {
          const today = new Date();
          const baseYear = today.getFullYear();
          const baseMonth = today.getMonth(); // 0-indexed
          const SYNC_MONTHS = 12;
          const padTime = (t: string): string | null => {
            if (!t) return null;
            const parts = t.split(":");
            return `${String(parseInt(parts[0]) || 0).padStart(2, "0")}:${(parts[1] || "00").padStart(2, "0")}`;
          };

          // 1. 근무일 패턴 저장 (shift_id가 있는 항목만)
          const wsItems: { day_of_week: number; shift_id: number }[] = [];
          workSchedule.forEach(entry => {
            const dayIdx = WORK_DAYS.indexOf(entry.day);
            if (dayIdx === -1) return;
            entry.shifts.forEach(shiftName => {
              const shift = storeShifts.find(s => s.name === shiftName);
              if (shift?.id) wsItems.push({ day_of_week: dayIdx, shift_id: shift.id });
            });
          });
          if (wsItems.length > 0) {
            await updateStaffWorkSchedule(storeId, staffId, wsItems);
          }

          // 2. 이후 12개월 스케줄 항목 생성
          const allBulkItems: { employee_id: number; shift_id: number | null; work_date: string; work_start: string | null; work_end: string | null }[] = [];
          for (let offset = 0; offset < SYNC_MONTHS; offset++) {
            const targetDate = new Date(baseYear, baseMonth + offset, 1);
            const tyr = targetDate.getFullYear();
            const tmo = targetDate.getMonth() + 1;
            const lastDay = new Date(tyr, tmo, 0).getDate();
            for (let d = 1; d <= lastDay; d++) {
              const jsDay = new Date(tyr, tmo - 1, d).getDay();
              workSchedule.forEach((entry) => {
                const dayIdx = WORK_DAYS.indexOf(entry.day);
                if (dayIdx === -1 || jsDay !== (dayIdx + 1) % 7) return;
                const timeParts = entry.time.split("~").map((t: string) => t.trim());
                const workDate = `${tyr}-${String(tmo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                if (entry.shifts.length === 0) {
                  allBulkItems.push({ employee_id: staffId, shift_id: null, work_date: workDate, work_start: padTime(timeParts[0]), work_end: padTime(timeParts[1]) });
                } else {
                  entry.shifts.forEach((shiftName) => {
                    const shift = storeShifts.find((s) => s.name === shiftName);
                    allBulkItems.push({ employee_id: staffId, shift_id: shift?.id ?? null, work_date: workDate, work_start: padTime(timeParts[0]), work_end: padTime(timeParts[1]) });
                  });
                }
              });
            }
          }

          // 3. 12개월치 기존 스케줄 병렬 조회 → 해당 직원 것만 일괄 삭제 → 재생성
          const monthRanges = Array.from({ length: SYNC_MONTHS }, (_, offset) => {
            const d = new Date(baseYear, baseMonth + offset, 1);
            return { yr: d.getFullYear(), mo: d.getMonth() + 1 };
          });
          const allExisting = await Promise.all(
            monthRanges.map(({ yr, mo }) => getOwnerSchedules(storeId, yr, mo) as Promise<any[]>)
          );
          const toDelete = allExisting.flat().filter((s: any) => s.employee_id === staffId);
          await Promise.all(toDelete.map((s: any) => deleteOwnerSchedule(storeId, s.id)));
          if (allBulkItems.length > 0) {
            await bulkCreateOwnerSchedules(storeId, allBulkItems);
          }
        } catch {
          // 동기화 실패는 무시 (계약 저장은 이미 성공)
        }
      }
      // 퇴사 처리: 오늘 이후 스케줄 자동 삭제
      if (section === "근무상태" && workingStatus === "퇴사") {
        try {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const monthRanges = Array.from({ length: 13 }, (_, i) => {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            return { yr: d.getFullYear(), mo: d.getMonth() + 1 };
          });
          const allSchedules = await Promise.all(
            monthRanges.map(({ yr, mo }) => (getOwnerSchedules(storeId, yr, mo) as Promise<any[]>).catch(() => []))
          );
          const toDelete = allSchedules.flat().filter(
            (s: any) => s.employee_id === staffId && s.work_date > todayStr
          );
          await Promise.all(toDelete.map((s: any) => deleteOwnerSchedule(storeId, s.id)));
        } catch {
          // 스케줄 삭제 실패는 무시 (퇴사 처리는 이미 성공)
        }
      }
      const saveMsg = section === "근무상태" && workingStatus === "퇴사"
        ? "퇴사 처리가 완료 되었어요."
        : SAVE_MESSAGES[section] ?? "저장되었어요.";
      invalidateStaffList(storeId);
      toast({ description: saveMsg });
      if (section === "근무상태" && workingStatus === "퇴사") {
        navigation.pop(2);
      } else {
        navigation.goBack();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했어요.";
      toast({ description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isRegistered = (() => {
    const s = initialSnap.current;
    if (Object.keys(s).length === 0) return false;
    if (section === "계약정보") return !isNewRegistration;
    if (section === "세금") {
      try {
        const it: TaxItem[] = JSON.parse(s.incomeTax as string || "[]");
        const si: TaxItem[] = JSON.parse(s.socialInsurance as string || "[]");
        return it.some(t => t.active) || si.some(t => t.active);
      } catch { return false; }
    }
    if (section === "인적사항") return !!(s.phone || s.bank || s.accountNumber);
    if (section === "메모") return !!(s.memo);
    if (section === "계약서") return !!(docs.resume?.url || docs.laborContract?.url || docs.healthCert?.url);
    if (section === "근무상태") return !!(s.workingStatus);
    return false;
  })();

  const title = isRegistered ? (SECTION_TITLES_EDIT[section] ?? "수정") : (SECTION_TITLES_NEW[section] ?? "등록");

  const isDirty = (() => {
    const s = initialSnap.current;
    const isNew = !s || Object.keys(s).length === 0;
    if (section === "계약정보") {
      if (isNew) return !!(employeeType || salaryType || hourlyRate || monthlySalary || salaryCycle || salaryDay || hireDate || probation);
      return employeeType !== s.employeeType || salaryType !== s.salaryType || hourlyRate !== s.hourlyRate || monthlySalary !== s.monthlySalary || annualSalary !== s.annualSalary || salaryCycle !== s.salaryCycle || salaryDay !== s.salaryDay || hireDate !== s.hireDate || probation !== s.probation || probationRate !== s.probationRate || probationStart !== s.probationStart || probationEnd !== s.probationEnd;
    }
    if (section === "세금") {
      if (isNew) return incomeTax.some(t => t.active) || socialInsurance.some(t => t.active);
      return JSON.stringify(incomeTax) !== s.incomeTax || JSON.stringify(socialInsurance) !== s.socialInsurance;
    }
    if (section === "인적사항") {
      if (isNew) return !!(bank || accountNumber);
      return bank !== s.bank || accountNumber !== s.accountNumber;
    }
    if (section === "메모") { if (isNew) return !!memo; return memo !== s.memo; }
    if (section === "계약서") return Object.values(docs).some((v) => v !== null && v.file !== null);
    if (section === "근무상태") { if (isNew) return !!workingStatus; return workingStatus !== s.workingStatus; }
    return false;
  })();

  const handleBack = () => { if (isDirty) setCancelConfirmOpen(true); else navigation.goBack(); };

  const currentDayOptions = PAY_DAY_OPTIONS[salaryCycle] ?? PAY_DAY_OPTIONS["월 1회 (월급)"];

  const toggleTax = (type: "income" | "social", key: string) => {
    if (taxErrorField === key) { setTaxErrorField(null); setTaxErrorMsg(""); }
    if (type === "income") setIncomeTax(prev => prev.map(t => t.key === key ? { ...t, active: !t.active } : t));
    else setSocialInsurance(prev => prev.map(t => t.key === key ? { ...t, active: !t.active } : t));
  };
  const openTaxRateSheet = (type: "income" | "social", tax: TaxItem) => {
    if (!tax.active || tax.key === "industrial") return;
    setFocusedTaxKey(tax.key);
    if (taxErrorField === tax.key) { setTaxErrorField(null); setTaxErrorMsg(""); }
    setTaxRateKey({ type, key: tax.key, title: `${tax.label} 세율 입력` });
    setTaxRateInput(tax.value);
    setShowTaxRateSheet(true);
  };
  const confirmTaxRate = () => {
    if (!taxRateKey) return;
    const { type, key } = taxRateKey;
    if (type === "income") setIncomeTax(prev => prev.map(t => t.key === key ? { ...t, value: taxRateInput } : t));
    else setSocialInsurance(prev => prev.map(t => t.key === key ? { ...t, value: taxRateInput } : t));
    setFocusedTaxKey(null);
    setTaxErrorField(null);
    setTaxErrorMsg("");
    setShowTaxRateSheet(false);
    setTaxRateKey(null);
  };

  const handleSaveClick = () => {
    if (section === "계약정보") {
      const errors: Record<string, string> = {};
      if (!employeeType) errors.employeeType = "고용 형태를 선택해주세요";
      if (!salaryType) errors.salaryType = "급여 형태를 선택해주세요";
      if (salaryType === "시급" && !hourlyRate) errors.hourlyRate = "시급을 입력해주세요";
      if (salaryType === "월급 (연봉 포함)" && !isAnnualSalary && !monthlySalary) errors.monthlySalary = "월급을 입력해주세요";
      if (isAnnualSalary && !annualSalary) errors.annualSalary = "연봉을 입력해주세요";
      if (!salaryDay) errors.salaryDay = "급여일을 선택해주세요";
      if (workSchedule.length === 0) errors.workSchedule = "근무일을 선택해주세요";
      if (probation && !probationRate) errors.probationRate = "수습 비율을 선택해주세요";
      if (probation && (!probationStart || !probationEnd)) errors.probationPeriod = !probationStart ? "수습 시작일을 선택해주세요" : "수습 종료일을 선택해주세요";
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const ORDER = ["employeeType", "salaryType", "hourlyRate", "monthlySalary", "annualSalary", "salaryDay", "workSchedule", "probationRate", "probationPeriod"];
        const firstKey = ORDER.find(k => errors[k]);
        if (firstKey && fieldYPos.current[firstKey] !== undefined) {
          mainScrollRef.current?.scrollTo({ y: Math.max(0, fieldYPos.current[firstKey] - 16), animated: true });
        }
        return;
      }
      setFieldErrors({});
    }
    if (section === "세금") {
      const allTaxes = [...incomeTax, ...socialInsurance];
      const errorItem = allTaxes.find(t => t.active && t.key !== "industrial" && !t.value.trim());
      if (errorItem) {
        setTaxErrorField(errorItem.key);
        setTaxErrorMsg("세율을 입력해주세요");
        return;
      }
    }
    if (section === "근무상태" && (workingStatus === "휴직" || workingStatus === "퇴사")) {
      setWorkStatusConfirm({ open: true, status: workingStatus });
      return;
    }
    setSaveConfirmOpen(true);
  };

  const pickDocFromAlbum = async () => {
    setShowDocSheet(false);
    await new Promise<void>((r) => setTimeout(r, 350));
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
    if (!res.canceled && res.assets[0] && docUploadTarget) {
      const a = res.assets[0];
      const webFile: File | undefined = (a as any).file;
      const rawName = webFile?.name ?? a.fileName ?? "";
      const cleanName = rawName && !rawName.startsWith("blob:") ? rawName : `${docUploadTarget}_${Date.now()}.jpg`;
      const fileObj: DocFile = { uri: a.uri, name: cleanName, type: a.mimeType ?? "image/jpeg", ...(webFile ? { webFile } : {}) };
      setDocs((prev) => ({ ...prev, [docUploadTarget]: { name: fileObj.name, file: fileObj } }));
      setDeletedDocKeys((prev) => prev.filter((f) => f !== DOC_BACKEND_KEY[docUploadTarget]));
      setDocUploadTarget(null);
    }
  };
  const pickDocFromCamera = async () => {
    setShowDocSheet(false);
    await new Promise<void>((r) => setTimeout(r, 350));
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0] && docUploadTarget) {
      const a = res.assets[0];
      const webFile: File | undefined = (a as any).file;
      const rawName = webFile?.name ?? a.fileName ?? "";
      const cleanName = rawName && !rawName.startsWith("blob:") ? rawName : `${docUploadTarget}_${Date.now()}.jpg`;
      const fileObj: DocFile = { uri: a.uri, name: cleanName, type: a.mimeType ?? "image/jpeg", ...(webFile ? { webFile } : {}) };
      setDocs((prev) => ({ ...prev, [docUploadTarget]: { name: fileObj.name, file: fileObj } }));
      setDeletedDocKeys((prev) => prev.filter((f) => f !== DOC_BACKEND_KEY[docUploadTarget]));
      setDocUploadTarget(null);
    }
  };

  // ── 예상 급여 계산 ─────────────────────────────────────
  const salaryPreview = (() => {
    const totalWeeklyHours = workSchedule.reduce((sum, ws) => {
      const parts = ws.time.split(" ~ ");
      if (parts.length < 2) return sum;
      const toH = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };
      return sum + Math.max(0, toH(parts[1]) - toH(parts[0]));
    }, 0);
    if (totalWeeklyHours === 0) return null;
    const probRate = probation && probationRate ? parseFloat(probationRate) / 100 : 1;
    const holidayHours = salaryType === "시급" && includeHolidayPay && totalWeeklyHours >= 15
      ? (totalWeeklyHours / 40) * 8 : 0;
    let amount = 0;
    let label = "";
    if (salaryType === "시급" && hourlyRate) {
      const hourly = Number(hourlyRate);
      const weeklyPay = (totalWeeklyHours + holidayHours) * hourly;
      if (salaryCycle === "주급") { label = "주 급여 예상"; amount = Math.round(weeklyPay * probRate); }
      else if (salaryCycle === "월 2회") { label = "2주 급여 예상"; amount = Math.round(weeklyPay * 2 * probRate); }
      else { label = "월 급여 예상"; amount = Math.round(weeklyPay * 4 * probRate); }
    } else if (salaryType === "월급 (연봉 포함)" && !isAnnualSalary && monthlySalary) {
      label = "월 급여 예상";
      amount = Math.round(Number(monthlySalary) * probRate);
    } else if (isAnnualSalary && annualSalary) {
      label = "월 급여 예상";
      amount = Math.round((Number(annualSalary) / 12) * probRate);
    }
    if (!amount) return null;
    return { label, amount, hasHoliday: holidayHours > 0, hasProbation: probation && probationRate && parseFloat(probationRate) < 100 };
  })();

  // ── 예상 급여 (세후) 계산 ─────────────────────────────
  const afterTaxPreview = (() => {
    let grossMonthly = 0;
    if (salaryType === "시급" && hourlyRate) {
      const totalWeeklyHours = workSchedule.reduce((sum, ws) => {
        const parts = ws.time.split(" ~ ");
        if (parts.length < 2) return sum;
        const toH = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };
        return sum + Math.max(0, toH(parts[1]) - toH(parts[0]));
      }, 0);
      if (totalWeeklyHours === 0) return null;
      const holidayHours = includeHolidayPay && totalWeeklyHours >= 15 ? (totalWeeklyHours / 40) * 8 : 0;
      grossMonthly = (totalWeeklyHours + holidayHours) * Number(hourlyRate) * 4;
    } else if (salaryType === "월급 (연봉 포함)" && !isAnnualSalary && monthlySalary) {
      grossMonthly = Number(monthlySalary);
    } else if (isAnnualSalary && annualSalary) {
      grossMonthly = Number(annualSalary) / 12;
    }
    if (!grossMonthly) return null;

    const probRate = probation && probationRate ? parseFloat(probationRate) / 100 : 1;
    const base = Math.round(grossMonthly * probRate);

    const allTaxes = [...incomeTax, ...socialInsurance];
    const hasAnyTax = allTaxes.some(t => t.active && t.key !== "industrial" && t.value);
    if (!hasAnyTax) return null;

    const healthItem = socialInsurance.find(t => t.key === "health");
    const healthAmount = (healthItem?.active && healthItem.value)
      ? Math.round(base * parseFloat(healthItem.value) / 100)
      : 0;

    let totalDeduction = 0;
    for (const t of allTaxes) {
      if (!t.active || t.key === "industrial" || !t.value) continue;
      const rate = parseFloat(t.value);
      if (isNaN(rate)) continue;
      totalDeduction += t.key === "longterm"
        ? Math.round(healthAmount * rate / 100)
        : Math.round(base * rate / 100);
    }

    return { gross: base, net: base - totalDeduction, deduction: totalDeduction };
  })();

  // ── 순차 노출 게이트 (등록 모드에서만) ─────────────────────
  const pm = isNewRegistration;
  const hasSalaryAmt = !!(hourlyRate || monthlySalary || annualSalary);
  const showSalaryType = !pm || !!employeeType;
  const showSalaryAmt  = !pm || (!!employeeType && !!salaryType);
  const showRest       = !pm || (!!employeeType && !!salaryType && hasSalaryAmt);

  // ── 렌더 ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#FFFFFF" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 8 }}>
          <Pressable onPress={handleBack} style={{ padding: 4 }} hitSlop={8}>
            <ChevronLeft size={24} color="#19191B" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#19191B", letterSpacing: -0.36 }}>{title}</Text>
        </View>

        {staffName ? (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Avatar imageUrl={staffImageUrl} name={staffName} size={90} defaultSource={STAFF_ICON} />
            <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#19191B", marginTop: 12 }}>{staffName}</Text>
          </View>
        ) : null}

        <View style={{ height: 12, backgroundColor: "#F7F7F8" }} />

        <ScrollView showsHorizontalScrollIndicator={false} ref={mainScrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 20 }}>

            {/* ── 계약정보 ── */}
            {section === "계약정보" && (
              <>
                {/* 고용 형태 — 항상 노출 */}
                <SelectFieldRow label="고용 형태" required value={employeeType} placeholder="고용 형태 선택"
                  error={fieldErrors.employeeType}
                  onLayout={e => { fieldYPos.current.employeeType = e.nativeEvent.layout.y; }}
                  onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.employeeType; return n; }); setShowTypeSheet(true); }} />

                {/* 급여 형태 — 고용 형태 선택 후 노출 */}
                {showSalaryType && (
                  <SelectFieldRow label="급여 형태" required value={salaryType} placeholder="급여 형태 선택"
                    error={fieldErrors.salaryType}
                    onLayout={e => { fieldYPos.current.salaryType = e.nativeEvent.layout.y; }}
                    onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.salaryType; return n; }); setShowSalaryTypeSheet(true); }} />
                )}

                {/* 급여 금액 — 급여 형태 선택 후 노출 */}
                {showSalaryAmt && (
                  <>
                    {salaryType === "월급 (연봉 포함)" && (
                      <ToggleRow label="연봉 계약" value={isAnnualSalary} onChange={v => { setIsAnnualSalary(v); if (!v) setAnnualSalary(""); }} />
                    )}
                    {salaryType === "시급" && (
                      <SelectFieldRow
                        label="시급" required
                        value={hourlyRate ? `${Number(hourlyRate).toLocaleString()}원` : ""}
                        placeholder="시급 입력"
                        error={fieldErrors.hourlyRate}
                        onLayout={e => { fieldYPos.current.hourlyRate = e.nativeEvent.layout.y; }}
                        onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.hourlyRate; return n; }); setShowSalaryInputSheet(true); }}
                      />
                    )}
                    {salaryType === "월급 (연봉 포함)" && !isAnnualSalary && (
                      <SelectFieldRow
                        label="월급" required
                        value={monthlySalary ? `${Number(monthlySalary).toLocaleString()}원` : ""}
                        placeholder="월급 입력"
                        error={fieldErrors.monthlySalary}
                        onLayout={e => { fieldYPos.current.monthlySalary = e.nativeEvent.layout.y; }}
                        onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.monthlySalary; return n; }); setShowSalaryInputSheet(true); }}
                      />
                    )}
                    {salaryType === "월급 (연봉 포함)" && isAnnualSalary && (
                      <>
                        <SelectFieldRow
                          label="연봉 (세전)" required
                          value={annualSalary ? `${Number(annualSalary).toLocaleString()}원` : ""}
                          placeholder="연봉 입력"
                          error={fieldErrors.annualSalary}
                          onLayout={e => { fieldYPos.current.annualSalary = e.nativeEvent.layout.y; }}
                          onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.annualSalary; return n; }); setShowAnnualInputSheet(true); }}
                        />
                        <FieldBlock label="월 지급액 자동 계산 (세전)">
                          <View style={{ height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#F0F0F0", backgroundColor: "#F7F7F8", justifyContent: "center" }}>
                            <Text style={{ fontSize: 16, fontWeight: "500", color: annualSalary ? "#19191B" : "#9EA3AD" }}>
                              {annualSalary ? `${Math.round(Number(annualSalary) / 12).toLocaleString()}원` : "연봉 입력 시 자동 계산"}
                            </Text>
                          </View>
                        </FieldBlock>
                      </>
                    )}
                  </>
                )}

                {/* 나머지 필드 — 급여 금액 입력 후 노출 */}
                {showRest && (
                  <>
                    {salaryType === "시급" && (
                      <SelectFieldRow label="급여 지급 주기" required value={salaryCycle} placeholder="급여 주기 선택" onTap={() => setShowCycleSheet(true)} />
                    )}
                    <SelectFieldRow label="급여일" required value={salaryDay}
                      placeholder={salaryCycle === "주급" ? "매주 요일 선택" : salaryCycle === "월 2회" ? "지급일 선택" : "급여일 선택"}
                      error={fieldErrors.salaryDay}
                      onLayout={e => { fieldYPos.current.salaryDay = e.nativeEvent.layout.y; }}
                      onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.salaryDay; return n; }); setShowDaySheet(true); }} />
                    <ToggleRow
                      label="수습 적용"
                      value={probation}
                      onChange={v => { setProbation(v); if (!v) { setProbationRate(""); setProbationStart(""); setProbationEnd(""); } }}
                      subText="*해당 직원이 수습기간이 필요한 직원이면 선택해주세요"
                    />
                    {probation && (
                      <>
                        <SelectFieldRow label="수습 비율" required value={probationRate} placeholder="수습 비율 선택"
                          error={fieldErrors.probationRate}
                          onLayout={e => { fieldYPos.current.probationRate = e.nativeEvent.layout.y; }}
                          onTap={() => { setFieldErrors(p => { const n = {...p}; delete n.probationRate; return n; }); setShowProbationSheet(true); }} />
                        <FieldBlock label="수습 기간" required
                          error={fieldErrors.probationPeriod}
                          onLayout={e => { fieldYPos.current.probationPeriod = e.nativeEvent.layout.y; }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <AnimatedPressable onPress={() => { setFieldErrors(p => { const n = {...p}; delete n.probationPeriod; return n; }); setShowProbStartSheet(true); }} scaleAmount={0.98} opacityAmount={0.85}
                              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: (fieldErrors.probationPeriod && !probationStart) ? "#FF3D3D" : "#DBDCDF", backgroundColor: "#FFFFFF" }}>
                              <Text style={{ fontSize: 15, fontWeight: "500", color: probationStart ? "#19191B" : "#AAB4BF" }}>{probationStart || "시작일"}</Text>
                              <ChevronDown size={14} color="#9EA3AD" />
                            </AnimatedPressable>
                            <Text style={{ fontSize: 14, color: "#70737B" }}>~</Text>
                            <AnimatedPressable onPress={() => { setFieldErrors(p => { const n = {...p}; delete n.probationPeriod; return n; }); setShowProbEndSheet(true); }} scaleAmount={0.98} opacityAmount={0.85}
                              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: (fieldErrors.probationPeriod && probationStart && !probationEnd) ? "#FF3D3D" : "#DBDCDF", backgroundColor: "#FFFFFF" }}>
                              <Text style={{ fontSize: 15, fontWeight: "500", color: probationEnd ? "#19191B" : "#AAB4BF" }}>{probationEnd || "종료일"}</Text>
                              <ChevronDown size={14} color="#9EA3AD" />
                            </AnimatedPressable>
                          </View>
                        </FieldBlock>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: "#4261FF", marginTop: -8, marginBottom: 16, lineHeight: 20 }}>
                          *수습 기간 동안 설정한 비율로 급여가 지급돼요. 기간이 종료되면 자동으로 해제되고 정상 급여로 전환돼요.
                        </Text>
                      </>
                    )}
                    {salaryType === "시급" && (
                      <ToggleRow
                        label="주휴 포함"
                        value={includeHolidayPay}
                        onChange={setIncludeHolidayPay}
                        subText={includeHolidayPay ? "*주 15시간 이상 만근 시 주휴수당이 자동 발생해요" : undefined}
                      />
                    )}
                    <ToggleRow label="휴게 포함" value={includeBreakTime} onChange={v => { setIncludeBreakTime(v); }} />
                    {includeBreakTime && (
                      <>
                        <SelectFieldRow label="휴게 시간" required value={`${breakMinutes}분`} placeholder="휴게 시간 선택" onTap={() => setShowBreakSheet(true)} />
                        <Text style={{ fontSize: 14, color: "#70737B", marginTop: -8, marginBottom: 16 }}>*근무 시간에서 휴게 시간이 제외되어 급여가 계산돼요</Text>
                      </>
                    )}
                    <FieldBlock label="근무일" required error={fieldErrors.workSchedule} onLayout={e => { fieldYPos.current.workSchedule = e.nativeEvent.layout.y; }}>
                      <AnimatedPressable
                        onPress={() => { setFieldErrors(p => { const n = {...p}; delete n.workSchedule; return n; }); setWdStep("list"); setWdListSel([]); setShowWorkDaySheet(true); }}
                        scaleAmount={0.98} opacityAmount={0.85}
                        style={{ borderWidth: 1, borderColor: fieldErrors.workSchedule ? "#FF3D3D" : "#DBDCDF", borderRadius: 10, minHeight: 48, paddingHorizontal: 16, paddingVertical: workSchedule.length > 0 ? 12 : 0, backgroundColor: "#FFFFFF", justifyContent: "center" }}
                      >
                        {workSchedule.length === 0 ? (
                          <Text style={{ fontSize: 16, fontWeight: "500", color: "#AAB4BF", lineHeight: 48 }}>근무일 선택</Text>
                        ) : (
                          <View style={{ gap: 8 }}>
                            {workSchedule.map((ws) => (
                              <View key={ws.day} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <View style={{ flexDirection: "row", gap: 4 }}>
                                  {ws.shifts.map(s => (
                                    <View key={s} style={{ backgroundColor: getShiftStyle(s).bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                      <Text style={{ fontSize: 11, fontWeight: "500", color: getShiftStyle(s).text }}>{s}</Text>
                                    </View>
                                  ))}
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: "600", color: "#19191B", width: 16 }}>{ws.day}</Text>
                                <Text style={{ fontSize: 14, color: "#19191B", flex: 1 }}>{ws.time}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </AnimatedPressable>
                      <Text style={{ fontSize: 14, color: "#70737B", marginTop: 6 }}>*해당 직원이 근무할 요일의 파트를 선택해주세요</Text>
                    </FieldBlock>
                    {/* 입사일 — 자동 세팅되므로 마지막에 확인/수정 */}
                    <SelectFieldRow label="입사일" value={hireDate} placeholder="입사일 선택" onTap={() => setShowHireDateSheet(true)} />
                  </>
                )}

                {salaryPreview && (
                  <View style={{ marginTop: 8, padding: 14, backgroundColor: "#F0F3FF", borderRadius: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: (salaryPreview.hasHoliday || salaryPreview.hasProbation) ? 8 : 0 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF" }}>예상 급여 (세전)</Text>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#4261FF" }}>{salaryPreview.amount.toLocaleString()}원</Text>
                    </View>
                    {(salaryPreview.hasHoliday || salaryPreview.hasProbation) && (
                      <View style={{ gap: 2, marginBottom: 8 }}>
                        {salaryPreview.hasProbation && <Text style={{ fontSize: 14, color: "#70737B" }}>*수습 {probationRate} 적용</Text>}
                        {salaryPreview.hasHoliday && <Text style={{ fontSize: 14, color: "#70737B" }}>*주휴수당 포함</Text>}
                      </View>
                    )}
                    <Text style={{ fontSize: 13, color: "#9EA3AD" }}>*세금 공제 전 금액으로 실수령액과 다를 수 있어요</Text>
                    <Text style={{ fontSize: 13, color: "#9EA3AD" }}>*월 환산은 4주 기준이에요</Text>
                  </View>
                )}
              </>
            )}

            {/* ── 세금 ── */}
            {section === "세금" && (
              <>
                <Text style={{ fontSize: 13, color: "#70737B", marginBottom: 16, lineHeight: 20 }}>
                  *해당 직원이 부담해야 하는 세금 항목을 선택 후 세율을 입력해주세요
                </Text>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 8 }}>소득세</Text>
                  {incomeTax.map(tax => (
                    <TaxItemRow
                      key={tax.key} tax={tax}
                      onToggle={() => toggleTax("income", tax.key)}
                      onEdit={() => openTaxRateSheet("income", tax)}
                      isError={taxErrorField === tax.key}
                      isFocused={focusedTaxKey === tax.key}
                    />
                  ))}
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 8 }}>4대 보험</Text>
                  {socialInsurance.map(tax => (
                    <View key={tax.key}>
                      <TaxItemRow
                        tax={tax}
                        onToggle={() => toggleTax("social", tax.key)}
                        onEdit={() => openTaxRateSheet("social", tax)}
                        isError={taxErrorField === tax.key}
                        isFocused={focusedTaxKey === tax.key}
                      />
                      {tax.key === "industrial" && (
                        <Text style={{ fontSize: 13, color: "#9EA3AD", marginTop: -4, marginBottom: 8 }}>
                          *산재보험은 사업주가 전액 부담하는 보험으로 급여 공제 항목에 포함되지 않아요
                        </Text>
                      )}
                    </View>
                  ))}
                </View>

                {/* 예상 급여 (세후) 미리보기 */}
                {afterTaxPreview && (
                  <View style={{ marginTop: 16, padding: 14, backgroundColor: "#F0F3FF", borderRadius: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF", marginBottom: 12 }}>예상 급여 (세후) 미리보기</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, color: "#70737B" }}>세전 월급여</Text>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{`${afterTaxPreview.gross.toLocaleString()}원`}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 14, color: "#70737B" }}>총 공제액</Text>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#FF3D3D" }}>{`-${afterTaxPreview.deduction.toLocaleString()}원`}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: "#E2E8FF", marginVertical: 10 }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#4261FF" }}>예상 실수령액</Text>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#4261FF" }}>{`${afterTaxPreview.net.toLocaleString()}원`}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: "#9EA3AD", marginTop: 8 }}>*세금 설정에 따른 예상 금액으로 실제와 다를 수 있어요</Text>
                  </View>
                )}
              </>
            )}

            {/* ── 인적사항 ── */}
            {section === "인적사항" && (
              <>
                <ReadOnlyRow label="생년월일" value={birth || "-"} />
                <ReadOnlyRow label="성별" value={gender || "-"} />
                <ReadOnlyRow label="전화번호" value={phone || "-"} />
                <FieldBlock label="은행">
                  <AnimatedPressable onPress={() => setShowBankSheet(true)} scaleAmount={0.98} opacityAmount={0.85}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#DBDCDF", backgroundColor: "#FFFFFF" }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: bank ? "#19191B" : "#AAB4BF" }}>{bank || "은행 선택"}</Text>
                    <ChevronDown size={16} color="#9EA3AD" />
                  </AnimatedPressable>
                </FieldBlock>
                <FieldBlock label="계좌번호">
                  <AnimatedPressable onPress={() => { setAccountInput(accountNumber); setShowAccountSheet(true); }} scaleAmount={0.98} opacityAmount={0.85}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#DBDCDF", backgroundColor: "#FFFFFF" }}>
                    <Text style={{ fontSize: 16, fontWeight: "500", color: accountNumber ? "#19191B" : "#AAB4BF" }}>{accountNumber || "미입력"}</Text>
                    <ChevronDown size={16} color="#9EA3AD" />
                  </AnimatedPressable>
                </FieldBlock>
              </>
            )}

            {/* ── 메모 ── */}
            {section === "메모" && (
              <FieldBlock label="메모 내용">
                <FocusInput value={memo} onChangeText={setMemo} placeholder="메모를 입력해주세요" placeholderTextColor="#AAB4BF" multiline
                  style={[{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 120, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", textAlignVertical: "top", outline: "none", boxShadow: "none" } as any]} />
              </FieldBlock>
            )}

            {/* ── 계약서 ── */}
            {section === "계약서" && (
              <View style={{ gap: 12 }}>
                {DOC_LIST.map((doc) => {
                  const entry = docs[doc.key];
                  const isUploaded = !!entry;
                  const isExisting = isUploaded && !entry.file;
                  const isNew = isUploaded && !!entry.file;
                  return (
                    <View key={doc.key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B", width: 80, flexShrink: 0 }}>{doc.label}</Text>
                      {isExisting ? (
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <AnimatedPressable
                            onPress={() => entry.url && setDocPreview({ uri: entry.url, label: doc.label })}
                            scaleAmount={0.97} opacityAmount={0.8}
                            style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: "#F0F3FF", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#4261FF" }}>{doc.label} 보기</Text>
                          </AnimatedPressable>
                          <AnimatedPressable
                            onPress={() => { setDocUploadTarget(doc.key); setShowDocSheet(true); }}
                            scaleAmount={0.88} opacityAmount={0.7}
                            style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#F7F7F8", alignItems: "center", justifyContent: "center" }}>
                            <RefreshCw size={15} color="#70737B" />
                          </AnimatedPressable>
                          <AnimatedPressable
                            onPress={() => setDeleteDocConfirm({ open: true, key: doc.key })}
                            scaleAmount={0.88} opacityAmount={0.7}
                            style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF0EE", alignItems: "center", justifyContent: "center" }}>
                            <X size={15} color="#FF5959" />
                          </AnimatedPressable>
                        </View>
                      ) : isNew ? (
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <AnimatedPressable
                            onPress={() => entry.file && setDocPreview({ uri: entry.file.uri, label: doc.label })}
                            scaleAmount={0.97} opacityAmount={0.8} style={{ flex: 1, height: 36, justifyContent: "center" }}>
                            <Text style={{ fontSize: 13, color: "#4261FF" }} numberOfLines={1}>{entry.name}</Text>
                          </AnimatedPressable>
                          <AnimatedPressable
                            onPress={() => setDeleteDocConfirm({ open: true, key: doc.key })}
                            scaleAmount={0.88} opacityAmount={0.7}
                            style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF0EE", alignItems: "center", justifyContent: "center" }}>
                            <X size={15} color="#FF5959" />
                          </AnimatedPressable>
                        </View>
                      ) : (
                        <AnimatedPressable onPress={() => { setDocUploadTarget(doc.key); setShowDocSheet(true); }} scaleAmount={0.97} opacityAmount={0.8}
                          style={{ flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: "#EBEBEB", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 14, fontWeight: "500", color: "#19191B" }}>{doc.label} 업로드하기</Text>
                        </AnimatedPressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── 근무상태 ── */}
            {section === "근무상태" && (
              <SelectFieldRow label="근무 상태" required value={workingStatus} placeholder="근무 상태 선택" onTap={() => setShowStatusSheet(true)} />
            )}
          </View>
        </ScrollView>

        {/* Bottom Buttons */}
        <View style={{ backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#F7F7F8", paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", gap: 8 }}>
          <AnimatedPressable onPress={handleBack} scaleAmount={0.97} opacityAmount={0.75}
            style={{ width: 122, height: 56, borderRadius: 16, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>취소</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={handleSaveClick} scaleAmount={0.97} opacityAmount={0.75}
            style={{ flex: 1, height: 56, borderRadius: 16, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>저장하기</Text>
          </AnimatedPressable>
        </View>

        {/* ── 날짜 피커 바텀시트 ── */}
        <DatePickerSheet isOpen={showHireDateSheet} onClose={() => setShowHireDateSheet(false)} title="입사일 선택하기" value={hireDate} onConfirm={setHireDate} />
        <DatePickerSheet isOpen={showProbStartSheet} onClose={() => setShowProbStartSheet(false)} title="수습 시작일 선택하기" value={probationStart} onConfirm={(v) => { setProbationStart(v); if (!probationEnd) setProbationEnd(v); }} minDate="2026.01.01" />
        <DatePickerSheet isOpen={showProbEndSheet} onClose={() => setShowProbEndSheet(false)} title="수습 종료일 선택하기" value={probationEnd} onConfirm={setProbationEnd} minDate={probationStart || "2026.01.01"} />

        {/* ── 급여 입력 바텀시트 ── */}
        <SalaryInputSheet
          isOpen={showSalaryInputSheet} onClose={() => setShowSalaryInputSheet(false)}
          title={salaryType === "월급 (연봉 포함)" ? "월급 입력하기" : "시급 입력하기"}
          value={salaryType === "시급" ? hourlyRate : monthlySalary}
          onConfirm={v => { if (salaryType === "시급") setHourlyRate(v); else setMonthlySalary(v); }}
          placeholder="숫자만 입력"
          subText={salaryType === "시급" ? "2026년 최저시급은 시간당 10,320원이에요" : "주 40시간(월 209시간) 기준 최저 월급은 2,156,880원이에요"}
          minAmount={salaryType === "시급" ? 10320 : 2156880}
          errorText={salaryType === "시급" ? "최저시급 10,320원 미만은 입력할 수 없어요" : "최저 월급 2,156,880원 미만은 입력할 수 없어요"}
        />
        <SalaryInputSheet
          isOpen={showAnnualInputSheet} onClose={() => setShowAnnualInputSheet(false)}
          title="연봉 입력하기"
          value={annualSalary}
          onConfirm={setAnnualSalary}
          placeholder="숫자만 입력"
          subText={"주 40시간 기준 최저 연봉은 25,882,560원이에요"}
          minAmount={25882560}
          errorText="최저 연봉 25,882,560원 미만은 입력할 수 없어요"
        />

        {/* ── 고용 형태 ── */}
        <BottomSheet isOpen={showTypeSheet} onClose={() => setShowTypeSheet(false)} title="고용 형태 선택하기">
          <View style={{ gap: 4 }}>
            {EMPLOYEE_TYPES.map((t) => {
              const sel = employeeType === t;
              return (
                <AnimatedPressable key={t} onPress={() => { setEmployeeType(t); setShowTypeSheet(false); }} scaleAmount={0.98} opacityAmount={0.85}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                  <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{t}</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </BottomSheet>

        {/* ── 급여 형태 ── */}
        <BottomSheet isOpen={showSalaryTypeSheet} onClose={() => setShowSalaryTypeSheet(false)} title="급여 형태 선택하기">
          <View style={{ gap: 4 }}>
            {SALARY_TYPES.map((t) => {
              const sel = salaryType === t;
              return (
                <AnimatedPressable key={t} onPress={() => { setSalaryType(t); setHourlyRate(""); setMonthlySalary(""); setSalaryCycle(""); setSalaryDay(""); setShowSalaryTypeSheet(false); }} scaleAmount={0.98} opacityAmount={0.85}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                  <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{t}</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </BottomSheet>

        {/* ── 급여 주기 ── */}
        <BottomSheet isOpen={showCycleSheet} onClose={() => setShowCycleSheet(false)} title="지급 주기 선택하기">
          <View style={{ gap: 4 }}>
            {SALARY_CYCLES.map((c) => {
              const sel = salaryCycle === c;
              return (
                <AnimatedPressable key={c} onPress={() => { setSalaryCycle(c); setSalaryDay(""); setShowCycleSheet(false); }} scaleAmount={0.98} opacityAmount={0.85}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                  <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{c}</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </BottomSheet>

        {/* ── 급여일 ── */}
        <BottomSheet isOpen={showDaySheet} onClose={() => setShowDaySheet(false)} title="급여일 선택하기">
          <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 4 }}>
              {currentDayOptions.map((d) => {
                const sel = salaryDay === d;
                return (
                  <AnimatedPressable key={d} onPress={() => { setSalaryDay(d); setShowDaySheet(false); }} scaleAmount={0.98} opacityAmount={0.85}
                    style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                    <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{d}</Text>
                    {sel && <Check size={20} color="#4261FF" />}
                  </AnimatedPressable>
                );
              })}
            </View>
          </ScrollView>
        </BottomSheet>

        {/* ── 세율 입력 ── */}
        <BottomSheet isOpen={showTaxRateSheet} onClose={() => setShowTaxRateSheet(false)} title={taxRateKey?.title ?? "세율 입력"}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {taxRateKey?.key === "longterm" && <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B" }}>건강보험의</Text>}
              <FocusInput value={taxRateInput} onChangeText={setTaxRateInput} placeholder="세율 입력" placeholderTextColor="#AAB4BF" keyboardType="decimal-pad"
                style={[{ flex: 1, borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", outline: "none", boxShadow: "none" } as any]} />
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B" }}>%</Text>
            </View>
            <AnimatedPressable onPress={confirmTaxRate} scaleAmount={0.97} opacityAmount={0.75}
              style={{ height: 52, borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>확인</Text>
            </AnimatedPressable>
          </View>
        </BottomSheet>

        {/* ── 은행 선택 ── */}
        <BottomSheet isOpen={showBankSheet} onClose={() => setShowBankSheet(false)} title="은행을 선택해주세요">
          <ScrollView showsHorizontalScrollIndicator={false} style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {BANK_LIST.map((b) => {
                const sel = bank === b;
                const logo = BANK_LOGOS[b];
                return (
                  <AnimatedPressable key={b} onPress={() => { setBank(b); setShowBankSheet(false); }} scaleAmount={0.97} opacityAmount={0.85}
                    style={{ width: "33.33%", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: sel ? "#EEF2FF" : "#F7F7F8", borderWidth: 2, borderColor: sel ? "#4261FF" : "transparent", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {logo ? (
                        <Image source={logo} style={{ width: 38, height: 38 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: 15, fontWeight: "700", color: sel ? "#4261FF" : "#70737B" }}>{b.charAt(0)}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : "#19191B", marginTop: 6, textAlign: "center" }} numberOfLines={2}>{b}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </ScrollView>
        </BottomSheet>

        {/* ── 계좌번호 입력 ── */}
        <BottomSheet isOpen={showAccountSheet} onClose={() => setShowAccountSheet(false)} title="계좌번호 입력하기">
          <View style={{ gap: 16 }}>
            <FocusInput value={accountInput} onChangeText={(t) => setAccountInput(t.replace(/[^0-9-]/g, ""))} placeholder="'-' 포함 입력" placeholderTextColor="#AAB4BF" keyboardType="default"
              style={[{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", outline: "none", boxShadow: "none" } as any]} />
            <AnimatedPressable onPress={() => { if (accountInput.trim()) { setAccountNumber(accountInput.trim()); setShowAccountSheet(false); } }} scaleAmount={0.97} opacityAmount={0.75}
              style={{ height: 52, borderRadius: 14, backgroundColor: accountInput.trim() ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>입력 완료</Text>
            </AnimatedPressable>
          </View>
        </BottomSheet>

        {/* ── 수습 비율 ── */}
        <BottomSheet isOpen={showProbationSheet} onClose={() => setShowProbationSheet(false)} title="수습 비율 선택하기">
          <View style={{ gap: 4 }}>
            {PROBATION_RATES.map((r) => {
              const sel = probationRate === r;
              return (
                <AnimatedPressable key={r} onPress={() => { setProbationRate(r); setShowProbationSheet(false); }} scaleAmount={0.98} opacityAmount={0.85}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                  <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{r}</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </BottomSheet>

        {/* ── 휴게 시간 ── */}
        <BottomSheet isOpen={showBreakSheet} onClose={() => setShowBreakSheet(false)} title="휴게 시간 선택하기">
          <View style={{ gap: 4 }}>
            {BREAK_TIME_OPTIONS.map((m) => {
              const sel = breakMinutes === m;
              return (
                <AnimatedPressable key={m} onPress={() => { setBreakMinutes(m); setShowBreakSheet(false); }} scaleAmount={0.98} opacityAmount={0.85}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                  <Text style={{ fontSize: 15, color: sel ? "#4261FF" : "#19191B", fontWeight: sel ? "500" : "400" }}>{m}분</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </BottomSheet>

        {/* ── 근무상태 ── */}
        <BottomSheet isOpen={showStatusSheet} onClose={() => setShowStatusSheet(false)} title="근무 상태 선택하기">
          <View style={{ gap: 4 }}>
            {WORKING_STATUSES.map((s) => {
              const sel = workingStatus === s;
              const isWarn = s === "퇴사";
              return (
                <AnimatedPressable
                  key={s}
                  onPress={() => {
                    setWorkingStatus(s);
                    setShowStatusSheet(false);
                  }}
                  scaleAmount={0.98} opacityAmount={0.85}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: sel ? "rgba(66,97,255,0.1)" : "transparent" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: sel ? "600" : "400", color: sel ? "#4261FF" : isWarn ? "#FF5959" : "#19191B" }}>{s}</Text>
                  {sel && <Check size={20} color="#4261FF" />}
                </AnimatedPressable>
              );
            })}
          </View>
        </BottomSheet>

        {/* ── 근무일 4단계 바텀시트 ── */}
        <BottomSheet
          isOpen={showWorkDaySheet}
          onClose={() => { setShowWorkDaySheet(false); setWdStep("list"); setWdListSel([]); setWdIsEdit(false); }}
          title={wdStep === "list" ? "근무일 선택하기" : wdStep === "deleteConfirm" ? "근무일 삭제하기" : wdIsEdit ? "근무일 수정하기" : "근무일 추가하기"}
        >
          {/* step: list */}
          {wdStep === "list" && (
            <View>
              {workSchedule.length === 0 ? (
                <Text style={{ fontSize: 14, color: "#9EA3AD", textAlign: "center", paddingVertical: 32 }}>근무일을 추가해 주세요</Text>
              ) : (
                <View style={{ gap: 4, marginBottom: 8 }}>
                  {workSchedule.map((ws) => {
                    const isSel = wdListSel.includes(ws.day);
                    return (
                      <AnimatedPressable key={ws.day}
                        onPress={() => setWdListSel(p => p.includes(ws.day) ? p.filter(d => d !== ws.day) : [...p, ws.day])}
                        scaleAmount={0.98} opacityAmount={0.85}
                        style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: isSel ? "rgba(66,97,255,0.1)" : "transparent" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ flexDirection: "row", gap: 4 }}>
                            {ws.shifts.map(s => (
                              <View key={s} style={{ backgroundColor: getShiftStyle(s).bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 11, fontWeight: "500", color: getShiftStyle(s).text }}>{s}</Text>
                              </View>
                            ))}
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: "500", color: isSel ? "#4261FF" : "#19191B" }}>{ws.day} ({ws.time})</Text>
                        </View>
                        {isSel && <Check size={20} color="#4261FF" />}
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                <AnimatedPressable
                  onPress={() => { if (wdListSel.length > 0) setWdStep("deleteConfirm"); }}
                  scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: wdListSel.length > 0 ? "#FF5959" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>삭제하기</Text>
                </AnimatedPressable>
                {wdListSel.length === 1 ? (
                  <AnimatedPressable
                    onPress={() => {
                      const ws = workSchedule.find(w => w.day === wdListSel[0]);
                      if (!ws) return;
                      const [start, end] = ws.time.split(" ~ ");
                      setWdDay(ws.day);
                      setWdShifts([...ws.shifts]);
                      setWdStart(start || "09:00");
                      setWdEnd(end || "18:00");
                      setWdIsEdit(true);
                      setWdStep("day");
                    }}
                    scaleAmount={0.97} opacityAmount={0.75}
                    style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#4261FF", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>수정하기</Text>
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable
                    onPress={() => { setWdDay(""); setWdShifts([]); setWdStart("09:00"); setWdEnd("18:00"); setWdIsEdit(false); setWdStep("day"); }}
                    scaleAmount={0.97} opacityAmount={0.75}
                    style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>추가하기</Text>
                  </AnimatedPressable>
                )}
              </View>
            </View>
          )}

          {/* step: day */}
          {wdStep === "day" && (
            <View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>근무 요일을 선택해주세요</Text>
              <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
                {WORK_DAYS.map((day) => {
                  const sel = wdDay === day;
                  // 수정 모드: 이미 등록된 다른 요일은 선택 불가 (중복 방지)
                  const takenByOther = !sel && workSchedule.some(w => w.day === day && w.day !== wdListSel[0]);
                  return (
                    <AnimatedPressable key={day} onPress={() => { if (!takenByOther) setWdDay(day); }} scaleAmount={0.97} opacityAmount={takenByOther ? 0.4 : 0.85}
                      style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: sel ? "#4261FF" : "#F7F7F8", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: sel ? "#4261FF" : "#DBDCDF" }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: sel ? "#FFFFFF" : "#70737B" }}>{day}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AnimatedPressable onPress={() => setWdStep("list")} scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>이전</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => { if (!wdDay) return; setWdStep("shifts"); }} scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 2, height: 52, borderRadius: 14, backgroundColor: wdDay ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>다음</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}

          {/* step: shifts (multi-select) */}
          {wdStep === "shifts" && (
            <View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                <Text style={{ color: "#4261FF" }}>[{wdDay}요일]</Text> 일정 파트를 선택해주세요
              </Text>
              {storeShifts.filter(sh => sh.is_active).length === 0 ? (
                <Text style={{ fontSize: 14, color: "#9EA3AD", textAlign: "center", paddingVertical: 24 }}>
                  매장 관리에서 파트를 설정해주세요
                </Text>
              ) : (
                <View style={{ gap: 8, marginBottom: 24 }}>
                  {storeShifts.filter(sh => sh.is_active).map((sh) => {
                    const checked = wdShifts.includes(sh.name);
                    const style = getShiftStyle(sh.name);
                    const timeLabel = sh.start_time && sh.end_time ? `${sh.start_time} ~ ${sh.end_time}` : null;
                    return (
                      <AnimatedPressable key={sh.id}
                        onPress={() => {
                          const next = wdShifts.includes(sh.name)
                            ? wdShifts.filter(x => x !== sh.name)
                            : [...wdShifts, sh.name];
                          setWdShifts(next);
                          const withTimes = storeShifts.filter(s => next.includes(s.name) && s.start_time && s.end_time);
                          if (withTimes.length > 0) {
                            const starts = withTimes.map(s => s.start_time!).sort();
                            const ends = withTimes.map(s => s.end_time!).sort();
                            setWdStart(starts[0]);
                            setWdEnd(ends[ends.length - 1]);
                          }
                        }}
                        scaleAmount={0.97} opacityAmount={0.85}
                        style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: checked ? "rgba(66,97,255,0.08)" : "#F7F7F8", borderWidth: 1, borderColor: checked ? "#4261FF" : "transparent" }}>
                        <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: checked ? "#4261FF" : "#FFFFFF", borderWidth: 1, borderColor: checked ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
                          {checked && <Check size={14} color="#FFFFFF" />}
                        </View>
                        <View style={{ backgroundColor: style.bg, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 13, fontWeight: "500", color: style.text }}>{sh.name}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: checked ? "600" : "400", color: checked ? "#4261FF" : "#19191B" }}>{sh.name}</Text>
                          {timeLabel && (
                            <Text style={{ fontSize: 12, color: "#9EA3AD", marginTop: 2 }}>{timeLabel}</Text>
                          )}
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AnimatedPressable onPress={() => setWdStep("day")} scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>이전</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => { if (wdShifts.length === 0) return; setWdStep("time"); }} scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 2, height: 52, borderRadius: 14, backgroundColor: wdShifts.length > 0 ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>다음</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}

          {/* step: deleteConfirm */}
          {wdStep === "deleteConfirm" && (
            <View>
              <Text style={{ fontSize: 15, color: "#70737B", textAlign: "center", lineHeight: 22, marginBottom: 16 }}>
                선택한 근무일을 삭제하시겠어요?
              </Text>
              <View style={{ gap: 6, marginBottom: 24 }}>
                {wdListSel.map(day => {
                  const ws = workSchedule.find(w => w.day === day);
                  return ws ? (
                    <View key={day} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#FFEAE6", flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#FF3D3D" }}>{ws.day}요일</Text>
                      <Text style={{ fontSize: 13, color: "#FF3D3D" }}>{ws.time}</Text>
                    </View>
                  ) : null;
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AnimatedPressable onPress={() => setWdStep("list")} scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#EBEBEB", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#70737B" }}>취소</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => {
                    setWorkSchedule(p => p.filter(w => !wdListSel.includes(w.day)));
                    setWdListSel([]);
                    setWdStep("list");
                    setShowWorkDaySheet(false);
                    setTimeout(() => toast({ description: "근무일이 삭제되었어요." }), 300);
                  }}
                  scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#FF5959", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>삭제하기</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}

          {/* step: time */}
          {wdStep === "time" && (
            <View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#70737B", marginBottom: 16 }}>
                <Text style={{ color: "#4261FF" }}>[{wdDay}요일]</Text> 근무 시간을 입력해주세요
              </Text>
              <View style={{ gap: 12, marginBottom: 24 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B" }}>시작 시간</Text>
                  <FocusInput value={wdStart} onChangeText={setWdStart} placeholder="예: 09:00" placeholderTextColor="#AAB4BF"
                    style={[{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", outline: "none", boxShadow: "none" } as any]} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#70737B" }}>종료 시간</Text>
                  <FocusInput value={wdEnd} onChangeText={setWdEnd} placeholder="예: 18:00" placeholderTextColor="#AAB4BF"
                    style={[{ borderWidth: 1, borderColor: "#DBDCDF", borderRadius: 10, height: 48, paddingHorizontal: 16, fontSize: 16, fontWeight: "500", color: "#19191B", backgroundColor: "#FFFFFF", outline: "none", boxShadow: "none" } as any]} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AnimatedPressable onPress={() => setWdStep("shifts")} scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "#DEEBFF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#4261FF" }}>이전</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => {
                    if (!wdDay || !wdStart || !wdEnd) return;
                    const entry: WorkEntry = { day: wdDay, time: `${wdStart} ~ ${wdEnd}`, shifts: wdShifts };
                    setWorkSchedule(prev => [...prev.filter(w => w.day !== wdDay), entry]);
                    const msg = wdIsEdit ? "근무일이 수정되었어요." : "근무일이 추가되었어요.";
                    setWdStep("list");
                    setWdListSel([]);
                    setWdIsEdit(false);
                    setShowWorkDaySheet(false);
                    setTimeout(() => toast({ description: msg }), 300);
                  }}
                  scaleAmount={0.97} opacityAmount={0.75}
                  style={{ flex: 2, height: 52, borderRadius: 14, backgroundColor: wdStart && wdEnd ? "#4261FF" : "#DBDCDF", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>{wdIsEdit ? "저장하기" : "추가하기"}</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </BottomSheet>

        {/* 계약서 업로드 */}
        <ImagePickerSheet
          isOpen={showDocSheet} onClose={() => setShowDocSheet(false)}
          title={docUploadTarget ? `${DOC_LIST.find((d) => d.key === docUploadTarget)?.label ?? ""} 업로드하기` : "업로드하기"}
          onAlbum={pickDocFromAlbum} onCamera={pickDocFromCamera}
        />

        <ConfirmDialog
          visible={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)}
          title={title} description="입력한 내용으로 저장하시겠어요?"
          buttons={[
            { label: "취소", onPress: () => setSaveConfirmOpen(false), variant: "cancel" },
            { label: "저장하기", onPress: () => { setSaveConfirmOpen(false); handleSave(); } },
          ]}
        />
        <ConfirmDialog
          visible={deleteDocConfirm.open} onClose={() => setDeleteDocConfirm({ open: false, key: null })}
          title={`${DOC_LIST.find(d => d.key === deleteDocConfirm.key)?.label ?? "파일"} 삭제`}
          description={`업로드한 ${DOC_LIST.find(d => d.key === deleteDocConfirm.key)?.label ?? "파일"}을 삭제하시겠어요?`}
          buttons={[
            { label: "취소", onPress: () => setDeleteDocConfirm({ open: false, key: null }), variant: "cancel" },
            { label: "삭제하기", onPress: () => {
              const key = deleteDocConfirm.key;
              if (key) {
                setDocs((prev) => ({ ...prev, [key]: null }));
                setDeletedDocKeys((prev) => {
                  const bk = DOC_BACKEND_KEY[key];
                  return prev.includes(bk) ? prev : [...prev, bk];
                });
              }
              setDeleteDocConfirm({ open: false, key: null });
            }, variant: "danger" },
          ]}
        />
        <ConfirmDialog
          visible={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)}
          title="수정 취소" description={"수정 중인 내용이 저장되지 않아요.\n정말 취소하시겠어요?"}
          buttons={[
            { label: "취소", onPress: () => setCancelConfirmOpen(false), variant: "cancel" },
            { label: "확인", onPress: () => { setCancelConfirmOpen(false); navigation.goBack(); } },
          ]}
        />

        <ConfirmDialog
          visible={workStatusConfirm.open}
          onClose={() => setWorkStatusConfirm({ open: false, status: "" })}
          title={WORK_STATUS_CONFIRM[workStatusConfirm.status]?.title ?? "근무 상태 변경"}
          description={WORK_STATUS_CONFIRM[workStatusConfirm.status]?.description}
          buttons={[
            { label: "취소", onPress: () => setWorkStatusConfirm({ open: false, status: "" }), variant: "cancel" },
            {
              label: workStatusConfirm.status === "퇴사" ? "퇴사 처리하기" : "변경하기",
              variant: workStatusConfirm.status === "퇴사" ? "danger" : "confirm",
              onPress: () => {
                setWorkStatusConfirm({ open: false, status: "" });
                handleSave();
              },
            },
          ]}
        />

        {/* 계약서 이미지 미리보기 */}
        <Modal visible={!!docPreview} transparent animationType="fade" onRequestClose={() => setDocPreview(null)}>
          <TouchableWithoutFeedback onPress={() => setDocPreview(null)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={{ width: "90%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#19191B", letterSpacing: -0.32 }}>{docPreview?.label}</Text>
                    <AnimatedPressable onPress={() => setDocPreview(null)} hitSlop={8} scaleAmount={0.88} opacityAmount={0.7}>
                      <X size={20} color="#19191B" />
                    </AnimatedPressable>
                  </View>
                  <View style={{ padding: 20, backgroundColor: "#F7F7F8" }}>
                    {docPreview && (() => {
                      const uri = (docPreview.uri.startsWith("http") || docPreview.uri.startsWith("file") || docPreview.uri.startsWith("content"))
                        ? docPreview.uri
                        : `${API_BASE_URL}${docPreview.uri.startsWith("/") ? docPreview.uri : `/${docPreview.uri}`}`;
                      return (
                        <View style={{ width: "100%", aspectRatio: 3 / 4, backgroundColor: "#E8E8E8", borderRadius: 12, overflow: "hidden" }}>
                          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default OwnerStaffEditScreen;
