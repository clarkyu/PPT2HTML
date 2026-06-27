/**
 * LLM Provider 抽象层
 *
 * 目标（docs/04-ai-pipeline.md）：默认国产模型、合规可控；按任务分级路由；不绑定厂商。
 * generateStructured 强制产出贴合 Zod schema 的合规对象（解析+校验+一次修复重试）。
 *
 * 每次调用同时携带：
 *  - system/user/schema：真实模型据此生成；
 *  - mock：无 Key（离线/CI）时由 MockProvider 据此确定性合成，保证全流程可跑通。
 */
import type { ZodType } from "zod";

export type ModelTier = "light" | "standard" | "heavy";

/** Mock 合成配方：key 决定合成什么，input 提供素材。真实 Provider 忽略它。 */
export interface MockRecipe {
  key: "intent" | "outline" | "section" | "validate";
  input: unknown;
}

export interface StructuredArgs<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  tier: ModelTier;
  mock: MockRecipe;
}

export interface LLMProvider {
  readonly name: string;
  generateStructured<T>(args: StructuredArgs<T>): Promise<T>;
}

/** 模型路由表：任务档位 → 具体模型名（来自环境变量）。 */
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
