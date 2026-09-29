import type { Request, Response } from "express";
import type { RegisterInput } from "@mihwar/shared";
import { env } from "../../config/env.js";
import { hashPassword } from "../../lib/password.js";
import { resendCode, startSignup, verifySignup } from "./signupVerify.js";
import * as authService from "./auth.service.js";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE_NAME } from "../../lib/cookies.js";
import { resolveClientIp } from "../../middleware/cfOrigin.js";
import { AppError } from "../../lib/AppError.js";
import { getMe as getMeService, logoutAllDevices } from "./auth.service.js";

/**
 * التسجيل يبدأ بإرسال رمز إلى البريد (202 + معرّف الطلب)، والحساب يُنشأ في `verifyRegistration`.
 * بلا تأكيد (الاختبارات الآلية وحدها) يُنشأ الحساب مباشرة كما كان.
 */
export async function register(req: Request, res: Response): Promise<void> {
  if (env.SIGNUP_EMAIL_VERIFICATION === "on") {
    res.status(202).json({ success: true, data: await startSignup("REGISTER", req.body) });
    return;
  }
  const { password, ...rest } = req.body as RegisterInput;
  const result = await authService.registerUser({ ...rest, passwordHash: await hashPassword(password) }, { ip: resolveClientIp(req), userAgent: req.header("User-Agent") });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({ success: true, data: { userId: result.userId } });
}

export async function joinSection(req: Request, res: Response): Promise<void> {
  if (env.SIGNUP_EMAIL_VERIFICATION === "on") {
    res.status(202).json({ success: true, data: await startSignup("JOIN", req.body) });
    return;
  }
  const { password, ...rest } = req.body as { password: string; joinCode: string; universityIdNumber: string; fullName: string; email: string };
  const result = await authService.joinSection({ ...rest, passwordHash: await hashPassword(password) }, { ip: resolveClientIp(req), userAgent: req.header("User-Agent") });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({ success: true, data: { userId: result.userId } });
}

export async function verifyRegistration(req: Request, res: Response): Promise<void> {
  const result = await verifySignup(req.body.verificationId, req.body.code, { ip: resolveClientIp(req), userAgent: req.header("User-Agent") });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({ success: true, data: { userId: result.userId, role: result.kind === "JOIN" ? "STUDENT" : "TEACHER" } });
}

export async function resendRegistrationCode(req: Request, res: Response): Promise<void> {
  await resendCode(req.body.verificationId);
  res.json({ success: true, data: null });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.loginUser(req.body, { ip: resolveClientIp(req), userAgent: req.header("User-Agent") });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(200).json({ success: true, data: { userId: result.userId } });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw AppError.unauthorized("لا توجد جلسة");
  const result = await authService.refreshTokens(token, { ip: resolveClientIp(req), userAgent: req.header("User-Agent") });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(200).json({ success: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[REFRESH_COOKIE_NAME];
  await authService.logoutUser(token);
  clearAuthCookies(res);
  res.status(200).json({ success: true });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  await logoutAllDevices(req.auth.userId);
  clearAuthCookies(res);
  res.status(200).json({ success: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw AppError.unauthorized();
  const user = await getMeService(req.auth.userId);
  res.status(200).json({ success: true, data: user });
}
