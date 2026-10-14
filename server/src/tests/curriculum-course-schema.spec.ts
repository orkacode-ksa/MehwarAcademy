import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Curriculum schema test" } });
  const user = await prismaBase.user.create({ data: {
    tenantId: tenant.id, email: `${crypto.randomUUID()}@curriculum-schema.test`, passwordHash: "unused", fullName: "Teacher", role: "TEACHER",
  } });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const chemistry = await tx.department.create({ data: { tenantId, code: "CHM", nameAr: "Chemistry" } });
    const biology = await tx.department.create({ data: { tenantId, code: "BIO", nameAr: "Biology" } });
    const program = await tx.program.create({ data: { tenantId, departmentId: biology.id, code: "BSC", nameAr: "BSc Biology" } });
    const otherProgram = await tx.program.create({ data: { tenantId, departmentId: biology.id, code: "MSC", nameAr: "MSc Biology" } });
    const track = await tx.programTrack.create({ data: { tenantId, programId: program.id, name: "Botany Track", nameKey: "botany" } });
    const otherTrack = await tx.programTrack.create({ data: { tenantId, programId: program.id, name: "Zoology Track", nameKey: "zoology" } });
    const foreignProgramTrack = await tx.programTrack.create({ data: { tenantId, programId: otherProgram.id, name: "Botany Track", nameKey: "botany" } });
    const course = await tx.academicCourse.create({ data: { tenantId, code: "CHM1101", codeKey: "CHM 1101", ownerDepartmentId: chemistry.id } });
    const otherCourse = await tx.academicCourse.create({ data: { tenantId, code: "BIO1101", codeKey: "BIO 1101", ownerDepartmentId: biology.id } });
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: user.id, name: "Schema workspace" } });
    const bytes = Buffer.from("%PDF-1.7\nCurriculum fixture\n%%EOF");
    const fileSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const file = await tx.fileAsset.create({ data: {
      tenantId, workspaceId: workspace.id, uploadedById: user.id, objectKey: crypto.randomUUID(), originalName: "plan.pdf",
      mimeType: "application/pdf", sizeBytes: bytes.length, purpose: "UNIVERSITY", storage: "DB",
    } });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
    const source = await tx.specificationSource.create({ data: { tenantId, fileId: file.id, uploadedById: user.id, fileSha256 } });
    const extraction = await tx.programSpecificationExtraction.create({ data: {
      tenantId, sourceId: source.id, attempt: 1, requestedById: user.id, status: "SUCCEEDED",
      promptVersion: "curriculum-fixture", schemaVersion: "curriculum-fixture", finishedAt: new Date(),
      extractedData: { courses: [{ code: course.code }, { code: otherCourse.code }] },
    } });
    const version = await tx.courseSpecificationVersion.create({ data: {
      tenantId, academicCourseId: course.id, sourceId: source.id, extractionId: extraction.id,
      sourceCourseKey: "courses.0", revisionNumber: 1, extractedData: { code: course.code },
    } });
    const otherVersion = await tx.courseSpecificationVersion.create({ data: {
      tenantId, academicCourseId: otherCourse.id, sourceId: source.id, extractionId: extraction.id,
      sourceCourseKey: "courses.1", revisionNumber: 1, extractedData: { code: otherCourse.code },
    } });
    const specData = { tenantId, programId: program.id, sourceId: source.id, sourceProgramKey: "programs.0", sourceFileId: file.id, sourceFileSha256: fileSha256, title: "Biology plan" };
    const specification = await tx.programSpecification.create({ data: { ...specData, version: "2025" } });
    const otherSpecification = await tx.programSpecification.create({ data: { ...specData, version: "2026" } });
    const foreignProgramSpec = await tx.programSpecification.create({ data: { ...specData, programId: otherProgram.id, sourceProgramKey: "programs.1", version: "2025" } });
    const member = await tx.curriculumCourse.create({ data: { tenantId, programId: program.id, academicCourseId: course.id } });
    return { tenantId, userId: user.id, chemistry, biology, program, otherProgram, track, otherTrack, foreignProgramTrack,
      course, otherCourse, file, source, extraction, version, otherVersion, specification, otherSpecification, foreignProgramSpec, member };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
type Input = Partial<Prisma.CurriculumCourseUncheckedCreateInput>;
let a: Fixture;
let b: Fixture;
let reviewRevision = 1;

function inA<T>(fn: (tx: TenantTx) => Promise<T>) { return withExplicitTenantTx(a.tenantId, fn); }

