"use client";

/**
 * AiPlayground —— 「提示词 → Claude 流式写代码」可玩教学组件（Aha 时刻）。
 *
 * 脚本化演示：内容（提示词/代码/讲解）由 props 传入，组件负责把它演成"真·实时"的样子：
 * 打字提问 → 思考 → 流式生成带语法高亮的代码 → 讲解。零后端、零密钥、可分享，视觉与真实时一致。
 * 这是可复用 `interactive` 块的雏形：未来由生成器把 PlaygroundScript 写进课件。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sliceTokens, tokenize, type Tok } from "./highlight";
import styles from "./AiPlayground.module.css";

export interface PlaygroundScript {
  /** 标签名（多脚本切换时显示） */
  label: string;
  /** 用户输入的提示词 */
  prompt: string;
  /** 文件名，如 guess.py */
  filename: string;
  /** 语言：python | js | ts | jsx ... 影响高亮关键字表与 LANG 角标 */
  language: string;
  /** 流式生成的代码 */
  code: string;
  /** 代码后的一句话讲解（可选） */
  explanation?: string;
}

type Phase = "idle" | "typingPrompt" | "thinking" | "code" | "explain" | "done";

interface Cancel {
  cancelled: boolean;
}

/** rAF 流式：按 cps（每秒字符数）把可见字符数从 0 推到 total。 */
function streamTo(
  setter: (n: number) => void,
  total: number,
  cps: number,
  signal: Cancel,
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      if (signal.cancelled) return resolve();
      const elapsed = (now - start) / 1000;
      const target = Math.min(total, Math.floor(elapsed * cps));
      setter(target);
      if (target >= total) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function wait(ms: number, signal: Cancel): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    // 取消时尽快了结（计时器到点也会 resolve，无副作用）。
    const tick = () => {
      if (signal.cancelled) {
        clearTimeout(id);
        resolve();
      } else if (!signal.cancelled) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function TokenView({ tokens }: { tokens: Tok[] }) {
  return (
    <>
      {tokens.map((tk, i) => (
        <span key={i} className={styles[tk.t]}>
          {tk.v}
        </span>
      ))}
    </>
  );
}

export default function AiPlayground({ scripts }: { scripts: PlaygroundScript[] }) {
  const [active, setActive] = useState(0);
  const script = scripts[active];

  const [phase, setPhase] = useState<Phase>("idle");
  const [promptN, setPromptN] = useState(0);
  const [codeN, setCodeN] = useState(0);
  const [explainN, setExplainN] = useState(0);

  const tokensRef = useRef<Tok[]>([]);
  tokensRef.current = tokenize(script.code, script.language);

  const run = useCallback(
    async (s: PlaygroundScript, signal: Cancel) => {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setPromptN(s.prompt.length);
        setCodeN(s.code.length);
        setExplainN(s.explanation?.length ?? 0);
        setPhase("done");
        return;
      }
      setPromptN(0);
      setCodeN(0);
      setExplainN(0);
      setPhase("typingPrompt");
      await streamTo(setPromptN, s.prompt.length, 26, signal);
      await wait(420, signal);
      setPhase("thinking");
      await wait(1150, signal);
      setPhase("code");
      await streamTo(setCodeN, s.code.length, 95, signal);
      if (s.explanation) {
        await wait(280, signal);
        setPhase("explain");
        await streamTo(setExplainN, s.explanation.length, 42, signal);
      }
      setPhase("done");
    },
    [],
  );

  const signalRef = useRef<Cancel>({ cancelled: false });
  const start = useCallback(
    (s: PlaygroundScript) => {
      signalRef.current.cancelled = true; // 取消上一轮，避免并发流式 setState
      const signal: Cancel = { cancelled: false };
      signalRef.current = signal;
      run(s, signal);
    },
    [run],
  );

  useEffect(() => {
    start(script);
    return () => {
      signalRef.current.cancelled = true;
    };
    // 仅在切换脚本时重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const replay = () => start(script);

  const visibleCode = script.code.slice(0, codeN);
  const lineCount = Math.max(1, visibleCode.split("\n").length);
  const showCodePanel = phase === "code" || phase === "explain" || phase === "done";

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <span className={styles.title}>言课 · Claude Playground</span>
        {scripts.length > 1 && (
          <div className={styles.tabs}>
            {scripts.map((s, i) => (
              <button
                key={s.label}
                className={`${styles.tab} ${i === active ? styles.tabActive : ""}`}
                onClick={() => setActive(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* 用户提问 */}
        <div className={styles.promptRow}>
          <div className={`${styles.avatar} ${styles.avatarUser}`}>你</div>
          <div className={styles.bubble}>
            {script.prompt.slice(0, promptN)}
            {phase === "typingPrompt" && <span className={styles.caret} />}
          </div>
        </div>

        {/* Claude 回复 */}
        {phase !== "idle" && phase !== "typingPrompt" && (
          <div className={styles.aiRow}>
            <div className={`${styles.avatar} ${styles.avatarAI}`}>✳</div>
            <div className={styles.aiCol}>
              {phase === "thinking" ? (
                <div className={styles.thinking}>
                  Claude 正在思考
                  <span className={styles.pdot} />
                  <span className={styles.pdot} />
                  <span className={styles.pdot} />
                </div>
              ) : (
                showCodePanel && (
                  <div className={styles.codePanel}>
                    <div className={styles.codeBar}>
                      <span>{script.filename}</span>
                      <span className={styles.lang}>{script.language}</span>
                    </div>
                    <div className={styles.codeScroll}>
                      <div className={styles.gutter}>
                        {Array.from({ length: lineCount }, (_, i) => i + 1).join("\n")}
                      </div>
                      <pre className={styles.pre}>
                        <code>
                          <TokenView tokens={sliceTokens(tokensRef.current, codeN)} />
                          {phase === "code" && <span className={styles.caret} />}
                        </code>
                      </pre>
                    </div>
                  </div>
                )
              )}

              {(phase === "explain" || phase === "done") && script.explanation && (
                <div className={styles.explain}>
                  {script.explanation.slice(0, explainN)}
                  {phase === "explain" && <span className={styles.caret} />}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.foot}>
          <button className={styles.replay} onClick={replay} disabled={phase !== "done"}>
            ▶ 重新演示
          </button>
          <span className={styles.hint}>
            {phase === "done" ? "试着想象：换成你的一句话，会生成什么？" : "演示进行中…"}
          </span>
        </div>
      </div>
    </div>
  );
}
