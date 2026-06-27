/** 模板注册表：按 id 查模板；为换模板/模板市场（Phase 3）预留单点入口。 */
import type { Template } from "@/schema/types";
import { templates, DEFAULT_TEMPLATE_ID } from "./templates";

const byId = new Map<string, Template>(templates.map((t) => [t.id, t]));

export function getTemplate(id: string | undefined): Template {
  if (id && byId.has(id)) return byId.get(id)!;
  return byId.get(DEFAULT_TEMPLATE_ID)!;
}

export function listTemplates(): Template[] {
  return templates;
}

export { DEFAULT_TEMPLATE_ID };
