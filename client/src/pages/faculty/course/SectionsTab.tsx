import { Grid2, SectionLabel, WorkHeader } from "../../../components/shared/Section.js";
import { Surface } from "../../../components/ui/Surface.js";
import { Button } from "../../../components/ui/Button.js";
import { Chip } from "../../../components/ui/Chip.js";
import { TableScroll, TdId, TdNum } from "../../../components/ui/TableScroll.js";
import { Icon } from "../../../icons/Icon.js";
import { useToast } from "../../../state/ToastContext.js";

const SECTIONS: [name: string, code: string, students: number, time: string, room: string, mode: string][] = [
  ["شعبة ١", "MIC231-A", 62, "الأحد والثلاثاء ٠٨:٠٠", "مبنى ٤ · ق ٢١٢", "حضوري"],
  ["شعبة ٢", "MIC231-B", 61, "الأحد والثلاثاء ١٠:٠٠", "مبنى ٤ · ق ٢١٤", "حضوري"],
  ["شعبة ٣", "MIC231-C", 61, "الاثنين والأربعاء ٠٩:٠٠", "مبنى ٤ · ق ٢٠٨", "حضوري"],
];

const IMPORT_PREVIEW: [label: string, value: number, tone: "teal" | "neutral" | "amber" | "crimson"][] = [
  ["سيُضاف", 18, "teal"],
  ["سيُحدَّث", 43, "neutral"],
  ["متعارض", 1, "amber"],
  ["مرفوض", 0, "crimson"],
];

const th = "text-start px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap";

/** الشعب والطلاب — منقولة من CT.sections (سطح عمل مسطّح) */
export function SectionsTab({ courseSecs, courseStudents }: { courseSecs: number; courseStudents: number }) {
  const { showToast } = useToast();

  return (
    <Grid2>
      <Surface variant="work" className="overflow-hidden">
        <WorkHeader
          title="الشعب"
          meta={`${courseSecs} شعب · ${courseStudents} طالباً`}
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
              {SECTIONS.map(([name, code, students, time, room, mode]) => (
                <tr key={code} className="hover:bg-[#F9FBF9]">
                  <td className="px-3 py-2 border-b border-line-2 font-medium whitespace-nowrap">{name}</td>
                  <TdId>{code}</TdId>
                  <TdNum>{students}</TdNum>
                  <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{time}</td>
                  <td className="px-3 py-2 border-b border-line-2 text-xs text-ink-2 whitespace-nowrap">{room}</td>
                  <td className="px-3 py-2 border-b border-line-2">
                    <Chip tone="neutral">{mode}</Chip>
                  </td>
                  <td className="px-3 py-2 border-b border-line-2 text-end">
                    <Button variant="text" size="sm" aria-label={`فتح ${name}`} onClick={() => showToast(`${name} — تفتح في المرحلة ٧`)}>
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
          <SectionLabel>آخر استيراد — تشغيل تجريبي</SectionLabel>
          <div className="grid gap-[7px] text-xs">
            {IMPORT_PREVIEW.map(([label, value, tone]) => (
              <div key={label} className="flex justify-between items-center">
                <span>{label}</span>
                <Chip tone={tone}>
                  <span className="num">{value}</span>
                </Chip>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-3 leading-[1.65]">
            إعادة استيراد نفس الملف تُحدِّث ولا تُكرِّر. الطالب الغائب عن الملف يُعلَّم «منسحب» بانتظار تأكيدك — ولا يُحذف.
          </p>
          <Button variant="primary" size="sm" className="w-full mt-3" onClick={() => showToast("فُتحت مراجعة الاستيراد")}>
            مراجعة الاستيراد وتأكيده
          </Button>
        </Surface>

        <Surface variant="card" pad>
          <SectionLabel>كود انضمام الطلاب</SectionLabel>
          <div className="text-center p-4 rounded-rmd bg-gradient-to-br from-mint to-white border border-teal/30">
            <div className="num text-[25px] font-semibold tracking-[.13em] text-deep">MIC231-A</div>
            <p className="text-[11px] text-ink-2 mt-1.5">يدخله الطالب مرة واحدة عند التسجيل</p>
          </div>
        </Surface>
      </div>
    </Grid2>
  );
}
