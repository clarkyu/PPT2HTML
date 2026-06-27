/**
 * 互动块的「静态呈现」（MVP，runtime.live=false）。
 * 互动块是课件结构的一等公民：此处先把它们排版呈现出来；Phase 2 接入实时层后，
 * 同一份结构获得「发起→作答→聚合」的运行时能力，无需改 Schema（docs/03-data-model.md）。
 */
import type {
  DiscussionWallBlock,
  McqBlock,
  PollBlock,
  QuizBlock,
  TrueFalseBlock,
  WordCloudBlock,
} from "@/schema/types";

const LIVE_HINT = "课堂上学生可在手机端实时作答（Phase 2）";

function InteractiveShell({
  prompt,
  badge = "互动",
  hint = LIVE_HINT,
  children,
}: {
  prompt: string;
  badge?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
          {badge}
        </span>
        <p className="font-semibold text-foreground">{prompt}</p>
      </div>
      {children}
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

export function Poll({ block }: { block: PollBlock }) {
  return (
    <InteractiveShell prompt={block.prompt} badge={block.multi ? "多选投票" : "投票"}>
      <ul className="space-y-2">
        {block.options.map((opt, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg bg-background/70 px-3 py-2">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center border border-primary/50 text-primary ${
                block.multi ? "rounded" : "rounded-full"
              }`}
            />
            <span className="text-foreground/90">{opt}</span>
          </li>
        ))}
      </ul>
    </InteractiveShell>
  );
}

export function Mcq({ block }: { block: McqBlock }) {
  return (
    <InteractiveShell prompt={block.prompt} badge="选择题">
      <ul className="space-y-2">
        {block.options.map((opt, i) => {
          const correct = i === block.answerIndex;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                correct ? "bg-primary/15 ring-1 ring-primary/40" : "bg-background/70"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-medium text-foreground">
                {letter(i)}
              </span>
              <span className="text-foreground/90">{opt}</span>
              {correct && <span className="ml-auto text-sm font-medium text-primary">✓ 参考答案</span>}
            </li>
          );
        })}
      </ul>
      {block.explanation && (
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground/80">解析：</span>
          {block.explanation}
        </p>
      )}
    </InteractiveShell>
  );
}

export function TrueFalse({ block }: { block: TrueFalseBlock }) {
  const options = [
    { label: "正确", value: true },
    { label: "错误", value: false },
  ];
  return (
    <InteractiveShell prompt={block.prompt} badge="判断题">
      <div className="flex gap-3">
        {options.map((o) => {
          const correct = o.value === block.answer;
          return (
            <span
              key={o.label}
              className={`rounded-lg px-4 py-2 text-foreground/90 ${
                correct ? "bg-primary/15 font-medium ring-1 ring-primary/40" : "bg-background/70"
              }`}
            >
              {o.label}
              {correct && " ✓"}
            </span>
          );
        })}
      </div>
      {block.explanation && (
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground/80">解析：</span>
          {block.explanation}
        </p>
      )}
    </InteractiveShell>
  );
}

export function Quiz({ block }: { block: QuizBlock }) {
  return (
    <InteractiveShell
      prompt={block.prompt}
      badge={block.timeLimitSec ? `限时测验 · ${block.timeLimitSec}s` : "测验"}
    >
      <ol className="space-y-3">
        {block.questions.map((q, i) => (
          <li key={q.id} className="rounded-lg bg-background/70 p-3">
            <p className="mb-2 font-medium text-foreground">
              {i + 1}. {q.prompt}
            </p>
            <ul className="space-y-1 text-sm">
              {q.options.map((opt, oi) => (
                <li
                  key={oi}
                  className={oi === q.answerIndex ? "font-medium text-primary" : "text-foreground/80"}
                >
                  {letter(oi)}. {opt}
                  {oi === q.answerIndex && " ✓"}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </InteractiveShell>
  );
}

export function DiscussionWall({ block }: { block: DiscussionWallBlock }) {
  return (
    <InteractiveShell
      prompt={block.prompt}
      badge={block.mode === "danmu" ? "讨论墙 · 弹幕" : "讨论墙 · 列表"}
    >
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-muted/40 bg-background/50 text-sm text-muted">
        学生留言将实时显示于此（Phase 2）
      </div>
    </InteractiveShell>
  );
}

export function WordCloud({ block }: { block: WordCloudBlock }) {
  return (
    <InteractiveShell prompt={block.prompt} badge="词云">
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-muted/40 bg-background/50 text-sm text-muted">
        学生提交的关键词将聚合为词云（Phase 2）
      </div>
    </InteractiveShell>
  );
}
