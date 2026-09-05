import { Grid2, SectionLabel } from "../../../components/shared/Section.js";
import { LRow } from "../../../components/shared/LRow.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Icon } from "../../../icons/Icon.js";
import { lecturesFor } from "../../../mock/courseData.js";
import type { StudentCourse } from "../../../mock/student.js";
import { useToast } from "../../../state/ToastContext.js";
import { formatNum } from "../../../lib/numerals.js";

const ASSET_LABELS = ["نص", "عرض", "فيديو", "بودكاست"];

/** محاضرات المقرر بأشكالها الأربعة — الطالب يختار الصيغة التي تناسبه */
export function StudentLecturesTab({ item }: { item: StudentCourse }) {
  const { showToast } = useToast();
  const lectures = lecturesFor(item.course);

  return (
    <Grid2>
      <Surface variant="card" className="overflow-hidden">
        <div className="px-4 sm:px-[18px] py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <b className="text-[13px]">المحاضرات</b>
          <span className="text-[11.5px] text-ink-3">لكل محاضرة أربعة أشكال — اختر ما يناسبك</span>
        </div>
        {lectures.map((l, i) => {
          const ready = l.status !== "لم تبدأ";
          const watched = ready && i < item.watched;
          const forms = ASSET_LABELS.filter((_, k) => l.assets[k]).join(" · ");
          return (
            <LRow
              key={l.n}
              tone={watched ? "ok" : ready ? "no" : "na"}
              label={l.n}
              title={l.title}
              subtitle={ready ? forms : "تُنشر لاحقاً"}
              action={
                <div className="flex items-center gap-2 flex-none">
                  <Chip tone={watched ? "teal" : ready ? "amber" : "neutral"}>{watched ? "مشاهَدة" : ready ? "جديدة" : "قادمة"}</Chip>
                  {ready ? (
                    <Button variant="primary" size="sm" onClick={() => showToast(`فتح ${l.title}`)}>
                      <Icon name="play" /> فتح
                    </Button>
                  ) : (
                    <Icon name="lock" className="w-4 h-4 text-ink-3" />
                  )}
                </div>
              }
            />
          );
        })}
      </Surface>

      <div>
        <Surface variant="card" className="overflow-hidden mb-4">
          <div className="px-3.5 py-2.5 bg-[#FAFCFA] border-b border-line text-[11.5px] font-semibold flex justify-between items-center">
            <span>آخر محاضرة منشورة</span>
            <span className="num text-[11px] text-ink-3">19:42</span>
          </div>
          <div className="aspect-video grid place-items-center relative" style={{ background: "linear-gradient(150deg,var(--deep2),var(--teal))" }}>
            <div className="w-[54px] h-[54px] rounded-full bg-white/25 backdrop-blur grid place-items-center text-white">
              <Icon name="play" className="w-6 h-6" />
            </div>
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/25">
              <div className="h-full bg-white" style={{ width: "34%" }} />
            </div>
          </div>
          <div className="px-3.5 py-3 text-[11px] text-ink-2">شرائح متحركة بسرد عربي وترجمة نصية · آخر موضع مشاهدة: الدقيقة 6:34</div>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel icon="down">تنزيل للمراجعة دون اتصال</SectionLabel>
          <div className="grid gap-2">
            {[
              ["العرض التقديمي", "24 شريحة · 4٫2 ميجا"],
              ["ملخص المحاضرة", "6 صفحات · 800 كيلو"],
              ["الفيديو", "19:42 · 240 ميجا"],
            ].map(([t, s]) => (
              <div key={t} className="flex items-center gap-2.5">
                <span className="w-[26px] h-[26px] rounded-[8px] grid place-items-center flex-none bg-deep/[.06] text-ink-3">
                  <Icon name="down" className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-medium">{t}</span>
                  <span className="block text-[11px] text-ink-3">{s}</span>
                </span>
                <Button variant="text" size="sm" aria-label={`تنزيل ${t}`} onClick={() => showToast(`جارٍ تنزيل ${t}`)}>
                  <Icon name="down" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
            ما يُنزَّل يبقى متاحاً دون اتصال. المنشور من {formatNum(item.published)} محاضرة يظهر هنا أولاً بأول.
          </p>
        </Surface>
      </div>
    </Grid2>
  );
}
