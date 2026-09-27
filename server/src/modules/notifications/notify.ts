import { prismaBase, withExplicitTenantTx } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

export interface NoticeInput {
  kind: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * يكتب إشعارًا لمستخدمين في جامعة واحدة. لا يُفشل العملية التي استدعته أبدًا:
 * اعتماد طلب أو إقفال فصل أهم من إشعاره، فالخطأ يُسجَّل ويُبتلع.
 */
export async function notify(tenantId: string, userIds: string[], n: NoticeInput): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  try {
    await withExplicitTenantTx(tenantId, (tx) =>
      tx.notification.createMany({
        data: ids.map((userId) => ({ tenantId, userId, kind: n.kind, title: n.title.slice(0, 200), body: (n.body ?? "").slice(0, 500), link: n.link ?? null })),
      }),
    );
  } catch (err) {
    logger.warn({ err, kind: n.kind }, "تعذّر حفظ الإشعار");
  }
}

/** للمالك (أو المالكين) — كلٌّ في جامعته الإدارية. */
export async function notifyOwners(n: NoticeInput): Promise<void> {
  const owners = await prismaBase.user.findMany({ where: { role: "OWNER", deletedAt: null }, select: { id: true, tenantId: true } });
  const byTenant = new Map<string, string[]>();
  for (const o of owners) byTenant.set(o.tenantId, [...(byTenant.get(o.tenantId) ?? []), o.id]);
  await Promise.all([...byTenant].map(([t, ids]) => notify(t, ids, n)));
}

/**
 * «مرة واحدة»: لا يُكرَّر إشعار من النوع نفسه للمستخدم خلال النافذة — للمهام الدورية
 * (قرب انتهاء التجربة · جامعة بلا فصل) التي تعمل كل ساعة.
 */
export async function notifyOnce(tenantId: string, userId: string, n: NoticeInput, windowDays: number): Promise<void> {
  const since = new Date(Date.now() - windowDays * 864e5);
  const exists = await withExplicitTenantTx(tenantId, (tx) =>
    tx.notification.findFirst({ where: { userId, kind: n.kind, link: n.link ?? null, createdAt: { gte: since } }, select: { id: true } }),
  );
  if (!exists) await notify(tenantId, [userId], n);
}

export async function notifyOwnersOnce(n: NoticeInput, windowDays: number): Promise<void> {
  const owners = await prismaBase.user.findMany({ where: { role: "OWNER", deletedAt: null }, select: { id: true, tenantId: true } });
  for (const o of owners) await notifyOnce(o.tenantId, o.id, n, windowDays);
}
