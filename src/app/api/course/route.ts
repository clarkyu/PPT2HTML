import { NextResponse } from "next/server";
import { z } from "zod";
import { courseDocSchema, courseSlideSchema } from "@/course/schema";
import { newCourseId, saveCourse } from "@/lib/course-store";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().min(1).max(40),
  sentence: z.string().max(500).optional(),
  slides: z.array(courseSlideSchema).min(3).max(12),
});

/** 保存生成完成的课件（id/createdAt 由服务端生成；按链接公开分享）。 */
export async function POST(req: Request) {
  if (!rateLimit(`course:save:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "课件数据不合法" }, { status: 400 });
    }
    const doc = courseDocSchema.parse({
      id: newCourseId(),
      title: parsed.data.title,
      sentence: parsed.data.sentence,
      theme: "dark",
      slides: parsed.data.slides,
      createdAt: new Date().toISOString(),
    });
    // 登录则归属创建者；匿名为 null（按链接公开，与 decks 同策略）。
    const session = await auth();
    await saveCourse(doc, { ownerId: session?.user?.id ?? null });
    return NextResponse.json({ id: doc.id });
  } catch (e) {
    return errorResponse(e, "保存失败");
  }
}
