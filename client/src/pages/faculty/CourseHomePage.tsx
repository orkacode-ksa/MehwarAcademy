import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { PageHeader } from "../../components/shell/PageHeader.js";
import { Button } from "../../components/ui/Button.js";
import { Card, ErrorText, Select } from "../../components/ui/Form.js";
import { Icon, type IconName } from "../../icons/Icon.js";
import { useToast } from "../../state/ToastContext.js";
import { formatNum } from "../../lib/numerals.js";
import { W, type Course } from "../../components/setup/types.js";

interface QualityFile { requiredDone: number; requiredTotal: number }
interface Term { id: string; label: string }

/**
 * صفحة المقرر — أربع مهام بعد التجهيز، ولكل منها شاشتها: التجهيز · الرصد · ملف المقرر ·
 * المخالفات. بطاقة لكل مهمة تقول حالتها بجملة واحدة.
 */
export function CourseHomePage() {
  const { id } = useParams<{ id: string }>();
  const { data: courses, error } = useApi<Course[]>(`${W}/academic/courses`);
  const { data: file } = useApi<QualityFile>(id ? `${W}/courses/${id}/quality-file` : null);
  const course = courses?.find((c) => c.id === id);

  // الحالات الثلاث: الخطأ يُقال، و«غير موجود» يُقال — لا «جارٍ التحميل» إلى الأبد.
  if (error) return <PageHeader title="المقرر" description={error} />;
  if (!courses) return <p className="text-sm text-ink-3">جارٍ التحميل…</p>;
  if (!course) return <PageHeader title="المقرر غير موجود" />;

  const tasks: { to: string; icon: IconName; title: string; status: string; tone: "ok" | "todo" }[] = [
    {
      to: `/course/${course.id}/setup`,
      icon: "pen",
      title: "تجهيز المقرر",
      status: course.setup.next
        ? `اكتمل ${formatNum(course.setup.done)} من ${formatNum(course.setup.total)} — التالي: ${course.setup.next.label}`
        : "مكتمل",
      tone: course.setup.next ? "todo" : "ok",
    },
    { to: `/course/${course.id}/grades`, icon: "tbl", title: "رصد الدرجات", status: "لكل شعبة، مع كشف PDF", tone: "todo" },
    {
      to: `/course/${course.id}/file`,
      icon: "file",
      title: "ملف المقرر",
      status: file ? `اكتمل ${formatNum(file.requiredDone)} من ${formatNum(file.requiredTotal)} بنود` : "…",
      tone: file && file.requiredDone === file.requiredTotal ? "ok" : "todo",
    },
    { to: `/course/${course.id}/violations`, icon: "shield", title: "المخالفات", status: "حسب لائحة الجامعة", tone: "todo" },
  ];

  return (
    <>
      <PageHeader
        kicker={`${course.code} · ${course.semester.label}`}
        title={course.nameAr}
        actions={
          <Link to="/courses" className="text-[13px] text-deep font-medium px-3 py-2">
            كل المقررات
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {tasks.map((t) => (
          <Link key={t.to} to={t.to} className="flex items-center gap-3 bg-white border border-line rounded-[14px] p-4 hover:border-[#C6D3CB] hover:shadow-s1 transition-all min-h-[76px]">
            <span className={`w-10 h-10 rounded-xl grid place-items-center flex-none ${t.tone === "ok" ? "bg-teal/[.14] text-[#2C6B52]" : "bg-deep/[.07] text-deep"}`}>
              <Icon name={t.icon} className="w-[18px] h-[18px]" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[14.5px]">{t.title}</span>
              <span className="block text-[12.5px] text-ink-3 truncate">{t.status}</span>
            </span>
            <Icon name="arrl" className="w-4 h-4 text-ink-3 flex-none" />
          </Link>
        ))}
      </div>
      <CloneCard courseId={course.id} />
    </>
  );
}

/** الاستنساخ لفصل جديد: المحتوى ينتقل، والطلاب والدرجات لا. */
function CloneCard({ courseId }: { courseId: string }) {
  const { data: terms } = useApi<Term[]>(`${W}/academic/terms`);
  const [termId, setTermId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <Card title="استنساخ لفصل جديد" hint="ينقل التوصيف والفهرس والمواد والتقييمات — بلا طلاب ولا درجات." className="mt-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={termId} onChange={(e) => setTermId(e.target.value)} aria-label="الفصل" className="flex-1 min-w-[180px]">
          <option value="">اختر الفصل</option>
          {terms?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          disabled={!termId}
          onClick={async () => {
            setErr(null);
            try {
              const res = await api.post<{ id: string }>(`${W}/academic/courses/${courseId}/clone`, { semesterId: termId });
              showToast("استُنسخ المقرر");
              navigate(`/course/${res.id}/setup`);
            } catch (e) {
              setErr(e instanceof ApiError ? e.message : "تعذّر الاستنساخ");
            }
          }}
        >
          استنسخ
        </Button>
      </div>
      <ErrorText>{err}</ErrorText>
    </Card>
  );
}
