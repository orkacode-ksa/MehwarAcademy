import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { CourseRing } from "../../../components/shared/CourseRing.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Alert } from "../../../components/ui/Alert.js";
import { Icon } from "../../../icons/Icon.js";
import { QUALITY } from "../../../mock/faculty.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";

const EXPORT_CONTENTS = [
  "غلاف بهوية الجامعة والقسم",
  "فهرس مرقّم بالعناصر الأحد عشر",
  "كل عنصر في قسم مستقل",
  "ترقيم صفحات وتذييل",
  "تاريخ هجري وميلادي",
];

/** ملف الجودة: أحد عشر عنصراً، ثمانية منها تُبنى تلقائياً — منقول من CT.quality */
export function QualityTab({ course }: { course: MockCourse }) {
  const { showToast } = useToast();
  const items = QUALITY.flatMap((g) => g.items);
  const done = items.filter((i) => i.ok).length;
  const missing = items.length - done;

  return (
    <Grid2>
      <Surface variant="card" className="overflow-hidden">
        {QUALITY.map((group) => (
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
                ) : (
                  <Button variant="primary" size="sm" className="flex-none" onClick={() => showToast(`استكمال: ${item.t}`)}>
                    استكمال العنصر ←
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
            <CourseRing syllabus={done / 11} quality={done} assessments={course.as} size={132} />
          </div>
          <div className="mt-3.5">
            <div className="text-[13px] font-semibold">{done} من ١١ عنصراً</div>
            <p className="text-xs text-ink-2 mt-1.5 leading-[1.65]">
              ينقصك {missing} عناصر. اثنان منها يكتملان تلقائياً بعد رصد النهائي.
            </p>
          </div>
          <Button variant="primary" className="w-full mt-3.5" onClick={() => showToast("صُدِّر ملف الجودة بصيغة PDF")}>
            <Icon name="down" /> تصدير الملف كاملاً
          </Button>
        </Surface>

        <Alert tone="amber" icon="clock" title="تنبيه استباقي">
          باقٍ ١٧ يوماً على نهاية الفصل. العنصر الوحيد الذي يحتاج فعلاً منك الآن: رفع نتائج تقييم الطلبة.
        </Alert>

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
