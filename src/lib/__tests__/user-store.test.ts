/**
 * user-store 内存模式契约测试（仅在未配置 DATABASE_URL 时运行）。
 * 用户取建幂等 + OTP 校验（正确/错误/消费/尝试上限）。
 */
import { describe, expect, it } from "vitest";
import {
  generateOtpCode,
  getUserByPhone,
  saveOtp,
  upsertUserByPhone,
  verifyOtp,
} from "@/lib/user-store";

describe.skipIf(Boolean(process.env.DATABASE_URL))("user-store（内存模式契约）", () => {
  it("generateOtpCode 生成 6 位数字", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it("upsertUserByPhone 幂等，getUserByPhone 回读", async () => {
    const phone = "13700000001";
    const u1 = await upsertUserByPhone(phone);
    const u2 = await upsertUserByPhone(phone);
    expect(u1.id).toBe(u2.id);
    expect(u1.id).toMatch(/^u_[A-Za-z0-9_-]+$/);
    expect((await getUserByPhone(phone))?.phone).toBe(phone);
    expect(await getUserByPhone("13700009999")).toBeNull();
  });

  it("OTP：正确码通过且被消费，错误码失败", async () => {
    const phone = "13700000002";
    const code = generateOtpCode();
    await saveOtp(phone, code);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await verifyOtp(phone, wrong)).toBe(false);
    expect(await verifyOtp(phone, code)).toBe(true);
    expect(await verifyOtp(phone, code)).toBe(false); // 已消费
  });

  it("OTP：超过尝试上限后失效", async () => {
    const phone = "13700000003";
    const code = generateOtpCode();
    const wrong = code === "000000" ? "111111" : "000000";
    await saveOtp(phone, code);
    for (let i = 0; i < 5; i++) await verifyOtp(phone, wrong); // 用尽 5 次尝试
    // 第 6 次即便提交正确码也应失效
    expect(await verifyOtp(phone, code)).toBe(false);
  });

  it("OTP：未下发时校验直接失败", async () => {
    expect(await verifyOtp("13700000004", "123456")).toBe(false);
  });
});
