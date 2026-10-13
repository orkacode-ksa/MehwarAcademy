import { z } from "zod";
import { specificationChunkSchema, SPECIFICATION_PROMPT_VERSION, SPECIFICATION_SCHEMA_VERSION } from "./specificationExtraction.schema.js";

const traceSchema = z.object({
  promptVersion: z.string(), schemaVersion: z.string(), parser: z.string().nullable(),
  pageCount: z.number().int().nonnegative(), chunkCount: z.number().int().min(0).max(400),
  fileSha256: z.string().optional(), resumeFromAttemptId: z.string().optional(), rootAttemptId: z.string().optional(),
  chunks: z.array(z.object({
    index: z.number().int().nonnegative(), sourcePages: z.array(z.number().int().positive()),
    model: z.string(), finishReason: z.string().nullable(), rawOutput: z.string(),
    completed: z.boolean().optional(), inputSha256: z.string().optional(), reusedFromAttemptId: z.string().optional(),
  })).max(400),
  failure: z.object({ type: z.string(), message: z.string(), httpStatus: z.number().optional() }).optional(),
});

export type ExtractionTrace = z.infer<typeof traceSchema>;

export function readExtractionTrace(raw: unknown): ExtractionTrace | null {
  const parsed = traceSchema.safeParse(raw);
  return parsed.success && parsed.data.promptVersion === SPECIFICATION_PROMPT_VERSION
    && parsed.data.schemaVersion === SPECIFICATION_SCHEMA_VERSION ? parsed.data : null;
}

export function completedExtractionChunks(trace: ExtractionTrace) {
  const chunks = new Map<number, ExtractionTrace["chunks"][number]>();
  for (const chunk of trace.chunks) {
    if (chunk.index >= trace.chunkCount || chunk.completed === false || chunk.finishReason !== "STOP") continue;
    // Legacy attempts have no completion marker. Their saved responses must still pass Zod.
    try {
      const json = chunk.rawOutput.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      specificationChunkSchema.parse(JSON.parse(json));
      if (chunks.has(chunk.index)) throw new Error("Duplicate chunk checkpoint");
      chunks.set(chunk.index, chunk);
    } catch { continue; }
  }
  return [...chunks.values()].sort((a, b) => a.index - b.index);
}

export function extractionProgress(status: string, raw: unknown) {
  const trace = readExtractionTrace(raw);
  const totalChunks = trace?.chunkCount ?? 0;
  const completedChunks = trace ? completedExtractionChunks(trace).length : 0;
  return {
    totalChunks, completedChunks, remainingChunks: Math.max(0, totalChunks - completedChunks),
    canResume: status === "FAILED" && totalChunks > 0 && completedChunks > 0,
    pausedForRateLimit: trace?.failure?.httpStatus === 429 || /\b429\b/.test(trace?.failure?.message ?? ""),
    resumeFromAttemptId: trace?.resumeFromAttemptId ?? null,
    rootAttemptId: trace?.rootAttemptId ?? null,
  };
}
