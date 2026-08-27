/** @type {import('tailwindcss').Config}
 * الألوان والمقاسات كلها مربوطة بمتغيرات CSS في styles/tokens.css — مصدر حقيقة واحد،
 * منسوخ حرفيًا من mihwar-prototype-v2.html. لا قيمة هنا مقرَّبة أو مستبدلة بأقرب لون Tailwind.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        glass: { DEFAULT: "var(--glass)", br: "var(--glass-br)" },
        deep: "var(--deep)",
        deep2: "var(--deep2)",
        deep3: "var(--deep3)",
        teal: "var(--teal)",
        gold: "var(--gold)",
        gold2: "var(--gold2)",
        gold3: "var(--gold3)",
        amber: "var(--amber)",
        crim: "var(--crim)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink2)", 3: "var(--ink3)" },
        line: { DEFAULT: "var(--line)", 2: "var(--line2)" },
        mint: "var(--mint)",
        lav: "var(--lav)",
        peach: "var(--peach)",
        sky: "var(--sky)",
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
