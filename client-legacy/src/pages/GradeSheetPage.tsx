import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMe } from "../features/auth/useAuth.js";
import {
  activeWorkspaceId,
  useCreateAssessment,
  useGradeSheetData,
  useSetGrades,
} from "../features/workspace/useWorkspace.js";
import { Card } from "../components/ui/Card.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { pdfDownloadUrl } from "../api/client.js";

export default function GradeSheetPage() {
  const { courseId, sectionId } = useParams<{ courseId: string; sectionId: string }>();
  const { data: me } = useMe();
  const workspaceId = activeWorkspaceId(me);
  const { data, isLoading } = useGradeSheetData(workspaceId, courseId);
  const setGrades = useSetGrades(workspaceId, courseId);
  const createAssessment = useCreateAssessment(workspaceId, courseId);

  const [newAssessment, setNewAssessment] = useState({ title: "", maxScore: 20, weightPercent: 10 });

  if (isLoading) return <p className="text-ink-muted">جارٍ التحميل…</p>;
  const section = data?.sections.find((s) => s.id === sectionId);
  if (!data || !section) return <p className="text-ink-muted">الشعبة غير موجودة</p>;

  async function handleAddAssessment(e: FormEvent) {
    e.preventDefault();
    if (!newAssessment.title) return;
    await createAssessment.mutateAsync({ ...newAssessment, type: "OTHER" });
    setNewAssessment({ title: "", maxScore: 20, weightPercent: 10 });
  }

  function scoreFor(enrollmentId: string, assessmentId: string): string {
    const enrollment = section?.enrollments.find((e) => e.id === enrollmentId);
    const grade = enrollment?.grades.find((g) => g.assessmentId === assessmentId);
    return grade ? String(grade.score) : "";
  }

  function handleScoreCommit(enrollmentId: string, assessmentId: string, value: string) {
    const score = Number(value);
    if (Number.isNaN(score)) return;
    setGrades.mutate({ assessmentId, entries: [{ enrollmentId, score }] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand">كشف الدرجات — شعبة {section.label}</h1>
        {courseId && sectionId && (
          <a
            href={pdfDownloadUrl(`/documents/${workspaceId}/gradesheet/${courseId}/${sectionId}.pdf`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary">تنزيل PDF</Button>
          </a>
        )}
      </div>

      <Card surface="work" className="overflow-x-auto p-0">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-start">
              <th className="p-3 text-start font-medium">الرقم الجامعي</th>
              <th className="p-3 text-start font-medium">الاسم</th>
              {data.assessments.map((a) => (
                <th key={a.id} className="p-3 text-center font-medium">
                  {a.title} <span className="text-ink-muted">/{a.maxScore}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.enrollments.map((enrollment) => (
              <tr key={enrollment.id} className="border-b border-slate-100">
                <td className="tabular p-3">{enrollment.universityIdNumber}</td>
                <td className="p-3 font-medium">{enrollment.student.fullName}</td>
                {data.assessments.map((a) => (
                  <td key={a.id} className="p-1 text-center">
                    <input
                      type="number"
                      className="tabular w-16 rounded-sm border border-slate-200 p-2 text-center focus-ring"
                      defaultValue={scoreFor(enrollment.id, a.id)}
                      min={0}
                      max={a.maxScore}
                      onBlur={(e) => handleScoreCommit(enrollment.id, a.id, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {section.enrollments.length === 0 && (
              <tr>
                <td colSpan={2 + data.assessments.length} className="p-4 text-center text-ink-muted">
                  لا طلاب مسجَّلون في هذه الشعبة بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card surface="work" className="no-print">
        <h2 className="font-medium">إضافة عنصر تقييم</h2>
        <form onSubmit={handleAddAssessment} className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            label="اسم التقييم"
            value={newAssessment.title}
            onChange={(e) => setNewAssessment((v) => ({ ...v, title: e.target.value }))}
          />
          <Input
            label="الدرجة العظمى"
            type="number"
            value={newAssessment.maxScore}
            onChange={(e) => setNewAssessment((v) => ({ ...v, maxScore: Number(e.target.value) }))}
          />
          <Input
            label="الوزن ٪"
            type="number"
            value={newAssessment.weightPercent}
            onChange={(e) => setNewAssessment((v) => ({ ...v, weightPercent: Number(e.target.value) }))}
          />
          <Button type="submit" variant="secondary" loading={createAssessment.isPending}>
            إضافة
          </Button>
        </form>
      </Card>
    </div>
  );
}
