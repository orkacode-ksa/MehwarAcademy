import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, prismaBase, withExplicitTenantTx, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";

const snapshot = { code: "BIO1101", topics: [{ title: "Cells", sourcePages: [1] }], creditHours: null };
const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Course approval schema test" } });
  const user = await prismaBase.user.create({ data: {
    tenantId: tenant.id, email: `${crypto.randomUUID()}@approval-schema.test`, passwordHash: "unused", fullName: "Teacher", role: "TEACHER",
  } });
  const actor = await prismaBase.user.create({ data: {
    tenantId: tenant.id, email: `${crypto.randomUUID()}@approval-schema.test`, passwordHash: "unused", fullName: "Platform approver",
    role: "ADMIN", staffScreens: ["institutions"],
  } });
  return withExplicitTenantTx(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: user.id, name: "Schema workspace" } });
    const course = await tx.academicCourse.create({ data: { tenantId, code: "BIO1101", codeKey: "BIO 1101" } });
    const bytes = Buffer.from("%PDF-1.7\nCourse approval fixture\n%%EOF");
    const file = await tx.fileAsset.create({ data: {
      tenantId, workspaceId: workspace.id, uploadedById: user.id, objectKey: crypto.randomUUID(), originalName: "official.pdf",
      mimeType: "application/pdf", sizeBytes: bytes.length, purpose: "UNIVERSITY", storage: "DB",
    } });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: bytes } });
    const source = await tx.specificationSource.create({ data: {
      tenantId, fileId: file.id, uploadedById: user.id, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    } });
    const extraction = await tx.programSpecificationExtraction.create({ data: {
      tenantId, sourceId: source.id, attempt: 1, requestedById: user.id, status: "SUCCEEDED",
      promptVersion: "approval-schema-fixture", schemaVersion: "approval-schema-fixture", extractedData: { courses: [snapshot] }, finishedAt: new Date(),
    } });
    const version = await tx.courseSpecificationVersion.create({ data: {
      tenantId, academicCourseId: course.id, sourceId: source.id, extractionId: extraction.id,
      sourceCourseKey: "courses.0", revisionNumber: 1, extractedData: snapshot,
    } });
    const review = await tx.courseSpecificationReview.create({ data: {
      tenantId, sourceId: source.id, versionId: version.id, revision: 1, draftData: snapshot, status: "COMPLETED",
      reviewedData: snapshot, contentHash, reviewedById: actor.id, reviewedAt: new Date(), sourcePages: [1],
    } });
    const batch = await tx.courseSpecificationApprovalBatch.create({ data: {
      tenantId, requestKey: "shared-request-key", manifestHash: contentHash, requestedById: user.id,
    } });
    const approval = await tx.courseSpecificationApproval.create({ data: { tenantId, batchId: batch.id, versionId: version.id, reviewId: review.id, contentHash } });
    return { tenantId, userId: user.id, actor, course, source, extraction, version, review, batch, approval };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
type ApprovalInput = Partial<Prisma.CourseSpecificationApprovalUncheckedCreateInput>;
type BatchInput = Partial<Prisma.CourseSpecificationApprovalBatchUncheckedCreateInput>;
let a: Fixture;
let b: Fixture;
let revision = 2;

function inA<T>(fn: (tx: TenantTx) => Promise<T>) { return withExplicitTenantTx(a.tenantId, fn); }

function createBatch(overrides: BatchInput = {}) {
  return inA((tx) => tx.courseSpecificationApprovalBatch.create({ data: {
    tenantId: a.tenantId, requestKey: crypto.randomUUID(), manifestHash: contentHash, requestedById: b.actor.id, ...overrides,
  } }));
}

async function createReview(overrides: Partial<Prisma.CourseSpecificationReviewUncheckedCreateInput> = {}) {
  return inA(async (tx) => {
    const versionId = overrides.versionId ?? (await tx.courseSpecificationVersion.create({ data: {
      tenantId: a.tenantId, academicCourseId: a.course.id, sourceId: a.source.id, extractionId: a.extraction.id,
      sourceCourseKey: "courses.0", revisionNumber: revision++, extractedData: snapshot,
    } })).id;
    return tx.courseSpecificationReview.create({ data: {
      tenantId: a.tenantId, sourceId: a.source.id, versionId, revision: 1, draftData: snapshot, status: "COMPLETED",
      reviewedData: snapshot, contentHash, reviewedById: b.actor.id, reviewedAt: new Date(), ...overrides,
    } });
  });
}

