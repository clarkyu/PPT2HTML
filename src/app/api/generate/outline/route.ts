import { NextResponse } from "next/server";
import { runOutline } from "@/ai/pipeline";
import { intentCardSchema } from "@/ai/schemas";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`gen:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const body = (await req.json()) as { intent?: unknown };
    const parsed = intentCardSchema.safeParse(body.intent);
    if (!parsed.success) {
      return NextResponse.json({ error: "意图数据不合法" }, { status: 400 });
    }
    const outline = await runOutline(parsed.data);
    return NextResponse.json({ outline });
  } catch (e) {
    return errorResponse(e, "大纲生成失败");
  }
}
