import { NextResponse } from "next/server";
import { z } from "zod";
import { runCourseScene } from "@/course/generate";
import { coursePlanSchema, normalizePlan } from "@/course/schema";
import { sentenceInputSchema } from "@/ai/schemas";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sentence: sentenceInputSchema,
  plan: coursePlanSchema,
  index: z.number().int().nonnegative(),
  /** 真实生成失败后的客户端兜底重试：强制走离线 Mock，保证必有合法内容。 */
  fallback: z.boolean().optional(),
});

/** 按计划生成单个场景（页）。客户端并发调用、按就绪前缀流式呈现。 */
export async function POST(req: Request) {
  if (!rateLimit(`course:scene:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "请求数据不合法" }, { status: 400 });
    }
    const { sentence, index, fallback } = parsed.data;
    // 重新归一化：不信任客户端回传的计划形状（归一化幂等，服务端不变式兜底）。
    const plan = normalizePlan(parsed.data.plan);
    if (index >= plan.scenes.length) {
      return NextResponse.json({ error: "场景越界" }, { status: 400 });
    }
    const slide = await runCourseScene({ sentence, plan, index, forceMock: fallback });
    return NextResponse.json({ slide });
  } catch (e) {
    return errorResponse(e, "场景生成失败");
  }
}
