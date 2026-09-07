import type { IconName } from "../icons/Icon.js";

export type Role = "faculty" | "student" | "dept" | "admin";

export interface NavItem {
  key: string;
  icon: IconName;
  label: string;
}

/** منسوخ حرفيًا من ثابت `NAV` في mihwar-prototype-v2.html */
export const NAV: Record<Role, NavItem[]> = {
  faculty: [
    { key: "home", icon: "grid", label: "اللوحة" },
    { key: "courses", icon: "book", label: "مقرراتي" },
    { key: "studio", icon: "sparks", label: "الاستوديو" },
    { key: "attend", icon: "users", label: "الحضور" },
    { key: "office", icon: "clock", label: "الساعات" },
    { key: "bank", icon: "box", label: "البنك" },
    { key: "rules", icon: "shield", label: "الالتزام" },
    { key: "evalp", icon: "chart", label: "التقييم" },
    { key: "archive", icon: "arch", label: "الأرشيف" },
    { key: "settings", icon: "gear", label: "الإعدادات" },
  ],
  student: [
    { key: "shome", icon: "grid", label: "الرئيسية" },
    { key: "scourses", icon: "book", label: "مقرراتي" },
    { key: "sgrades", icon: "tbl", label: "درجاتي" },
    { key: "sdates", icon: "clock", label: "مواعيدي" },
    { key: "sbook", icon: "users", label: "الساعات المكتبية" },
  ],
  dept: [
    { key: "dhome", icon: "chart", label: "لوحة القسم" },
    { key: "dmembers", icon: "users", label: "الأعضاء" },
    { key: "dquality", icon: "shield", label: "الجودة" },
    { key: "dresults", icon: "tbl", label: "النتائج" },
  ],
  admin: [
    { key: "institutions", icon: "grid", label: "الجامعات" },
    { key: "biz", icon: "chart", label: "الأعمال" },
    { key: "cal", icon: "cal", label: "التقويم" },
    { key: "users", icon: "users", label: "المستخدمون" },
    { key: "subs", icon: "card", label: "الاشتراكات" },
    { key: "ai", icon: "sparks", label: "الذكاء" },
    { key: "ops", icon: "gear", label: "التشغيل" },
  ],
};

/** أول 4 عناصر تظهر في الشريط السفلي على الجوال، البقية عبر «المزيد» */
export const MOBILE_PRIMARY_COUNT = 4;

export const ROLE_HOME: Record<Role, string> = {
  // «مقرراتي» لا «اللوحة»: اللوحة صفحة بديلة، والأستاذ يدخل ليفتح مقرره.
  faculty: "courses",
  student: "shome",
  dept: "dhome",
  admin: "institutions",
};

export const ROLE_LABEL: Record<Role, string> = {
  faculty: "أستاذ",
  student: "طالب",
  dept: "رئيس قسم",
  admin: "مالك",
};

/** خريطة عكسية: مفتاح الشاشة → الدور المالك لها (لتضمين شاشات لا تظهر في NAV مثل course وexambuild) */
const EXTRA_SCREENS: Record<Role, string[]> = {
  faculty: ["course", "exambuild"],
  student: ["scourse"],
  dept: [],
  admin: ["institutions"],
};

export const SCREEN_TO_ROLE: Record<string, Role> = (() => {
  const map: Record<string, Role> = {};
  (Object.keys(NAV) as Role[]).forEach((role) => {
    NAV[role].forEach((item) => {
      map[item.key] = role;
    });
    EXTRA_SCREENS[role].forEach((key) => {
      map[key] = role;
    });
  });
  return map;
})();

export function roleOf(screenKey: string): Role {
  return SCREEN_TO_ROLE[screenKey] ?? "faculty";
}
