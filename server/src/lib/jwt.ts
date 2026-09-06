import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { UserRole } from "@mihwar/shared";
import { env } from "../config/env.js";
import { ACCESS_TOKEN_TTL_SECONDS } from "../config/constants.js";

export interface AccessTokenPayload {
  userId: string;
  /** حدّ العزل. يُقرأ منه وحده — لا من body ولا query ولا params (انظر lib/tenantContext.ts). */
  tenantId: string;
  role: UserRole;
  tv: number;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  return decoded as unknown as AccessTokenPayload;
}

export function newJti(): string {
  return crypto.randomUUID();
}
