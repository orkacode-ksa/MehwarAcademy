import { useNavigate } from "react-router-dom";
import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { CourseRing } from "../../../components/shared/CourseRing.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Icon } from "../../../icons/Icon.js";
import { qualityFor, qualityCount } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";
import { toArabicDigits } from "../../../lib/numerals.js";

const EXPORT_CONTENTS = [
  "غلاف بهوية الجامعة والقسم",
  "فهرس مرقّم بالعناصر",
  "كل عنصر في قسم مستقل",
  "ترقيم صفحات وتذييل",
  "تاريخ هجري وميلادي",
];

/**
 * ملف الجودة.
 * كان هذا التبويب يعرض ٨ من ١١ لكل المقررات، فيقول تبويب الجودة «٨» بينما تقول بطاقة
 * المقرر نفسه «٣». الآن العناصر مشتقّة من المقرر، وزر كل عنصر ناقص يفتح الخطوة التي
 * تُستكمل منها فعلاً بدل رسالة توست لا تقود لشيء.
 */
export function QualityTab({ course }: { course: MockCourse }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const groups = qualityFor(course);
  const { done, total } = qualityCount(course);
  const pending = groups.flatMap((g) => g.items).filter((i) => !i.ok);
  const manualPending = pending.filter((i) => i.manual);
  const autoPending = pending.filter((i) => !i.manual);

  return (
    <Grid2>
      <Surface variant="card" className="overflow-hidden">
        {groups.map((group) => (
          <div key={group.s}>
            <div className="px-4 py-2.5 bg-[#F2F6F2] text-[10.5px] font-semibold tracking-[.07em] text-ink-2 uppercase border-b border-line-2">
              {group.s}
            </div>
            {group.items.map((item) => (
              <div key={item.n} className="flex items-center gap-3 px-4 py-3 border-b border-line-2 last:border-b-0 hover:bg-[#FAFCFA]">
                <div
                  className={`grid place-items-center flex-none w-[30px] h-[30px] rounded-[9px] font-mono text-[11.5px] font-semibold ${
                    item.ok ? "bg-teal/[.14] text-[#2C6B52]" : "bg-gold2/[.18] text-[#7C6134]"
                  }`}
                >
                  {item.n}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-medium">{item.t}</h4>
                  <div className="text-[11px] text-ink-3 mt-px">{item.src}</div>
                </div>
                {item.ok ? (
                  <Chip tone="teal" className="flex-none">
                    مربوط تلقائياً
                  </Chip>
                ) : item.goTab ? (
                  <Button variant="primary" size="sm" className="flex-none" onClick={() => navigate(`/course/${course.id}/${item.goTab}`)}>
                    افتح الخطوة ←
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" className="flex-none" onClick={() => showToast(`ارفع ملف: ${item.t}`)}>
                    <Icon name="up" /> ارفع
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}
      </Surface>

      <div>
        <Surface variant="card" pad className="text-center mb-4">
          <div className="grid place-items-center">
            <CourseRing syllabus={course.syl} quality={done} qualityTotal={total} assessments={course.as} size={132} />
          </div>
          <div className="mt-3.5">
            <div className="text-[13px] font-semibold">
              {toArabicDigits(done)} من {toArabicDigits(total)} عنصراً
            </div>
            <p className="text-xs text-ink-2 mt-1.5 leading-[1.65]">
              {pending.length === 0
                ? "الملف مكتمل — يمكنك تصديره الآن."
                : `ينقصك ${toArabicDigits(pending.length)} ${pending.length === 1 ? "عنصر" : "عناصر"}: ${toArabicDigits(autoPending.length)} تكتمل تلقائياً بتقدّم المقرر، و${toArabicDigits(manualPending.length)} تحتاج رفعاً منك.`}
            </p>
          </div>
          <Button variant="primary" className="w-full mt-3.5" onClick={() => showToast("صُدِّر ملف الجودة بصيغة PDF")}>
            <Icon name="down" /> تصدير الملف كاملاً
          </Button>
        </Surface>

        {manualPending.length > 0 && (
          <Alert tone="amber" icon="clock" title="ما يحتاج يدك أنت">
            {manualPending.length === 1
              ? `العنصر الوحيد الذي يحتاج منك عملاً الآن: ${manualPending[0]?.t}. البقية تكتمل تلقائياً بتقدّم المقرر.`
              : `العناصر التي تحتاج رفعاً منك: ${manualPending.map((i) => i.t).join(" · ")}.`}
          </Alert>
        )}

        <Surface variant="card" pad className="mt-4">
          <SectionLabel>ماذا يحوي التصدير</SectionLabel>
          <div className="grid gap-2 text-xs">
            {EXPORT_CONTENTS.map((t) => (
              <div key={t} className="flex gap-2 items-center">
                <Icon name="chk" className="w-3.5 h-3.5 text-teal flex-none" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </Grid2>
  );
}
