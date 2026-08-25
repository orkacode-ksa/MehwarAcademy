/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        bg: "#F6F8FB",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#1A2331", muted: "#5A6B7D" },
        brand: "#123B4F",
        progress: "#2DB3A3",
        warn: "#E8A33D",
        danger: "#D2544B",
        tint: {
          mint: "#DFF3EE",
          lavender: "#E8E6FB",
          peach: "#FDEDE4",
          sky: "#E3F0FA",
        },
      },
      fontFamily: {
        display: ["Readex Pro", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "24px",
        md: "16px",
        sm: "8px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(18,59,79,.06)",
        lifted: "0 8px 24px rgba(18,59,79,.08)",
      },
      spacing: {
        4.5: "18px",
      },
    },
  },
  plugins: [],
};
