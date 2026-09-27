import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi.js";
import { Icon } from "../../icons/Icon.js";

const KEY = "mihwar.universityNudge.dismissed";
const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * دعوة لطيفة للأستاذ من جامعة لم تُعتمد بعد: ارفع لوائح جامعتك (الآن أو لاحقًا).
 * تظهر في «محاضرة اليوم» حتى يرفع شيئًا أو يؤجّلها.
 */
export function UniversityNudge() {
  const [hidden, setHidden] = useState(dismissed);
  const { data } = useApi<{ name: string | null; listed: boolean; submissions: unknown[] }>(hidden ? null : "/university/me");
  if (hidden || !data || data.listed || data.submissions.length > 0) return null;
  return (
    <div className="mb-4 rounded-[14px] border border-deep/20 bg-deep/[.04] p-3.5 flex items-center gap-3 flex-wrap">
      <Icon name="shield" className="w-5 h-5 text-deep flex-none" />
      <p className="flex-1 min-w-[220px] text-[13.5px]">
        نجهّز المنصة على لوائح {data.name ? <strong className="font-semibold">{data.name}</strong> : "جامعتك"}: ارفع ملف المقرر المعتمد لديكم ولائحة المخالفات، فتُضبط لك ولزملائك.
      </p>
      <Link to="/university" className="inline-flex items-center min-h-[44px] px-4 rounded-[12px] bg-deep text-white text-[13px] font-medium">
        ارفع الآن
      </Link>
      <button
        type="button"
        className="min-h-[44px] px-3 text-[13px] text-ink-2"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* التذكّر راحة لا شرط */
          }
          setHidden(true);
        }}
      >
        لاحقًا
      </button>
    </div>
  );
}
