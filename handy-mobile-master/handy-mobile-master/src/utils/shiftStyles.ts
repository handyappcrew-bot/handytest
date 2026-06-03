export type StoreShift = {
  name: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  is_active?: boolean;
};

export const SHIFT_COLOR_PALETTE = [
  { bg: "#FDF9DF", color: "#FFB300", text: "#FFB300" },
  { bg: "#ECFFF1", color: "#1EDC83", text: "#1EDC83" },
  { bg: "#E8F9FF", color: "#14C1FA", text: "#14C1FA" },
] as const;

export const DAILY_SHIFT_STYLE = { bg: "#EEF1FF", color: "#4261FF", text: "#4261FF" };
export const DEFAULT_SHIFT_STYLE = { bg: "#F7F8FA", color: "#9EA3AD", text: "#9EA3AD" };

const SHIFT_ALIAS_GROUPS: [string[], number][] = [
  [["오픈", "오전", "1교대"], 0],
  [["미들", "오후", "2교대"], 1],
  [["마감", "저녁", "3교대"], 2],
];

function getAliasGroupIndex(name: string): number {
  for (const [keywords, idx] of SHIFT_ALIAS_GROUPS) {
    if (keywords.some(k => name.includes(k))) return idx;
  }
  return -1;
}

export function getShiftStyle(
  shiftName: string | null | undefined,
  storeShifts?: StoreShift[]
): { bg: string; color: string; text: string } {
  if (!shiftName) return DEFAULT_SHIFT_STYLE;
  if (shiftName === "일일") return DAILY_SHIFT_STYLE;

  // 시맨틱 그룹 우선: 오픈/오전/1교대, 미들/오후/2교대, 마감/저녁/3교대
  const aliasIdx = getAliasGroupIndex(shiftName);
  if (aliasIdx >= 0) {
    const p = SHIFT_COLOR_PALETTE[aliasIdx];
    return { bg: p.bg, color: p.color, text: p.color };
  }

  // 커스텀 시프트명: storeShifts 등록 순서 기반
  if (storeShifts?.length) {
    const idx = storeShifts.findIndex((s) => s.name === shiftName);
    if (idx >= 0) {
      const p = SHIFT_COLOR_PALETTE[idx % SHIFT_COLOR_PALETTE.length];
      return { bg: p.bg, color: p.color, text: p.color };
    }
  }

  return DEFAULT_SHIFT_STYLE;
}

export function inferShiftName(
  startTime: string | null | undefined,
  storeShifts?: StoreShift[]
): string {
  if (!startTime) return "";
  const h = parseInt(startTime.split(":")[0]);
  if (isNaN(h)) return "";

  if (storeShifts?.length) {
    const active = storeShifts
      .filter((s) => s.is_active !== false && s.start_time)
      .sort((a, b) => parseInt(a.start_time!.split(":")[0]) - parseInt(b.start_time!.split(":")[0]));
    if (active.length) {
      let best = active[0];
      for (const s of active) {
        if (h >= parseInt(s.start_time!.split(":")[0])) best = s;
      }
      return best.name;
    }
    // start_time 없는 경우 sort_order 기준 첫 번째 시프트
    const fallback = [...storeShifts]
      .filter((s) => s.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (fallback.length) return fallback[0].name;
  }

  if (h < 11) return "오픈";
  if (h < 15) return "미들";
  return "마감";
}
