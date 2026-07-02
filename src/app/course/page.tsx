"use client";

/**
 * 生成剧场 /course —— 「一句话 → 惊艳网页课件」的舞台。
 * 流程：一句话 → 叙事弧计划（导演台亮相）→ 逐场景并发生成 → 就绪前缀流式进入播放器
 * → 全部完成自动保存 → 出分享链接。生成过程本身就是产品的第一个 wow。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CoursePlayer from "@/components/course/CoursePlayer";
import type { CoursePlan, CourseSlide } from "@/course/schema";
import styles from "./course.module.css";

type Phase = "input" | "planning" | "directing" | "playing";

const EXAMPLES = [
  "给初中生讲 AI 编程，从 Claude 开始",
  "给高中生讲傅里叶变换，直观一点",
  "给小学生讲光合作用，活泼有趣",
  "给成人讲复利，用生活例子",
];

const KIND_LABEL: Record<CourseSlide["kind"], string> = {
  cover: "封面",
  statement: "钩子",
  cards: "讲解",
  playground: "Aha 演示",
  quiz: "小测",
  summary: "小结",
};

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? `请求失败（${res.status}）`);
  return data;
}

export default function CourseTheaterPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [sentence, setSentence] = useState("");
  const [plan, setPlan] = useState<CoursePlan | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [slides, setSlides] = useState<(CourseSlide | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  // 运行代际：重置/重开后，旧一轮的异步回调全部失效（防串台）。
  const runRef = useRef(0);

  const readyPrefix = useMemo(() => {
    let n = 0;
    while (n < slides.length && slides[n]) n++;
    return n;
  }, [slides]);
  const doneCount = useMemo(() => slides.filter(Boolean).length, [slides]);
  const total = slides.length;
  const allDone = total > 0 && doneCount === total;

  const reset = useCallback(() => {
    runRef.current++;
    setPhase("input");
    setPlan(null);
    setSlides([]);
    setError(null);
    setShareId(null);
    setSaveFailed(false);
    setCopied(false);
  }, []);

  const generate = useCallback(
    async (input: string) => {
      const s = input.trim();
      if (s.length < 2) return;
      const run = ++runRef.current;
      setError(null);
      setShareId(null);
      setSaveFailed(false);
      setPhase("planning");
      try {
        const { plan, mock } = await postJSON<{ plan: CoursePlan; mock: boolean }>(
          "/api/course/plan",
          { sentence: s },
        );
        if (run !== runRef.current) return;
        setPlan(plan);
        setIsMock(mock);
        setSlides(new Array(plan.scenes.length).fill(null));
        setPhase("directing");

        // 全场景并发生成；单页失败先真实重试一次，再走服务端 Mock 兜底——整体流程不许失败。
        await Promise.all(
          plan.scenes.map(async (_, index) => {
            const body = { sentence: s, plan, index };
            let slide: CourseSlide | null = null;
            for (const attempt of [body, body, { ...body, fallback: true }]) {
              try {
                slide = (await postJSON<{ slide: CourseSlide }>("/api/course/scene", attempt)).slide;
                break;
              } catch {
                /* 尝试下一档 */
              }
            }
            if (run !== runRef.current) return;
            if (!slide) throw new Error(`第 ${index + 1} 页生成失败`);
            setSlides((prev) => {
              const nxt = [...prev];
              nxt[index] = slide;
              return nxt;
            });
          }),
        );
      } catch (e) {
        if (run !== runRef.current) return;
        setError(e instanceof Error ? e.message : "生成失败，请重试");
        setPhase((p) => (p === "planning" ? "input" : p));
      }
    },
    [],
  );

  // 封面就绪 → 进入播放（生成剩余页时已经能看、能翻）。
  useEffect(() => {
    if (phase === "directing" && readyPrefix >= 1) {
      const t = setTimeout(() => setPhase("playing"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, readyPrefix]);

  // 全部生成完成 → 自动保存，得到可分享链接。
  useEffect(() => {
    if (!allDone || shareId || saveFailed || !plan) return;
    const run = runRef.current;
    (async () => {
      try {
        const { id } = await postJSON<{ id: string }>("/api/course", {
          title: plan.title,
          sentence: sentence.trim() || undefined,
          slides,
        });
        if (run !== runRef.current) return;
        setShareId(id);
        window.history.replaceState(null, "", `/course/${id}`);
      } catch {
        if (run !== runRef.current) return;
        setSaveFailed(true);
      }
    })();
  }, [allDone, shareId, saveFailed, plan, sentence, slides]);

  const copyLink = useCallback(async () => {
    if (!shareId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/course/${shareId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用则忽略 */
    }
  }, [shareId]);

  // ===== 播放态：全屏播放器 + 状态胶囊 =====
  if (phase === "playing" && plan) {
    const ready = slides.slice(0, readyPrefix) as CourseSlide[];
    return (
      <>
        <CoursePlayer slides={ready} />
        <div className={styles.pill}>
          {!allDone ? (
            <>
              <span className={styles.beatSpin} />
              第 {doneCount}/{total} 页生成中，已就绪可先翻看
            </>
          ) : shareId ? (
            <>
              ✓ 已保存
              <button className={styles.pillBtn} onClick={copyLink}>
                {copied ? "已复制 ✓" : "复制分享链接"}
              </button>
              <button className={styles.pillBtn} onClick={reset}>
                再来一堂
              </button>
            </>
          ) : saveFailed ? (
            <>
              生成完成（保存失败，链接暂不可分享）
              <button className={styles.pillBtn} onClick={() => setSaveFailed(false)}>
                重试保存
              </button>
            </>
          ) : (
            <>
              <span className={styles.beatSpin} />
              保存中…
            </>
          )}
          {isMock && <span className={styles.mockTag}>· 离线示例模式</span>}
        </div>
      </>
    );
  }

  // ===== 输入 / 规划 / 导演台 =====
  return (
    <main className={styles.stage}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>言课 · 一句话成课</p>
        <h1 className={styles.title}>一句话，生成一堂惊艳的网页课</h1>
        <p className={styles.sub}>
          告诉我讲给谁、讲什么——叙事、页面、可玩的 Aha 演示与随堂小测，当场长出来。
        </p>
      </header>

      {(phase === "input" || phase === "planning") && (
        <>
          <div className={styles.form}>
            <div className={styles.inputWrap}>
              <textarea
                className={styles.input}
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (phase === "input") generate(sentence);
                  }
                }}
                placeholder="例如：给初中生讲 AI 编程，从 Claude 开始"
                maxLength={500}
                disabled={phase === "planning"}
              />
              <button
                className={styles.go}
                onClick={() => generate(sentence)}
                disabled={phase === "planning" || sentence.trim().length < 2}
              >
                {phase === "planning" ? (
                  <>
                    <span className={styles.beatSpin} /> 正在规划叙事…
                  </>
                ) : (
                  <>🎬 生成课件</>
                )}
              </button>
            </div>
            <div className={styles.chips}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className={styles.chip}
                  onClick={() => {
                    setSentence(ex);
                    generate(ex);
                  }}
                  disabled={phase === "planning"}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className={styles.error}>
              {error}
              <button className={styles.retry} onClick={() => generate(sentence)}>
                重试
              </button>
            </div>
          )}
        </>
      )}

      {phase === "directing" && plan && (
        <div className={styles.director}>
          <div className={styles.planCard}>
            <p className={styles.eyebrow}>{plan.eyebrow}</p>
            <h2 className={styles.planTitle}>{plan.title}</h2>
            <p className={styles.planSub}>{plan.subtitle}</p>
            <div className={styles.beats}>
              {plan.scenes.map((sc, i) => (
                <span key={i} className={`${styles.beat} ${slides[i] ? styles.beatDone : ""}`}>
                  {slides[i] ? <span className={styles.beatDot} /> : <span className={styles.beatSpin} />}
                  {i + 1} · {KIND_LABEL[sc.kind]}
                </span>
              ))}
            </div>
          </div>
          <p className={styles.narration}>
            叙事弧已定，<b>{doneCount}/{total}</b> 页就绪——封面一亮即刻开演
          </p>
          {error && (
            <div className={styles.error}>
              {error}
              <button className={styles.retry} onClick={reset}>
                重新开始
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
