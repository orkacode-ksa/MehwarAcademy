import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { env } from "../../config/env.js";
import { storeSummary } from "../store/store.service.js";
import { spentThisMonthSar } from "../platform/aiBudget.js";
import { getPlatformSettings } from "../platform/settings.js";
import { ownerMfaRequired } from "../account/mfa.js";
import * as notifications from "../notifications/notifications.service.js";
import type { StaffScreen } from "./staff.service.js";

/**
 * الرئيسية في لوحة الإدارة — للمالك وكل موظف أيًّا كانت شاشاته.
 *
 * **المحتوى يُبنى هنا لا في المتصفح:** الصلاحيات تُقرأ من القاعدة مع كل طلب، ولا يُستعلم عن
 * قسم لا يملكه صاحب الطلب أصلًا — فلا رقم ولا اسم يصل للمتصفح ثم يُخفى بالواجهة. إخفاء في
 * الواجهة وحده يكشفه أي أحد يفتح أدوات المطوّر.
 */
type Tone = "crim" | "amber" | "teal";
interface Alert { tone: Tone; text: string; link?: string }
interface Tile { label: string; value: string; hint?: string; link?: string; tone?: Tone }
interface QueueItem { title: string; sub: string; link: string }
interface Queue { title: string; link: string; empty: string; items: QueueItem[] }
interface Section { key: StaffScreen | "team"; title: string; tiles: Tile[]; queues: Queue[] }

