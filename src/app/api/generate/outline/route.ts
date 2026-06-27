import { NextResponse } from "next/server";
import { runOutline } from "@/ai/pipeline";
import { intentCardSchema } from "@/ai/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { intent?: unknown };
    const parsed = intentCardSchema.safeParse(body.intent);
    if (!parsed.success) {
      return NextResponse.json({ error: "意图数据不合法" }, { status: 400 });
    }
    const outline = await runOutline(parsed.data);
    return NextResponse.json({ outline });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "大纲生成失败" }, { status: 500 });
  }
}
