import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { createApp } from "../app.js";
import { prismaBase, type TenantTx } from "../lib/prisma.js";
import { AppError } from "../lib/AppError.js";
import * as files from "../modules/files/files.service.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetExpensiveLimitForTests } from "../middleware/rateLimit.js";
import { uploadSpecificationSource } from "../modules/academic/specificationSources.service.js";
import { claimSpecificationExtraction, runClaimedSpecificationExtraction } from "../modules/academic/specificationExtraction.service.js";
import { drainGeneration } from "../modules/generation/generation.service.js";
import { readSpecificationPdf, chunkSpecificationPages } from "../modules/academic/specificationPdf.js";
import { groundChunk, mergeSpecificationChunks, validateSourcePages } from "../modules/academic/specificationExtraction.merge.js";
import { identityContext } from "../modules/academic/specificationExtraction.pipeline.js";
import { specificationChunkSchema, SPECIFICATION_PROMPT_VERSION, SPECIFICATION_SCHEMA_VERSION } from "../modules/academic/specificationExtraction.schema.js";

const app = createApp();
const S = "/api/workspaces/me/academic/specification-sources";
const text = "Institution: Local University\nCollege: Science\nDepartment: Biology\nProgram: Botany\nProgram code: BOT\nCourse: BIO1101 Plant Biology\nCredit hours: 3\nLab: yes\nTopic: Cells\nCLO: Identify plant cells\nFinal exam: 40\nCourse: BIO1102 Ecology\nTopic: Ecosystems\nProgram: Zoology\nProgram code: ZOO\nTrack: Animals\nCourse: ZOO1101 Animal Biology";

