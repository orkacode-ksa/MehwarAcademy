import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma, type CourseSpecificationType } from "@prisma/client";
import { reviewedCourseSpecificationSchema } from "@mihwar/shared";
import { prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { createCourseFromTemplate } from "../modules/academic/courseTemplates.service.js";
import { publishCourseSpecification } from "../modules/academic/courseSpecificationProjection.service.js";
import * as projectionData from "../modules/academic/courseSpecificationProjection.data.js";
import { courseDisplayName } from "../lib/courseName.js";
import { renderGradeSheetHtml } from "../modules/documents/gradeSheet.template.js";
import { buildCourseFileHtml } from "../modules/documents/documents.service.js";
import { getGradeGrid } from "../modules/teaching/content.service.js";

const { buildCourseTemplateProjection, COURSE_TEMPLATE_PROJECTION_VERSION, hashCourseTemplateProjection, hashSpecificationContent } = projectionData;
const grades = [{ key: "FINAL", label: "Regulation final", weight: 100 }];
const fileItems = [{ key: "REPORT", required: true }];
const absencePolicy = { warnPercent: 10, banPercent: 20 };
const nameCases = [
  { label: "Arabic only", nameAr: "الأحياء العامة", nameEn: null, storedAr: "الأحياء العامة" },
  { label: "English only", nameAr: null, nameEn: "General Biology", storedAr: null },
  { label: "bilingual", nameAr: "الأحياء العامة", nameEn: "General Biology", storedAr: "الأحياء العامة" },
] as const;
const invalidNames = [
  { label: "both missing", nameAr: null, nameEn: null },
  { label: "empty Arabic and missing English", nameAr: "", nameEn: null },
  { label: "blank Arabic and empty English", nameAr: "   ", nameEn: "" },
  { label: "missing Arabic and blank English", nameAr: null, nameEn: "  " },
  { label: "whitespace-only language names", nameAr: "\t\n", nameEn: "\r " },
] as const;

function reviewed() {
  return reviewedCourseSpecificationSchema.parse({
    courseKey: "courses.0", status: "READY", courseCode: "BIO1101", courseTitle: "General Biology",
    nameAr: "الأحياء العامة", nameEn: "General Biology", creditHours: 3, hasLab: true, description: "Approved human description",
    theoreticalHours: 2, practicalHours: 1, requiredOrElective: "REQUIRED", level: "1",
    objectives: ["Understand living systems"], prerequisites: ["BIO1000"], corequisites: ["CHEM1000"],
    theoreticalTopics: [{ id: "theory-source-id", title: "Cells", orderIndex: 10, details: ["Membranes", "Nuclei"], contactHours: 1.5, learningOutcomes: ["K1"], sourcePages: [2, 3] }],
    practicalTopics: [{ id: "lab-source-id", title: "Microscopy", orderIndex: 0, details: ["Slide preparation"], contactHours: 2.25, learningOutcomes: ["S1"], sourcePages: [4] }],
    unclassifiedTopics: [{ id: "other-source-id", title: "Field visit", orderIndex: 5, sourcePages: [5] }],
    learningOutcomes: [{ id: "outcome-source-id", code: "K1", text: "Explain cell structure", domain: "K", alignedPloCodes: ["PLO1"], sourcePages: [6] }],
    assessmentPlan: [{ id: "assessment-source-id", activity: "Final exam", week: "16", percentage: 60, outcomeCodes: ["K1"], sourcePages: [7] }, { id: "assessment-unknown", sourcePages: [8] }],
    references: { essential: [{ id: "reference-id", citation: "Official biology textbook", type: "Book", sourcePages: [9] }], supportive: [], electronicMaterials: [], otherLearningMaterials: [], unclassified: [] },
    sourcePages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  });
}

function training() {
  return { ...reviewed(), theoreticalTopics: [], practicalTopics: [], unclassifiedTopics: [],
    activities: [{ id: "activity-id", title: "Supervised fieldwork", sourcePages: [10] }],
    stages: [{ title: "Orientation" }], supervision: "Department supervisor",
    deliverables: ["Field report"], duration: { weeks: 8 },
  };
}

async function seedTenant() {
  // Tenant/User are deliberately unscoped authentication records; all academic rows use RLS.
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Projection test" } });
  const user = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@projection.test`, passwordHash: "unused", fullName: "Teacher", role: "TEACHER" } });
  const publisher = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@projection.test`, passwordHash: "unused", fullName: "Institution publisher", role: "ADMIN", staffScreens: ["institutions"] } });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const academicCourse = await tx.academicCourse.create({ data: { tenantId, code: "BIO1101", codeKey: "BIO 1101" } });
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: user.id, name: "Projection workspace" } });
    await tx.subscription.create({ data: { tenantId, workspaceId: workspace.id, planCode: "MIHWAR_PRO", status: "TRIALING", trialEndsAt: new Date(Date.now() + 86_400_000) } });
    const bytes = Buffer.from("%PDF-1.7\nProjection fixture\n%%EOF");
    const file = await tx.fileAsset.create({ data: { tenantId, workspaceId: workspace.id, uploadedById: user.id,
      objectKey: crypto.randomUUID(), originalName: "official.pdf", mimeType: "application/pdf", sizeBytes: bytes.length, purpose: "UNIVERSITY", storage: "DB" } });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
    const source = await tx.specificationSource.create({ data: { tenantId, fileId: file.id, uploadedById: user.id, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex") } });
    const extraction = await tx.programSpecificationExtraction.create({ data: { tenantId, sourceId: source.id, attempt: 1, status: "SUCCEEDED",
      requestedById: user.id, promptVersion: "fixture", schemaVersion: "fixture", extractedData: { programs: [{ courses: [{ description: "Unapproved AI data" }] }, { courses: [] }] }, finishedAt: new Date() } });
    const year = await tx.academicYear.create({ data: { tenantId, label: "2026", startDate: new Date("2026-01-01"), endDate: new Date("2027-01-01") } });
    await tx.regulation.create({ data: { tenantId, gradeScheme: grades, courseFileItems: fileItems, absencePolicy } });
    return { tenantId, userId: user.id, publisherId: publisher.id, academicCourse, workspace, source, extraction, year };
  });
}
type Fixture = Awaited<ReturnType<typeof seedTenant>>;
let a: Fixture;
let b: Fixture;
let revision = 0;
const inA = <T>(fn: (tx: TenantTx) => Promise<T>) => withExplicitTenantTx(a.tenantId, fn);

