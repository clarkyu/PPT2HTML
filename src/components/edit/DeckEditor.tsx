"use client";

/**
 * 课件编辑器（M3 · F5+F8）：模板切换 + 基础自定义（配色/字体/字号/校徽）+ 对话式精修 + 直接编辑
 * + 实时预览 + 保存。内容与渲染分离：改 templateId/theme 即时换肤；精修/直接编辑按页局部改写。
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Block, ColorTokens, Deck, Slide, Template } from "@/schema/types";
import { ThemedSurface } from "@/renderer/ThemedSurface";
import { flattenSlides } from "@/renderer/flatten";
import { getTemplate } from "@/templates/registry";

// 编辑后的页在客户端按状态重渲染；懒加载使 KaTeX 仅在需要时进入编辑器（不影响初始包/其它页）。
const ClientSlideRenderer = dynamic(() => import("./ClientSlideRenderer"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-muted">渲染中…</div>,
});

const FONT_OPTIONS = [
  { label: "无衬线", value: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: "衬线", value: "Georgia, 'Songti SC', 'STSong', serif" },
  { label: "圆体", value: "ui-rounded, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" },
  { label: "等宽", value: "ui-monospace, 'SFMono-Regular', Menlo, monospace" },
];

export function DeckEditor({
  deck: initial,
  templates,
  slides,
  sectionTitles,
}: {
  deck: Deck;
  templates: Template[];
  slides: React.ReactNode[];
  sectionTitles: string[];
}) {
  const router = useRouter();
  const [deck, setDeck] = useState<Deck>(initial);
  const [i, setI] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editedSlides, setEditedSlides] = useState<Set<string>>(new Set());
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);

  // 有未保存改动时，拦截刷新/关闭页面
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const total = slides.length;
  const flat = flattenSlides(deck);
  const current = flat[i];
  const template = getTemplate(deck.templateId);
  const effColors: ColorTokens = { ...template.colors, ...(deck.theme?.colors ?? {}) };
  const effHeading = deck.theme?.fontFamily?.heading ?? template.fontFamily.heading;
  const effBody = deck.theme?.fontFamily?.body ?? template.fontFamily.body;
  const fontScale = deck.theme?.fontScale ?? 1;
  // 自定义字体可能不在预设选项内：补一个「自定义」项，避免 select 静默显示错项。
  const headingOpts = FONT_OPTIONS.some((f) => f.value === effHeading)
    ? FONT_OPTIONS
    : [...FONT_OPTIONS, { label: "自定义", value: effHeading }];
  const bodyOpts = FONT_OPTIONS.some((f) => f.value === effBody)
    ? FONT_OPTIONS
    : [...FONT_OPTIONS, { label: "自定义", value: effBody }];

  const patch = (fn: (d: Deck) => Deck) => {
    setDeck((p) => fn(structuredClone(p)));
    setDirty(true);
    setMsg(null);
  };
  const ensureTheme = (d: Deck) => (d.theme = d.theme ?? {});
  const setColor = (key: keyof ColorTokens, hex: string) =>
    patch((d) => {
      ensureTheme(d);
      d.theme!.colors = { ...(d.theme!.colors ?? {}), [key]: hex };
      return d;
    });
  const setFont = (which: "heading" | "body", v: string) =>
    patch((d) => {
      ensureTheme(d);
      d.theme!.fontFamily = { ...(d.theme!.fontFamily ?? {}), [which]: v };
      return d;
    });

  const markEdited = (slideId: string) =>
    setEditedSlides((s) => (s.has(slideId) ? s : new Set(s).add(slideId)));

  const updateSlide = (slideId: string, fn: (s: Slide) => void) => {
    patch((d) => {
      for (const sec of d.sections) {
        const sl = sec.slides.find((x) => x.id === slideId);
        if (sl) {
          fn(sl);
          break;
        }
      }
      return d;
    });
    markEdited(slideId);
  };

  const updateBlock = (blockId: string, fn: (b: Block) => void) =>
    updateSlide(current.slide.id, (s) => {
      const b = s.blocks.find((x) => x.id === blockId);
      if (b) fn(b);
    });

  // F8 对话式精修：对本页按一句话指令做局部改写（不触发整份重生成）。
  const applyRefine = async () => {
    if (!current || refineText.trim().length < 2) return;
    setRefining(true);
    setMsg(null);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: deck.meta.subject,
          gradeLevel: deck.meta.gradeLevel,
          slide: current.slide,
          instruction: refineText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "精修失败");
      const ns = (data as {
        slide: { layout: Slide["layout"]; pedagogyRole?: Slide["pedagogyRole"]; speakerNotes?: string; blocks: Block[] };
      }).slide;
      updateSlide(current.slide.id, (s) => {
        s.layout = ns.layout;
        s.pedagogyRole = ns.pedagogyRole;
        s.speakerNotes = ns.speakerNotes;
        s.blocks = ns.blocks;
      });
      setRefineText("");
      setMsg("已精修本页 ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "精修失败");
    } finally {
      setRefining(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/decks/${deck.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deck),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "保存失败");
      // 用服务端自增后的 version 更新本地，避免连续保存触发乐观锁 409。
      const v = (data as { version?: number }).version;
      if (typeof v === "number") setDeck((p) => ({ ...p, version: v }));
      setDirty(false);
      setMsg("已保存 ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href={`/deck/${deck.id}`} className="text-sm text-muted hover:text-foreground">
          ← 返回
        </Link>
        <h1 className="font-heading text-lg font-bold">编辑：{deck.meta.title}</h1>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-sm text-muted">{msg}</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "保存中…" : dirty ? "保存" : "已保存"}
          </button>
          <button
            onClick={() => router.push(`/deck/${deck.id}`)}
            className="rounded-lg border border-muted/30 px-4 py-2 text-sm hover:bg-surface"
          >
            完成
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 实时预览 */}
        <section>
          <div className="overflow-hidden rounded-xl border border-muted/20 shadow-sm">
            <div className="flex items-center justify-between bg-surface px-3 py-1.5 text-xs text-muted">
              <span>预览 · 第 {i + 1} / {total} 页</span>
              <span>{sectionTitles[i]}</span>
            </div>
            <ThemedSurface deck={deck} className="min-h-[360px] p-6 sm:p-10">
              {/* 已编辑的页在客户端按最新内容重渲染；未编辑的页用服务端预渲染节点（省 KaTeX 客户端包） */}
              {current && editedSlides.has(current.slide.id) ? (
                <ClientSlideRenderer slide={current.slide} />
              ) : (
                slides[i]
              )}
            </ThemedSurface>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm">
            <button
              onClick={() => setI((x) => Math.max(0, x - 1))}
              disabled={i === 0}
              className="rounded px-3 py-1 hover:bg-surface disabled:opacity-30"
            >
              上一页
            </button>
            <span className="tabular-nums text-muted">
              {i + 1} / {total}
            </span>
            <button
              onClick={() => setI((x) => Math.min(total - 1, x + 1))}
              disabled={i === total - 1}
              className="rounded px-3 py-1 hover:bg-surface disabled:opacity-30"
            >
              下一页
            </button>
          </div>

          {/* AI 精修本页（F8） */}
          <div className="mt-5 rounded-xl border border-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground/80">AI 精修本页</h2>
            <p className="mt-1 text-xs text-muted">
              一句话描述改动，如「把这一页换成案例」「加一道测验题」「精简要点」。仅改本页。
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyRefine();
                }}
                placeholder="例如：把这一页换成案例"
                className="flex-1 rounded-lg border border-muted/30 bg-background p-2 text-sm"
              />
              <button
                onClick={applyRefine}
                disabled={refining || refineText.trim().length < 2}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {refining ? "精修中…" : "应用"}
              </button>
            </div>
          </div>

          {/* 直接编辑本页文字（F8） */}
          {current && (
            <div className="mt-4 rounded-xl border border-muted/20 p-4">
              <h2 className="text-sm font-semibold text-foreground/80">直接编辑本页文字</h2>
              <div className="mt-3 space-y-3">
                {current.slide.blocks.map((b) => (
                  <BlockEditor key={b.id} block={b} onChange={(fn) => updateBlock(b.id, fn)} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 控制面板 */}
        <aside className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground/80">模板</h2>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => patch((d) => ((d.templateId = t.id), d))}
                  className={`rounded-lg border p-2 text-left text-xs ${
                    deck.templateId === t.id
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-muted/30 hover:border-muted/60"
                  }`}
                >
                  <span
                    className="mb-1 block h-6 w-full rounded"
                    style={{ background: t.colors.primary }}
                  />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground/80">自定义</h2>

            <ColorRow label="主色" value={effColors.primary} onChange={(v) => setColor("primary", v)} />
            <ColorRow label="强调色" value={effColors.accent} onChange={(v) => setColor("accent", v)} />

            <label className="block text-sm">
              <span className="mb-1 block text-foreground/80">标题字体</span>
              <select
                value={effHeading}
                onChange={(e) => setFont("heading", e.target.value)}
                className="w-full rounded-lg border border-muted/30 bg-background p-2 text-sm"
              >
                {headingOpts.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-foreground/80">正文字体</span>
              <select
                value={effBody}
                onChange={(e) => setFont("body", e.target.value)}
                className="w-full rounded-lg border border-muted/30 bg-background p-2 text-sm"
              >
                {bodyOpts.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 flex justify-between text-foreground/80">
                <span>字号缩放</span>
                <span className="tabular-nums text-muted">{fontScale.toFixed(2)}×</span>
              </span>
              <input
                type="range"
                min={0.8}
                max={1.4}
                step={0.05}
                value={fontScale}
                onChange={(e) =>
                  patch((d) => {
                    ensureTheme(d);
                    d.theme!.fontScale = Number(e.target.value);
                    return d;
                  })
                }
                className="w-full accent-primary"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-foreground/80">校徽 / 标识 URL</span>
              <input
                type="url"
                placeholder="https://… 或 /logo.png"
                value={deck.theme?.logoUrl ?? ""}
                onChange={(e) =>
                  patch((d) => {
                    ensureTheme(d);
                    d.theme!.logoUrl = e.target.value || undefined;
                    return d;
                  })
                }
                className="w-full rounded-lg border border-muted/30 bg-background p-2 text-sm"
              />
            </label>

            <button
              onClick={() => patch((d) => ((d.theme = undefined), d))}
              className="text-xs text-muted hover:text-foreground"
            >
              恢复模板默认
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span className="text-foreground/80">{label}</span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums text-xs text-muted">{value}</span>
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-muted/30 bg-background"
        />
      </span>
    </label>
  );
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  image: "图片",
  code: "代码",
  table: "表格",
  media: "音视频",
  formula: "公式",
  poll: "投票",
  mcq: "选择题",
  trueFalse: "判断题",
  quiz: "测验",
  discussionWall: "讨论墙",
  wordCloud: "词云",
};

/** 直接编辑：文字类块可改文本，结构/媒体/互动块提示用 AI 精修。 */
function BlockEditor({ block, onChange }: { block: Block; onChange: (fn: (b: Block) => void) => void }) {
  if (block.type === "heading")
    return (
      <FieldInput
        label={`标题 H${block.level}`}
        value={block.text}
        onChange={(v) => onChange((b) => void (b.type === "heading" && (b.text = v)))}
      />
    );
  if (block.type === "text")
    return (
      <FieldArea
        label="正文"
        value={block.text}
        onChange={(v) => onChange((b) => void (b.type === "text" && (b.text = v)))}
      />
    );
  if (block.type === "quote")
    return (
      <FieldArea
        label="引用"
        value={block.text}
        onChange={(v) => onChange((b) => void (b.type === "quote" && (b.text = v)))}
      />
    );
  if (block.type === "bulletList") return <BulletEditor items={block.items} onChange={onChange} />;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs text-muted">
      {BLOCK_TYPE_LABELS[block.type] ?? block.type}（用上方「AI 精修」修改）
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-muted/30 bg-background p-2 text-sm"
      />
    </label>
  );
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <textarea
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-muted/30 bg-background p-2 text-sm"
      />
    </label>
  );
}

function BulletEditor({ items, onChange }: { items: string[]; onChange: (fn: (b: Block) => void) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs text-muted">列表</span>
      <div className="space-y-1.5">
        {items.map((it, j) => (
          <div key={j} className="flex items-center gap-2">
            <span className="text-muted">·</span>
            <input
              value={it}
              onChange={(e) =>
                onChange((b) => void (b.type === "bulletList" && (b.items[j] = e.target.value)))
              }
              className="flex-1 rounded border border-muted/20 bg-background px-2 py-1 text-sm"
            />
            <button
              onClick={() =>
                onChange((b) => void (b.type === "bulletList" && b.items.length > 1 && b.items.splice(j, 1)))
              }
              disabled={items.length <= 1}
              className="px-1.5 text-xs text-muted hover:text-red-600 disabled:opacity-30"
              aria-label="删除项"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange((b) => void (b.type === "bulletList" && b.items.push("新要点")))}
        className="mt-1.5 text-xs text-primary hover:underline"
      >
        + 添加项
      </button>
    </div>
  );
}
