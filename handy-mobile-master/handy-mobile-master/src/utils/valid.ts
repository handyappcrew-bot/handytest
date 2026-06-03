/**
 * 휴대폰 번호 포맷 (010-XXXX-XXXX)
 */
export const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

/**
 * 010 시작, 11자리 숫자
 */
export const validatePhone = (formatted: string): boolean => {
  const digits = formatted.replace(/\D/g, "");
  return /^010\d{8}$/.test(digits);
};
