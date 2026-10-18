import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { Prisma, type SpecificationReviewStatus } from "@prisma/client";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";

const extractedData = {
  code: "BIO1101", description: null, topics: [{ title: "Cells", details: ["Structure"], sourcePages: [1] }],
  provenance: { "topics.0.title": { sourcePages: [1], quote: "Cells" } },
};
const hash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function seedSource(tx: TenantTx, tenantId: string, userId: string, workspaceId: string) {
  const bytes = Buffer.from("%PDF-1.7\nIndependent course review fixture\n%%EOF");
  const file = await tx.fileAsset.create({ data: {
    tenantId, workspaceId, uploadedById: userId, objectKey: crypto.randomUUID(), originalName: "official.pdf",
    mimeType: "application/pdf", sizeBytes: bytes.length, purpose: "UNIVERSITY", storage: "DB",
  } });
  await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
  const source = await tx.specificationSource.create({ data: {
    tenantId, fileId: file.id, uploadedById: userId, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  } });
  const extraction = await tx.programSpecificationExtraction.create({ data: {
    tenantId, sourceId: source.id, attempt: 1, requestedById: userId, status: "SUCCEEDED",
    promptVersion: "review-schema-fixture", schemaVersion: "review-schema-fixture",
    extractedData: { courses: [extractedData] }, finishedAt: new Date(),
  } });
  const sourceReview = await tx.programSpecificationReview.create({ data: {
    tenantId, sourceId: source.id, extractionId: extraction.id, revision: 1, draftData: { courses: [extractedData] },
  } });
  return { source, extraction, sourceReview };
}

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Course review schema test" } });
  const user = await prismaBase.user.create({ data: {
    tenantId: tenant.id, email: `${crypto.randomUUID()}@review-schema.test`, passwordHash: "unused", fullName: "Teacher", role: "TEACHER",
  } });
  const reviewer = await prismaBase.user.create({ data: {
    tenantId: tenant.id, email: `${crypto.randomUUID()}@review-schema.test`, passwordHash: "unused", fullName: "Platform reviewer",
    role: "ADMIN", staffScreens: ["institutions"],
  } });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: user.id, name: "Schema workspace" } });
    const course = await tx.academicCourse.create({ data: { tenantId, code: "BIO1101", codeKey: "BIO 1101" } });
    const primary = await seedSource(tx, tenantId, user.id, workspace.id);
    const secondary = await seedSource(tx, tenantId, user.id, workspace.id);
    const version = await tx.courseSpecificationVersion.create({ data: {
      tenantId, academicCourseId: course.id, sourceId: primary.source.id, extractionId: primary.extraction.id,
      sourceCourseKey: "courses.0", revisionNumber: 1, extractedData,
    } });
    const review = await tx.courseSpecificationReview.create({ data: {
      tenantId, sourceId: primary.source.id, versionId: version.id, revision: 1, draftData: extractedData,
    } });
    return { tenantId, userId: user.id, reviewer, course, primary, secondary, version, review };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
type ReviewInput = Partial<Prisma.CourseSpecificationReviewUncheckedCreateInput>;
let a: Fixture;
let b: Fixture;
let versionRevision = 2;
let foreignVersionRevision = 2;

function inA<T>(fn: (tx: TenantTx) => Promise<T>) {
  return withExplicitTenantTx(a.tenantId, fn);
}

function createVersion(alternateSource = false) {
  const origin = alternateSource ? a.secondary : a.primary;
  return inA((tx) => tx.courseSpecificationVersion.create({ data: {
    tenantId: a.tenantId, academicCourseId: a.course.id, sourceId: origin.source.id, extractionId: origin.extraction.id,
    sourceCourseKey: "courses.0", revisionNumber: versionRevision++, extractedData,
  } }));
}

async function createReview(overrides: ReviewInput = {}) {
  const versionId = overrides.versionId ?? (await createVersion()).id;
  return inA((tx) => tx.courseSpecificationReview.create({ data: {
    tenantId: a.tenantId, sourceId: a.primary.source.id, versionId, revision: 1, draftData: extractedData, ...overrides,
  } }));
}

function completedFields() {
  return { status: "COMPLETED" as const, reviewedData: extractedData, contentHash: hash(extractedData), reviewedById: b.reviewer.id, reviewedAt: new Date() };
}