async function createApproval(overrides: ApprovalInput = {}) {
  const review = overrides.reviewId ? null : await createReview(overrides.versionId ? { versionId: overrides.versionId, revision: 2 } : {});
  const batchId = overrides.batchId ?? (await createBatch()).id;
  return inA((tx) => tx.courseSpecificationApproval.create({ data: {
    tenantId: a.tenantId, batchId, versionId: overrides.versionId ?? review?.versionId ?? a.version.id,
    reviewId: overrides.reviewId ?? review?.id ?? a.review.id, contentHash, ...overrides,
  } }));
}

function decision(status: "APPROVED" | "REJECTED" | "CANCELED") {
  return { status, decidedById: b.actor.id, decidedAt: new Date() };
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
  // Final decisions, completed reviews and source files are immutable; retain only in a disposable database.
  await prismaBase.$disconnect();
});

describe("course approval batches, exact snapshots and tenant isolation", () => {
  it("creates a draft batch and a pending decision without automatic approval/currentApproval", () => {
    expect(a.batch).toMatchObject({ tenantId: a.tenantId, requestKey: "shared-request-key", manifestHash: contentHash, submittedAt: null });
    expect(a.approval).toMatchObject({ status: "PENDING", reviewId: a.review.id, contentHash, readinessExceptions: [], decidedById: null, decidedAt: null });
    expect(a.version.currentApprovalId).toBeNull();
    expect(a.version.status).toBe("DRAFT");
  });

  it("rejects duplicate request keys within a tenant but permits them across tenants", async () => {
    expect(a.batch.requestKey).toBe(b.batch.requestKey);
    await expect(createBatch({ requestKey: a.batch.requestKey })).rejects.toMatchObject({ code: "P2002" });
  });

  it.each(["requestKey", "manifestHash"] as const)("rejects empty/whitespace-only %s on insert and draft update", async (field) => {
    const batch = await createBatch();
    const constraint = field === "requestKey" ? /course_approval_batch_request_key/ : /course_approval_batch_manifest_hash/;
    for (const value of ["", "   ", " \t\n "]) {
      await expect(createBatch({ [field]: value })).rejects.toThrow(constraint);
      await expect(inA((tx) => tx.courseSpecificationApprovalBatch.update({ where: { id: batch.id }, data: { [field]: value } }))).rejects.toThrow(constraint);
    }
  });

  it("supports multiple independent course items and all parent/inverse relations", async () => {
    const batch = await createBatch();
    const first = await createApproval({ batchId: batch.id });
    const second = await createApproval({ batchId: batch.id });
    const result = await inA((tx) => tx.courseSpecificationApprovalBatch.findUniqueOrThrow({ where: { id: batch.id },
      include: { tenant: true, requestedBy: true, items: { include: { review: true, version: true } } } }));
    expect(result.items.map((i) => i.id).sort()).toEqual([first.id, second.id].sort());
    expect(result.tenant.id).toBe(a.tenantId);
    expect(result.requestedBy.id).toBe(b.actor.id);
    for (const item of result.items) {
      expect(item.review.versionId).toBe(item.version.id);
      expect(item.review.contentHash).toBe(item.contentHash);
    }
    const filter = { where: { id: first.id }, select: { id: true } };
    const [tenant, version, review, user] = await inA((tx) => Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: a.tenantId }, select: { courseSpecificationApprovals: filter, courseSpecificationApprovalBatches: { where: { id: batch.id }, select: { id: true } } } }),
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: first.versionId }, select: { approvals: filter } }),
      tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: first.reviewId }, select: { approvals: filter } }),
      tx.user.findUniqueOrThrow({ where: { id: b.actor.id }, select: { courseSpecificationApprovalBatchesRequested: { where: { tenantId: a.tenantId, id: batch.id }, select: { id: true } } } }),
    ]));
    for (const rows of [tenant.courseSpecificationApprovals, version.approvals, review.approvals]) expect(rows).toEqual([{ id: first.id }]);
    expect(tenant.courseSpecificationApprovalBatches).toEqual([{ id: batch.id }]);
    expect(user.courseSpecificationApprovalBatchesRequested).toEqual([{ id: batch.id }]);
  });

  it.each(["batchId", "versionId", "reviewId"] as const)("rejects a foreign tenant %s", async (field) => {
    const foreignId = field === "batchId" ? b.batch.id : field === "versionId" ? b.version.id : b.review.id;
    const local = await createReview();
    await expect(createApproval({ versionId: local.versionId, reviewId: local.id, [field]: foreignId })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a local review belonging to another version", async () => {
    const review = await createReview();
    await expect(createApproval({ reviewId: review.id, versionId: a.version.id, ...decision("REJECTED") })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a hash that differs from the completed snapshot", async () => {
    await expect(createApproval({ contentHash: "different" })).rejects.toMatchObject({ code: "P2003" });
  });

  it.each(["", " \t\n "])("rejects blank contentHash %j", async (invalid) => {
    await expect(createApproval({ contentHash: invalid })).rejects.toThrow(/course_approval_content_hash/);
  });

  it.each(["NOT_STARTED", "IN_REVIEW", "CHANGES_REQUESTED"] as const)("rejects an unfinished review in %s even with a matching hash", async (status) => {
    const review = await createReview({ status });
    await expect(createApproval({ reviewId: review.id, versionId: review.versionId })).rejects.toThrow(/requires a completed review/);
  });

  it("rejects the same version twice within a batch even for terminal history", async () => {
    const first = await createApproval(decision("REJECTED"));
    await expect(createApproval({ batchId: first.batchId, versionId: first.versionId, reviewId: first.reviewId, ...decision("CANCELED") })).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows only one pending item across batches", async () => {
    const first = await createApproval();
    await expect(createApproval({ versionId: first.versionId, reviewId: first.reviewId })).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces pending uniqueness under concurrent requests", async () => {
    const review = await createReview();
    const results = await Promise.allSettled([0, 1].map(() => createApproval({ versionId: review.versionId, reviewId: review.id })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected");
    if (!failed || failed.status !== "rejected") throw new Error("Expected one duplicate pending decision");
    expect(failed.reason).toMatchObject({ code: "P2002" });
  });

  it("rejects pending requests and duplicate approvals after final approval", async () => {
    const first = await createApproval(decision("APPROVED"));
    await expect(createApproval({ versionId: first.versionId, reviewId: first.reviewId })).rejects.toThrow(/cannot coexist/);
    await expect(createApproval({ versionId: first.versionId, reviewId: first.reviewId, ...decision("APPROVED") })).rejects.toMatchObject({ code: "P2002" });
    const pending = await createApproval();
    await expect(inA((tx) => tx.courseSpecificationApproval.update({ where: { id: pending.id }, data: {
      versionId: first.versionId, reviewId: first.reviewId,
    } }))).rejects.toThrow(/cannot coexist/);
  });

  it("allows the pending item itself to become approved", async () => {
    const item = await createApproval();
    const approved = await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data: decision("APPROVED") }));
    expect(approved.id).toBe(item.id);
    expect(approved.status).toBe("APPROVED");
    const rows = await inA((tx) => tx.courseSpecificationApproval.findMany({ where: { versionId: item.versionId } }));
    expect(rows.map((r) => r.status)).toEqual(["APPROVED"]);
  });

  it("rejects approving a different record while another pending item exists", async () => {
    const pending = await createApproval();
    await expect(createApproval({ versionId: pending.versionId, reviewId: pending.reviewId, ...decision("APPROVED") })).rejects.toThrow(/cannot coexist/);
    const other = await createApproval();
    await expect(inA((tx) => tx.courseSpecificationApproval.update({ where: { id: other.id }, data: {
      versionId: pending.versionId, reviewId: pending.reviewId, ...decision("APPROVED"),
    } }))).rejects.toThrow(/cannot coexist/);
    expect((await inA((tx) => tx.courseSpecificationApproval.findUniqueOrThrow({ where: { id: pending.id } }))).status).toBe("PENDING");
  });

  it.each(["ReadCommitted", "RepeatableRead", "Serializable"] as const)("prevents concurrent pending/approved inserts under %s", async (isolationLevel) => {
    const review = await createReview();
    const batches = await Promise.all([createBatch(), createBatch()]);
    const ready = latch();
    let arrivals = 0;
    const attempts = batches.map((batch, index) => prismaBase.$transaction(async (tx) => {
      // Explicit tenant context on each connection; establish both snapshots before either write.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${a.tenantId}, true)`;
      await tx.courseSpecificationApproval.count({ where: { tenantId: a.tenantId, versionId: review.versionId } });
      if (++arrivals === 2) ready.resolve();
      await ready.promise;
      return tx.courseSpecificationApproval.create({ data: {
        tenantId: a.tenantId, batchId: batch.id, versionId: review.versionId, reviewId: review.id, contentHash,
        ...(index === 0 ? {} : decision("APPROVED")),
      } });
    }, { isolationLevel }));
    const results = await Promise.allSettled(attempts);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await inA((tx) => tx.courseSpecificationApproval.findMany({ where: { versionId: review.versionId } }));
    expect(rows).toHaveLength(1);
    expect(["PENDING", "APPROVED"]).toContain(rows[0]?.status);
  });

  it("rejects mixed pending/approved rows within one SQL statement atomically", async () => {
    const review = await createReview();
    const [pendingBatch, approvedBatch] = await Promise.all([createBatch(), createBatch()]);
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_approvals (id, "tenantId", "batchId", "versionId", "reviewId", "contentHash", status, "decidedById", "decidedAt")
      VALUES (${crypto.randomUUID()}, ${a.tenantId}, ${pendingBatch.id}, ${review.versionId}, ${review.id}, ${contentHash}, 'PENDING', NULL, NULL),
        (${crypto.randomUUID()}, ${a.tenantId}, ${approvedBatch.id}, ${review.versionId}, ${review.id}, ${contentHash}, 'APPROVED', ${b.actor.id}, NOW())
    `)).rejects.toThrow(/cannot coexist|open_or_approved_version_key/);
    expect(await inA((tx) => tx.courseSpecificationApproval.count({ where: { versionId: review.versionId } }))).toBe(0);
  });

  it("prevents a concurrent new pending item while the existing pending item is approved", async () => {
    const item = await createApproval();
    const batch = await createBatch();
    const ready = latch();
    const release = latch();
    const approving = inA(async (tx) => {
      await tx.courseSpecificationApproval.update({ where: { id: item.id }, data: decision("APPROVED") });
      ready.resolve();
      await release.promise;
    });
    try {
      await Promise.race([ready.promise, approving.then(() => { throw new Error("Approval did not hold its transaction"); })]);
      await expect(inA(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");
        await tx.$executeRaw`
          INSERT INTO course_spec_approvals (id, "tenantId", "batchId", "versionId", "reviewId", "contentHash")
          VALUES (${crypto.randomUUID()}, ${a.tenantId}, ${batch.id}, ${item.versionId}, ${item.reviewId}, ${contentHash})
        `;
      })).rejects.toThrow(/lock timeout/i);
    } finally { release.resolve(); await approving; }
    await expect(createApproval({ batchId: batch.id, versionId: item.versionId, reviewId: item.reviewId })).rejects.toThrow(/cannot coexist/);
    const rows = await inA((tx) => tx.courseSpecificationApproval.findMany({ where: { versionId: item.versionId } }));
    expect(rows.map((r) => [r.id, r.status])).toEqual([[item.id, "APPROVED"]]);
  });

  it("rejects a second approval without reopening the final item", async () => {
    const first = await createApproval(decision("APPROVED"));
    const pending = await createApproval();
    await expect(inA((tx) => tx.courseSpecificationApproval.update({ where: { id: pending.id }, data: {
      versionId: first.versionId, reviewId: first.reviewId, ...decision("APPROVED"),
    } }))).rejects.toMatchObject({ code: "P2002" });
  });

  it.each(["REJECTED", "CANCELED"] as const)("retains %s history and permits retry in a new batch", async (status) => {
    const first = await createApproval();
    await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: first.id }, data: decision(status) }));
    const next = await createApproval({ versionId: first.versionId, reviewId: first.reviewId });
    expect(next.status).toBe("PENDING");
    expect(next.batchId).not.toBe(first.batchId);
    const rows = await inA((tx) => tx.courseSpecificationApproval.findMany({ where: { versionId: first.versionId }, orderBy: { createdAt: "asc" } }));
    expect(rows.map((r) => r.status)).toEqual([status, "PENDING"]);
  });

  it.each(["APPROVED", "REJECTED", "CANCELED"] as const)("requires both decision fields for %s", async (status) => {
    for (const missing of [{ decidedById: null }, { decidedAt: null }, { decidedById: null, decidedAt: null }]) {
      await expect(createApproval({ ...decision(status), ...missing })).rejects.toThrow(/course_approval_decision_fields/);
    }
  });

  it("requires both pending decision fields to be null", async () => {
    for (const fields of [{ decidedById: b.actor.id }, { decidedAt: new Date() }, { decidedById: b.actor.id, decidedAt: new Date() }]) {
      await expect(createApproval(fields)).rejects.toThrow(/course_approval_decision_fields/);
    }
  });

  it("supports platform actors from another tenant and their inverse relation", async () => {
    const item = await createApproval(decision("APPROVED"));
    const result = await inA((tx) => tx.courseSpecificationApproval.findUniqueOrThrow({ where: { id: item.id }, include: { decidedBy: true } }));
    expect(result.decidedBy?.id).toBe(b.actor.id);
    expect(result.decidedBy?.tenantId).toBe(b.tenantId);
    const user = await inA((tx) => tx.user.findUniqueOrThrow({ where: { id: b.actor.id }, select: {
      courseSpecificationApprovalsDecided: { where: { id: item.id, tenantId: a.tenantId }, select: { id: true } },
    } }));
    expect(user.courseSpecificationApprovalsDecided).toEqual([{ id: item.id }]);
  });

  it("preserves source, extraction, reviewed snapshot and version data when recording a decision", async () => {
    const item = await createApproval();
    const read = () => inA((tx) => Promise.all([
      tx.specificationSource.findUniqueOrThrow({ where: { id: a.source.id } }),
      tx.programSpecificationExtraction.findUniqueOrThrow({ where: { id: a.extraction.id } }),
      tx.courseSpecificationReview.findUniqueOrThrow({ where: { id: item.reviewId } }),
      tx.courseSpecificationVersion.findUniqueOrThrow({ where: { id: item.versionId } }),
    ]));
    const before = await read();
    await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data: decision("APPROVED") }));
    expect(await read()).toEqual(before);
  });

  it("rejects nonexistent requester and decision actors", async () => {
    await expect(createBatch({ requestedById: crypto.randomUUID() })).rejects.toMatchObject({ code: "P2003" });
    await expect(createApproval({ ...decision("APPROVED"), decidedById: crypto.randomUUID() })).rejects.toMatchObject({ code: "P2003" });
  });

  it("supports a current approval for the exact version and clearing it", async () => {
    const version = await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentApprovalId: a.approval.id }, include: { currentApproval: true } }));
    expect(version.currentApproval?.id).toBe(a.approval.id);
    const item = await inA((tx) => tx.courseSpecificationApproval.findUniqueOrThrow({ where: { id: a.approval.id }, include: { currentForVersion: true } }));
    expect(item.currentForVersion?.id).toBe(a.version.id);
    expect((await inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentApprovalId: null } }))).currentApprovalId).toBeNull();
  });

  it("rejects currentApproval from another version or tenant", async () => {
    const other = await createApproval();
    for (const id of [other.id, b.approval.id]) {
      await expect(inA((tx) => tx.courseSpecificationVersion.update({ where: { id: a.version.id }, data: { currentApprovalId: id } }))).rejects.toMatchObject({ code: "P2003" });
    }
  });

  it("keeps pending metadata and draft batch headers editable", async () => {
    const item = await createApproval();
    const changed = await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data: { notes: "Check exception", readinessExceptions: [{ reason: "official source omits hours" }] } }));
    expect(changed.notes).toBe("Check exception");
    const batch = await inA((tx) => tx.courseSpecificationApprovalBatch.update({ where: { id: item.batchId }, data: { manifestHash: "recomputed", notes: "Ready to submit" } }));
    expect(batch.manifestHash).toBe("recomputed");
  });

  it.each(["APPROVED", "REJECTED", "CANCELED"] as const)("freezes %s decisions against edits, reopening and deletion", async (status) => {
    const item = await createApproval(decision(status));
    const changes: Prisma.CourseSpecificationApprovalUncheckedUpdateInput[] = [
      { notes: "tampered" }, { readinessExceptions: [{ tampered: true }] }, { contentHash: "different" },
      { decidedById: a.userId }, { decidedAt: new Date(0) }, { status: "PENDING", decidedById: null, decidedAt: null },
    ];
    for (const data of changes) await expect(inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data }))).rejects.toThrow(/immutable after/);
    await expect(inA((tx) => tx.courseSpecificationApproval.delete({ where: { id: item.id } }))).rejects.toThrow(/immutable after/);
  });

  it("permits draft membership changes and removal before submission", async () => {
    const item = await createApproval();
    const target = await createBatch();
    const moved = await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data: { batchId: target.id } }));
    expect(moved.batchId).toBe(target.id);
    await inA((tx) => tx.courseSpecificationApproval.delete({ where: { id: item.id } }));
    await inA((tx) => tx.courseSpecificationApprovalBatch.delete({ where: { id: target.id } }));
  });

  it("seals membership and snapshot identities while permitting pending notes/exceptions and a final decision", async () => {
    const item = await createApproval();
    const otherReview = await createReview({ versionId: item.versionId, revision: 2 });
    await inA((tx) => tx.courseSpecificationApprovalBatch.update({ where: { id: item.batchId }, data: { submittedAt: new Date() } }));
    await expect(createApproval({ batchId: item.batchId })).rejects.toThrow(/manifest is immutable/);
    await expect(inA((tx) => tx.courseSpecificationApproval.delete({ where: { id: item.id } }))).rejects.toThrow(/manifest is immutable/);
    const draftBatch = await createBatch();
    const otherItem = await createApproval();
    for (const data of [
      { batchId: draftBatch.id }, { reviewId: otherReview.id }, { contentHash: "different" },
      { versionId: otherItem.versionId, reviewId: otherItem.reviewId }, { createdAt: new Date(0) },
    ]) await expect(inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data }))).rejects.toThrow(/manifest is immutable/);
    await expect(inA((tx) => tx.courseSpecificationApproval.update({ where: { id: otherItem.id }, data: { batchId: item.batchId } }))).rejects.toThrow(/manifest is immutable/);
    await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data: { notes: "Reviewed", readinessExceptions: [{ authorized: true }] } }));
    const approved = await inA((tx) => tx.courseSpecificationApproval.update({ where: { id: item.id }, data: decision("APPROVED") }));
    expect(approved.status).toBe("APPROVED");
  });

  it("prevents changing, unsealing or deleting submitted headers", async () => {
    const batch = await createBatch();
    await inA((tx) => tx.courseSpecificationApprovalBatch.update({ where: { id: batch.id }, data: { submittedAt: new Date() } }));
    for (const data of [{ submittedAt: null }, { manifestHash: "tampered" }, { requestKey: "tampered" }, { notes: "tampered" }]) {
      await expect(inA((tx) => tx.courseSpecificationApprovalBatch.update({ where: { id: batch.id }, data }))).rejects.toThrow(/batch is immutable/);
    }
    await expect(inA((tx) => tx.courseSpecificationApprovalBatch.delete({ where: { id: batch.id } }))).rejects.toThrow(/batch is immutable/);
  });

  it("serializes submission against an uncommitted membership edit using the parent row lock", async () => {
    const item = await createApproval();
    const target = await createBatch();
    const ready = latch();
    const release = latch();
    const editing = inA(async (tx) => {
      await tx.courseSpecificationApproval.update({ where: { id: item.id }, data: { batchId: target.id } });
      ready.resolve();
      await release.promise;
    });
    const started = Promise.race([ready.promise, editing.then(() => { throw new Error("Membership edit did not hold its transaction"); })]);
    try {
      await started;
      await expect(inA(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");
        await tx.$executeRaw`UPDATE course_spec_approval_batches SET "submittedAt" = NOW() WHERE id = ${target.id}`;
      })).rejects.toThrow(/lock timeout/i);
    } finally { release.resolve(); await editing; }
    await inA((tx) => tx.courseSpecificationApprovalBatch.update({ where: { id: target.id }, data: { submittedAt: new Date() } }));
    await expect(createApproval({ batchId: target.id })).rejects.toThrow(/manifest is immutable/);
  });

  it("blocks membership changes during submission then rejects them after submission commits", async () => {
    const batch = await createBatch();
    const review = await createReview();
    const ready = latch();
    const release = latch();
    const submitting = inA(async (tx) => {
      await tx.courseSpecificationApprovalBatch.update({ where: { id: batch.id }, data: { submittedAt: new Date() } });
      ready.resolve();
      await release.promise;
    });
    try {
      await Promise.race([ready.promise, submitting.then(() => { throw new Error("Submission did not hold its transaction"); })]);
      await expect(inA(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");
        await tx.$executeRaw`
          INSERT INTO course_spec_approvals (id, "tenantId", "batchId", "versionId", "reviewId", "contentHash")
          VALUES (${crypto.randomUUID()}, ${a.tenantId}, ${batch.id}, ${review.versionId}, ${review.id}, ${contentHash})
        `;
      })).rejects.toThrow(/lock timeout/i);
    } finally { release.resolve(); await submitting; }
    await expect(createApproval({ batchId: batch.id, versionId: review.versionId, reviewId: review.id })).rejects.toThrow(/manifest is immutable/);
  });

  it.each(["course_spec_approval_batches", "course_spec_approvals"])("has forced RLS and application grants on %s", async (table) => {
    const [security] = await prismaBase.$queryRaw<{ enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean }[]>`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced, p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.relname = ${table} AND p.policyname = ${table + "_tenant_isolation"}
    `;
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    expect(security?.qual).toContain("current_tenant_id()");
    expect(security?.check).toContain("current_tenant_id()");
  });

  it("fails closed without ORM context on both models", async () => {
    await expect(prisma.courseSpecificationApproval.findMany()).rejects.toThrow(/سياق مستأجر/);
    await expect(prisma.courseSpecificationApprovalBatch.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it("injects the current tenant for both models despite foreign filters", async () => {
    const rows = await runWithTenant({ tenantId: a.tenantId, userId: a.userId }, async () => [
      await prisma.courseSpecificationApproval.findMany({ where: { tenantId: b.tenantId, id: { in: [a.approval.id, b.approval.id] } }, select: { id: true } }),
      await prisma.courseSpecificationApprovalBatch.findMany({ where: { tenantId: b.tenantId, id: { in: [a.batch.id, b.batch.id] } }, select: { id: true } }),
    ]);
    expect(rows).toEqual([[{ id: a.approval.id }], [{ id: a.batch.id }]]);
  });

  it("hides foreign rows and all rows without raw tenant context", async () => {
    const [items, batches] = await inA((tx) => Promise.all([
      tx.$queryRaw<{ id: string }[]>`SELECT id FROM course_spec_approvals WHERE id IN (${a.approval.id}, ${b.approval.id})`,
      tx.$queryRaw<{ id: string }[]>`SELECT id FROM course_spec_approval_batches WHERE id IN (${a.batch.id}, ${b.batch.id})`,
    ]));
    expect(items).toEqual([{ id: a.approval.id }]);
    expect(batches).toEqual([{ id: a.batch.id }]);
    expect(await prismaBase.$queryRaw`SELECT id FROM course_spec_approvals WHERE id = ${a.approval.id}`).toEqual([]);
    expect(await prismaBase.$queryRaw`SELECT id FROM course_spec_approval_batches WHERE id = ${a.batch.id}`).toEqual([]);
  });

  it("rejects raw foreign batch/approval insertion and tenant changes", async () => {
    const foreignBatch = await withExplicitTenantTx(b.tenantId, (tx) => tx.courseSpecificationApprovalBatch.create({ data: {
      tenantId: b.tenantId, requestKey: crypto.randomUUID(), manifestHash: contentHash, requestedById: b.userId,
    } }));
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_approval_batches (id, "tenantId", "requestKey", "manifestHash", "requestedById")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${crypto.randomUUID()}, ${contentHash}, ${b.userId})
    `)).rejects.toThrow(/row-level security/i);
    await expect(inA((tx) => tx.$executeRaw`
      INSERT INTO course_spec_approvals (id, "tenantId", "batchId", "versionId", "reviewId", "contentHash", status, "decidedById", "decidedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, ${foreignBatch.id}, ${b.version.id}, ${b.review.id}, ${contentHash}, 'REJECTED', ${b.actor.id}, NOW())
    `)).rejects.toThrow(/row-level security/i);
    const localBatch = await createBatch();
    await expect(inA((tx) => tx.$executeRaw`UPDATE course_spec_approval_batches SET "tenantId" = ${b.tenantId} WHERE id = ${localBatch.id}`)).rejects.toThrow(/row-level security/i);
    const localItem = await createApproval();
    await expect(inA((tx) => tx.$executeRaw`
      UPDATE course_spec_approvals SET "tenantId" = ${b.tenantId}, "batchId" = ${foreignBatch.id},
        "versionId" = ${b.version.id}, "reviewId" = ${b.review.id}, status = 'REJECTED', "decidedById" = ${b.actor.id}, "decidedAt" = NOW()
      WHERE id = ${localItem.id}
    `)).rejects.toThrow(/row-level security/i);
  });
});
