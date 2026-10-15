import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";

const courseData = {
  code: "BIO1101", nameEn: "General Biology", creditHours: null, hasLab: null,
  topics: [{ title: "Cells", details: ["Cell structure"], sourcePages: [1, 2] }],
};

async function seedSource(tx: TenantTx, tenantId: string, userId: string, workspaceId: string) {
  const bytes = Buffer.from("%PDF-1.7\nCourse specification schema fixture\n%%EOF");
  const file = await tx.fileAsset.create({ data: {
    tenantId, workspaceId, uploadedById: userId, objectKey: crypto.randomUUID(),
    originalName: "official-2025.pdf", mimeType: "application/pdf", sizeBytes: bytes.length,
    purpose: "UNIVERSITY", storage: "DB",
  } });
  await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
  const source = await tx.specificationSource.create({ data: {
    tenantId, fileId: file.id, uploadedById: userId,
    fileSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  } });
  const extraction = await tx.programSpecificationExtraction.create({ data: {
    tenantId, sourceId: source.id, attempt: 1, requestedById: userId,
    status: "SUCCEEDED", promptVersion: "schema-fixture-1", schemaVersion: "schema-fixture-1",
    extractedData: { programs: [{ courses: [courseData] }] }, finishedAt: new Date(),
  } });
  return { file, source, extraction };
}

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Course version schema test" } });
  const user = await prismaBase.user.create({ data: {
    tenantId: tenant.id, email: `${crypto.randomUUID()}@course-version.test`,
    fullName: "Schema teacher", passwordHash: "unused", role: "TEACHER",
  } });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: user.id, name: "Schema workspace" } });
    const course = await tx.academicCourse.create({ data: { tenantId, code: "BIO1101", codeKey: "BIO 1101" } });
    const otherCourse = await tx.academicCourse.create({ data: { tenantId, code: "CHM1101", codeKey: "CHM 1101" } });
    const primary = await seedSource(tx, tenantId, user.id, workspace.id);
    const secondary = await seedSource(tx, tenantId, user.id, workspace.id);
    const version = await tx.courseSpecificationVersion.create({ data: {
      tenantId, academicCourseId: course.id, sourceId: primary.source.id, extractionId: primary.extraction.id,
      sourceCourseKey: "programs.0.courses.0", revisionNumber: 1, extractedData: courseData,
    } });
    return { tenantId, userId: user.id, course, otherCourse, primary, secondary, version };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
let a: Fixture;
let b: Fixture;
let revisionNumber = 2;

function inA<T>(fn: (tx: TenantTx) => Promise<T>) {
  return withExplicitTenantTx(a.tenantId, fn);
}

function createVersion(overrides: Partial<Prisma.CourseSpecificationVersionUncheckedCreateInput> = {}) {
  return inA((tx) => tx.courseSpecificationVersion.create({ data: {
    tenantId: a.tenantId, academicCourseId: a.course.id,
    sourceId: a.primary.source.id, extractionId: a.primary.extraction.id,
    sourceCourseKey: "programs.0.courses.0", revisionNumber: revisionNumber++, extractedData: courseData,
    ...overrides,
  } }));
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
  // Official source files and terminal extractions are immutable; use a disposable database.
  await prismaBase.$disconnect();
});

