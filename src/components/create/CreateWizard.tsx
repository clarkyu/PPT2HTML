"use client";

/**
 * 一句话生成向导（F1–F4）：一句话 → 意图卡片(可纠偏) → 大纲(可增删改调序) → 逐节生成 → 落库跳转。
 * 生成由服务端 API 驱动（有 Key 真实模型，无 Key 离线 Mock）。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GradeLevel } from "@/schema/types";
import type { IntentCard, IntentField, DraftSection } from "@/ai/schemas";
import type { OutlineParsed } from "@/schema/zod";

type Step = "input" | "intent" | "outline" | "generating";

const GRADES: { value: GradeLevel; label: string }[] = [
  { value: "preschool", label: "学前" },
  { value: "primary", label: "小学" },
  { value: "junior", label: "初中" },
  { value: "senior", label: "高中" },
  { value: "vocational", label: "职教" },
  { value: "higher", label: "大学" },
  { value: "adult", label: "成人" },
];

const PEDAGOGY: { value: string; label: string }[] = [
  { value: "intro", label: "导入" },
  { value: "explain", label: "讲解" },
  { value: "example", label: "举例" },
  { value: "interaction", label: "互动" },
  { value: "summary", label: "小结" },
];

const EXAMPLES = [
  "给大一新生讲讲什么是机器学习，45 分钟",
  "高校《数据结构》二叉树遍历",
  "大学物理 麦克斯韦方程组导论",
];

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || "请求失败");
  return data as T;
}

export function CreateWizard({ mock }: { mock: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [sentence, setSentence] = useState("");
  const [intent, setIntent] = useState<IntentCard | null>(null);
  const [outline, setOutline] = useState<OutlineParsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "出错了");
    } finally {
      setBusy(false);
    }
  };

  const submitSentence = () =>
    run(async () => {
      const { intent } = await postJSON<{ intent: IntentCard }>("/api/generate/intent", { sentence });
      setIntent(intent);
      setStep("intent");
    });

  const setField = <K extends keyof IntentCard>(key: K, value: IntentCard[K]) => {
    setIntent((prev) =>
      prev
        ? { ...prev, [key]: value, filled: prev.filled.filter((f) => f !== (key as IntentField)) }
        : prev,
    );
  };

  const confirmIntent = () =>
    run(async () => {
      const { outline } = await postJSON<{ outline: OutlineParsed }>("/api/generate/outline", { intent });
      setOutline(outline);
      setStep("outline");
    });

  const generate = () =>
    run(async () => {
      if (!intent || !outline) return;
      setStep("generating");
      const drafts: DraftSection[] = [];
      for (let i = 0; i < outline.sections.length; i++) {
        setProgress({ done: i, total: outline.sections.length, current: outline.sections[i].title });
        const { section } = await postJSON<{ section: DraftSection }>("/api/generate/section", {
          intent,
          outline,
          index: i,
        });
        drafts.push(section);
      }
      setProgress({ done: outline.sections.length, total: outline.sections.length, current: "保存中…" });
      const { id } = await postJSON<{ id: string }>("/api/decks", { intent, drafts });
      router.push(`/deck/${id}`);
    });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← 返回
        </Link>
        <Steps step={step} />
      </div>

      {mock && (
        <p className="mt-4 rounded-lg bg-accent/15 px-3 py-2 text-xs text-foreground/80">
          当前为<strong>离线示例生成</strong>（未配置 LLM Key）。配置 Key 后即由真实模型生成。
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {step === "input" && (
        <section className="mt-6">
          <h1 className="font-heading text-2xl font-bold">一句话，生成一节课</h1>
          <p className="mt-2 text-sm text-muted">描述你想讲的课，可附上学段、时长、风格。</p>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            rows={3}
            placeholder="例如：给大一新生讲讲什么是机器学习，45 分钟，风格活泼"
            className="mt-4 w-full rounded-lg border border-muted/30 bg-background p-3 text-base outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setSentence(ex)}
                className="rounded-full bg-surface px-3 py-1 text-xs text-muted hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          <button
            onClick={submitSentence}
            disabled={busy || sentence.trim().length < 2}
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "解析中…" : "下一步：确认要素"}
          </button>
        </section>
      )}

      {step === "intent" && intent && (
        <section className="mt-6 space-y-4">
          <div>
            <h1 className="font-heading text-xl font-bold">确认课程要素</h1>
            <p className="mt-1 text-sm text-muted">
              <span className="rounded bg-accent/20 px-1.5">浅色标记</span> 是系统替你补的，可直接修改。
            </p>
          </div>
          <Field label="主题" filled={intent.filled.includes("topic")}>
            <input
              value={intent.topic}
              onChange={(e) => setField("topic", e.target.value)}
              className="w-full rounded-lg border border-muted/30 bg-background p-2"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="学科" filled={intent.filled.includes("subject")}>
              <input
                value={intent.subject}
                onChange={(e) => setField("subject", e.target.value)}
                className="w-full rounded-lg border border-muted/30 bg-background p-2"
              />
            </Field>
            <Field label="学段" filled={intent.filled.includes("gradeLevel")}>
              <select
                value={intent.gradeLevel}
                onChange={(e) => setField("gradeLevel", e.target.value as GradeLevel)}
                className="w-full rounded-lg border border-muted/30 bg-background p-2"
              >
                {GRADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="时长（分钟）" filled={intent.filled.includes("durationMinutes")}>
              <input
                type="number"
                min={5}
                value={intent.durationMinutes}
                onChange={(e) => setField("durationMinutes", Math.max(5, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-muted/30 bg-background p-2"
              />
            </Field>
            <Field label="风格" filled={intent.filled.includes("style")}>
              <input
                value={intent.style}
                onChange={(e) => setField("style", e.target.value)}
                className="w-full rounded-lg border border-muted/30 bg-background p-2"
              />
            </Field>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("input")}
              className="rounded-lg border border-muted/30 px-4 py-2 text-sm hover:bg-surface"
            >
              重新输入
            </button>
            <button
              onClick={confirmIntent}
              disabled={busy}
              className="rounded-lg bg-primary px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "生成大纲中…" : "确认，生成大纲"}
            </button>
          </div>
        </section>
      )}

      {step === "outline" && outline && (
        <OutlineEditor
          outline={outline}
          setOutline={setOutline}
          busy={busy}
          onBack={() => setStep("intent")}
          onConfirm={generate}
        />
      )}

      {step === "generating" && (
        <section className="mt-10 text-center">
          <h1 className="font-heading text-xl font-bold">正在生成全文…</h1>
          {progress && (
            <>
              <p className="mt-3 text-sm text-muted">
                {progress.done}/{progress.total} · {progress.current}
              </p>
              <div className="mx-auto mt-4 h-2 w-full max-w-md overflow-hidden rounded bg-surface">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </section>
      )}
    </main>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ["input", "intent", "outline", "generating"];
  const labels: Record<Step, string> = {
    input: "输入",
    intent: "要素",
    outline: "大纲",
    generating: "生成",
  };
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {order.map((s, i) => (
        <span key={s} className={i <= idx ? "font-medium text-primary" : "text-muted"}>
          {labels[s]}
          {i < order.length - 1 && <span className="mx-1 text-muted">›</span>}
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  filled,
  children,
}: {
  label: string;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm text-foreground/80">
        {label}
        {filled && <span className="rounded bg-accent/20 px-1.5 text-xs text-foreground/70">我替你补的</span>}
      </span>
      {children}
    </label>
  );
}

function OutlineEditor({
  outline,
  setOutline,
  busy,
  onBack,
  onConfirm,
}: {
  outline: OutlineParsed;
  setOutline: (o: OutlineParsed) => void;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const update = (fn: (o: OutlineParsed) => OutlineParsed) => setOutline(fn(structuredClone(outline)));

  return (
    <section className="mt-6 space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold">确认大纲</h1>
        <p className="mt-1 text-sm text-muted">可增删、编辑、调序。确认后据此生成全文。</p>
      </div>

      <div className="space-y-3">
        {outline.sections.map((sec, i) => (
          <div key={i} className="rounded-xl border border-muted/20 bg-surface p-3">
            <div className="flex items-center gap-2">
              <input
                value={sec.title}
                onChange={(e) =>
                  update((o) => {
                    o.sections[i].title = e.target.value;
                    return o;
                  })
                }
                className="flex-1 rounded border border-muted/30 bg-background px-2 py-1 font-medium"
              />
              <button
                onClick={() => update((o) => (i > 0 ? swap(o, i, i - 1) : o))}
                disabled={i === 0}
                className="px-1.5 text-muted hover:text-foreground disabled:opacity-30"
                aria-label="上移"
              >
                ↑
              </button>
              <button
                onClick={() => update((o) => (i < o.sections.length - 1 ? swap(o, i, i + 1) : o))}
                disabled={i === outline.sections.length - 1}
                className="px-1.5 text-muted hover:text-foreground disabled:opacity-30"
                aria-label="下移"
              >
                ↓
              </button>
              <button
                onClick={() =>
                  update((o) => {
                    o.sections.splice(i, 1);
                    return o;
                  })
                }
                className="px-1.5 text-muted hover:text-red-600"
                aria-label="删除该节"
              >
                ✕
              </button>
            </div>
            <ul className="mt-2 space-y-1.5 pl-1">
              {sec.points.map((p, j) => (
                <li key={j} className="flex items-center gap-2">
                  <span className="text-muted">·</span>
                  <input
                    value={p}
                    onChange={(e) =>
                      update((o) => {
                        o.sections[i].points[j] = e.target.value;
                        return o;
                      })
                    }
                    className="flex-1 rounded border border-muted/20 bg-background px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() =>
                      update((o) => {
                        o.sections[i].points.splice(j, 1);
                        return o;
                      })
                    }
                    className="px-1.5 text-xs text-muted hover:text-red-600"
                    aria-label="删除要点"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() =>
                update((o) => {
                  o.sections[i].points.push("新要点");
                  return o;
                })
              }
              className="mt-2 text-xs text-primary hover:underline"
            >
              + 添加要点
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() =>
          update((o) => {
            o.sections.push({ title: "新的一节", points: ["要点一"], pedagogyRole: "explain" });
            return o;
          })
        }
        className="w-full rounded-lg border border-dashed border-muted/40 py-2 text-sm text-muted hover:text-foreground"
      >
        + 添加一节
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-lg border border-muted/30 px-4 py-2 text-sm hover:bg-surface">
          上一步
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || outline.sections.length === 0}
          className="rounded-lg bg-primary px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          确认，生成全文
        </button>
      </div>
    </section>
  );
}

function swap(o: OutlineParsed, a: number, b: number): OutlineParsed {
  [o.sections[a], o.sections[b]] = [o.sections[b], o.sections[a]];
  return o;
}
