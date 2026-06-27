/**
 * Provider 选择：有 Key 用真实模型，无 Key 回落到离线 Mock（保证全流程始终可用）。
 */
import { createDeepSeekProvider } from "./deepseek";
import { createGeminiProvider } from "./gemini";
import { mockProvider } from "./mock";
import { loadRoutingFromEnv, type LLMProvider } from "./types";

export function getProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const routing = loadRoutingFromEnv(env);
  if (routing.provider === "deepseek" && env.DEEPSEEK_API_KEY) {
    return createDeepSeekProvider(env.DEEPSEEK_API_KEY, routing);
  }
  if (routing.provider === "gemini" && env.GEMINI_API_KEY) {
    return createGeminiProvider(env.GEMINI_API_KEY, routing);
  }
  // 其他厂商（通义/GLM/Claude/OpenAI）可在此按 routing.provider 扩展。
  return mockProvider; // 无可用 Key → 离线 Mock，保证全流程可用
}

/** 当前是否处于离线 Mock 模式（前端可据此提示「示例生成」）。 */
export function isMockMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return getProvider(env).name === "mock";
}

export { mockProvider };
export * from "./types";
