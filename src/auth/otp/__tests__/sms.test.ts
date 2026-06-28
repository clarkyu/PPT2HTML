/**
 * 短信渠道适配器单测：阿里云签名/编码/请求构造 + 通用 HTTP 网关请求形态 + 配置校验。
 * 注：本环境无法真正发短信；此处覆盖签名正确性、请求结构、成功/失败与缺配置处理。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aliyunStringToSign,
  createAliyunSender,
  percentEncode,
  signAliyunRpc,
} from "@/auth/otp/aliyun";
import { createHttpSender } from "@/auth/otp/http";

const SMS_KEYS = [
  "SMS_ACCESS_KEY",
  "SMS_SECRET_KEY",
  "SMS_SIGN_NAME",
  "SMS_TEMPLATE_ID",
  "SMS_REGION",
  "SMS_WEBHOOK_URL",
  "SMS_WEBHOOK_TOKEN",
];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of SMS_KEYS) delete process.env[k];
});

describe("阿里云签名/编码", () => {
  it("percentEncode 符合阿里云规则", () => {
    expect(percentEncode("a b")).toBe("a%20b");
    expect(percentEncode("a*b")).toBe("a%2Ab");
    expect(percentEncode("~")).toBe("~");
    expect(percentEncode("/")).toBe("%2F");
    expect(percentEncode("中")).toBe("%E4%B8%AD");
  });

  it("待签名串按排序+规范化精确构造", () => {
    const s = aliyunStringToSign({ Action: "SendSms", PhoneNumbers: "13800138000" });
    expect(s).toBe("GET&%2F&Action%3DSendSms%26PhoneNumbers%3D13800138000");
  });

  it("签名确定、为 Base64、随参数变化", () => {
    const p = { Action: "SendSms", PhoneNumbers: "13800138000" };
    const a = signAliyunRpc(p, "secret");
    expect(a).toBe(signAliyunRpc(p, "secret")); // 确定性
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(signAliyunRpc({ ...p, PhoneNumbers: "13900139000" }, "secret")).not.toBe(a);
    expect(signAliyunRpc(p, "other-secret")).not.toBe(a); // 随密钥变化
  });

  it("缺配置时工厂抛出可读错误", () => {
    expect(() => createAliyunSender()).toThrow(/SMS_ACCESS_KEY/);
  });

  it("send 构造已签名请求；Code!=OK 抛错", async () => {
    Object.assign(process.env, {
      SMS_ACCESS_KEY: "id",
      SMS_SECRET_KEY: "secret",
      SMS_SIGN_NAME: "言课",
      SMS_TEMPLATE_ID: "SMS_1",
    });
    let calledUrl = "";
    const fetchMock = vi.fn(async (url: string) => {
      calledUrl = url;
      return { ok: true, json: async () => ({ Code: "OK" }) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAliyunSender().send("13800138000", "123456")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calledUrl).toContain("Action=SendSms");
    expect(calledUrl).toContain("Signature=");
    expect(calledUrl).toContain("PhoneNumbers=13800138000");
    // 验证码经 TemplateParam 传递（URL 编码后包含 code）
    expect(decodeURIComponent(calledUrl)).toContain('"code":"123456"');

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ Code: "isv.X", Message: "no" }) }) as unknown as Response),
    );
    await expect(createAliyunSender().send("13800138000", "123456")).rejects.toThrow(/发送失败/);
  });
});

describe("通用 HTTP 网关", () => {
  it("缺 SMS_WEBHOOK_URL 时工厂抛错", () => {
    expect(() => createHttpSender()).toThrow(/SMS_WEBHOOK_URL/);
  });

  it("POST 手机号+验证码，带 Bearer，非 2xx 抛错", async () => {
    process.env.SMS_WEBHOOK_URL = "https://hook.example/send";
    process.env.SMS_WEBHOOK_TOKEN = "tok";
    let args: [string, RequestInit] | null = null;
    const ok = vi.fn(async (url: string, init: RequestInit) => {
      args = [url, init];
      return { ok: true } as Response;
    });
    vi.stubGlobal("fetch", ok);
    await createHttpSender().send("13800138000", "654321");
    expect(args![0]).toBe("https://hook.example/send");
    expect(args![1].method).toBe("POST");
    expect((args![1].headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(args![1].body as string)).toEqual({ phone: "13800138000", code: "654321" });

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 }) as Response));
    await expect(createHttpSender().send("13800138000", "654321")).rejects.toThrow(/502/);
  });
});
