/**
 * 轻量代码分词器（仅供交互演示组件 AiPlayground 的流式高亮用）。
 * 不追求语法完备：把代码切成带类型的 token，便于按字符数渐进着色地"流式"渲染。
 * 覆盖性保证：所有字符都会被某条规则吃掉，token 值拼接 === 原始代码（流式按 char 切片才正确）。
 */
export type TokType = "kw" | "str" | "com" | "num" | "fn" | "op" | "txt";
export interface Tok {
  t: TokType;
  v: string;
}

const PY_KW = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "in", "not", "and",
  "or", "import", "from", "as", "class", "try", "except", "finally", "with",
  "lambda", "pass", "break", "continue", "yield", "global", "nonlocal",
  "assert", "raise", "del", "is", "async", "await", "True", "False", "None",
]);
const JS_KW = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "import", "from", "export", "default", "class", "extends", "new", "try",
  "catch", "finally", "await", "async", "of", "in", "typeof", "instanceof",
  "true", "false", "null", "undefined", "this", "super", "yield", "switch",
  "case", "break", "continue", "do", "throw", "void",
]);
const BUILTIN = new Set([
  "print", "input", "int", "str", "float", "len", "range", "list", "dict",
  "set", "tuple", "bool", "abs", "min", "max", "sum", "sorted", "enumerate",
  "zip", "map", "filter", "open", "type", "isinstance", "random", "randint",
  "console", "log", "useState", "useEffect", "Math", "JSON", "Number",
]);

// 顺序很重要：注释/字符串先于标识符，避免被吃错。
const TOKEN_RE =
  /(\s+)|(\/\/[^\n]*|#[^\n]*)|('''[\s\S]*?'''|"""[\s\S]*?"""|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(\d[\d_]*\.?\d*)|([A-Za-z_$][\w$]*)|([^\s\w$])/g;

/** 把代码分词。lang 决定关键字表（python | js/ts）。 */
export function tokenize(code: string, lang = "python"): Tok[] {
  const kw = lang.startsWith("js") || lang === "ts" || lang === "tsx" || lang === "jsx" ? JS_KW : PY_KW;
  const out: Tok[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    const [whole, ws, com, str, num, ident, op] = m;
    if (ws !== undefined) out.push({ t: "txt", v: whole });
    else if (com !== undefined) out.push({ t: "com", v: whole });
    else if (str !== undefined) out.push({ t: "str", v: whole });
    else if (num !== undefined) out.push({ t: "num", v: whole });
    else if (ident !== undefined) {
      // 标识符后紧跟 "(" 视为函数调用着色。
      const next = code[TOKEN_RE.lastIndex];
      const t: TokType = kw.has(ident)
        ? "kw"
        : BUILTIN.has(ident) || next === "("
          ? "fn"
          : "txt";
      out.push({ t, v: whole });
    } else out.push({ t: "op", v: op ?? whole });
  }
  return out;
}

/** 取前 visible 个字符对应的 token 切片（最后一个 token 可能被截断），用于流式渲染。 */
export function sliceTokens(tokens: Tok[], visible: number): Tok[] {
  if (visible <= 0) return [];
  const out: Tok[] = [];
  let used = 0;
  for (const tk of tokens) {
    if (used >= visible) break;
    const take = Math.min(tk.v.length, visible - used);
    out.push({ t: tk.t, v: tk.v.slice(0, take) });
    used += take;
    if (take < tk.v.length) break;
  }
  return out;
}
