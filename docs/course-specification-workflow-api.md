# Course specification workflow — phase 9

This backend flow operates beside the program-specification legacy workflow. No schema change, migration, backfill, frontend change or extraction/provider change is required.

## Authorization and prefixes

Teacher/workspace prefix: `/api/workspaces/:workspaceId/academic` (`me` is supported). Authentication and workspace membership are required. A teacher can read/review only their uploaded sources; knowing a version, review or approval ID does not grant access to another teacher's source. Catalog visibility remains university-wide, and operational course creation retains active-subscription/plan limits.

Institution staff prefix: `/api/owner/institutions/:tenantId/academic`. This reuses the existing institution screen authorization and MFA requirements, with the selected institution's tenant context. `specificationCapabilities()` maps the current MVP institution permission to review, approve, publish and resolve capabilities. Domain services check capabilities, not the OWNER role. Replacing that mapping later does not require changing the workflow services.

Every academic read/write also uses tenant-scoped transactions/RLS. Cross-tenant IDs and unauthorized sources return 404; missing action permissions return 403.

## Normalized boundary

`normalizedCourseExtractionSchema` in `@mihwar/shared` is the internal provider-independent input:

```ts
{
  schemaVersion: "normalized-course-candidates-1",
  sourceId: string, extractionId: string, pageCount: number | null,
  candidates: [{
    key: string,                       // equals data.courseKey; unique within this attempt
    data: CourseWorkflowData,          // rich review schema, course-workflow-data-1
    specificationType: CourseSpecificationType | null,
    officialVersion: string | null,
    sourcePages: number[], provenance: object,
    warnings: unknown[], issues: unknown[],
    contexts: { institution, college, department, program, track },
    academicCourseId?: string, ownerDepartmentId?: string
  }]
}
```

Each context is null or `{status: "RESOLVED" | "UNRESOLVED" | "CONFLICT", name: string | null, entityId: string | null, sourcePages: number[]}`. Only RESOLVED values carry IDs, and the ingestion service verifies those IDs inside the target tenant (including track/program membership). Explicit identity/owner resolution requires the resolver capability. Unknown names remain unresolved metadata; no College, Department, Program or Track is created automatically. Optional tracks remain absent when not supplied.

`normalizeSavedCourseExtraction()` accepts this contract or adapts the existing successful saved extraction format, including multiple programs and unassigned courses. It preserves the original per-course evidence and does not assume a ProgramSpecification parent. Unknown saved formats return 422 `UNSUPPORTED_COURSE_EXTRACTION`; there is no development fixture fallback. Unknown specification type/official course version stays null; program version is never used as a course version.

Materialization uses an owned source and a SUCCEEDED extraction belonging to that source. Code identity uses the existing `normalizeCourseCode()` and active AcademicCourse uniqueness. A missing code or conflicting known name/owner returns `NEEDS_RESOLUTION` with conflict reasons. An authorized human can explicitly choose an existing identity or supply the official code through `identityResolutions`; the original extracted data stays unchanged and the resolved code seeds the review draft. Ownership is assigned only when explicitly resolved and previously unknown; curriculum membership cannot transfer ownership.

Each candidate is a durable transaction, so a request can partially materialize candidates before a later candidate fails. Retrying with the same source/extraction/candidate key reuses its version; conflicting content for the same creation key returns 409. Advisory/row locks serialize identity resolution and revision allocation. The creation key is derived from source + attempt + candidate key. The version preserves original extracted data, provenance/context states, warnings, issues and pages. New review revisions preserve completed historical reviews; new course versions preserve previous versions via supersedesId.

## Endpoints

The following suffixes exist under both prefixes unless stated otherwise. Responses use `{success: true, data: ...}`; errors use the existing application error contract. All POST/PATCH bodies are strict Zod contracts. Request keys are nonblank; IDs are CUIDs.

