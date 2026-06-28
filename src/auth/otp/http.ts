/**
 * 通用 HTTP 网关短信渠道：把手机号 + 验证码 POST 到自配的发送端点，由该端点对接任意服务商。
 * 需要：SMS_WEBHOOK_URL（可选 SMS_WEBHOOK_TOKEN，作为 Bearer 鉴权）。
 */
import type { OtpSender } from "./types";

export function createHttpSender(): OtpSender {
  const url = process.env.SMS_WEBHOOK_URL;
  const token = process.env.SMS_WEBHOOK_TOKEN;
  if (!url) {
    throw new Error("[otp:http] 缺少配置：SMS_WEBHOOK_URL");
  }
  return {
    name: "http",
    async send(phone, code) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) {
        throw new Error(`[otp:http] 网关返回 ${res.status}`);
      }
    },
  };
}
