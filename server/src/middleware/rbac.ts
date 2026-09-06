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
      // 404 لا 403 — وجود المساحة نفسها معلومة (الدستور §22)
      throw AppError.notFound();
    }

    req.workspaceId = membership.workspaceId;
    next();
  } catch (err) {
    next(err);
  }
}