async function createMember(overrides: Input = {}) {
  return inA(async (tx) => {
    const code = crypto.randomUUID();
    const academicCourseId = overrides.academicCourseId ?? (await tx.academicCourse.create({
      data: { tenantId: a.tenantId, code, codeKey: code, ownerDepartmentId: a.chemistry.id },
    })).id;
    return tx.curriculumCourse.create({ data: { tenantId: a.tenantId, programId: a.program.id, academicCourseId, ...overrides } });
  });
}

function createPlan() {
  return inA((tx) => tx.programSpecification.create({ data: {
    tenantId: a.tenantId, programId: a.program.id, sourceId: a.source.id, sourceProgramKey: "programs.0",
    sourceFileId: a.file.id, sourceFileSha256: a.source.fileSha256, title: "Biology plan", version: crypto.randomUUID(),
  } }));
}

async function preparePlanApproval(specification: Awaited<ReturnType<typeof createPlan>>) {
  const snapshot = { programs: [{ key: specification.sourceProgramKey, program: { code: a.program.code },
    specification: { title: specification.title, version: specification.version } }] };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return inA(async (tx) => {
    const review = await tx.programSpecificationReview.create({ data: {
      tenantId: a.tenantId, sourceId: a.source.id, programSpecificationId: specification.id, extractionId: a.extraction.id,
      revision: reviewRevision++, status: "COMPLETED", draftData: snapshot, reviewedData: snapshot, contentHash,
      reviewedById: a.userId, reviewedAt: new Date(),
    } });
    const approval = await tx.programSpecificationApproval.create({ data: {
      tenantId: a.tenantId, sourceId: a.source.id, programSpecificationId: specification.id, reviewId: review.id,
      contentHash, status: "APPROVED", requestedById: a.userId, decidedById: a.userId, decidedAt: new Date(),
    } });
    return { currentExtractionId: a.extraction.id, currentReviewId: review.id, currentApprovalId: approval.id,
      extractionStatus: "SUCCEEDED" as const, reviewStatus: "COMPLETED" as const, approvalStatus: "APPROVED" as const };
  });
}

function context(track: boolean, specification: boolean) {
  return { programTrackId: track ? a.track.id : null, programSpecificationId: specification ? a.specification.id : null };
}

function latch() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
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
  // Sources and approved plan snapshots are immutable. Use a disposable database.
  await prismaBase.$disconnect();
});

