import type { RegisterInput, LoginInput } from "@mihwar/shared";
import { prisma, prismaBase } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signAccessToken, newJti } from "../../lib/jwt.js";
import { randomToken, sha256Hex } from "../../lib/crypto.js";
import { cacheDel } from "../../lib/redis.js";
import { AppError } from "../../lib/AppError.js";
import { recordAudit } from "../../lib/auditLog.js";
import { REFRESH_TOKEN_TTL_DAYS, LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES } from "../../config/constants.js";
import { getPlatformSettings } from "../platform/settings.js";
import { logger } from "../../lib/logger.js";
import { newJoinCode } from "../../lib/joinCode.js";
import { avatarUrlOf, prefsOf } from "../account/prefs.js";
import { assertLoginTotp } from "../account/mfa.js";
import { DEFAULT_REGULATION } from "../owner/owner.service.js";

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
  const { trialDays } = await getPlatformSettings();
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

  // الانضمام لجامعة قائمة برمزها — `tenants` خارج RLS فالبحث بلا سياق مشروع.
  let institution: { id: string } | null = null;
  if (input.universityId) {
    if (input.role !== "TEACHER") throw AppError.badRequest("الطالب ينضم برمز الشعبة");
    // الجامعات المعتمدة وحدها (ACTIVE) تُختار من القائمة؛ غيرها يمرّ بالمراجعة أولًا.
    institution = await prismaBase.tenant.findFirst({ where: { id: input.universityId, listed: true, deletedAt: null }, select: { id: true } });
    if (!institution) throw AppError.badRequest("الجامعة غير متاحة — اخترها من القائمة أو اكتب اسمها");
  } else if (input.institutionCode) {
    if (input.role !== "TEACHER") throw AppError.badRequest("الطالب ينضم برمز الشعبة لا برمز الجامعة");
    institution = await prismaBase.tenant.findFirst({
      where: { joinCode: input.institutionCode, deletedAt: null, status: { in: ["ACTIVE", "TRIAL"] } },
      select: { id: true },
    });
    if (!institution) throw AppError.badRequest("رمز الجامعة غير صحيح — اطلبه من إدارة المنصة");
  }

  const user = await prismaBase.$transaction(async (tx: Parameters<Parameters<typeof prismaBase.$transaction>[0]>[0]) => {
    // بلا رمز جامعة: مستأجر تجريبي شخصي. كان يُنشأ **فارغًا** — بلا لائحة ولا تقويم — فلا
    // يجد الأستاذ فصلًا يُنشئ فيه مقرره، ولا يصل إلى أي شيء. الآن يُنشأ جاهزًا للعمل:
    // لائحة افتراضية وفصل «جارٍ» من اليوم، يعدّلهما المالك لاحقًا إن انتقل لجامعة.
    // `slug` محفوظ من اليوم الأول حتى يصير النطاق الفرعي إعدادًا لا هجرة (roadmap §٧.٥).
    const tenant =
      institution ??
      (await tx.tenant.create({
        // جامعة لم تُعتمد بعد: المستأجر يحمل اسمها كما كتبه الأستاذ (أو اسمه إن لم يكتب)،
        // ويبقى «تجريبيًا» حتى يعتمد المالك لوائحها من ملفات أساتذتها.
        data: { slug: `t-${randomToken(8).toLowerCase()}`, name: input.universityName ?? input.fullName, status: "TRIAL", joinCode: newJoinCode(8) },
      }));

    // التسجيل يكتب في مستأجر لم يُحسم في الجلسة بعد، فلا سياق مصادقة يضبط `app.tenant_id`.
    // نضبطه هنا داخل المعاملة نفسها وإلا رفضت RLS كل صف تالٍ.
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

    if (!institution) {
      await tx.regulation.create({ data: { tenantId: tenant.id, ...DEFAULT_REGULATION } });
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 16 * 7 * 24 * 60 * 60 * 1000);
      const year = await tx.academicYear.create({
        data: { tenantId: tenant.id, label: `العام ${start.getUTCFullYear()}`, startDate: start, endDate: end },
      });
      await tx.semester.create({
        data: { tenantId: tenant.id, academicYearId: year.id, label: "الفصل الحالي", startDate: start, endDate: end, status: "ACTIVE" },
      });
    }

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
          trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
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

  if (user.suspendedAt) {
    throw AppError.forbidden("الحساب موقوف — راسل إدارة المنصة");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw AppError.tooManyRequests("الحساب مقفل مؤقتًا بعد محاولات فاشلة متكررة");
  }

  // التحقق بخطوتين بعد كلمة المرور: الرمز الخاطئ لا يصفّر عدّاد المحاولات، ومحدود المعدل كالدخول.
  await assertLoginTotp(user, input.totp);

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
      isDeptHead: true,
      phone: true,
      prefs: true,
      avatarFileId: true,
    },
  });

  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true, role: true, workspace: { select: { name: true, planCode: true } } },
  });

  const { avatarFileId, prefs, ...rest } = user;
  return { ...rest, prefs: prefsOf(prefs), avatarUrl: avatarUrlOf(avatarFileId), workspaceMemberships };
}


