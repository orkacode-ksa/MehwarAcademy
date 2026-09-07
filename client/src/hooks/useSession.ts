import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: "OWNER" | "ADMIN" | "TEACHER" | "STUDENT";
}

/**
 * المستخدم الحالي من الخادم.
 *
 * كان الرأس يعرض اسمًا وهميًا ثابتًا («د. عبدالله») لكل من يدخل — فيرى المستخدم اسم
 * شخص آخر فوق شاشته. الاسم الآن من `/auth/me`، ولا يُعرض شيء قبل وصوله.
 */
export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get<SessionUser>("/auth/me")
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}

/** الحرف الأول للاسم بعد إسقاط اللقب — «د. عبدالله» ← «ع». */
export function initialOf(fullName: string): string {
  return fullName.replace(/^(د\.|أ\.د\.|أ\.)\s*/, "").trim().charAt(0) || "؟";
}