/** A real, small multi-page PDF; parsing is exercised without a browser, network, or production fixture. */
function pdf(lines = [text]): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const kids: number[] = [];
  for (const page of lines) {
    const id = objects.length + 1; kids.push(id);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`);
    const stream = "BT /F1 10 Tf 40 750 Td " + page.split("\n").map((line, index) => `${index ? "0 -14 Td " : ""}(${line.replace(/[\\()]/g, "\\$&")}) Tj`).join("\n") + " ET";
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}

function required<T>(value: T | null | undefined): T { if (value === null || value === undefined) throw new Error("Missing test fixture"); return value; }
function evidence(quote: string, page: number) { return { quote, sourcePages: [page] }; }
function candidate(page = 1, multiple = false) {
  const course = { code: "BIO1101", nameEn: "Plant Biology", creditHours: 3, hasLab: true, sourcePages: [page],
    fieldEvidence: { code: evidence("Course: BIO1101 Plant Biology", page), nameEn: evidence("Course: BIO1101 Plant Biology", page),
      creditHours: evidence("Credit hours: 3", page), hasLab: evidence("Lab: yes", page) },
    learningOutcomes: [{ description: "Identify plant cells", sourcePages: [page] }],
    topics: [{ title: "Cells", sourcePages: [page], contactHours: null }],
    assessmentPlan: [{ method: "Final exam", weight: 40, sourcePages: [page], fieldEvidence: { weight: evidence("Final exam: 40", page) } }] };
  return specificationChunkSchema.parse({
    institution: { name: "Local University", sourcePages: [page], fieldEvidence: { name: evidence("Institution: Local University", page) } },
    college: { name: "Science", sourcePages: [page], fieldEvidence: { name: evidence("College: Science", page) } },
    department: { name: "Biology", sourcePages: [page], fieldEvidence: { name: evidence("Department: Biology", page) } },
    programs: [{ name: "Botany", code: "BOT", sourcePages: [page], fieldEvidence: { name: evidence("Program: Botany", page), code: evidence("Program code: BOT", page) },
      courses: [course, { code: "BIO1102", nameEn: "Ecology", sourcePages: [page], fieldEvidence: { code: evidence("Course: BIO1102 Ecology", page), nameEn: evidence("Course: BIO1102 Ecology", page) }, topics: [{ title: "Ecosystems", sourcePages: [page] }] }] },
      ...(multiple ? [{ name: "Zoology", code: "ZOO", track: "Animals", sourcePages: [page], fieldEvidence: { name: evidence("Program: Zoology", page), code: evidence("Program code: ZOO", page), track: evidence("Track: Animals", page) },
        courses: [{ code: "ZOO1101", nameEn: "Animal Biology", sourcePages: [page], fieldEvidence: { code: evidence("Course: ZOO1101 Animal Biology", page), nameEn: evidence("Course: ZOO1101 Animal Biology", page) } }] }] : [])],
  });
}

function inTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>) {
  return prismaBase.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`; return fn(tx); });
}
async function seedActor(tenantId?: string, role: UserRole = "TEACHER") {
  const tenant = tenantId ? { id: tenantId } : await prismaBase.tenant.create({ data: { name: "Extraction university", slug: crypto.randomUUID() } });
  const user = await prismaBase.user.create({ data: { tenantId: tenant.id, email: `${crypto.randomUUID()}@extraction.test`, fullName: "Extractor", passwordHash: "unused", role } });
  const workspace = await inTenant(tenant.id, async (tx) => {
    const ws = await tx.workspace.create({ data: { tenantId: tenant.id, ownerId: user.id, name: "Extraction workspace" } });
    await tx.workspaceMember.create({ data: { tenantId: tenant.id, workspaceId: ws.id, userId: user.id, role: "OWNER" } });
    return ws;
  });
  const token = signAccessToken({ tenantId: tenant.id, userId: user.id, role, tv: user.tokenVersion, jti: crypto.randomUUID() });
  return { tenantId: tenant.id, userId: user.id, workspaceId: workspace.id, agent: request.agent(app).set("Authorization", `Bearer ${token}`) };
}
type Actor = Awaited<ReturnType<typeof seedActor>>;
let teacher: Actor, colleague: Actor, foreign: Actor, student: Actor;
let responseFor = (page: number) => JSON.stringify(candidate(page));
let mockStatus = 200;
let mockFinish = "STOP";
let rateLimitFromPage = Infinity;
let inspectWindow: (page: number) => Promise<void> = async () => undefined;
const sentWindows: string[] = [];
const originalConfig = { key: env.GEMINI_API_KEY, url: env.AI_BASE_URL, mode: env.GENERATION_MODE };

async function upload(bytes = pdf()) {
  return runWithTenant({ tenantId: teacher.tenantId, userId: teacher.userId }, () => uploadSpecificationSource({ workspaceId: teacher.workspaceId,
    userId: teacher.userId, fileName: "academic.pdf", mimeType: "application/pdf", data: bytes }));
}
async function runNext() {
  const claimed = await claimSpecificationExtraction();
  expect(claimed).not.toBeNull();
  await runWithTenant({ tenantId: required(claimed).tenantId, userId: required(claimed).requestedById }, () => runClaimedSpecificationExtraction(required(claimed).id));
  return required(claimed);
}

