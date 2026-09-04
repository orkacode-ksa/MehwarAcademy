import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Grid2, WorkHeader } from "../../components/shared/Section.js";
import { Surface } from "../../components/ui/Surface.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Alert } from "../../components/ui/Alert.js";
import { Stat } from "../../components/shared/Kpi.js";
import { TableScroll, TdId } from "../../components/ui/TableScroll.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

type Tone = "teal" | "amber" | "crimson" | "neutral";
const ROLL: [id: string, name: string, time: string, status: string, tone: Tone][] = [
  ["444101238", "عبدالرحمن سالم الزهراني", "08:02", "حاضر", "teal"],
  ["444101911", "نورة فيصل القحطاني", "08:01", "حاضر", "teal"],
  ["444102047", "محمد عبدالله الغامدي", "08:14", "متأخر", "amber"],
  ["444102155", "ريما ناصر الحربي", "08:00", "حاضر", "teal"],
  ["444102390", "سلطان أحمد العتيبي", "—", "غائب", "crimson"],
  ["444102418", "جواهر خالد الشهري", "08:03", "حاضر", "teal"],
  ["444102566", "فهد ماجد الدوسري", "—", "بعذر", "neutral"],
  ["444102703", "لمى سعد المالكي", "08:05", "حاضر", "teal"],
  ["444102874", "بدر عبدالعزيز السبيعي", "—", "غائب", "crimson"],
  ["444103012", "هيا مشعل الرشيدي", "08:02", "حاضر", "teal"],
  ["444103187", "طلال يوسف البقمي", "08:17", "متأخر", "amber"],
  ["444103264", "دانة تركي العنزي", "08:04", "حاضر", "teal"],
];

/** خلايا الرمز المرئي المعروض على شاشة القاعة (نمط ثابت، ليس رمزًا حقيقيًا) */
const QR_ON = new Set([
  0, 1, 2, 6, 7, 8, 9, 11, 15, 17, 18, 20, 22, 24, 26, 27, 29, 31, 33, 35, 36, 38, 40, 42, 44, 45, 47, 49, 51, 53, 54, 56, 58, 60, 62, 63, 65,
  67, 69, 71, 72, 73, 74, 78, 79, 80,
]);

const th = "px-3 py-2 text-[11px] font-semibold text-ink-2 bg-[#FAFCFA] border-b border-line whitespace-nowrap sticky top-0 z-[2]";

/** جلسة الحضور — رصد بثلاث طرق مع عمل دون اتصال. منقولة من V.attend */
export function AttendPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div>
      <PageHeader
        kicker="MIC 231 · شعبة ٢ · الأحد ٠٨:٠٠"
        title="جلسة الحضور"
        description="محاضرة ٠٩ — النمو البكتيري · ٦١ طالباً مسجّلاً"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/home")}>
              <Icon name="arr" /> رجوع
            </Button>
            <Button variant="primary" onClick={() => showToast("أُغلقت الجلسة وحُفظ الرصد")}>
              <Icon name="chk" /> أغلق الجلسة واحفظ
            </Button>
          </>
        }
      />

      <Grid2>
        <div>
          <Surface variant="card" pad="24" className="text-center mb-4 bg-gradient-to-br from-sky to-white">
            <div className="text-xs text-ink-2 mb-3.5">يُعرض هذا الرمز على شاشة القاعة، ويمسحه الطلاب بأجهزتهم</div>
            <div
              className="mx-auto bg-white rounded-[20px] border border-line shadow-s2 grid"
              style={{ width: "min(190px,64vw)", aspectRatio: "1", gridTemplateColumns: "repeat(9,1fr)", gap: "2.4%", padding: "6%" }}
              role="img"
              aria-label="رمز الحضور المرئي"
            >
              {Array.from({ length: 81 }, (_, i) => (
                <div key={i} className="rounded-[2px]" style={{ background: QR_ON.has(i) ? "var(--deep)" : "transparent" }} />
              ))}
            </div>
            <div className="mt-4">
              <div className="text-xs text-ink-3">أو يُملى هذا الرمز الرقمي</div>
              <div className="num font-semibold tracking-[.12em] text-deep mt-1 whitespace-nowrap" style={{ fontSize: "clamp(22px,7vw,34px)" }}>
                4 7 2 9 1 6
              </div>
              <div className="text-[11px] text-ink-3 mt-1.5">يتغيّر كل ٣٠ ثانية · ينتهي بعد ١٠ دقائق</div>
            </div>
          </Surface>

          <Alert tone="teal" icon="check" title="يعمل في قاعة بلا تغطية">
            إن انقطعت الشبكة يُرصد الحضور محلياً على جهازك ويُزامَن تلقائياً عند عودتها. ولا تُفقد أي جلسة.
          </Alert>
        </div>

        <Surface variant="work" className="overflow-hidden">
          <WorkHeader
            title="الرصد المباشر"
            meta="٤٧ حضروا من ٦١"
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={() => showToast("عُلِّم الجميع حاضرين")}>
                  تعليم الجميع حاضرين
                </Button>
                <Button variant="secondary" size="sm" onClick={() => showToast("استيراد كشف حضور")}>
                  <Icon name="up" /> استيراد كشف
                </Button>
              </>
            }
          />
          <div className="flex flex-nowrap overflow-x-auto border-b border-line [scrollbar-width:none]">
            <Stat value={47} label="حاضر" color="var(--teal)" />
            <Stat value={3} label="متأخر" color="var(--amber)" />
            <Stat value={9} label="غائب" color="var(--crim)" />
            <Stat value={2} label="بعذر" color="var(--ink2)" />
          </div>
          <TableScroll minWidth={560} maxHeight={400}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={`${th} text-start w-[96px]`}>الرقم</th>
                  <th className={`${th} text-start`}>الاسم</th>
                  <th className={`${th} text-center`}>وقت المسح</th>
                  <th className={`${th} text-center`}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {ROLL.map(([id, name, time, status, tone]) => (
                  <tr key={id} className="hover:bg-[#F9FBF9]">
                    <TdId>{id}</TdId>
                    <td className="px-3 py-2 border-b border-line-2 whitespace-nowrap">{name}</td>
                    <td className="px-3 py-2 border-b border-line-2 text-center font-mono text-xs text-ink-2 tabular-nums">{time}</td>
                    <td className="px-3 py-2 border-b border-line-2 text-center">
                      <Chip tone={tone}>{status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Surface>
      </Grid2>
    </div>
  );
}
