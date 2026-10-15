-- Additive operational snapshots. Keep existing types/projection versions unknown.
-- Empty JSON/lists are compatibility defaults, not inferred academic facts.
BEGIN;

CREATE TYPE "OperationalTopicKind" AS ENUM ('THEORETICAL', 'PRACTICAL', 'UNCLASSIFIED');

ALTER TABLE "course_templates"
    ADD COLUMN "specificationType" "CourseSpecificationType",
    ADD COLUMN "projectionVersion" TEXT,
    ADD COLUMN "operationalPlan" JSONB NOT NULL DEFAULT '{}',
    ADD CONSTRAINT "course_template_projection_version_nonempty"
        CHECK ("projectionVersion" IS NULL OR "projectionVersion" ~ '[^[:space:]]');

ALTER TABLE "courses"
    ADD COLUMN "specificationType" "CourseSpecificationType",
    ADD COLUMN "projectionVersion" TEXT,
    ADD COLUMN "operationalPlan" JSONB NOT NULL DEFAULT '{}',
    ADD CONSTRAINT "course_projection_version_nonempty"
        CHECK ("projectionVersion" IS NULL OR "projectionVersion" ~ '[^[:space:]]');

ALTER TABLE "course_template_topics"
    ADD COLUMN "kind" "OperationalTopicKind",
    ADD COLUMN "details" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "contactHours" DECIMAL(8,2),
    ADD CONSTRAINT "course_template_topic_nonnegative_hours" CHECK ("contactHours" IS NULL OR "contactHours" >= 0),
    ADD CONSTRAINT "course_template_topic_details_nonnull" CHECK (array_position("details", NULL) IS NULL);

ALTER TABLE "topics"
    ADD COLUMN "kind" "OperationalTopicKind",
    ADD COLUMN "details" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "contactHours" DECIMAL(8,2),
    ADD COLUMN "sourcePages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    ADD CONSTRAINT "topic_nonnegative_contact_hours" CHECK ("contactHours" IS NULL OR "contactHours" >= 0),
    ADD CONSTRAINT "topic_details_nonnull" CHECK (array_position("details", NULL) IS NULL),
    ADD CONSTRAINT "topic_positive_source_pages" CHECK (
        array_position("sourcePages", NULL) IS NULL AND 0 < ALL ("sourcePages")
    );

-- Existing RLS, grants, foreign keys and publication guards remain in force.
COMMIT;
