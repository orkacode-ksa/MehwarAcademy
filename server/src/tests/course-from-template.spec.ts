import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import type { Prisma, TermStatus } from "@prisma/client";
import { createCourseFromTemplateSchema } from "@mihwar/shared";
import { createApp } from "../app.js";
import { prismaBase, type TenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { createCourseFromTemplate } from "../modules/academic/courseTemplates.service.js";

const app = createApp();
const W = "/api/workspaces/me/academic";
const officialAssessment = [{ method: "Final exam", weight: 60, timing: "Week 16", outcomeCodes: ["CLO1"] }];
const operationalGrades = [{ key: "FINAL", label: "Final", weight: 100 }];
const fileItems = [{ key: "REPORT", label: "Course report", required: true }];
const absencePolicy = { warnPercent: 10, banPercent: 20 };

function inTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

async function seedVersion(
  tx: TenantTx,
  parent: { tenantId: string; userId: string; programId: string; fileId: string },
  version: string,
  state: "DRAFT" | "APPROVED" | "PUBLISHED",
) {
  const { tenantId, userId, programId, fileId } = parent;
  const courses = ["CS 101", "CS 102"].map((code) => ({
    code, nameAr: `Introduction ${version}`, creditHours: 4, hasLab: true,
    spec: { description: `Official description ${version}`, references: ["Official reference"], outcomes: [{ code: "CLO1", description: "Explain foundations" }] },
    assessmentPlan: version === "2" ? [{ method: "Project", weight: 100, timing: "Week 14", outcomeCodes: ["CLO2"] }] : officialAssessment,
    topics: [
      { title: `Applications ${version}`, orderIndex: 20, learningOutcomes: ["CLO1", "CLO2"] },
      { title: `Foundations ${version}`, orderIndex: 10, learningOutcomes: ["CLO1"] },
    ],
  }));
  const snapshot = { program: { description: "Official program" }, courses };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const specification = await tx.programSpecification.create({
    data: { tenantId, programId, sourceFileId: fileId, title: "Official program specification", version, sourceFileSha256: "a".repeat(64) },
  });
  const extraction = await tx.programSpecificationExtraction.create({
    data: {
      tenantId, programSpecificationId: specification.id, attempt: 1, status: "SUCCEEDED",
      requestedById: userId, promptVersion: "1", schemaVersion: "1", extractedData: snapshot, finishedAt: new Date(),
    },
  });
  const review = await tx.programSpecificationReview.create({
    data: { tenantId, programSpecificationId: specification.id, extractionId: extraction.id, revision: 1, draftData: snapshot },
  });
  const approval = await tx.programSpecificationApproval.create({
    data: { tenantId, programSpecificationId: specification.id, reviewId: review.id, contentHash, requestedById: userId },
  });
  const publication = await tx.programSpecificationPublication.create({
    data: { tenantId, programSpecificationId: specification.id, approvalId: approval.id, requestedById: userId },
  });
  const templates = [];
  for (const { topics, ...course } of courses) {
    const template = await tx.courseTemplate.create({
      data: { ...course, tenantId, programSpecificationId: specification.id, publicationId: publication.id },
    });
    await tx.courseTemplateTopic.createMany({ data: topics.map((topic) => ({ ...topic, tenantId, courseTemplateId: template.id })) });
    templates.push({ ...template, topics: await tx.courseTemplateTopic.findMany({ where: { tenantId, courseTemplateId: template.id }, orderBy: { orderIndex: "asc" } }) });
  }
  if (state !== "DRAFT") {
    await tx.programSpecificationReview.update({
      where: { id: review.id },
      data: { status: "COMPLETED", reviewedData: snapshot, contentHash, reviewedById: userId, reviewedAt: new Date() },
    });
    await tx.programSpecificationApproval.update({
      where: { id: approval.id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date() },
    });
    await tx.programSpecification.update({
      where: { id: specification.id },
      data: {
        currentExtractionId: extraction.id, currentReviewId: review.id, currentApprovalId: approval.id,
        extractionStatus: "SUCCEEDED", reviewStatus: "COMPLETED", approvalStatus: "APPROVED",
      },
    });
  }
  if (state === "PUBLISHED") {
    await tx.programSpecificationPublication.update({
      where: { id: publication.id }, data: { status: "PUBLISHED", publishedById: userId, publishedAt: new Date() },
    });
  }
  return { specification, templates };
}

async function seedTeacher() {
  const agent = request.agent(app);
  const email = `${crypto.randomUUID()}@template.test`;
  const registration = await agent.post("/api/auth/register").send({ fullName: "Template teacher", email, password: "Str0ngPassword!23", role: "TEACHER" });
  expect(registration.status).toBe(201);
  const user = await prismaBase.user.findFirstOrThrow({ where: { email } });
  const terms = await agent.get(`${W}/terms`);
  expect(terms.status).toBe(200);
  return inTenant(user.tenantId, async (tx) => {
    const tenantId = user.tenantId;
    const workspace = await tx.workspace.findFirstOrThrow({ where: { tenantId, ownerId: user.id } });
    const semester = await tx.semester.findFirstOrThrow({ where: { tenantId, id: terms.body.data[0].id } });
    const college = await tx.college.create({ data: { tenantId, code: "SCI", nameAr: "Science" } });
    const department = await tx.department.create({ data: { tenantId, collegeId: college.id, code: "CS", nameAr: "Computing" } });
    const program = await tx.program.create({ data: { tenantId, departmentId: department.id, code: "BSC", nameAr: "Computer Science" } });
    const file = await tx.fileAsset.create({
      data: { tenantId, workspaceId: workspace.id, objectKey: crypto.randomUUID(), originalName: "program.pdf", mimeType: "application/pdf", sizeBytes: 3, uploadedById: user.id, purpose: "UNIVERSITY", storage: "DB" },
    });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: Buffer.from("pdf") } });
    const regulationData = { gradeScheme: operationalGrades, courseFileItems: fileItems, absencePolicy };
    await tx.regulation.upsert({ where: { tenantId }, create: { tenantId, ...regulationData }, update: regulationData });
    const parent = { tenantId, userId: user.id, programId: program.id, fileId: file.id };
    const published = await seedVersion(tx, parent, "1", "PUBLISHED");
    const draft = await seedVersion(tx, parent, "draft", "DRAFT");
    const approved = await seedVersion(tx, parent, "approved-unpublished", "APPROVED");
    return { agent, userId: user.id, tenantId, workspace, semester, college, department, program, parent, published, draft, approved };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTeacher>>;
let a: Fixture;
let b: Fixture;

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("Expected at least one fixture row");
  return item;
}

