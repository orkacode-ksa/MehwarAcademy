import { useEffect, useState } from "react";
import type { UserPrefs } from "@mihwar/shared";
import { api } from "../api/client.js";
import { apply } from "../lib/prefs.js";
import { forgetReturn, markSignedIn, markSignedOut } from "../lib/exitGuard.js";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: "OWNER" | "ADMIN" | "TEACHER" | "STUDENT";
  isDeptHead: boolean;
  tenantId: string;
  /** صورة الملف الشخصي — رابط ملف أو null (تُعرض الأحرف الأولى بدلها) */
  avatarUrl?: string | null;
  phone?: string | null;
  /** موظف الإدارة (ADMIN): الشاشات الممنوحة له */
  staffScreens?: string[];
  prefs?: UserPrefs;
  workspaceMemberships: { workspaceId: string }[];
}

/**
 * المستخدم الحالي من الخادم — نداء واحد تتشاركه كل المكوّنات (الرأس · الشريط · القائمة)
 * بدل نداء لكل مكوّن.
 *
 * كان الرأس يعرض اسمًا وهميًا ثابتًا («د. عبدالله») لكل من يدخل. الاسم الآن من `/auth/me`،
 * ولا يُعرض شيء قبل وصوله.
 */
let shared: Promise<SessionUser | null> | null = null;

function load(): Promise<SessionUser | null> {
  shared ??= api
    .get<SessionUser>("/auth/me")
    .then((u) => {
      // تفضيلات الحساب تغلب المحفوظ في هذا المتصفح — اختارها على جهاز آخر فتتبعه هنا.
      if (u?.prefs) apply(u.prefs);
      if (u) markSignedIn();
      return u;
    })
    .catch(() => null);
  return shared;
}

/** يُستدعى بعد الدخول والخروج حتى لا يبقى مستخدم الجلسة السابقة. */
export function resetSession(): void {
  shared = null;
}

/** بعد تعديل الاسم أو الصورة: يُعاد جلب المستخدم ويُبلَّغ كل من يعرضه (الرأس). */
const listeners = new Set<(u: SessionUser | null) => void>();
export async function refreshSession(): Promise<void> {
  shared = null;
  const u = await load();
  listeners.forEach((f) => f(u));
}

export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listeners.add(setUser);
    return () => {
      listeners.delete(setUser);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    load()
      .then((u) => alive && setUser(u))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}

/** خروج حقيقي: يُبطل الجلسة في الخادم — كان زرّ «خروج» ينقل للصفحة الأولى والجلسة باقية. */
export async function logout(): Promise<void> {
  markSignedOut();
  forgetReturn();
  await api.post("/auth/logout", {}).catch(() => undefined);
  resetSession();
}

/** الحرف الأول للاسم بعد إسقاط اللقب — «د. عبدالله» ← «ع». */
export function initialOf(fullName: string): string {
  return fullName.replace(/^(د\.|أ\.د\.|أ\.)\s*/, "").trim().charAt(0) || "؟";
}
