import { Suspense, lazy, useEffect, useState } from "react";
import { PageFallback } from "../lib/lazyPage.js";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Rail } from "../components/shell/Rail.js";
import { BottomNav } from "../components/shell/BottomNav.js";
import { MoreSheet } from "../components/shell/MoreSheet.js";
import { Topbar } from "../components/shell/Topbar.js";
import { SubscriptionBanner } from "../components/shell/SubscriptionBanner.js";
import { OwnerMfaBanner } from "../components/shell/OwnerMfaBanner.js";
import { ROLE_HOME, roleOf, roleOfUser, SHARED_SCREENS } from "../nav/nav.js";
import { PageTitleProvider } from "../state/PageTitle.js";
import { useSession } from "../hooks/useSession.js";
import { confirmLogout } from "../lib/logoutFlow.js";
const AssistantPanel = lazy(() => import("../components/assistant/AssistantPanel.js").then((m) => ({ default: m.AssistantPanel })));
import { Icon } from "../icons/Icon.js";

/**
 * هيكل المنصة الداخلي: الشريط الجانبي (سطح المكتب) أو السفلي (الجوال) + الرأس + المحتوى.
 *
 * شريط النظام والإشعارات من الخادم (`/me/strip` · `/me/notifications`) — لا بيانات وهمية.
 */
export function AppShell() {
  const location = useLocation();
  const screenKey = location.pathname.split("/")[1] || "today";
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [assistantOpen, setAssistantOpenRaw] = useState(false);
  // المساعد حزمة مستقلة تُحمَّل عند أول فتح فقط، ثم تبقى مركّبة لتحفظ المحادثة.
  const [assistantUsed, setAssistantUsed] = useState(false);
  const setAssistantOpen = (v: boolean) => {
    if (v) setAssistantUsed(true);
    setAssistantOpenRaw(v);
  };
  const { user } = useSession();
  const role = SHARED_SCREENS.has(screenKey) ? roleOfUser(user?.role) : roleOf(screenKey);
  const teacher = user?.role === "TEACHER" && role === "faculty";
  // الرأس الكامل (الترحيب وشريط النظام) في رئيسية صاحب الحساب وحدها.
  const home = ROLE_HOME[roleOfUser(user?.role)];
  const atHome = location.pathname === `/${home}`;


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
      <BottomNav role={role} onOpenMore={() => setMoreOpen(true)} moreActive={moreOpen} {...(teacher ? { onOpenAssistant: () => setAssistantOpen(true) } : {})} />
      {teacher && (
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          aria-label="المساعد"
          className="hidden sm:flex fixed bottom-6 left-6 z-50 items-center gap-2 h-14 ps-4 pe-5 rounded-full bg-deep text-white shadow-lg hover:shadow-xl transition-shadow"
        >
          <Icon name="sparks" className="w-5 h-5" />
          <span className="text-[14px] font-medium">المساعد</span>
        </button>
      )}
      {assistantUsed && (
        <Suspense fallback={null}>
          <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
        </Suspense>
      )}
      <MoreSheet
        role={role}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onLogout={() => void confirmLogout(navigate)}
      />
      <main className="ms-0 sm:ms-rail min-h-screen px-3.5 pt-4 pb-28 sm:px-[30px] sm:pt-[22px] sm:pb-[70px]">
        <div className="max-w-[1100px] mx-auto" id="main">
          <PageTitleProvider compact={!atHome}>
            <Topbar home={home} />
            <SubscriptionBanner />
            {(user?.role === "OWNER" || user?.role === "ADMIN") && <OwnerMfaBanner />}
            <Suspense fallback={<PageFallback />}>
              {/* كل شاشة تدخل بانزلاق قصير — لا ظهور مفاجئ عند التنقّل */}
              <div key={location.pathname} className="page-in">
                <Outlet />
              </div>
            </Suspense>
          </PageTitleProvider>
        </div>
      </main>
    </div>
  );
}
