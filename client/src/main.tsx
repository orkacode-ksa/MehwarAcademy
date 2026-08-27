import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ToastProvider } from "./state/ToastContext.js";
import "./styles/global.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("عنصر الجذر #root غير موجود");

createRoot(rootEl).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
