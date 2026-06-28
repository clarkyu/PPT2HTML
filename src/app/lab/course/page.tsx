import CoursePlayer, { type Slide } from "@/components/course/CoursePlayer";
import type { PlaygroundScript } from "@/components/interactive/AiPlayground";

export const metadata = { title: "AI 编程 · 从 Claude 开始 — 言课" };

const PG_SCRIPTS: PlaygroundScript[] = [
  {
    label: "Python 猜数字",
    prompt: "用 Python 写一个猜数字小游戏：随机 1–100，根据猜测提示大了还是小了，直到猜中。",
    filename: "guess.py",
    language: "python",
    code: `import random

def guess_number():
    secret = random.randint(1, 100)
    tries = 0
    print("我想好了一个 1–100 的数字，来猜猜看！")
    while True:
        guess = int(input("你的猜测："))
        tries += 1
        if guess < secret:
            print("太小了，往大里猜 ⬆️")
        elif guess > secret:
            print("太大了，往小里猜 ⬇️")
        else:
            print(f"🎉 猜对了！你用了 {tries} 次。")
            break

guess_number()`,
    explanation: "几行就跑通了：random 出题、while 循环反复比较、给出大小提示直到猜中——你只描述规则，逻辑由 Claude 补全。",
  },
  {
    label: "React 计数器",
    prompt: "用 React 写一个计数器组件，有 +1 和重置按钮，显示当前计数。",
    filename: "Counter.jsx",
    language: "jsx",
    code: `import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="counter">
      <h1>计数：{count}</h1>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}`,
    explanation: "useState 存状态，点击按钮即更新——一句话就得到一个可交互组件，这就是用 Claude 编程的感觉。",
  },
];

const LESSON: Slide[] = [
  {
    kind: "cover",
    eyebrow: "言课 · AI 编程入门",
    title: "AI 编程",
    subtitle: "从 Claude 开始 —— 用一句话，让 AI 帮你写代码",
  },
  {
    kind: "cards",
    eyebrow: "什么是 Claude",
    title: "Anthropic 的 AI 模型家族",
    lead: "按能力 / 速度 / 成本分档，挑合适的那一档就好。",
    cards: [
      { label: "Opus", title: "最强推理", desc: "复杂逻辑、长任务、最难的编程都交给它。" },
      { label: "Sonnet", title: "均衡之选", desc: "速度与智能兼顾，日常开发的首选。" },
      { label: "Haiku", title: "快而省", desc: "轻量任务，低延迟、低成本。" },
    ],
  },
  {
    kind: "cards",
    eyebrow: "用 Claude 编程的几种方式",
    title: "在哪都能用它写代码",
    cards: [
      { label: "💬", title: "claude.ai", desc: "打开网页就能对话、贴代码、问问题。" },
      { label: "⌨️", title: "Claude Code", desc: "终端 / IDE 里的智能体，直接读写、改你的项目。" },
      { label: "🔌", title: "API / SDK", desc: "把 Claude 接进你自己的应用里。" },
      { label: "🧩", title: "编辑器插件", desc: "VS Code / JetBrains 内置 AI 助手。" },
    ],
  },
  {
    kind: "playground",
    eyebrow: "Aha · 看它当场写代码",
    title: "一句话 → Claude 流式生成",
    lead: "你只说想要什么，代码就一行行长出来。试试切换示例、重新演示。",
    scripts: PG_SCRIPTS,
  },
  {
    kind: "quiz",
    eyebrow: "随堂小测",
    title: "想在终端里让 AI 直接改你的项目代码，用哪个？",
    options: ["claude.ai 网页对话", "Claude Code", "只能自己手写"],
    answer: 1,
    explain:
      "Claude Code 是终端 / IDE 里的智能体：能读写文件、跑命令、直接改项目——这是「AI 编程」最顺手的入口。",
  },
  {
    kind: "summary",
    eyebrow: "小结",
    title: "这一课你已经 get 到：",
    bullets: [
      "Claude 是按档位（Opus / Sonnet / Haiku）分的 AI 模型家族",
      "用 claude.ai、Claude Code、API 都能编程，各有场景",
      "核心心法：用自然语言描述意图，让 AI 补全实现",
    ],
    next: "写出好提示词 —— 让 Claude 更懂你",
  },
];

export default function CourseLessonPage() {
  return <CoursePlayer slides={LESSON} />;
}
