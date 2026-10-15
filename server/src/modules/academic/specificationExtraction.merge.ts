import { extractedSpecificationSchema, specificationChunkSchema, type ExtractedCourse, type SpecificationChunk } from "./specificationExtraction.schema.js";
import type { SpecificationPage } from "./specificationPdf.js";

type Issue = SpecificationChunk["issues"][number];
const normalized = (s: string) => s.normalize("NFKC").replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\p{M}/gu, "")
  .replace(/[٠-٩]/g, (n) => String("٠١٢٣٤٥٦٧٨٩".indexOf(n))).replace(/\s+/g, " ").trim().toLowerCase();
const codeKey = (s: string | null) => normalized(s ?? "").replace(/\s+/g, "");
const unionPages = (a: number[], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y);

/** Reject fabricated/out-of-window page numbers before any candidate becomes a successful result. */
export function validateSourcePages(chunk: SpecificationChunk, allowed: Set<number>) {
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const object = value as Record<string, unknown>;
    if (Array.isArray(object.sourcePages) && object.sourcePages.some((p) => typeof p !== "number" || !allowed.has(p))) {
      throw new Error("EXTRACTION_INVALID_PROVENANCE: response cites a page outside the supplied window");
    }
    for (const child of Object.values(object)) visit(child);
  }
  visit(chunk);
}

