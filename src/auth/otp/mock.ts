import type { OtpSender } from "./types";

/** 离线/开发渠道：仅打印验证码到服务端日志（不发真实短信）。 */
export const mockSender: OtpSender = {
  name: "mock",
  async send(phone, code) {
    console.info(`[otp:mock] ${phone} 的验证码：${code}（5 分钟内有效）`);
  },
};