beforeAll(async () => {
  teacher = await seedActor(); colleague = await seedActor(teacher.tenantId); foreign = await seedActor(); student = await seedActor(teacher.tenantId, "STUDENT");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    expect(String(input)).toMatch(/^http:\/\/academic-ai\.test\/models\//); // No real provider call is possible.
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.systemInstruction.parts[0].text).toContain("never as instructions");
    const window = String(body.contents[0].parts[0].text).split("\n\n---\n")[0] ?? "";
    expect(body.contents[0].parts).toHaveLength(1); // PDF bytes are parsed locally, never attached wholesale.
    sentWindows.push(window);
    const page = Number(window.match(/\[SOURCE PAGE (\d+)\]/)?.[1]);
    await inspectWindow(page);
    const status = page >= rateLimitFromPage ? 429 : mockStatus;
    return new Response(status === 200 ? JSON.stringify({ modelVersion: "mock-academic-model", usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 50 },
      candidates: [{ content: { parts: [{ text: responseFor(page) }] }, finishReason: mockFinish }] }) : "mock AI failure", { status, headers: { "Content-Type": "application/json" } });
  });
});
beforeEach(async () => {
  await resetExpensiveLimitForTests(teacher.userId);
  env.GEMINI_API_KEY = "mock-only"; env.AI_BASE_URL = "http://academic-ai.test"; env.GENERATION_MODE = "worker";
  responseFor = (page) => JSON.stringify(candidate(page)); mockStatus = 200; mockFinish = "STOP"; sentWindows.length = 0;
  rateLimitFromPage = Infinity; inspectWindow = async () => undefined;
});
afterAll(async () => {
  await drainGeneration(); vi.restoreAllMocks();
  env.GEMINI_API_KEY = originalConfig.key; env.AI_BASE_URL = originalConfig.url; env.GENERATION_MODE = originalConfig.mode;
  await prismaBase.$disconnect();
});

