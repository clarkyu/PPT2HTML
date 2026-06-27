"use client";

/**
 * 全屏播放器（F9）：键盘/触控/点击翻页、演讲者备注、计时、全屏。
 * 幻灯片在服务端预渲染后作为 ReactNode 传入，客户端只负责切换与控制，
 * 以保持客户端轻量（KaTeX 等留在服务端）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Deck } from "@/schema/types";
import { ThemedSurface } from "@/renderer/ThemedSurface";

export interface PlayerProps {
  title: string;
  deckId: string;
  themeRef: Pick<Deck, "templateId" | "theme">;
  slides: React.ReactNode[];
  notes: (string | undefined)[];
  sectionTitles: string[];
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Player({ title, deckId, themeRef, slides, notes, sectionTitles }: PlayerProps) {
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      rootRef.current?.requestFullscreen().catch(() => {});
    }
  }, []);

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          setIndex(0);
          break;
        case "End":
          setIndex(total - 1);
          break;
        case "n":
        case "N":
          setNotesOpen((v) => !v);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, total, toggleFullscreen]);

  // 计时
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // 全屏状态同步
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  const onSlideClick = (e: React.MouseEvent) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    if (x < width * 0.25) prev();
    else next();
  };

  const note = notes[index];

  return (
    <div ref={rootRef} className="fixed inset-0 flex flex-col bg-neutral-900 text-white">
      {/* 顶部控制条 */}
      <header className="flex items-center gap-3 px-4 py-2 text-sm">
        <Link href={`/deck/${deckId}`} className="rounded px-2 py-1 hover:bg-white/10" aria-label="退出播放">
          ← 退出
        </Link>
        <span className="truncate font-medium">{title}</span>
        <span className="ml-auto tabular-nums text-white/70">{sectionTitles[index]}</span>
        <button
          onClick={() => setRunning((r) => !r)}
          className="rounded px-2 py-1 tabular-nums hover:bg-white/10"
          aria-label={running ? "暂停计时" : "继续计时"}
          title="点击暂停/继续计时"
        >
          {running ? "⏱" : "▶"} {fmt(seconds)}
        </button>
        <button
          onClick={() => setNotesOpen((v) => !v)}
          className={`rounded px-2 py-1 hover:bg-white/10 ${notesOpen ? "bg-white/15" : ""}`}
          aria-pressed={notesOpen}
        >
          备注
        </button>
        <button onClick={toggleFullscreen} className="rounded px-2 py-1 hover:bg-white/10">
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
      </header>

      {/* 幻灯片区 */}
      <main className="relative flex-1 overflow-hidden p-2 sm:p-4">
        <ThemedSurface
          deck={themeRef}
          className="mx-auto flex h-full w-full max-w-6xl cursor-pointer overflow-auto rounded-xl p-6 shadow-2xl sm:p-10"
          style={{}}
        >
          <div
            className="flex min-h-full w-full"
            onClick={onSlideClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {slides[index]}
          </div>
        </ThemedSurface>
      </main>

      {/* 演讲者备注 */}
      {notesOpen && (
        <section className="border-t border-white/10 bg-neutral-800 px-4 py-3 text-sm text-white/80">
          <span className="mr-2 font-medium text-white/60">演讲者备注</span>
          {note || <span className="text-white/40">（本页无备注）</span>}
        </section>
      )}

      {/* 底部进度与翻页 */}
      <footer className="flex items-center gap-4 px-4 py-2">
        <button
          onClick={prev}
          disabled={index === 0}
          className="rounded px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-30"
        >
          上一页
        </button>
        <div className="flex-1">
          <div className="h-1 w-full overflow-hidden rounded bg-white/15">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>
        <span className="tabular-nums text-sm text-white/70">
          {index + 1} / {total}
        </span>
        <button
          onClick={next}
          disabled={index === total - 1}
          className="rounded px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-30"
        >
          下一页
        </button>
      </footer>
    </div>
  );
}
