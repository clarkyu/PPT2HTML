import { NextResponse } from "next/server";
import { runIntent } from "@/ai/pipeline";
import { isMockMode } from "@/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sentence?: unknown };
    const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
    if (sentence.length < 2) {
      return NextResponse.json({ error: "请用一句话描述你想讲的课（至少 2 个字）" }, { status: 400 });
    }
    const intent = await runIntent(sentence);
    return NextResponse.json({ intent, mock: isMockMode() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "意图解析失败" }, { status: 500 });
  }
}