function createForeignVersion() {
  return withExplicitTenantTx(b.tenantId, (tx) => tx.courseSpecificationVersion.create({ data: {
    tenantId: b.tenantId, academicCourseId: b.course.id, sourceId: b.primary.source.id, extractionId: b.primary.extraction.id,
    sourceCourseKey: "courses.0", revisionNumber: foreignVersionRevision++, extractedData,
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
  // Completed reviews and source records are immutable. Retain fixtures only in a disposable database.
  await prismaBase.$disconnect();
});

describe("independent course review schema and tenant isolation", () => {
  it("creates an independent draft with nullable completion metadata and no automatic currentReview", () => {
    expect(a.review).toMatchObject({
      tenantId: a.tenantId, sourceId: a.primary.source.id, versionId: a.version.id, revision: 1, status: "IN_REVIEW",
      schemaVersion: "course-specification-1", readinessPolicyVersion: "course-readiness-1", readinessReport: {},
      draftData: extractedData, reviewedData: null, contentHash: null, sourcePages: [],
      originSourceReviewId: null, originData: null, originSnapshotHash: null, reviewedById: null, reviewedAt: null,
    });
    expect(a.version.currentReviewId).toBeNull();
  });

  it("allows draft changes and preserves the original AI data and provenance", async () => {
    const draftData = { ...extractedData, description: "Human review correction" };
    const review = await inA((tx) => tx.courseSpecificationReview.update({
      where: { id: a.review.id }, data: { draftData, sourcePages: [1, 2], readinessReport: { missing: ["creditHours"] } },
    }));
    const version = await inA((tx) => tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: a.version.id } }));
    expect(review.draftData).toEqual(draftData);
    expect(review.sourcePages).toEqual([1, 2]);
    expect(version.extractedData).toEqual(extractedData);
    expect(version.reviewedData).toBeNull();
  });

  it("supports the tenant, source and version inverse relations", async () => {
    const filter = { where: { id: a.review.id }, select: { id: true } };
    const [tenant, source, version] = await inA((tx) => Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { courseSpecificationReviews: filter } }),
      tx.specificationSource.findUniqueOrThrow({ where: { id: a.primary.source.id }, select: { courseSpecificationReviews: filter } }),
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: a.version.id }, select: { reviews: filter } }),
    ]));
    for (const rows of [tenant.courseSpecificationReviews, source.courseSpecificationReviews, version.reviews]) {
      expect(rows).toEqual([{ id: a.review.id }]);
    }
  });

  it("retains completed revisions and allows a new active revision", async () => {
    const first = await createReview({ ...completedFields() });
    const second = await createReview({ versionId: first.versionId, revision: 2 });
    await inA((tx) => tx.courseSpecificationReview.update({ where: { id: second.id }, data: completedFields() }));
    const third = await createReview({ versionId: first.versionId, revision: 3 });
    const rows = await inA((tx) => tx.courseSpecificationReview.findMany({ where: { versionId: first.versionId }, orderBy: { revision: "asc" } }));
    expect(rows.map((r) => [r.revision, r.status])).toEqual([[1, "COMPLETED"], [2, "COMPLETED"], [3, "IN_REVIEW"]]);
    expect(third.reviewedData).toBeNull();
  });

  it("rejects the same revision twice even when both reviews are completed", async () => {
    const first = await createReview(completedFields());
    await expect(createReview({ ...completedFields(), versionId: first.versionId, revision: first.revision })).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same revision number for separate versions", async () => {
    const first = await createReview();
    const second = await createReview();
    expect(first.revision).toBe(second.revision);
    expect(first.versionId).not.toBe(second.versionId);
  });

  it("rejects a version from another tenant", async () => {
    await expect(createReview({ versionId: b.version.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a different local source from the version's source", async () => {
    const version = await createVersion();
    await expect(createReview({ versionId: version.id, sourceId: a.secondary.source.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a source from another tenant", async () => {
    await expect(createReview({ sourceId: b.primary.source.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps an origin snapshot independent of subsequent legacy draft edits", async () => {
    const originData = a.primary.sourceReview.draftData as Prisma.InputJsonValue;
    const review = await createReview({ originSourceReviewId: a.primary.sourceReview.id, originData, originSnapshotHash: hash(originData) });
    await inA((tx) => tx.programSpecificationReview.update({ where: { id: a.primary.sourceReview.id }, data: { draftData: { edited: true } } }));
    const result = await inA((tx) => tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: review.id }, include: { originSourceReview: true } }));
    expect(result.originData).toEqual(originData);
    expect(result.originSnapshotHash).toBe(hash(originData));
    expect(result.originSourceReview?.draftData).toEqual({ edited: true });
    const origin = await inA((tx) => tx.programSpecificationReview.findUniqueOrThrow({ where: { id: a.primary.sourceReview.id },
      select: { derivedCourseReviews: { where: { id: review.id }, select: { id: true } } } }));
    expect(origin.derivedCourseReviews).toEqual([{ id: review.id }]);
  });

  it("rejects an origin review from a different source", async () => {
    await expect(createReview({ originSourceReviewId: a.secondary.sourceReview.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects an origin review from another tenant", async () => {
    await expect(createReview({ originSourceReviewId: b.primary.sourceReview.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("supports a platform reviewer belonging to another tenant and its inverse relation", async () => {
    const review = await createReview(completedFields());
    const result = await inA((tx) => tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: review.id }, include: { reviewedBy: true } }));
    expect(result.reviewedBy?.id).toBe(b.reviewer.id);
    expect(result.reviewedBy?.tenantId).not.toBe(a.tenantId);
    const user = await inA((tx) => tx.user.findUniqueOrThrow({ where: { id: b.reviewer.id },
      select: { courseSpecificationReviewsReviewed: { where: { id: review.id, tenantId: a.tenantId }, select: { id: true } } } }));
    expect(user.courseSpecificationReviewsReviewed).toEqual([{ id: review.id }]);
  });

  it("rejects a nonexistent reviewer", async () => {
    await expect(createReview({ reviewedById: crypto.randomUUID() })).rejects.toMatchObject({ code: "P2003" });
  });

  it("supports the correct currentReview and clearing it to null", async () => {
    const version = await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id },
      data: { currentReviewId: a.review.id }, include: { currentReview: true } }));
    expect(version.currentReview?.id).toBe(a.review.id);
    const review = await inA((tx) => tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: a.review.id }, include: { currentForVersion: true } }));
    expect(review.currentForVersion?.id).toBe(a.version.id);
    const cleared = await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentReviewId: null } }));
    expect(cleared.currentReviewId).toBeNull();
  });

  it("rejects a currentReview for another version with the same source", async () => {
    const review = await createReview();
    await expect(inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentReviewId: review.id } })))
      .rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a currentReview for another source and version in the same tenant", async () => {
    const version = await createVersion(true);
    const review = await createReview({ versionId: version.id, sourceId: a.secondary.source.id });
    await expect(inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentReviewId: review.id } })))
      .rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a currentReview from another tenant", async () => {
    await expect(inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentReviewId: b.review.id } })))
      .rejects.toMatchObject({ code: "P2003" });
  });

  it.each([0, -1])("rejects review revision %s", async (revision) => {
    await expect(createReview({ revision })).rejects.toThrow(/course_review_positive_revision/);
  });

  it.each([[0], [-1]])("rejects nonpositive source pages %j", async (...pages) => {
    await expect(createReview({ sourcePages: pages })).rejects.toThrow(/course_review_positive_source_pages/);
  });

  it("rejects NULL source page elements through raw SQL", async () => {
    const version = await createVersion();
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_reviews (id, "tenantId", "sourceId", "versionId", revision, "draftData", "sourcePages", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${a.tenantId}, ${a.primary.source.id}, ${version.id}, 1, '{}'::jsonb, ARRAY[NULL]::INTEGER[], NOW())
    `)).rejects.toThrow(/course_review_positive_source_pages/);
  });

  it.each(["NOT_STARTED", "IN_REVIEW", "CHANGES_REQUESTED"] as const)("allows only one unfinished review when status is %s", async (status: SpecificationReviewStatus) => {
    const first = await createReview({ status });
    await expect(createReview({ versionId: first.versionId, revision: 2 })).rejects.toMatchObject({ code: "P2002" });
    await inA((tx) => tx.courseSpecificationReview.update({ where: { id: first.id }, data: { status: "CHANGES_REQUESTED", notes: "Revise" } }));
  });

  it("enforces active review uniqueness for concurrent requests", async () => {
    const version = await createVersion();
    const results = await Promise.allSettled([
      createReview({ versionId: version.id, revision: 1 }), createReview({ versionId: version.id, revision: 2 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected");
    if (!failed || failed.status !== "rejected") throw new Error("Expected one duplicate active review rejection");
    expect(failed.reason).toMatchObject({ code: "P2002" });
  });

  it("requires completion metadata only when completing the review", async () => {
    const review = await createReview();
    await expect(inA((tx) => tx.courseSpecificationReview.update({ where: { id: review.id }, data: { status: "COMPLETED" } })))
      .rejects.toThrow(/course_review_completed_snapshot/);
    const completed = await inA((tx) => tx.courseSpecificationReview.update({ where: { id: review.id }, data: completedFields() }));
    expect(completed.status).toBe("COMPLETED");
    expect(completed.reviewedData).toEqual(extractedData);
  });

  it.each(["", "   "])("rejects completing with blank contentHash %j", async (contentHash) => {
    await expect(createReview({ ...completedFields(), contentHash })).rejects.toThrow(/course_review_completed_snapshot/);
  });

  it("rejects a JSON null completed snapshot", async () => {
    await expect(createReview({ ...completedFields(), reviewedData: Prisma.JsonNull })).rejects.toThrow(/course_review_completed_snapshot/);
  });

  it("freezes completed snapshots, metadata, status and deletion", async () => {
    const review = await createReview(completedFields());
    const changes: Prisma.CourseSpecificationReviewUpdateInput[] = [
      { draftData: { altered: true } }, { reviewedData: { altered: true } }, { contentHash: "different" },
      { sourcePages: [2] }, { status: "IN_REVIEW" }, { notes: "Changed" },
    ];
    for (const data of changes) {
      await expect(inA((tx) => tx.courseSpecificationReview.update({ where: { id: review.id }, data }))).rejects.toThrow(/immutable after COMPLETED/);
    }
    await expect(inA((tx) => tx.courseSpecificationReview.delete({ where: { id: review.id } }))).rejects.toThrow(/immutable after COMPLETED/);
  });

  it("has forced RLS, tenant policy and application read/write grants", async () => {
    const [security] = await prismaBase.$queryRaw<{
      enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean;
    }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced, p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.oid = 'course_spec_reviews'::regclass AND p.policyname = 'course_spec_reviews_tenant_isolation'
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without ORM tenant context", async () => {
    await expect(prisma.courseSpecificationReview.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("injects the current tenant even when the caller supplies a different one", async () => {
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () =>
      await prisma.courseSpecificationReview.findMany({ where: { tenantId: b.tenantId, id: { in: [a.review.id, b.review.id] } }, select: { id: true } }),
    );
    expect(rows).toEqual([{ id: a.review.id }]);
  });

  it("hides foreign reviews and raw reads without tenant context", async () => {
    const rows = await inA((tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM course_spec_reviews WHERE id IN (${a.review.id}, ${b.review.id})`);
    expect(rows).toEqual([{ id: a.review.id }]);
    expect(await prismaBase.$queryRaw`SELECT id FROM course_spec_reviews WHERE id = ${a.review.id}`).toEqual([]);
  });

  it("rejects raw insertion into a foreign tenant", async () => {
    const version = await createForeignVersion();
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_reviews (id, "tenantId", "sourceId", "versionId", revision, "draftData", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${b.primary.source.id}, ${version.id}, 999, '{}'::jsonb, NOW())
    `)).rejects.toThrow(/row-level security/i);
  });

  it("rejects moving a review into another tenant through raw SQL", async () => {
    const version = await createForeignVersion();
    const review = await createReview();
    await expect(inA((tx) => tx.$executeRaw`
      UPDATE course_spec_reviews SET "tenantId" = ${b.tenantId}, "sourceId" = ${b.primary.source.id},
        "versionId" = ${version.id}, revision = 999 WHERE id = ${review.id}
    `)).rejects.toThrow(/row-level security/i);
  });
});
