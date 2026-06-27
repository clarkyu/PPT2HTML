import { NextResponse } from "next/server";
import { z } from "zod";
import { runSection } from "@/ai/pipeline";
import { intentCardSchema } from "@/ai/schemas";
import { outlineSchema } from "@/schema/zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  intent: intentCardSchema,
  outline: outlineSchema,
  index: z.number().int().nonnegative(),
});

export async function POST(req: Request) {
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
    return NextResponse.json({ error: e instanceof Error ? e.message : "内容生成失败" }, { status: 500 });
  }
}
