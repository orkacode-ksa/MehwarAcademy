// Browser fixtures only. No application imports this file; no real files, accounts or databases are read.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { prismaBase, withExplicitTenantTx } from "../../src/lib/prisma.js";
import { runWithTenant } from "../../src/lib/tenantContext.js";
import { normalizeSavedCourseExtraction } from "../../src/modules/academic/courseCandidateNormalization.js";
import { normalizedCourseExtractionSchema } from "@mihwar/shared";
import { materializeNormalizedCourses } from "../../src/modules/academic/courseWorkflow.ingestion.js";
import { openCourseReview, saveCourseReview, completeCourseReview } from "../../src/modules/academic/courseWorkflow.reviews.js";
import { specificationChunkSchema, SPECIFICATION_PROMPT_VERSION, SPECIFICATION_SCHEMA_VERSION } from "../../src/modules/academic/specificationExtraction.schema.js";

const target = new URL(process.env.DATABASE_URL ?? "");
if (process.env.NODE_ENV !== "test" || target.hostname !== "127.0.0.1" || !target.pathname.startsWith("/mihwar_academic_test_") || !process.env.ACADEMIC_TEST_DIRECTORY) throw new Error("Automated isolated test environment required");
const sample = JSON.parse(fs.readFileSync(new URL("../../src/tests/fixtures/botany-review.fixture.json", import.meta.url), "utf8")) as { extractedData: unknown };
const password = crypto.randomBytes(24).toString("hex"), passwordHash = await argon2.hash(password);
const tenant = await prismaBase.tenant.create({ data: { slug: crypto.randomUUID(), name: "Automated browser test university", listed: false } });
try {
  const teacher = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@browser.test`, fullName: "Test teacher", role: "TEACHER", passwordHash, emailVerifiedAt: new Date() } });
  const reviewer = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@browser.test`, fullName: "Test reviewer", role: "ADMIN", staffScreens: ["institutions"], passwordHash, emailVerifiedAt: new Date() } });
  const seeded = await withExplicitTenantTx(tenant.id, async (tx) => {
    const workspace = await tx.workspace.create({ data: { tenantId: tenant.id, ownerId: teacher.id, name: "Browser tests" } });
    await tx.workspaceMember.create({ data: { tenantId: tenant.id, workspaceId: workspace.id, userId: teacher.id, role: "OWNER" } });
    await tx.subscription.create({ data: { tenantId: tenant.id, workspaceId: workspace.id, planCode: "MIHWAR_PRO", status: "TRIALING", trialEndsAt: new Date(Date.now() + 864e5) } });
    const year = await tx.academicYear.create({ data: { tenantId: tenant.id, label: "Test year", startDate: new Date("2026-01-01"), endDate: new Date("2027-12-31") } });
    const semester = await tx.semester.create({ data: { tenantId: tenant.id, academicYearId: year.id, label: "Browser test semester", startDate: year.startDate, endDate: year.endDate, status: "PREP" } });
    await tx.regulation.create({ data: { tenantId: tenant.id, gradeScheme: [{ key: "FINAL", label: "Final", weight: 100 }], courseFileItems: [], absencePolicy: { warnPercent: 15, banPercent: 25 } } });
    const createSource = async (name: string) => {
      const bytes = Buffer.from("%PDF-1.7\nAutomated browser upload fixture only\n%%EOF");
      const file = await tx.fileAsset.create({ data: { tenantId: tenant.id, workspaceId: workspace.id, uploadedById: teacher.id, originalName: name,
        objectKey: crypto.randomUUID(), storage: "DB", mimeType: "application/pdf", purpose: "UNIVERSITY", sizeBytes: bytes.length } });
      await tx.fileBlob.create({ data: { tenantId: tenant.id, fileId: file.id, data: bytes } });
      return tx.specificationSource.create({ data: { tenantId: tenant.id, fileId: file.id, uploadedById: teacher.id, fileSha256: crypto.createHash("sha256").update(bytes).digest("hex") } });
    };
    const source = await createSource("automated-courses.pdf");
    const extractionId = `c${crypto.randomBytes(12).toString("hex")}`;
    const normalized = normalizeSavedCourseExtraction(source.id, extractionId, sample.extractedData);
    await tx.programSpecificationExtraction.create({ data: { tenantId: tenant.id, id: extractionId, sourceId: source.id, attempt: 1, status: "SUCCEEDED", requestedById: teacher.id,
      promptVersion: "automated-test-fixture", schemaVersion: normalized.schemaVersion, extractedData: normalized as Prisma.InputJsonValue, finishedAt: new Date() } });
    await tx.specificationSource.update({ where: { id: source.id }, data: { currentExtractionId: extractionId, extractionStatus: "SUCCEEDED" } });
    const paused = await createSource("automated-paused.pdf");
    const attempt = await tx.programSpecificationExtraction.create({ data: { tenantId: tenant.id, sourceId: paused.id, attempt: 1, status: "FAILED", requestedById: teacher.id,
      promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION, finishedAt: new Date(), rawOutput: {
        promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION, parser: "test-only", pageCount: 52, chunkCount: 52,
        chunks: Array.from({ length: 35 }, (_, index) => ({ index, sourcePages: [index + 1], model: "automated-test-fixture", finishReason: "STOP", completed: true, rawOutput: JSON.stringify(specificationChunkSchema.parse({})) })),
        failure: { type: "RATE_LIMIT", message: "automated fixture", httpStatus: 429 } } } });
    await tx.specificationSource.update({ where: { id: paused.id }, data: { currentExtractionId: attempt.id, extractionStatus: "FAILED" } });
    const diagnostic = await createSource("automated-review.pdf");
    const diagnosticId = `c${crypto.randomBytes(12).toString("hex")}`;
    const normalizedDiagnostic = normalizedCourseExtractionSchema.parse({ ...normalizeSavedCourseExtraction(diagnostic.id, diagnosticId, sample.extractedData),
      candidates: normalized.candidates.filter((c) => c.data.courseCode === "CHM1101") });
    await tx.programSpecificationExtraction.create({ data: { tenantId: tenant.id, sourceId: diagnostic.id, id: diagnosticId, attempt: 1, status: "SUCCEEDED", requestedById: teacher.id,
      promptVersion: "automated-test-fixture", schemaVersion: normalizedDiagnostic.schemaVersion, extractedData: normalizedDiagnostic as Prisma.InputJsonValue, finishedAt: new Date() } });
    await tx.specificationSource.update({ where: { id: diagnostic.id }, data: { currentExtractionId: diagnosticId, extractionStatus: "SUCCEEDED" } });
    return { sourceId: source.id, pausedSourceId: paused.id, semesterId: semester.id, diagnostic: normalizedDiagnostic };
  });
  const diagnostic = await runWithTenant({ tenantId: tenant.id, userId: teacher.id }, async () => {
    const rows = await materializeNormalizedCourses(teacher.id, seeded.diagnostic);
    const version = rows[0]?.version;
    if (!version) throw new Error("Missing diagnostic fixture version");
    const review = await openCourseReview(teacher.id, version.id);
    // This test isolates the missing-type explanation; hours are an explicit test reviewer edit.
    const saved = await saveCourseReview(teacher.id, version.id, review.id, { expectedVersion: review.version, course: { ...review.draftData, status: "READY", creditHours: 3 } });
    const completed = await completeCourseReview(teacher.id, version.id, review.id, saved.version);
    return { sourceId: seeded.diagnostic.sourceId, version, review: completed };
  });
  fs.writeFileSync(path.join(process.env.ACADEMIC_TEST_DIRECTORY, "manifest.json"), JSON.stringify({ tenantId: tenant.id, teacherEmail: teacher.email, reviewerEmail: reviewer.email, password,
    sourceId: seeded.sourceId, pausedSourceId: seeded.pausedSourceId, semesterId: seeded.semesterId, origin: process.env.APP_URL, diagnostic }));
} finally { await prismaBase.$disconnect(); }
