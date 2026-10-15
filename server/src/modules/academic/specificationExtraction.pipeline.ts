import crypto from "node:crypto";
import { AppError } from "../../lib/AppError.js";
import { extractStructuredJson, newMeter } from "../generation/engine.js";
import { assertBudget, recordUsage } from "../platform/aiBudget.js";
import { EXTRACTION_FORMAT, extractedSpecificationSchema, specificationChunkSchema,
  SPECIFICATION_PROMPT_VERSION, SPECIFICATION_SCHEMA_VERSION, specificationResponseSchemaForPages, type SpecificationChunk } from "./specificationExtraction.schema.js";
import { groundChunk, mergeSpecificationChunks, validateSourcePages } from "./specificationExtraction.merge.js";
import { chunkSpecificationPages, readSpecificationPdf, type SpecificationPage, type SpecificationTextChunk } from "./specificationPdf.js";
import { completedExtractionChunks, type ExtractionTrace } from "./specificationExtraction.progress.js";
export type { ExtractionTrace } from "./specificationExtraction.progress.js";

export function newExtractionTrace(): ExtractionTrace {
  return { promptVersion: SPECIFICATION_PROMPT_VERSION, schemaVersion: SPECIFICATION_SCHEMA_VERSION,
    parser: null, pageCount: 0, chunkCount: 0, chunks: [] };
}

/** Only prior, grounded identities travel between windows. No course content or inferred parent is carried. */
export function identityContext(results: SpecificationChunk[]) {
  const entries: unknown[] = [];
  const pages: SpecificationPage[] = [];
  for (const chunk of results.slice(-2)) for (const program of chunk.programs.slice(-4)) {
    if (!program.name && !program.code) continue;
    const identity = { name: program.name, code: program.code, track: program.track, version: program.version,
      sourcePages: program.sourcePages, fieldEvidence: program.fieldEvidence,
      courses: program.courses.slice(-4).map((course) => ({ code: course.code, nameAr: course.nameAr, nameEn: course.nameEn,
        fieldEvidence: Object.fromEntries(Object.entries(course.fieldEvidence).filter(([key]) => ["code", "nameAr", "nameEn"].includes(key))) })) };
    const quotes = [identity.fieldEvidence, ...identity.courses.map((course) => course.fieldEvidence)];
    for (const evidence of quotes) for (const value of Object.values(evidence)) {
      for (const page of value.sourcePages) pages.push({ page, text: value.quote });
    }
    entries.push(identity);
  }
  // Identity context is bounded independently from document text.
  while (entries.length && JSON.stringify(entries).length > 8000) entries.shift();
  const text = JSON.stringify(entries);
  // Include only quotes still present in the bounded context.
  return { text, pages: pages.filter((page) => text.includes(JSON.stringify(page.text).slice(1, -1))) };
}

function chunkContext(chunk: SpecificationTextChunk, results: SpecificationChunk[]) {
  const context = identityContext(results);
  const identityPages = (JSON.parse(context.text) as { sourcePages: number[] }[]).flatMap((identity) => identity.sourcePages);
  const allowedPages = new Set([...chunk.sourcePages, ...context.pages.map((page) => page.page), ...identityPages]);
  const decode = (raw: string) => {
    const json = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = specificationChunkSchema.parse(JSON.parse(json));
    validateSourcePages(parsed, allowedPages);
    for (const course of [...parsed.programs.flatMap((p) => p.courses), ...parsed.unassignedCourses]) {
      for (const item of [...course.topics, ...course.learningOutcomes, ...course.assessmentPlan, ...course.references]) {
        if (!item.sourcePages.length || !item.sourcePages.every((page) => chunk.sourcePages.includes(page))) {
          throw new Error("EXTRACTION_INVALID_PROVENANCE: new content cites a page outside the current window");
        }
      }
    }
    const grounded = groundChunk(parsed, [...chunk.pages, ...context.pages]);
    for (const page of chunk.sourcePages) if (!grounded.programs.length && !grounded.unassignedCourses.length) {
      grounded.warnings.push({ code: "NO_ACADEMIC_ENTITIES", message: "لم تُستخرج برامج أو مقررات من هذه الدفعة؛ قد تكون الصفحات تمهيدية أو تحتاج فحصًا بشريًا", sourcePages: [page] });
    }
    return grounded;
  };
  return { context, allowedPages, decode };
}

