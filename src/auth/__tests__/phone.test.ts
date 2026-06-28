import { describe, expect, it } from "vitest";
import { isValidPhone, maskPhone, normalizePhone } from "@/auth/phone";

describe("手机号归一化", () => {
  it("接受合法大陆号码，去除分隔符与 +86/86 前缀", () => {
    expect(normalizePhone("13800138000")).toBe("13800138000");
    expect(normalizePhone("138 0013 8000")).toBe("13800138000");
    expect(normalizePhone("138-0013-8000")).toBe("13800138000");
    expect(normalizePhone("+8613800138000")).toBe("13800138000");
    expect(normalizePhone("8613800138000")).toBe("13800138000");
  });

  it("拒绝非法号码", () => {
    expect(normalizePhone("12345")).toBe("");
    expect(normalizePhone("12800138000")).toBe(""); // 第二位非 3-9
    expect(normalizePhone("23800138000")).toBe(""); // 不以 1 开头
    expect(normalizePhone("1380013800")).toBe(""); // 位数不足
    expect(normalizePhone("abcdefghijk")).toBe("");
    expect(isValidPhone("not a phone")).toBe(false);
    expect(isValidPhone("13800138000")).toBe(true);
  });

  it("脱敏中间四位", () => {
    expect(maskPhone("13800138000")).toBe("138****8000");
  });
});
