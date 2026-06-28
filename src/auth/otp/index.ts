import { mockSender } from "./mock";
import { createAliyunSender } from "./aliyun";
import { createHttpSender } from "./http";
import type { OtpSender } from "./types";

export type { OtpSender } from "./types";

const provider = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();

/** 未配置 SMS_PROVIDER 时回退 mock（离线/开发可用，仅打印日志）。 */
export const otpDeliveryIsMock = provider === "";

// 生产必须配置真实短信渠道：否则验证码只会打印到日志、用户永远收不到（登录静默瘫痪）。
// 与 src/lib/db.ts 的生产硬失败策略一致；构建期豁免，避免误伤 next build。
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (otpDeliveryIsMock && process.env.NODE_ENV === "production" && !isBuildPhase) {
  throw new Error("[otp] 生产环境必须配置 SMS_PROVIDER：拒绝以 mock 短信渠道启动（验证码无法送达）");
}

let cached: OtpSender | null = null;

/** 按 SMS_PROVIDER 选择渠道：aliyun | http(webhook) | 空(mock)。配置缺失时在首次发送处抛出可读错误。 */
export function getOtpSender(): OtpSender {
  if (cached) return cached;
  switch (provider) {
    case "":
      cached = mockSender;
      break;
    case "aliyun":
      cached = createAliyunSender();
      break;
    case "http":
    case "webhook":
      cached = createHttpSender();
      break;
    default:
      throw new Error(`[otp] 未知 SMS_PROVIDER="${provider}"（支持：aliyun | http）`);
  }
  return cached;
}