/** Read-only compatibility check. No provider calls, writes or replacement of saved responses. */
export async function prepareSpecificationResume(data: Buffer, saved: ExtractionTrace, attemptId: string) {
  const document = await readSpecificationPdf(data);
  const chunks = chunkSpecificationPages(document.pages);
  const fileSha256 = crypto.createHash("sha256").update(data).digest("hex");
  if ((saved.fileSha256 && saved.fileSha256 !== fileSha256) || saved.parser !== document.parser
    || saved.pageCount !== document.pages.length || saved.chunkCount !== chunks.length) {
    throw AppError.conflict("الدفعات المحفوظة لا تطابق الملف أو تقسيمه الحالي؛ لن تُعاد الدفعات المكتملة تلقائيًا");
  }
  const completed = completedExtractionChunks(saved);
  if (!completed.length) throw AppError.conflict("لا توجد دفعات مكتملة قابلة للاستكمال");
  const results: SpecificationChunk[] = [];
  const recovered: ExtractionTrace["chunks"] = [];
  for (const chunk of chunks) {
    const cached = completed.find((item) => item.index === chunk.index);
    if (!cached) continue;
    const inputSha256 = crypto.createHash("sha256").update(chunk.text).digest("hex");
    if ((cached.inputSha256 && cached.inputSha256 !== inputSha256)
      || JSON.stringify(cached.sourcePages) !== JSON.stringify(chunk.sourcePages)) {
      throw AppError.conflict("تغيّر محتوى دفعة محفوظة؛ لم يبدأ أي استخراج جديد");
    }
    try { results.push(chunkContext(chunk, results).decode(cached.rawOutput)); }
    catch { throw AppError.conflict("تعذّر التحقق من دفعة محفوظة؛ لم تُحذف النتائج ولم يبدأ استخراج جديد"); }
    recovered.push({ ...cached, completed: true, inputSha256, reusedFromAttemptId: attemptId });
  }
  if (recovered.length !== completed.length) throw AppError.conflict("تعذّر مطابقة جميع الدفعات المحفوظة");
  return { ...newExtractionTrace(), parser: document.parser, pageCount: document.pages.length, chunkCount: chunks.length,
    fileSha256, resumeFromAttemptId: attemptId, rootAttemptId: saved.rootAttemptId ?? attemptId, chunks: recovered };
}

