import { Link } from "react-router-dom";
import { Icon, type IconName } from "../../icons/Icon.js";

interface Tool {
  label: string;
  hint: string;
  icon: IconName;
  to: string;
}

/**
 * أدواتي — الإجراءات التسعة التي يبدأ منها عضو هيئة التدريس يومه فعلًا.
 * وُضعت شبكةً واحدة بدل زرَّين في الترويسة: الوصول بضغطة واحدة من الصفحة الأولى،
 * وبأسماء تصف الفعل ("رصد الحضور") لا اسم الشاشة ("الحضور") — أوضح لمن لا تُهمّه
 * تسميات النظام.
 */
const TOOLS: Tool[] = [
  { label: "ولّد محاضرة", hint: "نص · عرض · فيديو · بودكاست", icon: "sparks", to: "/studio" },
  { label: "ارصد الحضور", hint: "رمز للقاعة أو رصد يدوي", icon: "users", to: "/attend" },
  { label: "أنشئ اختباراً", hint: "من البنك أو بتوليد جديد", icon: "file", to: "/exambuild" },
  { label: "افتح كشف الدرجات", hint: "رصد واعتماد وتصدير", icon: "tbl", to: "/course/0/grades" },
  { label: "أضف تكليفاً", hint: "واجب · بحث · نشاط", icon: "pen", to: "/course/0/tasks" },
  { label: "ساعاتك المكتبية", hint: "المواعيد والحجوزات", icon: "clock", to: "/office" },
  { label: "بنك المقرر", hint: "أسئلة ومراجع محفوظة", icon: "box", to: "/bank" },
  { label: "ملف الجودة", hint: "١١ عنصراً · ٨ تلقائية", icon: "shield", to: "/course/0/quality" },
  { label: "الأرشيف", hint: "السنوات السابقة", icon: "arch", to: "/archive" },
];

export function ToolsGrid() {
  return (
    <div className="grid grid-cols-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-3 gap-2.5 sm:gap-3">
      {TOOLS.map((t) => (
        <Link
          key={t.to + t.label}
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
