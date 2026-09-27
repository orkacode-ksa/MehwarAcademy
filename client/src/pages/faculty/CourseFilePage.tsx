import { Link, useParams } from "react-router-dom";
import { useRef, useState } from "react";
import { api, ApiError, assetUrl, pdfDownloadUrl, uploadRaw } from "../../api/client.js";
import { useToast } from "../../state/ToastContext.js";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "../../components/setup/types.js";

interface FileRef { id: string; originalName: string; sizeBytes: number }
interface Item { key: string; label: string; required: boolean; done: boolean; mode: "AUTO" | "MANUAL"; hint: string; note: string | null; files: FileRef[] }
interface QualityFile { items: Item[]; requiredDone: number; requiredTotal: number }

/**
 * ملف المقرر — بنود لائحة الجامعة بحالتها. ما يعرفه النظام يُحسب وحده (لا يُطلب من الأستاذ
 * أن يعلنه)، وما لا مصدر له يؤشّره بنقرة. والتصدير PDF كامل بمحتوى كل بند.
 */
export function CourseFilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApi<QualityFile>(id ? `${W}/courses/${id}/quality-file` : null);
  const { user } = useSession();
  const workspace = user?.workspaceMemberships[0]?.workspaceId;

  return (
    <>
      <PageHeader
        kicker="ملف المقرر"
        title={data ? `اكتمل ${formatNum(data.requiredDone)} من ${formatNum(data.requiredTotal)} بنود` : "ملف المقرر"}
        description="البنود من لائحة جامعتك. ما يُحسب تلقائياً يكتمل من عملك في المقرر."
        actions={
          workspace && id ? (
            <a href={pdfDownloadUrl(`/documents/${workspace}/course-file/${id}.pdf`)}>
              <Button variant="primary">
                <Icon name="file" /> صدّر الملف PDF
              </Button>
            </a>
          ) : undefined
        }
      />
      {loading && <p className="text-sm text-ink-3">جارٍ التحميل…</p>}
      {error && <p className="text-sm text-crim">{error}</p>}

      <ul className="grid gap-2">
        {data?.items.map((i) => (
          <li key={i.key} className="bg-white border border-line rounded-[12px] p-3.5 flex items-start gap-3">
            <span className={`mt-0.5 w-6 h-6 rounded-full grid place-items-center flex-none text-[12px] ${i.done ? "bg-teal text-white" : "bg-line text-ink-3"}`}>
              {i.done ? "✓" : ""}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium">
                {i.label} {!i.required && <span className="text-[11.5px] text-ink-3">(اختياري)</span>}
              </span>
              {!i.done && <span className="block text-[12.5px] text-ink-3 mt-0.5">{i.hint}</span>}
              {i.files.map((f) => (
                <span key={f.id} className="flex items-center gap-2 mt-1 text-[12.5px]">
                  <a href={assetUrl(`/api/files/${f.id}`)} target="_blank" rel="noreferrer" className="text-deep underline truncate">
                    {f.originalName}
                  </a>
                  <button
                    type="button"
                    className="text-ink-3 hover:text-crim min-h-[32px] px-1"
                    aria-label={`فكّ ${f.originalName}`}
                    onClick={() => void api.post(`${W}/quality-file/attach`, { courseId: id, itemKey: i.key, fileId: f.id, attach: false }).then(reload)}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {KEY_LINKS[i.key] && !i.done && (
                <Link to={`/course/${id}/${KEY_LINKS[i.key]}`} className="inline-block text-[12.5px] text-deep underline mt-1">
                  أكمله الآن
                </Link>
              )}
            </span>
            <span className="flex flex-col items-end gap-1.5 flex-none">
              {i.mode === "AUTO" ? (
                <Chip tone={i.done ? "teal" : "neutral"}>تلقائي</Chip>
              ) : (
                <Button
                  size="sm"
                  variant={i.done ? "secondary" : "primary"}
                  onClick={() => void api.patch(`${W}/quality-file`, { courseId: id, itemKey: i.key, completed: !i.done }).then(reload)}
                >
                  {i.done ? "ألغِ التأشير" : "أشّر مكتمل"}
                </Button>
              )}
              <AttachButton courseId={id as string} itemKey={i.key} onDone={reload} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-3 mt-4">
        <Link to={`/course/${id}`} className="text-deep underline">
          صفحة المقرر
        </Link>
      </p>
    </>
  );
}

/** أين يُكمَل كل بند آلي — رابط «أكمله الآن» بدل أن يبحث الأستاذ. */
const KEY_LINKS: Record<string, string> = {
  SPEC: "setup?step=COURSE",
  MIDTERM_EXAM: "setup?step=ASSESSMENTS",
  FINAL_EXAM: "setup?step=ASSESSMENTS",
  PRACTICAL_EXAM: "setup?step=ASSESSMENTS",
  ANSWER_KEY: "setup?step=ASSESSMENTS",
  GRADE_STATS: "grades",
  COURSE_REPORT: "report",
};

/** رفع ملف وإرفاقه بالبند في خطوة واحدة — الإرفاق يُكمل البند. */
function AttachButton({ courseId, itemKey, onDone }: { courseId: string; itemKey: string; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  return (
    <>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xlsx,.pptx,image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const f = await uploadRaw<{ id: string }>(`/files/me/upload?purpose=FILE_ITEM`, file);
            await api.post(`${W}/quality-file/attach`, { courseId, itemKey, fileId: f.id, attach: true });
            showToast("أُرفق الملف");
            onDone();
          } catch (err) {
            showToast(err instanceof ApiError ? err.message : "تعذّر الرفع");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button size="sm" variant="text" disabled={busy} onClick={() => input.current?.click()}>
        <Icon name="up" /> {busy ? "يُرفع…" : "أرفق ملفًا"}
      </Button>
    </>
  );
}
