import { mockSender } from "./mock";
import { createSmsSender } from "./sms";
import type { OtpSender } from "./types";

export type { OtpSender } from "./types";

/** 配置了 SMS_PROVIDER 即走真实短信，否则回退 mock（离线/开发可用）。 */
export const otpDeliveryIsMock = !process.env.SMS_PROVIDER;

let cached: OtpSender | null = null;

export function getOtpSender(): OtpSender {
  if (!cached) cached = otpDeliveryIsMock ? mockSender : createSmsSender();
  return cached;
}
