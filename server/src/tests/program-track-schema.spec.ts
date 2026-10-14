import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({
    data: { slug: crypto.randomUUID(), name: "Program track schema test" },
  });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const department = await tx.department.create({
      data: { tenantId: tenant.id, code: "BIO", nameAr: "Biology" },
    });
    const program = await tx.program.create({
      data: { tenantId: tenant.id, departmentId: department.id, code: "BSC", nameAr: "BSc Biology" },
    });
    const otherProgram = await tx.program.create({
      data: { tenantId: tenant.id, departmentId: department.id, code: "MSC", nameAr: "MSc Biology" },
    });
    const track = await tx.programTrack.create({
      data: { tenantId: tenant.id, programId: program.id, code: "BOT", name: "Botany Track", nameKey: "botany track" },
    });
    return { tenantId: tenant.id, department, program, otherProgram, track };
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
      await tx.programTrack.deleteMany({ where: { tenantId: fixture.tenantId } });
      await tx.program.deleteMany({ where: { tenantId: fixture.tenantId } });
      await tx.department.deleteMany({ where: { tenantId: fixture.tenantId } });
    });
    await prismaBase.tenant.delete({ where: { id: fixture.tenantId } });
  }
  await prismaBase.$disconnect();
});

describe("program track schema and tenant isolation", () => {
  it("has forced RLS, tenant read/write policy and application grants", async () => {
    const [security] = await prismaBase.$queryRaw<{
      enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean;
    }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
        p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.oid = 'program_tracks'::regclass AND p.policyname = 'program_tracks_tenant_isolation'
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without ORM tenant context", async () => {
    await expect(prisma.programTrack.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("injects the current tenant even when the caller supplies another tenant", async () => {
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: "schema-test" }, async () =>
      await prisma.programTrack.findMany({
        where: { tenantId: b.tenantId, id: { in: [a.track.id, b.track.id] } }, select: { id: true },
      }),
    );
    expect(rows).toEqual([{ id: a.track.id }]);
  });

  it("hides foreign rows and denies unscoped raw reads", async () => {
    const rows = await inA((tx) => tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM program_tracks WHERE id IN (${a.track.id}, ${b.track.id})
    `);
    expect(rows).toEqual([{ id: a.track.id }]);
    expect(await prismaBase.$queryRaw`SELECT id FROM program_tracks WHERE id = ${a.track.id}`).toEqual([]);
  });

  it("rejects raw inserts into a different tenant", async () => {
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO program_tracks (id, "tenantId", "programId", name, "nameKey", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${b.program.id}, 'Foreign', 'foreign', NOW())
    `)).rejects.toThrow(/row-level security/i);
  });

  it("rejects moving a visible row into another tenant through raw SQL", async () => {
    const track = await inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: a.program.id, name: "Move", nameKey: "move" },
    }));
    await expect(inA((tx) => tx.$executeRaw`
      UPDATE program_tracks SET "tenantId" = ${b.tenantId}, "programId" = ${b.program.id}
      WHERE id = ${track.id}
    `)).rejects.toThrow(/row-level security/i);
  });

  it("prevents deleting another tenant's track through raw SQL", async () => {
    const deleted = await inA((tx) => tx.$executeRaw`DELETE FROM program_tracks WHERE id = ${b.track.id}`);
    expect(deleted).toBe(0);
    const retained = await withExplicitTenantTx(b.tenantId, (tx) => tx.programTrack.findUnique({ where: { id: b.track.id } }));
    expect(retained?.id).toBe(b.track.id);
  });

  it("rejects a program from another tenant", async () => {
    await expect(inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: b.program.id, name: "Cross", nameKey: "cross" },
    }))).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects changing the parent to another tenant's program", async () => {
    await expect(inA((tx) => tx.programTrack.update({
      where: { id: a.track.id }, data: { programId: b.program.id },
    }))).rejects.toMatchObject({ code: "P2003" });
  });

  it("supports the tenant and program inverse relations", async () => {
    const [tenant, program] = await inA((tx) => Promise.all([
      tx.tenant.findUniqueOrThrow({
        where: { id: a.tenantId }, select: { programTracks: { where: { id: a.track.id }, select: { id: true } } },
      }),
      tx.program.findUniqueOrThrow({ where: { id: a.program.id }, select: { tracks: { where: { id: a.track.id }, select: { id: true } } } }),
    ]));
    expect(tenant.programTracks).toEqual([{ id: a.track.id }]);
    expect(program.tracks).toEqual([{ id: a.track.id }]);
  });

  it("keeps a program without tracks empty instead of creating a placeholder", async () => {
    const program = await inA((tx) => tx.program.create({
      data: { tenantId: a.tenantId, departmentId: a.department.id, code: "NO-TRACK", nameAr: "Undivided program" },
      include: { tracks: true },
    }));
    expect(program.tracks).toEqual([]);
  });

  it("preserves the official name without assuming translations or a code", async () => {
    const track = await inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: a.program.id, name: "Zoology Track", nameKey: "zoology track" },
    }));
    expect(track).toMatchObject({ name: "Zoology Track", nameKey: "zoology track", code: null, nameAr: null, nameEn: null, deletedAt: null });
  });

  it("rejects a duplicate active nameKey within the same program", async () => {
    await expect(inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: a.program.id, name: "BOTANY TRACK", nameKey: a.track.nameKey },
    }))).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects a duplicate active code even when the nameKey differs", async () => {
    await expect(inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: a.program.id, code: a.track.code, name: "Different", nameKey: "different" },
    }))).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows multiple active tracks without codes", async () => {
    const tracks = await inA((tx) => tx.programTrack.createMany({ data: [
      { tenantId: a.tenantId, programId: a.program.id, name: "No Code One", nameKey: "no code one" },
      { tenantId: a.tenantId, programId: a.program.id, name: "No Code Two", nameKey: "no code two" },
    ] }));
    expect(tracks.count).toBe(2);
  });

  it("allows the same active nameKey and code in a different program", async () => {
    const track = await inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: a.otherProgram.id, code: a.track.code, name: a.track.name, nameKey: a.track.nameKey },
    }));
    expect(track.programId).not.toBe(a.track.programId);
  });

  it("allows the same active nameKey and code in different tenants", () => {
    expect(a.track.nameKey).toBe(b.track.nameKey);
    expect(a.track.code).toBe(b.track.code);
    expect(a.track.tenantId).not.toBe(b.track.tenantId);
  });

  it("reuses a deleted nameKey and prevents conflicting restoration", async () => {
    const result = await inA(async (tx) => {
      const data = { tenantId: a.tenantId, programId: a.program.id, name: "Reusable Name", nameKey: "reusable name" };
      const first = await tx.programTrack.create({ data });
      await tx.programTrack.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      await tx.programTrack.create({ data: { ...data, deletedAt: new Date() } });
      const active = await tx.programTrack.create({ data });
      const rows = await tx.programTrack.findMany({ where: { tenantId: a.tenantId, programId: a.program.id, nameKey: data.nameKey } });
      return { first, active, rows };
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows.filter((row) => row.deletedAt === null)).toHaveLength(1);
    await expect(inA((tx) => tx.programTrack.update({
      where: { id: result.first.id }, data: { deletedAt: null },
    }))).rejects.toMatchObject({ code: "P2002" });
    await inA(async (tx) => {
      await tx.programTrack.update({ where: { id: result.active.id }, data: { deletedAt: new Date() } });
      await tx.programTrack.update({ where: { id: result.first.id }, data: { deletedAt: null } });
    });
  });

  it("reuses a deleted code and excludes NULL codes from active uniqueness", async () => {
    const result = await inA(async (tx) => {
      const data = { tenantId: a.tenantId, programId: a.program.id, code: "REUSE" };
      const first = await tx.programTrack.create({ data: { ...data, name: "Code Old", nameKey: "code old" } });
      await tx.programTrack.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      await tx.programTrack.create({ data: { ...data, name: "Code History", nameKey: "code history", deletedAt: new Date() } });
      const active = await tx.programTrack.create({ data: { ...data, name: "Code New", nameKey: "code new" } });
      const rows = await tx.programTrack.findMany({ where: { tenantId: a.tenantId, programId: a.program.id, code: data.code } });
      return { first, active, rows };
    });
    expect(result.rows).toHaveLength(3);
    await expect(inA((tx) => tx.programTrack.update({
      where: { id: result.first.id }, data: { deletedAt: null },
    }))).rejects.toMatchObject({ code: "P2002" });
    await inA(async (tx) => {
      await tx.programTrack.update({ where: { id: result.active.id }, data: { code: null } });
      await tx.programTrack.update({ where: { id: result.first.id }, data: { deletedAt: null } });
    });
  });

  it.each(["nameKey", "code"] as const)("rejects updates that duplicate an active %s", async (field) => {
    const track = await inA((tx) => tx.programTrack.create({
      data: { tenantId: a.tenantId, programId: a.program.id, name: `Update ${field}`, nameKey: `update ${field}`, code: `UPDATE-${field}` },
    }));
    const data = field === "nameKey" ? { nameKey: a.track.nameKey } : { code: a.track.code };
    await expect(inA((tx) => tx.programTrack.update({ where: { id: track.id }, data }))).rejects.toMatchObject({ code: "P2002" });
  });
});