describe("curriculum membership, exact parent context and tenant isolation", () => {
  it("has the nonpartial tenant/id unique key required by future compound foreign keys", async () => {
    const [index] = await prismaBase.$queryRaw<{ unique: boolean; valid: boolean; nonpartial: boolean; definition: string }[]>`
      SELECT indisunique AS unique, indisvalid AS valid, indpred IS NULL AS nonpartial,
        pg_get_indexdef(indexrelid) AS definition
      FROM pg_index WHERE indexrelid = '"curriculum_courses_tenantId_id_key"'::regclass
    `;
    expect(index).toMatchObject({ unique: true, valid: true, nonpartial: true });
    expect(index?.definition).toContain('("tenantId", id)');
  });

  it("supports direct program membership with every optional context unknown", async () => {
    expect(a.member).toMatchObject({ programId: a.program.id, academicCourseId: a.course.id,
      programTrackId: null, programSpecificationId: null, courseSpecificationVersionId: null,
      sourceId: null, sourcePages: [], metadata: {}, requirement: null, level: null, year: null, orderIndex: null });
    const before = await inA((tx) => tx.programTrack.count({ where: { tenantId: a.tenantId, programId: a.otherProgram.id } }));
    await createMember({ programId: a.otherProgram.id });
    expect(await inA((tx) => tx.programTrack.count({ where: { tenantId: a.tenantId, programId: a.otherProgram.id } }))).toBe(before);
  });

  it("places Chemistry's CHM1101 in Biology/Botany without changing academic ownership", async () => {
    const before = await inA((tx) => tx.academicCourse.findUniqueOrThrow({ where: { id: a.course.id } }));
    const member = await createMember({ academicCourseId: a.course.id, programTrackId: a.track.id, requirement: "REQUIRED" });
    const result = await inA((tx) => tx.curriculumCourse.findUniqueOrThrow({ where: { id: member.id },
      include: { academicCourse: true, program: true, programTrack: true } }));
    expect(result.academicCourse.code).toBe("CHM1101");
    expect(result.academicCourse).toEqual(before);
    expect(result.academicCourse.ownerDepartmentId).toBe(a.chemistry.id);
    expect(result.program.departmentId).toBe(a.biology.id);
    expect(result.programTrack?.name).toBe("Botany Track");
  });

  it("pins the matching course version and plan while preserving provenance and rich metadata", async () => {
    const metadata = { provenance: { requirement: { sourcePages: [3], quote: "Elective" } }, notes: ["Shared service course"] };
    const member = await createMember({ academicCourseId: a.course.id, courseSpecificationVersionId: a.version.id,
      programTrackId: a.track.id, programSpecificationId: a.specification.id, sourceId: a.source.id,
      sourcePages: [3, 5], metadata, requirement: "ELECTIVE", level: "5th Level", year: "3rd Year", orderIndex: 0 });
    const result = await inA((tx) => tx.curriculumCourse.findUniqueOrThrow({ where: { id: member.id }, include: {
      tenant: true, program: true, programTrack: true, programSpecification: true, academicCourse: true, courseSpecificationVersion: true, source: true,
    } }));
    expect(result).toMatchObject({ requirement: "ELECTIVE", level: "5th Level", year: "3rd Year", orderIndex: 0, sourcePages: [3, 5], metadata });
    expect(result.courseSpecificationVersion?.academicCourseId).toBe(a.course.id);
    expect(result.programSpecification?.programId).toBe(a.program.id);
    const filter = { where: { id: member.id }, select: { id: true } };
    const parents = await inA((tx) => Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { curriculumCourses: filter } }),
      tx.program.findUniqueOrThrow({ where: { id: a.program.id }, select: { curriculumCourses: filter } }),
      tx.programTrack.findUniqueOrThrow({ where: { id: a.track.id }, select: { curriculumCourses: filter } }),
      tx.programSpecification.findUniqueOrThrow({ where: { id: a.specification.id }, select: { curriculumCourses: filter } }),
      tx.academicCourse.findUniqueOrThrow({ where: { id: a.course.id }, select: { curriculumCourses: filter } }),
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: a.version.id }, select: { curriculumCourses: filter } }),
      tx.specificationSource.findUniqueOrThrow({ where: { id: a.source.id }, select: { curriculumCourses: filter } }),
    ]));
    for (const parent of parents) expect(parent.curriculumCourses).toEqual([{ id: member.id }]);
  });

  it("allows optional context to be cleared without removing the membership", async () => {
    const member = await createMember({ programTrackId: a.track.id, programSpecificationId: a.specification.id, sourceId: a.source.id });
    const cleared = await inA((tx) => tx.curriculumCourse.update({ where: { id: member.id }, data: {
      programTrackId: null, programSpecificationId: null, sourceId: null,
    } }));
    expect(cleared).toMatchObject({ programTrackId: null, programSpecificationId: null, sourceId: null, courseSpecificationVersionId: null });
  });

  it.each(["programId", "programTrackId", "programSpecificationId", "academicCourseId", "courseSpecificationVersionId", "sourceId"] as const)("rejects a foreign tenant %s", async (field) => {
    const ids = { programId: b.program.id, programTrackId: b.track.id, programSpecificationId: b.specification.id,
      academicCourseId: b.course.id, courseSpecificationVersionId: b.version.id, sourceId: b.source.id };
    await expect(createMember({ [field]: ids[field] })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a local track from another program", async () => {
    await expect(createMember({ programTrackId: a.foreignProgramTrack.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a local plan specification from another program", async () => {
    await expect(createMember({ programSpecificationId: a.foreignProgramSpec.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a course version from another academic identity", async () => {
    await expect(createMember({ programId: a.otherProgram.id, academicCourseId: a.course.id, courseSpecificationVersionId: a.otherVersion.id }))
      .rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces the same composite parent checks on updates", async () => {
    const member = await createMember({ programTrackId: a.track.id, programSpecificationId: a.specification.id });
    for (const data of [{ programId: a.otherProgram.id }, { programTrackId: b.track.id },
      { programSpecificationId: a.foreignProgramSpec.id }, { courseSpecificationVersionId: a.version.id }]) {
      await expect(inA((tx) => tx.curriculumCourse.update({ where: { id: member.id }, data }))).rejects.toMatchObject({ code: "P2003" });
    }
  });

  it.each([[false, false], [true, false], [false, true], [true, true]])("rejects duplicate membership with track=%s and plan=%s", async (track, plan) => {
    const ctx = context(track, plan);
    const first = await createMember(ctx);
    await expect(createMember({ ...ctx, academicCourseId: first.academicCourseId, requirement: "ELECTIVE", orderIndex: 99 }))
      .rejects.toMatchObject({ code: "P2002" });
  });

  it.each([[false, false], [true, false], [false, true], [true, true]])("prevents update collisions with track=%s and plan=%s", async (track, plan) => {
    const ctx = context(track, plan);
    const first = await createMember(ctx);
    const other = await createMember({ academicCourseId: first.academicCourseId, programId: a.otherProgram.id });
    await expect(inA((tx) => tx.curriculumCourse.update({ where: { id: other.id }, data: { programId: a.program.id, ...ctx } })))
      .rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same academic identity across distinct program, track and plan contexts", async () => {
    const first = await createMember();
    const academicCourseId = first.academicCourseId;
    const contexts = [
      { programId: a.otherProgram.id }, { programTrackId: a.track.id }, { programTrackId: a.otherTrack.id },
      { programSpecificationId: a.specification.id }, { programSpecificationId: a.otherSpecification.id },
      { programTrackId: a.track.id, programSpecificationId: a.specification.id },
      { programTrackId: a.otherTrack.id, programSpecificationId: a.specification.id },
      { programTrackId: a.track.id, programSpecificationId: a.otherSpecification.id },
    ];
    for (const ctx of contexts) await createMember({ academicCourseId, ...ctx });
    expect(await inA((tx) => tx.curriculumCourse.count({ where: { academicCourseId } }))).toBe(9);
  });

  it("changing the pinned course version cannot bypass membership uniqueness", async () => {
    const later = await inA((tx) => tx.courseSpecificationVersion.create({ data: {
      tenantId: a.tenantId, academicCourseId: a.course.id, sourceId: a.source.id, extractionId: a.extraction.id,
      sourceCourseKey: "courses.0", revisionNumber: 2, extractedData: { code: a.course.code, corrected: true },
    } }));
    await createMember({ academicCourseId: a.course.id, courseSpecificationVersionId: a.version.id, programSpecificationId: a.otherSpecification.id });
    await expect(createMember({ academicCourseId: a.course.id, courseSpecificationVersionId: later.id, programSpecificationId: a.otherSpecification.id }))
      .rejects.toMatchObject({ code: "P2002" });
    const member = await inA((tx) => tx.curriculumCourse.findFirstOrThrow({ where: { academicCourseId: a.course.id, programSpecificationId: a.otherSpecification.id } }));
    expect((await inA((tx) => tx.curriculumCourse.update({ where: { id: member.id }, data: { courseSpecificationVersionId: null } }))).courseSpecificationVersionId).toBeNull();
  });

  it("enforces uniqueness for concurrent direct-program membership requests", async () => {
    const first = await createMember({ programId: a.otherProgram.id });
    const results = await Promise.allSettled([0, 1].map(() => createMember({ academicCourseId: first.academicCourseId })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected");
    if (!failed || failed.status !== "rejected") throw new Error("Expected one duplicate curriculum membership rejection");
    expect(failed.reason).toMatchObject({ code: "P2002" });
  });

  it.each([[0], [-1]])("rejects nonpositive source pages %j", async (...pages) => {
    await expect(createMember({ sourcePages: pages })).rejects.toThrow(/curriculum_course_positive_source_pages/);
  });

  it("rejects NULL page elements and a NULL page array through raw SQL", async () => {
    const member = await createMember();
    await expect(inA((tx) => tx.$executeRaw`UPDATE curriculum_courses SET "sourcePages" = ARRAY[NULL]::INTEGER[] WHERE id = ${member.id}`))
      .rejects.toThrow(/curriculum_course_positive_source_pages/);
    await expect(inA((tx) => tx.$executeRaw`UPDATE curriculum_courses SET "sourcePages" = NULL WHERE id = ${member.id}`))
      .rejects.toMatchObject({ code: "P2010", meta: { code: "23502" } });
  });

  it.each([-1, -10])("rejects negative orderIndex %s", async (orderIndex) => {
    await expect(createMember({ orderIndex })).rejects.toThrow(/curriculum_course_nonnegative_order/);
  });

  it("supports nullable orderIndex and unconstrained official level/year wording", async () => {
    const member = await createMember({ level: "Field placement", year: "Final Year", orderIndex: null });
    expect(member).toMatchObject({ level: "Field placement", year: "Final Year", orderIndex: null, requirement: null });
  });

  it("allows edits/removal in an unapproved plan then freezes its membership on approval", async () => {
    const plan = await createPlan();
    const removable = await createMember({ programSpecificationId: plan.id });
    await inA((tx) => tx.curriculumCourse.delete({ where: { id: removable.id } }));
    const member = await createMember({ programSpecificationId: plan.id });
    await inA((tx) => tx.curriculumCourse.update({ where: { id: member.id }, data: { level: "5th Level" } }));
    const approval = await preparePlanApproval(plan);
    await inA((tx) => tx.programSpecification.update({ where: { id: plan.id }, data: approval }));
    await expect(createMember({ programSpecificationId: plan.id })).rejects.toThrow(/approved program specification is immutable/);
    for (const data of [{ programSpecificationId: null }, { programSpecificationId: a.specification.id }, { metadata: { changed: true } },
      { orderIndex: 1 }, { sourcePages: [2] }]) {
      await expect(inA((tx) => tx.curriculumCourse.update({ where: { id: member.id }, data }))).rejects.toThrow(/approved program specification is immutable/);
    }
    await expect(inA((tx) => tx.curriculumCourse.delete({ where: { id: member.id } }))).rejects.toThrow(/approved program specification is immutable/);
    const other = await createMember();
    await expect(inA((tx) => tx.curriculumCourse.update({ where: { id: other.id }, data: { programSpecificationId: plan.id } })))
      .rejects.toThrow(/approved program specification is immutable/);
  });

  it("serializes plan approval against an uncommitted curriculum edit", async () => {
    const plan = await createPlan();
    const member = await createMember({ programSpecificationId: plan.id });
    const approval = await preparePlanApproval(plan);
    const ready = latch();
    const release = latch();
    const editing = inA(async (tx) => {
      await tx.curriculumCourse.update({ where: { id: member.id }, data: { orderIndex: 0 } });
      ready.resolve();
      await release.promise;
    });
    try {
      await Promise.race([ready.promise, editing.then(() => { throw new Error("Edit did not hold its transaction"); })]);
      await expect(inA(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");
        await tx.programSpecification.update({ where: { id: plan.id }, data: approval });
      })).rejects.toThrow(/lock timeout/i);
    } finally { release.resolve(); await editing; }
    await inA((tx) => tx.programSpecification.update({ where: { id: plan.id }, data: approval }));
    await expect(createMember({ programSpecificationId: plan.id })).rejects.toThrow(/approved program specification is immutable/);
  });

  it("has forced RLS, tenant policy and application read/write grants", async () => {
    const [security] = await prismaBase.$queryRaw<{ enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced, p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.oid = 'curriculum_courses'::regclass AND p.policyname = 'curriculum_courses_tenant_isolation'
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without ORM tenant context", async () => {
    await expect(prisma.curriculumCourse.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("injects the current tenant even with a foreign tenant filter", async () => {
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () =>
      await prisma.curriculumCourse.findMany({ where: { tenantId: b.tenantId, id: { in: [a.member.id, b.member.id] } }, select: { id: true } }),
    );
    expect(rows).toEqual([{ id: a.member.id }]);
  });

  it("hides foreign rows and denies reads without raw tenant context", async () => {
    expect(await inA((tx) => tx.$queryRaw`SELECT id FROM curriculum_courses WHERE id IN (${a.member.id}, ${b.member.id})`)).toEqual([{ id: a.member.id }]);
    expect(await prismaBase.$queryRaw`SELECT id FROM curriculum_courses WHERE id = ${a.member.id}`).toEqual([]);
  });

  it("rejects raw foreign insertion and moving membership into another tenant", async () => {
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO curriculum_courses (id, "tenantId", "programId", "academicCourseId", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${b.program.id}, ${b.otherCourse.id}, NOW())
    `)).rejects.toThrow(/row-level security/i);
    const member = await createMember();
    await expect(inA((tx) => tx.$executeRaw`
      UPDATE curriculum_courses SET "tenantId" = ${b.tenantId}, "programId" = ${b.program.id}, "academicCourseId" = ${b.otherCourse.id} WHERE id = ${member.id}
    `)).rejects.toThrow(/row-level security/i);
  });

  it("cannot delete another tenant's membership", async () => {
    expect(await inA((tx) => tx.$executeRaw`DELETE FROM curriculum_courses WHERE id = ${b.member.id}`)).toBe(0);
    expect(await withExplicitTenantTx(b.tenantId, (tx) => tx.curriculumCourse.findUnique({ where: { id: b.member.id } }))).toMatchObject({ id: b.member.id });
  });
});
