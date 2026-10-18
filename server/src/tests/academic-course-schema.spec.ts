import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({
    data: { slug: crypto.randomUUID(), name: "Academic course schema test" },
  });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const department = await tx.department.create({
      data: { tenantId: tenant.id, code: "CHEM", nameAr: "Chemistry" },
    });
    const course = await tx.academicCourse.create({
      data: {
        tenantId: tenant.id, code: "CHM1101", codeKey: "CHM 1101",
        nameEn: "General Chemistry", ownerDepartmentId: department.id,
      },
    });
    return { tenantId: tenant.id, department, course };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
let a: Fixture;
let b: Fixture;

function inA<T>(fn: (tx: TenantTx) => Promise<T>) {
  return withExplicitTenantTx(a.tenantId, fn);
}

beforeAll(async () => {
  const [role] = await prismaBase.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await seedTenant();
  b = await seedTenant();
});

afterAll(async () => {
  for (const fixture of [a, b]) {
    if (!fixture) continue;
    await withExplicitTenantTx(fixture.tenantId, async (tx) => {
      await tx.academicCourse.deleteMany({ where: { tenantId: fixture.tenantId } });
      await tx.department.deleteMany({ where: { tenantId: fixture.tenantId } });
    });
    await prismaBase.tenant.delete({ where: { id: fixture.tenantId } });
  }
  await prismaBase.$disconnect();
});

describe("academic course schema and tenant isolation", () => {
  it("has forced RLS, tenant read/write policy and application grants", async () => {
    const [security] = await prismaBase.$queryRaw<{
      enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean;
    }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
        p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.oid = 'academic_courses'::regclass
        AND p.policyname = 'academic_courses_tenant_isolation'
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without ORM tenant context", async () => {
    await expect(prisma.academicCourse.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("injects the current tenant even when the caller supplies another tenant", async () => {
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: "schema-test" }, async () =>
      await prisma.academicCourse.findMany({
        where: { tenantId: b.tenantId, id: { in: [a.course.id, b.course.id] } },
        select: { id: true },
      }),
    );
    expect(rows).toEqual([{ id: a.course.id }]);
  });

  it("hides foreign rows and denies unscoped raw reads", async () => {
    const rows = await inA((tx) => tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM academic_courses WHERE id IN (${a.course.id}, ${b.course.id})
    `);
    expect(rows).toEqual([{ id: a.course.id }]);
    const unscoped = await prismaBase.$queryRaw`
      SELECT id FROM academic_courses WHERE id = ${a.course.id}
    `;
    expect(unscoped).toEqual([]);
  });

  it("rejects raw inserts into a different tenant", async () => {
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO academic_courses (id, "tenantId", code, "codeKey", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, 'FOREIGN', 'FOREIGN', NOW())
    `)).rejects.toThrow(/row-level security/i);
  });

  it("rejects moving a visible row to another tenant through raw SQL", async () => {
    const course = await inA((tx) => tx.academicCourse.create({
      data: { tenantId: a.tenantId, code: "MOVE", codeKey: "MOVE" },
    }));
    await expect(inA((tx) => tx.$executeRaw`
      UPDATE academic_courses SET "tenantId" = ${b.tenantId} WHERE id = ${course.id}
    `)).rejects.toThrow(/row-level security/i);
  });

  it("supports unknown owners and preserves the official code spelling", async () => {
    const course = await inA((tx) => tx.academicCourse.create({
      data: { tenantId: a.tenantId, code: "BIO1101", codeKey: "BIO 1101" },
    }));
    expect(course).toMatchObject({
      code: "BIO1101", codeKey: "BIO 1101", ownerDepartmentId: null,
      nameAr: null, nameEn: null, deletedAt: null,
    });
  });

  it("supports the tenant and owner department inverse relations", async () => {
    const [tenant, department] = await inA((tx) => Promise.all([
      tx.tenant.findUniqueOrThrow({
        where: { id: a.tenantId },
        select: { academicCourses: { where: { id: a.course.id }, select: { id: true } } },
      }),
      tx.department.findUniqueOrThrow({
        where: { id: a.department.id },
        select: { ownedAcademicCourses: { select: { id: true } } },
      }),
    ]));
    expect(tenant.academicCourses).toEqual([{ id: a.course.id }]);
    expect(department.ownedAcademicCourses).toEqual([{ id: a.course.id }]);
  });

  it("rejects an owner department from a different tenant", async () => {
    await expect(inA((tx) => tx.academicCourse.create({
      data: { tenantId: a.tenantId, code: "CROSS", codeKey: "CROSS", ownerDepartmentId: b.department.id },
    }))).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects changing ownership to a different tenant's department", async () => {
    await expect(inA((tx) => tx.academicCourse.update({
      where: { id: a.course.id }, data: { ownerDepartmentId: b.department.id },
    }))).rejects.toMatchObject({ code: "P2003" });
  });

  it("allows the same active codeKey in separate tenants", () => {
    expect(a.course.codeKey).toBe(b.course.codeKey);
    expect(a.course.tenantId).not.toBe(b.course.tenantId);
  });

  it("rejects a duplicate active codeKey even when the official spelling differs", async () => {
    await expect(inA((tx) => tx.academicCourse.create({
      data: { tenantId: a.tenantId, code: "CHM 1101", codeKey: a.course.codeKey },
    }))).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows multiple deleted identities and one active identity for the same codeKey", async () => {
    const key = "REUSE 101";
    const result = await inA(async (tx) => {
      const first = await tx.academicCourse.create({
        data: { tenantId: a.tenantId, code: "REUSE101", codeKey: key },
      });
      await tx.academicCourse.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      await tx.academicCourse.create({
        data: { tenantId: a.tenantId, code: "REUSE101", codeKey: key, deletedAt: new Date() },
      });
      const active = await tx.academicCourse.create({
        data: { tenantId: a.tenantId, code: "REUSE101", codeKey: key },
      });
      const rows = await tx.academicCourse.findMany({ where: { tenantId: a.tenantId, codeKey: key } });
      return { first, active, rows };
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows.filter((row) => row.deletedAt === null)).toHaveLength(1);
    await expect(inA((tx) => tx.academicCourse.update({
      where: { id: result.first.id }, data: { deletedAt: null },
    }))).rejects.toMatchObject({ code: "P2002" });
    await inA(async (tx) => {
      await tx.academicCourse.update({ where: { id: result.active.id }, data: { deletedAt: new Date() } });
      await tx.academicCourse.update({ where: { id: result.first.id }, data: { deletedAt: null } });
    });
  });

  it("rejects changing an active codeKey to an already active codeKey", async () => {
    const course = await inA((tx) => tx.academicCourse.create({
      data: { tenantId: a.tenantId, code: "OTHER", codeKey: "OTHER" },
    }));
    await expect(inA((tx) => tx.academicCourse.update({
      where: { id: course.id }, data: { codeKey: a.course.codeKey },
    }))).rejects.toMatchObject({ code: "P2002" });
  });
});
