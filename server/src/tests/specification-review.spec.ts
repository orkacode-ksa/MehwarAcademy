import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import type { UserRole } from "@prisma/client";
import { courseReviewReadiness, specificationReviewDataSchema, type ReviewedCourseSpecification } from "@mihwar/shared";
import { createApp } from "../app.js";
import { prismaBase, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { signAccessToken } from "../lib/jwt.js";
import { uploadSpecificationSource } from "../modules/academic/specificationSources.service.js";
import { initialReviewData, extractedCourseSpecifications } from "../modules/academic/specificationReview.data.js";
import { extractedSpecificationSchema, SPECIFICATION_PROMPT_VERSION, SPECIFICATION_SCHEMA_VERSION } from "../modules/academic/specificationExtraction.schema.js";

const app = createApp();
const API = "/api/workspaces/me/academic/specification-sources";
const sample = JSON.parse(await readFile(new URL("../dev/fixtures/botany-review.fixture.json", import.meta.url), "utf8")) as { extractedData: unknown };
const fixture = extractedSpecificationSchema.parse(sample.extractedData);
const bytes = Buffer.from("%PDF-1.7\nAutomated review test fixture\n%%EOF");
const required = <T>(value: T | null | undefined): T => { if (value === null || value === undefined) throw new Error("Missing fixture"); return value; };
function inTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>) {
  return prismaBase.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`; return fn(tx); });
}
async function actor(tenantId?: string, role: UserRole = "TEACHER") {
  const tenant = tenantId ? { id: tenantId } : await prismaBase.tenant.create({ data: { name: "Review test university", slug: crypto.randomUUID() } });
  const user = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@review.test`, fullName: "Reviewer", passwordHash: "unused", role } });
  const workspace = await inTenant(tenant.id, async (tx) => {
    const ws = await tx.workspace.create({ data: { tenantId: tenant.id, ownerId: user.id, name: "Review test workspace" } });
    await tx.workspaceMember.create({ data: { tenantId: tenant.id, workspaceId: ws.id, userId: user.id, role: "OWNER" } }); return ws;
  });
  const token = signAccessToken({ tenantId: tenant.id, userId: user.id, role, tv: user.tokenVersion, jti: crypto.randomUUID() });
  return { tenantId: tenant.id, userId: user.id, workspaceId: workspace.id, agent: request.agent(app).set("Authorization", `Bearer ${token}`) };
}
type Actor = Awaited<ReturnType<typeof actor>>;
let teacher: Actor, colleague: Actor, foreign: Actor, student: Actor;
async function source(data = fixture, status: "SUCCEEDED" | "FAILED" = "SUCCEEDED") {
  const uploaded = await runWithTenant({ tenantId: teacher.tenantId, userId: teacher.userId }, () => uploadSpecificationSource({
    userId: teacher.userId, workspaceId: teacher.workspaceId, data: bytes, fileName: "review-test.pdf", mimeType: "application/pdf",
  }));
  const extraction = await inTenant(teacher.tenantId, async (tx) => {
    const attempt = await tx.programSpecificationExtraction.create({ data: { tenantId: teacher.tenantId, sourceId: uploaded.id,
      requestedById: teacher.userId, attempt: 1, status, promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION,
      extractedData: status === "SUCCEEDED" ? data : undefined, finishedAt: new Date(), model: "automated-pdf-fixture",
    } });
    await tx.specificationSource.update({ where: { id: uploaded.id }, data: { currentExtractionId: attempt.id, extractionStatus: status } }); return attempt;
  });
  return { ...uploaded, extractionId: extraction.id };
}
async function start(sourceId: string) {
  const out = await teacher.agent.post(`${API}/${sourceId}/reviews`).send({}); expect(out.status).toBe(201); return out.body.data;
}
async function patch(sourceId: string, review: { id: string; version: string }, course: ReviewedCourseSpecification) {
  return teacher.agent.patch(`${API}/${sourceId}/reviews/${review.id}`).send({ expectedVersion: review.version, course });
}
beforeAll(async () => { teacher = await actor(); colleague = await actor(teacher.tenantId); foreign = await actor(); student = await actor(teacher.tenantId, "STUDENT"); });
afterAll(async () => { await prismaBase.$disconnect(); });

