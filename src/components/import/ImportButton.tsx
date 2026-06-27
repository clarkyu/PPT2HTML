"use client";

/**
 * 导入 PPT 入口（F6）：选择 .pptx → 上传解析 → 跳转到生成的课件（可编辑/可授课）。
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ImportButton({ className }: { className?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "导入失败");
      router.push(`/deck/${(data as { id: string }).id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={
          className ??
          "rounded-lg border border-muted/30 px-5 py-2.5 font-medium text-foreground hover:bg-surface disabled:opacity-50"
        }
      >
        {busy ? "导入中…" : "📥 导入 PPT"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
