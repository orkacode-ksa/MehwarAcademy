import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, SectionLabel, WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Bar } from "../../components/ui/Bar.js";
import { DataTable } from "../../components/shared/DataTable.js";
import { Icon } from "../../icons/Icon.js";
import { useState } from "react";
import { OFFICE_BLOCKS, OFFICE_SLOTS, blocksOf } from "../../mock/office.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";

const FACULTY = "د. عبدالله الغامدي";
const TOPICS: [string, number][] = [
  ["مراجعة الدرجات", 9],
  ["صعوبات المعمل", 6],
  ["مقترحات البحوث", 4],
];

/** الساعات المكتبية — منقولة من V.office */
export function OfficePage() {
  const { showToast } = useToast();
  // طلبات الحجز كانت تُعرض بحالة «بانتظار قبولك» بلا أي زر للقبول أو الاعتذار —
  // انتظارٌ معلّق لا مخرج منه. الآن لكل طلب قرار.
  const [decided, setDecided] = useState<Record<string, "accepted" | "declined">>({});
  const blocks = blocksOf(FACULTY);
  const slots = OFFICE_SLOTS.filter((sl) => blocks.some((b) => b.id === sl.blockId));
  const totalSlots = slots.length;
  const booked = slots.filter((sl) => sl.status !== "متاح").length;
  const weekly = Math.round((booked / totalSlots) * 100);
  const dayOf = (blockId: string) => OFFICE_BLOCKS.find((b) => b.id === blockId)?.day ?? "";

  function statusCell(slot: (typeof slots)[number]) {
    const key = slot.student ?? slot.time;
    const decision = decided[key];
    if (slot.status === "بانتظار القبول" && !decision) {
      return (
        <div className="flex gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setDecided((d) => ({ ...d, [key]: "accepted" }));
              showToast(`قُبل موعد ${slot.student}`);
            }}
          >
            اقبل
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDecided((d) => ({ ...d, [key]: "declined" }));
              showToast(`اعتُذر عن موعد ${slot.student} — يُخطر الطالب باقتراح بديل`);
            }}
          >
            اعتذر
          </Button>
        </div>
      );
    }
    const label = decision === "declined" ? "معتذَر عنه" : decision === "accepted" ? "مؤكّد" : slot.status === "موعدك" ? "مؤكّد" : slot.status;
    const tone = decision === "declined" ? "crimson" : label === "مؤكّد" ? "teal" : label === "متاح" ? "neutral" : "amber";
    return <Chip tone={tone}>{label}</Chip>;
  }

  return (
    <div>
      <PageHeader
        kicker="تنسيق المواعيد مع الطلاب"
        title="الساعات المكتبية"
        description={`${formatNum(blocks.length)} كتل أسبوعية · فترات 15 دقيقة · محجوز ${formatNum(booked)} من ${formatNum(totalSlots)} (${formatNum(weekly)}٪)`}
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
          <WorkHeader title="مواعيد هذا الأسبوع" actions={<Chip tone="teal">{formatNum(booked)} محجوزة من {formatNum(totalSlots)}</Chip>} />
          <DataTable
            rows={slots}
            rowKey={(sl) => `${sl.blockId}-${sl.time}`}
            minWidth={760}
            empty="لا فترات هذا الأسبوع."
            columns={[
              { key: "day", header: "اليوم", cell: (sl) => dayOf(sl.blockId), card: "subtitle" },
              { key: "time", header: "الوقت", mono: true, cell: (sl) => sl.time, card: "field" },
              { key: "student", header: "الطالب", cell: (sl) => sl.student ?? "—", card: "title" },
              { key: "course", header: "المقرر", mono: true, cell: (sl) => sl.courseCode ?? "—", card: "field" },
              { key: "topic", header: "الموضوع", cell: (sl) => <span className="text-xs text-ink-2">{sl.topic ?? "—"}</span>, card: "field" },
              { key: "status", header: "الحالة", cell: (sl) => statusCell(sl), card: "badge" },
            ]}
          />
        </Surface>

        <div>
          <Surface variant="card" pad className="mb-4">
            <SectionLabel>الكتل الأسبوعية</SectionLabel>
            {blocks.map((b, i) => (
              <div key={b.id} className={`flex justify-between py-2.5 ${i < blocks.length - 1 ? "border-b border-line-2" : ""}`}>
                <div>
                  <div className="text-[13px] font-medium">{b.day}</div>
                  <div className="text-[11px] text-ink-3">
                    {b.place} · {b.mode}
                  </div>
                </div>
                <span dir="ltr" className="num text-xs text-ink-2">{`${b.from} – ${b.to}`}</span>
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
