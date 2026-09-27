import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Rail } from "../components/shell/Rail.js";
import { BottomNav } from "../components/shell/BottomNav.js";
import { MoreSheet } from "../components/shell/MoreSheet.js";
import { Topbar } from "../components/shell/Topbar.js";
import { SubscriptionBanner } from "../components/shell/SubscriptionBanner.js";
import { roleOf } from "../nav/nav.js";
import { logout } from "../hooks/useSession.js";

/**
 * هيكل المنصة الداخلي: الشريط الجانبي (سطح المكتب) أو السفلي (الجوال) + الرأس + المحتوى.
 *
 * أُزيل البحث الموحّد ومركز الإشعارات وشريط النظام: كانت كلها تعرض بيانات وهمية (عدّاد
 * إشعارات من ملف mock) — وعدد وهمي أسوأ من لا عدد. تعود حين يكون لها مصدر حقيقي.
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const screenKey = location.pathname.split("/")[1] || "today";
  const role = roleOf(screenKey);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#main" className="skip">
        تخطَّ إلى المحتوى
      </a>
      <Rail role={role} />
      <BottomNav role={role} onOpenMore={() => setMoreOpen(true)} moreActive={moreOpen} />
      <MoreSheet
        role={role}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onLogout={() => void logout().then(() => navigate("/login"))}
      />
      <main className="ms-0 sm:ms-rail min-h-screen px-3.5 pt-4 pb-24 sm:px-[30px] sm:pt-[22px] sm:pb-[70px]">
        <div className="max-w-[1100px] mx-auto" id="main">
          <Topbar />
          <SubscriptionBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
