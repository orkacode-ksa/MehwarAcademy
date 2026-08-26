import { NavLink, Outlet } from "react-router-dom";
import { useLogout, useMe } from "../features/auth/useAuth.js";

const NAV_ITEMS = [
  { to: "/app", label: "الرئيسية", end: true },
  { to: "/app/billing", label: "الاشتراك" },
];

export function AppLayout() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-display text-lg font-bold text-brand">مِحوَر</span>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            {me && <span className="hidden sm:inline">{me.fullName}</span>}
            <button
              className="rounded-sm px-3 py-2 min-h-[44px] text-brand hover:bg-brand/5 focus-ring"
              onClick={() => logout.mutate()}
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-200 bg-white sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex min-h-[44px] flex-1 items-center justify-center py-3 text-sm font-medium focus-ring ${
                isActive ? "text-brand" : "text-ink-muted"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
