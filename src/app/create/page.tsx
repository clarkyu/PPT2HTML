import { isMockMode } from "@/ai/provider";
import { CreateWizard } from "@/components/create/CreateWizard";

// 依赖运行时环境（是否配置 Key），强制动态渲染。
export const dynamic = "force-dynamic";

export default function CreatePage() {
  return <CreateWizard mock={isMockMode()} />;
}
