# Academic catalog foundation

This branch contains the persistent academic catalog, course-level workflow APIs,
operational projection, and their UI. It does **not** implement the final PDF-to-
`normalized-course-candidates-1` AI producer. Empty databases show empty states;
failed or partial extraction never falls back to sample courses.

## Architecture and workflow

```text
Tenant (university)
├── College → Department → Program → ProgramTrack (optional)
├── AcademicCourse (stable university course identity; optional owner department)
│   └── CourseSpecificationVersion (historical course specification)
│       └── CourseSpecificationReview (versioned human snapshot)
│           └── CourseSpecificationApproval (pins exact review + contentHash)
│               └── CourseSpecificationPublication → CourseTemplate → Course
├── SpecificationSource → extraction attempts → zero or more course versions
└── CurriculumCourse (AcademicCourse in a Program/optional ProgramTrack)
```

Academic ownership and curriculum membership are separate. A source can describe
multiple programs, tracks, departments and courses, or omit that context. There
are no artificial tracks or mandatory program parents for course specifications.

1. A teacher uploads the official file through the source API. The existing
   FileAsset storage and ownership rules remain in use.
2. A successful persisted extraction supplies the normalized candidate contract.
   The ingestion API reads saved results; it does not accept user-supplied fake AI
   candidates. An adapter also reads compatible, successful legacy extraction data.
3. Authorized users materialize candidates into academic identities and versions.
   Ambiguous identities remain unresolved; context text is not silently promoted
   to real College/Department/Program records.
4. Human reviewers edit drafts and complete immutable reviewed snapshots. Readiness
   depends on specification type. Optional tracks and translations are optional.
5. An approval batch contains precise approval items, each pinning one version,
   exact completed review and content hash. Rejected/canceled decisions remain in
   history. An approved version cannot simultaneously have a pending approval.
6. Publication uses the **approved review's reviewedData**, verifies its hash, and
   builds template/topics atomically: `PENDING → build → PUBLISHED → immutable`.
   Failed publication can be retried through the existing guarded service.
7. The university catalog exposes published templates. Creating a teacher's Course
   copies names in their actual languages, spec, assessment plan and topics. It
   retains operational grading/file/absence defaults from Regulation and remains
   an independent snapshot. Later source edits do not change it live.

Tenant context, compound tenant foreign keys, forced RLS, and application-role
checks remain mandatory. A tenant's official templates are not shared with other
universities by default. Staff actions use existing institution permissions/MFA;
the UI reads capabilities from the API.

## Legacy and new paths

`ProgramSpecification` and its Review/Approval/Publication remain the legacy path
for an actual program specification. They are not mandatory course-version
parents. Existing legacy templates, manual/legacy courses, bank records and course
creation API continue to work alongside the new course-level path.

`CourseTemplate` has mutually exclusive legacy/new provenance, protected by DB
constraints and guards. New projections retain rich evidence on version/review
records; only the appropriate operational subset is copied into template/course.
`nameAr` and `nameEn` may be null individually, with a DB check requiring at least
one nonblank name. There is no cross-language fallback in persisted data.

## UI behavior

The Courses page separates **My courses** and **Academic specifications**. Courses
use compact status cards with one next action; setup detail stays inside a course.
Template search and creation open on demand. The sources view lists only actual
authorized uploads, their real progress and saved workflow summaries. Upload and
file reading remain available without extraction results.

Analysis, review, approval, publication and catalog screens call the real APIs.
Approval request explanations come from persisted review status, capability and
readiness. Unknown context stays visible as human-readable warnings. Raw evidence
is preserved; explicit `?devTools=1` diagnostics exist only in development and are
removed from production bundles. No preview source IDs, admission results or
fixture fallback are configured by frontend environment variables.

## AI integration boundary and limitations

The missing final producer is:

```text
PDF → document structure detection → course boundary detection
    → chunked AI extraction/merge → normalized-course-candidates-1
```

Use the existing generation/provider router rather than adding provider clients
to review, approval, publication or catalog services. Validate with the shared Zod
contract, preserve source/extraction IDs, sourcePages, rich evidence, warnings and
conflicts, and persist only genuine results on extraction attempts. Point the
source at a successful attempt only after merge/validation. Partial attempts and
resumable checkpoints are not complete candidates.

The existing real legacy extraction queue/provider pipeline remains available,
including resumable attempts and its legacy-to-normalized adapter. It is not the
final document/course-boundary implementation. If its provider is unavailable,
the API returns the existing unavailable/error response; no synthetic result is
shown. A final producer can replace this input boundary without changing the
downstream contract or workflow rules.

Other existing limitations must not be mistaken for completed features:

- The UI shows unresolved contexts but does not yet provide a complete academic
  entity resolution editor; authorized resolution/linking APIs remain available.
- `OTHER` specifications remain blocked pending an explicit readiness policy.
- Some incomplete real documents require human correction/classification before
  approval/publication. Missing facts are not manufactured to pass readiness.
