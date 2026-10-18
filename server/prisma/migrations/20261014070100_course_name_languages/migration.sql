-- Keep legacy Arabic strings unchanged; an absent Arabic name remains an empty string.
-- English-only names are stored explicitly in nameEn, without guessing translations.
BEGIN;

ALTER TABLE "course_templates" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "courses" ADD COLUMN "nameEn" TEXT;

COMMIT;
