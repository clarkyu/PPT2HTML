import { notFound } from "next/navigation";
import { getDeckRecord } from "@/lib/deck-store";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { ThemedSurface } from "@/renderer/ThemedSurface";
import { flattenSlides } from "@/renderer/flatten";

/**
 * 打印视图（供 PDF 导出用 Playwright 导航后 page.pdf）。无应用 chrome，按链接公开（同课件读取）。
 * layout=landscape：16:9 满版幻灯片，每页一张；layout=portrait：A4 讲义，每页一张幻灯片（可含演讲者备注）。
 */
export const dynamic = "force-dynamic";

type SearchParams = { layout?: string; notes?: string };

const PRINT_CSS = `
  /* 随应用内置中文字体：导出 PDF 时不依赖宿主机 CJK 字体，避免无头 Chromium 渲染为豆腐块。
     仅打印路由加载，不影响线上 Web 应用。中文用 Noto Sans SC，拉丁/符号回退系统字体。 */
  @font-face {
    font-family: "Noto Sans SC";
    src: url("/fonts/noto-sans-sc-400.woff2") format("woff2");
    font-weight: 100 900;
    font-display: block;
  }
  [data-print-root] * { font-family: "Noto Sans SC", system-ui, sans-serif !important; }

  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .print-page { break-after: page; break-inside: avoid; }
  .print-page:last-of-type { break-after: auto; }

  [data-layout="landscape"] .slide-full {
    width: 1280px; height: 720px; overflow: hidden; box-sizing: border-box;
    display: flex; flex-direction: column; justify-content: center; padding: 48px 64px;
  }

  [data-layout="portrait"] .handout { display: flex; flex-direction: column; gap: 14px; }
  [data-layout="portrait"] .handout-head {
    display: flex; justify-content: space-between; font-size: 12px; color: #64748b;
  }
  [data-layout="portrait"] .slide-box {
    aspect-ratio: 16 / 9; width: 100%; overflow: hidden; box-sizing: border-box;
    border: 1px solid #e2e8f0; border-radius: 10px;
    display: flex; flex-direction: column; justify-content: center; padding: 22px 30px;
  }
  [data-layout="portrait"] .notes { font-size: 13px; line-height: 1.6; color: #334155; }
  [data-layout="portrait"] .notes h3 { margin: 0 0 4px; font-size: 12px; color: #64748b; }
  [data-layout="portrait"] .notes p { margin: 0; white-space: pre-wrap; }
`;

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const layout = sp.layout === "portrait" ? "portrait" : "landscape";
  const withNotes = sp.notes === "1";

  const rec = await getDeckRecord(id);
  if (!rec) notFound();
  const deck = rec.deck;
  const flat = flattenSlides(deck);

  return (
    <div data-print-root data-layout={layout}>
      <style>{PRINT_CSS}</style>
      {flat.map((f, i) =>
        layout === "portrait" ? (
          <section key={f.slide.id} className="print-page">
            <div className="handout">
              <div className="handout-head">
                <span>{f.sectionTitle}</span>
                <span>
                  {i + 1} / {flat.length}
                </span>
              </div>
              <ThemedSurface
                deck={deck}
                className="slide-box"
                style={{ ["--slide-base" as string]: "0.85rem" }}
              >
                <SlideRenderer slide={f.slide} reveal />
              </ThemedSurface>
              {withNotes && f.slide.speakerNotes ? (
                <div className="notes">
                  <h3>演讲者备注</h3>
                  <p>{f.slide.speakerNotes}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section key={f.slide.id} className="print-page">
            <ThemedSurface
              deck={deck}
              className="slide-full"
              style={{ ["--slide-base" as string]: "1.5rem" }}
            >
              <SlideRenderer slide={f.slide} reveal />
            </ThemedSurface>
          </section>
        ),
      )}
      {/* Playwright 等待此标记，确保整页服务端渲染完成后再打印 */}
      <div data-print-ready hidden />
    </div>
  );
}
