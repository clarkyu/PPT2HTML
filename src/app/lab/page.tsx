import AiPlayground, { type PlaygroundScript } from "@/components/interactive/AiPlayground";

export const metadata = {
  title: "言课 · 交互组件预览",
};

// 「AI 编程 · 第 1 课」的 Aha 组件示例脚本（脚本化演示；未来由生成器产出）。
const SCRIPTS: PlaygroundScript[] = [
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
    explanation:
      "几行就跑通了：random 出题、while 循环反复比较、给出大小提示直到猜中——你只描述了规则，逻辑由 Claude 补全。",
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
    explanation:
      "useState 存状态，点击按钮即更新——一句话就得到一个可交互组件，这就是用 Claude 编程的感觉。",
  },
];

export default function LabPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "28px",
        padding: "48px 20px",
        background:
          "radial-gradient(110% 90% at 50% -10%, #efe7ff 0%, #f7f5ff 40%, #f2f4f9 100%)",
      }}
    >
      <header style={{ textAlign: "center", maxWidth: 640 }}>
        <p
          style={{
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#9a8fbf",
            margin: 0,
          }}
        >
          言课 · 交互组件预览
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 8px", color: "#1b1633" }}>
          AI 编程 · 第 1 课的「Aha」
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#5b5478", margin: 0 }}>
          一句话 → Claude 当场把代码<strong>流式</strong>写出来。这是嵌进课件里、可玩的教学瞬间。
        </p>
      </header>

      <div style={{ width: "100%", maxWidth: 720 }}>
        <AiPlayground scripts={SCRIPTS} />
      </div>
    </main>
  );
}
