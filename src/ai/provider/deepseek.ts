/**
 * DeepSeek 适配（OpenAI 兼容 /chat/completions）。配置 DEEPSEEK_API_KEY 即启用。
 * 用 JSON 模式产出结构化结果，按 Zod schema 校验，失败重试一次（附带错误反馈）。
 * 其他国产/海外模型可仿此扩展（见 docs/04-ai-pipeline.md 的模型路由）。
 */
import { loadRoutingFromEnv, type LLMProvider, type ModelRouting, type StructuredArgs } from "./types";

const MAX_ATTEMPTS = 2;

export function createDeepSeekProvider(
  apiKey: string,
  routing: ModelRouting = loadRoutingFromEnv(),
  baseUrl: string = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/chat/completions",
): LLMProvider {
  return {
    name: "deepseek",
    async generateStructured<T>(args: StructuredArgs<T>): Promise<T> {
      const model = routing.models[args.tier];
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
          if (attempt === MAX_ATTEMPTS - 1) throw new Error(`DeepSeek 请求失败：${lastError}`);
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
          if (attempt === MAX_ATTEMPTS - 1) throw new Error(`DeepSeek 输出解析失败：${lastError}`);
          continue;
        }

        const result = args.schema.safeParse(parsed);
        if (result.success) return result.data;
        lastError = result.error.message;
        if (attempt === MAX_ATTEMPTS - 1) {
          throw new Error(`DeepSeek 输出不符合 schema：${lastError}`);
        }
      }
      // 不可达
      throw new Error("DeepSeek 生成失败");
    },
  };
}
