import type { RegisterInput, LoginInput } from "@mihwar/shared";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAccessToken, newJti } from "../../lib/jwt.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { cacheDel } from "../../lib/redis.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { REFRESH_TOKEN_TTL_DAYS, TRIAL_DAYS, LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES } from "../../config/constants.js";
import { logger } from "../../lib/logger.js";

const GENERIC_LOGIN_ERROR = "بيانات الدخول غير صحيحة";

async function bumpTokenVersion(userId: string): Promise<void> {
  await prismaBase.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  await cacheDel(`tv:${userId}`);
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(userId: string, role: RegisterInput["role"] | "OWNER" | "ADMIN", device: string | undefined, ip: string | undefined): Promise<IssuedTokens> {
  const user = await prismaBase.user.findUniqueOrThrow({
    where: { id: userId },
    select: { tokenVersion: true, tenantId: true },
  });
  const jti = newJti();
  // المستأجر يُوقَّع داخل التوكن: هو المصدر الوحيد الذي يقرأه امتداد Prisma وسياسات RLS،
  // فلا يمكن للعميل (ولا لأداة يقترحها نموذج ذكاء) تغييره من طلبٍ ما.
  const accessToken = signAccessToken({ userId, tenantId: user.tenantId, role: role as never, tv: user.tokenVersion, jti });

  const refreshToken = randomToken(32);
  const refreshHash = sha256Hex(refreshToken);
  await prismaBase.refreshToken.create({
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
  // فحص عام للبريد رغم أن الفريدية صارت داخل المستأجر: التسجيل الذاتي يُنشئ **مستأجرًا
  // جديدًا** في كل مرة، فبلا هذا الفحص يصير البريد الواحد مصنعًا لمستأجرين بلا حدّ.
  // الانضمام لمستأجر قائم يتم بدعوة لا بتسجيل ذاتي (المرحلة ٨).
  const existing = await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null } });
  if (existing) {
    // منع التعداد: لا نكشف أن البريد مسجَّل بالفعل عبر خطأ صريح
    logger.info({ email: input.email }, "محاولة تسجيل ببريد موجود مسبقًا");
    throw AppError.conflict("تعذّر إتمام التسجيل بهذه البيانات");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prismaBase.$transaction(async (tx: Parameters<Parameters<typeof prismaBase.$transaction>[0]>[0]) => {
    // التسجيل الذاتي ينشئ مستأجرًا مستقلًا للمُسجِّل. `slug` محفوظ من اليوم الأول حتى
    // يصير النطاق الفرعي لاحقًا إعدادًا لا هجرة قاعدة بيانات (roadmap §٧.٥).
    const tenant = await tx.tenant.create({
      data: { slug: `t-${randomToken(8).toLowerCase()}`, name: input.fullName, status: "TRIAL" },
    });

    // التسجيل هو الموضع الوحيد الذي يكتب في مستأجر لم يوجد قبل بدء الطلب، فلا سياق مصادقة
    // يضبط `app.tenant_id`. نضبطه هنا داخل المعاملة نفسها وإلا رفضت RLS كل صف تال —
    // وقد رفضته فعلًا عند أول تشغيل، وهو الجدار الثاني يعمل كما صُمِّم.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

    const created = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        role: input.role,
      },
    });

    if (input.role === "TEACHER") {
      const workspace = await tx.workspace.create({
        data: { tenantId: tenant.id, name: `مساحة ${input.fullName}`, ownerId: created.id, planCode: "MIHWAR" },
      });
      await tx.workspaceMember.create({
        data: { tenantId: tenant.id, workspaceId: workspace.id, userId: created.id, role: "OWNER" },
      });
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
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
  const user = await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null } });

  // زمن ردّ ثابت: نفّذ تحقق هاش وهمي حتى لو المستخدم غير موجود
  const dummyHash = "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const passwordOk = await verifyPassword(user?.passwordHash ?? dummyHash, input.password);

  if (!user || !passwordOk) {
    if (user) {
      const updated = await prismaBase.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      // قفل تدريجي: عند بلوغ الحد الأقصى تُقفل ١٥ دقيقة (الدستور الأمني §3.3)
      if (updated.failedLoginCount >= LOGIN_MAX_ATTEMPTS) {
        await prismaBase.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000) },
        });
      }
    }
    throw AppError.unauthorized(GENERIC_LOGIN_ERROR);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw AppError.tooManyRequests("الحساب مقفل مؤقتًا بعد محاولات فاشلة متكررة");
  }

  if (user.failedLoginCount > 0) {
    await prismaBase.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
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
  const record = await prismaBase.refreshToken.findUnique({ where: { tokenHash: presentedHash } });

  if (!record) throw AppError.unauthorized("جلسة غير صالحة");

  if (record.revokedAt) {
    // إعادة استخدام توكن مُبطَل = مؤشر سرقة → إبطال شامل
    await bumpTokenVersion(record.userId);
    await prismaBase.refreshToken.updateMany({
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

  const user = await prismaBase.user.findFirst({ where: { id: record.userId, deletedAt: null } });
  if (!user) throw AppError.unauthorized("الحساب غير موجود");

  const newRefreshToken = randomToken(32);
  const newHash = sha256Hex(newRefreshToken);

  await prismaBase.$transaction([
    prismaBase.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedByHash: newHash },
    }),
    prismaBase.refreshToken.create({
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
  const accessToken = signAccessToken({ userId: user.id, tenantId: user.tenantId, role: user.role, tv: user.tokenVersion, jti });
  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(presentedRefreshToken: string | undefined): Promise<void> {
  if (!presentedRefreshToken) return;
  const hash = sha256Hex(presentedRefreshToken);
  await prismaBase.refreshToken.updateMany({ where: { tokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  await bumpTokenVersion(userId);
  await prismaBase.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getMe(userId: string) {
  // استعلامان لا واحد، وكلٌّ على مستواه: `users` خارج العزل (المصادقة تسبق حسم المستأجر)،
  // والعضويات داخله. قراءتهما معًا بالعميل الخام كانت تُرجع عضويات فارغة لأن RLS ترفض
  // صفوفًا بلا `app.tenant_id` — أي أن الجدار الثاني ردّ الخطأ بدل أن يُخفيه.
  const user = await prismaBase.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      email: true,
      fullName: true,
      role: true,
      totpEnabled: true,
      foundingMember: true,
    },
  });

  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true, role: true, workspace: { select: { name: true, planCode: true } } },
  });

  return { ...user, workspaceMemberships };
}
