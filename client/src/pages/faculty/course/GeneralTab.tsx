import { Grid2, SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Bar } from "../../../components/ui/Bar.js";
import { LRow } from "../../../components/shared/LRow.js";
import { Icon } from "../../../icons/Icon.js";
import { topicsFor, weightsFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";
import { formatNum } from "../../../lib/numerals.js";

/** البيانات العامة: التوصيف ومخرجات التعلم والمواضيع والمراجع وتوزيع الدرجات */
export function GeneralTab({ course }: { course: MockCourse }) {
  const { showToast } = useToast();
  const topics = topicsFor(course);
  const weights = weightsFor(course);
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  const maxWeight = Math.max(...weights.map((w) => w.weight));
  const approved = course.stepPercents.general === 100;

  return (
    <Grid2>
      <div>
        <Surface variant="card" className="overflow-hidden mb-4">
          <WorkHeader
            title={
              <>
                توصيف المقرر{" "}
                <Chip tone={approved ? "teal" : "amber"} className="ms-2">
                  {approved ? "مرفوع ومُستخرَج" : "قيد المراجعة"}
                </Chip>
              </>
            }
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("استبدال التوصيف — يُوصل بالخادم في المرحلة 7")}>
                <Icon name="edit" /> استبدل
              </Button>
            }
          />
          <div className="p-[18px]">
            <p className="text-xs text-ink-2 mb-3.5 leading-[1.7]">
              استُخرجت هذه الحقول من ملف التوصيف تلقائياً. راجعها واعتمدها — لا تُكتب في النظام قبل اعتمادك.
            </p>
            <SectionLabel>مخرجات التعلم (CLO)</SectionLabel>
            {course.clos.map((t, i) => (
              <div key={t} className="flex gap-3 py-2.5 border-b border-line-2 last:border-b-0">
                <Chip tone="neutral" className="num flex-none self-start">
                  CLO {i + 1}
                </Chip>
                <span className="text-xs flex-1 leading-[1.7]">{t}</span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface variant="card" className="overflow-hidden">
          <WorkHeader
            title="فهرس المحتويات والمواضيع"
            meta={`${formatNum(topics.length)} مواضيع · 15 أسبوعاً`}
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف موضوع جديد")}>
                <Icon name="plus" /> موضوع
              </Button>
            }
          />
          {topics.map((t) => (
            <LRow key={t.n} tone={t.tone} label={t.n} title={t.title} subtitle={`${t.clo} · ${t.status}`} />
          ))}
        </Surface>
      </div>

      <div>
        <Surface variant="card" className="overflow-hidden mb-4">
          <WorkHeader
            title="المراجع"
            actions={
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيف مرجع")}>
                <Icon name="plus" /> مرجع
              </Button>
            }
          />
          {course.refs.map(([t, meta, src]) => (
            <LRow key={t} tone="ok" icon="file" title={t} subtitle={`${meta} · ${src}`} />
          ))}
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>توزيع الدرجات المعتمد</SectionLabel>
          {weights.map((w) => (
            <div key={w.key} className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span>{w.label}</span>
                <b className="num">{w.weight}%</b>
              </div>
              <Bar value={(w.weight / maxWeight) * 100} height={4} />
            </div>
          ))}
          <div className="flex justify-between pt-2.5 border-t border-line font-semibold text-[12.5px]">
            <span>الإجمالي</span>
            <span className="num text-teal">{totalWeight}%</span>
          </div>
          {!course.lab && (
            <p className="text-[11px] text-ink-3 mt-2.5 leading-[1.65]">
              لا اختبار عملي في هذا المقرر لأنه بلا شق معملي — ونصيبه أُعيد توزيعه على بقية التقييمات.
            </p>
          )}
          <Alert tone="teal" icon="check" className="mt-3.5 mb-0">
            نُشر للطلاب في الأسبوع الأول — البند 10 في لوائح الالتزام مستوفى.
          </Alert>
        </Surface>
      </div>
    </Grid2>
  );
}
