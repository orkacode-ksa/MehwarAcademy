import { Grid2, SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { TableScroll, TdId, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { sectionsFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";
import { toArabicDigits } from "../../../lib/numerals.js";

const th = "text-start px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الشعب والطلاب — الجدول مشتقّ من عدد شعب المقرر وطلابه، لا قائمة ثابتة لمقرر واحد */
export function SectionsTab({ course }: { course: MockCourse }) {
  const { showToast } = useToast();
  const sections = sectionsFor(course);
  const first = sections[0];

  return (
    <Grid2>
      <Surface variant="work" className="overflow-hidden">
        <WorkHeader
          title="الشعب"
          meta={`${toArabicDigits(course.secs)} شعب · ${toArabicDigits(course.st)} طالباً`}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => showToast("أُضيفت شعبة جديدة")}>
                <Icon name="plus" /> شعبة
              </Button>
              <Button variant="primary" size="sm" onClick={() => showToast("افتح معالج الاستيراد")}>
                <Icon name="up" /> استيراد الطلاب
              </Button>
            </>
          }
        />
        <TableScroll minWidth={720}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={th}>الشعبة</th>
                <th className={th}>الكود</th>
                <th className={`${th} text-center`}>الطلاب</th>
                <th className={th}>الموعد</th>
                <th className={th}>القاعة</th>
                <th className={th}>النمط</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.code} className="hover:bg-[#F9FBF9]">
                  <td className="px-3 py-2 border-b border-line-2 font-medium whitespace-nowrap">{s.name}</td>
                  <TdId>{s.code}</TdId>
                  <TdNum>{s.students}</TdNum>
                  <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{s.time}</td>
                  <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{s.room}</td>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone="neutral">{s.mode}</Chip>
                  </td>
                  <td className="px-3 py-2 border-b border-line-2 text-end">
                    <Button variant="text" size="sm" aria-label={`فتح ${s.name}`} onClick={() => showToast(`${s.name} — تفتح في المرحلة ٧`)}>
                      <Icon name="arr" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Surface>

      <div>
        <Surface variant="card" pad className="mb-4">
          <SectionLabel icon="up">معالج الاستيراد</SectionLabel>
          <div className="border-2 border-dashed border-line rounded-rmd p-[22px] text-center mb-3.5">
            <div className="text-[13px] font-semibold">أفلت كشف الطلاب هنا</div>
            <p className="text-[11px] text-ink-2 mt-1">Excel · CSV · PDF · لصق نصي</p>
          </div>
          <p className="text-[11px] text-ink-3 leading-[1.65]">
            إعادة استيراد نفس الملف تُحدِّث ولا تُكرِّر. الطالب الغائب عن الملف يُعلَّم «منسحب» بانتظار تأكيدك — ولا يُحذف.
          </p>
        </Surface>

        {first && (
          <Surface variant="card" pad>
            <SectionLabel>كود انضمام الطلاب</SectionLabel>
            <div className="text-center p-4 rounded-rmd bg-gradient-to-br from-mint to-white border border-teal/30">
              <div className="num text-[25px] font-semibold tracking-[.13em] text-deep">{first.code}</div>
              <p className="text-[11px] text-ink-2 mt-1.5">كود {first.name} — يدخله الطالب مرة واحدة عند التسجيل</p>
            </div>
            {sections.length > 1 && (
              <div className="mt-3 grid gap-1.5">
                {sections.slice(1).map((s) => (
                  <div key={s.code} className="flex justify-between text-[11.5px] text-ink-2">
                    <span>{s.name}</span>
                    <b className="num font-medium">{s.code}</b>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        )}
      </div>
    </Grid2>
  );
}
