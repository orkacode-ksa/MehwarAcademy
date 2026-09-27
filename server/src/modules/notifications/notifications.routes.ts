import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../lib/AppError.js";
import * as service from "./notifications.service.js";

/** ما يخص المستخدم نفسه أيًّا كان دوره: إشعاراته وشريط النظام. */
export const meRouter = Router();
meRouter.use(requireAuth);

const who = (req: { auth?: { userId: string; tenantId: string; role: string } }) => {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
};

meRouter.get("/notifications", asyncHandler(async (req, res) => res.json({ success: true, data: await service.feed(who(req).userId) })));
meRouter.get("/notifications/unread", asyncHandler(async (req, res) => res.json({ success: true, data: { unread: await service.unreadCount(who(req).userId) } })));
meRouter.post(
  "/notifications/seen",
  asyncHandler(async (req, res) => {
    await service.markSeen(who(req).userId);
    res.json({ success: true, data: null });
  }),
);
meRouter.get(
  "/strip",
  asyncHandler(async (req, res) => {
    const a = who(req);
    res.json({ success: true, data: await service.strip(a.tenantId, a.role) });
  }),
);
