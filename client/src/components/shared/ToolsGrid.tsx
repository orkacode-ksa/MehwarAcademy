import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../icons/Icon.js";

interface Tool {
  label: string;
  hint: string;
  icon: IconName;
  to: string;
}

/**
 * أدواتي — الإجراءات التي يبدأ منها عضو هيئة التدريس يومه.
 *
 * قاعدة صُحّحت بعد التمشيط: لا أداة هنا تحتاج مقرراً بعينه ثم تختار عنه.
 * كانت ثلاث أدوات تفتح «/course/0/...» ثابتاً — فيضغط الأستاذ «افتح كشف الدرجات»
 * فيجد نفسه في كشف مقرر لم يقصده. العمل المرتبط بمقرر يُدخل إليه من بطاقة المقرر،
 * والأدوات هنا كلها عامة الوجهة أو تسأل عن المقرر بنفسها.
 */
const TOOLS: Tool[] = [
  { label: "ولّد محاضرة", hint: "نص · عرض · فيديو · بودكاست", icon: "sparks", to: "/studio" },
  { label: "ارصد الحضور", hint: "رمز للقاعة أو رصد يدوي", icon: "users", to: "/attend" },
  { label: "أنشئ اختباراً", hint: "من البنك أو بتوليد جديد", icon: "file", to: "/exambuild" },
  { label: "تنبيهاتك الوقائية", hint: "ما يستحق قبل موعده", icon: "alert", to: "/alerts" },
  { label: "ساعاتك المكتبية", hint: "المواعيد والحجوزات", icon: "clock", to: "/office" },
  { label: "بنك المقرر", hint: "أسئلة ومراجع محفوظة", icon: "box", to: "/bank" },
  { label: "مؤشر الالتزام", hint: "٣٢ بنداً · ١٦ آلية", icon: "shield", to: "/rules" },
  { label: "تقييم أدائك", hint: "تنبؤ قبل التقييم الرسمي", icon: "chart", to: "/evalp" },
  { label: "الأرشيف", hint: "السنوات السابقة", icon: "arch", to: "/archive" },
];

export function ToolsGrid() {
  return (
    <div className="grid grid-cols-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-3 gap-2.5 sm:gap-3">
      {TOOLS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="group flex items-center gap-3 p-3 sm:p-3.5 rounded-rmd bg-white border border-line hover:border-[#C6D3CB] hover:shadow-s2 transition-[border-color,box-shadow] duration-150"
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
