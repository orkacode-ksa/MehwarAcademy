import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { InstructorSlots } from "../../components/student/InstructorSlots.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Icon } from "../../icons/Icon.js";
import { OFFICE_BLOCKS, UPCOMING_DATES, slotsOf, type OfficeSlot } from "../../mock/office.js";
import { studentCourses } from "../../mock/student.js";
import { useToast } from "../../state/ToastContext.js";

interface Draft {
  blockId: string;
  time: string;
}

/**
 * حجز ساعة مكتبية.
 * الظاهر أولاً أسماء الأساتذة، وبفتح اسم الأستاذ تظهر كتله بيومها وتاريخها ووقتها
 * وفتراتها. البروتوتايب كان يفرش كل الشبكات مفتوحةً فيملأ الشاشة بجداول متشابهة،
 * ويرسم الفترات بلا تفاعل، ويعرض «موعداً مؤكّداً» بموضوع لم يُسأل عنه.
 */
export function StudentBookPage() {
  const { showToast } = useToast();
  const enrolled = studentCourses();
  const instructors = [...new Set(enrolled.map((c) => c.course.instructor))];
  const withHours = instructors.filter((name) => OFFICE_BLOCKS.some((b) => b.instructor === name));
  const silent = instructors.filter((name) => !withHours.includes(name));

  const [openName, setOpenName] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [topic, setTopic] = useState("");
  const [booked, setBooked] = useState<Record<string, string>>({});

  const statusOf = (slot: OfficeSlot): OfficeSlot["status"] => (booked[`${slot.blockId}|${slot.time}`] ? "موعدك" : slot.status);

  const mine = OFFICE_BLOCKS.flatMap((b) =>
    slotsOf(b.id)
      .filter((s) => statusOf(s) === "موعدك")
      .map((s) => ({ block: b, time: s.time, topic: booked[`${b.id}|${s.time}`] ?? s.topic ?? "" })),
  );

  function confirm() {
    if (!draft || topic.trim().length < 4) return;
    setBooked((b) => ({ ...b, [`${draft.blockId}|${draft.time}`]: topic.trim() }));
    showToast(`تأكّد حجزك ${draft.time} — أُخطر عضو هيئة التدريس بالموضوع`);
    setDraft(null);
    setTopic("");
  }

  return (
    <div>
      <PageHeader
        kicker="تنسيق مع أساتذتك"
        title="الساعات المكتبية"
        description="اختر عضو هيئة التدريس لعرض فتراته المتاحة — الفترة 15 دقيقة"
      />

      <Grid2>
        <div>
          {withHours.map((name) => (
            <InstructorSlots
              key={name}
              instructor={name}
              courses={enrolled.filter((c) => c.course.instructor === name).map((c) => c.course.name)}
              blocks={OFFICE_BLOCKS.filter((b) => b.instructor === name)}
              open={openName === name}
              onToggle={() => setOpenName((n) => (n === name ? null : name))}
              statusOf={statusOf}
              chosen={draft}
              onPick={(blockId, time) => setDraft({ blockId, time })}
            />
          ))}

          {silent.length > 0 && (
            <Surface variant="card" pad>
              <SectionLabel>لم تُعلن ساعاتهم بعد</SectionLabel>
              <p className="text-[12px] text-ink-2 leading-[1.7]">
                {silent.join(" · ")} — لا ساعات مكتبية معلنة حتى الآن. سيظهرون هنا فور إعلانها.
              </p>
            </Surface>
          )}
        </div>

        <div>
          {draft && (
            <Surface variant="card" pad className="mb-4 border-deep/30">
              <SectionLabel>إتمام الحجز</SectionLabel>
              <div className="text-[12.5px] text-ink-2 mb-3">
                {(() => {
                  const b = OFFICE_BLOCKS.find((x) => x.id === draft.blockId);
                  return b ? `${b.instructor} · ${b.day} ${UPCOMING_DATES[b.day] ?? ""} · ${draft.time} · ${b.place}` : draft.time;
                })()}
              </div>
              <label className="block text-[12px] text-ink-2 mb-1.5" htmlFor="topic">
                موضوع اللقاء
              </label>
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: استفسار عن منحنى النمو"
                className="w-full border border-line rounded-[11px] px-3.5 py-2.5 bg-white text-[13px]"
              />
              <p className="text-[11px] text-ink-3 mt-1.5">الموضوع يصل عضو هيئة التدريس قبل الموعد ليتهيّأ له.</p>
              <div className="flex gap-2 mt-3">
                <Button variant="primary" size="sm" className="flex-1" disabled={topic.trim().length < 4} onClick={confirm}>
                  <Icon name="chk" /> تأكيد الحجز
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDraft(null)}>
                  إلغاء
                </Button>
              </div>
            </Surface>
          )}

          <Surface variant="card" pad className="mb-4">
            <SectionLabel>مواعيدك المؤكّدة</SectionLabel>
            {mine.length === 0 ? (
              <p className="text-[12px] text-ink-2">لا مواعيد محجوزة. افتح اسم أستاذك واختر فترة متاحة.</p>
            ) : (
              mine.map(({ block, time, topic: t }) => (
                <div key={`${block.id}|${time}`} className="p-3.5 rounded-rmd bg-gradient-to-br from-mint to-white border border-teal/30 mb-2.5 last:mb-0">
                  <div className="text-[13px] font-semibold">{block.instructor}</div>
                  <div className="text-[12px] text-ink-2 mt-0.5">
                    {block.day} {UPCOMING_DATES[block.day] ?? ""} · <span dir="ltr" className="num">{time}</span> · {block.place}
                  </div>
                  {t && <div className="text-[12px] mt-2 pt-2 border-t border-teal/25">الموضوع: {t}</div>}
                </div>
              ))
            )}
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>قبل الحجز</SectionLabel>
            <div className="grid gap-2 text-[12px]">
              {["حدّد موضوع اللقاء ليتهيّأ له عضو هيئة التدريس", "تصلك تذكيرات قبل الموعد", "الإلغاء متاح حتى ساعتين قبل الموعد"].map((t) => (
                <div key={t} className="flex gap-2 items-start">
                  <Icon name="chk" className="w-3.5 h-3.5 text-teal flex-none mt-0.5" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
