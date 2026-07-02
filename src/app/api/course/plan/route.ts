import { NextResponse } from "next/server";
import { z } from "zod";
import { runCoursePlan } from "@/course/generate";
import { sentenceInputSchema } from "@/ai/schemas";
import { isMockMode } from "@/ai/provider";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ sentence: sentenceInputSchema });

/** 一句话 → 课件叙事弧计划。一次计划会带动后续多次场景生成，限流从紧。 */
export async function POST(req: Request) {
  if (!rateLimit(`course:plan:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "请用一句话描述你要的课（2–500 字）" }, { status: 400 });
    }
    const plan = await runCoursePlan(parsed.data.sentence);
    // mock 标记让前端如实提示「离线示例模式」，不冒充真实生成。
    return NextResponse.json({ plan, mock: isMockMode() });
  } catch (e) {
    return errorResponse(e, "课程规划失败");
  }
}
