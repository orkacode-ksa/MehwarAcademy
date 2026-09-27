import { ACTIVITY_TYPES, OUTCOME_DOMAINS, type FacultyProfile } from "@mihwar/shared";
import { getEmbeddedFontFaceCss } from "../../lib/fontsDataUri.js";
import { escapeHtml } from "./gradeSheet.template.js";
import type { buildCourseReport } from "./courseReport.service.js";

const e = (v: string | null | undefined) => escapeHtml(v ?? "");
const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v);
const para = (v: string | null | undefined) => (v && v.trim() ? e(v).replace(/\n/g, "<br/>") : '<span class="muted">—</span>');

/** غلاف موحّد لكل مطبوعات المنصة: خطوط مضمّنة (المتصفّح مقطوع عن الشبكة) وA4. */
function shell(dir: "rtl" | "ltr", body: string, extraCss = ""): string {
  return `<!doctype html><html lang="${dir === "rtl" ? "ar" : "en"}" dir="${dir}"><head><meta charset="utf-8"/><style>
${getEmbeddedFontFaceCss()}
*{box-sizing:border-box} body{font-family:'IBM Plex Sans Arabic',sans-serif;color:#1A2331;margin:0;font-size:11.5px;line-height:1.75}
h1{font-family:'Readex Pro',sans-serif;font-size:20px;color:#123B4F;margin:0 0 4px}
h2{font-family:'Readex Pro',sans-serif;font-size:14px;color:#123B4F;border-bottom:1.5px solid #123B4F;padding-bottom:3px;margin:18px 0 8px;page-break-after:avoid}
h3{font-size:12px;margin:10px 0 4px}
table{width:100%;border-collapse:collapse;margin-bottom:6px} th,td{border:1px solid #C9D2DC;padding:4px 6px;text-align:center;vertical-align:top}
th{background:#EEF2F6;font-weight:600;font-size:10.5px} td.s{text-align:start}
.muted{color:#6B7B8C} .box{border:1px solid #C9D2DC;border-radius:6px;padding:8px 10px;min-height:28px}
.meta td{border:none;text-align:start;padding:2px 6px} .meta td:first-child{color:#6B7B8C;width:190px}
.footer{margin-top:18px;font-size:9px;color:#6B7B8C;text-align:center}
@page{size:A4;margin:14mm 12mm} th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
${extraCss}
</style></head><body>${body}<div class="footer">Mihwar · مِحوَر</div></body></html>`;
}

// ───────────────────────── تقرير المقرر (NCAAA) ─────────────────────────

