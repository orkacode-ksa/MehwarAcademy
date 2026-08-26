import { useParams } from "react-router-dom";
import { useMe } from "../features/auth/useAuth.js";
import { activeWorkspaceId, useQualityFile, useUpdateQualityItem } from "../features/workspace/useWorkspace.js";
import { Card } from "../components/ui/Card.js";

const ITEM_LABELS: Record<string, string> = {
  COURSE_SPECIFICATION: "توصيف المقرر",
  LEARNING_OUTCOMES_MAP: "خريطة مخرجات التعلم",
  LECTURE_ARCHIVE: "أرشيف المحاضرات",
  ASSESSMENT_PLAN: "خطة التقييم",
  EXAM_SAMPLES: "نماذج الاختبارات",
  GRADE_DISTRIBUTION: "توزيع الدرجات",
  STUDENT_FEEDBACK: "تغذية راجعة من الطلاب",
  ATTENDANCE_RECORD: "سجل الحضور",
  QUESTION_BANK: "بنك الأسئلة",
  COURSE_REPORT: "تقرير المقرر",
  IMPROVEMENT_PLAN: "خطة التحسين",
};

export default function QualityFilePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: me } = useMe();
  const workspaceId = activeWorkspaceId(me);
  const { data: items, isLoading } = useQualityFile(workspaceId, courseId);
  const update = useUpdateQualityItem(workspaceId, courseId);

  if (isLoading) return <p className="text-ink-muted">جارٍ التحميل…</p>;

  const completed = items?.filter((i) => i.completed).length ?? 0;
  const total = items?.length ?? 11;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand">ملف الجودة</h1>
        <p className="text-ink-muted">{completed} من {total} عناصر مكتملة</p>
        <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-progress transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <Card surface="work" className="p-0">
        <ul className="divide-y divide-slate-200">
          {items?.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-4">
              <label htmlFor={`qi-${item.id}`} className="flex-1 cursor-pointer font-medium">
                {ITEM_LABELS[item.itemKey] ?? item.itemKey}
              </label>
              <input
                id={`qi-${item.id}`}
                type="checkbox"
                className="size-5 accent-progress focus-ring"
                checked={item.completed}
                onChange={(e) => update.mutate({ itemKey: item.itemKey, completed: e.target.checked })}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
