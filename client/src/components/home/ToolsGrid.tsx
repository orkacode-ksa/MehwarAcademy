import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../icons/Icon.js";

interface Tool {
  label: string;
  hint: string;
  icon: IconName;
  to: string;
}

/**
 * أدواتي — ثماني وجهات عامة في شبكة 2×4 (4×2 على الأعرض). القاعدة: لا أداة هنا تحتاج
 * مقررًا بعينه ثم تختار عنه — العمل المرتبط بمقرر يُدخل إليه من بطاقة المقرر.
 * ولا أداة تقود إلى شاشة غير مبنية.
 */
const TOOLS: Tool[] = [
  { label: "مهام اليوم", hint: "يومك مرتبًا بالوقت", icon: "clock", to: "/tasks" },
  { label: "ارصد الحضور", hint: "محاضرات اليوم وقوائمها", icon: "users", to: "/today" },
  { label: "مقرراتي", hint: "التجهيز والمواد والرصد", icon: "book", to: "/courses" },
  { label: "بنك المقررات", hint: "مقررات جاهزة لفصلك", icon: "box", to: "/bank" },
  { label: "أدائي والتزامي", hint: "مؤشراتك بلائحة جامعتك", icon: "chart", to: "/evalp" },
  { label: "سيرتي", hint: "السيرة ونشاطك العلمي", icon: "user", to: "/cv" },
  { label: "جامعتي", hint: "لوائحها ونماذجها", icon: "shield", to: "/university" },
  { label: "باقتي", hint: "الاستهلاك والاشتراك", icon: "star", to: "/plans" },
];

export function ToolsGrid() {
  return (
    <div className="tools-grid grid grid-cols-2 min-[820px]:grid-cols-4 gap-2.5 sm:gap-3">
      {TOOLS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="group flex items-center gap-3 p-3 sm:p-3.5 rounded-rmd bg-surface border border-line hover:border-deep/30 hover:shadow-s2 transition-[border-color,box-shadow] duration-150"
        >
          <span className="w-9 h-9 rounded-[11px] grid place-items-center flex-none bg-deep/[.06] text-deep group-hover:bg-deep group-hover:text-white transition-colors">
            <Icon name={t.icon} className="w-[17px] h-[17px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold truncate">{t.label}</span>
            <span className="block text-[10.5px] text-ink-3 truncate">{t.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