export function renderCourseReportHtml(r: Awaited<ReturnType<typeof buildCourseReport>>): string {
  const h = r.header;
  const letters = Object.keys(r.grades.letters);
  const domains: [string, string][] = [
    ["K", "Knowledge and Understanding"],
    ["S", "Skills"],
    ["V", "Values, autonomy, and responsibility"],
  ];
  const cloRows = domains
    .map(([d, label], i) => {
      const items = r.clos.filter((c) => c.domain === d);
      const head = `<tr><th>${i + 1}</th><th colspan="6" style="text-align:start">${label} — ${OUTCOME_DOMAINS[d as "K"]}</th></tr>`;
      const rows = items
        .map(
          (c, j) =>
            `<tr><td>${i + 1}.${j + 1}</td><td class="s">${e(c.text)}</td><td></td><td class="s">${e(c.methods)}</td><td>${n(c.target)}%</td><td>${c.actual === null ? "—" : `${n(c.actual)}%`}</td><td>${c.met === null ? "" : c.met ? "Achieved · متحقّق" : "Not achieved · غير متحقّق"}</td></tr>`,
        )
        .join("");
      return head + (rows || `<tr><td colspan="7" class="muted">—</td></tr>`);
    })
    .join("");

  const body = `
<h1>Course Report · تقرير المقرر</h1>
<table class="meta">
<tr><td>Course Title</td><td>${e(h.title)}</td></tr><tr><td>Course Code</td><td>${e(h.code)}</td></tr>
<tr><td>Department</td><td>${e(h.department)}</td></tr><tr><td>College</td><td>${e(h.college)}</td></tr>
<tr><td>Institution</td><td>${e(h.institution)}</td></tr><tr><td>Academic Year · Semester</td><td>${e(h.academicYear)} · ${e(h.semester)}</td></tr>
<tr><td>Course Instructor</td><td>${e(h.instructor)}</td></tr><tr><td>Course Coordinator</td><td>${e(r.report.coordinator)}</td></tr>
<tr><td>Location</td><td>${r.report.location === "MAIN" ? "Main campus" : r.report.location === "BRANCH" ? "Branch" : "—"}</td></tr>
<tr><td>Number of Sections</td><td>${n(h.sections)}</td></tr>
<tr><td>Students (Starting / Completed)</td><td>${n(h.started)} / ${n(h.completed)}</td></tr>
<tr><td>Report Date</td><td>${new Date().toISOString().slice(0, 10)}</td></tr>
</table>

<h2>A. Student Results</h2>
<h3>1. Grade Distribution</h3>
<table><tr><th rowspan="2"></th><th colspan="${letters.length}">Grades</th><th colspan="4">Status Distributions</th></tr>
<tr>${letters.map((l) => `<th>${l}</th>`).join("")}<th>Denied Entry</th><th>In Progress</th><th>Pass</th><th>Fail</th></tr>
<tr><th>Number of Students</th>${letters.map((l) => `<td>${n(r.grades.letters[l])}</td>`).join("")}<td>${n(r.grades.status.deniedEntry)}</td><td>${n(r.grades.status.inProgress)}</td><td>${n(r.grades.status.pass)}</td><td>${n(r.grades.status.fail)}</td></tr>
<tr><th>Percentage</th>${letters.map((l) => `<td>${n(r.grades.percent[l])}%</td>`).join("")}<td colspan="4"></td></tr></table>
${r.grades.stats ? `<p>Highest: <b>${n(r.grades.stats.max)}</b> · Lowest: <b>${n(r.grades.stats.min)}</b> · Average: <b>${n(r.grades.stats.avg)}</b> (n=${n(r.grades.stats.count)})</p>` : ""}
<h3>2. Comment on Student Grades</h3><div class="box">${para(r.report.gradeComment)}</div>

<h2>B. Course Learning Outcomes</h2>
<h3>1. Course Learning Outcomes Assessment Results</h3>
<table><tr><th>#</th><th>Course Learning Outcomes (CLOs)</th><th>Related PLOs Code</th><th>Assessment Methods</th><th>Targeted Level</th><th>Actual Level</th><th>Comment on Assessment Results</th></tr>${cloRows}</table>
<h3>2. Recommendations</h3><div class="box">${para(r.report.recommendations)}</div>

<h2>C. Topics not covered</h2>
<table><tr><th>Topic</th><th>Reason for Not Covering/Discrepancies</th><th>Extent of their Impact on Learning Outcomes</th><th>Compensating Action</th></tr>
${r.uncovered.map((u) => `<tr><td class="s">${e(u.topic)}</td><td class="s">${e(u.reason)}</td><td class="s">${e(u.impact)}</td><td class="s">${e(u.action)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">${r.sessionsHeld ? "All topics covered" : "—"}</td></tr>`}</table>

<h2>D. Improvement Actions from Last Offering</h2>
<table><tr><th>Action</th><th>Percentage of Achievement</th><th>Comments</th></tr>
${r.report.improvementActions.map((a) => `<tr><td class="s">${e(a.action)}</td><td>${e(a.achievement)}</td><td class="s">${e(a.comment)}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">—</td></tr>'}</table>

<h2>E. Overall Student Evaluation and Comments</h2><div class="box">${para(r.report.studentEvaluation)}</div>

<h2>F. Course Improvement Plan</h2>
<table><tr><th>Recommendations</th><th>Actions</th><th>Needed Support</th></tr>
${r.report.improvementPlan.map((a) => `<tr><td class="s">${e(a.recommendation)}</td><td class="s">${e(a.action)}</td><td class="s">${e(a.support)}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">—</td></tr>'}</table>
<p class="muted">Improvement plans should be discussed at the department council and included in the Annual Program Report.</p>
<table><tr><th></th><th>Name</th><th>Signature</th><th>Date</th></tr><tr><th>Course Coordinator</th><td>${e(r.report.coordinator)}</td><td></td><td></td></tr><tr><th>Program Supervisor</th><td></td><td></td><td></td></tr></table>`;
  return shell("ltr", body, "body{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif}");
}

// ───────────────────────── الاختبار للطباعة ─────────────────────────

export function renderExamHtml(x: {
  institution: string;
  courseCode: string;
  courseName: string;
  term: string;
  teacher: string;
  title: string;
  maxScore: number;
  content: string;
  answerKey: string | null;
  withAnswers: boolean;
}): string {
  const body = `
<table class="meta" style="margin-bottom:8px"><tr><td style="width:auto">${e(x.institution)}</td><td style="text-align:end">${e(x.term)}</td></tr></table>
<h1 style="text-align:center">${e(x.title)}${x.withAnswers ? " — نموذج الإجابة" : ""}</h1>
<p style="text-align:center">${e(x.courseCode)} · ${e(x.courseName)} · الدرجة: ${n(x.maxScore)} · أستاذ المقرر: ${e(x.teacher)}</p>
${x.withAnswers ? "" : `<table><tr><th style="width:25%">اسم الطالب</th><td></td><th style="width:18%">الرقم الجامعي</th><td style="width:22%"></td></tr><tr><th>الشعبة</th><td></td><th>الدرجة</th><td></td></tr></table>`}
<h2>${x.withAnswers ? "الإجابات" : "الأسئلة"}</h2>
<div style="font-size:13px;line-height:2.1">${para(x.withAnswers ? x.answerKey : x.content)}</div>`;
  return shell("rtl", body);
}

// ───────────────────────── السيرة الذاتية ─────────────────────────

export function renderCvHtml(x: {
  fullName: string;
  email: string;
  profile: Partial<FacultyProfile>;
  activities: { type: string; title: string; venue: string | null; date: Date; hours: number | null; participation: string | null }[];
}): string {
  const p = x.profile;
  const section = (type: keyof typeof ACTIVITY_TYPES, title: string) => {
    const items = x.activities.filter((a) => a.type === type);
    if (!items.length) return "";
    return `<h2>${title}</h2><table><tr><th>العنوان</th><th>الجهة</th><th>التاريخ</th>${type === "TRAINING" || type === "WORKSHOP" ? "<th>الساعات</th>" : ""}<th>المشاركة</th></tr>
${items.map((a) => `<tr><td class="s">${e(a.title)}</td><td class="s">${e(a.venue)}</td><td>${a.date.toISOString().slice(0, 10)}</td>${type === "TRAINING" || type === "WORKSHOP" ? `<td>${n(a.hours)}</td>` : ""}<td>${e(a.participation)}</td></tr>`).join("")}</table>`;
  };
  const body = `
<h1>السيرة الذاتية</h1>
<table class="meta">
<tr><td>الاسم</td><td><b>${e(x.fullName)}</b></td></tr>
<tr><td>الرتبة العلمية</td><td>${e(p.rank)}</td></tr>
<tr><td>التخصص</td><td>${e(p.specialization)}</td></tr>
<tr><td>القسم · الكلية</td><td>${e(p.department)} · ${e(p.college)}</td></tr>
<tr><td>البريد</td><td dir="ltr" style="text-align:end">${e(x.email)}</td></tr>
</table>
${p.qualifications ? `<h2>المؤهلات العلمية</h2><div>${para(p.qualifications)}</div>` : ""}
${p.bio ? `<h2>نبذة</h2><div>${para(p.bio)}</div>` : ""}
${section("RESEARCH", "الأبحاث العلمية")}${section("CONFERENCE", "الندوات والمؤتمرات")}${section("TRAINING", "الدورات التدريبية")}${section("WORKSHOP", "الورش التدريبية")}`;
  return shell("rtl", body);
}

// ───────────────────────── التقرير السنوي للقسم (نموذج أم القرى) ─────────────────────────

export function renderAnnualReportHtml(x: {
  yearLabel: string;
  department: string;
  head: string;
  totals: { WORKSHOP: number; CONFERENCE: number; TRAINING: number; RESEARCH: number };
  research: { title: string; member: string; specialization: string; venue: string | null; date: Date }[];
  conferences: { title: string; member: string; department: string; venue: string | null; date: Date; participation: string | null }[];
  trainings: { title: string; member: string; venue: string | null; date: Date; hours: number | null; participation: string | null }[];
}): string {
  const d = (v: Date) => v.toISOString().slice(0, 10);
  const body = `
<h1 style="text-align:center">التقرير السنوي الخاص بالأبحاث والندوات والدورات التدريبية</h1>
<p style="text-align:center">لقسم ( ${e(x.department)} ) · للعام الجامعي ${e(x.yearLabel)} · رئيس القسم: ${e(x.head)}</p>
<table><tr><th>م</th><th>الورش التدريبية</th><th>الندوات والمؤتمرات</th><th>الدورات التدريبية</th><th>المجموع</th></tr>
<tr><td>1</td><td>${n(x.totals.WORKSHOP)}</td><td>${n(x.totals.CONFERENCE)}</td><td>${n(x.totals.TRAINING)}</td><td>${n(x.totals.WORKSHOP + x.totals.CONFERENCE + x.totals.TRAINING)}</td></tr></table>

<h2>إحصائية بالأبحاث العلمية على مستوى القسم خلال العام ${e(x.yearLabel)}</h2>
<table><tr><th>م</th><th>اسم البحث</th><th>عضو هيئة التدريس</th><th>التخصص</th><th>جهة النشر</th><th>تاريخ النشر</th></tr>
${x.research.map((r, i) => `<tr><td>${i + 1}</td><td class="s">${e(r.title)}</td><td>${e(r.member)}</td><td>${e(r.specialization)}</td><td>${e(r.venue)}</td><td>${d(r.date)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">—</td></tr>'}</table>

<h2>إحصائية مشاركات أعضاء هيئة التدريس في الندوات والمؤتمرات العلمية خلال العام الجامعي ${e(x.yearLabel)}</h2>
<table><tr><th>م</th><th>اسم الندوة والمؤتمر</th><th>مكان انعقاد الندوة والمؤتمر أو تاريخه</th><th>اسم العضو المشارك</th><th>القسم التابع للعضو المشارك</th><th>نوع المشاركة حضور / ورقة بحثية</th></tr>
${x.conferences.map((r, i) => `<tr><td>${i + 1}</td><td class="s">${e(r.title)}</td><td>${e(r.venue)} · ${d(r.date)}</td><td>${e(r.member)}</td><td>${e(r.department)}</td><td>${e(r.participation)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">—</td></tr>'}</table>

<h2>بيانات الدورات التدريبية لأعضاء هيئة التدريس بالقسم خلال العام الجامعي ${e(x.yearLabel)}</h2>
<table><tr><th>م</th><th>اسم عضو هيئة التدريس</th><th>اسم الدورة التدريبية</th><th>جهة التنفيذ</th><th>تاريخ الدورة</th><th>عدد الساعات التدريبية</th><th>نوع المشاركة (حضور / مدرب)</th></tr>
${x.trainings.map((r, i) => `<tr><td>${i + 1}</td><td>${e(r.member)}</td><td class="s">${e(r.title)}</td><td>${e(r.venue)}</td><td>${d(r.date)}</td><td>${n(r.hours)}</td><td>${e(r.participation)}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">—</td></tr>'}</table>`;
  return shell("rtl", body);
}
