import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Rail } from "../components/shell/Rail.js";
import { BottomNav } from "../components/shell/BottomNav.js";
import { MoreSheet } from "../components/shell/MoreSheet.js";
import { Topbar } from "../components/shell/Topbar.js";
import { SearchPalette } from "../components/shell/SearchPalette.js";
import { NotificationPanel } from "../components/shell/NotificationPanel.js";
import { roleOf } from "../nav/nav.js";
import { jumpPath, type JumpTarget } from "../nav/jump.js";
import { NOTIFICATIONS as INITIAL_NOTIFICATIONS } from "../mock/notifications.js";
import { useToast } from "../state/ToastContext.js";

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
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const screenKey = location.pathname.split("/")[1] || "home";
  const role = roleOf(screenKey);
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
      <Rail role={role} />
      <BottomNav role={role} onOpenMore={() => setMoreOpen(true)} moreActive={moreOpen} />
      <MoreSheet role={role} open={moreOpen} onClose={() => setMoreOpen(false)} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} onJump={handleJump} />
      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onJump={handleJump}
      />
      <main className="ms-0 sm:ms-rail min-h-screen px-3.5 pt-4 pb-24 sm:px-[30px] sm:pt-[22px] sm:pb-[70px]">
        <div className="max-w-[1260px] mx-auto" id="main">
          <Topbar role={role} unreadCount={unreadCount} onSearchOpen={() => setSearchOpen(true)} onNotifOpen={() => setNotifOpen(true)} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