| Method | Suffix | Input / result |
|---|---|---|
| GET | `/specification-sources/:sourceId/course-candidates` | Optional query `extractionId`; normalized candidates from the selected/current successful attempt |
| GET | `/specification-sources/:sourceId/course-versions` | `{items, summary}` with current review/approval/publication and identity |
| POST | `/specification-sources/:sourceId/course-versions` | `{extractionId, candidateKeys?, identityResolutions?: [{candidateKey, academicCourseId?, officialCode?, ownerDepartmentId?}]}` → per-candidate CREATED/REUSED/NEEDS_RESOLUTION |
| GET | `/course-specification-versions/:versionId` | Version, original data, histories, exact current review/approval, publication, academicContexts, derived readiness |
| POST | `/course-specification-versions/:versionId/revisions` | `{requestKey}` → idempotent new course version, not modification of an approved version |
| POST | `/course-specification-versions/:versionId/reviews` | `{revisionOf?}` → current review or next revision of the current COMPLETED review |
| GET | `/course-specification-versions/:versionId/reviews/:reviewId` | Draft/reviewed data, original extractedData, readiness and optimistic `version` token |
| PATCH | `/course-specification-versions/:versionId/reviews/:reviewId` | `{expectedVersion, course, specificationType?, notes?}` → saved draft/new token |
| POST | `/course-specification-versions/:versionId/reviews/:reviewId/complete` | `{expectedVersion}` → immutable COMPLETED review + deterministic contentHash |
| POST | `/course-specification-approval-batches` | `{requestKey, notes?, items: [{versionId, reviewId, contentHash}]}` → batch and PENDING items |
| GET | `/course-specification-approval-batches/:batchId` | Manifest, seal/submittedAt and item decision histories |
| POST | `/course-specification-approval-batches/:batchId/submit` | `{}` → validate and seal exact version/review/hash manifest |
| POST | `/course-specification-approvals/:approvalId/approve` | `{notes?}`; approver permission |
| POST | `/course-specification-approvals/:approvalId/reject` | `{notes?}`; approver permission |
| POST | `/course-specification-approvals/:approvalId/cancel` | `{notes?}`; requesting uploader or institution approver |
| GET | `/course-specification-versions/:versionId/publication` | Publication state/template, or null when not requested |
| POST | `/course-specification-versions/:versionId/publications` | `{retry?: boolean}`; publisher permission → published CourseTemplate with topics |
| POST | `/course-specification-versions/:versionId/curriculum-contexts` | Resolver-only `{programId, programTrackId?, programSpecificationId?, requirement?, level?, year?, orderIndex?, sourcePages?}` |
| GET | `/course-templates` | Existing workspace catalog, expanded to legacy + independent course templates; also available to institution staff |

Existing upload/list/detail/file, extraction/start/resume and legacy review/approval/publication APIs retain their routes and contracts. Existing workspace `POST /courses/from-template` remains `{templateId, semesterId}`.

## Review and readiness

Original version extractedData is never edited by these services. Draft saves use a deterministic optimistic token; concurrent stale saves return 409. A completed review cannot be saved. Corrections before approval use `POST /reviews` with `revisionOf` pointing to the current COMPLETED review. An approved course version requires a new CourseSpecificationVersion via `/revisions`. An outstanding PENDING approval blocks editing; it must be canceled first. Completion atomically updates currentReview, reviewed snapshot/hash and READY_FOR_APPROVAL state; the snapshot still requires separate approval readiness.

Readiness policy version is `course-workflow-readiness-1`; it reports three separate objects `{ready, missing[]}`:

| Stage/type | Policy |
|---|---|
| Review completeness | Valid rich schema, matching source course key, explicit human READY status, real code, at least one language-specific name |
| All approval types | Review complete; operational credit hours are integer 1–12; explicit specification type |
| STANDARD_COURSE | Real topics, meaningful learning outcomes and assessment activities |
| FIELD_TRAINING | Learning/training outcomes, activities, supervision and assessment |
| COOPERATIVE_TRAINING | Duration, scope, supervision, deliverables and assessment |
| GRADUATION_PROJECT | Objectives, stages, deliverables, supervision and assessment |
| OTHER / unknown | Blocked until an explicit supported policy/type is provided |
| Publication readiness | Approval ready plus validation by the existing operational projection builder, including hasLab, names/code/spec limits and topic precision |

Training/projects can publish with no conventional topics when a real operational plan is present. Unknown facts are not fabricated. Rich outcomes/evidence remain in the approved review even when the operational schema cannot represent all of them. Source pages are positive, and checked against pageCount when known. Arabic-only, English-only and bilingual names remain in their actual language fields; no translation or fallback into nameAr.

## Approval and publication

A single course is a one-item batch. Batch manifest hashing sorts exact `{versionId, reviewId, contentHash}` tuples and canonicalizes keys. The existing DB model requires tuples to be supplied at create time; submit revalidates their complete/current review, recomputes the hash, validates readiness and atomically seals them. Before sealing, no approval decision is allowed. There is no public membership mutation endpoint. Invalid items roll back the whole batch.

Decisions target individual approval IDs; mixed approved/rejected outcomes preserve the exact tuple and history per course. REJECTED/CANCELED permit a new request while no APPROVED exists. APPROVED cannot be followed by PENDING for that version. Row locks and existing DB guards/partial unique constraints back these transitions. Version currentApproval and workflow status update in the same transaction. Repeated identical requests/decisions return their existing result; conflicting final decisions return 409.

Publication admission checks the approved version and publication readiness, then creates/reuses its single PENDING publication. The existing `publishCourseSpecification()` remains responsible for the atomic projection: exact approval → exact COMPLETED review → verify snapshot contentHash → template/topics → verify projection → PUBLISHED. The wrapper never creates templates/topics itself. PUBLISHED returns the same immutable snapshot. FAILED requires explicit `retry: true`, resets to PENDING only without a retained draft template, and runs the same projection transaction. PENDING without a draft is safely resumable by repeating the request. A retained manual draft is reported as a conflict for explicit handling rather than deleted/rebuilt automatically. A failed transaction leaves no partial projection and records FAILED. Publication does not alter original extraction or Legacy source approval pointers.

