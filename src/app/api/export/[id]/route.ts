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
const MAX_SLIDES = 200; // 单次导出页数上界，避免超大课件导出成本失控
const NAV_TIMEOUT = 30_000;
const FONTS_TIMEOUT = 8_000;
const RENDER_TIMEOUT = 50_000; // 整体渲染兜底超时，防止挂死占用并发槽

// 进程内全局并发闸：每次导出会启动整个 Chromium（约 200-300MB），限制同时进行的导出数，
// 防止成本型 DoS / OOM 拖垮整个 Node 进程。多副本部署需换共享队列/网关（见 rate-limit.ts 说明）。
const MAX_CONCURRENT = Number(process.env.EXPORT_MAX_CONCURRENT ?? 2);
const g = globalThis as unknown as { __exportActive?: number };

function tryAcquire(): boolean {
  const active = g.__exportActive ?? 0;
  if (active >= MAX_CONCURRENT) return false;
  g.__exportActive = active + 1;
  return true;
}
function release(): void {
  g.__exportActive = Math.max(0, (g.__exportActive ?? 1) - 1);
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

/** 导出课件为 PDF。layout=landscape(16:9 幻灯片) | portrait(A4 讲义)；notes=1 含演讲者备注（仅 portrait）。 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // PDF 渲染开销大，限流更严。
  if (!rateLimit(`export:${clientIp(req)}`, 6, 60_000)) {
    return NextResponse.json({ error: "导出过于频繁，请稍后再试" }, { status: 429 });
  }
  const { id } = await params;
  try {
    const rec = await getDeckRecord(id); // 公开可读 + 顺带校验存在
    if (!rec) return NextResponse.json({ error: "课件不存在" }, { status: 404 });

    const slideCount = rec.deck.sections.reduce((n, s) => n + s.slides.length, 0);
    if (slideCount > MAX_SLIDES) {
      return NextResponse.json(
        { error: `课件页数过多（上限 ${MAX_SLIDES} 页），暂无法导出` },
        { status: 413 },
      );
    }

    // 全局并发闸：超过上限直接快速失败，不排队堆积。
    if (!tryAcquire()) {
      return NextResponse.json({ error: "导出服务繁忙，请稍后再试" }, { status: 503 });
    }

    const reqUrl = new URL(req.url);
    // 服务端渲染打印页：默认走本机回环 http（打印页由同一进程提供）。
    // 不用请求 origin——反代/容器后它可能是 https://0.0.0.0:$PORT 这类不可达地址
    // （TLS 在边缘终止，回访会 ERR_SSL_PROTOCOL_ERROR / hairpin 失败）。回环还顺手消了 Host 头注入的 SSRF 面。
    // 需指向其他渲染服务时用 EXPORT_ORIGIN 覆盖。
    const origin = process.env.EXPORT_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
    const layout = reqUrl.searchParams.get("layout") === "portrait" ? "portrait" : "landscape";
    const withNotes = reqUrl.searchParams.get("notes") === "1";
    const printUrl = `${origin}/deck/${encodeURIComponent(id)}/print?layout=${layout}${
      withNotes ? "&notes=1" : ""
    }`;

    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ executablePath: CHROMIUM_PATH, args: ["--no-sandbox"] });
      const pdf = await withTimeout(
        (async () => {
          const page = await browser!.newPage();
          page.setDefaultTimeout(NAV_TIMEOUT);
          await page.goto(printUrl, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
          // hidden 标记元素，等其「附着」即可（SSR 已在初始 HTML 中），不要等可见。
          await page.waitForSelector("[data-print-ready]", { state: "attached", timeout: 10_000 });
          // 等字体就绪（含内置中文字体），但加超时，避免极端情况下挂住。
          await page.evaluate(
            (t) =>
              Promise.race([
                document.fonts.ready.then(() => true),
                new Promise((r) => setTimeout(() => r(true), t)),
              ]),
            FONTS_TIMEOUT,
          );
          return layout === "portrait"
            ? await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
              })
            : await page.pdf({ width: "1280px", height: "720px", printBackground: true });
        })(),
        RENDER_TIMEOUT,
        "PDF 渲染超时",
      );

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
    } finally {
      await browser?.close().catch(() => {});
      release();
    }
  } catch (e) {
    return errorResponse(e, "PDF 导出失败");
  }
}
