import { NextResponse } from "next/server";
import { z } from "zod";
import { materializeBlocks, runRefine } from "@/ai/pipeline";
import { gradeLevelSchema, slideSchema } from "@/schema/zod";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  subject: z.string().max(50).optional(),
  gradeLevel: gradeLevelSchema.optional(),
  slide: slideSchema,
  instruction: z.string().trim().min(2).max(500),
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
    const { subject, gradeLevel, slide, instruction } = parsed.data;
    const draft = await runRefine({ subject, gradeLevel, slide, instruction });
    // 注入稳定 id 后返回，客户端整页替换该页内容（保持页 id 不变）。
    const blocks = materializeBlocks(draft.blocks);
    return NextResponse.json({
      slide: {
        layout: draft.layout,
        pedagogyRole: draft.pedagogyRole,
        speakerNotes: draft.speakerNotes,
        blocks,
      },
    });
  } catch (e) {
    return errorResponse(e, "精修失败");
  }
}
