import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Grid2, SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { Bar } from "../../../components/ui/Bar.js";
import { Toggle } from "../../../components/ui/Toggle.js";
import { TableScroll, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { examsFor } from "../../../mock/courseData.js";
import type { MockCourse } from "../../../mock/courses.js";
import { useToast } from "../../../state/ToastContext.js";

const CRITERIA: [string, number, "teal" | "amber"][] = [
  ["تغطية مخرجات التعلم", 92, "teal"],
  ["توازن الصعوبة", 71, "amber"],
  ["مطابقة المواضيع", 85, "teal"],
  ["تنوّع الأسئلة", 64, "amber"],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/**
 * الاختبارات + نافذة المراجعة + الورقة الجاهزة للطباعة.
 * أُضيفت هنا نافذة مراجعة الإجابات لأن تنبيه البند ACD-12 كان يَعِد المستخدم بفتحها
 * ثم يُنزله في شاشة لا تحوي أي أداة لفتحها — وعدٌ بلا وجهة.
 */
export function ExamsTab({ course }: { course: MockCourse }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const exams = examsFor(course);
  const recorded = exams.filter((e) => e.status === "مرصود");
  const [reviewOpen, setReviewOpen] = useState(false);
  const focusReview = params.get("focus") === "review";
  const needsReview = recorded.some((e) => e.kind === "نصفي" || e.kind === "نهائي");

  return (
    <div>
      <div className="grid grid-cols-2 min-[900px]:grid-cols-4 gap-3.5 mb-4">
        {[
          ["اختبارات مرصودة", recorded.length],
          ["قيد الإعداد", exams.filter((e) => e.status === "مسوّدة").length],
          ["مفتوحة الآن", exams.filter((e) => e.status === "مفتوح الآن").length],
          ["لم تُنشأ بعد", exams.filter((e) => e.status === "لم يُنشأ").length],
        ].map(([label, n]) => (
          <Surface key={String(label)} variant="card" pad className="text-center">
            <div className="num text-[26px] font-semibold text-deep">{n as number}</div>
            <div className="text-xs text-ink-2 mt-1">{label}</div>
          </Surface>
        ))}
      </div>

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader
            title="الاختبارات"
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate("/bank")}>
                  <Icon name="box" /> من بنك المقرر
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate(`/exambuild?course=${course.id}`)}>
                  <Icon name="plus" /> اختبار
                </Button>
              </>
            }
          />
          <TableScroll minWidth={780}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start`}>الاختبار</th>
                  <th className={`${th} text-start`}>النوع</th>
                  <th className={`${th} text-start`}>التسليم</th>
                  <th className={`${th} text-center`}>الدرجة</th>
                  <th className={`${th} text-center`}>أسئلة</th>
                  <th className={`${th} text-start`}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F9FBF9]">
                    <td className="px-3 py-2 border-b border-line-2">{e.title}</td>
                    <td className="px-3 py-2 border-b border-line-2">
                      <Chip tone="neutral">{e.kind}</Chip>
                    </td>
                    <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{e.delivery}</td>
                    <TdNum>{e.grade}</TdNum>
                    <TdNum className="text-xs">{e.questions || "—"}</TdNum>
                    <td className="px-3 py-2 border-b border-line-2">
                      <div className="flex items-center gap-2">
                        <Chip tone={e.tone}>{e.status}</Chip>
                        {e.status === "لم يُنشأ" && (
                          <Button variant="text" size="sm" onClick={() => navigate(`/exambuild?course=${course.id}&exam=${e.id}`)}>
                            ابدأ ←
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>

        <div>
          <Surface
            variant="card"
            pad
            className={`mb-4 ${focusReview ? "ring-2 ring-gold2/60" : ""}`}
          >
            <SectionLabel icon="shield">نافذة مراجعة الإجابات</SectionLabel>
            {needsReview ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{reviewOpen ? "مفتوحة للطلاب" : "لم تُفتح بعد"}</div>
                    <div className="text-[11px] text-ink-3 mt-px">
                      {reviewOpen ? "يستطيع الطالب رؤية ورقته وملاحظاتك خلال 72 ساعة" : "البند ACD-12 يوجب إتاحتها خلال أسبوع من الرصد"}
                    </div>
                  </div>
                  <Toggle
                    label="نافذة مراجعة الإجابات"
                    checked={reviewOpen}
                    onChange={(next) => {
                      setReviewOpen(next);
                      showToast(next ? "فُتحت نافذة المراجعة للطلاب 72 ساعة" : "أُغلقت نافذة المراجعة");
                    }}
                  />
                </div>
                <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
                  تُفتح لآخر اختبار مرصود: {recorded[recorded.length - 1]?.title ?? "—"}. لا يرى الطالب درجات زملائه ولا يستطيع التعديل — عرضٌ
                  للورقة وطلب مراجعة فقط.
                </p>
              </>
            ) : (
              <p className="text-[11.5px] text-ink-2 leading-[1.7]">
                لا اختبار مرصوداً بعد في هذا المقرر. تُفتح نافذة المراجعة تلقائياً بعد أول رصد.
              </p>
            )}
          </Surface>

          <Surface variant="card" className="overflow-hidden mb-4">
            <WorkHeader
              title="ورقة جاهزة للطباعة"
              actions={
                <Button variant="secondary" size="sm" onClick={() => showToast("صُدِّرت ورقة الاختبار بصيغة PDF")}>
                  <Icon name="down" /> PDF
                </Button>
              }
            />
            <div className="p-[18px]">
              <div className="border border-line rounded-rsm p-4 bg-[#FCFDFC]">
                <div className="text-center border-b border-line pb-2.5 mb-3">
                  <div className="font-amiri font-bold text-[19px]">جامعة أم القرى</div>
                  <div className="text-[11px] text-ink-2">كلية العلوم التطبيقية · قسم الأحياء الدقيقة</div>
                  <div className="text-xs font-semibold mt-2">الاختبار النصفي — {course.code}</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10.5px] text-ink-2">
                  <span>الاسم: ..................</span>
                  <span>الرقم: ..................</span>
                  <span>الشعبة: 1</span>
                  <span>المدة: 60 دقيقة</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-dashed border-line text-[10.5px] text-ink-3 leading-[1.9]">
                  س1 (5 درجات) — {course.topics[0] ? `عرّف ${course.topics[0]} واذكر عناصره الأساسية.` : "—"}
                  <br />
                  <span className="opacity-50">صفحة 1 من 6</span>
                </div>
              </div>
              <p className="text-[11px] text-ink-3 mt-3 leading-[1.7]">
                ترويسة الجامعة، وتوزيع الدرجات بجانب كل سؤال، وترقيم الصفحات، ونسخ متعددة بترتيب مختلف — بلا تدخل في وورد.
              </p>
            </div>
          </Surface>

          <Surface variant="card" pad>
            <SectionLabel>تحليل استيفاء المعايير</SectionLabel>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="num text-[31px] font-semibold text-teal">
                {Math.round(CRITERIA.reduce((s, [, v]) => s + v, 0) / CRITERIA.length)}
              </span>
              <span className="text-xs text-ink-2">من 100</span>
            </div>
            {CRITERIA.map(([t, v, tone]) => (
              <div key={t} className="mb-2">
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span>{t}</span>
                  <b className={`num ${tone === "teal" ? "text-teal" : "text-amber"}`}>{v}%</b>
                </div>
                <Bar value={v} height={4} />
              </div>
            ))}
            <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
              التحليل يخصّ آخر اختبار مبني في {course.code}. رفع تنوّع الأسئلة أعلى بند يرفع النتيجة.
            </p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
