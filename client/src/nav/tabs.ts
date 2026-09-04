import type { IconName } from "../icons/Icon.js";

export interface TabDef {
  key: string;
  label: string;
  icon: IconName;
  /** يظهر فقط للمقررات ذات الشق العملي */
  labOnly?: boolean;
}

/** تبويبات صفحة المقرر — منسوخة من CTABS في البروتوتايب (دورة المقرر بالترتيب) */
export const COURSE_TABS: TabDef[] = [
  { key: "overview", label: "نظرة عامة", icon: "grid" },
  { key: "sections", label: "الشعب والطلاب", icon: "users" },
  { key: "general", label: "البيانات العامة", icon: "book" },
  { key: "lectures", label: "المحاضرات", icon: "play" },
  { key: "lab", label: "العملي", icon: "flask", labOnly: true },
  { key: "tasks", label: "الواجبات والأنشطة", icon: "pen" },
  { key: "exams", label: "الاختبارات", icon: "file" },
  { key: "grades", label: "الدرجات", icon: "tbl" },
  { key: "quality", label: "الجودة", icon: "shield" },
];

/** تبويبات صفحة مقرر الطالب — منسوخة من `SCT.*` */
export const STUDENT_COURSE_TABS: TabDef[] = [
  { key: "slect", label: "المحاضرات", icon: "play" },
  { key: "smat", label: "المواد", icon: "box" },
  { key: "sgr", label: "درجاتي", icon: "tbl" },
  { key: "satt", label: "حضوري", icon: "users" },
];