## Curriculum and catalog

`associateAcademicCourseCurriculum()` links a resolved AcademicCourse to a program with optional track, plan specification, course version and source. `/curriculum-contexts` is the version-specific API convenience wrapper. All references must be in the selected tenant; track and plan must belong to the selected program; optional version must belong to the selected AcademicCourse/source. Approved program plans remain immutable. Duplicate memberships are idempotent; a conflicting existing version/source requires explicit resolution. The service never modifies ownerDepartmentId and never creates a default Track.

Catalog preserves legacy `id`, `code`, names, hours/lab, publishedAt, `_count.topics`, tenant/college/department/program/programSpecification fields. It adds `templateId`, `specificationType`, `ownerDepartment`, `curriculumContexts`, `officialVersion`, `revisionNumber`, `sourceType` and `legacy`.

- Legacy: `sourceType: LEGACY_PROGRAM`, `legacy: true`; original program context remains; official course version/revision are null.
- New: `sourceType: COURSE_SPECIFICATION`, `legacy: false`; course revision/officialVersion come from its version; ownerDepartment is the independent course owner; college/department come from that owner when known. Top-level program/programSpecification are null. Actual program/track memberships appear in curriculumContexts, including generic memberships and memberships pinned to this version. Deleted programs/tracks are excluded.

The existing operational course creation copies snapshot names/spec/assessmentPlan/topics/operationalPlan, uses current Regulation for operational gradeScheme/fileItems/absencePolicy, retains plan limits and does not read source data live afterward.

## Source read model and upload limit

Source detail/list adds `courseWorkflowSummary`: totalVersions, reviewCompletedVersions, approvalPendingVersions, approvedVersions, publishedVersions, unresolvedVersions. Counts represent course versions (including historical revisions), not a whole-source approval decision. Unresolved count uses saved context states, so references remain unresolved until an explicit resolver updates them in a later resolution workflow; linking curriculum alone does not rewrite original evidence. Candidates without a resolvable code remain visible through course-candidates even when no version can be created.

Legacy `currentReviewId`, `currentApprovalId`, reviewStatus and approvalStatus keep their previous semantics. The existing teacher pending-upload limit remains 20. For the new flow a source stops consuming a pending-review slot only when every candidate in its current successful extraction has an approved latest version for that attempt/key; partial approval, newer drafts, unknown formats and unmaterialized candidates still consume a slot. This does not set the source's legacy approvalStatus.

## Frontend integration for phase 10

1. Use existing upload/source-list/detail/file/extraction/resume contracts.
2. Show candidates from the successful attempt, warnings/issues, context resolution states and missing-code conflicts; materialize selected candidates.
3. Show source course-version list/statuses and original versus review draft data.
4. Open review; preserve the returned version token for save/complete; show each readiness stage separately.
5. Submit exact complete-review/hash tuples to an approval batch, seal it, and decide individual items with the appropriate capability.
6. Request publication; expose explicit retry for FAILED and show publication state.
7. Display both catalog source types; use nameAr/nameEn correctly, optional ownerDepartment, multiple curriculum contexts and no required top-level program on the new path.
8. Create the professor's operational snapshot using the existing from-template endpoint.

Current `client/src/pages/faculty/NewCourseFromTemplateForm.tsx` dereferences department/program/programSpecification and groups by programSpecification.id. It therefore needs the phase-10 update before displaying a catalog containing newly published independent course templates. `CoursesPage.tsx` and the template form also currently render nameAr only. Existing legacy template DTOs retain their fields, but the current UI cannot safely consume the new union until these assumptions are updated. This phase intentionally leaves those files unchanged.

Resolution UI and editable context-resolution orchestration, additional policies for OTHER, frontend work and any future extraction-provider contract adapters remain outside this phase. No new hierarchy entity is implicitly created. Integration fixtures are located exclusively in tests; runtime requires a real owned source and saved SUCCEEDED extraction.

## Validation

Prisma validate/generate, shared TypeScript build, server TypeScript check and ESLint on all changed TypeScript files passed. On an isolated PostgreSQL 16 cluster with all 41 existing migrations and the non-superuser/non-BYPASSRLS application role, 479 tests passed across 18 suites, including 25 new workflow tests. Suites cover projection, publication, approval, review, version, curriculum, course-from-template, legacy program specifications, source upload, extraction/resume, legacy review, tenant isolation/scope, operational course creation/setup, university and bank. No application/production database was migrated or populated. The schema was compared byte-for-byte with its initial snapshot; frontend, extraction pipeline, migrations and environment files remain unchanged.
