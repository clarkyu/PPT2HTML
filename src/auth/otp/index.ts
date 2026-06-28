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

/** 按 SMS_PROVIDER 选择渠道：aliyun | http(webhook) | 空(mock)。 */
function buildSender(): OtpSender {
  switch (provider) {
    case "":
      return mockSender;
    case "aliyun":
      return createAliyunSender();
    case "http":
    case "webhook":
      return createHttpSender();
    default:
      throw new Error(`[otp] 未知 SMS_PROVIDER="${provider}"（支持：aliyun | http）`);
  }
}

// 启动即校验并预热单例：配置缺失/未知 provider 在模块加载（首次路由载入）即抛错、可观测，
// 而非每个用户请求才延迟失败。构建期豁免，避免 next build 误触发缺配置抛错。
const eager: OtpSender | null = isBuildPhase ? null : buildSender();

export function getOtpSender(): OtpSender {
  return eager ?? buildSender();
}
