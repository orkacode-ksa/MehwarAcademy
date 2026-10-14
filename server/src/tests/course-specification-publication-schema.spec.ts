import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { Prisma, CourseSpecificationApprovalStatus } from "@prisma/client";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { createCourseFromTemplate, listPublishedCourseTemplates } from "../modules/academic/courseTemplates.service.js";

const snapshot = { code: "BIO1101", nameAr: "General Biology", creditHours: 3, hasLab: false, description: "Official course", sourcePages: [1] };
const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

async function seedLegacy(tx: TenantTx, tenantId: string, userId: string, programId: string, fileId: string, published: boolean) {
  const spec = await tx.programSpecification.create({ data: {
    tenantId, programId, sourceFileId: fileId, sourceFileSha256: contentHash, title: "Legacy program", version: crypto.randomUUID(),
  } });
  const extraction = await tx.programSpecificationExtraction.create({ data: {
    tenantId, programSpecificationId: spec.id, attempt: 1, requestedById: userId, status: "SUCCEEDED",
    promptVersion: "publication-fixture", schemaVersion: "publication-fixture", extractedData: snapshot, finishedAt: new Date(),
  } });
  const review = await tx.programSpecificationReview.create({ data: {
    tenantId, programSpecificationId: spec.id, extractionId: extraction.id, revision: 1, draftData: snapshot,
  } });
  const approval = await tx.programSpecificationApproval.create({ data: { tenantId, programSpecificationId: spec.id, reviewId: review.id, contentHash, requestedById: userId } });
  const publication = await tx.programSpecificationPublication.create({ data: { tenantId, programSpecificationId: spec.id, approvalId: approval.id, requestedById: userId } });
  const template = await tx.courseTemplate.create({ data: {
    tenantId, programSpecificationId: spec.id, publicationId: publication.id, code: "LEGACY101", nameAr: "Legacy course", creditHours: 3,
  } });
  const topic = await tx.courseTemplateTopic.create({ data: { tenantId, courseTemplateId: template.id, title: "Legacy topic", orderIndex: 0 } });
  if (published) {
    await tx.programSpecificationReview.update({ where: { id: review.id }, data: {
      status: "COMPLETED", reviewedData: snapshot, contentHash, reviewedById: userId, reviewedAt: new Date(),
    } });
    await tx.programSpecificationApproval.update({ where: { id: approval.id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date() } });
    await tx.programSpecification.update({ where: { id: spec.id }, data: {
      currentExtractionId: extraction.id, currentReviewId: review.id, currentApprovalId: approval.id,
      extractionStatus: "SUCCEEDED", reviewStatus: "COMPLETED", approvalStatus: "APPROVED",
    } });
    await tx.programSpecificationPublication.update({ where: { id: publication.id }, data: { status: "PUBLISHED", publishedById: userId, publishedAt: new Date() } });
  }
  return { spec, publication, template, topic };
}

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Course publication test" } });
  const user = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@publication-schema.test`, passwordHash: "unused", fullName: "Teacher", role: "TEACHER" } });
  const actor = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@publication-schema.test`, passwordHash: "unused", fullName: "Platform publisher", role: "ADMIN", staffScreens: ["institutions"] } });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const department = await tx.department.create({ data: { tenantId, code: "BIO", nameAr: "Biology" } });
    const program = await tx.program.create({ data: { tenantId, departmentId: department.id, code: "BSC", nameAr: "Biology" } });
    const course = await tx.academicCourse.create({ data: { tenantId, code: snapshot.code, codeKey: "BIO 1101" } });
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: user.id, name: "Schema workspace" } });
    const bytes = Buffer.from("%PDF-1.7\nCourse publication fixture\n%%EOF");
    const file = await tx.fileAsset.create({ data: {
      tenantId, workspaceId: workspace.id, uploadedById: user.id, objectKey: crypto.randomUUID(), originalName: "official.pdf",
      mimeType: "application/pdf", sizeBytes: bytes.length, purpose: "UNIVERSITY", storage: "DB",
    } });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
    const source = await tx.specificationSource.create({ data: { tenantId, fileId: file.id, uploadedById: user.id, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex") } });
    const extraction = await tx.programSpecificationExtraction.create({ data: {
      tenantId, sourceId: source.id, attempt: 1, requestedById: user.id, status: "SUCCEEDED", promptVersion: "publication-fixture",
      schemaVersion: "publication-fixture", extractedData: { courses: [snapshot] }, finishedAt: new Date(),
    } });
    const legacyDraft = await seedLegacy(tx, tenantId, user.id, program.id, file.id, false);
    const legacyPublished = await seedLegacy(tx, tenantId, user.id, program.id, file.id, true);
    return { tenantId, userId: user.id, actor, course, workspace, source, extraction, legacyDraft, legacyPublished };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
type PublicationInput = Partial<Prisma.CourseSpecificationPublicationUncheckedCreateInput>;
type TemplateInput = Partial<Prisma.CourseTemplateUncheckedCreateInput>;
let a: Fixture;
let b: Fixture;
let revision = 1;

function inA<T>(fn: (tx: TenantTx) => Promise<T>) { return withExplicitTenantTx(a.tenantId, fn); }

async function createEdition(status: CourseSpecificationApprovalStatus = "APPROVED", target = a) {
  return withExplicitTenantTx(target.tenantId, async (tx) => {
    const tenantId = target.tenantId;
    const version = await tx.courseSpecificationVersion.create({ data: { tenantId, academicCourseId: target.course.id,
      sourceId: target.source.id, extractionId: target.extraction.id, sourceCourseKey: "courses.0", revisionNumber: revision++, extractedData: snapshot } });
    const review = await tx.courseSpecificationReview.create({ data: { tenantId, sourceId: target.source.id, versionId: version.id,
      revision: 1, status: "COMPLETED", draftData: snapshot, reviewedData: snapshot, contentHash, reviewedById: b.actor.id, reviewedAt: new Date() } });
    const batch = await tx.courseSpecificationApprovalBatch.create({ data: { tenantId, requestKey: crypto.randomUUID(), manifestHash: contentHash, requestedById: b.actor.id } });
    const approval = await tx.courseSpecificationApproval.create({ data: { tenantId, batchId: batch.id, versionId: version.id, reviewId: review.id,
      contentHash, status, ...(status === "PENDING" ? {} : { decidedById: b.actor.id, decidedAt: new Date() }) } });
    await tx.courseSpecificationVersion.update({ where: { id: version.id }, data: { currentReviewId: review.id, currentApprovalId: approval.id,
      ...(status === "APPROVED" ? { status: "APPROVED", reviewedData: snapshot, contentHash } : {}) } });
    return { version, review, approval };
  });
}

async function createPublication(overrides: PublicationInput = {}, target = a) {
  const edition = overrides.versionId && overrides.approvalId ? null : await createEdition("APPROVED", target);
  return withExplicitTenantTx(target.tenantId, (tx) => tx.courseSpecificationPublication.create({ data: {
    tenantId: target.tenantId, versionId: overrides.versionId ?? edition?.version.id ?? "missing",
    approvalId: overrides.approvalId ?? edition?.approval.id ?? "missing", projectionVersion: "course-projection-1", requestedById: b.actor.id, ...overrides,
  } }));
}

function publish(id: string, target = a) {
  return withExplicitTenantTx(target.tenantId, (tx) => tx.courseSpecificationPublication.update({ where: { id },
    data: { status: "PUBLISHED", projectionHash: contentHash, publishedById: b.actor.id, publishedAt: new Date(), errorMessage: null } }));
}

async function createTemplate(overrides: TemplateInput = {}) {
  const publication = overrides.coursePublicationId ? null : await createPublication();
  return inA((tx) => tx.courseTemplate.create({ data: { tenantId: a.tenantId, code: snapshot.code, nameAr: snapshot.nameAr, creditHours: snapshot.creditHours,
    spec: snapshot, assessmentPlan: [], courseSpecificationVersionId: publication?.versionId ?? null, coursePublicationId: publication?.id ?? null, ...overrides } }));
}

function latch() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeAll(async () => {
  const [role] = await prismaBase.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await seedTenant();
  b = await seedTenant();
});

afterAll(async () => { await prismaBase.$disconnect(); });

describe("independent course publication and dual template paths", () => {
  it("creates a pending publication from an approved exact decision and supports parent/inverse relations", async () => {
    const publication = await createPublication();
    expect(publication).toMatchObject({ status: "PENDING", projectionVersion: "course-projection-1", projectionHash: null, publishedById: null, publishedAt: null });
    const result = await inA((tx) => tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: publication.id }, include: { tenant: true, version: true, approval: true, requestedBy: true, template: true } }));
    expect(result.approval).toMatchObject({ status: "APPROVED", versionId: result.version.id });
    expect(result.tenant.id).toBe(a.tenantId);
    expect(result.requestedBy.tenantId).toBe(b.tenantId);
    expect(result.template).toBeNull();
    const filter = { where: { id: publication.id }, select: { id: true } };
    const [tenant, version, approval, user] = await inA((tx) => Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { courseSpecificationPublications: filter } }),
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: publication.versionId }, select: { publication: { select: { id: true } } } }),
      tx.courseSpecificationApproval.findUniqueOrThrow({ where: { id: publication.approvalId }, select: { publications: filter } }),
      tx.user.findUniqueOrThrow({ where: { id: b.actor.id }, select: { courseSpecificationPublicationsRequested: { where: { id: publication.id, tenantId: a.tenantId }, select: { id: true } } } }),
    ]));
    expect(version.publication?.id).toBe(publication.id);
    for (const rows of [tenant.courseSpecificationPublications, approval.publications, user.courseSpecificationPublicationsRequested]) expect(rows).toEqual([{ id: publication.id }]);
  });

  it.each(["PENDING", "REJECTED", "CANCELED"] as const)("rejects a publication backed by a %s decision", async (status) => {
    const edition = await createEdition(status);
    await expect(createPublication({ versionId: edition.version.id, approvalId: edition.approval.id })).rejects.toThrow(/requires an APPROVED course approval/);
  });

  it("rejects a decision from another version", async () => {
    const first = await createEdition();
    const other = await createEdition();
    await expect(createPublication({ versionId: first.version.id, approvalId: other.approval.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it.each(["versionId", "approvalId"] as const)("rejects a foreign tenant %s", async (field) => {
    const foreign = await createEdition("APPROVED", b);
    await expect(createPublication({ [field]: field === "versionId" ? foreign.version.id : foreign.approval.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("permits one publication per version and retries failed publication on the same record", async () => {
    const publication = await createPublication();
    await expect(createPublication({ versionId: publication.versionId, approvalId: publication.approvalId })).rejects.toMatchObject({ code: "P2002" });
    await inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status: "FAILED", errorMessage: "Projection interrupted" } }));
    await inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status: "PENDING", errorMessage: null } }));
    expect((await publish(publication.id)).id).toBe(publication.id);
    expect(await inA((tx) => tx.courseSpecificationPublication.count({ where: { versionId: publication.versionId } }))).toBe(1);
  });

  it("requires the publishing actor/time and supports platform actor inverse relations", async () => {
    const publication = await createPublication();
    for (const data of [{ status: "PUBLISHED" as const }, { status: "PUBLISHED" as const, publishedAt: new Date() }, { status: "PUBLISHED" as const, publishedById: b.actor.id }]) {
      await expect(inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publication.id }, data }))).rejects.toThrow(/course_publication_actor/);
    }
    await publish(publication.id);
    const user = await inA((tx) => tx.user.findUniqueOrThrow({ where: { id: b.actor.id }, select: { courseSpecificationPublicationsPublished: { where: { id: publication.id, tenantId: a.tenantId }, select: { id: true } } } }));
    expect(user.courseSpecificationPublicationsPublished).toEqual([{ id: publication.id }]);
  });

  it("rejects nonexistent actors and blank projection metadata", async () => {
    await expect(createPublication({ requestedById: crypto.randomUUID() })).rejects.toMatchObject({ code: "P2003" });
    await expect(createPublication({ publishedById: crypto.randomUUID() })).rejects.toMatchObject({ code: "P2003" });
    for (const blank of ["", " \t\n "]) {
      await expect(createPublication({ projectionVersion: blank })).rejects.toThrow(/course_publication_projection_version/);
      await expect(createPublication({ projectionHash: blank })).rejects.toThrow(/course_publication_projection_hash/);
    }
  });

  it("freezes all published snapshot metadata, status and deletion", async () => {
    const publication = await createPublication();
    await publish(publication.id);
    const changes: Prisma.CourseSpecificationPublicationUncheckedUpdateInput[] = [
      { versionId: crypto.randomUUID() }, { approvalId: crypto.randomUUID() }, { projectionVersion: "changed" }, { projectionHash: "changed" },
      { status: "FAILED" }, { errorMessage: "changed" }, { requestedById: a.userId }, { publishedAt: new Date(0) },
    ];
    for (const data of changes) await expect(inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publication.id }, data }))).rejects.toThrow(/immutable after PUBLISHED/);
    await expect(inA((tx) => tx.courseSpecificationPublication.delete({ where: { id: publication.id } }))).rejects.toThrow(/immutable after PUBLISHED/);
  });

  it("keeps legacy templates valid with null new-path fields and mutable drafts", async () => {
    const legacy = await inA((tx) => tx.courseTemplate.findUniqueOrThrow({ where: { id: a.legacyPublished.template.id } }));
    expect(legacy).toMatchObject({ programSpecificationId: a.legacyPublished.spec.id, publicationId: a.legacyPublished.publication.id,
      courseSpecificationVersionId: null, coursePublicationId: null });
    const edited = await inA((tx) => tx.courseTemplate.update({ where: { id: a.legacyDraft.template.id }, data: { nameAr: "Draft correction" } }));
    expect(edited.nameAr).toBe("Draft correction");
    await inA((tx) => tx.courseTemplate.create({ data: { tenantId: a.tenantId, programSpecificationId: a.legacyDraft.spec.id,
      publicationId: a.legacyDraft.publication.id, code: crypto.randomUUID(), nameAr: "Another legacy course", creditHours: 3 } }));
  });

  it("creates a minimal new template while the exact course publication is pending", async () => {
    const template = await createTemplate();
    expect(template).toMatchObject({ programSpecificationId: null, publicationId: null, spec: snapshot, assessmentPlan: [] });
    const result = await inA((tx) => tx.courseTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { courseSpecificationVersion: true, coursePublication: true } }));
    expect(result.coursePublication).toMatchObject({ status: "PENDING", versionId: template.courseSpecificationVersionId });
    expect(result.courseSpecificationVersion?.id).toBe(template.courseSpecificationVersionId);
    const [version, publication] = await inA((tx) => Promise.all([
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: result.courseSpecificationVersion?.id ?? "missing" }, include: { courseTemplate: true } }),
      tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: result.coursePublication?.id ?? "missing" }, include: { template: true } }),
    ]));
    expect(version.courseTemplate?.id).toBe(template.id);
    expect(publication.template?.id).toBe(template.id);
  });

  it.each(["empty", "legacy-spec-only", "legacy-publication-only", "new-version-only", "new-publication-only", "both"] as const)("rejects an invalid template path: %s", async (kind) => {
    const publication = await createPublication();
    const paths: Record<typeof kind, TemplateInput> = {
      empty: { programSpecificationId: null, publicationId: null, courseSpecificationVersionId: null, coursePublicationId: null },
      "legacy-spec-only": { programSpecificationId: a.legacyDraft.spec.id, publicationId: null, courseSpecificationVersionId: null, coursePublicationId: null },
      "legacy-publication-only": { programSpecificationId: null, publicationId: a.legacyDraft.publication.id, courseSpecificationVersionId: null, coursePublicationId: null },
      "new-version-only": { courseSpecificationVersionId: publication.versionId, coursePublicationId: null },
      "new-publication-only": { courseSpecificationVersionId: null, coursePublicationId: publication.id },
      both: { programSpecificationId: a.legacyDraft.spec.id, publicationId: a.legacyDraft.publication.id,
        courseSpecificationVersionId: publication.versionId, coursePublicationId: publication.id },
    };
    await expect(createTemplate(paths[kind])).rejects.toThrow(/course_template_single_publication_path/);
  });

  it("rejects a publication from another version and cross-tenant new-path parents", async () => {
    const first = await createPublication();
    const other = await createPublication();
    await expect(createTemplate({ courseSpecificationVersionId: first.versionId, coursePublicationId: other.id })).rejects.toMatchObject({ code: "P2003" });
    const foreign = await createPublication({}, b);
    await expect(createTemplate({ courseSpecificationVersionId: foreign.versionId, coursePublicationId: foreign.id })).rejects.toMatchObject({ code: "P2003" });
  });

  it("permits only one template per version even when the code differs", async () => {
    const first = await createTemplate();
    await expect(createTemplate({ courseSpecificationVersionId: first.courseSpecificationVersionId,
      coursePublicationId: first.coursePublicationId, code: "DIFFERENT" })).rejects.toMatchObject({ code: "P2002" });
  });

  it.each(["FAILED", "PUBLISHED"] as const)("rejects a new template when its publication is %s", async (status) => {
    const publication = await createPublication();
    if (status === "PUBLISHED") await publish(publication.id);
    else await inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status } }));
    await expect(createTemplate({ courseSpecificationVersionId: publication.versionId, coursePublicationId: publication.id }))
      .rejects.toThrow(/requires a PENDING course publication/);
  });

  it("freezes new template data, deletion and both directions of published path switching", async () => {
    const template = await createTemplate();
    await publish(template.coursePublicationId ?? "missing");
    const other = await createPublication();
    await publish(other.id);
    const changes: Prisma.CourseTemplateUncheckedUpdateInput[] = [
      { nameAr: "Changed" }, { spec: { altered: true } }, { assessmentPlan: [{ altered: true }] },
      { courseSpecificationVersionId: other.versionId, coursePublicationId: other.id },
      { programSpecificationId: a.legacyDraft.spec.id, publicationId: a.legacyDraft.publication.id, courseSpecificationVersionId: null, coursePublicationId: null },
    ];
    for (const data of changes) await expect(inA((tx) => tx.courseTemplate.update({ where: { id: template.id }, data }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplate.delete({ where: { id: template.id } }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplate.update({ where: { id: a.legacyPublished.template.id }, data: {
      programSpecificationId: null, publicationId: null, courseSpecificationVersionId: other.versionId, coursePublicationId: other.id,
    } }))).rejects.toThrow(/immutable/);
  });

  it("extends only the shared topic guard to freeze new-path insertions and moves", async () => {
    const template = await createTemplate();
    await publish(template.coursePublicationId ?? "missing");
    await expect(inA((tx) => tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Late topic", orderIndex: 0 } })))
      .rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplateTopic.update({ where: { id: a.legacyDraft.topic.id }, data: { courseTemplateId: template.id } })))
      .rejects.toThrow(/immutable/);
  });

  it("freezes existing child topics after a legacy draft template adopts the pending new path and is published", async () => {
    const legacy = await inA(async (tx) => {
      const template = await tx.courseTemplate.create({ data: { tenantId: a.tenantId, programSpecificationId: a.legacyDraft.spec.id,
        publicationId: a.legacyDraft.publication.id, code: crypto.randomUUID(), nameAr: "Draft fixture", creditHours: 3 } });
      const topic = await tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Draft topic", orderIndex: 0 } });
      return { template, topic };
    });
    const publication = await createPublication();
    await inA((tx) => tx.courseTemplate.update({ where: { id: legacy.template.id }, data: { programSpecificationId: null,
      publicationId: null, courseSpecificationVersionId: publication.versionId, coursePublicationId: publication.id } }));
    await publish(publication.id);
    await expect(inA((tx) => tx.courseTemplateTopic.update({ where: { id: legacy.topic.id }, data: { title: "Tampered" } }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplateTopic.delete({ where: { id: legacy.topic.id } }))).rejects.toThrow(/immutable/);
  });

  it("keeps the legacy catalogue response and safely rejects new-path operational creation until the next stage", async () => {
    const template = await createTemplate();
    await publish(template.coursePublicationId ?? "missing");
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () => await listPublishedCourseTemplates());
    expect(rows.map((r) => r.id)).toEqual([a.legacyPublished.template.id]);
    await expect(runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () =>
      await createCourseFromTemplate(a.workspace.id, { templateId: template.id, semesterId: crypto.randomUUID() }),
    )).rejects.toMatchObject({ statusCode: 400, code: "BAD_REQUEST" });
  });

  it("builds and validates template/topics while pending, publishes atomically, then freezes the snapshot", async () => {
    const publication = await createPublication();
    const built = await inA(async (tx) => {
      const template = await tx.courseTemplate.create({ data: { tenantId: a.tenantId, courseSpecificationVersionId: publication.versionId,
        coursePublicationId: publication.id, code: snapshot.code, nameAr: snapshot.nameAr, creditHours: 3, spec: snapshot } });
      const first = await tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Draft cells", orderIndex: 0 } });
      const removable = await tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Draft structure", orderIndex: 1 } });
      await tx.courseTemplateTopic.update({ where: { id: first.id }, data: { title: "Cells", learningOutcomes: ["CLO1"] } });
      await tx.courseTemplateTopic.delete({ where: { id: removable.id } });
      await tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Structure", orderIndex: 1 } });
      await tx.courseTemplate.update({ where: { id: template.id }, data: { assessmentPlan: [{ method: "Exam", weight: 100 }] } });
      const projection = await tx.courseTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { topics: { orderBy: { orderIndex: "asc" } } } });
      expect((await tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: publication.id } })).status).toBe("PENDING");
      expect(projection.topics.map((t) => t.title)).toEqual(["Cells", "Structure"]);
      await tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status: "PUBLISHED", projectionHash: contentHash, publishedById: a.userId, publishedAt: new Date() } });
      return projection;
    });
    expect((await inA((tx) => tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: publication.id } }))).status).toBe("PUBLISHED");
    const stored = await inA((tx) => tx.courseTemplate.findUniqueOrThrow({ where: { id: built.id }, include: { topics: { orderBy: { orderIndex: "asc" } } } }));
    expect(stored).toEqual(built);
    await expect(inA((tx) => tx.courseTemplate.update({ where: { id: built.id }, data: { nameAr: "Tampered" } }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplate.delete({ where: { id: built.id } }))).rejects.toThrow(/immutable/);
    for (const topic of built.topics) {
      await expect(inA((tx) => tx.courseTemplateTopic.update({ where: { id: topic.id }, data: { title: "Tampered" } }))).rejects.toThrow(/immutable/);
      await expect(inA((tx) => tx.courseTemplateTopic.delete({ where: { id: topic.id } }))).rejects.toThrow(/immutable/);
    }
    await expect(inA((tx) => tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: built.id, title: "Late", orderIndex: 2 } }))).rejects.toThrow(/immutable/);
  });

  it("allows deleting a pending draft after its topics are removed", async () => {
    const template = await createTemplate();
    const topic = await inA((tx) => tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Draft", orderIndex: 0 } }));
    await inA((tx) => tx.courseTemplateTopic.delete({ where: { id: topic.id } }));
    await inA((tx) => tx.courseTemplate.delete({ where: { id: template.id } }));
    expect(await inA((tx) => tx.courseTemplate.findUnique({ where: { id: template.id } }))).toBeNull();
  });

  it("blocks new-path draft writes while failed until the publication is explicitly reset to pending", async () => {
    const template = await createTemplate();
    const topic = await inA((tx) => tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Draft", orderIndex: 0 } }));
    const publicationId = template.coursePublicationId ?? "missing";
    await inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publicationId }, data: { status: "FAILED", errorMessage: "Interrupted" } }));
    await expect(inA((tx) => tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Late", orderIndex: 1 } }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplateTopic.update({ where: { id: topic.id }, data: { title: "Changed" } }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplateTopic.delete({ where: { id: topic.id } }))).rejects.toThrow(/immutable/);
    await expect(inA((tx) => tx.courseTemplate.update({ where: { id: template.id }, data: { nameAr: "Changed" } }))).rejects.toThrow(/immutable/);
    await inA((tx) => tx.courseSpecificationPublication.update({ where: { id: publicationId }, data: { status: "PENDING", errorMessage: null } }));
    expect((await inA((tx) => tx.courseTemplateTopic.update({ where: { id: topic.id }, data: { title: "Retry draft" } }))).title).toBe("Retry draft");
  });

  it("preserves the legacy failed-publication edit behavior", async () => {
    const legacy = await inA((tx) => seedLegacy(tx, a.tenantId, a.userId, a.legacyDraft.spec.programId, a.source.fileId, false));
    await inA((tx) => tx.programSpecificationPublication.update({ where: { id: legacy.publication.id }, data: { status: "FAILED", errorMessage: "Interrupted" } }));
    await inA((tx) => tx.courseTemplate.update({ where: { id: legacy.template.id }, data: { nameAr: "Legacy retry" } }));
    await inA((tx) => tx.courseTemplateTopic.update({ where: { id: legacy.topic.id }, data: { title: "Legacy retry" } }));
    const topic = await inA((tx) => tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: legacy.template.id, title: "Legacy addition", orderIndex: 1 } }));
    await inA((tx) => tx.courseTemplateTopic.delete({ where: { id: topic.id } }));
    await inA((tx) => tx.courseTemplate.create({ data: { tenantId: a.tenantId, programSpecificationId: legacy.spec.id,
      publicationId: legacy.publication.id, code: crypto.randomUUID(), nameAr: "Legacy addition", creditHours: 3 } }));
  });

  it("rolls back template/topics if the final publication transition fails", async () => {
    const publication = await createPublication();
    await expect(inA(async (tx) => {
      const template = await tx.courseTemplate.create({ data: { tenantId: a.tenantId, courseSpecificationVersionId: publication.versionId,
        coursePublicationId: publication.id, code: snapshot.code, nameAr: snapshot.nameAr, creditHours: 3 } });
      await tx.courseTemplateTopic.create({ data: { tenantId: a.tenantId, courseTemplateId: template.id, title: "Draft", orderIndex: 0 } });
      await tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status: "PUBLISHED", publishedById: crypto.randomUUID(), publishedAt: new Date() } });
    })).rejects.toMatchObject({ code: "P2003" });
    expect((await inA((tx) => tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: publication.id } }))).status).toBe("PENDING");
    expect(await inA((tx) => tx.courseTemplate.count({ where: { coursePublicationId: publication.id } }))).toBe(0);
    expect(await inA((tx) => tx.courseTemplateTopic.count({ where: { courseTemplate: { coursePublicationId: publication.id } } }))).toBe(0);
  });

  it("enforces publication/template uniqueness under concurrent requests", async () => {
    const edition = await createEdition();
    const attempts = await Promise.allSettled([0, 1].map(() => createPublication({ versionId: edition.version.id, approvalId: edition.approval.id })));
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const publication = await inA((tx) => tx.courseSpecificationPublication.findFirstOrThrow({ where: { versionId: edition.version.id } }));
    const templates = await Promise.allSettled([0, 1].map(() => createTemplate({ courseSpecificationVersionId: publication.versionId, coursePublicationId: publication.id })));
    expect(templates.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("locks the publication against template insertion while publication is uncommitted", async () => {
    const publication = await createPublication();
    const ready = latch();
    const release = latch();
    const publishing = inA(async (tx) => {
      await tx.courseSpecificationPublication.update({ where: { id: publication.id }, data: { status: "PUBLISHED", publishedById: a.userId, publishedAt: new Date() } });
      ready.resolve();
      await release.promise;
    });
    try {
      await Promise.race([ready.promise, publishing.then(() => { throw new Error("Publication did not hold its transaction"); })]);
      await expect(inA(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");
        await tx.$executeRaw`INSERT INTO course_templates (id, "tenantId", "courseSpecificationVersionId", "coursePublicationId", code, "nameAr", "creditHours")
          VALUES (${crypto.randomUUID()}, ${a.tenantId}, ${publication.versionId}, ${publication.id}, 'BIO1101', 'Biology', 3)`;
      })).rejects.toThrow(/lock timeout/i);
    } finally { release.resolve(); await publishing; }
    await expect(createTemplate({ courseSpecificationVersionId: publication.versionId, coursePublicationId: publication.id }))
      .rejects.toThrow(/requires a PENDING course publication/);
  });

  it.each(["course_spec_publications", "course_templates"])("preserves forced RLS and grants on %s", async (table) => {
    const [security] = await prismaBase.$queryRaw<{ enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced, p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read, has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname WHERE c.relname = ${table}
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without context and injects the tenant despite foreign filters", async () => {
    await expect(prisma.courseSpecificationPublication.findMany()).rejects.toThrow(/سياق مستأجر/);
    const publication = await createPublication();
    const foreign = await createPublication({}, b);
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () =>
      await prisma.courseSpecificationPublication.findMany({ where: { tenantId: b.tenantId, id: { in: [publication.id, foreign.id] } }, select: { id: true } }),
    );
    expect(rows).toEqual([{ id: publication.id }]);
    expect(await inA((tx) => tx.$queryRaw`SELECT id FROM course_spec_publications WHERE id = ${foreign.id}`)).toEqual([]);
    expect(await prismaBase.$queryRaw`SELECT id FROM course_spec_publications WHERE id = ${publication.id}`).toEqual([]);
  });

  it("rejects raw foreign publication/template writes and tenant changes", async () => {
    const edition = await createEdition("APPROVED", b);
    await expect(inA((tx) => tx.$executeRaw`INSERT INTO course_spec_publications (id, "tenantId", "versionId", "approvalId", "projectionVersion", "requestedById")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${edition.version.id}, ${edition.approval.id}, 'projection-1', ${b.userId})`)).rejects.toThrow(/row-level security/i);
    const publication = await createPublication();
    await expect(inA((tx) => tx.$executeRaw`UPDATE course_spec_publications SET "tenantId" = ${b.tenantId}, "versionId" = ${edition.version.id},
      "approvalId" = ${edition.approval.id} WHERE id = ${publication.id}`)).rejects.toThrow(/row-level security/i);
    const foreign = await createPublication({ versionId: edition.version.id, approvalId: edition.approval.id }, b);
    await expect(inA((tx) => tx.$executeRaw`INSERT INTO course_templates (id, "tenantId", "courseSpecificationVersionId", "coursePublicationId", code, "nameAr", "creditHours")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${foreign.versionId}, ${foreign.id}, 'FOREIGN', 'Foreign', 3)`)).rejects.toThrow(/row-level security/i);
  });
});
