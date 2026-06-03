/** "HH:MM" 문자열을 분(minutes) 단위 정수로 변환 */
export const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
