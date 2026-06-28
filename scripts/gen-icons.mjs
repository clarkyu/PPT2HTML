// 生成品牌色 PWA 图标（无图像库依赖，手写 PNG 编码）。用法：node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
mkdirSync(PUBLIC, { recursive: true });

// 品牌色（与 globals.css 一致）
const GREEN = [14, 107, 79, 255];
const WHITE = [255, 255, 255, 255];
const AMBER = [234, 179, 8, 255];
const MUTED = [203, 213, 225, 255];

// ---- PNG 编码 ----
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = w * 4;
  const raw = Buffer.alloc(h * (1 + stride));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + stride)] = 0; // filter: none
    rgba.copy(raw, y * (1 + stride) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- 绘制 ----
function px(buf, w, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}
function roundRect(buf, w, x0, y0, x1, y1, r, color) {
  for (let y = Math.round(y0); y < Math.round(y1); y++) {
    for (let x = Math.round(x0); x < Math.round(x1); x++) {
      let dx = 0;
      let dy = 0;
      if (x < x0 + r && y < y0 + r) {
        dx = x0 + r - x;
        dy = y0 + r - y;
      } else if (x >= x1 - r && y < y0 + r) {
        dx = x - (x1 - r - 1);
        dy = y0 + r - y;
      } else if (x < x0 + r && y >= y1 - r) {
        dx = x0 + r - x;
        dy = y - (y1 - r - 1);
      } else if (x >= x1 - r && y >= y1 - r) {
        dx = x - (x1 - r - 1);
        dy = y - (y1 - r - 1);
      }
      if (dx * dx + dy * dy > r * r) continue;
      px(buf, w, x, y, color);
    }
  }
}

// 课件主题图标：绿底 + 居中白「幻灯片卡片」（顶部琥珀标题条 + 两行文本），mark 落在中央安全区。
function render(n) {
  const buf = Buffer.alloc(n * n * 4);
  for (let i = 0; i < n * n; i++) buf.set(GREEN, i * 4); // 满幅绿底（兼容 maskable 裁切）

  const cx0 = 0.24 * n;
  const cy0 = 0.27 * n;
  const cx1 = 0.76 * n;
  const cy1 = 0.73 * n;
  const cardR = 0.05 * n;
  roundRect(buf, n, cx0, cy0, cx1, cy1, cardR, WHITE);

  const pad = 0.05 * n;
  // 顶部琥珀标题条
  roundRect(buf, n, cx0 + pad, cy0 + pad, cx1 - pad, cy0 + pad + 0.09 * n, 0.012 * n, AMBER);
  // 两行文本
  const lineH = 0.045 * n;
  const ly = cy0 + pad + 0.16 * n;
  roundRect(buf, n, cx0 + pad, ly, cx1 - pad, ly + lineH, 0.012 * n, MUTED);
  roundRect(buf, n, cx0 + pad, ly + 0.085 * n, cx1 - pad * 3, ly + 0.085 * n + lineH, 0.012 * n, MUTED);

  return buf;
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["apple-icon-180.png", 180],
]) {
  writeFileSync(new URL(name, `file://${PUBLIC}`), encodePNG(size, size, render(size)));
  console.log("生成", name, `${size}x${size}`);
}
