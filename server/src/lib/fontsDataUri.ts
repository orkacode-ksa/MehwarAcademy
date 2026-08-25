import fs from "node:fs";
import path from "node:path";

const FONTS_DIR = path.resolve(process.cwd(), "assets/fonts");

const FONT_FILES: { family: string; weight: number; file: string; unicodeRange?: string }[] = [
  { family: "IBM Plex Sans Arabic", weight: 400, file: "IBMPlexSansArabic-Regular.woff2" },
  { family: "IBM Plex Sans Arabic", weight: 500, file: "IBMPlexSansArabic-Medium.woff2" },
  { family: "IBM Plex Sans Arabic", weight: 600, file: "IBMPlexSansArabic-SemiBold.woff2" },
  { family: "IBM Plex Sans Arabic", weight: 700, file: "IBMPlexSansArabic-Bold.woff2" },
  { family: "Readex Pro", weight: 600, file: "ReadexPro-SemiBold.woff2" },
  { family: "Readex Pro", weight: 700, file: "ReadexPro-Bold.woff2" },
  { family: "IBM Plex Mono", weight: 400, file: "IBMPlexMono-Regular.woff2" },
  { family: "IBM Plex Mono", weight: 500, file: "IBMPlexMono-Medium.woff2" },
];

let cachedCss: string | null = null;

/** يبني @font-face بصيغة data: URI — لا اعتماد على الشبكة داخل مولّد PDF المقطوع عنها */
export function getEmbeddedFontFaceCss(): string {
  if (cachedCss) return cachedCss;

  const rules = FONT_FILES.map(({ family, weight, file }) => {
    const filePath = path.join(FONTS_DIR, file);
    const base64 = fs.readFileSync(filePath).toString("base64");
    return `@font-face {
      font-family: '${family}';
      font-style: normal;
      font-weight: ${weight};
      src: url(data:font/woff2;base64,${base64}) format('woff2');
    }`;
  });

  cachedCss = rules.join("\n");
  return cachedCss;
}
