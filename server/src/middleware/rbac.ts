import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@mihwar/shared";
import { AppError } from "../lib/AppError.js";
import { prisma } from "../lib/prisma.js";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden("لا تملك صلاحية الوصول لهذا المورد"));
      return;
    }
    next();
  };
}

/**
 * يحسم workspaceId من عضوية المستخدم الفعلية — لا من body/query/params أبدًا (IDOR).
 * يُستخدم في مسارات مساحة العمل التي لا تحمل معرّف مورد فرعي بعد.
 */
export async function requireWorkspaceMembership(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.auth) throw AppError.unauthorized();

    const paramWorkspaceId = req.params.workspaceId;
    if (!paramWorkspaceId) throw AppError.badRequest("معرّف مساحة العمل مطلوب");

    // `me` = مساحة المستخدم نفسه. لعضو هيئة التدريس مساحة واحدة، فإجباره على حمل معرّفها
    // في كل مسار يعني نداءً إضافيًا قبل كل شاشة بلا فائدة. والحلّ يبقى آمنًا لأن المعرّف
    // يُحسم من العضوية لا من المسار — كما هو الحال في الفرع الآخر تمامًا.
    const membership =
      paramWorkspaceId === "me"
        ? await prisma.workspaceMember.findFirst({
            where: { userId: req.auth.userId },
            orderBy: { createdAt: "asc" },
            select: { workspaceId: true },
          })
        : await prisma.workspaceMember.findFirst({
            where: { workspaceId: paramWorkspaceId, userId: req.auth.userId },
            select: { workspaceId: true },
          });

    if (!membership) {
      // مساحة عمل مفقودة لعضو هيئة تدريس ليست حالة «غير موجود» بل خلل في حسابه:
      // كل أستاذ تُنشأ له مساحة عند التسجيل، وحساب قديم أو تسجيل انقطع قد يفقدها.
      // إرجاع 404 هنا كان يترك المستخدم أمام «المورد غير موجود» بلا ما يفعله — بلاغ
      // من المالك. فتُنشأ المساحة الناقصة بدل إغلاق الباب.
      if (paramWorkspaceId === "me" && req.auth.role === "TEACHER") {
        const created = await healWorkspace(req.auth.userId, req.auth.tenantId);
        req.workspaceId = created;
        next();
        return;
      }
      // 404 لا 403 — وجود المساحة نفسها معلومة (الدستور §22)
      throw AppError.notFound();
    }

    req.workspaceId = membership.workspaceId;
    next();
  } catch (err) {
    next(err);
  }
}


/**
 * يُنشئ مساحة العمل الناقصة لعضو هيئة تدريس.
 *
 * لا يُستدعى في التشغيل الطبيعي — التسجيل يُنشئها. وجوده لأن الحساب الذي يفقدها يصير
 * عاجزًا عن كل شيء بلا رسالة مفيدة، وهو ثمن باهظ لحالة نادرة.
 */
async function healWorkspace(userId: string, tenantId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { fullName: true },
  });

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const workspace = await tx.workspace.create({
      data: { tenantId, name: `مساحة ${user.fullName}`, ownerId: userId, planCode: "MIHWAR" },
    });
    await tx.workspaceMember.create({
      data: { tenantId, workspaceId: workspace.id, userId, role: "OWNER" },
    });
    return workspace.id;
  });
}
