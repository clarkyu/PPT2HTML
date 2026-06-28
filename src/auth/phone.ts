/**
 * 手机号归一化与校验。MVP 以中国大陆手机号为主锚点（PRD F15）。
 * 接受可选 +86 / 86 前缀与空格/连字符，归一为 11 位 1xxxxxxxxxx。
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+?86/, "");
  return /^1[3-9]\d{9}$/.test(digits) ? digits : "";
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== "";
}

/** 脱敏展示：138****8000。 */
export function maskPhone(phone: string): string {
  return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(7)}` : phone;
}