beforeAll(async () => {
  const [role] = await prismaBase.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await seedTeacher();
  b = await seedTeacher();
});

afterAll(async () => {
  // Published fixtures are immutable and retained only in the disposable test database.
  await prismaBase.$disconnect();
});

function firstTemplate(fixture: Fixture) {
  return first(fixture.published.templates);
}

function newSemester(fixture: Fixture, status: TermStatus = "PREP", deletedAt: Date | null = null) {
  return inTenant(fixture.tenantId, (tx) => tx.semester.create({
    data: {
      tenantId: fixture.tenantId, academicYearId: fixture.semester.academicYearId,
      label: crypto.randomUUID(), startDate: fixture.semester.startDate, endDate: fixture.semester.endDate, status, deletedAt,
    },
  }));
}

describe("published course templates API", () => {
  it("lists only approved, published templates in the current tenant with their academic context", async () => {
    const response = await a.agent.get(`${W}/course-templates`);
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { id: string }) => row.id)).toEqual(a.published.templates.map((template) => template.id));
    expect(response.body.data[0]).toMatchObject({
      id: firstTemplate(a).id, code: "CS 101", nameAr: "Introduction 1", creditHours: 4, hasLab: true,
      _count: { topics: 2 },
      tenant: { id: a.tenantId }, college: { id: a.college.id, code: "SCI", nameAr: "Science" },
      department: { id: a.department.id, code: "CS", nameAr: "Computing" },
      program: { id: a.program.id, code: "BSC", nameAr: "Computer Science" },
      programSpecification: { id: a.published.specification.id, title: "Official program specification", version: "1" },
    });
    expect(response.body.data[0].tenant.name).toEqual(expect.any(String));
    expect(response.body.data[0].publishedAt).toEqual(expect.any(String));
  });

  it("returns a null college for a legacy department without a college link", async () => {
    await inTenant(a.tenantId, (tx) => tx.department.update({ where: { id: a.department.id }, data: { collegeId: null } }));
    try {
      const response = await a.agent.get(`${W}/course-templates`);
      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({ college: null, department: { id: a.department.id }, tenant: { id: a.tenantId } });
    } finally {
      await inTenant(a.tenantId, (tx) => tx.department.update({ where: { id: a.department.id }, data: { collegeId: a.college.id } }));
    }
  });

  it("requires authentication and workspace membership", async () => {
    expect((await request(app).get(`${W}/course-templates`)).status).toBe(401);
    expect((await a.agent.get(`/api/workspaces/${b.workspace.id}/academic/course-templates`)).status).toBe(404);
  });
});