function first<T>(items: readonly T[]): T {
  const value = items[0];
  if (value === undefined) throw new Error("Expected fixture row");
  return value;
}

async function pendingPublication(data: unknown = reviewed(), type: CourseSpecificationType | null = "STANDARD_COURSE", target = a, overrideHash?: string) {
  return withExplicitTenantTx(target.tenantId, async (tx) => {
    const tenantId = target.tenantId;
    const payload = data as Prisma.InputJsonValue;
    const contentHash = overrideHash ?? hashSpecificationContent(payload);
    const version = await tx.courseSpecificationVersion.create({ data: { tenantId, academicCourseId: target.academicCourse.id,
      sourceId: target.source.id, extractionId: target.extraction.id, sourceCourseKey: "courses.0", revisionNumber: ++revision,
      specificationType: type, extractedData: { description: "This must never become the operational spec" } } });
    const review = await tx.courseSpecificationReview.create({ data: { tenantId, sourceId: target.source.id, versionId: version.id,
      revision: 1, status: "COMPLETED", draftData: payload, reviewedData: payload, contentHash, reviewedById: target.publisherId, reviewedAt: new Date() } });
    const batch = await tx.courseSpecificationApprovalBatch.create({ data: { tenantId, requestKey: crypto.randomUUID(), manifestHash: contentHash, requestedById: target.publisherId } });
    const approval = await tx.courseSpecificationApproval.create({ data: { tenantId, batchId: batch.id, versionId: version.id, reviewId: review.id,
      contentHash, status: "APPROVED", decidedById: target.publisherId, decidedAt: new Date() } });
    await tx.courseSpecificationApprovalBatch.update({ where: { id: batch.id }, data: { submittedAt: new Date() } });
    await tx.courseSpecificationVersion.update({ where: { id: version.id }, data: { status: "APPROVED", currentReviewId: review.id,
      currentApprovalId: approval.id, reviewedData: payload, contentHash } });
    const publication = await tx.courseSpecificationPublication.create({ data: { tenantId, versionId: version.id, approvalId: approval.id,
      requestedById: target.publisherId, projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION } });
    return { version, review, approval, publication };
  });
}
const publish = (publicationId: string, target = a, actor = target.publisherId) => runWithTenant({ tenantId: target.tenantId, userId: actor }, async () => await publishCourseSpecification(publicationId));

