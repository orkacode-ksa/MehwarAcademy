BEGIN;

-- New source-owned attempts are durable jobs. Legacy specification snapshots remain untouched.
CREATE UNIQUE INDEX "specification_extraction_one_active_source"
  ON "program_spec_extractions" ("tenantId", "sourceId")
  WHERE "sourceId" IS NOT NULL AND "programSpecificationId" IS NULL AND "status" IN ('PENDING', 'RUNNING');

-- Same privilege boundary as mihwar_claim_generation_job: return only a claim, then execute under tenant RLS.
CREATE FUNCTION mihwar_claim_specification_extraction()
RETURNS TABLE ("id" TEXT, "tenantId" TEXT, "requestedById" TEXT)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE job RECORD; expired RECORD;
BEGIN
  -- An interrupted worker loses its lease; successful/failed snapshots are never rewritten.
  -- Lock the source before its attempt, matching request/finish transactions and avoiding lock inversion.
  FOR expired IN SELECT s."id", s."tenantId", s."currentExtractionId" FROM "specification_sources" s
    JOIN "program_spec_extractions" e ON e."tenantId" = s."tenantId" AND e."id" = s."currentExtractionId"
    WHERE e."status" = 'RUNNING' AND e."programSpecificationId" IS NULL
      AND e."promptVersion" = 'academic-source-extraction-1' AND s."updatedAt" < (now() AT TIME ZONE 'UTC') - interval '15 minutes'
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    UPDATE "program_spec_extractions" AS attempt SET "status" = 'FAILED', "finishedAt" = (now() AT TIME ZONE 'UTC'),
      "errorMessage" = 'انقطع الاستخراج — يمكنك إعادة المحاولة'
      WHERE attempt."id" = expired."currentExtractionId" AND attempt."tenantId" = expired."tenantId";
    UPDATE "specification_sources" AS source SET "extractionStatus" = 'FAILED', "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE source."id" = expired."id" AND source."tenantId" = expired."tenantId";
  END LOOP;

  SELECT e."id", e."tenantId", e."sourceId", e."requestedById" INTO job
    FROM "program_spec_extractions" e JOIN "specification_sources" s
      ON s."tenantId" = e."tenantId" AND s."id" = e."sourceId" AND s."currentExtractionId" = e."id"
    WHERE e."status" = 'PENDING' AND e."programSpecificationId" IS NULL
      AND e."promptVersion" = 'academic-source-extraction-1' AND e."schemaVersion" = 'academic-source-1'
      AND s."extractionStatus" = 'PENDING'
    ORDER BY e."createdAt", e."id" FOR UPDATE OF s SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE "program_spec_extractions" AS attempt SET "status" = 'RUNNING', "startedAt" = (now() AT TIME ZONE 'UTC')
    WHERE attempt."id" = job."id" AND attempt."tenantId" = job."tenantId";
  UPDATE "specification_sources" AS source SET "extractionStatus" = 'RUNNING', "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE source."id" = job."sourceId" AND source."tenantId" = job."tenantId";
  RETURN QUERY SELECT job."id"::TEXT, job."tenantId"::TEXT, job."requestedById"::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION mihwar_claim_specification_extraction() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_claim_specification_extraction() TO mihwar_app;

COMMIT;
