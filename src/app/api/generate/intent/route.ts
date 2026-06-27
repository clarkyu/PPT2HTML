import { NextResponse } from "next/server";
import { runIntent } from "@/ai/pipeline";
import { isMockMode } from "@/ai/provider";
import { sentenceInputSchema } from "@/ai/schemas";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`gen:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const body = (await req.json()) as { sentence?: unknown };
    const parsed = sentenceInputSchema.safeParse(body.sentence);
    if (!parsed.success) {
      return NextResponse.json({ error: "请用一句话描述你想讲的课（2–500 字）" }, { status: 400 });
    }
    const intent = await runIntent(parsed.data);
    return NextResponse.json({ intent, mock: isMockMode() });
  } catch (e) {
    return errorResponse(e, "意图解析失败");
  }
}