async function unchangedAfterFailure(edition: Awaited<ReturnType<typeof pendingPublication>>, operation: () => Promise<unknown>, status: number) {
  const before = await inA((tx) => tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: edition.version.id } }));
  const topicCount = await inA((tx) => tx.courseTemplateTopic.count({ where: { tenantId: a.tenantId } }));
  await expect(operation()).rejects.toMatchObject({ statusCode: status });
  await inA(async (tx) => {
    expect(await tx.courseTemplate.count({ where: { tenantId: a.tenantId, coursePublicationId: edition.publication.id } })).toBe(0);
    expect(await tx.courseTemplateTopic.count({ where: { tenantId: a.tenantId } })).toBe(topicCount);
    expect(await tx.auditLog.count({ where: { tenantId: a.tenantId, entityId: edition.publication.id } })).toBe(0);
    expect(await tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: edition.publication.id } })).toMatchObject({ status: "PENDING", projectionHash: null, publishedAt: null, publishedById: null });
    expect(await tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: edition.version.id } })).toEqual(before);
  });
}

beforeAll(async () => {
  const [role] = await prismaBase.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await seedTenant(); b = await seedTenant();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prismaBase.$disconnect(); });

describe("pure operational projection contract", () => {
  it("preserves the three topic kinds, details, exact hours, provenance and nullable assessment facts", () => {
    const p = buildCourseTemplateProjection(reviewed(), "STANDARD_COURSE", "courses.0");
    expect(p).toMatchObject({ code: "BIO1101", nameAr: "الأحياء العامة", nameEn: "General Biology", creditHours: 3, hasLab: true, operationalPlan: {}, projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION });
    expect(p.topics.map((t) => t.kind)).toEqual(["THEORETICAL", "PRACTICAL", "UNCLASSIFIED"]);
    expect(p.topics.map((t) => t.orderIndex)).toEqual([0, 1, 2]);
    expect(p.topics[0]).toMatchObject({ title: "Cells", details: ["Membranes", "Nuclei"], contactHours: "1.50", learningOutcomes: ["K1"], sourcePages: [2, 3] });
    expect(p.topics[1]).toMatchObject({ contactHours: "2.25", sourcePages: [4] });
    expect(p.topics[2]?.contactHours).toBeNull();
    expect(p.assessmentPlan).toEqual([{ method: "Final exam", timing: "16", weight: 60, outcomeCodes: ["K1"], sourcePages: [7] }, { method: null, timing: null, weight: null, outcomeCodes: [], sourcePages: [8] }]);
    expect(p.spec).toMatchObject({ description: "Approved human description", contactHours: { lecture: 2, lab: 1 }, outcomes: [{ code: "K1", domain: "K", text: "Explain cell structure" }], references: { main: "Official biology textbook" } });
    expect(JSON.stringify(p)).not.toContain('"target":70');
    expect(JSON.stringify(p)).not.toContain('"tutorial":0');
  });

  it("selects the exact course from a multi-course review without leaking another course", () => {
    const p = buildCourseTemplateProjection({ reviewedCourseSpecifications: [{ ...reviewed(), courseKey: "programs.1.courses.0", courseCode: "CHM1000" }, reviewed()] }, "STANDARD_COURSE", "courses.0");
    expect(p.code).toBe("BIO1101");
    expect(() => buildCourseTemplateProjection({ reviewedCourseSpecifications: [reviewed(), reviewed()] }, "STANDARD_COURSE", "courses.0")).toThrow();
  });

  it("keeps an unknown type unknown and does not create missing CLO codes or translations", () => {
    const data = reviewed();
    data.nameAr = null; data.courseTitle = null; data.nameEn = "Official English name";
    first(data.learningOutcomes).code = null;
    const p = buildCourseTemplateProjection(data, null, "courses.0");
    expect(p.specificationType).toBeNull(); expect(p.nameAr).toBeNull(); expect(p.nameEn).toBe("Official English name"); expect(p.spec.outcomes).toEqual([]);
  });

  it.each(nameCases)("preserves $label in the explicit language fields without using courseTitle as a fallback", ({ nameAr, nameEn, storedAr }) => {
    const p = buildCourseTemplateProjection({ ...reviewed(), nameAr, nameEn, courseTitle: "Unclassified display title" }, "STANDARD_COURSE", "courses.0");
    expect(p.nameAr).toBe(storedAr); expect(p.nameEn).toBe(nameEn);
  });

  it.each(nameCases)("renders $label in a neutral document label without changing language fields", ({ nameAr, nameEn }) => {
    const names = { code: "BIO1101", nameAr, nameEn };
    const before = { ...names };
    const html = renderGradeSheetHtml({ courseCode: names.code, courseNameAr: nameAr, courseNameEn: nameEn,
      sectionLabel: "1", teacherName: "Teacher", generatedAt: new Date("2026-10-14"), assessments: [], students: [] });
    expect(html).toContain(courseDisplayName(names));
    expect(names).toEqual(before);
  });

  it("keeps existing hashes unchanged when the added optional English name is absent", () => {
    const p = buildCourseTemplateProjection({ ...reviewed(), nameEn: null }, "STANDARD_COURSE", "courses.0");
    const { nameEn, ...previousSnapshot } = p;
    expect(nameEn).toBeNull();
    expect(hashCourseTemplateProjection(p)).toBe(hashSpecificationContent(previousSnapshot));
    expect(hashCourseTemplateProjection({ ...p, nameEn: "General Biology" })).not.toBe(hashCourseTemplateProjection(p));
  });

  it.each(["FIELD_TRAINING", "COOPERATIVE_TRAINING", "GRADUATION_PROJECT"] as const)("projects %s as a versioned operational plan without synthetic topics", (type) => {
    const p = buildCourseTemplateProjection(training(), type, "courses.0");
    expect(p.topics).toEqual([]);
    expect(p.operationalPlan).toMatchObject({ version: COURSE_TEMPLATE_PROJECTION_VERSION, data: { activities: [{ title: "Supervised fieldwork", sourcePages: [10] }], stages: [{ title: "Orientation" }], supervision: "Department supervisor", deliverables: ["Field report"], duration: { weeks: 8 } }, assessmentPlan: p.assessmentPlan });
  });

  it("hashes deterministically without database IDs, timestamps or object key order", () => {
    const one = training();
    const two = { ...one, activities: [{ title: "Supervised fieldwork", sourcePages: [10], id: crypto.randomUUID(), createdAt: new Date().toISOString() }], assessmentPlan: one.assessmentPlan.map((i) => ({ ...i, id: crypto.randomUUID() })) };
    const p = buildCourseTemplateProjection(one, "FIELD_TRAINING", "courses.0");
    expect(hashCourseTemplateProjection(p)).toBe(hashCourseTemplateProjection(buildCourseTemplateProjection(two, "FIELD_TRAINING", "courses.0")));
    expect(hashSpecificationContent({ b: 1, a: 2 })).toBe(hashSpecificationContent({ a: 2, b: 1 }));
    expect(hashCourseTemplateProjection({ ...p, nameAr: "Different name" })).not.toBe(hashCourseTemplateProjection(p));
  });

  it.each([
    { label: "missing lab fact", data: { ...reviewed(), hasLab: null }, type: "STANDARD_COURSE" },
    { label: "invalid credits", data: { ...reviewed(), creditHours: 0 }, type: "STANDARD_COURSE" },
    { label: "missing code", data: { ...reviewed(), courseCode: null }, type: "STANDARD_COURSE" },
    { label: "English text mislabeled Arabic", data: { ...reviewed(), nameAr: "General Biology" }, type: "STANDARD_COURSE" },
    { label: "English title with Arabic digits mislabeled Arabic", data: { ...reviewed(), nameAr: "General Biology ١" }, type: "STANDARD_COURSE" },
    { label: "unclassified title without language names", data: { ...reviewed(), nameAr: null, nameEn: null, courseTitle: "General Biology" }, type: "STANDARD_COURSE" },
    { label: "empty Arabic and missing English name", data: { ...reviewed(), nameAr: "", nameEn: null }, type: "STANDARD_COURSE" },
    { label: "blank language names", data: { ...reviewed(), nameAr: "   ", nameEn: "" }, type: "STANDARD_COURSE" },
    { label: "missing topics", data: { ...training(), activities: undefined }, type: "STANDARD_COURSE" },
    { label: "training without real plan", data: { ...reviewed(), operationalPlan: { id: "metadata-only" } }, type: "FIELD_TRAINING" },
    { label: "activity metadata without content", data: { ...reviewed(), activities: [{ id: "metadata", sourcePages: [5] }] }, type: "FIELD_TRAINING" },
    { label: "zero duration without a real plan", data: { ...reviewed(), duration: { weeks: 0 } }, type: "FIELD_TRAINING" },
    { label: "conflicting plan", data: { ...training(), operationalPlan: { duration: { weeks: 9 } } }, type: "FIELD_TRAINING" },
    { label: "unsupported decimal precision", data: { ...reviewed(), theoreticalTopics: [{ ...reviewed().theoreticalTopics[0], contactHours: 1.234 }] }, type: "STANDARD_COURSE" },
  ] as const)("reports $label without changing the source", ({ data, type }) => {
    const before = JSON.stringify(data);
    expect(() => buildCourseTemplateProjection(data, type, "courses.0")).toThrowError(expect.objectContaining({ statusCode: 422, code: "COURSE_PROJECTION_INVALID" }));
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe("database course name invariants", () => {
  async function createNamedCourse(nameAr: string | null, nameEn: string | null) {
    const term = await inA((tx) => tx.semester.create({ data: { tenantId: a.tenantId, academicYearId: a.year.id, label: crypto.randomUUID(), startDate: a.year.startDate, endDate: a.year.endDate } }));
    return inA((tx) => tx.course.create({ data: { tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: term.id,
      code: crypto.randomUUID(), nameAr, nameEn, creditHours: 3 } }));
  }

  it.each(invalidNames)("rejects $label on Course even without the application validator", async ({ nameAr, nameEn }) => {
    await expect(createNamedCourse(nameAr, nameEn)).rejects.toThrow(/course_name_present/);
  });

  it.each(invalidNames)("rejects $label on CourseTemplate even without the application validator", async ({ nameAr, nameEn }) => {
    const edition = await pendingPublication();
    await expect(inA((tx) => tx.courseTemplate.create({ data: { tenantId: a.tenantId, courseSpecificationVersionId: edition.version.id,
      coursePublicationId: edition.publication.id, code: "BIO1101", nameAr, nameEn, creditHours: 3 } }))).rejects.toThrow(/course_template_name_present/);
  });

  it("rejects updates that remove the last real name from Course", async () => {
    const course = await createNamedCourse(null, "General Biology");
    await expect(inA((tx) => tx.course.update({ where: { id: course.id }, data: { nameEn: "   " } }))).rejects.toThrow(/course_name_present/);
    expect(await inA((tx) => tx.course.findUniqueOrThrow({ where: { id: course.id } }))).toMatchObject({ nameAr: null, nameEn: "General Biology" });
  });

  it("rejects updates that remove the last real name from a pending CourseTemplate", async () => {
    const edition = await pendingPublication();
    const template = await inA((tx) => tx.courseTemplate.create({ data: { tenantId: a.tenantId, courseSpecificationVersionId: edition.version.id,
      coursePublicationId: edition.publication.id, code: "BIO1101", nameAr: null, nameEn: "General Biology", creditHours: 3 } }));
    await expect(inA((tx) => tx.courseTemplate.update({ where: { id: template.id }, data: { nameEn: null } }))).rejects.toThrow(/course_template_name_present/);
    expect(await inA((tx) => tx.courseTemplate.findUniqueOrThrow({ where: { id: template.id } }))).toMatchObject({ nameAr: null, nameEn: "General Biology" });
  });
});

describe("atomic internal publication with RLS", () => {
  it("publishes approved reviewedData with complete topics, canonical metadata and audit in one transaction", async () => {
    const edition = await pendingPublication();
    const template = await publish(edition.publication.id);
    expect(template.spec).toMatchObject({ description: "Approved human description" });
    expect(template.topics.map((t) => t.kind)).toEqual(["THEORETICAL", "PRACTICAL", "UNCLASSIFIED"]);
    expect(template.topics[0]?.contactHours?.toFixed(2)).toBe("1.50");
    expect(template.sourcePages).toEqual(reviewed().sourcePages);
    await inA(async (tx) => {
      const publication = await tx.courseSpecificationPublication.findUniqueOrThrow({ where: { id: edition.publication.id } });
      expect(publication).toMatchObject({ status: "PUBLISHED", projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION, publishedById: a.publisherId, projectionHash: hashCourseTemplateProjection(projectionData.persistedCourseTemplateProjection(template)) });
      expect(publication.publishedAt).toEqual(template.publishedAt);
      expect((await tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: edition.version.id } })).reviewedData).toEqual(reviewed());
      expect((await tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: edition.review.id } })).reviewedData).toEqual(reviewed());
      expect(await tx.auditLog.count({ where: { tenantId: a.tenantId, entityId: publication.id, action: "COURSE_SPECIFICATION_PUBLISH" } })).toBe(1);
      expect(await tx.program.count({ where: { tenantId: a.tenantId } })).toBe(0);
      expect(await tx.programSpecification.count({ where: { tenantId: a.tenantId } })).toBe(0);
    });
    for (const operation of [
      (tx: TenantTx) => tx.courseTemplate.update({ where: { id: template.id }, data: { operationalPlan: { changed: true } } }),
      (tx: TenantTx) => tx.courseTemplate.delete({ where: { id: template.id } }),
      (tx: TenantTx) => tx.courseTemplateTopic.update({ where: { id: first(template.topics).id }, data: { details: ["changed"] } }),
      (tx: TenantTx) => tx.courseTemplateTopic.delete({ where: { id: first(template.topics).id } }),
    ]) await expect(inA<unknown>(operation)).rejects.toThrow(/immutable/i);
  });

  it.each(["FIELD_TRAINING", "COOPERATIVE_TRAINING", "GRADUATION_PROJECT"] as const)("publishes %s with operationalPlan and zero topics", async (type) => {
    const edition = await pendingPublication(training(), type);
    const template = await publish(edition.publication.id);
    expect(template.specificationType).toBe(type); expect(template.topics).toHaveLength(0);
    expect(template.operationalPlan).toMatchObject({ version: COURSE_TEMPLATE_PROJECTION_VERSION, data: { duration: { weeks: 8 } } });
  });

  it("keeps unknown type null through publication", async () => {
    const edition = await pendingPublication(reviewed(), null);
    expect((await publish(edition.publication.id)).specificationType).toBeNull();
  });

  it("rolls back late validation failure after template/topics were inserted, then permits a clean retry", async () => {
    const edition = await pendingPublication();
    const normalize = projectionData.persistedCourseTemplateProjection;
    vi.spyOn(projectionData, "persistedCourseTemplateProjection").mockImplementationOnce((row) => ({ ...normalize(row), code: "CORRUPTED" }));
    await unchangedAfterFailure(edition, () => publish(edition.publication.id), 409);
    expect((await publish(edition.publication.id)).topics).toHaveLength(3);
  });

  it("does not leave a partial snapshot or alter approved data after readiness failure", async () => {
    const edition = await pendingPublication({ ...reviewed(), hasLab: null });
    await unchangedAfterFailure(edition, () => publish(edition.publication.id), 422);
  });

  it("makes concurrent and repeated requests return one immutable template", async () => {
    const edition = await pendingPublication();
    const [first, concurrent] = await Promise.all([publish(edition.publication.id), publish(edition.publication.id)]);
    expect(concurrent.id).toBe(first.id);
    expect((await publish(edition.publication.id)).topics.map((t) => t.id)).toEqual(first.topics.map((t) => t.id));
    await inA(async (tx) => {
      expect(await tx.courseTemplate.count({ where: { tenantId: a.tenantId, coursePublicationId: edition.publication.id } })).toBe(1);
      expect(await tx.courseTemplateTopic.count({ where: { tenantId: a.tenantId, courseTemplateId: first.id } })).toBe(3);
      expect(await tx.auditLog.count({ where: { tenantId: a.tenantId, entityId: edition.publication.id } })).toBe(1);
    });
  });

  it("produces the same projectionHash for equivalent approved snapshots across different versions", async () => {
    const first = await pendingPublication(); const second = await pendingPublication();
    const left = await publish(first.publication.id); const right = await publish(second.publication.id);
    expect(left.id).not.toBe(right.id);
    const hashes = await inA((tx) => tx.courseSpecificationPublication.findMany({ where: { tenantId: a.tenantId, id: { in: [first.publication.id, second.publication.id] } }, select: { projectionHash: true } }));
    expect(hashes[0]?.projectionHash).toBe(hashes[1]?.projectionHash);
  });

  it("rejects a version without a current approved decision", async () => {
    const edition = await pendingPublication();
    await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: edition.version.id }, data: { currentApprovalId: null, status: "READY_FOR_APPROVAL" } }));
    await unchangedAfterFailure(edition, () => publish(edition.publication.id), 409);
  });

  it("rejects a non-APPROVED decision at the database boundary", async () => {
    const edition = await pendingPublication();
    const rejected = await inA(async (tx) => {
      const batch = await tx.courseSpecificationApprovalBatch.create({ data: { tenantId: a.tenantId, requestKey: crypto.randomUUID(), manifestHash: edition.approval.contentHash, requestedById: a.publisherId } });
      return tx.courseSpecificationApproval.create({ data: { tenantId: a.tenantId, batchId: batch.id, versionId: edition.version.id, reviewId: edition.review.id,
        contentHash: edition.approval.contentHash, status: "REJECTED", decidedById: a.publisherId, decidedAt: new Date() } });
    });
    await expect(inA((tx) => tx.courseSpecificationPublication.update({ where: { id: edition.publication.id }, data: { approvalId: rejected.id } }))).rejects.toThrow(/APPROVED/);
  });

  it("rejects a stale current review even when another completed review is valid", async () => {
    const edition = await pendingPublication();
    await inA(async (tx) => {
      const other = await tx.courseSpecificationReview.create({ data: { tenantId: a.tenantId, sourceId: a.source.id, versionId: edition.version.id, revision: 2,
        status: "COMPLETED", draftData: reviewed(), reviewedData: reviewed(), contentHash: edition.review.contentHash, reviewedById: a.publisherId, reviewedAt: new Date() } });
      await tx.courseSpecificationVersion.update({ where: { id: edition.version.id }, data: { currentReviewId: other.id } });
    });
    await unchangedAfterFailure(edition, () => publish(edition.publication.id), 409);
  });

  it("recomputes reviewed content hashes rather than trusting matching hash strings", async () => {
    const edition = await pendingPublication(reviewed(), "STANDARD_COURSE", a, "a".repeat(64));
    await unchangedAfterFailure(edition, () => publish(edition.publication.id), 409);
  });

  it("projects the exact approved review when the version's data and copied hash diverge", async () => {
    const edition = await pendingPublication();
    const different = { ...reviewed(), nameAr: "اسم غير معتمد", description: "Unapproved change", theoreticalTopics: [{ ...first(reviewed().theoreticalTopics), title: "Unapproved topic" }] };
    await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: edition.version.id }, data: { reviewedData: different, contentHash: hashSpecificationContent(different) } }));
    const template = await publish(edition.publication.id);
    expect(template.nameAr).toBe("الأحياء العامة");
    expect(template.spec).toMatchObject({ description: "Approved human description" });
    expect(first(template.topics).title).toBe("Cells");
    expect(JSON.stringify(template)).not.toContain("Unapproved change");
    expect(JSON.stringify(template)).not.toContain("Unapproved topic");
    await inA(async (tx) => {
      expect((await tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: edition.approval.reviewId } })).reviewedData).toEqual(reviewed());
      expect((await tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: edition.version.id } })).reviewedData).toEqual(different);
    });
  });

  it("does not require the version's duplicate reviewedData to project an approved review", async () => {
    const edition = await pendingPublication();
    await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: edition.version.id }, data: { reviewedData: Prisma.JsonNull, contentHash: null } }));
    expect((await publish(edition.publication.id)).spec).toMatchObject({ description: "Approved human description" });
  });

  it("does not silently resume a FAILED publication", async () => {
    const edition = await pendingPublication();
    await inA((tx) => tx.courseSpecificationPublication.update({ where: { id: edition.publication.id }, data: { status: "FAILED", errorMessage: "Previous workflow failure" } }));
    await expect(publish(edition.publication.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(await inA((tx) => tx.courseTemplate.count({ where: { tenantId: a.tenantId, coursePublicationId: edition.publication.id } }))).toBe(0);
  });

  it("enforces teacher permissions and hides a foreign tenant's publication", async () => {
    const local = await pendingPublication(); const foreign = await pendingPublication(reviewed(), "STANDARD_COURSE", b);
    await expect(publish(local.publication.id, a, a.userId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(publish(foreign.publication.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(await inA((tx) => tx.courseTemplate.count({ where: { tenantId: b.tenantId } }))).toBe(0);
  });
});

describe("new-path template to operational course", () => {
  async function copy(templateId: string) {
    const term = await inA((tx) => tx.semester.create({ data: { tenantId: a.tenantId, academicYearId: a.year.id, label: crypto.randomUUID(), startDate: a.year.startDate, endDate: a.year.endDate, status: "PREP" } }));
    return runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () => await createCourseFromTemplate(a.workspace.id, { templateId, semesterId: term.id }));
  }

  it.each(nameCases)("publishes and copies $label to Course without manufacturing an Arabic name", async ({ nameAr, nameEn, storedAr }) => {
    const edition = await pendingPublication({ ...reviewed(), nameAr, nameEn });
    const template = await publish(edition.publication.id);
    const course = await copy(template.id);
    expect(template).toMatchObject({ nameAr: storedAr, nameEn });
    expect(course).toMatchObject({ nameAr: storedAr, nameEn });
  });

  it("renders English-only course documents while retaining null Arabic names in the grade-grid DTO", async () => {
    const edition = await pendingPublication({ ...reviewed(), nameAr: null, nameEn: "General Biology" });
    const template = await publish(edition.publication.id);
    const course = await copy(template.id);
    const section = await inA((tx) => tx.section.create({ data: { tenantId: a.tenantId, workspaceId: a.workspace.id, courseId: course.id, label: "1", capacity: 20 } }));
    await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () => {
      expect((await getGradeGrid(a.workspace.id, course.id, section.id)).course).toMatchObject({ nameAr: null, nameEn: "General Biology" });
      expect(await buildCourseFileHtml(a.workspace.id, course.id)).toContain("General Biology");
    });
    expect(await inA((tx) => tx.course.findUniqueOrThrow({ where: { id: course.id } }))).toMatchObject({ nameAr: null, nameEn: "General Biology" });
  });

  it("copies all projected topic/spec/assessment fields but obtains operational policies from Regulation", async () => {
    const edition = await pendingPublication(); const template = await publish(edition.publication.id); const course = await copy(template.id);
    expect(course).toMatchObject({ courseTemplateId: template.id, specificationType: "STANDARD_COURSE", projectionVersion: COURSE_TEMPLATE_PROJECTION_VERSION,
      operationalPlan: {}, spec: template.spec, assessmentPlan: template.assessmentPlan, gradeScheme: grades, fileItems, absencePolicy });
    expect(course.topics.map((t) => ({ title: t.title, orderIndex: t.orderIndex, kind: t.kind, details: t.details, hours: t.contactHours?.toFixed(2) ?? null, learningOutcomes: t.learningOutcomes, sourcePages: t.sourcePages, sourceTemplateTopicId: t.sourceTemplateTopicId })))
      .toEqual(template.topics.map((t) => ({ title: t.title, orderIndex: t.orderIndex, kind: t.kind, details: t.details, hours: t.contactHours?.toFixed(2) ?? null, learningOutcomes: t.learningOutcomes, sourcePages: t.sourcePages, sourceTemplateTopicId: t.id })));
    await inA((tx) => tx.topic.update({ where: { id: first(course.topics).id }, data: { details: ["Teacher snapshot edit"] } }));
    expect((await publish(edition.publication.id)).topics[0]?.details).toEqual(["Membranes", "Nuclei"]);
  });

  it("copies the training operationalPlan independently without manufacturing topics", async () => {
    const edition = await pendingPublication(training(), "FIELD_TRAINING"); const template = await publish(edition.publication.id); const course = await copy(template.id);
    expect(course.operationalPlan).toEqual(template.operationalPlan); expect(course.specificationType).toBe("FIELD_TRAINING"); expect(course.topics).toEqual([]);
    await inA((tx) => tx.course.update({ where: { id: course.id }, data: { operationalPlan: { teacherNotes: "Private snapshot" } } }));
    expect((await publish(edition.publication.id)).operationalPlan).toEqual(template.operationalPlan);
  });

  it("blocks creation from a PENDING new-path template", async () => {
    const edition = await pendingPublication();
    const template = await inA((tx) => tx.courseTemplate.create({ data: { tenantId: a.tenantId, courseSpecificationVersionId: edition.version.id, coursePublicationId: edition.publication.id, code: "BIO1101", nameAr: "Unpublished", creditHours: 3 } }));
    await expect(copy(template.id)).rejects.toMatchObject({ statusCode: 400 });
  });
});
