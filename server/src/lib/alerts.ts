import { prismaBase } from "./prisma.js";
import { logger } from "./logger.js";
import { getEmailProvider } from "../adapters/email.provider.js";
import { notifyOwners } from "../modules/notifications/notify.js";

/**
 * تنبيه المالك بأخطاء الخادم لحظة وقوعها — بريد + إشعار داخل المنصة، بلا خدمة خارجية.
 * كل خطأ مميَّز (اسمه + أول سطر من رسالته + أول إطار من مكدسه) يُبلَّغ مرة في الساعة،
 * وسقف عام ٢٠ رسالة في الساعة: عطل واسع لا يُغرق بريدك بآلاف الرسائل.
 * لا يحمل بيانات مستخدمين — المسار والطريقة ورقم الطلب فقط، وبه تجد التفاصيل في السجل.
 */
const seen = new Map<string, number>();
let windowStart = Date.now();
let sentInWindow = 0;
const HOUR = 3_600_000;

function signature(err: unknown): { key: string; title: string; frame: string } {
  const e = err instanceof Error ? err : new Error(String(err));
  const first = (e.message || e.name).split("\n")[0]?.slice(0, 160) ?? e.name;
  const frame = (e.stack ?? "").split("\n").find((l) => l.includes("/src/") || l.includes("/dist/"))?.trim().slice(0, 200) ?? "";
  return { key: `${e.name}|${first}|${frame}`, title: `${e.name}: ${first}`, frame };
}

export function alertServerError(err: unknown, ctx: { requestId?: string; method?: string; path?: string; where?: string }): void {
  if (process.env.NODE_ENV === "test") return;
  const now = Date.now();
  if (now - windowStart > HOUR) {
    windowStart = now;
    sentInWindow = 0;
  }
  const { key, title, frame } = signature(err);
  const last = seen.get(key);
  if ((last && now - last < HOUR) || sentInWindow >= 20) return;
  seen.set(key, now);
  sentInWindow++;
  if (seen.size > 500) seen.clear();
  void send(title, frame, ctx).catch((e: unknown) => logger.warn({ err: e }, "تعذّر إرسال تنبيه الخطأ"));
}

async function send(title: string, frame: string, ctx: { requestId?: string; method?: string; path?: string; where?: string }) {
  const where = ctx.where ?? `${ctx.method ?? ""} ${ctx.path ?? ""}`.trim();
  await notifyOwners({ kind: "SERVER_ERROR", title: "خطأ في الخادم", body: `${title} — ${where}`.slice(0, 480) });
  const owners = await prismaBase.user.findMany({ where: { role: "OWNER", deletedAt: null, suspendedAt: null }, select: { email: true } });
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.8">
<p><b>خطأ غير متوقع في خادم مِحوَر</b></p>
<p>${esc(title)}</p>
<p>المكان: <code dir="ltr">${esc(where)}</code><br>رقم الطلب: <code dir="ltr">${esc(ctx.requestId ?? "—")}</code><br>الموضع: <code dir="ltr">${esc(frame || "—")}</code></p>
<p style="color:#647268">لن يصلك تنبيه عن الخطأ نفسه قبل ساعة. التفاصيل الكاملة في سجلات Railway برقم الطلب.</p></div>`;
  for (const o of owners) await getEmailProvider().send({ to: o.email, subject: `⚠️ خطأ في مِحوَر: ${title.slice(0, 80)}`, html });
}
