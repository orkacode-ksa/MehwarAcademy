import { Link } from "react-router-dom";
import { PageHeader } from "../components/shell/PageHeader.js";
import { Surface } from "../components/ui/Surface.js";
import { LRow } from "../components/shared/LRow.js";
import { COURSES } from "../mock/courses.js";

/** قائمة مقررات الطالب — نسخة المرحلة ٢ الدنيا لإثبات التنقّل إلى صفحة مقرر الطالب */
export function StudentCoursesIndexPage() {
  return (
    <div>
      <PageHeader kicker="الطالب" title="مقرراتي" description={`${COURSES.length} مقررات`} />
      <Surface variant="card" className="overflow-hidden">
        {COURSES.map((c) => (
          <Link key={c.id} to={`/scourse/${c.id}`} className="block">
            <LRow tone={c.fresh ? "na" : "ok"} label={String(c.id + 1).padStart(2, "0")} title={`${c.code} — ${c.name}`} subtitle={`${c.secs} شعب`} />
          </Link>
        ))}
      </Surface>
    </div>
  );
}
