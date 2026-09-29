import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../../api/client.js";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let siteKeyP: Promise<string | null> | null = null;
const siteKey = () => (siteKeyP ??= api.get<{ turnstileSiteKey: string | null }>("/public/config").then((c) => c.turnstileSiteKey).catch(() => null));

let scriptP: Promise<void> | null = null;
function loadScript(): Promise<void> {
  return (scriptP ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  }));
}

/**
 * التحقق من أن المستخدم إنسان في نماذج الدخول والتسجيل والاستعادة. لا يظهر شيء ما لم تُضبط
 * مفاتيحه في الإعدادات؛ وحين تُضبط يعمل غالبًا دون أي نقرة من المستخدم.
 * يعيد `extra` لدمجه في جسم الطلب، و`reset` بعد كل محاولة (الرمز يُستعمل مرة واحدة).
 */
export function useHumanCheck(): { widget: ReactNode; extra: { turnstileToken?: string }; reset: () => void } {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void siteKey().then((k) => alive && setKey(k));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!key || !ref.current) return;
    let alive = true;
    void loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(ref.current, {
          sitekey: key,
          language: "ar",
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (idRef.current) window.turnstile?.remove(idRef.current);
      idRef.current = null;
    };
  }, [key]);

  const reset = useCallback(() => {
    setToken(null);
    if (idRef.current) window.turnstile?.reset(idRef.current);
  }, []);

  return {
    widget: key ? <div ref={ref} className="flex justify-center my-3 min-h-[65px]" /> : null,
    extra: token ? { turnstileToken: token } : {},
    reset,
  };
}