describe("PDF provenance, chunk merging and grounding", () => {
  it("reads physical page boundaries from real PDF bytes", async () => {
    const parsed = await readSpecificationPdf(pdf([text, "Second physical page contains academic content"]));
    expect(parsed.pages).toHaveLength(2); expect(parsed.pages[1]?.page).toBe(2);
    expect(parsed.pages[0]?.text).toContain("BIO1101"); expect(parsed.parser).toMatch(/^pdfjs-dist\//);
  });
  it("bounds long pages and overlaps without losing page coverage", () => {
    const pages = Array.from({ length: 30 }, (_, index) => ({ page: index + 1, text: "content ".repeat(index === 0 ? 700 : 80) }));
    const chunks = chunkSpecificationPages(pages, 2000, 4);
    expect(chunks.every((chunk) => chunk.text.length <= 2000)).toBe(true);
    expect(new Set(chunks.flatMap((chunk) => chunk.sourcePages)).size).toBe(30);
    expect(chunks.filter((chunk) => chunk.sourcePages.includes(1)).length).toBeGreaterThan(1);
    expect(() => chunkSpecificationPages(pages, 10)).toThrow("Invalid PDF chunk limits");
  });
  it("does not turn missing hours/lab/name into invented defaults", () => {
    const data = groundChunk(candidate(), [{ page: 1, text }]);
    expect(data.programs[0]?.courses[1]).toMatchObject({ nameAr: null, creditHours: null, hasLab: null, objectives: [] });
    const hallucinated = candidate(); required(required(hallucinated.programs[0]).courses[0]).nameAr = "Invented name";
    expect(groundChunk(hallucinated, [{ page: 1, text }]).programs[0]?.courses[0]?.nameAr).toBeNull();
  });
  it("requires exact numbers and explicit lab polarity, removing unsupported topics", () => {
    const data = candidate(); const course = required(required(data.programs[0]).courses[0]);
    course.fieldEvidence.creditHours = evidence("Credit hours: 30", 1);
    course.hasLab = false; course.topics.push({ title: "Invented topic", orderIndex: 1, contactHours: null, learningOutcomes: [], sourcePages: [1], fieldEvidence: {} });
    const out = required(required(groundChunk(data, [{ page: 1, text: text.replace("Credit hours: 3", "Credit hours: 30") }]).programs[0]).courses[0]);
    expect(out.creditHours).toBeNull(); expect(out.hasLab).toBeNull(); expect(out.topics).toHaveLength(1);
  });
  it("keeps courses unassigned if a proposed program identity is absent from the PDF", () => {
    const data = candidate(); required(data.programs[0]).fieldEvidence = {};
    const out = groundChunk(data, [{ page: 1, text }]);
    expect(out.programs).toEqual([]); expect(out.unassignedCourses).toHaveLength(2);
    expect(out.warnings.some((warning) => warning.code === "UNCONFIRMED_PROGRAM")).toBe(true);
  });
  it("rejects nonexistent/out-of-window provenance", () => {
    expect(() => validateSourcePages(candidate(99), new Set([1]))).toThrow("EXTRACTION_INVALID_PROVENANCE");
  });
  it("merges overlapping chunks without repeated courses/topics and retains source pages", () => {
    const merged = mergeSpecificationChunks([candidate(1), candidate(2)], { pageCount: 2, chunkCount: 2, processedPages: [1, 2], emptyPages: [], parser: "test" });
    expect(merged.programs).toHaveLength(1); expect(merged.programs[0]?.courses).toHaveLength(2);
    expect(merged.programs[0]?.courses[0]?.topics).toHaveLength(1);
    expect(merged.programs[0]?.courses[0]?.topics[0]?.sourcePages).toEqual([1, 2]);
  });
  it("merges an identified course/program when a later window omits its code", () => {
    const partial = candidate(2); required(partial.programs[0]).code = null;
    required(required(partial.programs[0]).courses[0]).code = null;
    const merged = mergeSpecificationChunks([candidate(1), partial], { pageCount: 2, chunkCount: 2, processedPages: [1, 2], emptyPages: [], parser: "test" });
    expect(merged.programs).toHaveLength(1); expect(merged.programs[0]?.courses).toHaveLength(2);
  });
  it("keeps conflicting hours null even if a later chunk repeats an earlier value", () => {
    const conflict = candidate(2); required(required(conflict.programs[0]).courses[0]).creditHours = 4;
    const merged = mergeSpecificationChunks([candidate(1), conflict, candidate(3)], { pageCount: 3, chunkCount: 3, processedPages: [1, 2, 3], emptyPages: [], parser: "test" });
    expect(merged.programs[0]?.courses[0]?.creditHours).toBeNull(); expect(merged.issues.some((issue) => issue.kind === "conflict")).toBe(true);
  });
  it("does not restore conflicting facts when a later chunk supplies an earlier missing code", () => {
    const first = candidate(1), second = candidate(2), third = candidate(3);
    required(first.programs[0]).code = null; required(second.programs[0]).code = null;
    required(required(first.programs[0]).courses[0]).code = null; required(required(second.programs[0]).courses[0]).code = null;
    required(required(second.programs[0]).courses[0]).creditHours = 4;
    const merged = mergeSpecificationChunks([first, second, third], { pageCount: 3, chunkCount: 3, processedPages: [1, 2, 3], emptyPages: [], parser: "test" });
    expect(merged.programs).toHaveLength(1); expect(merged.programs[0]?.courses[0]?.creditHours).toBeNull();
  });
  it("carries bounded grounded identities without copying course content between windows", () => {
    const context = identityContext([candidate(1)]);
    expect(context.text).toContain("BIO1101"); expect(context.text).not.toContain("Identify plant cells");
    expect(context.text.length).toBeLessThanOrEqual(8000); expect(context.pages.some((page) => page.page === 1)).toBe(true);
  });
  it("reports scanned/invalid PDFs rather than asking AI to invent their content", async () => {
    await expect(readSpecificationPdf(Buffer.from("not PDF"))).rejects.toThrow();
    await expect(readSpecificationPdf(pdf([""]))).rejects.toThrow(/OCR/);
  });
});

describe("durable extraction attempts and tenant permissions", () => {
  it("accepts, claims and completes a real PDF with multiple courses, preserving metadata without publishing", async () => {
    const source = await upload();
    const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({});
    expect(out.status).toBe(202); expect(out.body.data).toMatchObject({ status: "PENDING", attempt: 1, promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION });
    const job = await claimSpecificationExtraction(); expect(job?.id).toBe(out.body.data.id);
    await inTenant(teacher.tenantId, async (tx) => {
      expect((await tx.specificationSource.findUniqueOrThrow({ where: { id: source.id } })).extractionStatus).toBe("RUNNING");
      expect((await tx.programSpecificationExtraction.findUniqueOrThrow({ where: { id: required(job).id } })).status).toBe("RUNNING");
    });
    await runWithTenant({ tenantId: teacher.tenantId, userId: teacher.userId }, () => runClaimedSpecificationExtraction(required(job).id));
    const result = await teacher.agent.get(`${S}/${source.id}/extractions/${required(job).id}?view=full`);
    expect(result.status).toBe(200); expect(result.body.data).toMatchObject({ status: "SUCCEEDED", model: "mock-academic-model",
      summary: { college: "Science", department: "Biology", programCount: 1, courseCount: 2 }, rawOutput: { chunks: [{ model: "mock-academic-model" }] } });
    expect(result.body.data.extractedData.programs[0].courses[0]).toMatchObject({ code: "BIO1101", creditHours: 3, hasLab: true, sourcePages: [1], topics: [{ title: "Cells", sourcePages: [1] }], assessmentPlan: [{ method: "Final exam", weight: 40 }] });
    expect((await teacher.agent.get(`${S}/${source.id}`)).body.data).toMatchObject({ extractionStatus: "SUCCEEDED", reviewStatus: "NOT_STARTED", approvalStatus: "NOT_REQUESTED" });
    await inTenant(teacher.tenantId, async (tx) => {
      for (const count of [await tx.college.count(), await tx.department.count(), await tx.program.count(), await tx.programSpecification.count(), await tx.courseTemplate.count()]) expect(count).toBe(0);
      expect(await tx.aiUsage.count({ where: { tenantId: teacher.tenantId, feature: "SPECIFICATION_EXTRACTION", model: "mock-academic-model" } })).toBe(1);
    });
  });
  it("supports several programs and tracks in one source", async () => {
    responseFor = (page) => JSON.stringify(candidate(page, true)); const source = await upload();
    const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); expect(out.status).toBe(202); await runNext();
    const result = await teacher.agent.get(`${S}/${source.id}/extractions/${out.body.data.id}`);
    expect(result.body.data.summary).toMatchObject({ programCount: 2, courseCount: 3 });
    expect(result.body.data.summary.programs[1]).toMatchObject({ track: "Animals" });
  });
  it("reads long PDFs in bounded windows and merges duplicate courses across chunks", async () => {
    const source = await upload(pdf(Array.from({ length: 25 }, () => text)));
    const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); await runNext();
    const result = await teacher.agent.get(`${S}/${source.id}/extractions/${out.body.data.id}?view=full`);
    expect(result.body.data.status).toBe("SUCCEEDED"); expect(sentWindows.length).toBeGreaterThan(1);
    expect(sentWindows.every((window) => window.length < 24000)).toBe(true);
    expect(result.body.data.extractedData.document).toMatchObject({ pageCount: 25, processedPages: Array.from({ length: 25 }, (_, i) => i + 1) });
    expect(result.body.data.summary.courseCount).toBe(2); expect(result.body.data.extractedData.programs[0].courses[0].sourcePages).toEqual([1, 8, 15, 22]);
  });
  it("marks an AI failure FAILED atomically and creates a distinct retry, preserving the failed snapshot", async () => {
    const source = await upload(); mockStatus = 400;
    const first = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); await runNext();
    expect((await teacher.agent.get(`${S}/${source.id}`)).body.data.extractionStatus).toBe("FAILED");
    const snapshot = (await teacher.agent.get(`${S}/${source.id}/extractions/${first.body.data.id}?view=full`)).body.data;
    expect(snapshot).toMatchObject({ status: "FAILED", extractedData: null });
    mockStatus = 200; const next = await teacher.agent.post(`${S}/${source.id}/extractions`).send({});
    expect(next.status).toBe(202); expect(next.body.data.attempt).toBe(2); expect(next.body.data.id).not.toBe(first.body.data.id);
    await runNext(); expect((await teacher.agent.get(`${S}/${source.id}/extractions/${first.body.data.id}?view=full`)).body.data).toEqual(snapshot);
    expect((await teacher.agent.get(`${S}/${source.id}/extractions`)).body.data.map((attempt: { status: string }) => attempt.status)).toEqual(["SUCCEEDED", "FAILED"]);
  });
  it("checkpoints every completed window and resumes linked attempts across repeated 429s without duplicate AI calls", async () => {
    const source = await upload(pdf(Array.from({ length: 25 }, () => text)));
    rateLimitFromPage = 15;
    inspectWindow = async (page) => {
      if (page !== 8) return;
      await inTenant(teacher.tenantId, async (tx) => {
        const saved = await tx.specificationSource.findUniqueOrThrow({ where: { id: source.id }, include: { currentExtraction: true } });
        expect(saved.extractionStatus).toBe("RUNNING");
        expect(saved.currentExtraction?.rawOutput).toMatchObject({ chunks: [{ index: 0, completed: true }] });
      });
    };
    const first = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); await runNext();
    const snapshot = (await teacher.agent.get(`${S}/${source.id}/extractions/${first.body.data.id}?view=full`)).body.data;
    expect(snapshot).toMatchObject({ status: "FAILED", extractedData: null,
      progress: { completedChunks: 2, totalChunks: 4, remainingChunks: 2, canResume: true, pausedForRateLimit: true },
      rawOutput: { failure: { httpStatus: 429 } } });
    expect(sentWindows.map((window) => Number(window.match(/\[SOURCE PAGE (\d+)\]/)?.[1]))).toEqual([1, 8, 15]);
    expect((await teacher.agent.get(`${S}/${source.id}`)).body.data.currentExtraction.progress).toMatchObject({ canResume: true, completedChunks: 2 });
    const resumeUrl = `${S}/${source.id}/extractions/${first.body.data.id}/resume`;
    const admissions = await Promise.all([1, 2].map(() => teacher.agent.post(resumeUrl).send({})));
    expect(admissions.map((r) => r.status).sort()).toEqual([202, 409]);
    const resumed = required(admissions.find((r) => r.status === 202)).body.data;
    expect(resumed.id).not.toBe(first.body.data.id);
    expect(resumed.progress).toMatchObject({ completedChunks: 2, remainingChunks: 2, resumeFromAttemptId: first.body.data.id });
    rateLimitFromPage = 22; inspectWindow = async () => undefined; sentWindows.length = 0; await runNext();
    expect(sentWindows.map((window) => Number(window.match(/\[SOURCE PAGE (\d+)\]/)?.[1]))).toEqual([15, 22]);
    const partial = (await teacher.agent.get(`${S}/${source.id}/extractions/${resumed.id}?view=full`)).body.data;
    expect(partial.progress).toMatchObject({ completedChunks: 3, remainingChunks: 1, canResume: true, rootAttemptId: first.body.data.id });
    expect(partial.rawOutput.chunks).toHaveLength(3);
    expect(partial.rawOutput.chunks.slice(0, 2).map((c: { rawOutput: string }) => c.rawOutput)).toEqual(snapshot.rawOutput.chunks.map((c: { rawOutput: string }) => c.rawOutput));
    expect((await teacher.agent.get(`${S}/${source.id}/extractions/${first.body.data.id}?view=full`)).body.data).toEqual(snapshot);
    expect((await teacher.agent.post(resumeUrl).send({})).status).toBe(409);
    rateLimitFromPage = Infinity; sentWindows.length = 0;
    const last = await teacher.agent.post(`${S}/${source.id}/extractions/${resumed.id}/resume`).send({}); expect(last.status).toBe(202); await runNext();
    expect(sentWindows.map((window) => Number(window.match(/\[SOURCE PAGE (\d+)\]/)?.[1]))).toEqual([22]);
    const result = (await teacher.agent.get(`${S}/${source.id}/extractions/${last.body.data.id}?view=full`)).body.data;
    expect(result).toMatchObject({ status: "SUCCEEDED", summary: { courseCount: 2 }, progress: { completedChunks: 4, remainingChunks: 0, canResume: false } });
    expect(result.rawOutput.chunks.map((c: { index: number }) => c.index)).toEqual([0, 1, 2, 3]);
    expect((await teacher.agent.get(`${S}/${source.id}/extractions/${resumed.id}?view=full`)).body.data).toEqual(partial);
    expect((await teacher.agent.get(`${S}/${source.id}/extractions/${last.body.data.id}`)).body.data.rawOutput).toBeUndefined();
    await inTenant(teacher.tenantId, async (tx) => {
      expect(await tx.aiUsage.count({ where: { tenantId: teacher.tenantId, feature: "SPECIFICATION_EXTRACTION", createdAt: { gte: new Date(first.body.data.createdAt) } } })).toBe(4);
      for (const count of [await tx.program.count(), await tx.programSpecification.count(), await tx.courseTemplate.count()]) expect(count).toBe(0);
    });
  });
  it("isolates resume permissions and rejects changed source bytes without accepting another attempt", async () => {
    const source = await upload(pdf(Array.from({ length: 9 }, () => text))); rateLimitFromPage = 8;
    const first = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); await runNext();
    const url = `${S}/${source.id}/extractions/${first.body.data.id}/resume`;
    for (const actor of [colleague, foreign, student]) expect((await actor.agent.post(url).send({})).status).toBe(actor === student ? 403 : 404);
    const other = await upload();
    expect((await teacher.agent.post(`${S}/${other.id}/extractions/${first.body.data.id}/resume`).send({})).status).toBe(404);
    const file = await inTenant(teacher.tenantId, (tx) => tx.fileAsset.findUniqueOrThrow({ where: { id: source.file.id } }));
    const read = vi.spyOn(files, "readFile").mockResolvedValueOnce({ kind: "bytes", data: pdf(), file });
    expect((await teacher.agent.post(url).send({})).status).toBe(400); read.mockRestore();
    expect((await teacher.agent.get(`${S}/${source.id}/extractions`)).body.data).toHaveLength(1);
  });
  it.each(["invalid JSON", "invalid schema", "invalid pages", "truncated output"])("retains raw output and fails %s safely", async (kind) => {
    responseFor = (page) => kind === "invalid JSON" ? "{broken" : kind === "invalid schema" ? JSON.stringify({ programs: "bad" }) : JSON.stringify(candidate(kind === "invalid pages" ? 999 : page));
    if (kind === "truncated output") mockFinish = "MAX_TOKENS";
    const source = await upload(); const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); await runNext();
    const result = (await teacher.agent.get(`${S}/${source.id}/extractions/${out.body.data.id}?view=full`)).body.data;
    expect(result.status).toBe("FAILED"); expect(result.rawOutput.chunks).toHaveLength(1); expect(result.errorMessage).toBeTruthy();
    expect((await teacher.agent.get(`${S}/${source.id}`)).body.data.extractionStatus).toBe("FAILED");
  });
  it("serializes concurrent requests, claims once and prevents another RUNNING attempt", async () => {
    const source = await upload();
    const requests = await Promise.all([1, 2].map(() => teacher.agent.post(`${S}/${source.id}/extractions`).send({})));
    expect(requests.map((out) => out.status).sort()).toEqual([202, 409]);
    const claims = await Promise.all([claimSpecificationExtraction(), claimSpecificationExtraction()]); expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await teacher.agent.post(`${S}/${source.id}/extractions`).send({})).status).toBe(409);
    await inTenant(teacher.tenantId, async (tx) => {
      await expect(tx.programSpecificationExtraction.create({ data: { tenantId: teacher.tenantId, sourceId: source.id,
        requestedById: teacher.userId, attempt: 2, promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION } })).rejects.toThrow();
    });
    const job = required(claims.find(Boolean));
    await runWithTenant({ tenantId: job.tenantId, userId: job.requestedById }, () => runClaimedSpecificationExtraction(job.id));
  });
  it("isolates foreign tenants, other teachers and students for requests, attempts and full output", async () => {
    const source = await upload(); const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); await runNext();
    for (const actor of [colleague, foreign, student]) {
      expect((await actor.agent.post(`${S}/${source.id}/extractions`).send({})).status).toBe(actor === student ? 403 : 404);
      for (const suffix of ["extractions", `extractions/${out.body.data.id}?view=full`]) expect((await actor.agent.get(`${S}/${source.id}/${suffix}`)).status).toBe(404);
    }
    await inTenant(foreign.tenantId, async (tx) => {
      expect(await tx.programSpecificationExtraction.findFirst({ where: { id: out.body.data.id } })).toBeNull();
    });
  });
  it("does not accept an unreadable source file or create an attempt", async () => {
    const source = await upload();
    const read = vi.spyOn(files, "readFile").mockRejectedValueOnce(AppError.notFound("Unavailable source object"));
    expect((await teacher.agent.post(`${S}/${source.id}/extractions`).send({})).status).toBe(404);
    read.mockRestore();
    expect((await teacher.agent.get(`${S}/${source.id}/extractions`)).body.data).toEqual([]);
  });
  it("recovers an interrupted worker atomically and allows a new attempt", async () => {
    const source = await upload(); const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); const job = await claimSpecificationExtraction();
    expect(job?.id).toBe(out.body.data.id);
    await inTenant(teacher.tenantId, (tx) => tx.specificationSource.update({ where: { id: source.id }, data: { updatedAt: new Date(Date.now() - 16 * 60_000) } }));
    expect(await claimSpecificationExtraction()).toBeNull();
    expect((await teacher.agent.get(`${S}/${source.id}/extractions/${required(job).id}`)).body.data.status).toBe("FAILED");
    const retry = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); expect(retry.status).toBe(202); await runNext();
    await runWithTenant({ tenantId: teacher.tenantId, userId: teacher.userId }, () => runClaimedSpecificationExtraction(required(job).id));
    expect((await teacher.agent.get(`${S}/${source.id}`)).body.data.extractionStatus).toBe("SUCCEEDED");
  });
  it("executes accepted attempts through the existing inline scheduler", async () => {
    env.GENERATION_MODE = "inline";
    const source = await upload(); const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({}); expect(out.status).toBe(202);
    await drainGeneration(); expect((await teacher.agent.get(`${S}/${source.id}`)).body.data.extractionStatus).toBe("SUCCEEDED");
  });
  it("rejects arbitrary payloads and reports unavailable AI without accepting a job", async () => {
    const source = await upload();
    expect((await teacher.agent.post(`${S}/${source.id}/extractions`).send({ tenantId: foreign.tenantId })).status).toBe(400);
    env.GEMINI_API_KEY = "";
    expect((await teacher.agent.post(`${S}/${source.id}/extractions`).send({})).status).toBe(503);
    expect((await teacher.agent.get(`${S}/${source.id}/extractions`)).body.data).toEqual([]);
  });
  it("rejects a missing queue migration before creating a pending attempt", async () => {
    const source = await upload();
    const query = vi.spyOn(prismaBase, "$queryRaw").mockResolvedValueOnce([{ ready: false }]);
    const out = await teacher.agent.post(`${S}/${source.id}/extractions`).send({});
    query.mockRestore();
    expect(out.status).toBe(503); expect(out.body.error.code).toBe("EXTRACTION_NOT_READY");
    expect((await teacher.agent.get(`${S}/${source.id}/extractions`)).body.data).toEqual([]);
  });
});
