import { useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "./Button.js";

/**
 * نافذة تأكيد واحدة للمنصة كلها بدل `window.confirm` (نافذة المتصفح الرمادية لا تتبع
 * التصميم ولا النمط الداكن). تُستدعى كوعد: `if (await confirmDialog({...})) …`.
 */
interface Request {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** إجراء لا يُتراجع عنه أو يُنهي شيئًا: زرّ التأكيد أحمر */
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(req: Omit<Request, "resolve">): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { ...req, resolve };
    emit();
  });
}

function close(ok: boolean) {
  const r = current;
  current = null;
  emit();
  r?.resolve(ok);
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[400] grid place-items-center p-4" role="presentation">
      <button type="button" aria-label="إلغاء" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fadeIn_.18s_ease-out]" onClick={() => close(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-[380px] rounded-[22px] bg-surface border border-line shadow-2xl p-5 animate-[popIn_.22s_cubic-bezier(.2,1.2,.4,1)]"
      >
        <h2 id="confirm-title" className="text-[17px] font-semibold">
          {req.title}
        </h2>
        {req.body && <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">{req.body}</p>}
        <div className="flex gap-2 mt-5">
          <Button ref={confirmRef} variant={req.danger ? "danger" : "primary"} className="flex-1" onClick={() => close(true)}>
            {req.confirmLabel ?? "تأكيد"}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
            {req.cancelLabel ?? "إلغاء"}
          </Button>
        </div>
      </div>
    </div>
  );
}