describe("course specification version core and tenant isolation", () => {
  it("creates a draft without inferring a type or official version from its source", () => {
    expect(a.version).toMatchObject({
      tenantId: a.tenantId, academicCourseId: a.course.id, sourceId: a.primary.source.id,
      extractionId: a.primary.extraction.id, sourceCourseKey: "programs.0.courses.0", revisionNumber: 1,
      status: "DRAFT", schemaVersion: "course-specification-1", officialVersion: null, specificationType: null,
      issuedAt: null, lastRevisionAt: null, reviewedData: null, provenance: {}, sourcePages: [],
      warnings: [], issues: [], contentHash: null, creationKey: null, supersedesId: null, extractedData: courseData,
    });
  });

  it("preserves rich data, provenance, warnings and explicitly supplied metadata", async () => {
    const provenance = { "topics.0.title": { sourcePages: [1, 2], quote: "Cells" } };
    const warnings = ["Credit hours absent"];
    const issues = [{ field: "creditHours", reason: "not stated", sourcePages: [1] }];
    const reviewedData = { ...courseData, objectives: ["Observe field specimens"] };
    const issuedAt = new Date("2025-09-01T00:00:00Z");
    const lastRevisionAt = new Date("2026-01-01T00:00:00Z");
    const version = await createVersion({
      officialVersion: "2025", specificationType: "FIELD_TRAINING", issuedAt, lastRevisionAt,
      provenance, sourcePages: [1, 2], warnings, issues, reviewedData,
      contentHash: crypto.createHash("sha256").update(JSON.stringify(reviewedData)).digest("hex"),
    });
    expect(version).toMatchObject({
      extractedData: courseData, reviewedData, provenance, sourcePages: [1, 2], warnings, issues,
      officialVersion: "2025", specificationType: "FIELD_TRAINING", issuedAt, lastRevisionAt,
    });
  });

  it("supports exact parent relations and their inverse collections", async () => {
    const result = await inA(async (tx) => {
      const version = await tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: a.version.id },
        include: { tenant: true, academicCourse: true, source: true, extraction: true } });
      const filter = { where: { id: a.version.id }, select: { id: true } };
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { courseSpecificationVersions: filter } });
      const course = await tx.academicCourse.findUniqueOrThrow({ where: { id: a.course.id }, select: { specificationVersions: filter } });
      const source = await tx.specificationSource.findUniqueOrThrow({ where: { id: a.primary.source.id }, select: { courseSpecificationVersions: filter } });
      const extraction = await tx.programSpecificationExtraction.findUniqueOrThrow({ where: { id: a.primary.extraction.id }, select: { courseSpecificationVersions: filter } });
      return { version, tenant, course, source, extraction };
    });
    expect(result.version.tenant.id).toBe(a.tenantId);
    expect(result.version.academicCourse.id).toBe(a.course.id);
    expect(result.version.source.id).toBe(a.primary.source.id);
    expect(result.version.extraction.id).toBe(a.primary.extraction.id);
    for (const rows of [result.tenant.courseSpecificationVersions, result.course.specificationVersions,
      result.source.courseSpecificationVersions, result.extraction.courseSpecificationVersions]) {
      expect(rows).toEqual([{ id: a.version.id }]);
    }
  });

  it("rejects an AcademicCourse from another tenant", async () => {
    await expect(createVersion({ academicCourseId: b.course.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a source and extraction from another tenant", async () => {
    await expect(createVersion({ sourceId: b.primary.source.id, extractionId: b.primary.extraction.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects an extraction from another source in the same tenant", async () => {
    await expect(createVersion({ extractionId: a.secondary.extraction.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects an extraction from another tenant even when the source is local", async () => {
    await expect(createVersion({ extractionId: b.primary.extraction.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("accepts a matching alternate source and extraction", async () => {
    const version = await createVersion({ sourceId: a.secondary.source.id, extractionId: a.secondary.extraction.id });
    expect(version).toMatchObject({ sourceId: a.secondary.source.id, extractionId: a.secondary.extraction.id });
  });

  it("prevents changing only the source while retaining a mismatched extraction", async () => {
    const version = await createVersion();
    await expect(inA((tx) => tx.courseSpecificationVersion.update({
      where: { id: version.id }, data: { sourceId: a.secondary.source.id },
    }))).rejects.toMatchObject({ code: "P2003" });
  });

  it.each([0, -1])("rejects revisionNumber %s", async (value) => {
    await expect(createVersion({ revisionNumber: value })).rejects.toThrow(/course_version_positive_revision/);
  });

  it.each(["", "   ", "\t\n "])("rejects a blank sourceCourseKey %j", async (value) => {
    await expect(createVersion({ sourceCourseKey: value })).rejects.toThrow(/course_version_source_key_nonempty/);
  });

  it.each([[0], [-1]])("rejects nonpositive source pages %j", async (...pages) => {
    await expect(createVersion({ sourcePages: pages })).rejects.toThrow(/course_version_positive_source_pages/);
  });

  it("rejects NULL elements in sourcePages through raw SQL", async () => {
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_versions (id, "tenantId", "academicCourseId", "sourceId", "extractionId",
        "sourceCourseKey", "revisionNumber", "extractedData", "sourcePages", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${a.tenantId}, ${a.course.id}, ${a.primary.source.id}, ${a.primary.extraction.id},
        'programs.0.courses.0', ${revisionNumber++}, '{}'::jsonb, ARRAY[NULL]::INTEGER[], NOW())
    `)).rejects.toThrow(/course_version_positive_source_pages/);
  });

  it("rejects a duplicate revision within the same AcademicCourse", async () => {
    await expect(createVersion({ revisionNumber: a.version.revisionNumber })).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same revision number for another AcademicCourse", async () => {
    const version = await createVersion({ academicCourseId: a.otherCourse.id, revisionNumber: 1 });
    expect(version.academicCourseId).toBe(a.otherCourse.id);
    expect(version.revisionNumber).toBe(1);
  });

  it("allows corrected revisions to reuse the same extraction and sourceCourseKey", async () => {
    const version = await createVersion({ supersedesId: a.version.id });
    expect(version.extractionId).toBe(a.version.extractionId);
    expect(version.sourceCourseKey).toBe(a.version.sourceCourseKey);
    expect(version.creationKey).toBeNull();
    expect(a.version.creationKey).toBeNull();
  });

  it("supports lineage and keeps the earlier revision intact", async () => {
    const successor = await createVersion({ supersedesId: a.version.id, extractedData: { ...courseData, description: "Corrected" } });
    const [previous, current] = await inA((tx) => Promise.all([
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: a.version.id }, include: { successors: { where: { id: successor.id } } } }),
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: successor.id }, include: { supersedes: true } }),
    ]));
    expect(current.supersedes?.id).toBe(a.version.id);
    expect(previous.successors.map((v) => v.id)).toEqual([successor.id]);
    expect(previous.extractedData).toEqual(courseData);
    expect(previous.revisionNumber).toBe(1);
  });

  it("rejects supersedes from a different AcademicCourse", async () => {
    const other = await inA((tx) => tx.courseSpecificationVersion.findFirstOrThrow({ where: { tenantId: a.tenantId, academicCourseId: a.otherCourse.id } }));
    await expect(createVersion({ supersedesId: other.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects supersedes from a different tenant", async () => {
    await expect(createVersion({ supersedesId: b.version.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects direct self supersedes on insert and update", async () => {
    const id = crypto.randomUUID();
    await expect(createVersion({ id, supersedesId: id })).rejects.toThrow(/course_version_not_self_supersedes/);
    const version = await createVersion();
    await expect(inA((tx) => tx.courseSpecificationVersion.update({ where: { id: version.id }, data: { supersedesId: version.id } })))
      .rejects.toThrow(/course_version_not_self_supersedes/);
  });

  it("enforces non-null creationKey uniqueness inside a tenant", async () => {
    const key = "import-source-entry-1";
    await createVersion({ creationKey: key });
    await expect(createVersion({ creationKey: key })).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same creationKey in a different tenant", async () => {
    const version = await withExplicitTenantTx(b.tenantId, (tx) => tx.courseSpecificationVersion.create({ data: {
      tenantId: b.tenantId, academicCourseId: b.course.id, sourceId: b.primary.source.id, extractionId: b.primary.extraction.id,
      sourceCourseKey: "programs.0.courses.0", revisionNumber: 2, extractedData: courseData, creationKey: "import-source-entry-1",
    } }));
    expect(version.creationKey).toBe("import-source-entry-1");
  });

  it("has forced RLS, tenant read/write policy and application grants", async () => {
    const [security] = await prismaBase.$queryRaw<{
      enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean;
    }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced, p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.oid = 'course_spec_versions'::regclass AND p.policyname = 'course_spec_versions_tenant_isolation'
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without ORM tenant context", async () => {
    await expect(prisma.courseSpecificationVersion.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("injects the current tenant even when the caller supplies another tenant", async () => {
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () =>
      await prisma.courseSpecificationVersion.findMany({ where: { tenantId: b.tenantId, id: { in: [a.version.id, b.version.id] } }, select: { id: true } }),
    );
    expect(rows).toEqual([{ id: a.version.id }]);
  });

  it("hides foreign versions and denies raw reads without tenant context", async () => {
    const rows = await inA((tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM course_spec_versions WHERE id IN (${a.version.id}, ${b.version.id})`);
    expect(rows).toEqual([{ id: a.version.id }]);
    expect(await prismaBase.$queryRaw`SELECT id FROM course_spec_versions WHERE id = ${a.version.id}`).toEqual([]);
  });

  it("rejects raw inserts into another tenant", async () => {
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_versions (id, "tenantId", "academicCourseId", "sourceId", "extractionId",
        "sourceCourseKey", "revisionNumber", "extractedData", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${b.course.id}, ${b.primary.source.id}, ${b.primary.extraction.id},
        'programs.0.courses.0', 999, '{}'::jsonb, NOW())
    `)).rejects.toThrow(/row-level security/i);
  });

  it("rejects moving a version to another tenant through raw SQL", async () => {
    const version = await createVersion();
    await expect(inA((tx) => tx.$executeRaw`
      UPDATE course_spec_versions SET "tenantId" = ${b.tenantId}, "academicCourseId" = ${b.course.id},
        "sourceId" = ${b.primary.source.id}, "extractionId" = ${b.primary.extraction.id}
      WHERE id = ${version.id}
    `)).rejects.toThrow(/row-level security/i);
  });
});