describe("course review data and completeness", () => {
  it("maps every course separately from the real PDF fixture and preserves source information", () => {
    const original = extractedCourseSpecifications(fixture);
    expect(original).toHaveLength(3); expect(original.map((c) => c.courseCode)).toEqual(["BIO1103", "CHM1101", "BIO 1101"]);
    expect(original.every((c) => c.sourcePages.length > 0 && c.unclassifiedTopics.length > 0)).toBe(true);
    expect(original[0]?.theoreticalTopics).toEqual([]); expect(original[0]?.practicalTopics).toEqual([]);
    const draft = initialReviewData("cmv5s70ek0002ko1qmop6ds5x", fixture);
    expect(specificationReviewDataSchema.safeParse(draft).success).toBe(true);
  });
  it("keeps a missing program/track missing instead of using the file title", () => {
    const data = structuredClone(fixture); data.unassignedCourses = [required(data.programs[0]?.courses[0])]; data.programs = [];
    const course = required(initialReviewData("cmv5s70ek0002ko1qmop6ds5x", data).reviewedCourseSpecifications[0]);
    expect(course.program).toBeNull(); expect(course.track).toBeNull();
    expect(courseReviewReadiness(course).recommended).toContain("البرنامج");
  });
  it("keeps each explicit program/track/department context separate and does not copy unrelated document metadata", () => {
    const data = structuredClone(fixture); const first = required(data.programs[0]);
    first.department = { name: "First department", code: null, sourcePages: [1], fieldEvidence: {} }; first.track = "First track";
    const second = structuredClone(first); second.name = "Second program"; second.track = "Second track";
    second.department = { name: "Second department", code: null, sourcePages: [10], fieldEvidence: {} };
    second.courses = [required(second.courses[0])]; data.programs = [first, second];
    const courses = extractedCourseSpecifications(data);
    expect(courses[0]?.department).toBe("First department"); expect(courses.at(-1)?.department).toBe("Second department");
    expect(courses.at(-1)?.track).toBe("Second track");
    data.unassignedCourses = [{ ...required(first.courses[0]), sourcePages: [365] }];
    data.department = { name: "Unrelated department", code: null, sourcePages: [1], fieldEvidence: {} };
    expect(extractedCourseSpecifications(data).at(-1)?.department).toBeNull();
  });
  it("treats printed department/revision placeholders as incomplete while retaining the extracted original", () => {
    const data = structuredClone(fixture); const program = required(data.programs[0]);
    program.department = { name: "Enter Department Name", code: null, sourcePages: [1], fieldEvidence: {} };
    program.version = "Pick Revision Date";
    const draft = initialReviewData("cmv5s70ek0002ko1qmop6ds5x", data);
    expect(draft.reviewedCourseSpecifications[0]?.department).toBeNull();
    expect(draft.reviewedCourseSpecifications[0]?.programVersion).toBeNull();
    expect(extractedCourseSpecifications(data)[0]?.department).toBe("Enter Department Name");
    expect(program.department.name).toBe("Enter Department Name");
  });
  it("requires only usable template essentials; optional details and missing program do not block READY", () => {
    const course = required(initialReviewData("cmv5s70ek0002ko1qmop6ds5x", fixture).reviewedCourseSpecifications[0]);
    course.creditHours = 3; course.program = null; course.track = null; course.facilities = null;
    expect(courseReviewReadiness(course).ready).toBe(true);
    course.courseCode = "Enter Course Code"; course.unclassifiedTopics = [];
    expect(courseReviewReadiness(course).required).toContain("رمز المقرر");
    expect(courseReviewReadiness(course).required).toContain("فهرس المقرر وعناوين المواضيع");
  });
});

