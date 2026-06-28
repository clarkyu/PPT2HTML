"use client";

/**
 * CoursePlayer —— 网页版课件的「混合幻灯片」播放器（Phase 1 雏形）。
 * 全屏一页一主角，键盘/边缘点击/按钮/圆点翻页，方向感知转场，进入时子元素逐个上浮。
 * 交互页（playground）嵌入 AiPlayground。后续接入数据模型 + 生成器，由生成器产出 Slide[]。
 */
import { useCallback, useEffect, useState } from "react";
import AiPlayground, { type PlaygroundScript } from "@/components/interactive/AiPlayground";
import styles from "./CoursePlayer.module.css";

export type Slide =
  | { kind: "cover"; eyebrow: string; title: string; subtitle: string }
  | {
      kind: "cards";
      eyebrow: string;
      title: string;
      lead?: string;
      cards: { label: string; title: string; desc: string }[];
    }
  | { kind: "playground"; eyebrow: string; title: string; lead?: string; scripts: PlaygroundScript[] }
  | {
      kind: "quiz";
      eyebrow: string;
      title: string;
      options: string[];
      answer: number;
      explain: string;
    }
  | {
      kind: "summary";
      eyebrow: string;
      title: string;
      bullets: string[];
      next: string;
    };

const LETTERS = ["A", "B", "C", "D", "E"];

function QuizSlide({ slide }: { slide: Extract<Slide, { kind: "quiz" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className={styles.quiz}>
      <p className={styles.eyebrow}>{slide.eyebrow}</p>
      <h2 className={styles.h2}>{slide.title}</h2>
      <div className={styles.opts}>
        {slide.options.map((opt, i) => {
          const revealed = picked !== null;
          const isAnswer = i === slide.answer;
          const cls = revealed
            ? isAnswer
              ? styles.optCorrect
              : i === picked
                ? styles.optWrong
                : ""
            : "";
          return (
            <button
              key={i}
              className={`${styles.opt} ${cls}`}
              disabled={revealed}
              onClick={() => setPicked(i)}
            >
              <span className={styles.optTag}>{revealed && isAnswer ? "✓" : LETTERS[i]}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && <div className={styles.explain}>{slide.explain}</div>}
    </div>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "cover":
      return (
        <div className={styles.stagger} style={{ display: "contents" }}>
          <p className={styles.eyebrow}>{slide.eyebrow}</p>
          <h1 className={styles.coverTitle}>{slide.title}</h1>
          <p className={styles.coverSub}>{slide.subtitle}</p>
          <span className={styles.hint}>
            <span className={styles.hintKey}>→</span> 按方向键 / 点击翻页开始
          </span>
        </div>
      );
    case "cards":
      return (
        <>
          <p className={styles.eyebrow}>{slide.eyebrow}</p>
          <h2 className={styles.h2}>{slide.title}</h2>
          {slide.lead && <p className={styles.lead}>{slide.lead}</p>}
          <div className={`${styles.cards} ${styles.stagger}`}>
            {slide.cards.map((c) => (
              <div key={c.title} className={styles.card}>
                <div className={styles.cardLabel}>{c.label}</div>
                <h3 className={styles.cardTitle}>{c.title}</h3>
                <p className={styles.cardDesc}>{c.desc}</p>
              </div>
            ))}
          </div>
        </>
      );
    case "playground":
      return (
        <>
          <p className={styles.eyebrow}>{slide.eyebrow}</p>
          <h2 className={styles.h2}>{slide.title}</h2>
          {slide.lead && <p className={styles.lead}>{slide.lead}</p>}
          <div className={styles.pg}>
            <AiPlayground scripts={slide.scripts} />
          </div>
        </>
      );
    case "quiz":
      return <QuizSlide slide={slide} />;
    case "summary":
      return (
        <>
          <p className={styles.eyebrow}>{slide.eyebrow}</p>
          <h2 className={styles.h2}>{slide.title}</h2>
          <ul className={`${styles.bullets} ${styles.stagger}`}>
            {slide.bullets.map((b) => (
              <li key={b}>
                <span className={styles.tick}>✓</span>
                {b}
              </li>
            ))}
          </ul>
          <p className={styles.next}>
            下一课 · <b>{slide.next}</b>
          </p>
        </>
      );
  }
}

export default function CoursePlayer({ slides }: { slides: Slide[] }) {
  const total = slides.length;
  const [{ i, dir }, setS] = useState<{ i: number; dir: "next" | "prev" }>({ i: 0, dir: "next" });

  const go = useCallback(
    (delta: number) => {
      setS((s) => {
        const ni = Math.min(total - 1, Math.max(0, s.i + delta));
        return ni === s.i ? s : { i: ni, dir: delta > 0 ? "next" : "prev" };
      });
    },
    [total],
  );
  const goto = useCallback((n: number) => {
    setS((s) => (n === s.i ? s : { i: n, dir: n > s.i ? "next" : "prev" }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className={styles.stage}>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>
      <div className={styles.topbar}>
        <span className={styles.brand}>言课 · AI 编程</span>
        <span>
          {i + 1} / {total}
        </span>
      </div>

      <div className={styles.edge + " " + styles.edgeL} onClick={() => go(-1)} aria-hidden />
      <div className={styles.edge + " " + styles.edgeR} onClick={() => go(1)} aria-hidden />

      <div
        key={i}
        className={`${styles.slide} ${dir === "next" ? styles.enterNext : styles.enterPrev} ${
          slides[i].kind === "playground" ? styles.slideTall : ""
        }`}
      >
        <SlideView slide={slides[i]} />
      </div>

      <div className={styles.nav}>
        <button className={styles.arrow} onClick={() => go(-1)} disabled={i === 0} aria-label="上一页">
          ‹
        </button>
        <div className={styles.dots}>
          {slides.map((_, n) => (
            <button
              key={n}
              className={`${styles.dot} ${n === i ? styles.dotActive : ""}`}
              onClick={() => goto(n)}
              aria-label={`第 ${n + 1} 页`}
            />
          ))}
        </div>
        <button
          className={styles.arrow}
          onClick={() => go(1)}
          disabled={i === total - 1}
          aria-label="下一页"
        >
          ›
        </button>
      </div>
    </div>
  );
}
