import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: "OWNER" | "ADMIN" | "TEACHER" | "STUDENT";
  isDeptHead: boolean;
  tenantId: string;
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
  shared ??= api.get<SessionUser>("/auth/me").catch(() => null);
  return shared;
}

/** يُستدعى بعد الدخول والخروج حتى لا يبقى مستخدم الجلسة السابقة. */
export function resetSession(): void {
  shared = null;
}

export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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
  await api.post("/auth/logout", {}).catch(() => undefined);
  resetSession();
}

/** الحرف الأول للاسم بعد إسقاط اللقب — «د. عبدالله» ← «ع». */
export function initialOf(fullName: string): string {
  return fullName.replace(/^(د\.|أ\.د\.|أ\.)\s*/, "").trim().charAt(0) || "؟";
}
