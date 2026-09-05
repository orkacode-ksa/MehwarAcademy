import type { IconName } from "../icons/Icon.js";
import { COURSES } from "./courses.js";

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
  { title: "مؤشر الالتزام", desc: "٣٢ بنداً", go: "rules", icon: "shield" },
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
  { title: "تصدير ملف الجودة", desc: "١١ عنصراً بصيغة PDF", go: "act:صُدِّر ملف الجودة بصيغة PDF", icon: "down" },
];

export const FIND: FindGroup[] = [
  ["شاشات", SCREENS],
  ["المقررات", COURSE_ITEMS],
  ["إجراءات", ACTIONS],
];

export function filterFind(query: string): FindGroup[] {
  const q = query.trim();
  if (!q) return FIND;
  return FIND.map(([label, items]) => [label, items.filter((i) => i.title.includes(q) || i.desc.includes(q))] as FindGroup).filter(
    ([, items]) => items.length > 0,
  );
}
