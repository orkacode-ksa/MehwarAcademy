import { prismaBase } from "../lib/prisma.js";
import { prunePendingSignups } from "../modules/auth/signupVerify.js";
import { logger } from "../lib/logger.js";
import { getPlatformSettings } from "../modules/platform/settings.js";
import { spentThisMonthSar } from "../modules/platform/aiBudget.js";
import { notifyOnce, notifyOwnersOnce } from "../modules/notifications/notify.js";

/**
 * تنبيهات لا يُطلقها حدث بل الوقت. تعمل كل ساعة، وكل تنبيه «مرة» في نافذته،
 * فتكرار التشغيل (أو أكثر من نسخة خادم) لا يكرّره.
 */
export async function hourlyNotices(now = new Date()): Promise<void> {
  // ١) قرب انتهاء التجربة (خلال ٥ أيام) — للأستاذ.
  const ending = await prismaBase.$queryRaw<{ tenantId: string; userId: string; trialEndsAt: Date }[]>`
    SELECT * FROM mihwar_trials_ending(${now}::timestamp, ${new Date(now.getTime() + 5 * 864e5)}::timestamp)`;
  for (const t of ending) {
    const days = Math.max(1, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 864e5));
    await notifyOnce(t.tenantId, t.userId, { kind: "TRIAL_ENDING", title: `تنتهي تجربتك بعد ${days} ${days === 1 ? "يوم" : "أيام"}`, body: "اشترك ليبقى التعديل متاحًا — بياناتك محفوظة في كل حال.", link: "/plans" }, 10);
  }

  // ٢) جامعات معتمدة بلا فصل مفتوح — للمالك، مرة أسبوعيًا لكل جامعة.
  const bare = await prismaBase.$queryRaw<{ tenantId: string; name: string }[]>`SELECT * FROM mihwar_listed_without_term()`;
  for (const u of bare) {
    await notifyOwnersOnce({ kind: "TERM_MISSING", title: `لا فصل مفتوح في «${u.name}»`, body: "أساتذتها لا يستطيعون إضافة مقرر حتى تفتح فصلًا في تقويمها.", link: `/institutions/${u.tenantId}/calendar` }, 7);
  }

  // ٣) إنفاق المحرّك ≥ ٨٠٪ من السقف — للمالك، مرة في الشهر.
  const { ai } = await getPlatformSettings();
  const spent = await spentThisMonthSar();
  if (ai.monthlyBudgetSar > 0 && spent >= ai.monthlyBudgetSar * 0.8) {
    const month = now.toISOString().slice(0, 7);
    await notifyOwnersOnce({ kind: "BUDGET_80", title: `بلغ إنفاق المحرّك ${Math.round((spent / ai.monthlyBudgetSar) * 100)}٪ من سقف الشهر`, body: "عند بلوغ السقف يتوقف التوليد والمساعد حتى أول الشهر.", link: `/osettings#${month}` }, 31);
  }

  // ٤) تنظيف: طلبات التسجيل التي لم تُؤكَّد، والإشعارات أقدم من ٩٠ يومًا.
  await prunePendingSignups(now);
  const rows = await prismaBase.$queryRaw<{ n: number }[]>`SELECT mihwar_prune_notifications(${new Date(now.getTime() - 90 * 864e5)}::timestamp) AS n`;
  const n = rows[0]?.n ?? 0;
  if (n) logger.info({ pruned: n }, "حُذفت إشعارات قديمة");
}
