import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installArabicZodErrorMap } from "@mihwar/shared";
import { App } from "./App.js";
import { UpdatePrompt } from "./components/shell/UpdatePrompt.js";
import { ToastProvider } from "./state/ToastContext.js";
import "./styles/global.css";

installArabicZodErrorMap();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("عنصر الجذر #root غير موجود");

createRoot(rootEl).render(
  <StrictMode>
    <ToastProvider>
      <App />
      <UpdatePrompt />
    </ToastProvider>
  </StrictMode>,
);
