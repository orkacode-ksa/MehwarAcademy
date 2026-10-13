import { z } from "zod";

export const SPECIFICATION_PROMPT_VERSION = "academic-source-extraction-1";
export const SPECIFICATION_SCHEMA_VERSION = "academic-source-1";
const text = z.string().trim().min(1).max(24000);
const optionalText = text.nullable().default(null);
const pages = z.array(z.number().int().min(1)).max(1000).default([]);
const strings = z.array(text).max(2000).default([]);
const fieldEvidence = z.record(z.object({ quote: text, sourcePages: pages }).strict()).default({});
const entity = z.object({ name: optionalText, code: optionalText, sourcePages: pages, fieldEvidence }).strict();
const outcome = z.object({ code: optionalText, description: text, domain: optionalText, sourcePages: pages }).strict();
const topic = z.object({
  title: text, orderIndex: z.number().int().nonnegative().default(0),
  contactHours: z.number().nonnegative().nullable().default(null), learningOutcomes: strings, sourcePages: pages, fieldEvidence,
}).strict();
const assessment = z.object({
  method: optionalText, weight: z.number().min(0).max(100).nullable().default(null),
  timing: optionalText, outcomeCodes: strings, sourcePages: pages, fieldEvidence,
}).strict();
const reference = z.object({ citation: text, type: optionalText, sourcePages: pages }).strict();
const issue = z.object({
  kind: z.enum(["missing", "uncertain", "conflict"]), entity: optionalText, field: text, message: text,
  values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]), sourcePages: pages,
}).strict();
const warning = z.object({ code: text, message: text, sourcePages: pages }).strict();

export const extractedCourseSchema = z.object({
  code: optionalText, nameAr: optionalText, nameEn: optionalText,
  creditHours: z.number().nonnegative().max(100).nullable().default(null), hasLab: z.boolean().nullable().default(null),
  level: z.union([text, z.number()]).nullable().default(null), year: z.union([text, z.number()]).nullable().default(null),
  requirement: z.enum(["REQUIRED", "ELECTIVE"]).nullable().default(null), description: optionalText,
  objectives: strings, prerequisites: strings, corequisites: strings,
  learningOutcomes: z.array(outcome).max(2000).default([]), topics: z.array(topic).max(2000).default([]),
  assessmentPlan: z.array(assessment).max(500).default([]), references: z.array(reference).max(2000).default([]),
  teachingStrategies: strings, sourcePages: pages,
  fieldEvidence,
}).strict();
const program = z.object({
  name: optionalText, code: optionalText, track: optionalText, version: optionalText,
  college: entity.nullable().default(null), department: entity.nullable().default(null),
  courses: z.array(extractedCourseSchema).max(5000).default([]), sourcePages: pages,
  fieldEvidence,
}).strict();

/** Missing information remains null/empty; no operational course defaults are applied here. */
export const specificationChunkSchema = z.object({
  institution: entity.nullable().default(null), college: entity.nullable().default(null), department: entity.nullable().default(null),
  programs: z.array(program).max(500).default([]),
  unassignedCourses: z.array(extractedCourseSchema).max(5000).default([]),
  warnings: z.array(warning).max(5000).default([]), issues: z.array(issue).max(10000).default([]),
}).strict();
export const extractedSpecificationSchema = specificationChunkSchema.extend({
  document: z.object({ pageCount: z.number().int().positive(), chunkCount: z.number().int().positive(),
    processedPages: pages, emptyPages: pages, parser: text }).strict(),
});

export type ExtractedCourse = z.infer<typeof extractedCourseSchema>;
export type ExtractedProgram = z.infer<typeof program>;
export type SpecificationChunk = z.infer<typeof specificationChunkSchema>;
export type ExtractedSpecification = z.infer<typeof extractedSpecificationSchema>;

/** Derive the provider's structure from the same Zod schema that validates saved proposals. */
function responseSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodDefault) return responseSchema(schema._def.innerType);
  if (schema instanceof z.ZodNullable) {
    const inner = responseSchema(schema._def.innerType);
    return { ...inner, type: [...(Array.isArray(inner.type) ? inner.type : [inner.type]), "null"],
      ...(Array.isArray(inner.enum) ? { enum: [...inner.enum, null] } : {}) };
  }
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? "integer" : "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodNull) return { type: "null" };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodArray) return { type: "array", items: responseSchema(schema.element) };
  if (schema instanceof z.ZodRecord) return { type: "object", additionalProperties: responseSchema(schema._def.valueType) };
  if (schema instanceof z.ZodUnion) return { type: schema.options.map((option: z.ZodTypeAny) => responseSchema(option).type) };
  if (schema instanceof z.ZodObject) {
    const properties = Object.fromEntries(Object.entries(schema.shape as Record<string, z.ZodTypeAny>)
      .map(([key, value]) => [key, responseSchema(value)]));
    return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
  }
  throw new Error(`Unsupported specification response schema: ${schema._def.typeName}`);
}
export const SPECIFICATION_RESPONSE_SCHEMA = responseSchema(specificationChunkSchema);

export function specificationResponseSchemaForPages(allowedPages: number[], currentPages: number[]) {
  function bind(value: unknown, content = false): unknown {
    if (Array.isArray(value)) return value.map((item) => bind(item, content));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
      if (key === "sourcePages") {
        const pages = content ? currentPages : allowedPages;
        return [key, { type: "array", items: { type: "integer", minimum: Math.min(...pages), maximum: Math.max(...pages) }, ...(content ? { minItems: 1 } : {}) }];
      }
      return [key, bind(child, content || ["topics", "learningOutcomes", "assessmentPlan", "references"].includes(key))];
    }));
  }
  return bind(SPECIFICATION_RESPONSE_SCHEMA) as Record<string, unknown>;
}

export const EXTRACTION_FORMAT = {
  institution: { name: null, code: null, sourcePages: [], fieldEvidence: { name: { quote: "exact phrase from source", sourcePages: [] } } }, college: null, department: null,
  programs: [{ name: null, code: null, track: null, version: null, college: null, department: null, sourcePages: [], fieldEvidence: {}, courses: [{
    code: null, nameAr: null, nameEn: null, creditHours: null, hasLab: null, level: null, year: null, requirement: null,
    description: null, objectives: [], prerequisites: [], corequisites: [],
    learningOutcomes: [{ code: null, description: "verbatim outcome", domain: null, sourcePages: [] }],
    topics: [{ title: "verbatim topic", orderIndex: 0, contactHours: null, learningOutcomes: [], sourcePages: [], fieldEvidence: {} }],
    assessmentPlan: [{ method: null, weight: null, timing: null, outcomeCodes: [], sourcePages: [], fieldEvidence: {} }],
    references: [{ citation: "verbatim reference", type: null, sourcePages: [] }], teachingStrategies: [], sourcePages: [], fieldEvidence: {},
  }] }], unassignedCourses: [], warnings: [{ code: "WARNING_CODE", message: "warning", sourcePages: [] }],
  issues: [{ kind: "uncertain", entity: null, field: "field name", message: "reason", values: [], sourcePages: [] }],
};
