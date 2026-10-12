import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import type { Prisma, UserRole } from "@prisma/client";
import { createApp } from "../app.js";
import { prisma, prismaBase, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { signAccessToken } from "../lib/jwt.js";
import { uploadSpecificationSource } from "../modules/academic/specificationSources.service.js";
import { specificationCapabilities } from "../modules/academic/specificationSources.policy.js";
import { uploadFile, MAX_UPLOAD_BYTES } from "../modules/files/files.service.js";
import { getUsage } from "../modules/store/entitlements.js";
import { resetExpensiveLimitForTests } from "../middleware/rateLimit.js";
import * as storage from "../adapters/storage.provider.js";

const app = createApp();
const S = "/api/workspaces/me/academic/specification-sources";
const pdf = Buffer.from("%PDF-1.7\nOfficial multi-program specification\n%%EOF");
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function inTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

async function seedActor(tenantId?: string, role: UserRole = "TEACHER", staffScreens: string[] = []) {
  const tenant = tenantId ? { id: tenantId } : await prismaBase.tenant.create({ data: { name: "Source university", slug: crypto.randomUUID() } });
  const user = await prismaBase.user.create({
    data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@source.test`, passwordHash: "unused", fullName: "Source actor", role, staffScreens },
  });
  const workspace = await inTenant(tenant.id, async (tx) => {
    const ws = await tx.workspace.create({ data: { tenantId: tenant.id, ownerId: user.id, name: "Teacher workspace" } });
    await tx.workspaceMember.create({ data: { tenantId: tenant.id, userId: user.id, workspaceId: ws.id, role: "OWNER" } });
    await tx.subscription.create({ data: { tenantId: tenant.id, workspaceId: ws.id, planCode: "MIHWAR", status: "TRIALING", trialEndsAt: new Date(Date.now() + 86400000) } });
    return ws;
  });
  const token = signAccessToken({ userId: user.id, tenantId: tenant.id, role, tv: user.tokenVersion, jti: crypto.randomUUID() });
  const agent = request.agent(app).set("Authorization", `Bearer ${token}`);
  return { tenantId: tenant.id, userId: user.id, workspace, agent };
}

type Actor = Awaited<ReturnType<typeof seedActor>>;
type Source = Awaited<ReturnType<typeof uploadSpecificationSource>>;
let a: Actor;
let colleague: Actor;
let foreign: Actor;
let student: Actor;
let reviewer: Actor;
let deniedReviewer: Actor;
let source: Source;

function directUpload(actor: Actor, fileName = "program.pdf") {
  return runWithTenant({ tenantId: actor.tenantId, userId: actor.userId }, () => uploadSpecificationSource({
    workspaceId: actor.workspace.id, userId: actor.userId, fileName, mimeType: "application/pdf", data: pdf,
  }));
}

function apiUpload(actor: Actor, bytes = pdf, mime = "application/pdf") {
  return actor.agent.post(S).set("Content-Type", mime).set("X-File-Name", encodeURIComponent("program.pdf")).send(bytes);
}

beforeAll(async () => {
  const role = await prismaBase.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  expect(role[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await seedActor(); colleague = await seedActor(a.tenantId); foreign = await seedActor();
  student = await seedActor(a.tenantId, "STUDENT");
  reviewer = await seedActor(undefined, "ADMIN", ["institutions"]);
  deniedReviewer = await seedActor(undefined, "ADMIN", ["users"]);
  const response = await apiUpload(a).set("X-Title", encodeURIComponent("Official specification")).set("X-Source-Url", encodeURIComponent("https://university.example/program.pdf"));
  expect(response.status).toBe(201);
  source = response.body.data;
});

afterAll(async () => { vi.restoreAllMocks(); await prismaBase.$disconnect(); });

describe("specification source uploads and access", () => {
  it("accepts a source before any college, department or program exists, without starting extraction", async () => {
    expect(source).toMatchObject({ tenantId: a.tenantId, uploadedById: a.userId, title: "Official specification",
      sourceUrl: "https://university.example/program.pdf", fileSha256: crypto.createHash("sha256").update(pdf).digest("hex"),
      extractionStatus: "PENDING", reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED",
      currentExtractionId: null, currentReviewId: null, currentApprovalId: null, _count: { programSpecifications: 0 } });
    await inTenant(a.tenantId, async (tx) => {
      expect(await tx.college.count({ where: { tenantId: a.tenantId } })).toBe(0);
      expect(await tx.department.count({ where: { tenantId: a.tenantId } })).toBe(0);
      expect(await tx.program.count({ where: { tenantId: a.tenantId } })).toBe(0);
      expect(await tx.programSpecificationExtraction.count({ where: { tenantId: a.tenantId } })).toBe(0);
      const file = await tx.fileAsset.findUniqueOrThrow({ where: { id: source.file.id } });
      expect(file).toMatchObject({ workspaceId: a.workspace.id, uploadedById: a.userId, purpose: "UNIVERSITY", storage: "DB" });
      const blob = await tx.fileBlob.findFirstOrThrow({ where: { tenantId: a.tenantId, fileId: file.id } });
      expect(Buffer.from(blob.data)).toEqual(pdf);
      expect(await tx.auditLog.count({ where: { tenantId: a.tenantId, entityId: source.id, action: "SPECIFICATION_SOURCE_UPLOAD" } })).toBe(1);
    });
  });

  it("lists only the teacher's sources and exposes their pending status", async () => {
    const out = await a.agent.get(S);
    expect(out.status).toBe(200);
    expect(out.body.data).toMatchObject({ total: 1, page: 1, pageSize: 20, items: [{ id: source.id }] });
    expect(out.body.data.items[0]).not.toHaveProperty("legacyUploadedById");
    expect(out.body.data.items[0].file).not.toHaveProperty("objectKey");
    expect((await colleague.agent.get(S)).body.data.items).toEqual([]);
    expect((await a.agent.get(`${S}/${source.id}`)).body.data.id).toBe(source.id);
  });

  it("reads the exact source file through its endpoint and the compatible files endpoint", async () => {
    for (const path of [`${S}/${source.id}/file`, `/api/files/${source.file.id}`]) {
      const out = await a.agent.get(path);
      expect(out.status).toBe(200);
      expect(out.body).toEqual(pdf);
      expect(out.headers["content-type"]).toContain("application/pdf");
    }
    expect((await a.agent.get(`${S}/${source.id}/file`)).headers["cache-control"]).toBe("private, no-store");
  });

  it.each(["colleague", "foreign", "student"])("prevents %s from reading another teacher's source, including the generic file URL", async (kind) => {
    const actor = { colleague, foreign, student }[kind as "colleague" | "foreign" | "student"];
    for (const path of [`${S}/${source.id}`, `${S}/${source.id}/file`, `/api/files/${source.file.id}`]) {
      expect((await actor.agent.get(path)).status).toBe(404);
    }
  });

  it("requires authentication and workspace membership", async () => {
    expect((await request(app).get(S)).status).toBe(401);
    expect((await foreign.agent.get(`/api/workspaces/${a.workspace.id}/academic/specification-sources`)).status).toBe(404);
    expect((await apiUpload(student)).status).toBe(403);
  });

  it("rejects client supplied ownership and invalid metadata without creating files", async () => {
    const count = await inTenant(a.tenantId, (tx) => tx.fileAsset.count({ where: { tenantId: a.tenantId } }));
    for (const query of [{ tenantId: foreign.tenantId }, { uploadedById: colleague.userId }, { programId: "cspoofedprogram" }]) {
      expect((await apiUpload(a).query(query)).status).toBe(400);
    }
    expect((await apiUpload(a).set("X-Source-Url", "javascript%3Aalert(1)")).status).toBe(400);
    expect((await apiUpload(a).set("X-File-Name", "%XX")).status).toBe(400);
    expect(await inTenant(a.tenantId, (tx) => tx.fileAsset.count({ where: { tenantId: a.tenantId } }))).toBe(count);
  });

  it("accepts DOCX and rejects unsupported, empty, mismatched and oversized files", async () => {
    await resetExpensiveLimitForTests(a.userId);
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("word/document.xml")]);
    expect((await apiUpload(a, docx, DOCX)).status).toBe(201);
    expect((await apiUpload(a, pdf, "text/plain")).status).toBe(400);
    expect((await apiUpload(a, Buffer.alloc(0))).status).toBe(400);
    expect((await apiUpload(a, Buffer.from("not a PDF"))).status).toBe(400);
    expect((await apiUpload(a, Buffer.alloc(MAX_UPLOAD_BYTES + 1))).status).toBe(413);
  });

  it("retains university contribution behavior after subscription expiry and excludes source bytes from storage quota", async () => {
    const expired = await seedActor();
    await inTenant(expired.tenantId, (tx) => tx.subscription.updateMany({
      where: { tenantId: expired.tenantId, workspaceId: expired.workspace.id }, data: { status: "CANCELED", trialEndsAt: new Date(0) },
    }));
    expect((await apiUpload(expired)).status).toBe(201);
    const usage = await runWithTenant({ tenantId: expired.tenantId, userId: expired.userId }, () => getUsage(expired.workspace.id));
    expect(usage.storageBytes).toBe(0);
  });

  it("allows institution reviewers from ADMIN, with immediate permission revocation", async () => {
    const path = `/api/owner/institutions/${a.tenantId}/specification-sources`;
    expect((await reviewer.agent.get(path)).status).toBe(200);
    expect((await reviewer.agent.get(`${path}/${source.id}`)).body.data.id).toBe(source.id);
    expect((await reviewer.agent.get(`${path}/${source.id}/file`)).body).toEqual(pdf);
    expect((await deniedReviewer.agent.get(path)).status).toBe(403);
    expect(await specificationCapabilities(reviewer.userId)).toMatchObject({ reviewSources: true, approveSources: true });
    await prismaBase.user.update({ where: { id: reviewer.userId }, data: { staffScreens: [] } });
    try {
      expect((await reviewer.agent.get(path)).status).toBe(403);
      expect((await reviewer.agent.get(`/api/files/${source.file.id}`)).status).toBe(404);
      expect(await specificationCapabilities(reviewer.userId)).toMatchObject({ reviewSources: false, approveSources: false });
    } finally {
      await prismaBase.user.update({ where: { id: reviewer.userId }, data: { staffScreens: ["institutions"] } });
    }
  });

  it("preserves ordinary file access for students in the same tenant", async () => {
    const file = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, () => uploadFile({
      workspaceId: a.workspace.id, userId: a.userId, purpose: "MATERIAL", fileName: "ordinary.pdf", mimeType: "application/pdf", data: pdf,
    }));
    expect((await student.agent.get(`/api/files/${file.id}`)).status).toBe(200);
  });

  it("retains source identity and bytes and rejects deletion through the existing files API", async () => {
    expect((await a.agent.delete(`/api/files/me/${source.file.id}`)).status).toBe(409);
    await expect(inTenant(a.tenantId, (tx) => tx.specificationSource.update({ where: { id: source.id }, data: { fileSha256: "b".repeat(64) } }))).rejects.toThrow(/immutable/);
    await expect(inTenant(a.tenantId, (tx) => tx.fileBlob.update({ where: { fileId: source.file.id }, data: { data: Buffer.from("tampered") } }))).rejects.toThrow(/immutable/);
    await expect(inTenant(a.tenantId, (tx) => tx.fileAsset.update({ where: { id: source.file.id }, data: { deletedAt: new Date() } }))).rejects.toThrow(/immutable/);
  });

  it("rejects a source hash that differs from the stored file bytes", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.specificationSource.create({ data: {
      tenantId: a.tenantId, fileId: source.file.id, uploadedById: a.userId, fileSha256: "0".repeat(64),
    } }))).rejects.toThrow(/hash must match/);
  });

  it("can upload and read sources using the existing R2 storage provider", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const spy = vi.spyOn(storage, "getStorageProvider").mockReturnValue({ mode: "r2", put,
      remove: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(pdf),
      presignGet: vi.fn().mockResolvedValue("https://storage.example/signed-source"), presignPut: vi.fn().mockResolvedValue(null) });
    try {
      const uploaded = await apiUpload(a);
      expect(uploaded.status).toBe(201); expect(put).toHaveBeenCalledOnce();
      const out = await a.agent.get(`${S}/${uploaded.body.data.id}/file`);
      expect(out.status).toBe(302); expect(out.headers.location).toBe("https://storage.example/signed-source");
      await inTenant(a.tenantId, async (tx) => {
        expect(await tx.fileAsset.findUniqueOrThrow({ where: { id: uploaded.body.data.file.id } })).toMatchObject({ storage: "R2", workspaceId: a.workspace.id });
        expect(await tx.fileBlob.count({ where: { tenantId: a.tenantId, fileId: uploaded.body.data.file.id } })).toBe(0);
      });
    } finally { spy.mockRestore(); }
  });

  it("enforces a same-tenant uploader FK and RLS even without application filters", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.specificationSource.create({
      data: { tenantId: a.tenantId, fileId: source.file.id, uploadedById: foreign.userId, legacyImported: true,
        fileSha256: source.fileSha256 },
    }))).rejects.toMatchObject({ code: "P2003" });
    expect(await prismaBase.specificationSource.findMany({ where: { id: source.id } })).toEqual([]);
    expect(await inTenant(foreign.tenantId, (tx) => tx.specificationSource.findMany({ where: { id: source.id } }))).toEqual([]);
    await expect(prisma.specificationSource.findMany()).rejects.toThrow(/runWithTenant/);
    const rows = await runWithTenant({ tenantId: foreign.tenantId, userId: foreign.userId }, async () =>
      prisma.specificationSource.findMany({ where: { tenantId: a.tenantId, id: source.id } }));
    expect(rows).toEqual([]);
    const flags = await prismaBase.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'specification_sources'`;
    expect(flags[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });

  it("rolls back file, blob and source admissions atomically when the pending limit is reached concurrently", async () => {
    const actor = await seedActor();
    for (let i = 0; i < 19; i++) await directUpload(actor, `${i}.pdf`);
    const outcomes = await Promise.allSettled([directUpload(actor, "last.pdf"), directUpload(actor, "overflow.pdf")]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    await inTenant(actor.tenantId, async (tx) => {
      expect(await tx.specificationSource.count({ where: { tenantId: actor.tenantId } })).toBe(20);
      expect(await tx.fileAsset.count({ where: { tenantId: actor.tenantId } })).toBe(20);
      expect(await tx.fileBlob.count({ where: { tenantId: actor.tenantId } })).toBe(20);
    });
  });

  it("cleans up a newly uploaded R2 object on transaction failure", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const spy = vi.spyOn(storage, "getStorageProvider").mockReturnValue({ mode: "r2", put, remove,
      get: vi.fn().mockResolvedValue(pdf), presignGet: vi.fn().mockResolvedValue(null), presignPut: vi.fn().mockResolvedValue(null) });
    const before = await inTenant(a.tenantId, (tx) => tx.fileAsset.count({ where: { tenantId: a.tenantId } }));
    try {
      await expect(runWithTenant({ tenantId: a.tenantId, userId: a.userId }, () => uploadFile({
        workspaceId: a.workspace.id, userId: a.userId, purpose: "UNIVERSITY", fileName: "rollback.pdf", mimeType: "application/pdf", data: pdf, skipQuota: true,
      }, async () => { throw new Error("Source creation failed"); }))).rejects.toThrow("Source creation failed");
      expect(put).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledWith(put.mock.calls[0]?.[0]);
      expect(await inTenant(a.tenantId, (tx) => tx.fileAsset.count({ where: { tenantId: a.tenantId } }))).toBe(before);
    } finally { spy.mockRestore(); }
  });

  it("exposes no extraction, review, approval or publication actions in phase four", async () => {
    for (const action of ["extract", "review", "approve", "publish"]) {
      expect((await a.agent.post(`${S}/${source.id}/${action}`).send({})).status).toBe(404);
    }
  });
});

const approvedPrograms = ["BOTANY", "ZOOLOGY", "BOTANY-RESEARCH"].map((key) => ({
  key, college: { code: "SCI" }, department: { code: "BIO" }, program: { code: key === "BOTANY-RESEARCH" ? "BOTANY" : key },
  specification: { title: `${key} specification`, version: "2026" },
  courses: [{ code: `${key} 1101`, nameAr: key, creditHours: 3, spec: { description: key }, assessmentPlan: [], topics: [] }],
}));

async function sourceDecision(tx: TenantTx, actor: Actor, sourceId: string, snapshot: Prisma.InputJsonObject) {
  const tenantId = actor.tenantId;
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const extraction = await tx.programSpecificationExtraction.create({
    data: { tenantId, sourceId, attempt: 1, status: "SUCCEEDED", requestedById: actor.userId,
      promptVersion: "future-test-only", schemaVersion: "1", extractedData: snapshot, finishedAt: new Date() },
  });
  const review = await tx.programSpecificationReview.create({
    data: { tenantId, sourceId, extractionId: extraction.id, revision: 1, draftData: snapshot, reviewedData: snapshot,
      status: "COMPLETED", contentHash, reviewedById: reviewer.userId, reviewedAt: new Date() },
  });
  const approval = await tx.programSpecificationApproval.create({
    data: { tenantId, sourceId, reviewId: review.id, contentHash, requestedById: actor.userId },
  });
  return { extraction, review, approval };
}

describe("one source approval for multiple program specifications", () => {
  it("creates specifications for two programs and a shared-program track from one source-level decision", async () => {
    const result = await inTenant(a.tenantId, async (tx) => {
      const decision = await sourceDecision(tx, a, source.id, { programs: approvedPrograms });
      await tx.programSpecificationApproval.update({ where: { id: decision.approval.id }, data: {
        status: "APPROVED", decidedById: reviewer.userId, decidedAt: new Date(),
      } });
      await tx.specificationSource.update({ where: { id: source.id }, data: {
        extractionStatus: "SUCCEEDED", reviewStatus: "COMPLETED", approvalStatus: "APPROVED",
        currentExtractionId: decision.extraction.id, currentReviewId: decision.review.id, currentApprovalId: decision.approval.id,
      } });
      const college = await tx.college.create({ data: { tenantId: a.tenantId, code: "SCI", nameAr: "Science" } });
      const department = await tx.department.create({ data: { tenantId: a.tenantId, collegeId: college.id, code: "BIO", nameAr: "Biology" } });
      const ids = [];
      for (const entry of approvedPrograms) {
        const program = await tx.program.upsert({
          where: { tenantId_departmentId_code: { tenantId: a.tenantId, departmentId: department.id, code: entry.program.code } },
          create: { tenantId: a.tenantId, departmentId: department.id, code: entry.program.code, nameAr: entry.key }, update: {},
        });
        const spec = await tx.programSpecification.create({ data: {
          tenantId: a.tenantId, sourceId: source.id, sourceProgramKey: entry.key, programId: program.id,
          sourceFileId: source.file.id, sourceFileSha256: source.fileSha256, ...entry.specification,
          extractionStatus: "SUCCEEDED", reviewStatus: "COMPLETED", approvalStatus: "APPROVED",
          currentExtractionId: decision.extraction.id, currentReviewId: decision.review.id, currentApprovalId: decision.approval.id,
        } });
        const publication = await tx.programSpecificationPublication.create({ data: {
          tenantId: a.tenantId, programSpecificationId: spec.id, approvalId: decision.approval.id, requestedById: reviewer.userId,
        } });
        for (const course of entry.courses) {
          await tx.courseTemplate.create({ data: { tenantId: a.tenantId, programSpecificationId: spec.id, publicationId: publication.id,
            code: course.code, nameAr: course.nameAr, creditHours: course.creditHours, spec: course.spec, assessmentPlan: course.assessmentPlan } });
        }
        await tx.programSpecificationPublication.update({ where: { id: publication.id }, data: {
          status: "PUBLISHED", publishedById: reviewer.userId, publishedAt: new Date(),
        } });
        ids.push(spec.id);
      }
      return { ids, decision, department };
    });
    const status = await a.agent.get(`${S}/${source.id}`);
    expect(status.body.data._count.programSpecifications).toBe(3);
    const catalog = await colleague.agent.get("/api/workspaces/me/academic/course-templates");
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.map((row: { code: string }) => row.code).sort()).toEqual(["BOTANY 1101", "BOTANY-RESEARCH 1101", "ZOOLOGY 1101"]);
    const foreignCatalog = await foreign.agent.get("/api/workspaces/me/academic/course-templates");
    expect(foreignCatalog.body.data).toEqual([]);
    const specs = await inTenant(a.tenantId, (tx) => tx.programSpecification.findMany({ where: { tenantId: a.tenantId, sourceId: source.id } }));
    expect(specs.map((spec) => spec.currentApprovalId)).toEqual(Array(3).fill(result.decision.approval.id));
    expect(new Set(specs.map((spec) => spec.programId)).size).toBe(2);
    expect(result.decision.approval.programSpecificationId).toBeNull();
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecification.update({ where: { id: result.ids[0] }, data: { title: "changed" } }))).rejects.toThrow(/immutable/);
    const wrongProgram = await inTenant(a.tenantId, (tx) => tx.program.create({ data: { tenantId: a.tenantId, departmentId: result.department.id, code: "OTHER", nameAr: "Other" } }));
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecification.create({ data: {
      tenantId: a.tenantId, sourceId: source.id, sourceProgramKey: "UNKNOWN", programId: wrongProgram.id,
      title: "UNKNOWN", version: "2026", sourceFileId: source.file.id, sourceFileSha256: source.fileSha256,
      extractionStatus: "SUCCEEDED", reviewStatus: "COMPLETED", approvalStatus: "APPROVED",
      currentExtractionId: result.decision.extraction.id, currentReviewId: result.decision.review.id, currentApprovalId: result.decision.approval.id,
    } }))).rejects.toThrow(/match an approved program/);
    // A later extraction does not alter the exact approved decision stored by either program.
    await inTenant(a.tenantId, async (tx) => {
      const retry = await tx.programSpecificationExtraction.create({ data: { tenantId: a.tenantId, sourceId: source.id, attempt: 2,
        requestedById: a.userId, promptVersion: "test-only", schemaVersion: "1" } });
      await tx.specificationSource.update({ where: { id: source.id }, data: { extractionStatus: "PENDING", reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED",
        currentExtractionId: retry.id, currentReviewId: null, currentApprovalId: null } });
    });
    expect((await colleague.agent.get("/api/workspaces/me/academic/course-templates")).body.data).toHaveLength(3);
  });

  it.each([
    { label: "empty", programs: [] },
    { label: "duplicate keys", programs: [approvedPrograms[0], approvedPrograms[0]] },
  ])("rejects an approval with $label programs", async ({ programs }) => {
    const pending = await directUpload(a);
    const decision = await inTenant(a.tenantId, (tx) => sourceDecision(tx, a, pending.id, { programs } as Prisma.InputJsonObject));
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecificationApproval.update({ where: { id: decision.approval.id },
      data: { status: "APPROVED", decidedById: reviewer.userId, decidedAt: new Date() } }))).rejects.toThrow(/Every approved program/);
  });

  it("rejects linking a decision from a different source in the same tenant", async () => {
    const other = await directUpload(a);
    const unrelated = await directUpload(a);
    const decision = await inTenant(a.tenantId, (tx) => sourceDecision(tx, a, other.id, { programs: approvedPrograms }));
    await expect(inTenant(a.tenantId, (tx) => tx.specificationSource.update({ where: { id: unrelated.id },
      data: { currentReviewId: decision.review.id } }))).rejects.toMatchObject({ code: "P2003" });
  });

  it("keeps legacy program/version uniqueness when the caller omits the source and track key", async () => {
    const program = await inTenant(a.tenantId, (tx) => tx.program.findFirstOrThrow({ where: { tenantId: a.tenantId, code: "BOTANY" } }));
    const data = { tenantId: a.tenantId, programId: program.id, version: "legacy-compatible", title: "Legacy program",
      sourceFileId: source.file.id, sourceFileSha256: source.fileSha256 };
    const legacy = await inTenant(a.tenantId, (tx) => tx.programSpecification.create({ data }));
    expect(legacy.sourceId).toEqual(expect.any(String));
    expect(legacy.sourceProgramKey).toBeNull();
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecification.create({ data }))).rejects.toMatchObject({ code: "P2002" });
  });
});
