-- Keep existing names/snapshots intact; absence is nullable, never a blank sentinel.
BEGIN;

ALTER TABLE "course_templates"
    ALTER COLUMN "nameAr" DROP NOT NULL,
    ADD CONSTRAINT "course_template_name_present" CHECK (
        COALESCE("nameAr" ~ '[^[:space:]]', FALSE)
        OR COALESCE("nameEn" ~ '[^[:space:]]', FALSE)
    );

ALTER TABLE "courses"
    ALTER COLUMN "nameAr" DROP NOT NULL,
    ADD CONSTRAINT "course_name_present" CHECK (
        COALESCE("nameAr" ~ '[^[:space:]]', FALSE)
        OR COALESCE("nameEn" ~ '[^[:space:]]', FALSE)
    );

COMMIT;
