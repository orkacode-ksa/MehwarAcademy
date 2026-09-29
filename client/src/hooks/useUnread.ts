import { useEffect, useState } from "react";
import { api } from "../api/client.js";

/**
 * عدّاد غير المقروء — مخزن واحد يتشاركه الرأس والشريط.
 * يُسأل الخادم عند التنقّل وعند عودة التبويب للواجهة، ولا يُسأل أكثر من مرة كل دقيقة:
 * مليون مستخدم يسألون كل ثانية = حمل بلا فائدة؛ الإشعار ليس دردشة.
 */
let count = 0;
let last = 0;
let inflight: Promise<void> | null = null;
const subs = new Set<(n: number) => void>();
const emit = () => subs.forEach((f) => f(count));

function refreshUnread(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - last < 60_000) return Promise.resolve();
  inflight = api
    .get<{ unread: number }>("/me/notifications/unread")
    .then((r) => {
      count = r.unread;
      last = Date.now();
      emit();
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearUnread(): void {
  count = 0;
  last = Date.now();
  emit();
}

export function useUnread(pathname: string): number {
  const [n, setN] = useState(count);
  useEffect(() => {
    subs.add(setN);
    return () => {
      subs.delete(setN);
    };
  }, []);
  useEffect(() => {
    void refreshUnread();
  }, [pathname]);
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && void refreshUnread();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return n;
}
