import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma, prismaBase, type TenantTx } from "../lib/prisma.js";
import { type TenantScopedModel } from "../lib/tenantScope.js";

const CATALOG = [
  ["College", "colleges", "college"],
  ["Program", "programs", "program"],
  ["ProgramSpecification", "program_specifications", "specification"],
  ["ProgramSpecificationExtraction", "program_spec_extractions", "extraction"],
  ["ProgramSpecificationReview", "program_spec_reviews", "review"],
  ["ProgramSpecificationApproval", "program_spec_approvals", "approval"],
  ["ProgramSpecificationPublication", "program_spec_publications", "publication"],
  ["CourseTemplate", "course_templates", "template"],
  ["CourseTemplateTopic", "course_template_topics", "templateTopic"],
] as const satisfies ReadonlyArray<readonly [TenantScopedModel, string, string]>;

async function inTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

const assessmentPlan = [{ method: "Final exam", weight: 60, timing: "Week 16", outcomeCodes: ["CLO1"] }];
const operationalGrades = [{ key: "FINAL", label: "Final", weight: 100 }];

async function seedSpecification(
  tx: TenantTx,
  parent: { tenantId: string; userId: string; programId: string; fileId: string },
  version: string,
) {
  const { tenantId, userId, programId, fileId } = parent;
  const snapshot = {
    program: { description: "Official program specification" },
    courses: [{
      code: "CS101", nameAr: "Introduction", creditHours: 3,
      spec: { description: "Official course description" }, assessmentPlan,
      topics: [{ title: "Foundations", orderIndex: 0, learningOutcomes: ["CLO1"] }],
    }],
  };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const specification = await tx.programSpecification.create({
    data: { tenantId, programId, sourceFileId: fileId, title: "Program specification", version, sourceFileSha256: "a".repeat(64) },
  });
  const extraction = await tx.programSpecificationExtraction.create({
    data: {
      tenantId, programSpecificationId: specification.id, attempt: 1,
      status: "SUCCEEDED", requestedById: userId, promptVersion: "1", schemaVersion: "1",
      extractedData: snapshot, finishedAt: new Date(),
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
  const template = await tx.courseTemplate.create({
    data: {
      tenantId, programSpecificationId: specification.id, publicationId: publication.id,
      code: "CS101", nameAr: "Introduction", creditHours: 3, spec: snapshot.courses[0]!.spec, assessmentPlan,
    },
  });
  const templateTopic = await tx.courseTemplateTopic.create({
    data: { tenantId, courseTemplateId: template.id, title: "Foundations", orderIndex: 0, learningOutcomes: ["CLO1"] },
  });
  return { specification, extraction, review, approval, publication, template, templateTopic, contentHash, snapshot };
}

async function seedTenant() {
  const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Schema test university" } });
  const user = await prismaBase.user.create({
    data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@schema.test`, passwordHash: "unused", fullName: "Schema test teacher", role: "TEACHER" },
  });
  return inTenant(tenant.id, async (tx) => {
    const tenantId = tenant.id;
    const userId = user.id;
    const college = await tx.college.create({ data: { tenantId, code: "SCI", nameAr: "Science" } });
    const department = await tx.department.create({ data: { tenantId, collegeId: college.id, code: "CS", nameAr: "Computing" } });
    const program = await tx.program.create({ data: { tenantId, departmentId: department.id, code: "BSC", nameAr: "Computer Science" } });
    const workspace = await tx.workspace.create({ data: { tenantId, ownerId: userId, name: "Teacher" } });
    const year = await tx.academicYear.create({
      data: { tenantId, label: "2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
    });
    const semester = await tx.semester.create({
      data: { tenantId, academicYearId: year.id, label: "First", startDate: year.startDate, endDate: year.endDate },
    });
    const file = await tx.fileAsset.create({
      data: {
        tenantId, workspaceId: workspace.id, objectKey: crypto.randomUUID(), originalName: "program.pdf",
        mimeType: "application/pdf", sizeBytes: 3, uploadedById: userId, purpose: "UNIVERSITY", storage: "DB",
      },
    });
    await tx.fileBlob.create({ data: { tenantId, fileId: file.id, data: Buffer.from("pdf") } });
    const graph = await seedSpecification(tx, { tenantId, userId, programId: program.id, fileId: file.id }, "1");
    return { tenantId, userId, college, department, program, workspace, semester, file, ...graph };
  });
}

type Fixture = Awaited<ReturnType<typeof seedTenant>>;
type SpecificationGraph = Awaited<ReturnType<typeof seedSpecification>>;
let a: Fixture;
let b: Fixture;
let published: SpecificationGraph;

beforeAll(async () => {
  const [role] = await prismaBase.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  a = await seedTenant();
  b = await seedTenant();
  published = await inTenant(a.tenantId, async (tx) => {
    const graph = await seedSpecification(tx, { tenantId: a.tenantId, userId: a.userId, programId: a.program.id, fileId: a.file.id }, "2");
    await tx.programSpecificationReview.update({
      where: { id: graph.review.id },
      data: { status: "COMPLETED", reviewedData: graph.snapshot, contentHash: graph.contentHash, reviewedById: a.userId, reviewedAt: new Date() },
    });
    await tx.programSpecificationApproval.update({
      where: { id: graph.approval.id }, data: { status: "APPROVED", decidedById: a.userId, decidedAt: new Date() },
    });
    await tx.programSpecification.update({
      where: { id: graph.specification.id },
      data: {
        currentExtractionId: graph.extraction.id, currentReviewId: graph.review.id, currentApprovalId: graph.approval.id,
        extractionStatus: "SUCCEEDED", reviewStatus: "COMPLETED", approvalStatus: "APPROVED",
      },
    });
    await tx.programSpecificationPublication.update({
      where: { id: graph.publication.id }, data: { status: "PUBLISHED", publishedById: a.userId, publishedAt: new Date() },
    });
    return graph;
  });
});

afterAll(async () => {
  // Approved snapshots are intentionally retained. Use a disposable test database.
  await prismaBase.$disconnect();
});

describe("program specification schema and tenant isolation", () => {
  it.each(CATALOG)("%s has forced RLS, tenant read/write policy and application grants", async (_model, table) => {
    const [security] = await prismaBase.$queryRawUnsafe<{
      enabled: boolean; forced: boolean; qual: string; check: string; read: boolean; write: boolean;
    }[]>(`
      SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
        p.qual, p.with_check AS check,
        has_table_privilege(current_user, c.oid, 'SELECT') AS read,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE') AS write
      FROM pg_class c JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
      WHERE c.oid = $1::regclass AND p.policyname = $2
    `, table, `${table}_tenant_isolation`);
    expect(security).toMatchObject({ enabled: true, forced: true, read: true, write: true });
    if (!security) throw new Error(`Missing tenant isolation policy for ${table}`);
    expect(security.qual).toContain("current_tenant_id()");
    expect(security.check).toContain("current_tenant_id()");
  });

  it.each(CATALOG)("%s denies ORM queries without tenant context", async (model) => {
    const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1) as Uncapitalize<typeof model>] as unknown as { findMany(): Promise<unknown[]> };
    await expect(delegate.findMany()).rejects.toThrow(/سياق مستأجر/);
  });

  it.each(CATALOG)("%s hides other tenants even from raw SQL", async (_model, table, key) => {
    const foreignId = (b[key as keyof Fixture] as { id: string }).id;
    const ownId = (a[key as keyof Fixture] as { id: string }).id;
    const rows = await inTenant(a.tenantId, (tx) => tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "${table}" WHERE id IN ($1, $2)`, foreignId, ownId));
    expect(rows).toEqual([{ id: ownId }]);
    const unscoped = await prismaBase.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1`, ownId);
    expect(unscoped).toEqual([]);
  });

  it("rejects writing a row into another tenant through raw SQL", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.$executeRaw`
      INSERT INTO colleges (id, "tenantId", code, "nameAr", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${b.tenantId}, 'INJECT', 'Injected', NOW())
    `)).rejects.toThrow(/row-level security/i);
  });

  it("does not expose the private catalog wipe helper to the application role", async () => {
    await expect(prismaBase.$executeRaw`SELECT mihwar_wipe_spec_catalog(ARRAY[${a.tenantId}])`).rejects.toThrow(/permission denied/i);
  });

  it("rejects linking a department to another tenant's college", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.department.create({
      data: { tenantId: a.tenantId, collegeId: b.college.id, code: "CROSS", nameAr: "Cross tenant" },
    }))).rejects.toThrow(/Foreign key constraint/i);
  });

  it("rejects linking a specification to another tenant's source file", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecification.create({
      data: { tenantId: a.tenantId, programId: a.program.id, sourceFileId: b.file.id, version: "cross", title: "Cross", sourceFileSha256: "b".repeat(64) },
    }))).rejects.toThrow(/Foreign key constraint/i);
  });

  it("rejects using an extraction from a different specification in the same tenant", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecification.update({
      where: { id: a.specification.id }, data: { currentExtractionId: published.extraction.id },
    }))).rejects.toThrow(/Foreign key constraint/i);
  });

  it("rejects creating a review with an extraction from another specification", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecificationReview.create({
      data: { tenantId: a.tenantId, programSpecificationId: a.specification.id, extractionId: published.extraction.id, revision: 2, draftData: {} },
    }))).rejects.toThrow(/Foreign key constraint/i);
  });

  it("preserves optional links for existing departments and bank courses", async () => {
    const { department, course, topic } = await inTenant(a.tenantId, async (tx) => {
      const department = await tx.department.create({ data: { tenantId: a.tenantId, code: "OLD", nameAr: "Legacy" } });
      const course = await tx.course.create({
        data: {
          tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: a.semester.id,
          code: "OLD101", nameAr: "Legacy bank course", creditHours: 3,
          bankCourseId: "legacy-bank-source", gradeScheme: operationalGrades,
        },
      });
      const topic = await tx.topic.create({
        data: { tenantId: a.tenantId, workspaceId: a.workspace.id, courseId: course.id, title: "Manual topic", orderIndex: 0 },
      });
      return { department, course, topic };
    });
    expect(department.collegeId).toBeNull();
    expect(course.courseTemplateId).toBeNull();
    expect(course.assessmentPlan).toEqual([]);
    expect(course.bankCourseId).toBe("legacy-bank-source");
    expect(course.gradeScheme).toEqual(operationalGrades);
    expect(topic.sourceTemplateTopicId).toBeNull();
  });

  it("rejects linking a course or copied topic to another tenant's template", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.course.create({
      data: {
        tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: a.semester.id,
        courseTemplateId: b.template.id, code: "CROSS101", nameAr: "Cross", creditHours: 3,
      },
    }))).rejects.toThrow(/Foreign key constraint/i);
    await expect(inTenant(a.tenantId, async (tx) => {
      const course = await tx.course.create({
        data: { tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: a.semester.id, code: "CROSS102", nameAr: "Cross", creditHours: 3 },
      });
      await tx.topic.create({
        data: { tenantId: a.tenantId, workspaceId: a.workspace.id, courseId: course.id, sourceTemplateTopicId: b.templateTopic.id, title: "Cross", orderIndex: 0 },
      });
    })).rejects.toThrow(/Foreign key constraint/i);
  });

  it("stores independent assessment and topic snapshots without changing operational grades", async () => {
    const course = await inTenant(a.tenantId, async (tx) => {
      const template = await tx.courseTemplate.findUniqueOrThrow({ where: { id: published.template.id }, include: { topics: true } });
      return tx.course.create({
        data: {
          tenantId: a.tenantId, workspaceId: a.workspace.id, semesterId: a.semester.id,
          courseTemplateId: template.id, code: template.code, nameAr: template.nameAr,
          creditHours: template.creditHours, spec: template.spec!, assessmentPlan: template.assessmentPlan!,
          gradeScheme: operationalGrades,
          topics: {
            create: template.topics.map((topic) => ({
              tenantId: a.tenantId, workspaceId: a.workspace.id, sourceTemplateTopicId: topic.id,
              title: topic.title, orderIndex: topic.orderIndex, learningOutcomes: topic.learningOutcomes,
            })),
          },
        },
        include: { topics: true },
      });
    });
    expect(course.assessmentPlan).toEqual(assessmentPlan);
    expect(course.gradeScheme).toEqual(operationalGrades);
    expect(course.topics).toHaveLength(1);
    const copiedTopic = course.topics[0]!;
    expect(copiedTopic).toMatchObject({ title: "Foundations", orderIndex: 0, learningOutcomes: ["CLO1"], sourceTemplateTopicId: published.templateTopic.id });
    await inTenant(a.tenantId, async (tx) => {
      await tx.course.update({ where: { id: course.id }, data: { assessmentPlan: [] } });
      await tx.topic.update({ where: { id: copiedTopic.id }, data: { title: "Teacher's topic" } });
      expect((await tx.course.findUniqueOrThrow({ where: { id: course.id } })).gradeScheme).toEqual(operationalGrades);
      expect((await tx.courseTemplate.findUniqueOrThrow({ where: { id: published.template.id } })).assessmentPlan).toEqual(assessmentPlan);
      expect((await tx.courseTemplateTopic.findUniqueOrThrow({ where: { id: published.templateTopic.id } })).title).toBe("Foundations");
    });
  });

  it("rejects completed reviews without their snapshot and reviewer", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecificationReview.update({
      where: { id: a.review.id }, data: { status: "COMPLETED" },
    }))).rejects.toThrow(/program_spec_review_completed_snapshot/);
  });

  it("rejects approval before review completion", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecificationApproval.update({
      where: { id: a.approval.id }, data: { status: "APPROVED", decidedById: a.userId, decidedAt: new Date() },
    }))).rejects.toThrow(/Approval requires a completed review/);
  });

  it("rejects marking a specification approved without its approved snapshot", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecification.update({
      where: { id: a.specification.id }, data: { approvalStatus: "APPROVED", reviewStatus: "COMPLETED", extractionStatus: "SUCCEEDED" },
    }))).rejects.toThrow(/Approved specification requires/);
  });

  it("rejects publication before approval", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.programSpecificationPublication.update({
      where: { id: a.publication.id }, data: { status: "PUBLISHED", publishedById: a.userId, publishedAt: new Date() },
    }))).rejects.toThrow(/Publication requires the approved specification/);
  });

  const frozen = [
    ["program_specifications", "specification", "title"],
    ["program_spec_extractions", "extraction", "errorMessage"],
    ["program_spec_reviews", "review", "notes"],
    ["program_spec_approvals", "approval", "notes"],
    ["program_spec_publications", "publication", "errorMessage"],
    ["course_templates", "template", "nameAr"],
    ["course_template_topics", "templateTopic", "title"],
  ] as const;

  it.each(frozen)("%s rejects updates after completion or publication", async (table, key, field) => {
    const id = published[key].id;
    await expect(inTenant(a.tenantId, (tx) => tx.$executeRawUnsafe(`UPDATE "${table}" SET "${field}" = 'changed' WHERE id = $1`, id))).rejects.toThrow(/immutable/i);
  });

  it.each(frozen)("%s rejects deletion after completion or publication", async (table, key) => {
    await expect(inTenant(a.tenantId, (tx) => tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id = $1`, published[key].id))).rejects.toThrow(/immutable/i);
  });

  it("rejects appending or moving topics into an already published template", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.courseTemplateTopic.create({
      data: { tenantId: a.tenantId, courseTemplateId: published.template.id, title: "Late topic", orderIndex: 99 },
    }))).rejects.toThrow(/immutable/i);
    await expect(inTenant(a.tenantId, (tx) => tx.courseTemplateTopic.update({
      where: { id: a.templateTopic.id }, data: { courseTemplateId: published.template.id, orderIndex: 98 },
    }))).rejects.toThrow(/immutable/i);
  });

  it("cannot evade immutability by moving a published template to a pending publication", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.courseTemplate.update({
      where: { id: published.template.id },
      data: { publicationId: a.publication.id, programSpecificationId: a.specification.id, code: "MOVED" },
    }))).rejects.toThrow(/immutable/i);
  });

  it("protects the original file and DB content while retaining workspaceId", async () => {
    await expect(inTenant(a.tenantId, (tx) => tx.fileAsset.update({
      where: { id: a.file.id }, data: { deletedAt: new Date() },
    }))).rejects.toThrow(/source file is immutable/i);
    await expect(inTenant(a.tenantId, (tx) => tx.fileBlob.delete({ where: { fileId: a.file.id } }))).rejects.toThrow(/source content is immutable/i);
    await expect(inTenant(a.tenantId, (tx) => tx.fileBlob.update({
      where: { fileId: a.file.id }, data: { data: Buffer.from("changed") },
    }))).rejects.toThrow(/source content is immutable/i);
    expect((await inTenant(a.tenantId, (tx) => tx.fileAsset.findUniqueOrThrow({ where: { id: a.file.id } }))).workspaceId).toBe(a.workspace.id);
  });
});
