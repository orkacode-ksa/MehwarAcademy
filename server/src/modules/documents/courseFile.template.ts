import { OUTCOME_DOMAINS, type CourseSpec } from "@mihwar/shared";
import { getEmbeddedFontFaceCss } from "../../lib/fontsDataUri.js";
import { escapeHtml } from "./gradeSheet.template.js";

export interface CourseFileData {
  code: string;
  nameAr: string;
  creditHours: number;
  term: string;
  teacherName: string;
  generatedAt: Date;
  spec: Partial<CourseSpec>;
  items: { key: string; label: string; required: boolean; done: boolean; note: string | null }[];
  topics: { title: string; outcomes: string[]; materials: number }[];
  gradeScheme: { label: string; weight: number }[];
  assessments: { title: string; type: string; maxScore: number; weightPercent: number; instructions: string | null; isLab: boolean }[];
  sections: {
    label: string;
    students: number;
    graded: number;
    average: number | null;
    passed: number;
    letters: Record<string, number>;
    sessions: number;
    absenceRate: number | null;
  }[];
  violations: Record<string, number>;
}

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 1 }).format(v);
const e = (v: string | null | undefined) => escapeHtml(v ?? "");
const para = (v: string | null | undefined) => (v && v.trim() ? `<p>${e(v).replace(/\n/g, "<br/>")}</p>` : `<p class="empty">لم يُكتب بعد</p>`);

const TYPE_LABEL: Record<string, string> = {
  QUIZ: "اختبار قصير",
  ASSIGNMENT: "واجب",
  MIDTERM: "اختبار نصفي",
  FINAL: "اختبار نهائي",
  PARTICIPATION: "مشاركة",
  OTHER: "أخرى",
};