describe("creating an operational course from a template", () => {
  it("accepts only templateId and semesterId in the shared schema", () => {
    const input = { templateId: firstTemplate(a).id, semesterId: a.semester.id };
    expect(createCourseFromTemplateSchema.parse(input)).toEqual(input);
    expect(createCourseFromTemplateSchema.safeParse({ ...input, tenantId: b.tenantId }).success).toBe(false);
    expect(createCourseFromTemplateSchema.safeParse({ ...input, semesterId: "" }).success).toBe(false);
    expect(createCourseFromTemplateSchema.safeParse({ ...input, templateId: "invalid" }).success).toBe(false);
  });

  it("creates a course with copied fields, spec, assessment plan and ordered topics, using the current regulation", async () => {
    const semester = await newSemester(a);
    const template = firstTemplate(a);
    const response = await a.agent.post(`${W}/courses/from-template`).send({ templateId: template.id, semesterId: semester.id });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: semester.id, courseTemplateId: template.id,
      code: template.code, nameAr: template.nameAr, creditHours: template.creditHours, hasLab: template.hasLab,
      spec: template.spec, assessmentPlan: officialAssessment, gradeScheme: operationalGrades,
      fileItems, absencePolicy, gradeSchemeConfirmedAt: null,
    });
    const stored = await inTenant(a.tenantId, (tx) => tx.course.findFirstOrThrow({
      where: { tenantId: a.tenantId, id: response.body.data.id }, include: { topics: { orderBy: { orderIndex: "asc" } } },
    }));
    expect(stored.spec).toEqual(template.spec);
    expect(stored.nameAr).toBe(template.nameAr);
    expect(stored.nameEn).toBeNull();
    expect(stored.assessmentPlan).toEqual(template.assessmentPlan);
    expect(stored.topics.map(({ title, orderIndex, learningOutcomes, sourceTemplateTopicId, tenantId, workspaceId, courseId }) =>
      ({ title, orderIndex, learningOutcomes, sourceTemplateTopicId, tenantId, workspaceId, courseId }))).toEqual(
      template.topics.map((topic) => ({ title: topic.title, orderIndex: topic.orderIndex, learningOutcomes: topic.learningOutcomes, sourceTemplateTopicId: topic.id, tenantId: a.tenantId, workspaceId: a.workspace.id, courseId: stored.id })),
    );
    expect(stored.topics.map((topic) => topic.id)).not.toEqual(template.topics.map((topic) => topic.id));
  });

  it("rejects a template belonging to another tenant", async () => {
    const response = await a.agent.post(`${W}/courses/from-template`).send({ templateId: firstTemplate(b).id, semesterId: a.semester.id });
    expect(response.status).toBe(404);
    expect(await inTenant(a.tenantId, (tx) => tx.course.count({ where: { tenantId: a.tenantId, courseTemplateId: firstTemplate(b).id } }))).toBe(0);
  });

  it.each(["draft", "approved"] as const)("rejects an unpublished %s template", async (key) => {
    const response = await a.agent.post(`${W}/courses/from-template`).send({ templateId: first(a[key].templates).id, semesterId: a.semester.id });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it.each(["GRADING", "CLOSED", "ARCHIVED"] as const)("rejects a %s semester", async (status) => {
    const semester = await newSemester(a, status);
    const response = await a.agent.post(`${W}/courses/from-template`).send({ templateId: firstTemplate(a).id, semesterId: semester.id });
    expect(response.status).toBe(400);
  });

  it("rejects deleted and foreign semesters", async () => {
    const deleted = await newSemester(a, "PREP", new Date());
    for (const semesterId of [deleted.id, b.semester.id]) {
      expect((await a.agent.post(`${W}/courses/from-template`).send({ templateId: firstTemplate(a).id, semesterId })).status).toBe(404);
    }
  });

  it("rejects a duplicate code even when concurrent requests arrive, and allows a different semester", async () => {
    const semester = await newSemester(a);
    const input = { templateId: firstTemplate(a).id, semesterId: semester.id };
    const responses = await Promise.all([a.agent.post(`${W}/courses/from-template`).send(input), a.agent.post(`${W}/courses/from-template`).send(input)]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const stored = await inTenant(a.tenantId, (tx) => tx.course.findMany({ where: { tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: semester.id }, include: { topics: true } }));
    expect(stored).toHaveLength(1);
    expect(first(stored).topics).toHaveLength(2);
    const otherSemester = await newSemester(a, "ACTIVE");
    expect((await a.agent.post(`${W}/courses/from-template`).send({ ...input, semesterId: otherSemester.id })).status).toBe(201);
  });

  it("reports a conflict for a soft-deleted course with the same code", async () => {
    const semester = await newSemester(a);
    const template = firstTemplate(a);
    await inTenant(a.tenantId, (tx) => tx.course.create({ data: { tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: semester.id, code: template.code, nameAr: "Legacy", creditHours: 3, deletedAt: new Date() } }));
    expect((await a.agent.post(`${W}/courses/from-template`).send({ templateId: template.id, semesterId: semester.id })).status).toBe(409);
  });

  it("rolls back the course and all topics if the snapshot transaction fails", async () => {
    const semester = await newSemester(a);
    let writtenId = "";
    const originalTransaction = prismaBase.$transaction.bind(prismaBase);
    const transactionSpy = vi.spyOn(prismaBase, "$transaction").mockImplementationOnce((async (input: unknown) => {
      if (typeof input !== "function") throw new Error("Expected interactive transaction");
      const fn = input as (tx: TenantTx) => Promise<unknown>;
      return originalTransaction(async (tx) => {
        const course = new Proxy(tx.course, {
          get(target, key) {
            if (key === "create") return async (args: Prisma.CourseCreateArgs) => {
              const row = await target.create(args);
              writtenId = row.id;
              expect(await tx.topic.count({ where: { tenantId: a.tenantId, courseId: writtenId } })).toBe(2);
              throw new Error("Simulated snapshot failure");
            };
            return Reflect.get(target, key);
          },
        });
        return fn(new Proxy(tx, { get(target, key) { return key === "course" ? course : Reflect.get(target, key); } }));
      });
    }) as typeof prismaBase.$transaction);
    try {
      await expect(runWithTenant({ tenantId: a.tenantId, userId: a.userId }, () => createCourseFromTemplate(a.workspace.id, { templateId: firstTemplate(a).id, semesterId: semester.id }))).rejects.toThrow("Simulated snapshot failure");
    } finally {
      transactionSpy.mockRestore();
    }
    expect(writtenId).not.toBe("");
    expect(await inTenant(a.tenantId, (tx) => tx.course.count({ where: { tenantId: a.tenantId, id: writtenId } }))).toBe(0);
    expect(await inTenant(a.tenantId, (tx) => tx.topic.count({ where: { tenantId: a.tenantId, courseId: writtenId } }))).toBe(0);
  });

  it("keeps the course snapshot independent when a newer official version and regulation are published", async () => {
    const semester = await newSemester(a);
    const original = await a.agent.post(`${W}/courses/from-template`).send({ templateId: firstTemplate(a).id, semesterId: semester.id });
    expect(original.status).toBe(201);
    const newer = await inTenant(a.tenantId, async (tx) => {
      await tx.regulation.update({ where: { tenantId: a.tenantId }, data: { gradeScheme: [{ key: "EXAM", label: "New exam", weight: 100 }], courseFileItems: [], absencePolicy: { warnPercent: 5, banPercent: 15 } } });
      return seedVersion(tx, a.parent, "2", "PUBLISHED");
    });
    const stored = await a.agent.get(`${W}/courses/${original.body.data.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.data).toMatchObject({ spec: firstTemplate(a).spec, assessmentPlan: officialAssessment, gradeScheme: operationalGrades, fileItems, absencePolicy, courseTemplateId: firstTemplate(a).id });
    expect(stored.body.data.topics.map((topic: { title: string }) => topic.title)).toEqual(["Foundations 1", "Applications 1"]);
    const nextSemester = await newSemester(a);
    const updated = await a.agent.post(`${W}/courses/from-template`).send({ templateId: first(newer.templates).id, semesterId: nextSemester.id });
    expect(updated.status).toBe(201);
    expect(updated.body.data.spec).toEqual(first(newer.templates).spec);
    expect(updated.body.data.assessmentPlan).toEqual(first(newer.templates).assessmentPlan);
    expect(updated.body.data.assessmentPlan).not.toEqual(original.body.data.assessmentPlan);
    expect(updated.body.data.gradeScheme).toEqual([{ key: "EXAM", label: "New exam", weight: 100 }]);
    expect(updated.body.data.topics.map((topic: { title: string }) => topic.title)).toEqual(["Foundations 2", "Applications 2"]);
    await expect(inTenant(a.tenantId, (tx) => tx.courseTemplate.update({ where: { id: firstTemplate(a).id }, data: { nameAr: "Changed" } }))).rejects.toThrow(/immutable/i);
  });

  it("enforces the current plan limit across semesters and concurrent template additions", async () => {
    const plan = await prismaBase.plan.create({ data: { code: crypto.randomUUID(), nameAr: "One course plan", priceMonthly: 1, priceYearly: 12, maxCourses: 1, storageMb: 100, generationsPerMonth: 10, active: false } });
    await inTenant(b.tenantId, (tx) => tx.subscription.update({ where: { workspaceId: b.workspace.id }, data: { status: "ACTIVE", planId: plan.id, currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } }));
    const semester = await newSemester(b);
    const responses = await Promise.all(b.published.templates.map((template) => b.agent.post(`${W}/courses/from-template`).send({ templateId: template.id, semesterId: semester.id })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(await inTenant(b.tenantId, (tx) => tx.course.count({ where: { tenantId: b.tenantId, workspaceId: b.workspace.id, deletedAt: null } }))).toBe(1);
    const nextSemester = await newSemester(b);
    expect((await b.agent.post(`${W}/courses/from-template`).send({ templateId: firstTemplate(b).id, semesterId: nextSemester.id })).status).toBe(400);
    expect((await b.agent.post(`${W}/courses`).send({ semesterId: nextSemester.id, code: "LEGACY 103", nameAr: "Legacy creation", creditHours: 3 })).status).toBe(400);
  });
});
