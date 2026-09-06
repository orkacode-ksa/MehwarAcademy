import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma, prismaBase } from "../lib/prisma.js";
import { TENANT_SCOPED_MODELS, UNSCOPED_MODELS, TENANT_FIELD_BUT_UNSCOPED } from "../lib/tenantScope.js";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * مصفوفة العزل: تُثبت أن العزل خاصية بنيوية لا اتفاق بين المطوّرين.
 *
 * الاختبار الأول هو الأهم: يقارن المخطّط نفسه بقائمة الجداول المعزولة. جدول جديد يحمل
 * `tenantId` ولم يُضَف للقائمة يكسر البناء — فلا يمرّ جدول بلا عزل لمجرّد أن أحدًا نسي،
 * وهو بالضبط ما يحدث عادةً بعد ستة أشهر من كتابة طبقة التأجير.
 */

const dmmfModels = Prisma.dmmf.datamodel.models;

describe("مصفوفة نطاق المستأجر", () => {
  const modelsWithTenantField = dmmfModels
    .filter((m) => m.fields.some((f) => f.name === "tenantId" && f.isRequired))
    .map((m) => m.name)
    .sort();

  it("كل نموذج يحمل tenantId إمّا معزول تلقائيًا أو استثناء معلَن", () => {
    const accountedFor = [...TENANT_SCOPED_MODELS, ...TENANT_FIELD_BUT_UNSCOPED].sort();
    expect(
      modelsWithTenantField,
      "نموذج يحمل tenantId بلا قرار عزل — أضفه إلى TENANT_SCOPED_MODELS، أو إلى " +
        "TENANT_FIELD_BUT_UNSCOPED بتعليل أمني مكتوب",
    ).toEqual(accountedFor);
  });

  it("كل نموذج معزول تلقائيًا يحمل tenantId إلزاميًا فعلًا", () => {
    for (const name of TENANT_SCOPED_MODELS) {
      expect(
        modelsWithTenantField.includes(name),
        `${name} مُدرَج كمعزول لكنه لا يحمل tenantId إلزاميًا في المخطّط`,
      ).toBe(true);
    }
  });

  it("كل نموذج في قائمة الاستثناءات موجود فعلًا في المخطّط", () => {
    for (const name of [...UNSCOPED_MODELS, ...TENANT_FIELD_BUT_UNSCOPED]) {
      expect(
        dmmfModels.some((m) => m.name === name),
        `${name} مُدرَج كاستثناء لكنه غير موجود في المخطّط — قائمة قديمة`,
      ).toBe(true);
    }
  });

  it("لا نموذج خارج القائمتين معًا", () => {
    const covered = new Set<string>([...TENANT_SCOPED_MODELS, ...UNSCOPED_MODELS, ...TENANT_FIELD_BUT_UNSCOPED]);
    const uncovered = dmmfModels.map((m) => m.name).filter((n) => !covered.has(n));
    expect(uncovered, "نماذج بلا قرار عزل — أضفها لإحدى القائمتين في lib/tenantScope.ts").toEqual([]);
  });

  it("الاستعلام بلا سياق مستأجر يفشل مغلقًا — لا يمرّ بلا شرط", async () => {
    await expect(prisma.course.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("الجداول خارج العزل تعمل بلا سياق (وإلا تعطّل تسجيل الدخول)", async () => {
    await expect(prismaBase.user.findFirst({ where: { email: "nobody@mihwar.test" } })).resolves.toBeNull();
  });

  it("سياق المستأجر يحقن الشرط ولا يسمح للمستدعي بإلغائه", async () => {
    // تمرير tenantId مخالف صراحةً: الحقن يأتي بعده في ترتيب النشر فيغلبه
    await runWithTenant({ tenantId: "tenant-does-not-exist", userId: "u" }, async () => {
      const rows = await prisma.course.findMany({ where: { tenantId: "some-other-tenant" } as never });
      expect(rows).toEqual([]);
    });
  });
});
