/**
 * 网页版课件的离线 Mock 合成：无 LLM Key（本地/CI）或单页真实生成失败时，
 * 确定性产出通过 Zod 校验的计划与场景内容，保证「一句话 → 课件」永远可跑通。
 */
import { synthIntent } from "@/ai/provider/mock";
import {
  coursePlanSchema,
  courseSlideSchema,
  normalizePlan,
  type CoursePlan,
  type CourseSlide,
} from "./schema";

/** 截断到 n 个字符（Mock 文案兜底不超 zod 上限）。 */
function cut(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n);
}

export function synthCoursePlan(sentence: string): CoursePlan {
  const intent = synthIntent(sentence);
  const t = cut(intent.topic, 12);
  const plan: CoursePlan = {
    title: t,
    eyebrow: cut(`${intent.subject} · 入门第 1 课`, 16),
    subtitle: cut(`用一堂课弄懂「${t}」的核心`, 30),
    scenes: [
      { kind: "cover", goal: `开场点题：${t}` },
      { kind: "statement", goal: `认知钩子：一个关于「${t}」的反差事实` },
      { kind: "cards", goal: `拆解「${t}」的 3 个核心要点` },
      { kind: "playground", goal: `看 AI 当场写一个与「${t}」相关的小程序` },
      { kind: "quiz", goal: `检验对「${t}」核心概念的理解` },
      { kind: "summary", goal: "回顾要点并预告下一课" },
    ],
  };
  return normalizePlan(coursePlanSchema.parse(plan));
}

export function synthCourseScene(sentence: string, plan: CoursePlan, index: number): CourseSlide {
  const scene = plan.scenes[index];
  const t = cut(plan.title, 12);
  const eyebrow = cut(plan.eyebrow, 16);

  let slide: CourseSlide;
  switch (scene.kind) {
    case "cover":
      slide = { kind: "cover", eyebrow, title: t, subtitle: cut(plan.subtitle, 30) };
      break;
    case "statement":
      slide = {
        kind: "statement",
        eyebrow: "先想一个问题",
        title: cut(`如果只用一句话解释「${t}」，你会怎么说？`, 26),
        sub: "这节课结束时，你会有一个自己的答案。",
      };
      break;
    case "cards":
      slide = {
        kind: "cards",
        eyebrow: "核心拆解",
        title: cut(`「${t}」的三个关键`, 20),
        lead: "别背定义——抓住这三点就够了。",
        cards: [
          { label: "1", title: "它是什么", desc: cut(`用一句话说清「${t}」的本质`, 36) },
          { label: "2", title: "怎么运作", desc: "关键机制与过程，由浅入深看一遍" },
          { label: "3", title: "有什么用", desc: "它解决什么问题，和你有什么关系" },
        ],
      };
      break;
    case "playground":
      slide = {
        kind: "playground",
        eyebrow: "Aha · 看 AI 动手",
        title: cut(`一句话，让 AI 写个「${t}」小程序`, 20),
        lead: "你只描述意图，代码由 AI 当场补全。",
        scripts: [
          {
            label: "知识问答",
            prompt: cut(`用 Python 写一个关于「${t}」的问答小程序，答对给鼓励。`, 80),
            filename: "quiz.py",
            language: "python",
            code: `# 关于「${t}」的迷你问答\nquestions = [\n    ("这节课的主题是什么？", "${cut(t, 10)}"),\n    ("学完后要能做什么？", "用自己的话讲出来"),\n]\n\nscore = 0\nfor q, answer in questions:\n    reply = input(q + " ")\n    if answer in reply:\n        print("✅ 答对了！")\n        score += 1\n    else:\n        print(f"提示：{answer}")\n\nprint(f"得分 {score}/{len(questions)}，继续加油！")`,
            explanation: "注意：题目、判分、鼓励语都是 AI 根据一句话补全的——这就是意图式编程。",
          },
        ],
      };
      break;
    case "quiz":
      slide = {
        kind: "quiz",
        eyebrow: "随堂小测",
        title: cut(`关于「${t}」，下列哪个说法最准确？`, 40),
        options: ["只需要死记硬背定义", cut(`理解「${cut(t, 8)}」的机制和用途`, 22), "和实际生活没有关系"],
        answer: 1,
        explain: "抓住「是什么—怎么运作—有什么用」三个关键，比背定义有效得多。",
      };
      break;
    case "summary":
      slide = {
        kind: "summary",
        eyebrow: "小结",
        title: "这一课你已经 get 到：",
        bullets: [
          cut(`「${cut(t, 10)}」的本质与机制`, 24),
          "三个关键：是什么/怎么运作/有什么用",
          "用自己的话讲一遍，才算真的懂",
        ],
        next: cut(`深入「${cut(t, 10)}」的实战应用`, 24),
      };
      break;
  }
  return courseSlideSchema.parse(slide);
}
