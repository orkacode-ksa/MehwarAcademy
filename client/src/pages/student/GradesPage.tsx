import { Link } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { SectionLabel } from "../../components/shared/Section.js";
import { DataTable, type Column } from "../../components/shared/DataTable.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Bar } from "../../components/ui/Bar.js";
import { Icon } from "../../icons/Icon.js";
import { marksFor, studentCourses, type StudentCourse } from "../../mock/student.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

interface Row extends StudentCourse {
  diff: number;
}

/**
 * درجات الطالب عبر مقرراته.
 * البروتوتايب كان يعرضها في جدول بتسعة أعمدة يستحيل قراءته على الجوال. هنا سطر واحد
 * لكل مقرر بالأرقام التي تُقرأ (المرصود · مقابل المتوسط · الحضور)، والتفصيل بنداً
 * بنداً على بُعد نقرة واحدة داخل المقرر — لا ضغط تسعة أعمدة في شاشة 320 بكسل.
 */
export function StudentGradesPage() {
  const { showToast } = useToast();
  const rows: Row[] = studentCourses().map((c) => {
    const marks = marksFor(c.course.id, c.sectionIndex).filter((m) => m.mine !== null);
    const avg = marks.reduce((s, m) => s + (m.average ?? 0), 0);
    return { ...c, diff: Number((c.earned - avg).toFixed(1)) };
  });

  const earned = rows.reduce((s, r) => s + r.earned, 0);
  const outOf = rows.reduce((s, r) => s + r.outOf, 0);
  const best = [...rows].sort((a, b) => b.earned / (b.outOf || 1) - a.earned / (a.outOf || 1))[0];
  const watch = [...rows].sort((a, b) => a.earned / (a.outOf || 1) - b.earned / (b.outOf || 1))[0];

  const columns: Column<Row>[] = [
    { key: "name", header: "المقرر", cell: (r) => r.course.name, card: "title" },
    { key: "dr", header: "عضو هيئة التدريس", cell: (r) => <span className="text-[12px] text-ink-2">{r.course.instructor}</span>, card: "subtitle" },
    { key: "earned", header: "المرصود", align: "center", mono: true, cell: (r) => `${r.earned}/${r.outOf}`, card: "field" },
    {
      key: "diff",
      header: "مقابل المتوسط",
      align: "center",
      mono: true,
      cell: (r) => (
        <span dir="ltr" className={r.diff < 0 ? "text-crim font-semibold" : "text-teal font-semibold"}>
          {r.diff > 0 ? "+" : ""}
          {r.diff}
        </span>
      ),
      card: "field",
    },
    { key: "att", header: "حضوري", align: "center", mono: true, cell: (r) => `${r.attendance.percent}%`, card: "field" },
    {
      key: "go",
      header: "",
      align: "center",
      cell: (r) => (
        <Link to={`/scourse/${r.course.id}/sgr`} className="text-[11.5px] font-semibold text-deep inline-flex items-center gap-1">
          التفاصيل <Icon name="arr" className="w-3.5 h-3.5" />
        </Link>
      ),
      card: "field",
    },
  ];

  return (
    <div>
      <PageHeader
        kicker="أداؤك عبر مقرراتك"
        title="درجاتي"
        description={`${formatNum(rows.length)} مقررات · ${formatNum(earned)} من ${formatNum(outOf)} درجة مرصودة حتى الآن`}
        actions={
          <Button variant="secondary" onClick={() => showToast("صُدِّر كشف درجاتك بصيغة PDF")}>
            <Icon name="down" /> تصدير الكشف
          </Button>
        }
      />

      <Surface variant="work" className="overflow-hidden mb-4">
        <div className="px-3.5 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <b className="text-[13px]">كل المقررات</b>
          <span className="text-[11.5px] text-ink-3">المقارنة بمتوسط الشعبة فقط — بلا كشف هوية أي طالب</span>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(r) => String(r.course.id)} minWidth={760} empty="لا مقررات مسجّلة." />
      </Surface>

      <div className="grid grid-cols-1 min-[900px]:grid-cols-3 gap-4">
        <Surface variant="card" pad>
          <SectionLabel>ما رُصد حتى الآن</SectionLabel>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="num text-[29px] font-semibold text-teal">{outOf ? Math.round((earned / outOf) * 100) : 0}%</span>
            <span className="text-xs text-ink-2">من المرصود</span>
          </div>
          <Bar value={outOf ? (earned / outOf) * 100 : 0} className="mt-2.5" />
          <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.6]">
            هذه نسبة ما رُصد لا تقديرك النهائي — يُحتسب التقدير بعد رصد الاختبارات النهائية واعتماد الكشوف.
          </p>
        </Surface>

        {best && (
          <Surface variant="card" pad>
            <SectionLabel>أعلى مقرراتك</SectionLabel>
            <div className="text-[13px] font-semibold mt-1">{best.course.name}</div>
            <div className="text-[12px] text-ink-2 mt-0.5">
              {formatNum(best.earned)} من {formatNum(best.outOf)} · {best.diff > 0 ? "أعلى" : "أدنى"} من المتوسط بـ{" "}
              {formatNum(Math.abs(best.diff))}
            </div>
          </Surface>
        )}

        {watch && (
          <Surface variant="card" pad>
            <SectionLabel>يستدعي المتابعة</SectionLabel>
            <div className="text-[13px] font-semibold mt-1">{watch.course.name}</div>
            <div className="text-[12px] text-ink-2 mt-0.5">
              {formatNum(watch.earned)} من {formatNum(watch.outOf)} · حضورك {formatNum(watch.attendance.percent)}٪
            </div>
            <Link to={`/scourse/${watch.course.id}/sgr`} className="text-[11.5px] font-semibold text-deep mt-2 inline-block">
              افتح تفاصيله ←
            </Link>
          </Surface>
        )}
      </div>
    </div>
  );
}
