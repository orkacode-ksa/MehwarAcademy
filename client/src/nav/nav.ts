import type { IconName } from "../icons/Icon.js";

export type Role = "faculty" | "student" | "dept" | "admin";

export interface NavItem {
  key: string;
  icon: IconName;
  label: string;
}

/** منسوخ حرفيًا من ثابت `NAV` في mihwar-prototype-v2.html */
const NAV: Record<Role, NavItem[]> = {
  // الأستاذ: ثلاث وجهات لا عشر. كانت سبع منها صفحات بديلة، و«لا زرّ يقود إلى شاشة غير
  // مبنية» (lessons §٣.٧). «القسم» يظهر لرئيس القسم وحده (انظر visibleNav).
  faculty: [
    { key: "home", icon: "home", label: "الرئيسية" },
    { key: "courses", icon: "book", label: "مقرراتي" },
    { key: "bank", icon: "box", label: "البنك" },
    { key: "today", icon: "clock", label: "محاضرة اليوم" },
    { key: "evalp", icon: "chart", label: "أدائي" },
    { key: "dhome", icon: "users", label: "القسم" },
  ],
  student: [
    { key: "scourses", icon: "book", label: "مقرراتي" },
    { key: "soffice", icon: "cal", label: "الساعات المكتبية" },
  ],
  dept: [{ key: "dhome", icon: "users", label: "القسم" }],
  // المالك: التعقيد مسموح هنا وحده — خمس وجهات تغطي كل شيء.
  admin: [
    { key: "ohome", icon: "home", label: "الرئيسية" },
    { key: "institutions", icon: "grid", label: "الجامعات" },
    { key: "ousers", icon: "users", label: "المستخدمون" },
    { key: "payments", icon: "card", label: "المدفوعات" },
    { key: "obank", icon: "box", label: "البنك" },
    { key: "osettings", icon: "gear", label: "الإعدادات" },
    { key: "ostaff", icon: "shield", label: "الفريق" },
    { key: "oaudit", icon: "eye", label: "السجل" },
    { key: "odata", icon: "arch", label: "البيانات" },
  ],
};

/** شاشة لوحة الإدارة ← صلاحية الموظف التي تفتحها. «الفريق» للمالك وحده. */
const STAFF_SCREEN_OF: Record<string, string> = {
  institutions: "institutions",
  osubmissions: "institutions",
  ousers: "users",
  payments: "payments",
  obank: "bank",
  osettings: "settings",
  ocatalogs: "settings",
};

interface NavUser {
  role?: string;
  isDeptHead?: boolean;
  staffScreens?: string[];
}

/** هل يحقّ لموظف الإدارة فتح هذه الشاشة؟ المالك: كل شيء. */
export function staffCan(user: NavUser | null | undefined, key: string): boolean {
  if (user?.role !== "ADMIN") return true;
  // الرئيسية لكل موظف؛ محتواها يصفّيه الخادم بصلاحياته.
  if (key === "ohome") return true;
  const screen = STAFF_SCREEN_OF[key];
  return !!screen && (user.staffScreens ?? []).includes(screen);
}

/** عناصر التنقّل التي يحقّ للمستخدم رؤيتها — «القسم» لرئيس القسم، وللموظف شاشاته فقط. */
export function visibleNav(role: Role, user: NavUser | null | undefined): NavItem[] {
  return NAV[role].filter((i) => (i.key !== "dhome" || !!user?.isDeptHead || role === "dept") && (role !== "admin" || staffCan(user, i.key)));
}

/** أول 4 عناصر تظهر في الشريط السفلي على الجوال، البقية عبر «المزيد» */
export const MOBILE_PRIMARY_COUNT = 4;

export const ROLE_HOME: Record<Role, string> = {
  // الرئيسية للأستاذ: التنبيهات ومحاضرات اليوم وآخر مقرراته في شاشة واحدة.
  faculty: "home",
  student: "scourses",
  dept: "dhome",
  admin: "ohome",
};

/** خريطة عكسية: مفتاح الشاشة → الدور المالك لها (لتضمين شاشات لا تظهر في NAV مثل course وexambuild) */
const EXTRA_SCREENS: Record<Role, string[]> = {
  faculty: ["course", "plans", "orders", "cv", "university", "tasks", "violations", "officehours"],
  student: ["scourse", "sexam"],
  dept: [],
  admin: ["ohome", "institutions", "ousers", "payments", "obank", "osettings", "osubmissions", "ocatalogs", "oaudit", "odata"],
};

const SCREEN_TO_ROLE: Record<string, Role> = (() => {
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
export const SHARED_SCREENS = new Set(["account", "notifications", "help"]);

export function roleOfUser(role: string | undefined): Role {
  if (role === "STUDENT") return "student";
  if (role === "OWNER" || role === "ADMIN") return "admin";
  return "faculty";
}

/**
 * شاشات يصلها المستخدم من داخل الصفحات لا من الشريط — تُلحق ببطاقات «المزيد» بعد عناصر
 * التنقّل (بلا تغيير ترتيبها) ليصل منه إلى كل شيء. للموظف ما تسمح به شاشاته فقط.
 */
const MORE_EXTRA: Record<Role, NavItem[]> = {
  faculty: [
    { key: "tasks", icon: "cal", label: "مهام اليوم" },
    { key: "violations", icon: "shield", label: "المخالفات" },
    { key: "officehours", icon: "clock", label: "الساعات المكتبية" },
    { key: "cv", icon: "file", label: "سيرتي" },
    { key: "university", icon: "shield", label: "جامعتي" },
    { key: "plans", icon: "star", label: "الباقات" },
    { key: "notifications", icon: "bell", label: "الإشعارات" },
    { key: "help", icon: "help", label: "المساعدة" },
    { key: "account", icon: "user", label: "حسابي" },
  ],
  student: [
    { key: "notifications", icon: "bell", label: "الإشعارات" },
    { key: "help", icon: "help", label: "المساعدة" },
    { key: "account", icon: "user", label: "حسابي" },
  ],
  dept: [
    { key: "notifications", icon: "bell", label: "الإشعارات" },
    { key: "help", icon: "help", label: "المساعدة" },
    { key: "account", icon: "user", label: "حسابي" },
  ],
  admin: [
    { key: "osubmissions", icon: "file", label: "لوائح الجامعات" },
    { key: "ocatalogs", icon: "tbl", label: "القوائم" },
    { key: "notifications", icon: "bell", label: "الإشعارات" },
    { key: "help", icon: "help", label: "المساعدة" },
    { key: "account", icon: "user", label: "حسابي" },
  ],
};

export function moreItems(role: Role, user: NavUser | null | undefined): NavItem[] {
  const base = visibleNav(role, user);
  const seen = new Set(base.map((i) => i.key));
  const extra = MORE_EXTRA[role].filter((i) => !seen.has(i.key) && (role !== "admin" || SHARED_SCREENS.has(i.key) || staffCan(user, i.key)));
  return [...base, ...extra];
}
