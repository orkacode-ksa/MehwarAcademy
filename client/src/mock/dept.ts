import { COURSES } from "./courses.js";
import { qualityCount } from "./courseData.js";

/**
 * بيانات لوحة القسم — تجميعية حصراً.
 *
 * ★ نطاق الصلاحية (قرار حوكمة مفروض هنا لا في الواجهة وحدها) ★
 * ما يُعرض: اكتمال ملفات الجودة (مخرج مؤسسي مطلوب للاعتماد الأكاديمي) · الأعباء
 * التدريسية · نسب النجاح والحضور المجمّعة لكل مقرر.
 * ما لا يُعرض أبداً: مؤشر الالتزام (وعدنا عضو هيئة التدريس صراحةً أنه «لا يُشارَك
 * مع القسم ولا الكلية ولا أي جهة») · التقييم السنوي التنبؤي · محتوى أي محاضرة ·
 * درجة أي طالب بعينه · كشف أي شعبة · التنبيهات الوقائية.
 * لذلك لا يستورد هذا الملف mock/compliance.ts ولا mock/alerts.ts — والحارس الآلي
 * يفحص ذلك، فالمنع بنيوي لا اعتماداً على انتباه من يكتب الشاشة لاحقاً.
 */

export const DEPARTMENT = {
  name: "قسم الأحياء الدقيقة",
  university: "جامعة أم القرى",
  head: "د. فيصل بن محمد العتيبي",
};

export interface DeptMember {
  name: string;
  rank: string;
  courses: number;
  sections: number;
  students: number;
  hours: number;
  /** نسبة اكتمال ملفات الجودة عبر مقرراته الجارية */
  quality: number;
}

/** عضو هيئة التدريس صاحب الحساب: أرقامه مشتقّة من مقرراته الفعلية لا مكتوبة */
function ownAccount(): DeptMember {
  const active = COURSES.filter((c) => !c.fresh);
  const quality =
    active.reduce((sum, c) => {
      const { done, total } = qualityCount(c);
      return sum + done / total;
    }, 0) / Math.max(active.length, 1);
  return {
    name: "د. عبدالله الغامدي",
    rank: "أستاذ مشارك",
    courses: COURSES.length,
    sections: COURSES.reduce((s, c) => s + c.secs, 0),
    students: COURSES.reduce((s, c) => s + c.st, 0),
    hours: 18,
    quality: Math.round(quality * 100),
  };
}

export const MEMBERS: DeptMember[] = [
  ownAccount(),
  { name: "د. منى الشريف", rank: "أستاذ", courses: 4, sections: 7, students: 318, hours: 14, quality: 88 },
  { name: "د. هند العتيبي", rank: "أستاذ مساعد", courses: 3, sections: 5, students: 244, hours: 12, quality: 84 },
  { name: "د. ماجد الزهراني", rank: "أستاذ مشارك", courses: 4, sections: 6, students: 290, hours: 14, quality: 76 },
  { name: "د. نوف الحارثي", rank: "أستاذ مساعد", courses: 3, sections: 4, students: 198, hours: 10, quality: 71 },
  { name: "د. سامي القرني", rank: "أستاذ مساعد", courses: 4, sections: 6, students: 262, hours: 14, quality: 58 },
  { name: "د. ريم البقمي", rank: "محاضر", courses: 3, sections: 4, students: 175, hours: 9, quality: 44 },
];

export interface DeptQualityRow {
  code: string;
  name: string;
  member: string;
  done: number;
  total: number;
  missing: string;
}

/** ملفات جودة مقررات صاحب الحساب مشتقّة من ملفاته الفعلية */
function ownQualityRows(): DeptQualityRow[] {
  return COURSES.filter((c) => !c.fresh).map((c) => {
    const { done, total } = qualityCount(c);
    return {
      code: c.code,
      name: c.name,
      member: "د. عبدالله الغامدي",
      done,
      total,
      missing: done === total ? "—" : `${total - done} عناصر`,
    };
  });
}

export const QUALITY_ROWS: DeptQualityRow[] = [
  ...ownQualityRows(),
  { code: "CHM 205", name: "كيمياء حيوية", member: "د. منى الشريف", done: 11, total: 11, missing: "—" },
  { code: "MIC 480", name: "تقنية حيوية", member: "د. سامي القرني", done: 5, total: 11, missing: "6 عناصر" },
  { code: "BIO 110", name: "أحياء عامة", member: "د. ريم البقمي", done: 4, total: 11, missing: "7 عناصر" },
  { code: "PHY 301", name: "فيزياء حيوية", member: "د. هند العتيبي", done: 11, total: 11, missing: "—" },
];

export interface DeptResultRow {
  code: string;
  students: number;
  average: number;
  pass: number;
  attendance: number;
  histogram: number[];
}

export const RESULT_ROWS: DeptResultRow[] = [
  { code: "MIC 231", students: 184, average: 78.4, pass: 91, attendance: 92, histogram: [2, 4, 7, 9, 6, 3] },
  { code: "MIC 232", students: 152, average: 84.1, pass: 96, attendance: 95, histogram: [1, 3, 6, 10, 8, 4] },
  { code: "MIC 342", students: 96, average: 74.2, pass: 84, attendance: 88, histogram: [3, 5, 8, 7, 4, 2] },
  { code: "MIC 451", students: 41, average: 68.9, pass: 72, attendance: 81, histogram: [5, 7, 6, 5, 3, 1] },
  { code: "MIC 362", students: 38, average: 79.5, pass: 89, attendance: 90, histogram: [2, 3, 6, 8, 5, 3] },
  { code: "MIC 490", students: 22, average: 88.3, pass: 98, attendance: 94, histogram: [0, 1, 3, 7, 9, 5] },
];

/** الأرقام العليا محسوبة من الصفوف نفسها — لا رقم مكتوب مرتين */
export const DEPT_SUMMARY = {
  members: MEMBERS.length,
  courses: MEMBERS.reduce((s, m) => s + m.courses, 0),
  students: MEMBERS.reduce((s, m) => s + m.students, 0),
  qualityAverage: Math.round(MEMBERS.reduce((s, m) => s + m.quality, 0) / MEMBERS.length),
  filesComplete: QUALITY_ROWS.filter((r) => r.done === r.total).length,
  filesTotal: QUALITY_ROWS.length,
  passAverage: Math.round((RESULT_ROWS.reduce((s, r) => s + r.pass, 0) / RESULT_ROWS.length) * 10) / 10,
  attendanceAverage: Math.round(RESULT_ROWS.reduce((s, r) => s + r.attendance, 0) / RESULT_ROWS.length),
};
