import { describe, expect, it } from "vitest";
import { buildThemeVars, hexToTriplet } from "../theme";
import { getTemplate } from "../registry";

describe("主题引擎", () => {
  it("hexToTriplet 解析 6 位与 3 位，异常回退 0 0 0", () => {
    expect(hexToTriplet("#0E6B4F")).toBe("14 107 79");
    expect(hexToTriplet("#fff")).toBe("255 255 255");
    expect(hexToTriplet("zzz")).toBe("0 0 0");
  });

  it("buildThemeVars 注入颜色三元组、字号缩放与基准 fontSize", () => {
    const vars = buildThemeVars(getTemplate("tpl-classic-blue"));
    expect(vars["--color-primary"]).toBe(hexToTriplet("#2563EB"));
    expect(vars["--font-scale"]).toBe(1);
    // 字号随 --slide-base × --font-scale 缩放（M3 字号自定义落地点）
    expect(String(vars.fontSize)).toContain("var(--slide-base");
    expect(String(vars.fontSize)).toContain("var(--font-scale");
  });

  it("theme 覆盖优先于模板默认（换模板/自定义而内容不变）", () => {
    const vars = buildThemeVars(getTemplate("tpl-classic-blue"), {
      colors: { primary: "#FF0000" },
      fontScale: 1.25,
    });
    expect(vars["--color-primary"]).toBe("255 0 0");
    expect(vars["--font-scale"]).toBe(1.25);
  });
});
