import { Link, useParams } from "react-router-dom";
import { api, pdfDownloadUrl } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { useSession } from "../../hooks/useSession.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Chip } from "../../components/ui/Chip.js";
import { Icon } from "../../icons/Icon.js";
import { formatNum } from "../../lib/numerals.js";
import { W } from "../../components/setup/types.js";

interface Item { key: string; label: string; required: boolean; done: boolean; mode: "AUTO" | "MANUAL"; hint: string; note: string | null }
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
            </span>
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
