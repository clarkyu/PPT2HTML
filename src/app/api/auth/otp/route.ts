import { NextResponse } from "next/server";
import { normalizePhone } from "@/auth/phone";
import { generateOtpCode, saveOtp } from "@/lib/user-store";
import { getOtpSender, otpDeliveryIsMock } from "@/auth/otp";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 下发登录验证码。双桶限流：按手机号（防轰炸）+ 按客户端。 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { phone?: unknown } | null;
    const phone = normalizePhone(String(body?.phone ?? ""));
    if (!phone) {
      return NextResponse.json({ error: "请输入有效的手机号" }, { status: 400 });
    }
    if (!rateLimit(`otp:phone:${phone}`, 5, 10 * 60_000) || !rateLimit(`otp:ip:${clientIp(req)}`, 20, 60_000)) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    const code = generateOtpCode();
    await saveOtp(phone, code);
    await getOtpSender().send(phone, code);

    // 仅在 mock 渠道 + 非生产时回显验证码，方便本地/CI 自测；生产或真实短信时不回显。
    const devCode = otpDeliveryIsMock && process.env.NODE_ENV !== "production" ? code : undefined;
    return NextResponse.json({ ok: true, ...(devCode ? { devCode } : {}) });
  } catch (e) {
    return errorResponse(e, "验证码下发失败");
  }
}
