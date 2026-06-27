import { NextResponse } from "next/server";
import { z } from "zod";
import { runSection } from "@/ai/pipeline";
import { intentCardSchema } from "@/ai/schemas";
import { outlineSchema } from "@/schema/zod";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  intent: intentCardSchema,
  outline: outlineSchema,
  index: z.number().int().nonnegative(),
});

export async function POST(req: Request) {
  if (!rateLimit(`gen:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "请求数据不合法" }, { status: 400 });
    }
    const { intent, outline, index } = parsed.data;
    if (index >= outline.sections.length) {
      return NextResponse.json({ error: "节次越界" }, { status: 400 });
    }
    const section = await runSection(intent, outline, index);
    return NextResponse.json({ section });
  } catch (e) {
    return errorResponse(e, "内容生成失败");
  }
}
