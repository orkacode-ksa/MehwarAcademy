import { getEmbeddedFontFaceCss } from "../../lib/fontsDataUri.js";

export interface GradeSheetData {
  courseCode: string;
  courseNameAr: string;
  sectionLabel: string;
  teacherName: string;
  generatedAt: Date;
  assessments: { id: string; title: string; maxScore: number; weightPercent: number }[];
  students: {
    universityIdNumber: string;
    fullName: string;
    scores: Record<string, number | null>;
    /** المجموع الموزون من ١٠٠ — لا جمع الدرجات الخام (١٠ من ١٠ في كويز ≠ ١٠ من ٤٠ في النهائي). */
    total: number;
    letter: string | null;
  }[];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 2 }).format(value);
}

/** بلا فواصل آلاف — لمكوّنات التاريخ (يوم/شهر) لا الكميات */
function formatDatePart(value: number): string {
  return String(value);
}

export function renderGradeSheetHtml(data: GradeSheetData): string {
  const rows = data.students
    .map((student, index) => {
      const cells = data.assessments
        .map((a) => {
          const score = student.scores[a.id];
          return `<td class="num">${score === null || score === undefined ? "—" : formatNumber(score)}</td>`;
        })
        .join("");
      return `<tr>
        <td class="num">${index + 1}</td>
        <td class="num">${escapeHtml(student.universityIdNumber)}</td>
        <td class="name">${escapeHtml(student.fullName)}</td>
        ${cells}
        <td class="num total">${formatNumber(student.total)}</td>
        <td class="total">${student.letter ? escapeHtml(student.letter) : "—"}</td>
      </tr>`;
    })
    .join("\n");

  const assessmentHeaders = data.assessments
    .map((a) => `<th>${escapeHtml(a.title)}<br/><span class="max">من ${formatNumber(a.maxScore)} · ${formatNumber(a.weightPercent)}٪</span></th>`)
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
${getEmbeddedFontFaceCss()}

* { box-sizing: border-box; }
body {
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  color: #1A2331;
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.7;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #123B4F;
  padding-bottom: 10px;
  margin-bottom: 16px;
}
.title { font-family: 'Readex Pro', sans-serif; font-weight: 700; font-size: 20px; color: #123B4F; }
.meta { font-size: 12px; color: #5A6B7D; margin-top: 4px; }
.meta strong { color: #1A2331; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #D8DEE6; padding: 6px 8px; text-align: center; }
th { background: #F6F8FB; font-weight: 600; font-size: 11px; }
th .max { font-weight: 400; color: #5A6B7D; font-size: 10px; }
td.name { text-align: start; font-weight: 500; }
td.num, .total { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
tr:nth-child(even) { background: #FAFBFC; }
.total { font-weight: 600; background: #DFF3EE; }
.footer { margin-top: 16px; font-size: 10px; color: #5A6B7D; text-align: center; }

@page { size: A4; margin: 14mm 12mm; }
@media print {
  .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .total { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">كشف الدرجات</div>
      <div class="meta"><strong>${escapeHtml(data.courseCode)} — ${escapeHtml(data.courseNameAr)}</strong></div>
      <div class="meta">الشعبة: ${escapeHtml(data.sectionLabel)} · أستاذ المقرر: ${escapeHtml(data.teacherName)}</div>
    </div>
    <div class="meta">تاريخ الإصدار: ${formatDatePart(data.generatedAt.getDate())}/${formatDatePart(data.generatedAt.getMonth() + 1)}/${data.generatedAt.getFullYear()}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الرقم الجامعي</th>
        <th>اسم الطالب</th>
        ${assessmentHeaders}
        <th>المجموع<br/><span class="max">من ١٠٠</span></th>
        <th>التقدير</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">مِحوَر · مستند مولَّد آليًا · هذا الكشف صادر من نظام مِحوَر الأكاديمي</div>
</body>
</html>`;
}
