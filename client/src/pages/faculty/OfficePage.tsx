import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { TableScroll, TdId } from "../../components/ui/TableScroll.js";
import { Icon } from "../../icons/Icon.js";
import { useState } from "react";
import { useToast } from "../../state/ToastContext.js";
import { toArabicDigits } from "../../lib/numerals.js";

type Tone = "teal" | "amber" | "neutral";
const SLOTS: [day: string, time: string, student: string, course: string, topic: string, status: string, tone: Tone][] = [
  ["الأحد", "١٠:٠٠", "ريما ناصر الحربي", "MIC 231", "استفسار عن منحنى النمو", "مؤكّد", "teal"],
  ["الأحد", "١٠:١٥", "خالد إبراهيم الأحمدي", "MIC 231", "مراجعة درجة النصفي", "مؤكّد", "teal"],
  ["الأحد", "١٠:٣٠", "—", "—", "—", "متاح", "neutral"],
  ["الثلاثاء", "١١:٠٠", "هيا مشعل الرشيدي", "MIC 342", "مقترح البحث", "مؤكّد", "teal"],
  ["الثلاثاء", "١١:١٥", "ماجد سعود الخالدي", "MIC 231", "صعوبة في المعمل", "بانتظار قبولك", "amber"],
  ["الثلاثاء", "١١:٣٠", "—", "—", "—", "متاح", "neutral"],
];

const BLOCKS: [day: string, time: string, place: string][] = [
  ["الأحد", "١٠:٠٠ – ١١:٠٠", "مكتب ٣٠٤ · حضوري"],
  ["الثلاثاء", "١١:٠٠ – ١٢:٠٠", "مكتب ٣٠٤ · حضوري"],
  ["الأربعاء", "١٣:٠٠ – ١٥:٠٠", "أونلاين"],
];

const TOPICS: [string, number][] = [
  ["مراجعة الدرجات", 9],
  ["صعوبات المعمل", 6],
  ["مقترحات البحوث", 4],
];

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap text-start";

/** الساعات المكتبية — منقولة من V.office */
export function OfficePage() {
  const { showToast } = useToast();
  // طلبات الحجز كانت تُعرض بحالة «بانتظار قبولك» بلا أي زر للقبول أو الاعتذار —
  // انتظارٌ معلّق لا مخرج منه. الآن لكل طلب قرار.
  const [decided, setDecided] = useState<Record<string, "accepted" | "declined">>({});
  const totalSlots = 16;
  const booked = SLOTS.filter((r) => r[5] !== "متاح").length;
  const weekly = Math.round((booked / totalSlots) * 100);

  return (
    <div>
      <PageHeader
        kicker="تنسيق المواعيد مع الطلاب"
        title="الساعات المكتبية"
        description={`٤ ساعات أسبوعياً · فترات ١٥ دقيقة · محجوز ${toArabicDigits(booked)} من ${toArabicDigits(totalSlots)} (${toArabicDigits(weekly)}٪)`}
        actions={
          <>
            <Button variant="secondary" onClick={() => showToast("صُدِّر ملف التقويم")}>
              <Icon name="down" /> ملف تقويم
            </Button>
            <Button variant="primary" onClick={() => showToast("أُضيفت كتلة أسبوعية")}>
              <Icon name="plus" /> كتلة أسبوعية
            </Button>
          </>
        }
      />

      <Grid2>
        <Surface variant="work" className="overflow-hidden">
          <WorkHeader title="مواعيد هذا الأسبوع" actions={<Chip tone="teal">{toArabicDigits(booked)} محجوزة من {toArabicDigits(totalSlots)}</Chip>} />
          <TableScroll minWidth={760}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {["اليوم", "الوقت", "الطالب", "المقرر", "الموضوع", "الحالة"].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(([day, time, student, course, topic, status, tone], i) => (
                  <tr key={i} className="hover:bg-[#F9FBF9]">
                    <td className="px-3 py-2 border-b border-line-2 whitespace-nowrap">{day}</td>
                    <td className="px-3 py-2 border-b border-line-2 font-mono text-xs tabular-nums">{time}</td>
                    <td className="px-3 py-2 border-b border-line-2 whitespace-nowrap">{student}</td>
                    <TdId>{course}</TdId>
                    <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2">{topic}</td>
                    <td className="px-3 py-2 border-b border-line-2">
                      {status === "بانتظار قبولك" && !decided[student] ? (
                        <div className="flex gap-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setDecided((d) => ({ ...d, [student]: "accepted" }));
                              showToast(`قُبل موعد ${student}`);
                            }}
                          >
                            اقبل
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setDecided((d) => ({ ...d, [student]: "declined" }));
                              showToast(`اعتُذر عن موعد ${student} — يُخطر الطالب باقتراح بديل`);
                            }}
                          >
                            اعتذر
                          </Button>
                        </div>
                      ) : (
                        <Chip tone={decided[student] === "declined" ? "crimson" : decided[student] === "accepted" ? "teal" : tone}>
                          {decided[student] === "declined" ? "معتذَر عنه" : decided[student] === "accepted" ? "مؤكّد" : status}
                        </Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>الكتل الأسبوعية</SectionLabel>
            {BLOCKS.map(([day, time, place], i) => (
              <div key={day} className={`flex justify-between py-2.5 ${i < BLOCKS.length - 1 ? "border-b border-line-2" : ""}`}>
                <div>
                  <div className="text-[13px] font-medium">{day}</div>
                  <div className="text-[11px] text-ink-3">{place}</div>
                </div>
                <span className="num text-xs text-ink-2">{time}</span>
              </div>
            ))}
          </Surface>

          <Alert tone="teal" icon="check" title="مربوط بمؤشر الالتزام">
            حضورك للساعات المكتبية يُرصد تلقائياً ويغذّي المؤشر وملف الجودة.
          </Alert>

          <Surface variant="card" pad className="mt-4">
            <SectionLabel>أكثر المواضيع طلباً</SectionLabel>
            {TOPICS.map(([t, n]) => (
              <div key={t} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span>{t}</span>
                  <b className="num">{n}</b>
                </div>
                <Bar value={(n / 9) * 100} height={4} />
              </div>
            ))}
            <p className="text-[11px] text-ink-3 mt-2.5">مادة جاهزة لقسم «التحديات» في تقرير المقرر.</p>
          </Surface>
        </div>
      </Grid2>
    </div>
  );
}