describe("source review API and immutable snapshots", () => {
  it("starts once under concurrent requests, returning all courses without creating academic catalog records", async () => {
    const uploaded = await source();
    const requests = await Promise.all([1, 2].map(() => teacher.agent.post(`${API}/${uploaded.id}/reviews`).send({})));
    expect(requests.every((r) => r.status === 201)).toBe(true); expect(requests[0]?.body.data.id).toBe(requests[1]?.body.data.id);
    const review = requests[0]?.body.data;
    expect(review.draftData.reviewedCourseSpecifications).toHaveLength(3);
    expect(review.extractedData).toEqual(fixture); expect(review.reviewedData).toBeNull();
    await inTenant(teacher.tenantId, async (tx) => {
      expect(await tx.programSpecificationReview.count({ where: { sourceId: uploaded.id } })).toBe(1);
      for (const count of [await tx.college.count(), await tx.department.count(), await tx.program.count(), await tx.courseTemplate.count(), await tx.course.count()]) expect(count).toBe(0);
    });
    expect((await teacher.agent.get(`${API}/${uploaded.id}`)).body.data).toMatchObject({ reviewStatus: "IN_REVIEW", approvalStatus: "NOT_REQUESTED", currentReviewId: review.id });
  });
  it("saves corrections and fills missing values per course; draft survives reopening and original extraction stays unchanged", async () => {
    const data = structuredClone(fixture); required(data.programs[0]).courses[0] = { ...required(data.programs[0]?.courses[0]), creditHours: null };
    const uploaded = await source(data); const review = await start(uploaded.id);
    const course = required(specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications[0]);
    const saved = await patch(uploaded.id, review, { ...course, courseTitle: "Human corrected title", creditHours: 3, status: "IN_REVIEW" });
    expect(saved.status).toBe(200);
    const reopened = await teacher.agent.get(`${API}/${uploaded.id}/reviews/${review.id}`);
    expect(reopened.body.data.draftData.reviewedCourseSpecifications[0]).toMatchObject({ courseTitle: "Human corrected title", creditHours: 3 });
    expect(reopened.body.data.extractedData).toEqual(data);
    expect(reopened.body.data.draftData.reviewedCourseSpecifications[1]).toEqual(review.draftData.reviewedCourseSpecifications[1]);
    expect(reopened.body.data.extractionMetadata.warnings).toEqual(data.warnings);
    expect(reopened.body.data.extractionMetadata.uncertainty).toEqual(data.issues);
  });
  it("edits, adds, deletes, classifies and reorders topics without losing original sourcePages", async () => {
    const uploaded = await source(); const review = await start(uploaded.id);
    const course = required(specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications[0]);
    const [first, second, ...rest] = course.unclassifiedTopics;
    const moved = { ...required(second), title: "Corrected topic title", details: ["Human detail"] };
    course.practicalTopics = [{ ...moved, orderIndex: 0 }];
    course.theoreticalTopics = [{ ...required(first), orderIndex: 0 }, { id: "human:added-topic", title: "Missing topic added by teacher", details: [], orderIndex: 1, contactHours: null, learningOutcomes: [], sourcePages: [] }];
    course.unclassifiedTopics = rest.slice(1).reverse().map((item, orderIndex) => ({ ...item, orderIndex })); course.status = "IN_REVIEW";
    const out = await patch(uploaded.id, review, course); expect(out.status).toBe(200);
    const saved = out.body.data.draftData.reviewedCourseSpecifications[0];
    expect(saved.practicalTopics[0]).toMatchObject({ id: moved.id, sourcePages: moved.sourcePages, details: ["Human detail"] });
    expect(saved.theoreticalTopics[1].sourcePages).toEqual([]);
    expect(saved.unclassifiedTopics.map((item: { id: string }) => item.id)).toEqual(rest.slice(1).reverse().map((item) => item.id));
    expect(out.body.data.extractedData).toEqual(fixture);
  });
  it("rejects fabricated/mutated provenance and nonexistent course keys", async () => {
    const uploaded = await source(); const review = await start(uploaded.id);
    const course = required(specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications[0]);
    expect((await patch(uploaded.id, review, { ...course, sourcePages: [365] })).status).toBe(400);
    const topic = required(course.unclassifiedTopics[0]);
    expect((await patch(uploaded.id, review, { ...course, unclassifiedTopics: [{ ...topic, sourcePages: [365] }, ...course.unclassifiedTopics.slice(1)] })).status).toBe(400);
    expect((await patch(uploaded.id, review, { ...course, courseKey: "different.course" })).status).toBe(400);
  });
  it("keeps incomplete courses as drafts, but cannot mark them READY or complete the source", async () => {
    const uploaded = await source(); const review = await start(uploaded.id);
    const course = required(specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications[0]); course.courseCode = null; course.status = "IN_REVIEW";
    const draft = await patch(uploaded.id, review, course); expect(draft.status).toBe(200);
    expect((await patch(uploaded.id, draft.body.data, { ...course, status: "READY" })).status).toBe(400);
    expect((await teacher.agent.post(`${API}/${uploaded.id}/reviews/${review.id}/complete`).send({ expectedVersion: draft.body.data.version })).status).toBe(400);
  });
  it("completes READY courses atomically and freezes the review without approving/publishing or changing extraction", async () => {
    const uploaded = await source(); let review = await start(uploaded.id);
    for (const original of specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications) {
      const out = await patch(uploaded.id, review, { ...original, creditHours: original.creditHours ?? 3, program: null, status: "READY" });
      expect(out.status).toBe(200); review = out.body.data;
    }
    const complete = await teacher.agent.post(`${API}/${uploaded.id}/reviews/${review.id}/complete`).send({ expectedVersion: review.version });
    expect(complete.status).toBe(200); expect(complete.body.data.status).toBe("COMPLETED");
    expect(complete.body.data.reviewedData).toEqual(complete.body.data.draftData);
    expect(complete.body.data.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(complete.body.data.extractedData).toEqual(fixture);
    expect((await teacher.agent.get(`${API}/${uploaded.id}`)).body.data).toMatchObject({ reviewStatus: "COMPLETED", approvalStatus: "NOT_REQUESTED", currentApprovalId: null });
    const course = required(specificationReviewDataSchema.parse(complete.body.data.draftData).reviewedCourseSpecifications[0]);
    expect((await patch(uploaded.id, complete.body.data, { ...course, courseTitle: "Cannot overwrite" })).status).toBe(409);
    await expect(inTenant(teacher.tenantId, (tx) => tx.programSpecificationReview.update({ where: { id: review.id }, data: { notes: "Cannot bypass immutable snapshot" } }))).rejects.toThrow();
    await inTenant(teacher.tenantId, async (tx) => {
      expect(await tx.courseTemplate.count()).toBe(0); expect(await tx.program.count()).toBe(0); expect(await tx.programSpecificationApproval.count()).toBe(0);
    });
    const next = await teacher.agent.post(`${API}/${uploaded.id}/reviews`).send({ revisionOf: review.id });
    expect(next.status).toBe(201); expect(next.body.data).toMatchObject({ revision: 2, status: "IN_REVIEW" }); expect(next.body.data.id).not.toBe(review.id);
    expect(next.body.data.draftData).toEqual(complete.body.data.reviewedData);
    expect((await teacher.agent.get(`${API}/${uploaded.id}/reviews/${review.id}`)).body.data).toEqual(complete.body.data);
  });
  it("prevents lost updates with a version token, even for concurrent per-course saves", async () => {
    const uploaded = await source(); const review = await start(uploaded.id);
    const courses = specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications;
    const saves = await Promise.all(courses.slice(0, 2).map((course) => patch(uploaded.id, review, { ...course, status: "IN_REVIEW" })));
    expect(saves.map((out) => out.status).sort()).toEqual([200, 409]);
  });
  it("isolates tenant/teacher/student access across start, read, save and complete", async () => {
    const uploaded = await source(); const review = await start(uploaded.id);
    const course = required(specificationReviewDataSchema.parse(review.draftData).reviewedCourseSpecifications[0]);
    for (const user of [colleague, foreign, student]) {
      expect((await user.agent.post(`${API}/${uploaded.id}/reviews`).send({})).status).toBe(user === student ? 403 : 404);
      expect((await user.agent.get(`${API}/${uploaded.id}/reviews/${review.id}`)).status).toBe(404);
      expect((await user.agent.patch(`${API}/${uploaded.id}/reviews/${review.id}`).send({ expectedVersion: review.version, course })).status).toBe(user === student ? 403 : 404);
      expect((await user.agent.post(`${API}/${uploaded.id}/reviews/${review.id}/complete`).send({ expectedVersion: review.version })).status).toBe(user === student ? 403 : 404);
    }
    await inTenant(foreign.tenantId, async (tx) => { expect(await tx.programSpecificationReview.findFirst({ where: { id: review.id } })).toBeNull(); });
  });
  it("cannot review a failed/partial extraction and does not silently use the development fixture", async () => {
    const uploaded = await source(fixture, "FAILED");
    expect((await teacher.agent.post(`${API}/${uploaded.id}/reviews`).send({})).status).toBe(409);
    expect((await teacher.agent.get(`${API}/${uploaded.id}/reviews/preview`)).status).toBe(404);
    await inTenant(teacher.tenantId, async (tx) => { expect(await tx.programSpecificationReview.count({ where: { sourceId: uploaded.id } })).toBe(0); });
  });
  it("rejects arbitrary ownership/extraction fields in review payloads", async () => {
    const uploaded = await source();
    expect((await teacher.agent.post(`${API}/${uploaded.id}/reviews`).send({ tenantId: foreign.tenantId })).status).toBe(400);
  });
});
