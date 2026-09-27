/** @type {import('tailwindcss').Config}
 * الألوان والمقاسات كلها مربوطة بمتغيرات CSS في styles/tokens.css — مصدر حقيقة واحد،
 * منسوخ حرفيًا من mihwar-prototype-v2.html. لا قيمة هنا مقرَّبة أو مستبدلة بأقرب لون Tailwind.
 *
 * تُكتب الألوان بصيغة rgb(var(--x-rgb) / <alpha-value>) لا var(--x) مباشرة، لأن الصيغة
 * الثانية تُبطل معدِّل الشفافية (bg-deep/5) فيخرج لون غير صالح ⇒ خلفية شفافة تمامًا.
 */
const c = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: c("canvas"),
        surface: c("surface"),
        // الزجاج شفافية أصلًا فيبقى كما هو حرفيًا
        glass: { DEFAULT: "var(--glass)", br: "var(--glass-br)" },
        deep: c("deep"),
        deep2: c("deep2"),
        deep3: c("deep3"),
        teal: c("teal"),
        gold: c("gold"),
        gold2: c("gold2"),
        gold3: c("gold3"),
        amber: c("amber"),
        crim: c("crim"),
        // ink-3 نصّي يجتاز AA؛ ink-3d القيمة الأصلية للاستخدام الزخرفي فقط
        ink: { DEFAULT: c("ink"), 2: c("ink2"), 3: c("ink3-text"), "3d": c("ink3") },
        goldText: c("gold-text"),
        "gold-text": c("gold-text"),
        "teal-text": c("teal-text"),
        "crim-text": c("crim-text"),
        "on-gold": c("on-gold"),
        paper: c("paper"),
        line: { DEFAULT: c("line"), 2: c("line2"), strong: c("line-strong") },
        mint: c("mint"),
        lav: c("lav"),
        peach: c("peach"),
        sky: c("sky"),
      },
      fontFamily: {
        amiri: ["Amiri", "serif"],
        body: ["IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        rlg: "var(--rlg)",
        rmd: "var(--rmd)",
        rsm: "var(--rsm)",
      },
      boxShadow: {
        s1: "var(--s1)",
        s2: "var(--s2)",
        s3: "var(--s3)",
      },
      spacing: {
        rail: "var(--rail)",
      },
    },
  },
  plugins: [],
};
