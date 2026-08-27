import { Link } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Surface } from "../components/ui/Surface.js";
import { LRow } from "../components/shared/LRow.js";
import { COURSES } from "../mock/courses.js";

/**
 * قائمة المقررات — نسخة المرحلة ٢ الدنيا لإثبات التنقّل الديناميكي إلى صفحة المقرر.
 * بطاقات المقررات الكاملة (حلقة المقرر، التلوين، الوصف) تُبنى في المرحلة ٤.
 */
export function CoursesIndexPage() {
  return (
    <div>
      <PageHeader kicker="عضو هيئة التدريس" title="مقرراتي" description={`${COURSES.length} مقررات`} />
      <Surface variant="card" className="overflow-hidden">
        {COURSES.map((c) => (
          <Link key={c.id} to={`/course/${c.id}`} className="block">
            <LRow tone={c.fresh ? "na" : "ok"} label={String(c.id + 1).padStart(2, "0")} title={`${c.code} — ${c.name}`} subtitle={`${c.st} طالباً · ${c.secs} شعب`} />
          </Link>
        ))}
      </Surface>
    </div>
  );
}
