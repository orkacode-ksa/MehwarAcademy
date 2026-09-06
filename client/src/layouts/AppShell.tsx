import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Icon } from "../icons/Icon.js";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.js";

/**
 * الهيكل — الإصدار الثاني.
 *
 * لا شريط جانبي، ولا شريط سفلي، ولا لوحة «المزيد»، ولا بحث موحّد، ولا مركز إشعارات.
 * بست شاشات لا يوجد ما يُتنقَّل بينه: الشعار يعود لمقرراتي، والباقي بالنقر والرجوع.
 * كل عنصر تنقّل حُذف هنا كان في الإصدار الأول شيئًا يجب على المستخدم أن يتعلّمه أولًا.
 */
export function AppShell() {
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div dir="rtl" className="min-h-[100svh] bg-canvas text-ink">
      <header className="sticky top-0 z-40 bg-canvas/[.88] backdrop-blur-lg border-b border-line">
        <div className="max-w-[880px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link to="/courses" className="flex items-center gap-2.5 font-amiri font-bold text-[18px]">
            <span className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-deep to-deep3 grid place-items-center text-white">
              <Icon name="logo" className="w-[17px] h-[17px]" />
            </span>
            مِحوَر
          </Link>

          {/* لا زرّ إعدادات حتى تُبنى شاشتها: زرّ يقود إلى لا شيء أسوأ من غيابه. */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLogoutOpen(true)}
              aria-label="تسجيل الخروج"
              className="w-11 h-11 grid place-items-center rounded-[11px] text-ink2 hover:text-deep hover:bg-deep/[.06] transition-colors"
            >
              <Icon name="logout" className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[880px] mx-auto px-5 py-7 pb-20">
        <Outlet />
      </main>

      <ConfirmDialog
        open={logoutOpen}
        title="تسجيل الخروج"
        body="سيُغلق حسابك على هذا الجهاز."
        confirmLabel="خروج"
        onConfirm={() => {
          setLogoutOpen(false);
          navigate("/");
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}
