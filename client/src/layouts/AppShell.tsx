import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Rail } from "../components/shell/Rail.js";
import { BottomNav } from "../components/shell/BottomNav.js";
import { MoreSheet } from "../components/shell/MoreSheet.js";
import { Topbar } from "../components/shell/Topbar.js";
import { SearchPalette } from "../components/shell/SearchPalette.js";
import { NotificationPanel } from "../components/shell/NotificationPanel.js";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.js";
import { roleOf } from "../nav/nav.js";
import { jumpPath, type JumpTarget } from "../nav/jump.js";
import { NOTIFICATIONS_BY_ROLE, type MockNotification } from "../mock/notifications.js";
import { useToast } from "../state/ToastContext.js";

/**
 * الشاشات التي يقوم فيها الترحيب مقام عنوان الصفحة (h1).
 * ليست «لوحة كل دور»: لوحة القسم ولوحة المالك لهما ترويسة صفحة بعنوانها، فجعل
 * الترحيب عنواناً ثانياً يمنح الصفحة عنوانين رئيسيين.
 */
const GREETING_IS_HEADING = new Set(["home", "shome"]);

/**
 * هيكل المنصة الداخلي: الشريط + الشريط العلوي + لوحة الجوال «المزيد» + البحث الموحّد +
 * مركز الإشعارات، ملفوفًا حول محتوى كل شاشة (Outlet). منقول من `rail()`/`topbar()`
 * ومستمعات `click`/`keydown` في نهاية سكربت البروتوتايب.
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<MockNotification[]>([]);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const screenKey = location.pathname.split("/")[1] || "home";
  const role = roleOf(screenKey);

  // الإشعارات تتبع الدور: الطالب كان يرى إشعارات عضو هيئة التدريس لأن القائمة واحدة
  useEffect(() => {
    setNotifications(NOTIFICATIONS_BY_ROLE[role] ?? []);
  }, [role]);
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    setMoreOpen(false);
    setSearchOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setMoreOpen(false);
        setLogoutOpen(false);
        return;
      }
      const isTyping = /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName);
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && !isTyping) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleJump(target: JumpTarget) {
    if (target.type === "toast") {
      showToast(target.message);
      return;
    }
    const path = jumpPath(target);
    if (path) navigate(path);
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    showToast("عُلِّمت كل الإشعارات كمقروءة");
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#main" className="skip">
        تخطَّ إلى المحتوى
      </a>
      <Rail role={role} onLogout={() => setLogoutOpen(true)} />
      <BottomNav role={role} onOpenMore={() => setMoreOpen(true)} moreActive={moreOpen} />
      <MoreSheet role={role} open={moreOpen} onClose={() => setMoreOpen(false)} onLogout={() => setLogoutOpen(true)} />
      <SearchPalette role={role} open={searchOpen} onClose={() => setSearchOpen(false)} onJump={handleJump} />
      <ConfirmDialog
        open={logoutOpen}
        title="تسجيل الخروج"
        body="سيُغلق حسابك على هذا الجهاز. العمل المحفوظ يبقى كما هو، والجلسات غير المغلقة تبقى بانتظارك عند العودة."
        confirmLabel="اخرج"
        cancelLabel="ابقَ"
        onConfirm={() => {
          setLogoutOpen(false);
          navigate("/");
        }}
        onCancel={() => setLogoutOpen(false)}
      />
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onJump={handleJump}
      />
      <main className="ms-0 sm:ms-rail min-h-screen px-3.5 pt-4 pb-24 sm:px-[30px] sm:pt-[22px] sm:pb-[70px]">
        <div className="max-w-[1260px] mx-auto" id="main">
          <Topbar role={role} isHome={GREETING_IS_HEADING.has(screenKey)} unreadCount={unreadCount} onSearchOpen={() => setSearchOpen(true)} onNotifOpen={() => setNotifOpen(true)} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
