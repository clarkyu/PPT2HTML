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
  // 配了 Key 却因 LLM_DEFAULT_PROVIDER 不匹配而回落到 Mock：明确告警，避免静默走示例生成。
  if (env.DEEPSEEK_API_KEY || env.GEMINI_API_KEY) {
    console.warn(
      `[llm] 检测到 API Key，但 LLM_DEFAULT_PROVIDER="${routing.provider}" 未匹配到可用 Key，已回落到离线 Mock。` +
        `如需真实生成，请将 LLM_DEFAULT_PROVIDER 设为 deepseek 或 gemini，并配置对应 Key。`,
    );
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
