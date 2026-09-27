import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { logger } from "../lib/logger.js";
import { getPlatformSettings } from "../modules/platform/settings.js";
import { harvestSemester } from "../modules/bank/bank.service.js";

/**
 * الإقفال الآلي للفصول: فصل انتهى وانقضت بعده مهلة الرصد (من إعدادات المالك) يُقفل وحده،
 * فتصير بياناته للقراءة وتُسحب مقرراته للبنك. لا يعتمد على تذكّر أحد.
 *
 * آمن مع أكثر من نسخة خادم: التحديث مشروط بالحالة، فمن يسبق يُقفل والآخر لا يجد شيئًا.
 */
export async function closeDueTerms(now = new Date()): Promise<number> {
  const { term } = await getPlatformSettings();
  const cutoff = new Date(now.getTime() - term.autoCloseDaysAfterEnd * 864e5);
  // المستأجرون خارج العزل (جدول التعريف نفسه)؛ فصول كل جامعة تُقرأ في سياقها.
  const tenants = await prismaBase.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
  let closed = 0;
  for (const t of tenants) {
    const due = await withExplicitTenantTx(t.id, async (tx) => {
      const terms = await tx.semester.findMany({
        where: { status: { in: ["ACTIVE", "GRADING"] }, endDate: { lt: cutoff }, deletedAt: null },
        select: { id: true },
      });
      const ids: string[] = [];
      for (const s of terms) {
        const r = await tx.semester.updateMany({ where: { id: s.id, status: { in: ["ACTIVE", "GRADING"] } }, data: { status: "CLOSED", closedAt: now } });
        if (r.count) ids.push(s.id);
      }
      return ids;
    });
    for (const id of due) {
      await runWithTenant({ tenantId: t.id, userId: "system" }, () => harvestSemester(t.id, id)).catch((err) =>
        logger.error({ err, semesterId: id }, "تعذّر سحب مقررات الفصل للبنك"),
      );
      closed++;
    }
  }
  if (closed) logger.info({ closed }, "أُقفلت فصول انتهت مهلتها");
  return closed;
}

export function startTermCloser(): void {
  const tick = () => void closeDueTerms().catch((err) => logger.error({ err }, "فشل الإقفال الآلي للفصول"));
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 60 * 60_000).unref();
}