export async function extractSpecification(data: Buffer, actor: { tenantId: string; userId: string }, trace: ExtractionTrace,
  checkpoint: (persist?: boolean) => Promise<void> = async () => undefined,
  previous: { attemptId: string; trace: ExtractionTrace }[] = []) {
  const document = await readSpecificationPdf(data);
  const chunks = chunkSpecificationPages(document.pages);
  const fileSha256 = crypto.createHash("sha256").update(data).digest("hex");
  if (trace.fileSha256 && trace.fileSha256 !== fileSha256) throw AppError.conflict("تغيّر ملف المصدر؛ لا يمكن استكمال الدفعات المحفوظة");
  trace.fileSha256 = fileSha256;
  trace.parser = document.parser; trace.pageCount = document.pages.length; trace.chunkCount = chunks.length;
  const savedChunks = [...trace.chunks];
  const saveChunk = (saved: ExtractionTrace["chunks"][number]) => {
    const existing = trace.chunks.findIndex((item) => item.index === saved.index);
    if (existing < 0) trace.chunks.push(saved); else trace.chunks[existing] = saved;
    trace.chunks.sort((a, b) => a.index - b.index);
  };
  const results: SpecificationChunk[] = [];
  let rawChars = 0;
  await checkpoint(true);
  for (const chunk of chunks) {
    await checkpoint();
    const meter = newMeter();
    let model: string | undefined;
    try {
      const { context, allowedPages, decode } = chunkContext(chunk, results);
      const inputSha256 = crypto.createHash("sha256").update(chunk.text).digest("hex");
      const ownSaved = savedChunks.find((item) => item.index === chunk.index && item.completed === true);
      if (ownSaved) {
        if ((ownSaved.inputSha256 && ownSaved.inputSha256 !== inputSha256)
          || JSON.stringify(ownSaved.sourcePages) !== JSON.stringify(chunk.sourcePages)) throw AppError.conflict("تغيّر تقسيم دفعة محفوظة؛ توقّف الاستكمال دون إعادة استخراجها");
        results.push(decode(ownSaved.rawOutput)); rawChars += ownSaved.rawOutput.length;
        continue;
      }
      let reused = false;
      for (const prior of previous) {
        if (prior.trace.parser !== document.parser || prior.trace.pageCount !== document.pages.length || prior.trace.chunkCount !== chunks.length) continue;
        const saved = prior.trace.chunks.find((item) => item.index === chunk.index && item.finishReason === "STOP"
          && JSON.stringify(item.sourcePages) === JSON.stringify(chunk.sourcePages));
        if (!saved) continue;
        try {
          const grounded = decode(saved.rawOutput);
          results.push(grounded);
          saveChunk({ ...saved, completed: true, inputSha256, reusedFromAttemptId: prior.attemptId });
          rawChars += saved.rawOutput.length;
          reused = true;
          break;
        } catch { /* A saved response that fails current validation is extracted again, never accepted silently. */ }
      }
      if (reused) { await checkpoint(true); continue; }
      await assertBudget();
      const instructions = `Extract all facts from this bounded page window. New content must cite ${JSON.stringify(chunk.sourcePages)}.\n` +
        "Do not copy the example placeholders. Return empty arrays when a section is absent. Use null for missing code, name, hours, lab, level, version or track. " +
        "Never infer hasLab=false or creditHours=0 from absence. Preserve each program/track separately. " +
        "If a course cannot be associated with an explicitly identified program, put it in unassignedCourses, with a warning. " +
        "Prior grounded identities below may identify a continuing program/course only when continuity is explicit and unambiguous. " +
        "Reuse their exact identity evidence and page numbers, and append current sourcePages. Do not guess an association if multiple candidates fit. " +
        "Do not copy course content from prior pages; extract new content only from the current page window. " +
        "Topics and all courses/programs require sourcePages. Preserve assessment plan separately from operational grades. " +
        "Provide fieldEvidence for every non-null institution/college/department/program identity, course scalar, topic contactHours and assessment weight, using exact source phrases. " +
        "Copy textual descriptions, outcomes, topics, references and strategies verbatim; do not summarize or translate. " +
        "Course Title in English belongs in nameEn; nameAr remains null if no Arabic title is present. " +
        "Distinguish program version from individual course revision/version: put only an explicitly labeled program version in program.version. " +
        "orderIndex is the zero-based order of appearance, not an inferred curriculum week. Prior identities:\n" + context.text +
        "\nJSON shape:\n" + JSON.stringify(EXTRACTION_FORMAT);
      const response = await extractStructuredJson({ text: chunk.text, pdfs: [] }, instructions, meter,
        specificationResponseSchemaForPages([...allowedPages], chunk.sourcePages));
      model = response.model;
      saveChunk({ index: chunk.index, sourcePages: chunk.sourcePages, inputSha256, completed: false, ...response });
      await checkpoint(true);
      rawChars += response.rawOutput.length;
      if (rawChars > 12_000_000) throw AppError.badRequest("نتيجة الاستخراج تجاوزت الحد الحالي؛ قسّم الملف إلى أجزاء");
      if (response.finishReason === "MAX_TOKENS") throw AppError.badRequest("رد الاستخراج غير مكتمل؛ أعد المحاولة بملف أصغر");
      const grounded = decode(response.rawOutput);
      results.push(grounded);
      saveChunk({ index: chunk.index, sourcePages: chunk.sourcePages, inputSha256, completed: true, ...response });
      await checkpoint(true);
    } finally {
      // Count billable responses even when subsequent parsing or grounding fails.
      if (meter.input || meter.output || meter.audio) await recordUsage({ ...actor, feature: "SPECIFICATION_EXTRACTION", model, meter });
    }
  }
  const merged = mergeSpecificationChunks(results, {
    pageCount: document.pages.length, chunkCount: chunks.length, parser: document.parser,
    processedPages: document.pages.filter((p) => p.text.trim()).map((p) => p.page),
    emptyPages: document.pages.filter((p) => !p.text.trim()).map((p) => p.page),
  });
  if (merged.document.emptyPages.length) merged.warnings.push({ code: "PAGES_WITHOUT_TEXT",
    message: "بعض الصفحات لا تحتوي نصًا قابلًا للاستخراج؛ الصور والمحتوى الممسوح يحتاجان OCR أو مراجعة الملف",
    sourcePages: merged.document.emptyPages });
  return extractedSpecificationSchema.parse(merged);
}
