import { useRef, useState } from "react";
import { SUBMISSION_KINDS, SUBMISSION_STATUS_LABEL, type SubmissionKind } from "@mihwar/shared";
import { api, ApiError, uploadRaw } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, IconButton, Input } from "../../components/ui/Form.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";

interface Mine {
  name: string;
  listed: boolean;
  hasFacultyViolations: boolean;
  submissions: { id: string; kind: SubmissionKind; title: string; note: string; status: keyof typeof SUBMISSION_STATUS_LABEL; createdAt: string }[];
}

/**
 * جامعتي — يرفع الأستاذ لوائح جامعته (هيكل ملف المقرر · لائحة الدراسة · مخالفات أعضاء هيئة
 * التدريس) مرة، فتعتمدها المنصة له ولكل زملائه. لكل نوع زرّ رفع واحد، وحالة كل ملف أمامه.
 */
export function UniversityPage() {
  const { data, loading, error, reload } = useApi<Mine>("/university/me");
  if (loading) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (error || !data) return <PageHeader title="جامعتي" description={error ?? ""} />;
  return (
    <>
      <PageHeader
        kicker="حسابي"
        title="جامعتي ولوائحها"
        description={
          data.listed
            ? `${data.name} — لوائحها معتمدة في المنصة. إن تغيّرت لائحة أو نقص نموذج، ارفعه هنا.`
            : `${data.name} — جديدة علينا. ارفع لوائحها فنعتمدها لك ولزملائك، وحتى ذلك تعمل بلائحة عامة.`
        }
      />
      <div className="grid gap-3 [&>*]:min-w-0">
        {(Object.keys(SUBMISSION_KINDS) as SubmissionKind[]).map((k) => (
          <KindCard key={k} kind={k} items={data.submissions.filter((s) => s.kind === k)} onChanged={reload} />
        ))}
      </div>
    </>
  );
}

const HINT: Record<SubmissionKind, string> = {
  COURSE_FILE: "قائمة عناصر ملف المقرر التي تطلبها وحدة الجودة في كليتك، ونماذجها إن وُجدت.",
  REGULATION: "لائحة الدراسة والاختبارات: نسب الحرمان وسلّم التقديرات وتوزيع الدرجات.",
  FACULTY_VIOLATIONS: "لائحة مخالفات أعضاء هيئة التدريس — منها يُبنى «التزامي» الذي تراه في صفحة الأداء.",
  OTHER: "أي نموذج معتمد آخر (تقرير المقرر · تقرير القسم …).",
};

function KindCard({ kind, items, onChanged }: { kind: SubmissionKind; items: Mine["submissions"]; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function upload(file: File) {
    setBusy(true);
    try {
      await uploadRaw(`/university/me/submissions?kind=${kind}`, file, note.trim() ? { "X-Note": note.trim() } : {});
      setNote("");
      showToast("وصل — سنراجعه ونعتمده");
      onChanged();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "تعذّر الرفع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={SUBMISSION_KINDS[kind]} hint={HINT[kind]}>
      {items.length > 0 && (
        <ul className="grid gap-1.5 mb-3">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[13px]">
              <Icon name="file" className="w-4 h-4 text-ink-3 flex-none" />
              <span className="flex-1 min-w-0 truncate">{s.title}</span>
              <Chip tone={s.status === "APPLIED" ? "teal" : s.status === "DISMISSED" ? "neutral" : "amber"}>{SUBMISSION_STATUS_LABEL[s.status]}</Chip>
              {s.status === "PENDING" && (
                <IconButton label={`سحب ${s.title}`} onClick={() => void api.del(`/university/submissions/${s.id}`).then(onChanged)}>
                  <Icon name="plus" className="w-3.5 h-3.5 rotate-45" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 flex-wrap items-center">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري): الكلية أو سنة اللائحة" aria-label="ملاحظة" className="flex-1 min-w-[200px]" />
        <input
          ref={input}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,image/png,image/jpeg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="up" /> {busy ? "يُرفع…" : "ارفع ملفًا"}
        </Button>
      </div>
    </Card>
  );
}
