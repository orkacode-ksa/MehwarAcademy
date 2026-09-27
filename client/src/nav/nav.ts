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
    { key: "today", icon: "clock", label: "اليوم" },
    { key: "courses", icon: "book", label: "مقرراتي" },
    { key: "bank", icon: "box", label: "البنك" },
    { key: "account", icon: "user", label: "حسابي" },
    { key: "evalp", icon: "chart", label: "أدائي" },
    { key: "dhome", icon: "users", label: "القسم" },
  ],
  student: [{ key: "scourses", icon: "book", label: "مقرراتي" }],
  dept: [{ key: "dhome", icon: "users", label: "القسم" }],
  // المالك: التعقيد مسموح هنا وحده — ومع ذلك أربع وجهات لا أكثر.
  admin: [
    { key: "institutions", icon: "grid", label: "الجامعات" },
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
  // «اليوم» للأستاذ: محاضرة اليوم هي القيمة اليومية، وتحيله لمقرراته إن لم يكن لديه شيء.
  faculty: "today",
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
  faculty: ["course", "plans", "orders", "cv", "university"],
  student: ["scourse"],
  dept: [],
  admin: ["institutions", "payments", "obank", "osettings", "osubmissions"],
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
