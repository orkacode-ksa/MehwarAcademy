import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SESSION_EXPIRED } from "../api/client.js";
import { resetSession, useSession } from "../hooks/useSession.js";
import { ROLE_HOME, roleOf, roleOfUser, SHARED_SCREENS, staffCan } from "../nav/nav.js";

/**
 * حارس المنصة: لا تُرسم أي شاشة داخلية (ولا حتى هيكلها) بلا جلسة، ولا شاشة دور آخر.
 *
 * - بلا جلسة ← صفحة الدخول مع الوجهة، **باستبدال** السجل: زر الرجوع لا يعيد صفحة مقفلة،
 *   وكتابة الرابط يدويًا لا تفتح شيئًا.
 * - شاشة دور آخر (أستاذ يكتب رابط لوحة المالك · طالب يكتب رابط أستاذ · موظف يكتب رابط
 *   شاشة غير ممنوحة) ← رئيسيته. الخادم يرفض البيانات أصلًا؛ هذا كي لا يُرى حتى الهيكل.
 * - انتهاء الجلسة أثناء الاستخدام ← الدخول فورًا.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();

  useEffect(() => {
    const expired = () => {
      resetSession();
      window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    };
    // الرجوع إلى صفحة محفوظة في ذاكرة المتصفح بعد الخروج: يُعاد التحقق بتحميل جديد.
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    window.addEventListener(SESSION_EXPIRED, expired);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener(SESSION_EXPIRED, expired);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  if (loading) return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const key = location.pathname.split("/")[1] ?? "";
  const mine = roleOfUser(user.role);
  const home = `/${ROLE_HOME[mine]}`;
  if (!SHARED_SCREENS.has(key)) {
    const screenRole = roleOf(key);
    const allowed =
      mine === "admin"
        ? screenRole === "admin" && (user.role === "OWNER" || staffCan(user, key))
        : mine === "student"
          ? screenRole === "student"
          : screenRole === "faculty" || (screenRole === "dept" && user.isDeptHead);
    if (!allowed) return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}
