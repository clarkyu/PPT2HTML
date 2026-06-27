# 04 · AI 多 Agent 生成流水线

> PRD 第八章：「多 Agent 流水线：意图解析 → 教学设计 → 内容生成 → 版式设计 → 校验。
> 按任务分级路由模型。」本文给出流水线设计与 LLM 抽象层接口。

## 流水线总览

```
一句话 / 导入的 PPT
        │
        ▼
① 意图解析 Agent   ──► IntentCard（学科/学段/主题/时长 + 补全标记）   [轻模型·秒级]
        │  用户纠偏
        ▼
② 教学设计 Agent   ──► Outline（节次 + 每节要点 + 教学法角色）         [中模型·秒级]
        │  用户确认/调序
        ▼
③ 内容生成 Agent   ──► 各节 Block[]（学科准确、学段适配、逻辑承接）   [重模型·流式]
        │
        ▼
④ 版式设计 Agent   ──► 为每页选 layout / pedagogyRole / 配图位         [中模型]
        │
        ▼
⑤ 校验 Agent      ──► 事实/逻辑/学段/价值观自检 + 修复建议            [中模型]
        │
        ▼
   完整 Deck（校验通过）
```

每个 Agent 的输出都用 **Zod schema 约束并校验**；不合规则触发一次修复重试。

## 各 Agent 职责

| Agent | 输入 | 输出 | 模型档位 | 关键约束 |
| --- | --- | --- | --- | --- |
| 意图解析 | 用户一句话 | `IntentCard` | 轻 | 抽取已知要素 + 显式标注「我替你补的」缺省项 (F2) |
| 教学设计 | 确认后的 IntentCard | `Outline` | 中 | 遵循教学法结构；秒级；节数/页数适配时长 (F3) |
| 内容生成 | 确认后的 Outline | 各节 `Block[]` | 重 | 学科准确、深浅适配学段、页间逻辑承接；流式逐节返回 (F4) |
| 版式设计 | 内容块 + 模板 | 每页 `layout`/配图位 | 中 | 在所选模板约束下布局，不改内容 |
| 校验 | 完整 Deck | 问题清单 + 修复 | 中 | 事实/逻辑/学段/价值观/版权自检 (内容安全) |

## 精修通路（F8，独立于初次生成）

```
用户指令「把这一页换成案例」 / 直接编辑
        │
        ▼
[精修 Agent] ──► 定位受影响的块 ──► 仅重写这些块 ──► 校验 ──► 合并回 Deck
```

要点：**块级局部修改**，不重跑整条流水线，保证「局部、即时、低成本」。

## PPT 导入的 AI 介入（F6）

- **基础迁移（MVP）**：纯解析 + 映射 + 套模板，**不必过 LLM**（确定性、快、省）。
- **深度改造（进阶）**：把迁移得到的 Deck 交给「内容生成/版式/校验」Agent 做重组、补全、配图优化、建议互动。

## LLM Provider 抽象层

目标：默认国产模型、合规可控；按任务分级路由；不绑定厂商。接口（落地于 `src/ai/provider/`）：

```ts
interface LLMProvider {
  name: string;
  // 结构化生成：传入 Zod/JSON Schema，强制产出合规 JSON
  generateStructured<T>(args: {
    system: string;
    prompt: string;
    schema: JSONSchema;            // 由 Zod 转换
    tier: ModelTier;               // 路由依据
    stream?: boolean;
  }): Promise<T> | AsyncIterable<Partial<T>>;

  generateText(args: {
    system: string; prompt: string; tier: ModelTier; stream?: boolean;
  }): Promise<string> | AsyncIterable<string>;
}

type ModelTier = 'light' | 'standard' | 'heavy';

// 路由表（示例，配置化）：
// light    → 意图解析、大纲           → 快而省的模型
// standard → 版式、校验、精修         → 中档模型
// heavy    → 全文内容生成             → 最强模型
```

**默认实现**：国产模型适配（DeepSeek / 通义千问 / 智谱 GLM）。
**可切换实现**：Claude / OpenAI 适配，用于早期质量对比与兜底。
路由表与各档位具体模型在 `.env` / 配置中声明，便于按成本与质量调参。

## Prompt 组织

- 每个 Agent 一个 system prompt 模板 + few-shot（放 `src/ai/prompts/`）。
- 学段、学科作为变量注入，控制深浅与术语。
- 教学法结构（导入—讲解—举例—互动—小结）写入教学设计/内容生成的系统提示。
- 所有产出强制 JSON，并附「准确性自检」指令。

## 性能与成本

| 环节 | 目标 | 手段 |
| --- | --- | --- |
| 意图卡片 | 秒级 | 轻模型 + 短输出 |
| 大纲 | 秒级 | 轻模型；这是意图对齐的最高杠杆点，必须快 |
| 全文 | 1–2 分钟，渐进式 | 重模型 + 流式逐节返回，前端边收边渲染 |
| 精修 | 近实时 | 仅重写受影响块 |

## 内容安全与兜底（非功能性需求）

三层防护：**校验 Agent 自检** → **关键场景人审兜底** → **前端准确性提示/免责**。
学科硬伤、教材版本差异、配图版权为高压线，校验 Agent 须专门检查并标注存疑项。
