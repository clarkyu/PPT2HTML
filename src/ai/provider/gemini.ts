/**
 * Gemini 适配（Google Generative Language 的 OpenAI 兼容端点）。配置 GEMINI_API_KEY 即启用
 * （并设 LLM_DEFAULT_PROVIDER=gemini）。用 JSON 模式产出结构化结果，按 Zod 校验，失败重试一次。
 */
import {
  loadRoutingFromEnv,
  PROVIDER_DEFAULTS,
  type LLMProvider,
  type ModelRouting,
  type ModelTier,
  type StructuredArgs,
} from "./types";

const MAX_ATTEMPTS = 2;

export function createGeminiProvider(
  apiKey: string,
  routing: ModelRouting = loadRoutingFromEnv(),
  baseUrl: string = process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
): LLMProvider {
  // 路由表里若仍是非 gemini 模型名（如沿用了 deepseek-* 默认），按档位回落到当前在线的
  // Gemini 模型，保留分级路由，且不使用任何已停用的版本（如 gemini-1.5-*）。
  const modelFor = (tier: ModelTier) => {
    const m = routing.models[tier];
    return m.startsWith("gemini") ? m : PROVIDER_DEFAULTS.gemini[tier];
  };

  return {
    name: "gemini",
    async generateStructured<T>(args: StructuredArgs<T>): Promise<T> {
      const model = modelFor(args.tier);
      let lastError = "";

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const user =
          attempt === 0
            ? args.user
            : `${args.user}\n\n上一次输出无法通过校验，请严格只输出符合要求的 JSON。错误：${lastError}`;

        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: args.system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
          }),
        });

        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          if (attempt === MAX_ATTEMPTS - 1) throw new Error(`Gemini 请求失败：${lastError}`);
          continue;
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content ?? "";

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          lastError = "返回内容不是合法 JSON";
          if (attempt === MAX_ATTEMPTS - 1) throw new Error(`Gemini 输出解析失败：${lastError}`);
          continue;
        }

        const result = args.schema.safeParse(parsed);
        if (result.success) return result.data;
        lastError = result.error.message;
        if (attempt === MAX_ATTEMPTS - 1) throw new Error(`Gemini 输出不符合 schema：${lastError}`);
      }
      throw new Error("Gemini 生成失败");
    },
  };
}
