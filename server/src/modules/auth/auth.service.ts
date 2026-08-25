import type { RegisterInput, LoginInput } from "@mihwar/shared";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAccessToken, newJti } from "../../lib/jwt.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { cacheDel } from "../../lib/redis.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { REFRESH_TOKEN_TTL_DAYS, TRIAL_DAYS } from "../../config/constants.js";
import { logger } from "../../lib/logger.js";

const GENERIC_LOGIN_ERROR = "بيانات الدخول غير صحيحة";

async function bumpTokenVersion(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  await cacheDel(`tv:${userId}`);
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(userId: string, role: RegisterInput["role"] | "OWNER" | "ADMIN", device: string | undefined, ip: string | undefined): Promise<IssuedTokens> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenVersion: true } });
  const jti = newJti();
  const accessToken = signAccessToken({ userId, role: role as never, tv: user.tokenVersion, jti });

  const refreshToken = randomToken(32);
  const refreshHash = sha256Hex(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshHash,
      device,
      ip,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

export async function registerUser(
  input: RegisterInput,
  ctx: { ip?: string; userAgent?: string },
): Promise<IssuedTokens & { userId: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // منع التعداد: لا نكشف أن البريد مسجَّل بالفعل عبر خطأ صريح
    logger.info({ email: input.email }, "محاولة تسجيل ببريد موجود مسبقًا");
    throw AppError.conflict("تعذّر إتمام التسجيل بهذه البيانات");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: input.email, fullName: input.fullName, passwordHash, role: input.role },
    });

    if (input.role === "TEACHER") {
      const workspace = await tx.workspace.create({
        data: { name: `مساحة ${input.fullName}`, ownerId: created.id, planCode: "MIHWAR" },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: created.id, role: "OWNER" },
      });
      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planCode: "MIHWAR",
          status: "TRIALING",
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    }

    return created;
  });

  await recordAudit({
    userId: user.id,
    action: "USER_REGISTERED",
    entityType: "User",
    entityId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const tokens = await issueTokenPair(user.id, user.role, ctx.userAgent, ctx.ip);
  return { ...tokens, userId: user.id };
}

export async function loginUser(
  input: LoginInput,
  ctx: { ip?: string; userAgent?: string },
): Promise<IssuedTokens & { userId: string }> {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });

  // زمن ردّ ثابت: نفّذ تحقق هاش وهمي حتى لو المستخدم غير موجود
  const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const passwordOk = await verifyPassword(user?.passwordHash ?? dummyHash, input.password);

  if (!user || !passwordOk) {
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
      });
    }
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw AppError.tooManyRequests("الحساب مقفل مؤقتًا بعد محاولات فاشلة متكررة");
  }

  if (user.failedLoginCount > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  await recordAudit({ userId: user.id, action: "USER_LOGIN", entityType: "User", entityId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });

  const tokens = await issueTokenPair(user.id, user.role, ctx.userAgent, ctx.ip);
  return { ...tokens, userId: user.id };
}

export async function refreshTokens(
  presentedRefreshToken: string,
  ctx: { ip?: string; userAgent?: string },
): Promise<IssuedTokens> {
  const presentedHash = sha256Hex(presentedRefreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: presentedHash } });

  if (!record) throw AppError.unauthorized("جلسة غير صالحة");

  if (record.revokedAt) {
    // إعادة استخدام توكن مُبطَل = مؤشر سرقة → إبطال شامل
    await bumpTokenVersion(record.userId);
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit({
      userId: record.userId,
      action: "REFRESH_TOKEN_REUSE_DETECTED",
      entityType: "User",
      entityId: record.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw AppError.unauthorized("تم اكتشاف نشاط مشبوه — تم تسجيل الخروج من كل الأجهزة");
  }

  if (record.expiresAt < new Date()) {
    throw AppError.unauthorized("انتهت صلاحية الجلسة");
  }

  const user = await prisma.user.findFirst({ where: { id: record.userId, deletedAt: null } });
  if (!user) throw AppError.unauthorized("الحساب غير موجود");

  const newRefreshToken = randomToken(32);
  const newHash = sha256Hex(newRefreshToken);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedByHash: newHash },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHash,
        device: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  const jti = newJti();
  const accessToken = signAccessToken({ userId: user.id, role: user.role, tv: user.tokenVersion, jti });
  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(presentedRefreshToken: string | undefined): Promise<void> {
  if (!presentedRefreshToken) return;
  const hash = sha256Hex(presentedRefreshToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  await bumpTokenVersion(userId);
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      totpEnabled: true,
      foundingMember: true,
      workspaceMemberships: {
        select: { workspaceId: true, role: true, workspace: { select: { name: true, planCode: true } } },
      },
    },
  });
  return user;
}
