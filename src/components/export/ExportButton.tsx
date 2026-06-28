"use client";

/**
 * 导出 PDF：用户在横版（16:9 幻灯片）/ 竖版（A4 讲义）间切换，竖版可选含演讲者备注。
 * 通过 /api/export/[id] 服务端用 Playwright 渲染，下载为 PDF。
 */
import { useState } from "react";

type Layout = "landscape" | "portrait";

export function ExportButton({ deckId, title }: { deckId: string; title: string }) {
  const [layout, setLayout] = useState<Layout>("landscape");
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ layout });
      if (layout === "portrait" && notes) q.set("notes", "1");
      const res = await fetch(`/api/export/${deckId}?${q.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "导出失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "课件"}-${layout === "portrait" ? "讲义" : "幻灯片"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center rounded-lg border border-muted/30 px-4 py-2.5 font-medium text-foreground hover:bg-surface">
        ⬇ 导出 PDF
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-muted/20 bg-surface p-4 shadow-lg">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground/80">版式</legend>
          <div className="flex gap-2">
            <LayoutChoice current={layout} value="landscape" onChange={setLayout} label="横版" hint="16:9 幻灯片" />
            <LayoutChoice current={layout} value="portrait" onChange={setLayout} label="竖版" hint="A4 讲义" />
          </div>
        </fieldset>

        {layout === "portrait" && (
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} />
            含演讲者备注
          </label>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <button
          onClick={exportPdf}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "生成中…" : "导出"}
        </button>
      </div>
    </details>
  );
}

function LayoutChoice({
  current,
  value,
  onChange,
  label,
  hint,
}: {
  current: Layout;
  value: Layout;
  onChange: (v: Layout) => void;
  label: string;
  hint: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={active}
      className={`flex-1 rounded-lg border px-3 py-2 text-left ${
        active ? "border-primary bg-primary/10" : "border-muted/30 hover:bg-background"
      }`}
    >
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
    </button>
  );
}
