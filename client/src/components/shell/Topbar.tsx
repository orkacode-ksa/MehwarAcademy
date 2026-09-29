import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../../icons/Icon.js";
import { assetUrl } from "../../api/client.js";
import { SystemStrip } from "./SystemStrip.js";
import { greetingFor } from "../../mock/session.js";
import { initialOf, useSession } from "../../hooks/useSession.js";
import { confirmLogout } from "../../lib/logoutFlow.js";
import { useUnread } from "../../hooks/useUnread.js";
import { formatNum } from "../../lib/numerals.js";
import { usePageTitleState } from "../../state/PageTitle.js";
import { FALLBACK_TITLE, parentOf } from "../../nav/navTree.js";
import { RiyalText } from "../ui/Riyal.js";

const iconBtn =
  "w-10 h-10 rounded-full grid place-items-center flex-none text-ink-2 bg-surface/55 border border-surface/70 backdrop-blur-sm hover:bg-surface hover:text-deep hover:border-line transition-colors";

/**
 * رأس المنصة — كاملًا في الرئيسية وحدها، ومختصرًا في كل شاشة فرعية:
 * ١) شريط النظام وحده في سطر مستقل (الفصل · الأسبوع · النسبة · إعلانات المالك).
 * ٢) سطر الحساب: الصورة وعليها قلم ← «حسابي»، والترحيب والاسم، ثم الإشعارات · الخروج.
 *    «حسابي» خرج من الشريط السفلي إلى هنا — مكانه الطبيعي بجانب صاحب الحساب.
 */
export function Topbar({ home }: { home: string }) {
  const { user } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const unread = useUnread(pathname);
  const { compact, title } = usePageTitleState();
  const name = user?.fullName ?? "";

  // الشاشات الفرعية: رأس مختصر — رجوع إلى الأب المنطقي · العنوان · الرئيسية.
  if (compact) {
    const heading = title ?? FALLBACK_TITLE[pathname.split("/")[1] ?? ""] ?? "";
    return (
      <div className="sticky top-0 z-40 -mx-3.5 sm:-mx-[30px] px-3.5 sm:px-[30px] pt-[max(8px,env(safe-area-inset-top))] pb-2 mb-4 -mt-4 sm:-mt-[22px] bg-canvas/85 backdrop-blur-xl flex items-center gap-2">
        <button type="button" aria-label="رجوع" className={iconBtn} onClick={() => navigate(parentOf(pathname, home))}>
          <Icon name="arrl" className="w-[18px] h-[18px]" />
        </button>
        <h1 className="flex-1 min-w-0 text-center text-[16px] sm:text-[18px] font-semibold truncate">
          <RiyalText text={heading} />
        </h1>
        <Link to={`/${home}`} aria-label="الرئيسية" className={iconBtn}>
          <Icon name="home" className="w-[18px] h-[18px]" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <SystemStrip />

      <div className="flex items-center gap-3 mt-3.5">
        <Link to="/account" aria-label="حسابي — تعديل الملف الشخصي" className="relative flex-none group">
          {user?.avatarUrl ? (
            <img src={assetUrl(user.avatarUrl)} alt="" className="w-11 h-11 rounded-full object-cover shadow-s1" />
          ) : (
            <span aria-hidden className="w-11 h-11 rounded-full grid place-items-center text-white font-semibold text-[14px] bg-gradient-to-br from-deep to-deep3 shadow-s1">
              {name ? initialOf(name) : ""}
            </span>
          )}
          <span aria-hidden className="absolute -bottom-0.5 -start-0.5 w-5 h-5 rounded-full grid place-items-center bg-surface text-deep border border-line shadow-s1 group-hover:bg-deep group-hover:text-white transition-colors">
            <Icon name="pen" className="w-[11px] h-[11px]" />
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-ink-3">{greetingFor()}</div>
          <div className="text-[17px] sm:text-[19px] font-semibold truncate leading-snug">{name || " "}</div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-none">
          <Link to="/notifications" aria-label={`الإشعارات${unread ? ` — ${unread} غير مقروء` : ""}`} className={`relative ${iconBtn}`}>
            <Icon name="bell" className="w-[18px] h-[18px]" />
            {unread > 0 && (
              <b className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-crim text-white text-[10px] leading-[18px] text-center ring-2 ring-canvas">
                {unread > 9 ? "+٩" : formatNum(unread)}
              </b>
            )}
          </Link>
          <button type="button" aria-label="تسجيل الخروج" className={iconBtn} onClick={() => void confirmLogout(navigate)}>
            <Icon name="logout" className="w-[18px] h-[18px] -scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