/** Critical scalar facts need a verbatim quote; unsupported proposals remain in issues, never as facts. */
export function groundChunk(chunk: SpecificationChunk, pages: SpecificationPage[]): SpecificationChunk {
  const result = specificationChunkSchema.parse(chunk);
  const byPage = new Map<number, string>();
  for (const page of pages) byPage.set(page.page, `${byPage.get(page.page) ?? ""}\n${normalized(page.text)}`);
  function scalar(object: Record<string, unknown>, field: string, entityName: string | null) {
    const value = object[field];
    if (value === null || value === undefined) return;
    const evidence = (object.fieldEvidence as Record<string, { quote: string; sourcePages: number[] }>)[field];
    const quote = evidence ? normalized(evidence.quote) : "";
    const supported = !!evidence?.sourcePages.length && evidence.sourcePages.every((p) => byPage.has(p))
      && evidence.sourcePages.some((p) => byPage.get(p)?.includes(quote))
      && (typeof value === "string" ? quote.includes(normalized(value))
        : typeof value === "number" ? new RegExp(`(^|[^\\d.])${String(value).replace(".", "\\.")}([^\\d.]|$)`).test(quote)
          : typeof value === "boolean" && /lab|practical|معمل|مختبر|عملي/.test(quote));
    const meaningful = field !== "creditHours" || /credit|hour|unit|ساعة|ساعات|وحدات|معتمد/.test(quote);
    const negativeLab = /no lab|without lab|بدون معمل|لا يوجد معمل|لا معمل|عملي\s*[:：]?\s*0|lab\s*[:：]?\s*(0|no|false)|معمل\s*[:：]?\s*(0|لا)/.test(quote);
    const positiveLab = /lab\s*[:：]?\s*(yes|true|[1-9])|practical\s*[:：]?\s*[1-9]|معمل\s*[:：]?\s*(نعم|[1-9])|عملي\s*[:：]?\s*[1-9]|يتضمن معمل|includes? (a )?lab/.test(quote);
    if (!supported || !meaningful || (field === "hasLab" && (value === true ? negativeLab || !positiveLab : !negativeLab))) {
      object[field] = null;
      result.issues.push({ kind: "uncertain", entity: entityName, field,
        message: "لم تتوفر عبارة مصدر قابلة للتحقق لهذه القيمة؛ تُركت غير مؤكدة", values: [String(value)],
        sourcePages: evidence?.sourcePages ?? (object.sourcePages as number[]) });
    }
  }
  function literal(value: string, sourcePages: number[], entityName: string | null, field: string) {
    if (sourcePages.some((page) => byPage.get(page)?.includes(normalized(value)))) return true;
    result.issues.push({ kind: "uncertain", entity: entityName, field, message: "لم يرد النص المقترح في الصفحات المحددة؛ لم يُعتمد ضمن البيانات المستخرجة",
      values: [value], sourcePages });
    return false;
  }
  for (const label of ["institution", "college", "department"] as const) {
    const entity = result[label];
    if (entity) for (const field of ["name", "code"]) scalar(entity, field, label);
  }
  for (const program of result.programs) {
    for (const field of ["name", "code", "track", "version"]) scalar(program, field, program.name ?? program.code);
    for (const entity of [program.college, program.department]) if (entity) {
      for (const field of ["name", "code"]) scalar(entity, field, program.name ?? program.code);
    }
  }
  result.programs = result.programs.filter((program) => {
    if (program.name || program.code) return true;
    result.unassignedCourses.push(...program.courses);
    result.warnings.push({ code: "UNCONFIRMED_PROGRAM", message: "لم تتوفر هوية برنامج مؤكدة؛ احتُفظ بمقرراته منفصلة للمراجعة", sourcePages: program.sourcePages });
    return false;
  });
  for (const course of [...result.programs.flatMap((p) => p.courses), ...result.unassignedCourses]) {
    for (const field of ["code", "nameAr", "nameEn", "creditHours", "hasLab", "level", "year", "requirement"]) {
      // Enum translation is retained only with source evidence, without requiring the English enum in an Arabic file.
      if (field === "requirement" && course.requirement) {
        const e = course.fieldEvidence.requirement;
        const quote = normalized(e?.quote ?? "");
        if (e?.sourcePages.some((p) => byPage.get(p)?.includes(quote)) &&
          (course.requirement === "REQUIRED" ? /required|mandatory|إجباري|اجباري|متطلب/.test(quote) : /elective|اختياري/.test(quote))) continue;
      }
      scalar(course, field, course.code ?? course.nameAr ?? course.nameEn);
    }
    if (!course.sourcePages.length) throw new Error("EXTRACTION_INVALID_PROVENANCE: course has no source pages");
    const name = course.code ?? course.nameAr ?? course.nameEn;
    if (course.description && !literal(course.description, course.sourcePages, name, "description")) course.description = null;
    for (const field of ["objectives", "prerequisites", "corequisites", "teachingStrategies"] as const) {
      course[field] = course[field].filter((value) => literal(value, course.sourcePages, name, field));
    }
    course.learningOutcomes = course.learningOutcomes.filter((outcome) => literal(outcome.description, outcome.sourcePages, name, "learningOutcomes"));
    course.references = course.references.filter((reference) => literal(reference.citation, reference.sourcePages, name, "references"));
    course.topics = course.topics.filter((topic) => literal(topic.title, topic.sourcePages, name, "topics.title"));
    for (const topic of course.topics) {
      if (!topic.sourcePages.length) throw new Error("EXTRACTION_INVALID_PROVENANCE: topic has no source pages");
      scalar(topic, "contactHours", name);
      topic.learningOutcomes = topic.learningOutcomes.filter((value) => literal(value, course.sourcePages, name, "topics.learningOutcomes"));
    }
    for (const assessment of course.assessmentPlan) {
      scalar(assessment, "weight", name);
      if (assessment.method && !literal(assessment.method, assessment.sourcePages, name, "assessmentPlan.method")) assessment.method = null;
      if (assessment.timing && !literal(assessment.timing, assessment.sourcePages, name, "assessmentPlan.timing")) assessment.timing = null;
    }
    for (const field of ["code", "nameAr", "creditHours", "hasLab"] as const) if (course[field] === null) {
      result.issues.push({ kind: "missing", entity: course.code ?? course.nameAr ?? course.nameEn, field,
        message: "هذه المعلومة غير متاحة أو غير مؤكدة في صفحات المصدر", values: [], sourcePages: course.sourcePages });
    }
  }
  for (const program of result.programs) if (!program.sourcePages.length) {
    throw new Error("EXTRACTION_INVALID_PROVENANCE: program has no source pages");
  }
  return result;
}