/**
 * انضمام الطالب لشعبته برمزها — أول دخول له.
 *
 * الأستاذ رفع الكشف فأُنشئ للطالب حساب مؤقت (بريد مشتقّ وكلمة مرور لا تُعرف). هنا يستلم
 * الطالب ذلك الحساب نفسه: يطابق **الرقم الجامعي** سطرًا في كشف الشعبة، فيضع بريده وكلمة
 * مروره. رقم ليس في الكشف يُرفض — الكشف بيد الأستاذ، ولا يضيف أحد نفسه إلى شعبة.
 */
export async function joinSection(
  input: { joinCode: string; universityIdNumber: string; fullName: string; email: string; password: string },
  ctx: { ip?: string; userAgent?: string },
): Promise<IssuedTokens & { userId: string }> {
  // `sections` تحت RLS والطالب بلا مستأجر بعد: دالة ضيّقة تُرجع مستأجر الرمز ومعرّف الشعبة فقط
  // (هجرة 20260927000000). لا تعداد ولا أعمدة أخرى.
  const [hit] = await prismaBase.$queryRaw<{ tenantId: string; sectionId: string }[]>`
    SELECT "tenantId", "sectionId" FROM resolve_section_join_code(${input.joinCode})
  `;
  if (!hit) throw AppError.badRequest("رمز الشعبة غير صحيح — اطلبه من أستاذك");

  const emailOwner = await prismaBase.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true } });

  const userId = await prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${hit.tenantId}, true)`;
    const enrollment = await tx.enrollment.findFirst({
      where: { tenantId: hit.tenantId, sectionId: hit.sectionId, universityIdNumber: input.universityIdNumber, deletedAt: null },
      select: { studentId: true, student: { select: { email: true } } },
    });
    if (!enrollment) throw AppError.badRequest("رقمك الجامعي ليس في كشف هذه الشعبة — راجع أستاذك");

    // الحساب المؤقت ببريد مشتقّ لم يُستلم بعد. إن استُلم (بريد حقيقي) فالطريق هو الدخول.
    if (!enrollment.student.email.endsWith("@students.local")) {
      throw AppError.conflict("هذا الحساب مُفعَّل من قبل — ادخل ببريدك وكلمة مرورك");
    }
    if (emailOwner && emailOwner.id !== enrollment.studentId) {
      throw AppError.conflict("تعذّر إتمام التسجيل بهذه البيانات");
    }
    await tx.user.update({
      where: { id: enrollment.studentId },
      data: { email: input.email, fullName: input.fullName, passwordHash: await hashPassword(input.password) },
    });
    return enrollment.studentId;
  });

  await recordAudit({ userId, action: "STUDENT_JOINED_SECTION", entityType: "User", entityId: userId, ip: ctx.ip, userAgent: ctx.userAgent });
  const tokens = await issueTokenPair(userId, "STUDENT", ctx.userAgent, ctx.ip);
  return { ...tokens, userId };
}
