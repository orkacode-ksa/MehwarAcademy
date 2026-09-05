import type { IconName } from "../icons/Icon.js";
import { COURSES, courseById } from "./courses.js";
import { ENROLLMENTS } from "./student.js";

export interface FindItem {
  title: string;
  desc: string;
  go: string;
  icon: IconName;
}

export type FindGroup = [label: string, items: FindItem[]];

/** منسوخ حرفيًا من ثابت `FIND` في mihwar-prototype-v2.html (مقيَّد بدور عضو هيئة التدريس حاليًا) */
const SCREENS: FindItem[] = [
  { title: "اللوحة", desc: "نظرة عامة على مقرراتك", go: "home", icon: "grid" },
  { title: "مقرراتي", desc: `${COURSES.length} مقررات`, go: "courses", icon: "book" },
  { title: "استوديو التوليد", desc: "من الموضوع إلى المحاضرة", go: "studio", icon: "sparks" },
  { title: "جلسة الحضور", desc: "رصد بثلاث طرق", go: "attend", icon: "users" },
  { title: "الساعات المكتبية", desc: "تنسيق المواعيد", go: "office", icon: "clock" },
  { title: "بنك المقرر", desc: "حصيلة أربعة فصول", go: "bank", icon: "box" },
  { title: "مؤشر الالتزام", desc: "32 بنداً", go: "rules", icon: "shield" },
  { title: "التقييم السنوي", desc: "مرآة تنبؤية", go: "evalp", icon: "chart" },
  { title: "التنبيهات الوقائية", desc: "ما يستحق قبل موعده", go: "alerts", icon: "alert" },
  { title: "الأرشيف", desc: "السنوات السابقة", go: "archive", icon: "arch" },
  { title: "الإعدادات", desc: "الحساب والاشتراك", go: "settings", icon: "gear" },
];

const COURSE_ITEMS: FindItem[] = COURSES.map((c) => ({
  title: `${c.code} — ${c.name}`,
  desc: `${c.st} طالباً · ${c.secs} شعب`,
  go: `course:${c.id}`,
  icon: "book",
}));

const ACTIONS: FindItem[] = [
  { title: "توليد محاضرة جديدة", desc: "خط الإنتاج الكامل", go: "studio", icon: "bolt" },
  { title: "إنشاء اختبار", desc: "من بنك الأسئلة", go: "exambuild", icon: "file" },
  { title: "تصدير ملف الجودة", desc: "11 عنصراً بصيغة PDF", go: "act:صُدِّر ملف الجودة بصيغة PDF", icon: "down" },
];

const STUDENT_SCREENS: FindItem[] = [
  { title: "الرئيسية", desc: "ماذا عليك الآن", go: "shome", icon: "grid" },
  { title: "مقرراتي", desc: "محاضراتك وموادّك", go: "scourses", icon: "book" },
  { title: "درجاتي", desc: "أداؤك عبر مقرراتك", go: "sgrades", icon: "tbl" },
  { title: "مواعيدي", desc: "جدولك وتسليماتك", go: "sdates", icon: "clock" },
  { title: "الساعات المكتبية", desc: "حجز موعد مع أستاذك", go: "sbook", icon: "users" },
];

const STUDENT_COURSE_ITEMS: FindItem[] = ENROLLMENTS.map(({ courseId }) => {
  const c = courseById(courseId);
  return {
    title: c ? `${c.code} — ${c.name}` : "",
    desc: c?.instructor ?? "",
    go: `/scourse/${courseId}`,
    icon: "book" as IconName,
  };
}).filter((i) => i.title);

const FACULTY_FIND: FindGroup[] = [
  ["شاشات", SCREENS],
  ["المقررات", COURSE_ITEMS],
  ["إجراءات", ACTIONS],
];

const STUDENT_FIND: FindGroup[] = [
  ["شاشات", STUDENT_SCREENS],
  ["مقرراتي", STUDENT_COURSE_ITEMS],
];

/** فهرس البحث حسب الدور — كان الطالب يبحث فيجد «استوديو التوليد» و«بنك المقرر» */
export const FIND_BY_ROLE: Record<string, FindGroup[]> = { faculty: FACULTY_FIND, student: STUDENT_FIND };

export const FIND: FindGroup[] = FACULTY_FIND;

export function filterFind(query: string, role = "faculty"): FindGroup[] {
  const groups = FIND_BY_ROLE[role] ?? FACULTY_FIND;
  const q = query.trim();
  if (!q) return groups;
  return groups.map(([label, items]) => [label, items.filter((i) => i.title.includes(q) || i.desc.includes(q))] as FindGroup).filter(
    ([, items]) => items.length > 0,
  );
}
