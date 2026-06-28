import { mockSender } from "./mock";
import { createSmsSender } from "./sms";
import type { OtpSender } from "./types";

export type { OtpSender } from "./types";

/** 配置了 SMS_PROVIDER 即走真实短信，否则回退 mock（离线/开发可用）。 */
export const otpDeliveryIsMock = !process.env.SMS_PROVIDER;

// 生产必须配置真实短信渠道：否则验证码只会打印到日志、用户永远收不到（登录静默瘫痪）。
// 与 src/lib/db.ts 的生产硬失败策略一致；构建期豁免，避免误伤 next build。
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (otpDeliveryIsMock && process.env.NODE_ENV === "production" && !isBuildPhase) {
  throw new Error("[otp] 生产环境必须配置 SMS_PROVIDER：拒绝以 mock 短信渠道启动（验证码无法送达）");
}

let cached: OtpSender | null = null;

export function getOtpSender(): OtpSender {
  if (!cached) cached = otpDeliveryIsMock ? mockSender : createSmsSender();
  return cached;
}
