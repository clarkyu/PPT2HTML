import type { OtpSender } from "./types";

/**
 * 真实短信渠道 stub。配置 SMS_* 后在此对接服务商（阿里云/腾讯云短信等）。
 * 当前仅占位：未实现具体 HTTP 调用，调用即抛错，提示接入。
 */
export function createSmsSender(): OtpSender {
  return {
    name: process.env.SMS_PROVIDER ?? "sms",
    async send(phone, _code) {
      void phone;
      void _code;
      throw new Error("短信渠道尚未接入：请实现 src/auth/otp/sms.ts 或不配置 SMS_PROVIDER 以回退 mock");
    },
  };
}