const sar = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س`;
const DAY = 864e5;

export async function dashboard(userId: string) {
  const me = await prismaBase.user.findUnique({ where: { id: userId }, select: { fullName: true, role: true, staffScreens: true, totpEnabled: true, suspendedAt: true } });
  if (!me || me.suspendedAt || (me.role !== "OWNER" && me.role !== "ADMIN")) throw AppError.forbidden();
  const isOwner = me.role === "OWNER";
  const can = (s: StaffScreen) => isOwner || me.staffScreens.includes(s);

  const alerts: Alert[] = [];
  const sections: Section[] = [];
  const needPulse = can("institutions") || can("users");
  const pulse = needPulse
    ? (await prismaBase.$queryRaw<{ trialsEnding: number; pendingSubmissions: number; pendingUniversities: number }[]>`
        SELECT * FROM mihwar_owner_pulse(${new Date(Date.now() + 3 * DAY)}::timestamp)`)[0]
    : null;

  // الطلبات أولًا: مال ينتظر قرارًا.
  if (can("payments")) {
    const [s, queue] = await Promise.all([
      storeSummary(),
      prismaBase.order.findMany({
        where: { status: "UNDER_REVIEW" },
        orderBy: { submittedAt: "asc" },
        take: 5,
        select: { number: true, titleAr: true, amount: true, submittedAt: true, payerName: true },
      }),
    ]);
    if (s.pendingReview > 0) alerts.push({ tone: "amber", text: `${s.pendingReview} إيصال تحويل بانتظار اعتمادك`, link: "/payments" });
    sections.push({
      key: "payments",
      title: "المدفوعات",
      tiles: [
        { label: "بانتظار الاعتماد", value: String(s.pendingReview), link: "/payments", tone: s.pendingReview ? "amber" : undefined },
        { label: "إيراد الشهر", value: sar(s.monthRevenue), hint: `${s.monthOrders} طلبًا معتمدًا` },
        { label: "رسوم الشحن هذا الشهر", value: sar(s.monthCreditFees) },
        { label: "أرصدة غير مستهلكة", value: sar(s.walletLiability), hint: "التزام استخدام — لا يُعدّ ربحًا" },
      ],
      queues: [
        {
          title: "إيصالات بانتظار المراجعة",
          link: "/payments",
          empty: "لا إيصالات معلّقة.",
          items: queue.map((o) => ({ title: `${o.titleAr} · ${sar(Number(o.amount))}`, sub: `#${o.number}${o.payerName ? ` · ${o.payerName}` : ""}`, link: "/payments" })),
        },
      ],
    });
  }

  if (can("institutions") && pulse) {
    const [listed, total] = await Promise.all([
      prismaBase.tenant.count({ where: { listed: true, deletedAt: null } }),
      prismaBase.tenant.count({ where: { deletedAt: null } }),
    ]);
    if (pulse.pendingUniversities > 0) alerts.push({ tone: "amber", text: `لوائح ${pulse.pendingUniversities} جامعة بانتظار المراجعة`, link: "/osubmissions" });
    sections.push({
      key: "institutions",
      title: "الجامعات",
      tiles: [
        { label: "جامعات معتمدة", value: String(listed), hint: `من ${total} مساحة`, link: "/institutions" },
        { label: "ملفات لوائح بانتظارك", value: String(pulse.pendingSubmissions), link: "/osubmissions", tone: pulse.pendingSubmissions ? "amber" : undefined },
      ],
      queues: [],
    });
  }

  if (can("users") && pulse) {
    const since = new Date(Date.now() - 7 * DAY);
    const [teachers, fresh, latest] = await Promise.all([
      prismaBase.user.count({ where: { role: "TEACHER", deletedAt: null } }),
      prismaBase.user.count({ where: { role: "TEACHER", deletedAt: null, createdAt: { gte: since } } }),
      prismaBase.user.findMany({
        where: { role: "TEACHER", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { fullName: true, createdAt: true, tenant: { select: { name: true } } },
      }),
    ]);
    sections.push({
      key: "users",
      title: "المستخدمون",
      tiles: [
        { label: "الأساتذة", value: String(teachers), link: "/ousers" },
        { label: "جدد هذا الأسبوع", value: String(fresh), link: "/ousers", tone: fresh ? "teal" : undefined },
        { label: "تجارب تنتهي خلال ٣ أيام", value: String(pulse.trialsEnding), link: "/ousers", tone: pulse.trialsEnding ? "amber" : undefined },
      ],
      queues: [
        {
          title: "أحدث المسجّلين",
          link: "/ousers",
          empty: "لا تسجيلات بعد.",
          items: latest.map((u) => ({ title: u.fullName, sub: `${u.tenant.name} · ${u.createdAt.toISOString().slice(0, 10)}`, link: "/ousers" })),
        },
      ],
    });
  }

  if (can("bank")) {
    const where = { OR: [{ status: "PENDING" }, { draftAt: { not: null } }] };
    const [pending, published, queue] = await Promise.all([
      prismaBase.bankCourse.count({ where }),
      prismaBase.bankCourse.count({ where: { status: "PUBLISHED" } }),
      prismaBase.bankCourse.findMany({ where, orderBy: { updatedAt: "asc" }, take: 5, select: { title: true, code: true, university: true, draftAt: true } }),
    ]);
    if (pending > 0) alerts.push({ tone: "amber", text: `${pending} مقررًا في البنك بانتظار المراجعة`, link: "/obank" });
    sections.push({
      key: "bank",
      title: "بنك المقررات",
      tiles: [
        { label: "بانتظار المراجعة", value: String(pending), link: "/obank", tone: pending ? "amber" : undefined },
        { label: "منشورة", value: String(published), link: "/obank" },
      ],
      queues: [
        {
          title: "مقررات بانتظار القرار",
          link: "/obank",
          empty: "لا شيء بانتظارك.",
          items: queue.map((b) => ({ title: `${b.title} (${b.code})`, sub: `${b.university}${b.draftAt ? " · نسخة محدّثة" : " · جديد"}`, link: "/obank" })),
        },
      ],
    });
  }

  if (can("settings")) {
    const [spent, settings] = await Promise.all([spentThisMonthSar(), getPlatformSettings()]);
    const budget = settings.ai.monthlyBudgetSar;
    const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    if (budget > 0 && pct >= 80) alerts.push({ tone: pct >= 100 ? "crim" : "amber", text: `تكلفة المحرّك بلغت ${pct}٪ من ميزانية الشهر`, link: "/osettings" });
    sections.push({
      key: "settings",
      title: "التكلفة والإعدادات",
      tiles: [{ label: "تكلفة المحرّك هذا الشهر", value: sar(spent), hint: budget > 0 ? `${pct}٪ من ${sar(budget)}` : "بلا سقف", link: "/osettings", tone: pct >= 100 ? "crim" : pct >= 80 ? "amber" : undefined }],
      queues: [],
    });
  }

  // أمان المنصة وفريقها — للمالك وحده.
  if (isOwner) {
    const staff = await prismaBase.user.findMany({ where: { role: "ADMIN", deletedAt: null, suspendedAt: null }, select: { totpEnabled: true } });
    const noMfa = staff.filter((s) => !s.totpEnabled).length;
    if (!me.totpEnabled) alerts.unshift({ tone: "crim", text: "حسابك بلا تحقق بخطوتين — فعّله من «حسابي» ← الأمان", link: "/account" });
    if (env.OWNER_INITIAL_PASSWORD) alerts.unshift({ tone: "crim", text: "احذف متغير OWNER_INITIAL_PASSWORD من إعدادات الخادم بعد تغيير كلمة مرورك" });
    if (!env.EMAIL_PROVIDER_API_KEY && env.NODE_ENV === "production") alerts.push({ tone: "crim", text: "البريد غير مفعّل: رسائل استعادة كلمة المرور والتنبيهات لا تُرسل" });
    if (noMfa > 0 && ownerMfaRequired()) alerts.push({ tone: "amber", text: `${noMfa} من الفريق لم يفعّل التحقق بخطوتين — لن يفتح لوحة الإدارة حتى يفعّله`, link: "/ostaff" });
    sections.push({
      key: "team",
      title: "الفريق",
      tiles: [{ label: "موظفون نشطون", value: String(staff.length), hint: noMfa ? `${noMfa} بلا تحقق بخطوتين` : undefined, link: "/ostaff" }],
      queues: [],
    });
  } else if (!me.totpEnabled) {
    alerts.unshift({ tone: "crim", text: "فعّل التحقق بخطوتين من «حسابي» ← الأمان", link: "/account" });
  }

  const feed = await notifications.feed(userId);
  return {
    name: me.fullName,
    role: me.role,
    alerts,
    sections,
    notifications: { unread: feed.unread, items: feed.items.slice(0, 6) },
  };
}
