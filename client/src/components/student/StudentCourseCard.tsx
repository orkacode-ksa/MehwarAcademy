import { Link } from "react-router-dom";
import { Bar } from "../ui/Bar.js";
import { Chip } from "../ui/Chip.js";
import { ABSENCE_LIMIT, type StudentCourse } from "../../mock/student.js";
import { formatNum } from "../../lib/numerals.js";

const TINT: Record<string, string> = {
  mint: "bg-gradient-to-br from-mint to-[#F4FAF6]",
  lav: "bg-gradient-to-br from-lav to-[#FBF7F1]",
  peach: "bg-gradient-to-br from-peach to-[#FDF8F0]",
  sky: "bg-gradient-to-br from-sky to-[#F4F8F5]",
};

/**
 * بطاقة مقرر بعين الطالب. ثلاثة أرقام لا أكثر — وهي الثلاثة التي يسأل عنها فعلاً:
 * كم محاضرة بقيت عليّ؟ وكيف حضوري؟ وكم درجة كسبت؟ (حلقة الجودة شأن أستاذه لا شأنه).
 */
export function StudentCourseCard({ item }: { item: StudentCourse }) {
  const { course, section, published, watched, earned, outOf, attendance } = item;
  const atRisk = attendance.absenceRate >= ABSENCE_LIMIT - 8;

  return (
    <Link
      to={`/scourse/${course.id}`}
      className={`block p-[18px] rounded-rlg border border-line transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-[3px] hover:shadow-s3 hover:border-[#CBD8CF] ${TINT[course.tint]}`}
    >
      <div className="flex justify-between items-start gap-2.5">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-ink-3">{course.code}</div>
          <h3 className="text-[15px] font-semibold">{course.name}</h3>
          <div className="text-[11px] text-ink-2 mt-0.5">
            {course.instructor} · {section.name}
          </div>
        </div>
        {atRisk && <Chip tone="crimson">تنبيه غياب</Chip>}
      </div>

      <div className="flex gap-4 mt-3.5">
        <Metric label="المحاضرات" value={`${formatNum(watched)}/${formatNum(published)}`} percent={published ? (watched / published) * 100 : 0} />
        <Metric label="حضوري" value={`${formatNum(attendance.percent)}%`} percent={attendance.percent} warn={atRisk} />
        <Metric label="درجاتي" value={`${formatNum(earned)}/${formatNum(outOf)}`} percent={outOf ? (earned / outOf) * 100 : 0} />
      </div>
    </Link>
  );
}

function Metric({ label, value, percent, warn = false }: { label: string; value: string; percent: number; warn?: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] text-ink-3 mb-1">{label}</div>
      <Bar value={percent} height={5} color={warn ? "var(--amber)" : undefined} />
      <div className="num text-[11px] text-ink-3 mt-1">{value}</div>
    </div>
  );
}
