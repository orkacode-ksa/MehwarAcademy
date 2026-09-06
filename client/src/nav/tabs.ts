export interface TabDef {
  key: string;
  label: string;
}

/** تبويبات صفحة المقرر — منسوخة من `CT.*` في البروتوتايب (دورة المقرر بالترتيب) */
export const COURSE_TABS: TabDef[] = [
  { key: "overview", label: "نظرة عامة" },
  { key: "sections", label: "الشعب" },
  { key: "general", label: "البيانات العامة" },
  { key: "lectures", label: "المحاضرات" },
  { key: "lab", label: "المعمل" },
  { key: "tasks", label: "التكاليف" },
  { key: "exams", label: "الاختبارات" },
  { key: "grades", label: "الدرجات" },
  { key: "quality", label: "الجودة" },
];

/** تبويبات صفحة مقرر الطالب — منسوخة من `SCT.*` في البروتوتايب */
export const STUDENT_COURSE_TABS: TabDef[] = [
  { key: "slect", label: "المحاضرات" },
  { key: "smat", label: "المواد" },
  { key: "sgr", label: "درجاتي" },
  { key: "satt", label: "حضوري" },
];
