/**
 * 阿里云短信（Dysmsapi 2017-05-25，RPC 风格，HMAC-SHA1 签名）。
 * 需要：SMS_ACCESS_KEY / SMS_SECRET_KEY / SMS_SIGN_NAME / SMS_TEMPLATE_ID（可选 SMS_REGION）。
 * 模板需含变量 ${code}（TemplateParam 传 {"code": "..."}）。
 */
import { createHmac, randomUUID } from "node:crypto";
import type { OtpSender } from "./types";

const ENDPOINT = "https://dysmsapi.aliyuncs.com/";

/**
 * 阿里云 RPC percentEncode（与官方 SDK 一致）：encodeURIComponent 后再编码 ! ' ( ) *。
 * encodeURIComponent 不产生 +，且把空格编为 %20、~ 保留为未保留字符，故无需额外处理这些。
 */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** 由参数构造待签名串：GET&%2F&percentEncode(规范化查询串)。 */
export function aliyunStringToSign(params: Record<string, string>): string {
  const canon = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");
  return `GET&${percentEncode("/")}&${percentEncode(canon)}`;
}

/** RPC 签名（HMAC-SHA1，Base64）。key 为 AccessKeySecret + "&"。 */
export function signAliyunRpc(params: Record<string, string>, accessKeySecret: string): string {
  return createHmac("sha1", `${accessKeySecret}&`).update(aliyunStringToSign(params)).digest("base64");
}

export function createAliyunSender(): OtpSender {
  const accessKeyId = process.env.SMS_ACCESS_KEY;
  const accessKeySecret = process.env.SMS_SECRET_KEY;
  const signName = process.env.SMS_SIGN_NAME;
  const templateCode = process.env.SMS_TEMPLATE_ID;
  const regionId = process.env.SMS_REGION ?? "cn-hangzhou";
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error(
      "[otp:aliyun] 缺少配置：SMS_ACCESS_KEY / SMS_SECRET_KEY / SMS_SIGN_NAME / SMS_TEMPLATE_ID",
    );
  }
  return {
    name: "aliyun",
    async send(phone, code) {
      const params: Record<string, string> = {
        AccessKeyId: accessKeyId,
        Action: "SendSms",
        Format: "JSON",
        PhoneNumbers: phone,
        RegionId: regionId,
        SignName: signName,
        SignatureMethod: "HMAC-SHA1",
        SignatureNonce: randomUUID(),
        SignatureVersion: "1.0",
        TemplateCode: templateCode,
        TemplateParam: JSON.stringify({ code }),
        Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        Version: "2017-05-25",
      };
      const signature = signAliyunRpc(params, accessKeySecret);
      const query = Object.keys(params)
        .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
        .join("&");
      const res = await fetch(`${ENDPOINT}?${query}&Signature=${percentEncode(signature)}`, {
        method: "GET",
        signal: AbortSignal.timeout(8000), // 上游挂起不拖死验证码下发路径
      });
      const data = (await res.json().catch(() => ({}))) as { Code?: string; Message?: string };
      if (!res.ok || data.Code !== "OK") {
        // 不带验证码/密钥的精简错误（Code/Message 为服务商返回，安全可记录）。
        throw new Error(`[otp:aliyun] 发送失败：${data.Code ?? res.status} ${data.Message ?? ""}`.trim());
      }
    },
  };
}
