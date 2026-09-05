import { useState } from "react";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { OFFICE_BLOCKS, slotsOf, type OfficeSlot } from "../../mock/office.js";
import { studentCourses } from "../../mock/student.js";
import { useToast } from "../../state/ToastContext.js";

interface Draft {
  blockId: string;
  time: string;
}

/**
 * حجز ساعة مكتبية.
 * البروتوتايب كان يرسم شبكة الفترات بلا أي تفاعل، ويعرض «الموعد المؤكّد» بموضوع
 * لم يُسأل عنه أحد. هنا الحجز خطوتان فعليتان: اختيار فترة ثم كتابة الموضوع —
 * والموضوع شرط لأن أستاذك يتهيّأ له، وهو ما تقوله الشاشة نفسها.
 */
export function StudentBookPage() {
  const { showToast } = useToast();
  const instructors = [...new Set(studentCourses().map((c) => c.course.instructor))];
  const blocks = OFFICE_BLOCKS.filter((b) => instructors.includes(b.instructor));
  const silent = instructors.filter((name) => !blocks.some((b) => b.instructor === name));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [topic, setTopic] = useState("");
  const [booked, setBooked] = useState<Record<string, string>>({});

  const mine = OFFICE_BLOCKS.flatMap((b) =>
    slotsOf(b.id)
      .filter((s) => s.status === "موعدك")
      .map((s) => ({ block: b, slot: s })),
  );

  function statusOf(slot: OfficeSlot): OfficeSlot["status"] {
    return booked[`${slot.blockId}-${slot.time}`] ? "موعدك" : slot.status;
  }

  function confirm() {
    if (!draft || topic.trim().length < 4) return;
    setBooked((b) => ({ ...b, [`${draft.blockId}-${draft.time}`]: topic.trim() }));
    showToast(`تأكّد حجزك ${draft.time} — أُخطر عضو هيئة التدريس بالموضوع`);
    setDraft(null);
    setTopic("");
  }

  return (
    <div>
      <PageHeader kicker="تنسيق مع أساتذتك" title="الساعات المكتبية" description="اختر فترة متاحة ثم اكتب موضوع اللقاء — الفترة 15 دقيقة" />

      <Grid2>
        <div>
          {blocks.map((b) => (
            <Surface key={b.id} variant="card" className="overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
                <b className="text-[13px]">
                  {b.instructor} — {b.day} {b.from} إلى {b.to}
                </b>
                <Chip tone={b.mode === "أونلاين" ? "neutral" : "teal"}>{b.place}</Chip>
              </div>
              <div className="p-4 grid grid-cols-2 min-[560px]:grid-cols-4 gap-2.5">
                {slotsOf(b.id).map((s) => {
                  const status = statusOf(s);
                  const free = status === "متاح";
                  const chosen = draft?.blockId === b.id && draft.time === s.time;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!free}
                      onClick={() => setDraft({ blockId: b.id, time: s.time })}
                      className={`p-3 rounded-xl text-center border transition-colors ${
                        status === "موعدك"
                          ? "border-teal bg-gradient-to-br from-mint to-white"
                          : chosen
                            ? "border-deep bg-deep text-white"
                            : free
                              ? "border-line bg-white hover:border-[#C6D3CB]"
                              : "border-line bg-[#F7F9FB] opacity-55 cursor-not-allowed"
                      }`}
                    >
                      <div className="num text-[13px] font-semibold">{s.time}</div>
                      <div className={`text-[11px] mt-0.5 ${status === "موعدك" ? "text-teal font-semibold" : chosen ? "" : "text-ink-3"}`}>
                        {chosen ? "المختارة" : status}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Surface>
          ))}
        </div>

        <div>
          {draft && (
            <Surface variant="card" pad className="mb-4 border-deep/30">
              <SectionLabel>إتمام الحجز — {draft.time}</SectionLabel>
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
            {mine.length === 0 && Object.keys(booked).length === 0 ? (
              <p className="text-[12px] text-ink-2">لا مواعيد محجوزة. اختر فترة متاحة من القائمة.</p>
            ) : (
              <>
                {mine.map(({ block, slot }) => (
                  <BookingCard key={slot.time} title={block.instructor} meta={`${block.day} ${slot.time} · ${block.place}`} topic={slot.topic ?? ""} />
                ))}
                {Object.entries(booked).map(([key, t]) => {
                  const [blockId, time] = key.split(/-(?=[^-]*$)/);
                  const block = OFFICE_BLOCKS.find((b) => b.id === blockId);
                  return block ? <BookingCard key={key} title={block.instructor} meta={`${block.day} ${time} · ${block.place}`} topic={t} /> : null;
                })}
              </>
            )}
          </Surface>

          {silent.length > 0 && (
            <Surface variant="card" pad className="mb-4">
              <SectionLabel>لم تُعلن ساعاتهم بعد</SectionLabel>
              <p className="text-[12px] text-ink-2 leading-[1.7]">
                {silent.join(" · ")} — لا ساعات مكتبية معلنة حتى الآن. سيظهرون هنا فور إعلانها.
              </p>
            </Surface>
          )}

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

function BookingCard({ title, meta, topic }: { title: string; meta: string; topic: string }) {
  return (
    <div className="p-3.5 rounded-rmd bg-gradient-to-br from-mint to-white border border-teal/30 mb-2.5 last:mb-0">
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="text-[12px] text-ink-2 mt-0.5">{meta}</div>
      {topic && <div className="text-[12px] mt-2 pt-2 border-t border-teal/25">الموضوع: {topic}</div>}
    </div>
  );
}
