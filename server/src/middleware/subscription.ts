import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/AppError.js";
import { getEntitlements } from "../modules/store/entitlements.js";

/**
 * بعد انتهاء التجربة أو الاشتراك: القراءة مسموحة (البيانات ملك الأستاذ ولا تُحتجز)، والكتابة
 * تطلب الاشتراك. يُركَّب بعد `requireWorkspaceMembership` لأنه يحتاج المساحة المحسومة.
 * الطالب ورئيس القسم لا يمرّان بمسارات الكتابة هذه أصلًا.
 */
export async function requireActiveAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.method === "GET" || req.method === "HEAD" || req.auth?.role !== "TEACHER" || !req.workspaceId) return next();
    const ent = await getEntitlements(req.workspaceId);
    if (ent.status === "EXPIRED") {
      throw new AppError(402, "SUBSCRIPTION_REQUIRED", "انتهت فترة التجربة — اشترك في «محور» أو «محور برو» لتكمل عملك. بياناتك محفوظة كما هي.");
    }
    next();
  } catch (err) {
    next(err);
  }
}
