import { NextResponse } from "next/server";
import { chromium, type Browser } from "playwright-core";
import { getDeckRecord } from "@/lib/deck-store";
import { errorResponse } from "@/lib/api-error";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF 渲染较慢，给足时间预算（serverless 平台生效；长驻进程忽略）。
export const maxDuration = 60;

// 环境预装 Chromium；版本可能与 playwright-core 期望不一致，故用 executablePath 直指，绕过版本匹配。
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

/** 导出课件为 PDF。layout=landscape(16:9 幻灯片) | portrait(A4 讲义)；notes=1 含演讲者备注（仅 portrait）。 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // PDF 渲染开销大，限流更严。
  if (!rateLimit(`export:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: "导出过于频繁，请稍后再试" }, { status: 429 });
  }
  const { id } = await params;
  const rec = await getDeckRecord(id); // 公开可读 + 顺带校验存在
  if (!rec) return NextResponse.json({ error: "课件不存在" }, { status: 404 });

  const reqUrl = new URL(req.url);
  const layout = reqUrl.searchParams.get("layout") === "portrait" ? "portrait" : "landscape";
  const withNotes = reqUrl.searchParams.get("notes") === "1";
  const printUrl = `${reqUrl.origin}/deck/${encodeURIComponent(id)}/print?layout=${layout}${
    withNotes ? "&notes=1" : ""
  }`;

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle", timeout: 30_000 });
    // 标记为 hidden 元素，等其「附着」即可（SSR 已在初始 HTML 中），不要等可见。
    await page.waitForSelector("[data-print-ready]", { state: "attached", timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true)); // 等字体就绪，避免公式/排版错位
    const pdf =
      layout === "portrait"
        ? await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
          })
        : await page.pdf({ width: "1280px", height: "720px", printBackground: true });

    const base = (rec.deck.meta.title || "课件").replace(/[\\/:*?"<>|\n\r]+/g, "_").slice(0, 80);
    const suffix = layout === "portrait" ? "讲义" : "幻灯片";
    const utf8Name = encodeURIComponent(`${base}-${suffix}.pdf`);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="deck-${layout}.pdf"; filename*=UTF-8''${utf8Name}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e, "PDF 导出失败");
  } finally {
    await browser?.close();
  }
}
