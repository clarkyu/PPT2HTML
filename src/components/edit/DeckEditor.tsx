"use client";

/**
 * 课件编辑器（M3-1 · F5）：模板切换 + 基础自定义（配色/字体/字号/校徽）+ 实时预览 + 保存。
 * 得益于内容与渲染分离，这里只改 templateId / theme，内容结构不变，预览即时反映。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColorTokens, Deck, Template } from "@/schema/types";
import { ThemedSurface } from "@/renderer/ThemedSurface";
import { SlideRenderer } from "@/renderer/SlideRenderer";
import { flattenSlides } from "@/renderer/flatten";
import { getTemplate } from "@/templates/registry";

const FONT_OPTIONS = [
  { label: "无衬线", value: "ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: "衬线", value: "Georgia, 'Songti SC', 'STSong', serif" },
  { label: "圆体", value: "ui-rounded, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" },
  { label: "等宽", value: "ui-monospace, 'SFMono-Regular', Menlo, monospace" },
];

export function DeckEditor({ deck: initial, templates }: { deck: Deck; templates: Template[] }) {
  const router = useRouter();
  const [deck, setDeck] = useState<Deck>(initial);
  const [i, setI] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const flat = flattenSlides(deck);
  const template = getTemplate(deck.templateId);
  const effColors: ColorTokens = { ...template.colors, ...(deck.theme?.colors ?? {}) };
  const effHeading = deck.theme?.fontFamily?.heading ?? template.fontFamily.heading;
  const effBody = deck.theme?.fontFamily?.body ?? template.fontFamily.body;
  const fontScale = deck.theme?.fontScale ?? 1;

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
      setDirty(false);
      setMsg("已保存 ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const current = flat[i];

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
              <span>预览 · 第 {i + 1} / {flat.length} 页</span>
              <span>{current?.sectionTitle}</span>
            </div>
            <ThemedSurface deck={deck} className="min-h-[360px] p-6 sm:p-10">
              {current && <SlideRenderer slide={current.slide} reveal />}
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
              {i + 1} / {flat.length}
            </span>
            <button
              onClick={() => setI((x) => Math.min(flat.length - 1, x + 1))}
              disabled={i === flat.length - 1}
              className="rounded px-3 py-1 hover:bg-surface disabled:opacity-30"
            >
              下一页
            </button>
          </div>
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
                {FONT_OPTIONS.map((f) => (
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
                {FONT_OPTIONS.map((f) => (
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
