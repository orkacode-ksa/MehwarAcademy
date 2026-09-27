-- AlterTable
ALTER TABLE "bank_courses" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "draftAt" TIMESTAMP(3),
ADD COLUMN     "evaluation" JSONB,
ADD COLUMN     "suggestedPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "semesters" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "harvestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bank_courses_sourceCourseId_idx" ON "bank_courses"("sourceCourseId");


-- ═══════════════ إقفال الفصل: بيانات فصل مُقفل للقراءة فقط ═══════════════
-- الحارس في قاعدة البيانات لا في الواجهة ولا في الخدمات: أي مسار كتابة — حاضر أو يُضاف لاحقًا،
-- من الأستاذ أو من المساعد الذكي أو من مهمة توليد — يصطدم به. الفصل يُفتح بإرجاعه إلى «الرصد»
-- من شاشة المالك وحده.
CREATE OR REPLACE FUNCTION mihwar_guard_term() RETURNS trigger AS $$
DECLARE
  r jsonb;
  cid text;
  col text := TG_ARGV[0];
  via text := TG_ARGV[1];
BEGIN
  FOR r IN
    SELECT x FROM (VALUES
      (CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END),
      (CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END)
    ) v(x) WHERE x IS NOT NULL
  LOOP
    cid := NULL;
    IF via = 'semester' THEN
      IF EXISTS (SELECT 1 FROM "semesters" s WHERE s."id" = r->>col AND s."status" IN ('CLOSED', 'ARCHIVED')) THEN
        RAISE EXCEPTION 'TERM_LOCKED' USING ERRCODE = 'MH001';
      END IF;
      CONTINUE;
    ELSIF via = 'course' THEN
      cid := r->>col;
    ELSIF via = 'topic' THEN
      SELECT "courseId" INTO cid FROM "topics" WHERE "id" = r->>col;
    ELSIF via = 'section' THEN
      SELECT "courseId" INTO cid FROM "sections" WHERE "id" = r->>col;
    ELSIF via = 'assessment' THEN
      SELECT "courseId" INTO cid FROM "assessments" WHERE "id" = r->>col;
    END IF;
    IF cid IS NOT NULL AND EXISTS (
      SELECT 1 FROM "courses" c JOIN "semesters" s ON s."id" = c."semesterId"
      WHERE c."id" = cid AND s."status" IN ('CLOSED', 'ARCHIVED')
    ) THEN
      RAISE EXCEPTION 'TERM_LOCKED' USING ERRCODE = 'MH001';
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "courses_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "courses" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('semesterId', 'semester');
CREATE TRIGGER "sections_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "sections" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('courseId', 'course');
CREATE TRIGGER "topics_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "topics" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('courseId', 'course');
CREATE TRIGGER "assessments_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "assessments" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('courseId', 'course');
CREATE TRIGGER "quality_file_items_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "quality_file_items" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('courseId', 'course');
CREATE TRIGGER "violations_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "violations" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('courseId', 'course');
CREATE TRIGGER "source_files_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "source_files" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('courseId', 'course');
CREATE TRIGGER "lectures_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "lectures" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('topicId', 'topic');
CREATE TRIGGER "enrollments_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "enrollments" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('sectionId', 'section');
CREATE TRIGGER "attendance_records_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "attendance_records" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('sectionId', 'section');
CREATE TRIGGER "class_sessions_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "class_sessions" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('sectionId', 'section');
CREATE TRIGGER "grades_term_lock" BEFORE INSERT OR UPDATE OR DELETE ON "grades" FOR EACH ROW EXECUTE FUNCTION mihwar_guard_term('assessmentId', 'assessment');

-- الفصول المُقفلة قبل هذه الهجرة: تاريخ إقفالها غير معروف، فيُعدّ يوم الهجرة.
UPDATE "semesters" SET "closedAt" = now() WHERE "status" IN ('CLOSED', 'ARCHIVED') AND "closedAt" IS NULL;
