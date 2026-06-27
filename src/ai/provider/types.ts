/**
 * LLM Provider 抽象层（骨架）
 *
 * 目标（见 docs/04-ai-pipeline.md）：
 *  - 默认国产模型、合规可控；按任务分级路由；不绑定厂商。
 *  - generateStructured 强制产出贴合课件 Schema 的合规 JSON。
 *
 * 具体 Provider 实现（DeepSeek / 通义 / GLM / Claude / OpenAI）落地于同目录。
 */

export type ModelTier = "light" | "standard" | "heavy";

export interface StructuredArgs {
  system: string;
  prompt: string;
  /** 由 Zod schema 转换得到的 JSON Schema，约束模型产出 */
  jsonSchema: unknown;
  tier: ModelTier;
}

export interface TextArgs {
  system: string;
  prompt: string;
  tier: ModelTier;
}

export interface LLMProvider {
  readonly name: string;
  generateStructured<T>(args: StructuredArgs): Promise<T>;
  generateText(args: TextArgs): Promise<string>;
  /** 流式：内容生成按节增量返回，前端边收边渲染 */
  streamText?(args: TextArgs): AsyncIterable<string>;
}

/**
 * 模型路由表：把任务档位映射到具体模型名（来自环境变量）。
 * light    → 意图解析、大纲（秒级，快而省）
 * standard → 版式、校验、精修
 * heavy    → 全文内容生成（最强模型）
 */
export interface ModelRouting {
  provider: string;
  models: Record<ModelTier, string>;
}

export function loadRoutingFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelRouting {
  return {
    provider: env.LLM_DEFAULT_PROVIDER ?? "deepseek",
    models: {
      light: env.LLM_MODEL_LIGHT ?? "deepseek-chat",
      standard: env.LLM_MODEL_STANDARD ?? "deepseek-chat",
      heavy: env.LLM_MODEL_HEAVY ?? "deepseek-reasoner",
    },
  };
}
