import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE_NAME } from "../../lib/cookies.js";
import { resolveClientIp } from "../../middleware/cfOrigin.js";
import { AppError } from "../../lib/AppError.js";
import { getMe as getMeService, logoutAllDevices } from "./auth.service.js";

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.registerUser(req.body, { ip: resolveClientIp(req), userAgent: req.header("User-Agent") });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({ success: true, data: { userId: result.userId } });
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
