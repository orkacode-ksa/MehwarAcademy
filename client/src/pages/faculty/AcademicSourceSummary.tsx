import type { WorkflowSummary } from "../../lib/academicWorkflow.js";
import { formatNum } from "../../lib/numerals.js";

export function AcademicSourceSummary({ summary }: { summary: WorkflowSummary | undefined }) {
  if (!summary || !summary.totalVersions) return null;
  return <dl aria-label="تقدم مراجعة المقررات" className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-3 text-[12.5px]">
    {([["totalVersions", "إصدارات توصيف المقررات"], ["reviewCompletedVersions", "تمت مراجعتها"], ["approvalPendingVersions", "بانتظار الاعتماد"],
      ["approvedVersions", "معتمدة"], ["publishedVersions", "منشورة"], ["unresolvedVersions", "تحتاج حسمًا"]] as const).map(([key, label]) =>
      <div key={key}><dt className="text-ink-3">{label}</dt><dd className="font-semibold mt-1">{formatNum(summary[key])}</dd></div>)}
  </dl>;
}
