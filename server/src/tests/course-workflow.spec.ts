import crypto from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma, type UserRole } from "@prisma/client";
import { normalizedCourseExtractionSchema, normalizedCourseCandidateSchema, courseWorkflowDataSchema, normalizeCourseCode, type NormalizedCourseCandidate } from "@mihwar/shared";
import { createApp } from "../app.js";
import { prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { signAccessToken } from "../lib/jwt.js";
import { materializeNormalizedCourses } from "../modules/academic/courseWorkflow.ingestion.js";
import { normalizeSavedCourseExtraction } from "../modules/academic/courseCandidateNormalization.js";
import { courseWorkflowReadiness } from "../modules/academic/courseWorkflow.readiness.js";
import { associateAcademicCourseCurriculum } from "../modules/academic/courseWorkflow.curriculum.js";
import { courseSourceNeedsReview } from "../modules/academic/courseWorkflow.sourceAdmission.js";
import * as projection from "../modules/academic/courseSpecificationProjection.data.js";

const app = createApp();
const W = "/api/workspaces/me/academic";
const grades = [{ key: "FINAL", label: "Regulation final", weight: 100 }];
const fileItems = [{ key: "REPORT", label: "Report", required: true }];
const absencePolicy = { warnPercent: 10, banPercent: 20 };
const id = () => `c${crypto.randomBytes(12).toString("hex")}`;
const code = () => `BIO${crypto.randomInt(100000, 999999)}`;
function first<T>(items: readonly T[]) { const value = items[0]; if (value === undefined) throw new Error("Missing fixture row"); return value; }
function candidate(input: Partial<NormalizedCourseCandidate> = {}, names: { nameAr: string | null; nameEn: string | null } = { nameAr: null, nameEn: "General Biology" }) {
  const key = input.key ?? "courses.0";
  return normalizedCourseCandidateSchema.parse({ key, specificationType: "STANDARD_COURSE", sourcePages: [1, 2, 3],
    data: courseWorkflowDataSchema.parse({ courseKey: key, status: "NOT_REVIEWED", courseCode: code(), courseTitle: "Official title", ...names,
      creditHours: 3, hasLab: false, description: "Original extraction", objectives: ["Explain cell systems"],
      theoreticalTopics: [{ id: "t1", title: "Cells", orderIndex: 0, contactHours: 1.5, details: ["Membranes"], sourcePages: [2] }],
      learningOutcomes: [{ id: "o1", code: "K1", text: "Explain cells", domain: "K", sourcePages: [2] }],
      assessmentPlan: [{ id: "a1", activity: "Final exam", percentage: 100, sourcePages: [3] }],
      references: { essential: [], supportive: [], electronicMaterials: [], otherLearningMaterials: [], unclassified: [] }, sourcePages: [1, 2, 3] }),
    warnings: [{ message: "Retain source warning" }], issues: [{ kind: "uncertain", field: "department" }], provenance: { quote: "Official source evidence" }, ...input });
}
async function actor(tenantId?: string, role: UserRole = "TEACHER", screens: string[] = []) {
  // Only authentication tables are unscoped; all academic fixtures run as the application RLS role.
  const tenant = tenantId ? { id: tenantId } : await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Workflow university" } });
  const user = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@workflow.test`, passwordHash: "unused", fullName: "Workflow actor", role, staffScreens: screens } });
  const workspace = await withExplicitTenantTx(tenant.id, async (tx) => {
    const ws = await tx.workspace.create({ data: { tenantId: tenant.id, ownerId: user.id, name: "Workflow workspace" } });
    await tx.workspaceMember.create({ data: { tenantId: tenant.id, workspaceId: ws.id, userId: user.id, role: "OWNER" } });
    await tx.subscription.create({ data: { tenantId: tenant.id, workspaceId: ws.id, planCode: "MIHWAR_PRO", status: "TRIALING", trialEndsAt: new Date(Date.now() + 86_400_000) } });
    return ws;
  });
  const token = signAccessToken({ tenantId: tenant.id, userId: user.id, role, tv: user.tokenVersion, jti: crypto.randomUUID() });
  return { tenantId: tenant.id, userId: user.id, workspace, agent: request.agent(app).set("Authorization", `Bearer ${token}`) };
}
type Actor = Awaited<ReturnType<typeof actor>>;
let a: Actor, b: Actor, colleague: Actor, staff: Actor, deniedStaff: Actor, student: Actor;
let termId: string;
const scoped = <T>(fn: (tx: TenantTx) => Promise<T>) => withExplicitTenantTx(a.tenantId, fn);
const P = () => `/api/owner/institutions/${a.tenantId}/academic`;

async function source(candidates: NormalizedCourseCandidate[] = [candidate()], owner = a) {
  return withExplicitTenantTx(owner.tenantId, async (tx) => {
    const tenantId = owner.tenantId;
    const bytes = Buffer.from("%PDF-1.7\nWorkflow source fixture\n%%EOF");
    const file = await tx.fileAsset.create({ data: { tenantId, workspaceId: owner.workspace.id, uploadedById: owner.userId,
      originalName: "official.pdf", objectKey: crypto.randomUUID(), mimeType: "application/pdf", purpose: "UNIVERSITY", storage: "DB", sizeBytes: bytes.length } });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
    const src = await tx.specificationSource.create({ data: { tenantId, fileId: file.id, uploadedById: owner.userId, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex") } });
    const extractionId = id();
    const normalized = normalizedCourseExtractionSchema.parse({ schemaVersion: "normalized-course-candidates-1", sourceId: src.id, extractionId, pageCount: 10, candidates });
    await tx.programSpecificationExtraction.create({ data: { tenantId, id: extractionId, sourceId: src.id, attempt: 1, status: "SUCCEEDED", requestedById: owner.userId,
      promptVersion: "test-only", schemaVersion: normalized.schemaVersion, extractedData: normalized as Prisma.InputJsonValue, finishedAt: new Date() } });
    await tx.specificationSource.update({ where: { id: src.id }, data: { currentExtractionId: extractionId, extractionStatus: "SUCCEEDED" } });
    return { sourceId: src.id, extractionId, normalized };
  });
}
async function materialize(src: Awaited<ReturnType<typeof source>>, owner = a) {
  const response = await owner.agent.post(`${W}/specification-sources/${src.sourceId}/course-versions`).send({ extractionId: src.extractionId });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data as Array<{ key: string; status: string; version: { id: string; academicCourseId: string; revisionNumber: number; extractedData: Prisma.JsonValue }; conflicts?: string[] }>;
}
async function complete(versionId: string, owner = a, overrides: object = {}) {
  const opened = await owner.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({});
  expect(opened.status, JSON.stringify(opened.body)).toBe(201);
  const saved = await owner.agent.patch(`${W}/course-specification-versions/${versionId}/reviews/${opened.body.data.id}`).send({ expectedVersion: opened.body.data.version,
    course: { ...opened.body.data.draftData, status: "READY", ...overrides } });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  const result = await owner.agent.post(`${W}/course-specification-versions/${versionId}/reviews/${opened.body.data.id}/complete`).send({ expectedVersion: saved.body.data.version });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.data as { id: string; version: string; contentHash: string; reviewedData: Prisma.JsonValue; readiness: { approvalReadiness: { ready: boolean }; publicationReadiness: { ready: boolean } } };
}
async function batch(versionId: string, review: Awaited<ReturnType<typeof complete>>, requestKey = crypto.randomUUID()) {
  const response = await a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey, items: [{ versionId, reviewId: review.id, contentHash: review.contentHash }] });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const submitted = await a.agent.post(`${W}/course-specification-approval-batches/${response.body.data.id}/submit`).send({});
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
  return response.body.data as { id: string; manifestHash: string; items: Array<{ id: string; status: string }> };
}
async function approved(versionId: string) {
  const review = await complete(versionId); const requestBatch = await batch(versionId, review);
  const decided = await staff.agent.post(`${P()}/course-specification-approvals/${first(requestBatch.items).id}/approve`).send({});
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  return { review, batch: requestBatch };
}

beforeAll(async () => {
  const [role] = await prismaBase.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await actor(); b = await actor(); colleague = await actor(a.tenantId); student = await actor(a.tenantId, "STUDENT");
  staff = await actor(undefined, "ADMIN", ["institutions"]); deniedStaff = await actor(undefined, "ADMIN", ["users"]);
  await scoped(async (tx) => {
    const year = await tx.academicYear.create({ data: { tenantId: a.tenantId, label: "2026", startDate: new Date("2026-01-01"), endDate: new Date("2027-01-01") } });
    termId = (await tx.semester.create({ data: { tenantId: a.tenantId, academicYearId: year.id, label: "First", startDate: year.startDate, endDate: year.endDate, status: "PREP" } })).id;
    await tx.regulation.create({ data: { tenantId: a.tenantId, gradeScheme: grades, courseFileItems: fileItems, absencePolicy } });
  });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prismaBase.$disconnect(); });

describe("production course workflow via HTTP", () => {
  it("returns workflow capabilities from the permission adapter without exposing staff actions to teachers", async () => {
    const teacher = await a.agent.get(`${W}/capabilities`);
    expect(teacher.status).toBe(200); expect(teacher.body.data).toEqual({ canReview: true, canApprove: false, canPublish: false, canResolve: false });
    const reviewer = await staff.agent.get(`${P()}/capabilities`);
    expect(reviewer.status).toBe(200); expect(reviewer.body.data).toEqual({ canReview: true, canApprove: true, canPublish: true, canResolve: true });
    expect((await deniedStaff.agent.get(`${P()}/capabilities`)).status).toBe(403);
  });
  it.each([
    { nameAr: null, nameEn: "General Biology", label: "English only" },
    { nameAr: "الأحياء العامة", nameEn: null, label: "Arabic only" },
    { nameAr: "الأحياء العامة", nameEn: "General Biology", label: "bilingual" },
  ])("runs the full STANDARD_COURSE flow for $label without external AI", async ({ nameAr, nameEn }) => {
    const src = await source([candidate({}, { nameAr, nameEn })]); const version = first(await materialize(src)).version;
    const decision = await approved(version.id);
    const published = await staff.agent.post(`${P()}/course-specification-versions/${version.id}/publications`).send({});
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    const template = published.body.data;
    expect(template).toMatchObject({ nameAr, nameEn, specificationType: "STANDARD_COURSE" });
    const catalogue = await colleague.agent.get(`${W}/course-templates`);
    expect(catalogue.status).toBe(200);
    expect(catalogue.body.data.find((t: { id: string }) => t.id === template.id)).toMatchObject({ templateId: template.id, nameAr, nameEn,
      legacy: false, sourceType: "COURSE_SPECIFICATION", officialVersion: null, revisionNumber: 1, program: null, ownerDepartment: null });
    const course = await colleague.agent.post(`${W}/courses/from-template`).send({ templateId: template.id, semesterId: termId });
    expect(course.status, JSON.stringify(course.body)).toBe(201);
    expect(course.body.data).toMatchObject({ nameAr, nameEn, courseTemplateId: template.id, gradeScheme: grades, fileItems, absencePolicy });
    expect(first(course.body.data.topics as Array<{ contactHours: string; details: string[] }>)).toMatchObject({ contactHours: "1.5", details: ["Membranes"] });
    await scoped(async (tx) => {
      expect((await tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: version.id } })).extractedData).toEqual(src.normalized.candidates[0]?.data);
      expect((await tx.courseSpecificationApproval.findUniqueOrThrow({ where: { id: first(decision.batch.items).id } })).reviewId).toBe(decision.review.id);
      expect(await tx.program.count({ where: { tenantId: a.tenantId } })).toBe(0);
    });
  });

  it("materialization/review/batch/publication are idempotent and concurrency-safe", async () => {
    const src = await source();
    const [one, two] = await Promise.all([materialize(src), materialize(src)]);
    expect(first(one).version.id).toBe(first(two).version.id);
    const versionId = first(one).version.id;
    const opens = await Promise.all([a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({}), a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({})]);
    expect(opens.map((r) => r.status)).toEqual([201, 201]); expect(opens[0]?.body.data.id).toBe(opens[1]?.body.data.id);
    const review = await complete(versionId), requestKey = crypto.randomUUID();
    const input = { requestKey, items: [{ versionId, reviewId: review.id, contentHash: review.contentHash }] };
    const batches = await Promise.all([a.agent.post(`${W}/course-specification-approval-batches`).send(input), a.agent.post(`${W}/course-specification-approval-batches`).send(input)]);
    expect(batches.map((r) => r.status)).toEqual([201, 201]); expect(batches[0]?.body.data.id).toBe(batches[1]?.body.data.id);
    const approvalBatch = first(batches).body.data;
    await a.agent.post(`${W}/course-specification-approval-batches/${approvalBatch.id}/submit`).send({});
    expect((await staff.agent.post(`${P()}/course-specification-approvals/${first(approvalBatch.items as Array<{ id: string }>).id}/approve`).send({})).status).toBe(200);
    const publications = await Promise.all([staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({}), staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({})]);
    expect(publications.map((r) => r.status)).toEqual([200, 200]); expect(publications[0]?.body.data.id).toBe(publications[1]?.body.data.id);
    expect((await materialize(src))[0]?.version.id).toBe(versionId);
  });

  it("allocates one AcademicCourse and distinct atomic revision numbers across concurrent sources", async () => {
    const item = candidate(); const left = await source([item]); const right = await source([item]);
    const results = await Promise.all([materialize(left), materialize(right)]);
    expect(new Set(results.map((r) => first(r).version.academicCourseId)).size).toBe(1);
    expect(results.map((r) => first(r).version.revisionNumber).sort()).toEqual([1, 2]);
  });

  it("returns human-resolution conflicts instead of merging identities or guessing ownership", async () => {
    const original = candidate(); const originalSource = await source([original]); const identity = first(await materialize(originalSource)).version.academicCourseId;
    const changed = candidate({ data: { ...original.data, nameEn: "Different discipline" } }); const conflictSource = await source([changed]);
    const conflict = first(await materialize(conflictSource)); expect(conflict.status).toBe("NEEDS_RESOLUTION");
    expect(conflict.conflicts).toContain("nameEn_IDENTITY_CONFLICT");
    const resolved = await staff.agent.post(`${P()}/specification-sources/${conflictSource.sourceId}/course-versions`).send({ extractionId: conflictSource.extractionId,
      identityResolutions: [{ candidateKey: changed.key, academicCourseId: identity }] });
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(201);
    expect(resolved.body.data[0].version.academicCourseId).toBe(identity);
    expect((await scoped((tx) => tx.academicCourse.findUniqueOrThrow({ where: { id: identity } }))).ownerDepartmentId).toBeNull();
  });

  it("does not fabricate a code, officialVersion, type, program or track", async () => {
    const item = candidate({ specificationType: null, data: { ...candidate().data, courseCode: null } });
    const src = await source([item]); expect(first(await materialize(src))).toMatchObject({ status: "NEEDS_RESOLUTION", conflicts: ["MISSING_COURSE_CODE"] });
    const typedSource = await source([candidate({ specificationType: null })]); const version = first(await materialize(typedSource)).version;
    const review = await complete(version.id); expect(review.readiness.approvalReadiness.ready).toBe(false);
    await scoped(async (tx) => { expect(await tx.courseSpecificationVersion.count({ where: { tenantId: a.tenantId, sourceId: src.sourceId } })).toBe(0);
      expect(await tx.programTrack.count({ where: { tenantId: a.tenantId } })).toBe(0); });
  });

  it("allows an explicit human code resolution without rewriting the original extracted data", async () => {
    const item = candidate({ data: { ...candidate().data, courseCode: null } });
    const src = await source([item]), officialCode = code();
    const input = { extractionId: src.extractionId, identityResolutions: [{ candidateKey: item.key, officialCode }] };
    expect((await a.agent.post(`${W}/specification-sources/${src.sourceId}/course-versions`).send(input)).status).toBe(403);
    const result = await staff.agent.post(`${P()}/specification-sources/${src.sourceId}/course-versions`).send(input);
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    expect(result.body.data[0].version.extractedData.courseCode).toBeNull();
    const versionId = result.body.data[0].version.id;
    const opened = await a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({});
    expect(opened.body.data.draftData.courseCode).toBe(officialCode);
    expect(opened.body.data.extractedData.courseCode).toBeNull();
    await approved(versionId);
    const published = await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({});
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    expect(published.body.data.code).toBe(officialCode);
  });

  it("keeps explicitly reviewed official-version metadata aligned with the catalog and preserves extraction", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id;
    const review = await complete(versionId, a, { version: "2025" });
    const requestBatch = await batch(versionId, review);
    expect((await staff.agent.post(`${P()}/course-specification-approvals/${first(requestBatch.items).id}/approve`).send({})).status).toBe(200);
    const published = await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({});
    expect(published.status).toBe(200);
    const catalog = await a.agent.get(`${W}/course-templates`);
    expect(catalog.body.data.find((t: { id: string }) => t.id === published.body.data.id).officialVersion).toBe("2025");
    const detail = await a.agent.get(`${W}/course-specification-versions/${versionId}`);
    expect(detail.body.data.extractedData.version).toBeNull();
    expect(detail.body.data.currentReview.reviewedData.version).toBe("2025");
  });

  it("validates page provenance at ingestion and draft save instead of accepting nonexistent pages", async () => {
    const invalid = await source([candidate({ sourcePages: [11] })]);
    expect((await a.agent.post(`${W}/specification-sources/${invalid.sourceId}/course-versions`).send({ extractionId: invalid.extractionId })).status).toBe(400);
    expect(await scoped((tx) => tx.courseSpecificationVersion.count({ where: { sourceId: invalid.sourceId } }))).toBe(0);
    const src = await source(), versionId = first(await materialize(src)).version.id;
    const opened = await a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({});
    expect((await a.agent.patch(`${W}/course-specification-versions/${versionId}/reviews/${opened.body.data.id}`).send({ expectedVersion: opened.body.data.version,
      course: { ...opened.body.data.draftData, theoreticalTopics: [{ ...opened.body.data.draftData.theoreticalTopics[0], sourcePages: [20] }] } })).status).toBe(400);
    const detail = await a.agent.get(`${W}/course-specification-versions/${versionId}/reviews/${opened.body.data.id}`);
    expect(detail.body.data.draftData.theoreticalTopics[0].sourcePages).toEqual([2]);
  });

  it("preserves original extraction and completed reviews while new review revisions are editable", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id;
    const done = await complete(versionId);
    expect((await a.agent.patch(`${W}/course-specification-versions/${versionId}/reviews/${done.id}`).send({ expectedVersion: done.version, course: { ...(done.reviewedData as object), description: "illegal mutation" } })).status).toBe(409);
    const revisions = await Promise.all([a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({ revisionOf: done.id }), a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({ revisionOf: done.id })]);
    expect(revisions.map((r) => r.status).sort()).toEqual([201, 409]);
    await scoped(async (tx) => { expect((await tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: done.id } })).reviewedData).toEqual(done.reviewedData);
      expect((await tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: versionId } })).extractedData).toEqual(first(src.normalized.candidates).data); });
  });

  it("rejects stale draft saves and wrong approval content hashes", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id;
    const opened = await a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({});
    const payload = { expectedVersion: opened.body.data.version, course: { ...opened.body.data.draftData, status: "READY" } };
    const saves = await Promise.all([a.agent.patch(`${W}/course-specification-versions/${versionId}/reviews/${opened.body.data.id}`).send(payload), a.agent.patch(`${W}/course-specification-versions/${versionId}/reviews/${opened.body.data.id}`).send(payload)]);
    expect(saves.map((r) => r.status).sort()).toEqual([200, 409]);
    const done = await complete(versionId);
    expect((await a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey: crypto.randomUUID(), items: [{ versionId, reviewId: done.id, contentHash: "a".repeat(64) }] })).status).toBe(409);
  });

  it("keeps rejected/canceled history, permits resubmission, and prevents any pending request after approval", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id; const review = await complete(versionId);
    const rejected = await batch(versionId, review);
    expect((await staff.agent.post(`${P()}/course-specification-approvals/${first(rejected.items).id}/reject`).send({ notes: "Needs confirmation" })).status).toBe(200);
    const canceled = await batch(versionId, review);
    expect((await a.agent.post(`${W}/course-specification-approvals/${first(canceled.items).id}/cancel`).send({})).status).toBe(200);
    const final = await batch(versionId, review);
    const decisions = await Promise.all([staff.agent.post(`${P()}/course-specification-approvals/${first(final.items).id}/approve`).send({}), staff.agent.post(`${P()}/course-specification-approvals/${first(final.items).id}/approve`).send({})]);
    expect(decisions.map((r) => r.status)).toEqual([200, 200]);
    expect((await a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey: crypto.randomUUID(), items: [{ versionId, reviewId: review.id, contentHash: review.contentHash }] })).status).toBe(409);
    expect((await a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({ revisionOf: review.id })).status).toBe(409);
    const next = await Promise.all([a.agent.post(`${W}/course-specification-versions/${versionId}/revisions`).send({ requestKey: "correction-1" }), a.agent.post(`${W}/course-specification-versions/${versionId}/revisions`).send({ requestKey: "correction-1" })]);
    expect(next.map((r) => r.status)).toEqual([201, 201]); expect(next[0]?.body.data.id).toBe(next[1]?.body.data.id);
    expect(first(next).body.data).toMatchObject({ status: "DRAFT", revisionNumber: 2, supersedesId: versionId });
    expect(await scoped((tx) => tx.courseSpecificationApproval.findMany({ where: { tenantId: a.tenantId, versionId }, select: { status: true } }))).toEqual(expect.arrayContaining([{ status: "REJECTED" }, { status: "CANCELED" }, { status: "APPROVED" }]));
  });

  it("allows only one pending request across concurrent distinct request keys", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id, review = await complete(versionId);
    const responses = await Promise.all(["left", "right"].map((suffix) => a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey: `${crypto.randomUUID()}-${suffix}`,
      items: [{ versionId, reviewId: review.id, contentHash: review.contentHash }] })));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await scoped((tx) => tx.courseSpecificationApproval.count({ where: { versionId, status: "PENDING" } }))).toBe(1);
    const opened = await a.agent.post(`${W}/course-specification-versions/${versionId}/reviews`).send({ revisionOf: review.id });
    expect(opened.status).toBe(409);
  });

  it("seals deterministic multi-course manifests and rolls back a batch with any invalid snapshot", async () => {
    const src = await source([candidate({ key: "courses.0" }), candidate({ key: "courses.1" })]);
    const versions = await materialize(src);
    const items = await Promise.all(versions.map(async ({ version }) => { const review = await complete(version.id); return { versionId: version.id, reviewId: review.id, contentHash: review.contentHash }; }));
    const invalid = items.map((item, i) => i === 1 ? { ...item, contentHash: "a".repeat(64) } : item);
    expect((await a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey: crypto.randomUUID(), items: invalid })).status).toBe(409);
    expect(await scoped((tx) => tx.courseSpecificationApproval.count({ where: { versionId: { in: versions.map((v) => v.version.id) } } }))).toBe(0);
    const requestKey = crypto.randomUUID();
    const created = await a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey, items });
    expect(created.status).toBe(201);
    const reused = await a.agent.post(`${W}/course-specification-approval-batches`).send({ requestKey, items: [...items].reverse() });
    expect(reused.status).toBe(201); expect(reused.body.data.id).toBe(created.body.data.id); expect(reused.body.data.manifestHash).toBe(created.body.data.manifestHash);
    const firstItem = created.body.data.items[0], secondItem = created.body.data.items[1];
    expect((await staff.agent.post(`${P()}/course-specification-approvals/${firstItem.id}/approve`).send({})).status).toBe(409);
    expect((await a.agent.post(`${W}/course-specification-approval-batches/${created.body.data.id}/submit`).send({})).status).toBe(200);
    expect((await staff.agent.post(`${P()}/course-specification-approvals/${firstItem.id}/approve`).send({})).status).toBe(200);
    expect((await staff.agent.post(`${P()}/course-specification-approvals/${secondItem.id}/reject`).send({})).status).toBe(200);
    const view = await a.agent.get(`${W}/specification-sources/${src.sourceId}/course-versions`);
    expect(view.body.data.summary).toMatchObject({ approvedVersions: 1, totalVersions: 2, approvalPendingVersions: 0 });
  });

  it("enforces source ownership, tenant isolation and institution permissions beyond RLS", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id;
    for (const denied of [colleague, b, student]) {
      expect((await denied.agent.get(`${W}/specification-sources/${src.sourceId}/course-versions`)).status).toBe(404);
      expect((await denied.agent.get(`${W}/course-specification-versions/${versionId}`)).status).toBe(404);
    }
    expect((await deniedStaff.agent.get(`${P()}/course-specification-versions/${versionId}`)).status).toBe(403);
    expect((await staff.agent.get(`${P()}/course-specification-versions/${versionId}`)).status).toBe(200);
    const requestBatch = await batch(versionId, await complete(versionId));
    expect((await a.agent.post(`${W}/course-specification-approvals/${first(requestBatch.items).id}/approve`).send({})).status).toBe(403);
    expect((await a.agent.post(`${W}/course-specification-versions/${versionId}/publications`).send({})).status).toBe(403);
    const before = await scoped((tx) => tx.courseSpecificationVersion.count({ where: { tenantId: a.tenantId } }));
    await expect(runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () => await materializeNormalizedCourses(a.userId, { ...(await source([candidate()], b)).normalized }))).rejects.toMatchObject({ statusCode: 404 });
    expect(await scoped((tx) => tx.courseSpecificationVersion.count({ where: { tenantId: a.tenantId } }))).toBe(before);
  });

  it.each(["FIELD_TRAINING", "COOPERATIVE_TRAINING", "GRADUATION_PROJECT"] as const)("runs %s through an operational plan without synthetic topics", async (type) => {
    const base = candidate(); const item = candidate({ specificationType: type, data: { ...base.data, theoreticalTopics: [], practicalTopics: [], unclassifiedTopics: [],
      activities: ["Supervised practice"], trainingOutcomes: ["Complete field practice"], stages: [{ title: "Planning" }], duration: { weeks: 12 }, scope: "Industry placement", supervision: "Named supervisor", deliverables: ["Official report"] } });
    const src = await source([item]), versionId = first(await materialize(src)).version.id; await approved(versionId);
    const published = await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({});
    expect(published.status, JSON.stringify(published.body)).toBe(200); expect(published.body.data.topics).toEqual([]);
    expect(published.body.data.operationalPlan.data).toMatchObject({ scope: "Industry placement", deliverables: ["Official report"] });
  });

  it("keeps CHM1101 owned by Chemistry while resolving its Biology/Botany curriculum membership", async () => {
    const ids = await scoped(async (tx) => {
      const chemistry = await tx.department.create({ data: { tenantId: a.tenantId, code: "CHEM", nameAr: "الكيمياء" } });
      const biology = await tx.department.create({ data: { tenantId: a.tenantId, code: "BIO", nameAr: "الأحياء" } });
      const program = await tx.program.create({ data: { tenantId: a.tenantId, departmentId: biology.id, code: "BSCBIO", nameAr: "الأحياء" } });
      const track = await tx.programTrack.create({ data: { tenantId: a.tenantId, programId: program.id, name: "Botany", nameKey: "botany" } });
      const course = await tx.academicCourse.create({ data: { tenantId: a.tenantId, code: "CHM1101", codeKey: normalizeCourseCode("CHM1101"), nameEn: "Chemistry", ownerDepartmentId: chemistry.id } });
      return { chemistry, biology, program, track, course };
    });
    const base = candidate(); const item = candidate({ data: { ...base.data, courseCode: "CHM1101", nameEn: "Chemistry" },
      contexts: { institution: null, college: null, department: null, program: { status: "UNRESOLVED", name: "Biology", entityId: null, sourcePages: [1] }, track: null } });
    const src = await source([item]), versionId = first(await materialize(src)).version.id;
    const linked = await staff.agent.post(`${P()}/course-specification-versions/${versionId}/curriculum-contexts`).send({ programId: ids.program.id, programTrackId: ids.track.id });
    expect(linked.status, JSON.stringify(linked.body)).toBe(201);
    expect((await a.agent.post(`${W}/course-specification-versions/${versionId}/curriculum-contexts`).send({ programId: ids.program.id })).status).toBe(403);
    await approved(versionId); const published = await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({});
    expect(published.status).toBe(200);
    const templates = await a.agent.get(`${W}/course-templates`); const template = templates.body.data.find((t: { id: string }) => t.id === published.body.data.id);
    expect(template).toMatchObject({ ownerDepartment: { id: ids.chemistry.id }, program: null,
      curriculumContexts: [{ program: { id: ids.program.id }, track: { id: ids.track.id } }] });
    expect((await scoped((tx) => tx.academicCourse.findUniqueOrThrow({ where: { id: ids.course.id } }))).ownerDepartmentId).toBe(ids.chemistry.id);
  });

  it("supports a curriculum association without a specification version and rejects a track from a different program", async () => {
    const ids = await scoped(async (tx) => {
      const department = await tx.department.create({ data: { tenantId: a.tenantId, code: code(), nameAr: "قسم تجريبي" } });
      const program = await tx.program.create({ data: { tenantId: a.tenantId, departmentId: department.id, code: code(), nameAr: "برنامج تجريبي" } });
      const otherProgram = await tx.program.create({ data: { tenantId: a.tenantId, departmentId: department.id, code: code(), nameAr: "برنامج آخر" } });
      const track = await tx.programTrack.create({ data: { tenantId: a.tenantId, programId: otherProgram.id, name: "Track", nameKey: "track" } });
      const officialCode = code();
      const academicCourse = await tx.academicCourse.create({ data: { tenantId: a.tenantId, code: officialCode, codeKey: normalizeCourseCode(officialCode), nameEn: "Shared course", ownerDepartmentId: department.id } });
      return { academicCourse, program, track };
    });
    const link = () => runWithTenant({ tenantId: a.tenantId, userId: staff.userId }, () => associateAcademicCourseCurriculum(staff.userId, ids.academicCourse.id, { programId: ids.program.id }));
    const [left, right] = await Promise.all([link(), link()]);
    expect(left.id).toBe(right.id); expect(left.courseSpecificationVersionId).toBeNull(); expect(left.programTrackId).toBeNull();
    await expect(runWithTenant({ tenantId: a.tenantId, userId: staff.userId }, () => associateAcademicCourseCurriculum(staff.userId, ids.academicCourse.id,
      { programId: ids.program.id, programTrackId: ids.track.id }))).rejects.toMatchObject({ statusCode: 404 });
    await expect(runWithTenant({ tenantId: b.tenantId, userId: staff.userId }, () => associateAcademicCourseCurriculum(staff.userId, ids.academicCourse.id,
      { programId: ids.program.id }))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("derives mixed source summaries without approving the whole source or changing legacy pointers", async () => {
    const items = [0, 1, 2].map((n) => candidate({ key: `courses.${n}`, contexts: { institution: null, college: null, department: { status: "UNRESOLVED", name: "Unknown department", entityId: null, sourcePages: [1] }, program: null, track: null } }));
    const src = await source(items), versions = await materialize(src), publishedVersion = first(versions).version.id;
    await approved(publishedVersion); expect((await staff.agent.post(`${P()}/course-specification-versions/${publishedVersion}/publications`).send({})).status).toBe(200);
    const pendingVersion = versions[1]?.version.id; if (!pendingVersion) throw new Error("Missing pending version");
    await batch(pendingVersion, await complete(pendingVersion));
    const response = await a.agent.get(`${W}/specification-sources/${src.sourceId}`);
    expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ approvalStatus: "NOT_REQUESTED", currentReviewId: null, currentApprovalId: null,
      courseWorkflowSummary: { totalVersions: 3, reviewCompletedVersions: 2, approvalPendingVersions: 1, approvedVersions: 1, publishedVersions: 1, unresolvedVersions: 3 } });
  });

  it("rolls back failed publication and requires an explicit safe retry", async () => {
    const src = await source(), versionId = first(await materialize(src)).version.id; await approved(versionId);
    const normalize = projection.persistedCourseTemplateProjection;
    vi.spyOn(projection, "persistedCourseTemplateProjection").mockImplementationOnce((row) => ({ ...normalize(row), code: "BAD" }));
    expect((await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({})).status).toBe(409);
    const state = await a.agent.get(`${W}/course-specification-versions/${versionId}/publication`);
    expect(state.body.data).toMatchObject({ status: "FAILED", template: null });
    expect((await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({})).status).toBe(409);
    const retry = await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({ retry: true });
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect((await staff.agent.post(`${P()}/course-specification-versions/${versionId}/publications`).send({})).body.data.id).toBe(retry.body.data.id);
  });
});

describe("normalization boundary and separated readiness", () => {
  it("adapts a saved current-format extraction with multiple programs and no fabricated type or officialVersion", () => {
    const item = { code: "BIO1101", nameAr: null, nameEn: "Biology", creditHours: 3, hasLab: false, topics: [{ title: "Cells", sourcePages: [1] }] };
    const raw = { programs: [{ name: "Biology", version: "program-2025", courses: [item] }, { name: "Chemistry", courses: [{ ...item, code: "CHM1101" }] }], document: { pageCount: 5, chunkCount: 1, processedPages: [1, 2, 3, 4, 5], emptyPages: [], parser: "test" } };
    const normalized = normalizeSavedCourseExtraction(id(), id(), raw);
    expect(normalized.candidates).toHaveLength(2); expect(normalized.candidates.map((c) => c.specificationType)).toEqual([null, null]);
    expect(first(normalized.candidates).officialVersion).toBeNull(); expect(first(normalized.candidates).contexts.program?.status).toBe("UNRESOLVED");
    expect(first(normalized.candidates).provenance.originalCourse).toMatchObject({ code: "BIO1101" });
  });
  it("distinguishes completed review, approval readiness and publication readiness", () => {
    const data = { ...candidate().data, status: "READY", hasLab: null };
    const report = courseWorkflowReadiness(data, "STANDARD_COURSE", data.courseKey);
    expect(report.reviewCompleteness.ready).toBe(true); expect(report.approvalReadiness.ready).toBe(true); expect(report.publicationReadiness.ready).toBe(false);
    expect(courseWorkflowReadiness(data, "OTHER", data.courseKey).approvalReadiness).toMatchObject({ ready: false, missing: ["OTHER_POLICY_REQUIRED"] });
    expect(courseWorkflowReadiness({ ...data, theoreticalTopics: [] }, "STANDARD_COURSE", data.courseKey).approvalReadiness.ready).toBe(false);
  });
  it("never releases a source upload slot after only partial approval or an unrecognized extraction", () => {
    const sourceId = id(), extractionId = id();
    const candidates = [candidate({ key: "courses.0" }), candidate({ key: "courses.1" })];
    const extractedData = normalizedCourseExtractionSchema.parse({ schemaVersion: "normalized-course-candidates-1", sourceId, extractionId, candidates });
    const versions = candidates.map((c) => ({ sourceCourseKey: c.key, extractionId, revisionNumber: 1, status: "APPROVED", currentApproval: { status: "APPROVED" } }));
    const src = { id: sourceId, currentExtraction: { id: extractionId, status: "SUCCEEDED", extractedData }, courseSpecificationVersions: versions };
    expect(courseSourceNeedsReview({ ...src, courseSpecificationVersions: [first(versions)] })).toBe(true);
    expect(courseSourceNeedsReview(src)).toBe(false);
    expect(courseSourceNeedsReview({ ...src, courseSpecificationVersions: [...versions, { ...first(versions), revisionNumber: 2, status: "IN_REVIEW", currentApproval: null }] })).toBe(true);
    expect(courseSourceNeedsReview({ ...src, currentExtraction: { ...src.currentExtraction, extractedData: { providerSpecificPayload: true } } })).toBe(true);
    expect(() => normalizeSavedCourseExtraction(sourceId, extractionId, { providerSpecificPayload: true })).toThrow();
  });
});
