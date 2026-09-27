import { getEmbeddedFontFaceCss } from "../../lib/fontsDataUri.js";
import { escapeHtml as e } from "../documents/gradeSheet.template.js";

export interface Slide {
  title: string;
  bullets: string[];
}

/** عرض ١٦:٩ عربي — غلاف ثم شريحة لكل فكرة. الخطوط مضمّنة لأن المتصفّح مقطوع عن الشبكة. */
export function renderSlidesHtml(x: { title: string; course: string; teacher: string; slides: Slide[] }): string {
  const page = (inner: string, cls = "") => `<section class="s ${cls}">${inner}</section>`;
  const cover = page(
    `<div class="kicker">${e(x.course)}</div><h1>${e(x.title)}</h1><div class="by">${e(x.teacher)}</div>`,
    "cover",
  );
  const body = x.slides
    .map((s, i) =>
      page(
        `<header><h2>${e(s.title)}</h2><span class="n">${i + 1} / ${x.slides.length}</span></header>
<ul>${s.bullets.map((b) => `<li>${e(b)}</li>`).join("")}</ul>
<footer>${e(x.course)} · مِحوَر</footer>`,
      ),
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
${getEmbeddedFontFaceCss()}
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box;margin:0}
body{font-family:'IBM Plex Sans Arabic',sans-serif;color:#1A2331;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.s{width:1280px;height:720px;padding:64px 88px;position:relative;page-break-after:always;overflow:hidden;background:#F7F9FB}
.s::before{content:"";position:absolute;inset:0 0 auto 0;height:10px;background:#123B4F}
.cover{background:#123B4F;color:#fff;display:flex;flex-direction:column;justify-content:center}
.cover::before{background:#C9A24B}
.kicker{font-size:26px;opacity:.75}
h1{font-family:'Readex Pro',sans-serif;font-size:64px;line-height:1.35;margin:18px 0 26px}
.by{font-size:24px;color:#E5CE95}
header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #C9A24B;padding-bottom:18px;margin-bottom:34px}
h2{font-family:'Readex Pro',sans-serif;font-size:42px;color:#123B4F;line-height:1.4}
.n{font-size:20px;color:#6B7B8C}
ul{list-style:none;padding:0}
li{font-size:30px;line-height:1.6;margin-bottom:20px;padding-inline-start:40px;position:relative}
li::before{content:"";position:absolute;inset-inline-start:0;top:20px;width:14px;height:14px;border-radius:4px;background:#C9A24B}
footer{position:absolute;bottom:30px;inset-inline:88px;font-size:17px;color:#6B7B8C}
</style></head><body>${cover}${body}</body></html>`;
}
