/**
 * 通用 HTTP 网关短信渠道：把手机号 + 验证码 POST 到自配的发送端点，由该端点对接任意服务商。
 * 需要：SMS_WEBHOOK_URL（http/https，可选 SMS_WEBHOOK_TOKEN 作为 Bearer 鉴权）。
 */
import type { OtpSender } from "./types";

export function createHttpSender(): OtpSender {
  const raw = process.env.SMS_WEBHOOK_URL;
  const token = process.env.SMS_WEBHOOK_TOKEN;
  if (!raw) {
    throw new Error("[otp:http] 缺少配置：SMS_WEBHOOK_URL");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("[otp:http] SMS_WEBHOOK_URL 不是合法 URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("[otp:http] SMS_WEBHOOK_URL 必须为 http(s)");
  }
  const endpoint = url.toString();
  return {
    name: "http",
    async send(phone, code) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone, code }),
        signal: AbortSignal.timeout(8000), // 网关挂起不拖死验证码下发路径
      });
      if (!res.ok) {
        throw new Error(`[otp:http] 网关返回 ${res.status}`);
      }
    },
  };
}
