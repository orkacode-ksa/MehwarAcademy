import type { IconName } from "../icons/Icon.js";

export type Role = "faculty" | "student" | "dept" | "admin";

export interface NavItem {
  key: string;
  icon: IconName;
  label: string;
}

/** منسوخ حرفيًا من ثابت `NAV` في mihwar-prototype-v2.html */
export const NAV: Record<Role, NavItem[]> = {
  // الأستاذ: ثلاث وجهات لا عشر. كانت سبع منها صفحات بديلة، و«لا زرّ يقود إلى شاشة غير
  // مبنية» (lessons §٣.٧). «القسم» يظهر لرئيس القسم وحده (انظر visibleNav).
  faculty: [
    { key: "home", icon: "grid", label: "الرئيسية" },
    { key: "courses", icon: "book", label: "مقرراتي" },
    { key: "bank", icon: "box", label: "البنك" },
    { key: "today", icon: "clock", label: "محاضرة اليوم" },
    { key: "evalp", icon: "chart", label: "أدائي" },
    { key: "dhome", icon: "users", label: "القسم" },
  ],
  student: [{ key: "scourses", icon: "book", label: "مقرراتي" }],
  dept: [{ key: "dhome", icon: "users", label: "القسم" }],
  // المالك: التعقيد مسموح هنا وحده — خمس وجهات تغطي كل شيء.
  admin: [
    { key: "institutions", icon: "grid", label: "الجامعات" },
    { key: "ousers", icon: "users", label: "المستخدمون" },
    { key: "payments", icon: "card", label: "المدفوعات" },
    { key: "obank", icon: "box", label: "البنك" },
    { key: "osettings", icon: "gear", label: "الإعدادات" },
  ],
};

/** عناصر التنقّل التي يحقّ للمستخدم رؤيتها — «القسم» لرئيس القسم وحده. */
export function visibleNav(role: Role, isDeptHead: boolean): NavItem[] {
  return NAV[role].filter((i) => i.key !== "dhome" || isDeptHead || role === "dept");
}

/** أول 4 عناصر تظهر في الشريط السفلي على الجوال، البقية عبر «المزيد» */
export const MOBILE_PRIMARY_COUNT = 4;

export const ROLE_HOME: Record<Role, string> = {
  // الرئيسية للأستاذ: التنبيهات ومحاضرات اليوم وآخر مقرراته في شاشة واحدة.
  faculty: "home",
  student: "scourses",
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
  faculty: ["course", "plans", "orders", "cv", "university", "tasks"],
  student: ["scourse"],
  dept: [],
  admin: ["institutions", "ousers", "payments", "obank", "osettings", "osubmissions"],
};

export const SCREEN_TO_ROLE: Record<string, Role> = (() => {
  const map: Record<string, Role> = {};
  // «dhome» مذكور تحت الأستاذ والقسم معًا؛ يُنسب للأستاذ لأن رئيس القسم أستاذ.
  (["dept", "student", "admin", "faculty"] as Role[]).forEach((role) => {
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

/** شاشات لكل الأدوار (من رأس الصفحة): تأخذ تنقّل دور صاحبها لا دورًا ثابتًا. */
export const SHARED_SCREENS = new Set(["account", "notifications"]);

export function roleOfUser(role: string | undefined): Role {
  if (role === "STUDENT") return "student";
  if (role === "OWNER" || role === "ADMIN") return "admin";
  return "faculty";
}
