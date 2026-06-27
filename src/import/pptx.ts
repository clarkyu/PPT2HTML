/**
 * .pptx (OOXML) 解析：抽取「文本 + 图片 + 结构」。
 *
 * .pptx 即 zip + XML：presentation.xml 定幻灯片顺序，slideN.xml 存形状文本与图片引用，
 * slideN.xml.rels 把图片关系 id 映射到 ppt/media 下的资源。这里做务实抽取（非逐像素还原），
 * 对异常/复杂结构尽量降级而非抛错（见 docs/08 与 F6「改造非 1:1 复刻」）。
 */
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface ParsedImage {
  data: Uint8Array;
  contentType: string;
}

export interface ParsedSlide {
  title?: string;
  /** 每个文本形状的段落组（多段→列表，单段→正文） */
  bodies: string[][];
  images: ParsedImage[];
}

export interface ParsedPptx {
  title?: string;
  slides: ParsedSlide[];
}

const MAX_SLIDES = 100;
const MAX_IMAGES_PER_SLIDE = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
});

function arr<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/** 解析 rels 的 Target（相对于该部件所在目录），处理 ../ 与 ./。 */
function resolveTarget(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  const stack: string[] = [];
  for (const seg of (baseDir + target).split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  return stack.join("/");
}

function contentTypeFor(path: string): string | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    default:
      return null; // emf/wmf 等不被浏览器直接支持，跳过
  }
}

/** 从 txBody 抽取段落文本（每段把所有 run 的 a:t 拼接）。 */
function paragraphsFromTxBody(txBody: unknown): string[] {
  if (!txBody || typeof txBody !== "object") return [];
  const paras = arr((txBody as Record<string, unknown>)["a:p"]);
  const out: string[] = [];
  for (const p of paras) {
    if (!p || typeof p !== "object") continue;
    const runs = arr((p as Record<string, unknown>)["a:r"]);
    let text = "";
    for (const r of runs) {
      const t = r && typeof r === "object" ? (r as Record<string, unknown>)["a:t"] : undefined;
      if (typeof t === "string") text += t;
      else if (typeof t === "number") text += String(t);
    }
    const trimmed = text.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function placeholderType(sp: Record<string, unknown>): string | undefined {
  const nv = sp["p:nvSpPr"] as Record<string, unknown> | undefined;
  const nvPr = nv?.["p:nvPr"] as Record<string, unknown> | undefined;
  const ph = nvPr?.["p:ph"] as Record<string, unknown> | undefined;
  const t = ph?.["@_type"];
  return typeof t === "string" ? t : ph !== undefined ? "body" : undefined;
}

/** 递归收集节点下的所有 p:sp 与 p:pic（spTree 可能含 group）。 */
function collectShapes(node: unknown, sps: Record<string, unknown>[], pics: Record<string, unknown>[]) {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  for (const sp of arr(obj["p:sp"])) sps.push(sp as Record<string, unknown>);
  for (const pic of arr(obj["p:pic"])) pics.push(pic as Record<string, unknown>);
  for (const grp of arr(obj["p:grpSp"])) collectShapes(grp, sps, pics);
}

export async function parsePptx(data: Uint8Array | ArrayBuffer): Promise<ParsedPptx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("无法读取该文件，请确认是有效的 .pptx");
  }

  const readText = async (path: string): Promise<string | null> => {
    const f = zip.file(path);
    return f ? f.async("string") : null;
  };

  const presXml = await readText("ppt/presentation.xml");
  const presRels = await readText("ppt/_rels/presentation.xml.rels");
  if (!presXml || !presRels) throw new Error("不是有效的 PPT 演示文稿（缺少 presentation 部件）");

  // rId -> slide 路径
  const relsDoc = parser.parse(presRels);
  const relMap = new Map<string, string>();
  for (const rel of arr((relsDoc?.Relationships as Record<string, unknown>)?.["Relationship"])) {
    const r = rel as Record<string, string>;
    if (r["@_Id"] && r["@_Target"]) relMap.set(r["@_Id"], r["@_Target"]);
  }

  // 按 presentation.xml 的 sldIdLst 顺序取 slide
  const presDoc = parser.parse(presXml);
  const sldIdLst = (presDoc?.["p:presentation"] as Record<string, unknown>)?.["p:sldIdLst"] as
    | Record<string, unknown>
    | undefined;
  const slideRefs = arr(sldIdLst?.["p:sldId"]).map((s) => {
    const o = s as Record<string, string>;
    return o["@_r:id"];
  });

  const slidePaths: string[] = [];
  for (const rid of slideRefs) {
    const target = rid ? relMap.get(rid) : undefined;
    if (!target) continue;
    // presentation.xml.rels 的 Target 相对于 ppt/
    slidePaths.push(resolveTarget("ppt/", target));
  }
  // 兜底：若顺序解析失败，直接按文件名收集
  if (slidePaths.length === 0) {
    Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach((p) => slidePaths.push(p));
  }

  const slides: ParsedSlide[] = [];
  for (const path of slidePaths.slice(0, MAX_SLIDES)) {
    const xml = await readText(path);
    if (!xml) continue;
    const doc = parser.parse(xml);
    const spTree = ((doc?.["p:sld"] as Record<string, unknown>)?.["p:cSld"] as Record<string, unknown>)?.[
      "p:spTree"
    ];
    const sps: Record<string, unknown>[] = [];
    const pics: Record<string, unknown>[] = [];
    collectShapes(spTree, sps, pics);

    let title: string | undefined;
    const bodies: string[][] = [];
    for (const sp of sps) {
      const paras = paragraphsFromTxBody(sp["p:txBody"]);
      if (paras.length === 0) continue;
      const ph = placeholderType(sp);
      if (!title && (ph === "title" || ph === "ctrTitle")) {
        title = paras.join(" ");
      } else {
        bodies.push(paras);
      }
    }

    // 图片：解析该 slide 的 rels，blip r:embed -> media 路径
    const slideRels = await readText(
      path.replace(/slides\/([^/]+)$/, "slides/_rels/$1.rels"),
    );
    const slideRelMap = new Map<string, string>();
    if (slideRels) {
      const sd = parser.parse(slideRels);
      for (const rel of arr((sd?.Relationships as Record<string, unknown>)?.["Relationship"])) {
        const r = rel as Record<string, string>;
        if (r["@_Id"] && r["@_Target"]) slideRelMap.set(r["@_Id"], r["@_Target"]);
      }
    }
    const images: ParsedImage[] = [];
    for (const pic of pics.slice(0, MAX_IMAGES_PER_SLIDE)) {
      const blipFill = pic["p:blipFill"] as Record<string, unknown> | undefined;
      const blip = blipFill?.["a:blip"] as Record<string, string> | undefined;
      const embed = blip?.["@_r:embed"];
      const target = embed ? slideRelMap.get(embed) : undefined;
      if (!target) continue;
      // slideN.xml.rels 的 Target 相对于该 slide 所在目录（ppt/slides/）
      const mediaPath = resolveTarget(path.replace(/[^/]+$/, ""), target);
      const ct = contentTypeFor(mediaPath);
      if (!ct) continue;
      const file = zip.file(mediaPath);
      if (!file) continue;
      const bytes = await file.async("uint8array");
      if (bytes.byteLength > MAX_IMAGE_BYTES) continue;
      images.push({ data: bytes, contentType: ct });
    }

    slides.push({ title, bodies, images });
  }

  if (slides.length === 0) {
    throw new Error("未能从该 PPT 中解析出任何幻灯片内容");
  }

  // 文稿标题：用第一页标题
  const title = slides.find((s) => s.title)?.title;
  return { title, slides };
}
