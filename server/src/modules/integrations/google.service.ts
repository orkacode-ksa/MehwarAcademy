import crypto from "node:crypto";
import { prismaBase } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/AppError.js";
import { decryptSecret, encryptSecret, timingSafeEqualStr } from "../../lib/crypto.js";
import { recordAudit } from "../../lib/auditLog.js";

/**
 * ربط حساب Google للأستاذ.
 *
 * الأستاذ يضغط «اربط Google» مرة واحدة ويوافق، فيُحفظ رمز التحديث **مشفّرًا** (AES-256-GCM).
 * بعدها تُنفَّذ الأتمتة على حسابه (NotebookLM Enterprise · Drive) دون أن يغادر المنصة. الرمز
 * لا يُرجَع لأي واجهة أبدًا؛ يُستعمل في الخادم لتوليد رمز وصول قصير يُمرَّر لـn8n مع المهمة.
 */

const redirectUri = () => `${env.API_ORIGIN}/api/integrations/google/callback`;
export const googleConfigured = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** حالة OAuth موقّعة (userId + انتهاء) — تمنع ربط حساب Google بمستخدم آخر عبر رابط مزوّر. */
function signState(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + 10 * 60_000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyState(state: string): string {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) throw AppError.badRequest("حالة ربط غير صالحة");
  const expected = crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update(payload).digest("base64url");
  if (!timingSafeEqualStr(sig, expected)) throw AppError.badRequest("حالة ربط غير صالحة");
  const { u, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; e: number };
  if (Date.now() > e) throw AppError.badRequest("انتهت مهلة الربط — أعد المحاولة");
  return u;
}

export function authorizationUrl(userId: string): string {
  if (!googleConfigured()) throw AppError.badRequest("ربط Google غير مفعّل بعد في المنصة");
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: env.GOOGLE_SCOPES,
    access_type: "offline",
    // prompt=consent يضمن رمز تحديث حتى لو سبق الربط — وإلا لا يُعاد الرمز في المرة الثانية.
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; id_token?: string; scope?: string; error?: string };
  if (!res.ok || !json.access_token) throw AppError.badRequest(`رفضت Google الربط${json.error ? ` (${json.error})` : ""}`);
  return json;
}

export async function handleCallback(code: string, state: string): Promise<void> {
  const userId = verifyState(state);
  const tokens = await tokenRequest({
    code,
    client_id: env.GOOGLE_CLIENT_ID as string,
    client_secret: env.GOOGLE_CLIENT_SECRET as string,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  if (!tokens.refresh_token) throw AppError.badRequest("لم تمنح Google صلاحية دائمة — أعد الربط ووافق على كل الصلاحيات");
  const info = (await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json()) as { email?: string };
  await prismaBase.googleConnection.upsert({
    where: { userId },
    create: { userId, email: info.email ?? "", scopes: tokens.scope ?? "", refreshTokenEnc: encryptSecret(tokens.refresh_token) },
    update: { email: info.email ?? "", scopes: tokens.scope ?? "", refreshTokenEnc: encryptSecret(tokens.refresh_token), connectedAt: new Date() },
  });
  await recordAudit({ userId, action: "GOOGLE_CONNECTED", entityType: "GoogleConnection", entityId: userId });
}

export async function connectionOf(userId: string) {
  const c = await prismaBase.googleConnection.findUnique({ where: { userId }, select: { email: true, connectedAt: true, scopes: true } });
  return c;
}

export async function disconnect(userId: string) {
  const c = await prismaBase.googleConnection.findUnique({ where: { userId } });
  if (!c) return;
  // سحب الإذن من Google نفسها — لا مجرّد حذف السطر عندنا.
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptSecret(c.refreshTokenEnc))}`, { method: "POST" }).catch(() => undefined);
  await prismaBase.googleConnection.delete({ where: { userId } });
  await recordAudit({ userId, action: "GOOGLE_DISCONNECTED", entityType: "GoogleConnection", entityId: userId });
}

/** رمز وصول قصير العمر (ساعة) من رمز التحديث — يُمرَّر لمهمة الأتمتة ولا يُخزَّن. */
export async function freshAccessToken(userId: string): Promise<string | null> {
  if (!googleConfigured()) return null;
  const c = await prismaBase.googleConnection.findUnique({ where: { userId } });
  if (!c) return null;
  const t = await tokenRequest({
    client_id: env.GOOGLE_CLIENT_ID as string,
    client_secret: env.GOOGLE_CLIENT_SECRET as string,
    refresh_token: decryptSecret(c.refreshTokenEnc),
    grant_type: "refresh_token",
  });
  return t.access_token ?? null;
}
