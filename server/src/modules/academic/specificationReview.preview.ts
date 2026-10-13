import { readFile } from "node:fs/promises";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/AppError.js";
import { initialReviewData, extractedCourseSpecifications, readExtractedReviewData } from "./specificationReview.data.js";

const FIXTURE_FILE_SHA = "74aae047310b02b7df3e74e822bcd8f4eabdf5c8ef36721d5d6815dd40de39ef";
export const developmentReviewPreviewAvailable = (fileSha256: string) => env.NODE_ENV === "development" && fileSha256 === FIXTURE_FILE_SHA;

/** An explicit read-only development sample, never a fallback for a failed production extraction. */
export async function getDevelopmentSpecificationReview(userId: string, sourceId: string) {
  if (env.NODE_ENV !== "development") throw AppError.notFound();
  const { getSpecificationSource } = await import("./specificationSources.service.js");
  const source = await getSpecificationSource(userId, sourceId);
  if (!developmentReviewPreviewAvailable(source.fileSha256) || !source.currentExtractionId) throw AppError.notFound();
  const fixture = JSON.parse(await readFile(new URL("../../dev/fixtures/botany-review.fixture.json", import.meta.url), "utf8")) as {
    fileSha256: string; extractedData: unknown; savedChunks: number; totalChunks: number;
  };
  if (fixture.fileSha256 !== source.fileSha256) throw AppError.notFound();
  const original = readExtractedReviewData(fixture.extractedData);
  const draftData = initialReviewData(source.currentExtractionId, original);
  return { id: "development-preview", sourceId, extractionId: source.currentExtractionId, revision: 0, status: "IN_REVIEW",
    draftData, reviewedData: null, version: "preview", extractedCourseSpecifications: extractedCourseSpecifications(original),
    extractionMetadata: { warnings: original.warnings, uncertainty: original.issues, document: original.document },
    preview: { sampleOnly: true, savedChunks: fixture.savedChunks, totalChunks: fixture.totalChunks },
  };
}
