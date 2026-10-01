import { prismaBase } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { verifyPassword } from "../../lib/password.js";
import { forgetSessions } from "../../lib/sessionCache.js";

/** العبارة التي يكتبها المالك حرفيًا — فلا يُنفَّذ المسح بنقرة ولا بطلب مزوَّر. */
export const WIPE_PHRASE = "امسح المنصة";

/**
 * مسح بيانات المنصة كلها لحظة الانتقال من التجربة إلى الإنتاج.
 *
 * يُمسح: كل الجامعات غير جامعة الإدارة بمستخدميها ومقرراتها وطلابها وملفاتها ومحافظها،
 * والطلبات، وبنك المقررات، والتسجيلات المعلّقة، والإشعارات، وسجل الاستهلاك.
 * يبقى: حسابات المالك والموظفين وجامعتهم · الباقات والحسابات البنكية · إعدادات المنصة والقوائم.
 * وسجل التدقيق يبقى ما لم يُطلب مسحه صراحةً، وبعد المسح يُكتب فيه سطر واحد يقول ما جرى.
 *
 * ثلاثة شروط معًا: المالك نفسه (لا موظف) · كلمة مروره الآن · العبارة أعلاه.
 */
export async function wipePlatform(ownerId: string, input: { password: string; phrase: string; wipeAudit: boolean }) {
  const owner = await prismaBase.user.findFirst({ where: { id: ownerId, role: "OWNER", deletedAt: null }, select: { passwordHash: true } });
  if (!owner) throw AppError.forbidden("المسح للمالك وحده");
  if (!(await verifyPassword(owner.passwordHash, input.password))) throw AppError.badRequest("كلمة المرور غير صحيحة");
  if (input.phrase.trim() !== WIPE_PHRASE) throw AppError.badRequest(`اكتب «${WIPE_PHRASE}» كما هي للتأكيد`);

  // جامعات الإدارة: كل جامعة فيها مالك أو موظف. تبقى كما هي.
  const staff = await prismaBase.user.findMany({ where: { role: { in: ["OWNER", "ADMIN"] }, deletedAt: null }, select: { tenantId: true } });
  const keep = [...new Set(staff.map((s) => s.tenantId))];
  if (keep.length === 0) throw AppError.badRequest("لا حساب إدارة يُحفظ");

  // لا تبقى جلسة مخزّنة لمن سيُحذف
  const doomed = await prismaBase.user.findMany({ where: { tenantId: { notIn: keep } }, select: { id: true } });

  const [result] = await prismaBase.$queryRaw<{ tenants: number; users: number }[]>`SELECT * FROM mihwar_wipe_platform(${keep}::text[], ${input.wipeAudit})`;
  await forgetSessions(...doomed.map((u) => u.id));

  await recordAudit({
    userId: ownerId,
    action: "PLATFORM_WIPED",
    entityType: "Platform",
    after: { tenants: result?.tenants ?? 0, users: result?.users ?? 0, auditWiped: input.wipeAudit },
  });
  return { tenants: result?.tenants ?? 0, users: result?.users ?? 0, auditWiped: input.wipeAudit };
}
