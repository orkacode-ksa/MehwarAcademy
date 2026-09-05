import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { LRow } from "../../../components/shared/LRow.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Bar } from "../../../components/ui/Bar.js";
import { Icon } from "../../../icons/Icon.js";
import { topicsFor, weightsFor } from "../../../mock/courseData.js";
import type { StudentCourse } from "../../../mock/student.js";
import { useToast } from "../../../state/ToastContext.js";

/** المواد والمراجع وفهرس المواضيع وتوزيع الدرجات — كلها من توصيف المقرر نفسه */
export function StudentMaterialsTab({ item }: { item: StudentCourse }) {
  const { showToast } = useToast();
  const { course } = item;
  const topics = topicsFor(course);
  const weights = weightsFor(course);
  const maxWeight = Math.max(...weights.map((w) => w.weight));

  return (
    <Grid2>
      <Surface variant="card" className="overflow-hidden">
        <div className="px-4 sm:px-[18px] py-3 border-b border-line">
          <b className="text-[13px]">المراجع المعتمدة</b>
        </div>
        {course.refs.map(([title, meta]) => (
          <LRow
            key={title}
            tone="ok"
            icon="book"
            title={title}
            subtitle={meta}
            action={
              <Button variant="text" size="sm" aria-label={`تنزيل ${title}`} onClick={() => showToast(`جارٍ تنزيل ${title}`)}>
                <Icon name="down" />
              </Button>
            }
          />
        ))}
        <div className="px-4 py-2.5 bg-[#F2F6F2] text-[10.5px] font-semibold tracking-[.07em] text-ink-2 border-y border-line-2">
          فهرس المواضيع
        </div>
        {topics.map((t) => (
          <LRow key={t.n} tone={t.tone} label={t.n} title={t.title} subtitle={t.status === "مُنجز" ? "مغطّى" : t.status} />
        ))}
      </Surface>

      <div>
        <Surface variant="card" pad className="mb-4">
          <SectionLabel>توزيع الدرجات</SectionLabel>
          {weights.map((w) => (
            <div key={w.key} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span>{w.label}</span>
                <b className="num">{w.weight}%</b>
              </div>
              <Bar value={(w.weight / maxWeight) * 100} height={4} />
            </div>
          ))}
          <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.65]">
            هذا التوزيع معتمد من عضو هيئة التدريس ومنشور منذ الأسبوع الأول، ولا يتغيّر خلال الفصل.
          </p>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>أعمال زملائك المنشورة</SectionLabel>
          <p className="text-[12px] text-ink-2 leading-[1.7] mb-3">
            سمح عضو هيئة التدريس بنشر أنشطة الطلاب، فيمكنك الاطلاع على ما أعدّه زملاؤك في هذا المقرر.
          </p>
          {[
            ["شرح منحنى النمو", "عرض تقديمي · 12 شريحة"],
            ["خريطة ذهنية للتصنيف", "ملف PDF · صفحتان"],
          ].map(([t, s]) => (
            <div key={t} className="flex items-center gap-2.5 py-2 border-b border-line-2 last:border-b-0">
              <span className="w-[26px] h-[26px] rounded-[8px] grid place-items-center flex-none bg-deep/[.06] text-ink-3">
                <Icon name="file" className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-medium">{t}</span>
                <span className="block text-[11px] text-ink-3">{s}</span>
              </span>
            </div>
          ))}
          <p className="text-[11px] text-ink-3 mt-3">تُعرض الأعمال بلا أسماء ما لم يأذن أصحابها بإظهارها.</p>
        </Surface>
      </div>
    </Grid2>
  );
}