/** ملف المقرر: القسم الأول بنود لائحة الجامعة بحالتها، ثم محتوى كل بند مما أنتجه الأستاذ. */
export function renderCourseFileHtml(d: CourseFileData): string {
  const spec = d.spec;
  const required = d.items.filter((i) => i.required);
  const done = required.filter((i) => i.done).length;

  const itemsRows = d.items
    .map(
      (i, idx) => `<tr><td class="num">${idx + 1}</td><td class="name">${e(i.label)}${i.required ? "" : ' <span class="muted">(اختياري)</span>'}</td>
      <td class="${i.done ? "ok" : "no"}">${i.done ? "مكتمل" : "ناقص"}</td><td class="name muted">${e(i.note)}</td></tr>`,
    )
    .join("");

  const outcomesRows = (spec.outcomes ?? [])
    .map(
      (o) => `<tr><td class="num">${e(o.code)}</td><td>${e(OUTCOME_DOMAINS[o.domain])}</td><td class="name">${e(o.text)}</td>
      <td class="name">${e(o.teaching)}</td><td class="name">${e(o.assessment)}</td></tr>`,
    )
    .join("");

  const topicRows = d.topics
    .map((t, i) => `<tr><td class="num">${i + 1}</td><td class="name">${e(t.title)}</td><td class="num">${e(t.outcomes.join("، ")) || "—"}</td><td class="num">${n(t.materials)}</td></tr>`)
    .join("");

  const assessRows = d.assessments
    .map(
      (a) => `<tr><td class="name">${e(a.title)}${a.isLab ? ' <span class="muted">(معمل)</span>' : ""}</td><td>${e(TYPE_LABEL[a.type] ?? a.type)}</td>
      <td class="num">${n(a.maxScore)}</td><td class="num">${n(a.weightPercent)}٪</td><td>${a.instructions ? "مرفق" : "—"}</td></tr>`,
    )
    .join("");

  const sectionRows = d.sections
    .map(
      (s) => `<tr><td>${e(s.label)}</td><td class="num">${n(s.students)}</td><td class="num">${n(s.graded)}</td><td class="num">${n(s.average)}</td>
      <td class="num">${n(s.passed)}</td><td class="num">${e(Object.entries(s.letters).map(([l, c]) => `${l}: ${c}`).join(" · ")) || "—"}</td>
      <td class="num">${n(s.sessions)}</td><td class="num">${s.absenceRate === null ? "—" : `${n(s.absenceRate)}٪`}</td></tr>`,
    )
    .join("");

  const samples = d.assessments
    .filter((a) => a.instructions && a.instructions.trim())
    .map((a) => `<h3>${e(a.title)}</h3><div class="box">${e(a.instructions).replace(/\n/g, "<br/>")}</div>`)
    .join("");

  const violationRows = Object.entries(d.violations)
    .map(([label, count]) => `<tr><td class="name">${e(label)}</td><td class="num">${n(count)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" /><style>
${getEmbeddedFontFaceCss()}
* { box-sizing: border-box; }
body { font-family: 'IBM Plex Sans Arabic', sans-serif; color: #1A2331; margin: 0; font-size: 11.5px; line-height: 1.8; }
h1 { font-family: 'Readex Pro', sans-serif; font-size: 22px; color: #123B4F; margin: 0; }
h2 { font-family: 'Readex Pro', sans-serif; font-size: 15px; color: #123B4F; border-bottom: 1.5px solid #123B4F; padding-bottom: 4px; margin: 22px 0 10px; page-break-after: avoid; }
h3 { font-size: 12.5px; margin: 12px 0 4px; }
p { margin: 0 0 6px; }
.cover { border-bottom: 2px solid #123B4F; padding-bottom: 10px; margin-bottom: 8px; }
.meta { color: #5A6B7D; font-size: 11.5px; }
.meta strong { color: #1A2331; }
.summary { background: #F6F8FB; border: 1px solid #D8DEE6; border-radius: 8px; padding: 8px 12px; margin: 10px 0; }
table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
th, td { border: 1px solid #D8DEE6; padding: 5px 7px; text-align: center; vertical-align: top; }
th { background: #F6F8FB; font-weight: 600; font-size: 10.5px; }
td.name { text-align: start; }
td.num { font-family: 'IBM Plex Mono', 'IBM Plex Sans Arabic', monospace; }
td.ok { color: #2C6B52; font-weight: 600; } td.no { color: #963C34; font-weight: 600; }
.muted { color: #5A6B7D; font-size: 10px; }
.empty { color: #963C34; }
.box { border: 1px solid #D8DEE6; border-radius: 6px; padding: 8px 10px; }
dl { display: grid; grid-template-columns: 130px 1fr; gap: 4px 12px; margin: 0; }
dt { color: #5A6B7D; } dd { margin: 0; }
.footer { margin-top: 20px; font-size: 9.5px; color: #5A6B7D; text-align: center; }
@page { size: A4; margin: 14mm 12mm; }
th, .summary { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>

<div class="cover">
  <h1>ملف المقرر</h1>
  <div class="meta"><strong>${e(d.code)} — ${e(d.nameAr)}</strong> · ${n(d.creditHours)} ساعات</div>
  <div class="meta">${e(d.term)} · أستاذ المقرر: ${e(d.teacherName)} · أُصدر ${d.generatedAt.getDate()}/${d.generatedAt.getMonth() + 1}/${d.generatedAt.getFullYear()}</div>
</div>
<div class="summary">اكتمل <strong>${n(done)}</strong> من <strong>${n(required.length)}</strong> بنود إلزامية حسب لائحة الجامعة.</div>

<h2>1 — بنود الملف</h2>
<table><thead><tr><th>#</th><th>البند</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${itemsRows}</tbody></table>

<h2>2 — توصيف المقرر</h2>
<dl>
  <dt>نوع المقرر</dt><dd>${spec.courseType === "REQUIRED" ? "إجباري" : spec.courseType === "ELECTIVE" ? "اختياري" : "—"}</dd>
  <dt>المستوى</dt><dd>${e(spec.level) || "—"}</dd>
  <dt>المتطلبات السابقة</dt><dd>${e(spec.prerequisites) || "—"}</dd>
  <dt>نمط التدريس</dt><dd>${e(spec.teachingMode) || "—"}</dd>
  <dt>ساعات التواصل</dt><dd>نظري ${n(spec.contactHours?.lecture ?? 0)} · معمل ${n(spec.contactHours?.lab ?? 0)} · تمارين ${n(spec.contactHours?.tutorial ?? 0)}</dd>
</dl>
<h3>الوصف</h3>${para(spec.description)}
<h3>الهدف العام</h3>${para(spec.goal)}

<h2>3 — مخرجات التعلّم</h2>
${outcomesRows ? `<table><thead><tr><th>الرمز</th><th>المجال</th><th>المخرج</th><th>استراتيجية التدريس</th><th>طريقة التقييم</th></tr></thead><tbody>${outcomesRows}</tbody></table>` : '<p class="empty">لم تُكتب مخرجات بعد</p>'}

<h2>4 — محتوى المقرر وربطه بالمخرجات</h2>
${topicRows ? `<table><thead><tr><th>#</th><th>الموضوع</th><th>المخرجات</th><th>المواد</th></tr></thead><tbody>${topicRows}</tbody></table>` : '<p class="empty">لا مواضيع</p>'}

<h2>5 — خطة التقييم</h2>
${d.gradeScheme.length ? `<p>توزيع الدرجات: ${d.gradeScheme.map((g) => `${e(g.label)} ${n(g.weight)}٪`).join(" · ")}</p>` : ""}
${assessRows ? `<table><thead><tr><th>الاختبار</th><th>النوع</th><th>العظمى</th><th>الوزن</th><th>النموذج</th></tr></thead><tbody>${assessRows}</tbody></table>` : '<p class="empty">لا اختبارات</p>'}

<h2>6 — مصادر التعلّم</h2>
<h3>المرجع الأساسي</h3>${para(spec.references?.main)}
<h3>المراجع المساندة</h3>${para(spec.references?.supporting)}
<h3>المصادر الإلكترونية</h3>${para(spec.references?.electronic)}
<h3>المرافق والتجهيزات</h3>${para(spec.facilities)}

<h2>7 — تقرير المقرر: النتائج والحضور</h2>
${sectionRows ? `<table><thead><tr><th>الشعبة</th><th>الطلاب</th><th>اكتمل رصدهم</th><th>المتوسط</th><th>الناجحون</th><th>التقديرات</th><th>المحاضرات</th><th>نسبة الغياب</th></tr></thead><tbody>${sectionRows}</tbody></table>` : '<p class="empty">لا شعب</p>'}
${violationRows ? `<h3>المخالفات المسجّلة</h3><table><thead><tr><th>النوع</th><th>العدد</th></tr></thead><tbody>${violationRows}</tbody></table>` : ""}

<h2>8 — تقييم جودة المقرر</h2>${para(spec.courseEvaluation)}

${samples ? `<h2>9 — نماذج الاختبارات</h2>${samples}` : ""}

<div class="footer">مِحوَر · ملف مولَّد من عمل الأستاذ في المنصة · بنوده من لائحة الجامعة</div>
</body></html>`;
}
