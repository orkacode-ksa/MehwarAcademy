# Course name compatibility after stage 8

`CourseTemplate.nameAr`, `CourseTemplate.nameEn`, `Course.nameAr` and
`Course.nameEn` are nullable strings. Missing language names are `null`, never
translations, copies of the other language, or empty-string sentinels.
Both tables enforce that at least one name contains non-whitespace text.
Existing records remain unchanged; there is no inferred language backfill.

The approved-review projection uses only explicit `nameAr`/`nameEn` fields.
An unclassified `courseTitle` does not determine a language. Creating a course
from a template copies both language fields exactly, including nulls.
`courseDisplayName` chooses an available name for neutral display labels only;
its result must never be assigned to either persisted language field.

## Frontend and API follow-up (not implemented in this stage)

- Course/template response types must accept `nameAr: string | null` and expose
  `nameEn: string | null` wherever a name is displayed or searched.
- Update `faculty/CoursesPage.tsx`, `faculty/NewCourseFromTemplateForm.tsx`,
  `components/setup/types.ts`, `faculty/GradesPage.tsx`, `faculty/HomePage.tsx`,
  `faculty/PerformancePage.tsx`, `dept/DeptPage.tsx`, `student/StudentCoursesPage.tsx`
  and `student/StudentCoursePage.tsx`. AcademicContext names for college,
  department and program keep their existing types; this change is course-only.
- Adapt existing template catalogue, course suggestions, workspace, department,
  student, roster, quality and home DTOs/selectors that currently expose only
  `nameAr`. Grade-grid responses now also carry `nameEn` for document generation.
  Search/matching should use both explicit names without replacing one with the
  other in the returned DTO.
- Keep the current manual `POST /courses` request contract unchanged for now;
  it still requires an Arabic name. Future bilingual manual input needs explicit
  validation and both nullable fields, with at least one nonblank name.
- Bank titles are neutral display text. Bank import currently has an older
  Arabic-only name contract; preserve explicit language metadata in a future
  bank snapshot/import update rather than guessing a language from `title`.
- Remaining display consumers that directly interpolate `nameAr`, including
  teaching/session notifications, content/generation labels and report headers,
  need the neutral display policy in their corresponding follow-up changes.

No frontend files, new routes, extraction contracts or legacy records are
changed by this compatibility work.
