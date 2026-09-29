import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  /** إجراء جسيم: لا يُفعَّل زر التأكيد حتى تُكتب هذه الكلمة */
  requireText?: string;
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
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!req) return;
    setTyped("");
    if (!req.requireText) confirmRef.current?.focus();
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
        {req.requireText && (
          <label className="block mt-3 text-[12.5px] text-ink-2">
            اكتب «{req.requireText}» للتأكيد
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1.5 w-full border border-line rounded-[10px] px-3 py-2.5 bg-surface text-[14px]"
            />
          </label>
        )}
        <div className="flex gap-2 mt-5">
          <Button
            ref={confirmRef}
            variant={req.danger ? "danger" : "primary"}
            className="flex-1"
            disabled={!!req.requireText && typed.trim() !== req.requireText}
            onClick={() => close(true)}
          >
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
