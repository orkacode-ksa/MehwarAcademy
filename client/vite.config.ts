import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      // التسجيل يدوي عبر virtual:pwa-register في UpdatePrompt.tsx — لازم لعرض
      // إشعار "نسخة جديدة متاحة" بدل ترك نسخة قديمة تُخدَّم صامتة إلى الأبد
      // (نمط "prompt" بلا هذا الربط اليدوي لا يُفعِّل أي تحديث مطلقًا).
      injectRegister: false,
      workbox: {
        // لا يُكاش أي شيء تحت /api — البيانات دائمًا حيّة (الدستور الأمني §7)
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
      },
      manifest: {
        name: "مِحوَر — منصة الأستاذ الأكاديمية",
        short_name: "مِحوَر",
        description: "منصة ذكية لإدارة المقررات وتوليد المحتوى الأكاديمي",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        display: "standalone",
        background_color: "#F3F5F3",
        theme_color: "#0F4739",
        icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
});
