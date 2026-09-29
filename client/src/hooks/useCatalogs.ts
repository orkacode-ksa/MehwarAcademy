import { useEffect, useState } from "react";
import { api } from "../api/client.js";

/** القوائم المقنّنة التي يديرها المالك (الإعدادات ← القوائم) — تُختار الحقول منها بدل كتابتها. */
export interface Catalogs {
  /** نطاقات البريد: الأستاذ من `staffDomains` والطالب من `studentDomains` (فارغة = أي نطاق أكاديمي) */
  universities: { key: string; name: string; staffDomains?: string[]; studentDomains?: string[] }[];
  termLabels: string[];
  holidays: string[];
  levels: string[];
  teachingModes: string[];
  teachingStrategies: string[];
  assessmentMethods: string[];
  gradeComponents: string[];
  participationTypes: string[];
  specializations: string[];
  banks: string[];
  colleges: string[];
  departments: string[];
}

// نداء واحد تتشاركه كل الشاشات، ويُعاد بعد أن يحفظ المالك تعديلًا.
let shared: Promise<Catalogs | null> | null = null;
const load = () => (shared ??= api.get<Catalogs>("/public/catalogs").catch(() => null));
export const refreshCatalogs = () => {
  shared = null;
};

export function useCatalogs(): Catalogs | null {
  const [c, setC] = useState<Catalogs | null>(null);
  useEffect(() => {
    let alive = true;
    void load().then((v) => alive && setC(v));
    return () => {
      alive = false;
    };
  }, []);
  return c;
}

/** قائمة اختيار تحفظ القيمة القديمة إن لم تعد في القائمة (بيانات سابقة لا تُمحى بصمت). */
export function withCurrent(options: string[], current: string | null | undefined): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}
