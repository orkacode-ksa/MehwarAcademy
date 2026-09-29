import { AppError } from "./AppError.js";
import { env } from "../config/env.js";

/**
 * البريد الجامعي شرط للتسجيل — أستاذًا وطالبًا. مع رمز التأكيد (يثبت أن صاحب البريد هو من
 * يسجّل) يمنع هذا انتحال الأستاذ: الطالب لا يملك بريد أعضاء هيئة التدريس فلا يصله رمزه.
 *
 * - جامعة في القائمة بنطاقات محددة (يضبطها المالك): بريد الأستاذ من نطاق الأعضاء، وبريد
 *   الطالب من نطاق الطلاب.
 * - بلا نطاقات محددة: أي نطاق أكاديمي (edu · ac)، ولا بريد شخصي.
 * - بريد جزؤه الأول رقم جامعي (441000123@ · s441000123@) بريد طالب — لا يسجّل به أستاذ.
 */
export interface UniversityDomains {
  staffDomains?: string[];
  studentDomains?: string[];
}

const PERSONAL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.sa", "outlook.com", "outlook.sa", "live.com", "msn.com",
  "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "mail.com", "gmx.com", "yandex.com", "zoho.com", "tutanota.com",
]);

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();
const localOf = (email: string) => email.slice(0, email.lastIndexOf("@")).toLowerCase();

/** نطاق أكاديمي: ‎.edu · ‎.edu.xx · ‎.ac.xx (و‎.test خارج الإنتاج للتجارب وحدها). */
export function isAcademicDomain(domain: string): boolean {
  if (env.NODE_ENV !== "production" && domain.endsWith(".test")) return true;
  return /(^|\.)edu(\.[a-z]{2})?$/.test(domain) || /(^|\.)ac\.[a-z]{2}$/.test(domain);
}

const looksLikeStudentId = (local: string) => /^[a-z]{0,2}\d{6,}$/.test(local);

export function assertTeacherEmail(email: string, uni?: UniversityDomains | null): void {
  const d = domainOf(email);
  const staff = uni?.staffDomains ?? [];
  const student = uni?.studentDomains ?? [];
  if (PERSONAL.has(d)) throw AppError.badRequest("سجّل ببريدك الجامعي — البريد الشخصي لا يُقبل");
  if (student.includes(d) && !staff.includes(d)) throw AppError.badRequest("هذا بريد طلاب — سجّل ببريد أعضاء هيئة التدريس في جامعتك");
  if (looksLikeStudentId(localOf(email))) throw AppError.badRequest("هذا يبدو بريد طالب — سجّل ببريد أعضاء هيئة التدريس في جامعتك");
  if (staff.length ? !staff.includes(d) : !isAcademicDomain(d)) {
    throw AppError.badRequest(staff.length ? `سجّل ببريدك الجامعي (@${staff[0]})` : "سجّل ببريدك الجامعي");
  }
}

export function assertStudentEmail(email: string, uni?: UniversityDomains | null): void {
  const d = domainOf(email);
  const student = uni?.studentDomains ?? [];
  if (PERSONAL.has(d)) throw AppError.badRequest("سجّل ببريدك الجامعي — البريد الشخصي لا يُقبل");
  if (student.length ? !student.includes(d) : !isAcademicDomain(d)) {
    throw AppError.badRequest(student.length ? `سجّل ببريدك الجامعي (@${student[0]})` : "سجّل ببريدك الجامعي");
  }
}