- No production database or live production secrets were accessed for cleanup.

## Development and deployment

Use the repository-supported Node version and PostgreSQL, then run from the root:

```sh
npm ci
npm run prisma:generate
npm run build:shared
```

Configure private server environment values using `.env.example`; never commit
them. Apply migrations to the intended database using a migration owner account
by setting `DATABASE_URL` for `npm run prisma:migrate`. Restore the ordinary
application `DATABASE_URL` before starting the backend. The application must use a
non-superuser, non-BYPASSRLS role (`mihwar_app`), not migration credentials.
Migration/admin credentials are not required for runtime extraction.

The Docker startup script supports `MIGRATION_DATABASE_URL` and a private
`APP_DB_PASSWORD` to apply migrations and enable the application role. This is a
deployment concern, not an extraction request parameter. Never point migration or
automated test commands at Production unless the release is explicitly approved.

For local processes with `server/.env` configured:

```sh
node --env-file=server/.env --import tsx server/src/index.ts
npm run dev:client
```

The default Vite `/api` proxy targets `127.0.0.1:4400`; set the backend PORT
accordingly, or configure the development-only `VITE_DEV_PROXY_TARGET`. Production
uses its normal API origin. There are no shared preview accounts or admission
commands to run. Use normal sign-in/registration and actual authorized data.

## Migrations in this branch

The following eleven migrations extend the earlier program/source foundation.
They were not edited as part of cleanup and require no cleanup backfill:

1. `20261013000000_specification_extraction_queue`
2. `20261014000000_academic_courses`
3. `20261014010000_program_tracks`
4. `20261014020000_course_specification_versions`
5. `20261014030000_course_specification_reviews`
6. `20261014040000_course_specification_approvals`
7. `20261014050000_curriculum_courses`
8. `20261014060000_course_specification_publications`
9. `20261014070000_course_operational_projection`
10. `20261014070100_course_name_languages`
11. `20261014070200_nullable_course_names`

The automated harness applies the entire migration history to a fresh temporary
PostgreSQL database. Existing legacy/new compatibility tests verify both paths;
fresh-database replay alone is not proof of every possible real legacy upgrade.

## Verification

```sh
npm run typecheck
npm run lint
npm run test --workspace=client
npm run build:client
npm run build:server
node server/test/academic/run.mjs backend
npm run test:academic-e2e --workspace=client
git diff --check
```

The two academic harness modes locate PostgreSQL tools via `POSTGRES_BIN`,
`pg_config`, or an installed Windows PostgreSQL directory. Each creates a fresh
loopback-only temporary cluster, applies all migrations, uses the restricted
application role for tests, scrubs inherited external-service credentials, saves
logs in a temporary directory, and stops its own processes afterward. It never
reads `server/.env` or existing `mihwar` data. No Gemini requests run in these
checks. Browser fixtures are seeded only inside this automated test environment;
the browser then exercises actual HTTP workflow APIs. Explicit browser edge-case
interceptions are confined to test files. Chromium can be configured using
`CHROMIUM_EXECUTABLE_PATH`; installed Chrome is supported locally.

`wipe.spec.ts` is skipped by this harness because it owns a separate admin/shell
database lifecycle; it remains available in the existing CI harness. All ordinary
backend tests run without admin credentials. The CI PostgreSQL credentials are
ephemeral test-only service configuration and were left unchanged.

Test helpers live under `server/test/academic`, `client/test/academic`, and
`server/src/tests/fixtures`. Production TypeScript excludes tests, Docker copies
only its runtime start script, and the Docker context excludes local environments
and prebuilt artifacts. No production module imports the test fixtures.

## Cleanup verification (2026-10-15)

- Client/server TypeScript and Prisma validation passed.
- Server ESLint passed; client ESLint passed with eight existing React Fast
  Refresh warnings in unrelated components.
- Frontend: 70 tests passed across five files.
- Backend: 655 passed across 45 files; four wipe tests intentionally skipped.
  This includes workflow, extraction/resume, all catalog schema guards,
  projection, review, approval, publication, from-template, legacy and tenant/RLS.
- Browser: seven passed, using harness-owned fixtures and actual HTTP APIs for
  the core workflow, upload/unavailable state, review diagnostics and source/course
  navigation. No manual preview environment or real AI key was used.
- All 41 migrations replayed successfully on fresh PostgreSQL test clusters.
  No existing local/production database was migrated or modified.
- Client build and a fresh server build passed. The fresh server output contained
  no tests, development fixtures or preview module; client bundles contained no
  academic preview/admission or JSON developer-tool markers.
- Static scan of tracked/new code and documentation found no high-confidence
  service secrets or personal-machine paths. CI test credentials had no matches
  in the available local server environment or runtime code. Live Production
  credentials were not available for an independent comparison.
- `git diff --check` and new-file trailing-whitespace checks passed. No schema,
  migration or CI credential changes were made; no commit, push or merge ran.
