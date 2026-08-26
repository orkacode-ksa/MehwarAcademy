import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMe } from "../features/auth/useAuth.js";
import {
  activeWorkspaceId,
  useCourse,
  useCreateSection,
  useCreateTopic,
  useEnrollStudent,
  useGenerateLecture,
} from "../features/workspace/useWorkspace.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { ApiError } from "../api/client.js";

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: me } = useMe();
  const workspaceId = activeWorkspaceId(me);
  const { data: course, isLoading } = useCourse(workspaceId, courseId);

  if (isLoading) return <p className="text-ink-muted">جارٍ التحميل…</p>;
  if (!course) return <p className="text-ink-muted">المقرر غير موجود</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand">{course.nameAr}</h1>
          <p className="text-ink-muted">{course.code} · {course.creditHours} ساعات معتمدة</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/app/courses/${course.id}/quality`}>
            <Button variant="secondary">ملف الجودة</Button>
          </Link>
        </div>
      </div>

      <SectionsBlock courseId={course.id} sections={course.sections} workspaceId={workspaceId} />
      <TopicsBlock courseId={course.id} topics={course.topics} workspaceId={workspaceId} />
    </div>
  );
}

function SectionsBlock({
  courseId,
  sections,
  workspaceId,
}: {
  courseId: string;
  sections: { id: string; label: string; capacity: number }[];
  workspaceId: string | undefined;
}) {
  const createSection = useCreateSection(workspaceId, courseId);
  const enroll = useEnrollStudent(workspaceId);
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [enrollTarget, setEnrollTarget] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentUid, setStudentUid] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreateSection(e: FormEvent) {
    e.preventDefault();
    if (!label) return;
    await createSection.mutateAsync({ label, capacity });
    setLabel("");
  }

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    if (!enrollTarget) return;
    try {
      const result = await enroll.mutateAsync({ sectionId: enrollTarget, studentEmail, studentFullName: studentName, universityIdNumber: studentUid });
      setMessage(
        result.tempPassword
          ? `تم تسجيل الطالب. لا مزوّد بريد مربوط بعد — شارك كلمة المرور المؤقتة يدويًا: ${result.tempPassword}`
          : "تم تسجيل الطالب بنجاح (الحساب موجود مسبقًا)",
      );
      setStudentName("");
      setStudentEmail("");
      setStudentUid("");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "تعذّر تسجيل الطالب");
    }
  }

  return (
    <Card surface="work">
      <h2 className="font-display text-lg font-semibold text-ink">الشعب والطلاب</h2>

      <ul className="mt-3 flex flex-col gap-2">
        {sections.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-200 p-3">
            <span className="font-medium">
              شعبة {s.label} <span className="text-ink-muted">(السعة {s.capacity})</span>
            </span>
            <div className="flex gap-2">
              <Link to={`/app/courses/${courseId}/sections/${s.id}/gradesheet`}>
                <Button variant="ghost">كشف الدرجات</Button>
              </Link>
              <Button variant="secondary" onClick={() => setEnrollTarget(s.id)}>
                تسجيل طالب
              </Button>
            </div>
          </li>
        ))}
        {sections.length === 0 && <p className="text-sm text-ink-muted">لا شعب بعد — أنشئ شعبة لتبدأ تسجيل الطلاب.</p>}
      </ul>

      <form onSubmit={handleCreateSection} className="mt-4 flex flex-wrap items-end gap-3">
        <Input label="اسم الشعبة" placeholder="1" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input label="السعة" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        <Button type="submit" variant="secondary" loading={createSection.isPending}>
          إضافة شعبة
        </Button>
      </form>

      {enrollTarget && (
        <form onSubmit={handleEnroll} className="mt-4 grid grid-cols-1 gap-3 rounded-sm bg-tint-mint p-4 sm:grid-cols-2">
          <Input label="اسم الطالب" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
          <Input label="البريد الإلكتروني" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} required />
          <Input label="الرقم الجامعي" value={studentUid} onChange={(e) => setStudentUid(e.target.value)} required />
          <div className="flex items-end gap-2">
            <Button type="submit" loading={enroll.isPending}>
              تسجيل
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEnrollTarget(null)}>
              إلغاء
            </Button>
          </div>
          {message && <p className="sm:col-span-2 text-sm">{message}</p>}
        </form>
      )}
    </Card>
  );
}

function TopicsBlock({
  courseId,
  topics,
  workspaceId,
}: {
  courseId: string;
  topics: { id: string; title: string; orderIndex: number }[];
  workspaceId: string | undefined;
}) {
  const createTopic = useCreateTopic(workspaceId, courseId);
  const generate = useGenerateLecture(workspaceId);
  const [title, setTitle] = useState("");
  const [genStatus, setGenStatus] = useState<Record<string, string>>({});

  async function handleAddTopic(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    await createTopic.mutateAsync({ title, orderIndex: topics.length });
    setTitle("");
  }

  async function handleGenerate(topicId: string) {
    setGenStatus((s) => ({ ...s, [topicId]: "جارٍ التوليد…" }));
    try {
      const result = await generate.mutateAsync({ courseId, topicId, depth: "متوسط" });
      setGenStatus((s) => ({
        ...s,
        [topicId]: `تم — التكلفة ${result.costRiyals.toFixed(3)} ر.س (${result.aiMode === "mock" ? "وضع تجريبي" : "Gemini"})`,
      }));
    } catch {
      setGenStatus((s) => ({ ...s, [topicId]: "فشل التوليد" }));
    }
  }

  return (
    <Card surface="calm">
      <h2 className="font-display text-lg font-semibold text-ink">المواضيع واستوديو التوليد</h2>
      <p className="mt-1 text-sm text-ink-muted">من الموضوع إلى المحاضرة الكاملة — نص، عرض، سرد صوتي.</p>

      <ul className="mt-4 flex flex-col gap-3">
        {topics.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 surface-work p-3">
            <span className="font-medium">{t.title}</span>
            <div className="flex items-center gap-3">
              {genStatus[t.id] && <span className="text-xs text-ink-muted">{genStatus[t.id]}</span>}
              <Button variant="secondary" onClick={() => handleGenerate(t.id)} loading={generate.isPending}>
                ولّد المحاضرة
              </Button>
            </div>
          </li>
        ))}
        {topics.length === 0 && <p className="text-sm text-ink-muted">لا مواضيع بعد.</p>}
      </ul>

      <form onSubmit={handleAddTopic} className="mt-4 flex flex-wrap items-end gap-3">
        <Input label="عنوان الموضوع" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-[240px] flex-1" />
        <Button type="submit" variant="secondary" loading={createTopic.isPending}>
          إضافة موضوع
        </Button>
      </form>
    </Card>
  );
}