function uniqueStrings(a: string[], b: string[]) {
  const values = new Map(a.map((v) => [normalized(v), v]));
  for (const value of b) if (!values.has(normalized(value))) values.set(normalized(value), value);
  return [...values.values()];
}

export function mergeSpecificationChunks(chunks: SpecificationChunk[], document: { pageCount: number; chunkCount: number; processedPages: number[]; emptyPages: number[]; parser: string }) {
  const result = specificationChunkSchema.parse({});
  const conflicted = new Set<string>();
  const courseIdentities = new WeakMap<ExtractedCourse, string>();
  let courseSequence = 0;
  function scalar<T>(a: T | null, b: T | null, field: string, entity: string | null, pages: number[]): T | null {
    const key = `${entity}:${field}`;
    if (conflicted.has(key)) return null;
    if (a === null) return b;
    if (b === null) return a;
    const equal = typeof a === "string" && typeof b === "string" ? normalized(a) === normalized(b) : a === b;
    if (equal) return a;
    conflicted.add(key);
    const issue: Issue = { kind: "conflict", entity, field, message: "ظهرت قيم متعارضة في صفحات الملف؛ لم تُحسم تلقائيًا",
      values: [String(a), String(b)], sourcePages: pages };
    result.issues.push(issue);
    return null;
  }
  function mergeEntity(a: SpecificationChunk["college"], b: SpecificationChunk["college"], label: string) {
    if (!a) return b;
    if (!b) return a;
    const pages = unionPages(a.sourcePages, b.sourcePages);
    return { name: scalar(a.name, b.name, `${label}.name`, label, pages), code: scalar(a.code, b.code, `${label}.code`, label, pages),
      sourcePages: pages, fieldEvidence: { ...a.fieldEvidence, ...b.fieldEvidence } };
  }
  function mergeCourse(a: ExtractedCourse, b: ExtractedCourse, parent: string) {
    let entity = courseIdentities.get(a);
    if (!entity) { entity = `${parent}/course:${courseSequence++}`; courseIdentities.set(a, entity); }
    const pages = unionPages(a.sourcePages, b.sourcePages);
    for (const field of ["code", "nameAr", "nameEn", "creditHours", "hasLab", "level", "year", "requirement", "description"] as const) {
      if (field === "code" && a.code && b.code && codeKey(a.code) === codeKey(b.code)) continue;
      const value = scalar<unknown>(a[field], b[field], field, entity, pages);
      Object.assign(a, { [field]: value });
    }
    for (const field of ["objectives", "prerequisites", "corequisites", "teachingStrategies"] as const) a[field] = uniqueStrings(a[field], b[field]);
    for (const outcome of b.learningOutcomes) {
      const same = a.learningOutcomes.find((x) => normalized(x.description) === normalized(outcome.description) && codeKey(x.code) === codeKey(outcome.code));
      if (same) same.sourcePages = unionPages(same.sourcePages, outcome.sourcePages); else a.learningOutcomes.push(outcome);
    }
    for (const topic of b.topics) {
      const same = a.topics.find((x) => normalized(x.title) === normalized(topic.title));
      if (same) {
        same.contactHours = scalar(same.contactHours, topic.contactHours, `topics.${normalized(topic.title)}.contactHours`, entity, unionPages(same.sourcePages, topic.sourcePages));
        same.sourcePages = unionPages(same.sourcePages, topic.sourcePages);
        same.learningOutcomes = uniqueStrings(same.learningOutcomes, topic.learningOutcomes);
      } else a.topics.push(topic);
    }
    for (const assessment of b.assessmentPlan) {
      const same = a.assessmentPlan.find((x) => normalized(x.method ?? "") === normalized(assessment.method ?? "") && x.timing === assessment.timing);
      if (same) {
        same.weight = scalar(same.weight, assessment.weight, `assessment.${normalized(assessment.method ?? "")}.weight`, entity, unionPages(same.sourcePages, assessment.sourcePages));
        same.sourcePages = unionPages(same.sourcePages, assessment.sourcePages);
        same.outcomeCodes = uniqueStrings(same.outcomeCodes, assessment.outcomeCodes);
      } else a.assessmentPlan.push(assessment);
    }
    for (const reference of b.references) {
      const same = a.references.find((x) => normalized(x.citation) === normalized(reference.citation));
      if (same) same.sourcePages = unionPages(same.sourcePages, reference.sourcePages); else a.references.push(reference);
    }
    a.sourcePages = pages; a.fieldEvidence = { ...a.fieldEvidence, ...b.fieldEvidence };
  }
  function addCourse(courses: ExtractedCourse[], incoming: ExtractedCourse, parent: string) {
    const same = courses.find((c) => incoming.code && c.code ? codeKey(c.code) === codeKey(incoming.code)
      : [c.nameAr, c.nameEn].some((name) => name && [incoming.nameAr, incoming.nameEn].some((other) => other && normalized(name) === normalized(other))));
    if (same) mergeCourse(same, incoming, parent); else courses.push(structuredClone(incoming));
  }
  for (const chunk of chunks) {
    for (const field of ["institution", "college", "department"] as const) result[field] = mergeEntity(result[field], chunk[field], field);
    result.warnings.push(...chunk.warnings); result.issues.push(...chunk.issues);
    for (const p of chunk.programs) {
      const same = result.programs.find((x) => normalized(x.track ?? "") === normalized(p.track ?? "")
        && normalized(x.version ?? "") === normalized(p.version ?? "")
        && (x.code && p.code ? codeKey(x.code) === codeKey(p.code) : x.name && p.name && normalized(x.name) === normalized(p.name)));
      if (!same) { result.programs.push({ ...structuredClone(p), courses: [] }); }
      const target = same ?? result.programs[result.programs.length - 1];
      if (!target) continue;
      const key = `program:${result.programs.indexOf(target)}`;
      if (same) {
        const pages = unionPages(same.sourcePages, p.sourcePages);
        same.name = scalar(same.name, p.name, "program.name", key, pages);
        same.code = scalar(same.code, p.code, "program.code", key, pages);
        same.sourcePages = pages;
        same.college = mergeEntity(same.college, p.college, `${key}.college`);
        same.department = mergeEntity(same.department, p.department, `${key}.department`);
        same.fieldEvidence = { ...same.fieldEvidence, ...p.fieldEvidence };
      }
      for (const course of p.courses) addCourse(target.courses, course, key);
    }
    for (const course of chunk.unassignedCourses) addCourse(result.unassignedCourses, course, "unassigned");
  }
  for (const course of [...result.programs.flatMap((p) => p.courses), ...result.unassignedCourses]) {
    course.topics.sort((a, b) => (a.sourcePages[0] ?? 0) - (b.sourcePages[0] ?? 0) || a.orderIndex - b.orderIndex);
    course.topics.forEach((topic, index) => { topic.orderIndex = index; });
  }
  if (result.unassignedCourses.length) result.warnings.push({ code: "UNASSIGNED_COURSES", message: "بعض المقررات لم يمكن ربطها ببرنامج مؤكد؛ بقيت منفصلة للمراجعة البشرية", sourcePages: unionPages([], result.unassignedCourses.flatMap((c) => c.sourcePages)) });
  const uniqueIssues = new Map(result.issues.map((issue) => [JSON.stringify(issue), issue]));
  result.issues = [...uniqueIssues.values()];
  return extractedSpecificationSchema.parse({ ...result, document });
}
