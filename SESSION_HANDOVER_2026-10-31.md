# EduNexa / Pragathi — Session handover

Prepared: 2026-10-31 14:10 IST. Audience: the project owner and the developer/agent resuming this work.

## Start here

**The source changes and demo database inserts are present. A SQL-specific faculty-allocation revision fix is required before deployment; deployment and device push configuration are not complete.** Do not interpret local tests or successful database seeding as proof that the running remote backend has this code.

- Workspace: `/Users/sconex.ios.dev/Leads porjects/edunexa-college`.
- Git branch: `Chaitu_dev`. HEAD: `98dce33d5ad940560aba6bc00ab83f82f85044bf`.
- Earlier UI/assessment/attendance changes are committed. The latest semester progress, course subject/faculty editing, fee-head management, certificate designs and mobile loading fixes are still uncommitted.
- The latest captured status contains **48 modified tracked files**. New source files, tests, assets and this handover also need deliberate staging. Preserve all existing work; do not reset or clean the checkout.
- Database: SQL Server, `150.241.246.34:1433`, database `Edu Admin`, schema `dbo`. Existing credentials remain in backend configuration; none are copied into this document.
- Remote API: `http://150.241.246.34:8010`. The last check of its OpenAPI document reported **no `/api/v1/academics/semester-workspace` route**. This is the main immediate deployment gap, not a database-seeding failure.
- The linked demo dataset is already committed to SQL: **48 students, 48 parents, 25 teachers, one admin, 122 accounts**. All created accounts use the user-requested demo password `test@123`. Existing real accounts/passwords were not replaced.
- Login/relationship report: [mock_logins.txt](mock_logins.txt), rewritten after the successful seed commit, mode `0600`, Git-ignored. Do not force-add it to Git or publish it.
- **Priority source-review finding:** `curriculum_workspace.py` still writes a bare integer into `course_faculty_revisions`; the SQL JSON-object constraint can reject an actual faculty-assignment save. See “Priority fix discovered during handover” below. This was not exercised by the successful read-only SQL checks.
- Device push is intentionally deferred: the owner will supply Firebase/APNs setup later. Persisted in-app inbox records work independently.

Supporting records:

- [Full file inventory](docs/handover/2026-10-31/file-inventory.md): historical and current files, status and purpose.
- [Machine-readable file manifest](docs/handover/2026-10-31/file-manifest.json): 220 entries across the relevant commits/current checkout; hashes identify the captured source versions. Historical entries may no longer exist after renames.
- [Exact SQL aggregate counts](docs/handover/2026-10-31/database-counts.json): read-only verification performed while preparing this handover.
- [Git status snapshot](docs/handover/2026-10-31/git-status-at-handover.txt), [diff statistics](docs/handover/2026-10-31/git-diff-stat.txt), and [relevant commit manifests](docs/handover/2026-10-31/relevant-commits.json).
- [Semester implementation/runbook](backend/docs/SEMESTER_ACADEMICS.md), [assessment/curriculum runbook](backend/docs/ASSESSMENT_WORKSPACE.md), [attendance runbook](backend/docs/ATTENDANCE_WORKSPACE.md).

## Workspace and repository state

| Area | Stack / entry points | Important context |
|---|---|---|
| `admin-dashboard` | Next.js 16 / React 19; `src/components/colleges` | Read `admin-dashboard/AGENTS.md` and the applicable bundled Next documentation before editing. Relevant CSS guide: `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`. |
| `backend` | FastAPI; `app/main.py`, deployment entry `app.asgi:app` | Local JSON, PostgreSQL and SQL Server stores exist. This environment uses SQL Server. Private file handling and existing S3 integration are retained. |
| `mobile-apps/admin_teachers` | Flutter; `lib/app/edunexa_client.dart` | One app supports admin and teacher roles. |
| `mobile-apps/parent_student` | Flutter; `lib/app/edunexa_client.dart` | One app supports parent and student roles. |

Both Flutter projects contain separate mirrored source. Apply shared behavior changes to both unless intentionally role-specific. Current files are under `lib/app`, `lib/screens`, `lib/components`, `lib/services`, etc.; older commits refer to `lib/src` paths that were reorganized. Git's rename detection sometimes compares identical files across the mirrored apps; this is not a direction to move role implementations between apps.

Relevant committed history:

| Commit | Subject | Scope |
|---|---|---|
| `a1031c3` | assignment screen chnages in the mobile app and admin dashboard | Earlier assignment/side-drawer foundation, including shared drawer. |
| `779c961` | certification modules added | Certificate, admission, syllabus/calendar and related workspace foundation. |
| `18d5376` | side scroll optimization and code optimizaion | Drawer/form spacing and mobile folder organization. |
| `98dce33` | acedemics, Assignments & attendance chnages | 78 files; shared search, main-screen tables, assessments, attendance and initial curriculum work. |

These are existing user commits, not new commits made for the handover. No merge, deployment or new commit was performed as part of this handover request. `mock_logins.html` was also present as an untracked file when this handover started; its authorship/content has not been audited, and it changed externally while the handover was being generated. Treat it as potentially containing credentials and do not auto-stage/publish it.

## User requests and implemented behavior

### Side drawers, spacing, labels, search and buttons

- Right-side panels remain attached to the right viewport edge, full-height, with rounded top-left/bottom-left corners, clipped content and scrollable bodies.
- Shared gutters provide breathing room at the left side and around form content. Side-panel input labels were increased approximately 20% in the affected/shared form styles.
- `SearchField.tsx` / `search-field.css` introduce a minimal, single-line search with matching dropdown suggestions. Key table/workspace searches were migrated to it, including students, admissions, attendance, assessments and other college screens.
- Search controls, table actions and headers were aligned and made responsive. Native dropdown/popover behavior and the real global combo styles were included in browser checks.
- Shared tab interactions improve hover/selected text contrast, focus, disabled states and badges. Earlier browser checks covered eight tab families.
- Broad shared coverage is implemented; an exhaustive audit of every custom/legacy search control across the whole application has not been recorded.

### Students and admissions

- Student main-screen tables expose file, edit, info and delete actions rather than hiding the table in a redundant Manage students drawer.
- Add student uses the same enrollment wizard as Student enrollment; the duplicate guardian/course-enrollment shortcuts were removed from that flow.
- Admissions enquiry data is displayed in the main screen. The redundant Manage admissions action was removed; New application retains its existing form fields.
- Social media/advertising references use a platform name and do not require reference-person mobile details.
- Detail/profile actions were standardized toward info-icon actions in the touched tables.

### Courses, semester subjects/labs and faculty

- Existing courses received editable semester subject/lab starter plans in SQL; new courses can initialize starter curricula.
- Course details now include semester tabs, subject/lab counts, credits, search, inline name/type/credit editing, add subject/lab, and batch/section-specific faculty assignment.
- Inline edits keep subject identity stable so historical offerings/results remain linked. Stale edits are rejected by revision checks. Ambiguous changes to shared subjects are protected.
- Canonical `subject_offerings` and `student_subjects` link faculty and enrolled students. Reassigning faculty preserves offering identity.
- Existing batch snapshots keep their curriculum membership. Names/types/credits resolve from canonical subjects. Adding a course subject does not add it to all old batches; allocating the new subject to an authorized selected batch can extend that snapshot.
- The older bulk `CourseCurriculum` implementation remains in the repository. Course cards/details now open the new semester workspace through `CourseInsightsPanel`.
- Academic batch creation uses course level (Intermediate/Degree), relevant course, start/end dates, a curriculum preview, generated batch identity and generated dated semesters.

### Shared semester academic progress

- New web and Flutter Academic progress screens show the current semester, semester subjects/faculty, today's classes, final results, backlog details, all-clear/pending counts, semester graphs, batch comparisons, course comparisons and a weighted college overview.
- Current semester is derived from semester start/end dates in India Standard Time. Overlaps produce a conflict state; gaps produce semester breaks; estimated dates are flagged for review.
- The calendar can be edited with revision checks. Changing a date does **not** automatically promote students or alter class enrollment.
- Published **final subject results** determine backlog state; internal assignment/assessment marks do not manufacture backlogs.
- Missing results remain pending. A failing published attempt creates a backlog. A later passing supplementary attempt clears it. All-clear requires the required subject results for the semester.
- Performance percentages are earned published marks divided by their maximum marks, rather than an average of unrelated percentages. Ungraded marks stay pending.
- Staff/teacher editors support final marks, explicit pass/max thresholds, absence, assessment date, attempt number and publish state. Revision checks prevent stale overwrites.
- Teachers are restricted to allocated subjects/students; parents and students receive only their own authorized records. Teacher roster fields include subject-specific eligible student codes.
- Home overview cards link into the academic screen. Current class status refreshes every minute; this is polling, not a WebSocket stream or a claim of instant delivery.

### Attendance and timetable-linked classes

- Admin/teacher register selection uses course level, course/branch and academic batch/section.
- Shared register APIs provide period, day, week, month and year statistics, attendance calendars, approved leave/absence information and family-scoped display.
- Current class cards derive from canonical timetable slots and compatible published timetable documents, current date/time and current semester. Take attendance preselects the relevant class/date/period/subject.
- Scheduled teacher attendance uses the actual period and rejects another teacher's scheduled period. Attendance for today's future class has not opened.
- Subject and semester are resolved from the schedule on save, rather than trusting a client-entered label.
- Existing classes without timetable slots retain a legacy manual-attendance path. Published timetable cells must map to canonical subjects/offerings to participate in the shared live-class view.
- Legacy attendance tables and the new document registers are merged by the shared workspace. The seed stores demo attendance in the new document registers, not in the old attendance session/mark tables.

### Assessments, assignments and the mobile error

- Assessments select level/course/batch/section, semester subject, name, description/guidance, date/time and optional image/PDF attachments. Drafts can be saved; publishing fixes the recipient audience and instructions.
- After the scheduled time, published assessments are dynamically classified as completed. Completed items can receive per-student marks, absence and feedback. Current/upcoming/completed views and student/subject/batch performance are available in the touched web/mobile screens.
- Publishing/grading persists student/parent notifications. Actual device push remains configuration-dependent.
- Attachment access remains private/audience-checked; assessment uploads use the existing assignment file-upload mechanism. The documented limits are 10 files and 10 MB per file.
- Subject options now expose the current semester. Personal subject lists default to current-semester subjects. Assignment/assessment composers use the selected course/batch curriculum and faculty scope.
- The screenshot error `Future<dynamic> is not a subtype of Map...` was fixed by awaiting assignment list/detail API calls before decoding the result in **both** Flutter apps. Regression tests exercise both asynchronous paths.

### Fees, custom fee heads and reminders

- Saved course fees use a consistent card layout: saved head breakdown, base fee, configured GST, total, and semester allocation when explicitly configured as a full-course plan.
- The provided MPC ₹67,000 / four-semester example was the layout reference. Its values were **not copied into unrelated courses**.
- A shared fee-head drawer now contains Add custom fee head, custom category labels, billing group, ownership, external-party selection where needed, description, scholarship eligibility, search, and an existing-head table with edit/delete actions.
- It is accessible from fee-structure cards/management and the generic fee-head create/edit path. The table stays in the same drawer as the form. Linked heads are protected from deletion by the backend.
- Fee head fields are saved through existing resource/form APIs, preserving schema fields and form metadata rather than posting seed/system metadata back as editable data.
- Selecting a course supplies its actual semester count and filters course-specific academic batches. Legacy shared academic years remain supported.
- Annual, full-course and explicit-semester schedules are now separate scopes, even when course/year/head/period identifiers overlap. Course/batch mismatches and out-of-range explicit semesters are validated.
- An old fallback that invented percentage-based fee heads was removed. If itemization is absent, the UI shows a single saved amount labeled as unconfigured breakdown; it does not invent financial data.
- Parent/student academic views show semester charges, actual paid/balance values, due state and payment history from the existing finance ledger. Annual/unallocated charges remain separately labeled.
- A persistent-server background worker runs fee reminder checks hourly when `EDUNEXA_SEMESTER_REMINDERS_ENABLED=true` (default for SQL-backed application lifespans). Local JSON development/test stores do not start it; test fixtures explicitly disable it.
- Reminder stages are one within seven days before due, one on due date, then at most one per overdue week. Deduplication includes charge, due date, recipient and stage. Paid balances stop new reminders.
- The inbox notice is stored independently of device push. Existing consent-based SMS remains separate; no new SMS provider was configured.

### Certificates

Five distinct printable designs now share the bundled Pragathi logo, college branding, generated seal, issuer-name signatory and verification QR/link:

| Certificate | Paper format |
|---|---|
| Study | A4 portrait |
| Conduct | A4 landscape |
| Attendance | A5 portrait |
| Course completion | US Letter landscape |
| Achievement | A4 landscape |

The renderer is `backend/app/core/certificate_design.py`; `backend/app/modules/documents/files/api.py` delegates to it. The logo is `backend/assets/pragathi-logo.jpg`, copied from the existing dashboard brand asset so backend deployment does not depend on the frontend folder. Existing Ed25519 signing/verification remains the issuance mechanism. The visible signatory is typed issuer text; no scanned personal handwriting or real rubber-stamp artwork was supplied/created. Existing issued PDF bytes are not regenerated. The archived example PDFs are **test samples**, not issued certificates or valid verification records.

## Backend and API contracts

All paths below are under `/api/v1` and retain existing authentication/authorization.

| Route | Purpose / constraints |
|---|---|
| `GET /academics/semester-workspace` | Role-scoped overview; optional `program_code`, `academic_year_code`, `student_code`, `semester_number`. |
| `PUT /academics/semester-workspace/results` | Batch/semester/subject final attempts, revision, max/pass marks, assessed date, publish and student marks/absence. |
| `PUT /academics/semester-workspace/calendar` | Whole course semester calendar, revision checked, chronological/non-overlapping, within batch bounds. |
| `POST /academics/semester-workspace/fee-reminders/run` | Authorized fee-admin reminder trigger; useful for a scheduler on a nonpersistent host. |
| `GET/PUT /academics/course-curricula/{course}` | Existing bulk course plan read/edit. |
| `GET /academics/course-curricula/{course}/workspace` | Semester items, edit/allocation grants, years/sections, active teachers and offerings. |
| `PATCH /academics/course-curricula/{course}/subjects/{link}` | Stable subject identity inline edit; plan revision required. |
| `POST /academics/course-curricula/{course}/subjects` | Add subject/lab within course semester bounds. |
| `PUT /academics/course-curricula/{course}/faculty` | Allocation revision, selected year/section/subject/teacher; stale reassignment protected. |
| `GET /academics/attendance-workspace/options` | Scoped course/year/section/child options. |
| `GET /academics/attendance-workspace` | Register/calendar/summary data. |
| `PUT /academics/attendance-workspace/register` | Revision-safe marks; accepts `slot_code`, `subject_code`, `semester_number`; schedule is authoritative for a selected slot. |
| `/academics/assessment-workspace` | Options, list/detail, draft/publish, completed assessment marks; see assessment runbook for exact methods. |
| `/academics/assignment-workspace` | Existing assignment/file workflow, extended with semester context/current-semester options. |
| `/certificates/workspace` | Existing request/issue workflow; template metadata adds `paper_size`; published notices can use generic push data. |
| `GET /workspace/lookup/programs` | Now includes optional `duration_semesters` and `course_level` with the existing value/label. |
| `GET /workspace/lookup/academic_years` | Now includes optional `program_code` for course/year filtering. |
| `POST/PATCH /workspace/resources/fee_heads[/{code}]` | Existing form-bound custom fee-head create/update; pass `values` and published form identity/revision where applicable. |
| `DELETE /finance/fee-heads/{code}` | Existing deletion service; refuses references. |
| `POST /master-data/actions/course-fee-structure` | Inline head schedules; accepts `annual`, `full_course`, `semester` basis; charged amounts retain existing protections. |

Important role rules: final-result viewing uses personal/teaching scope or appropriate academic grants; admin result entry needs `exam_results` edit. Calendar editing needs `academic_years` edit. Fee reminder manual trigger needs `student_fee_charges` create. Fee-head table buttons follow resource actions. Existing teacher allocation, family linking, screen permissions and backend validation remain authoritative.

## Database changes and connection troubleshooting

### Connection history

The backend `.env` retains SQL Server host `127.0.0.1`, which is appropriate for the backend running on the Windows database machine. On the Mac checkout, this points to the Mac and initially produced connection refused (61): there was no local SQL listener. This was not evidence of a wrong SQL password.

The dashboard points to the Windows API at `150.241.246.34:8010`. Its health/course options worked, and direct SQL access to `150.241.246.34` with the existing configured credentials succeeded. The public course codes and direct SQL course codes were matched before the original curriculum seed. No credentials, database name, or permanent host configuration were replaced.

For local code against remote SQL, use a process override `EDUNEXA_MSSQL_HOST=150.241.246.34`, or the seed's `--sql-host`. On Windows, keep the server's own working local DB address.

### Persistence model — no new SQL tables/migration

The features reuse canonical tables plus the existing `record_extras` JSON store. There was no `ALTER TABLE`, table creation, or data-destructive migration for this work.

- Subjects and curriculum membership: canonical `subjects`, `curriculum_subjects`.
- Batch/calendar/enrollment/faculty/timetable/fees: existing canonical tables listed below.
- Workspace documents are stored in `record_extras` with `table_name = document:<namespace>` and `record_code` identifying the document. Arbitrary canonical extras remain attached under their resource's table name.
- Account/role mappings persist in the existing user/role model; the demo metadata appears in extras (`users`: 122, `roles`: 4), while password hashes are in the normal account backing store.
- Semester results use `document:semester_results`; internal assessments use a different namespace. Do not assume generic queries of canonical `exam_results` contain these new final-result documents.

Document namespaces used/extended:

`course_curricula`, `academic_batch_curricula`, `course_faculty_revisions`, `semester_results`, `semester_result_revisions`, `semester_calendar_reviewed`, `semester_calendar_revisions`, `semester_fee_reminders`, `academic_demo_runs`, `attendance_registers`, `assessments`, `assignment_records`, `assignment_submissions`, `timetables`, and the pre-existing assignment file namespace. Some revision/reminder namespaces gain rows only after the corresponding operation runs.

### SQL-specific problems fixed

1. SQL Server's `CK_record_extras_data_json` / `ISJSON` rejected JSON scalar values such as bare `true` and `1`. The failed transaction rolled back. Revision/review documents now store objects such as `{"revision":1}` and `{"reviewed":true}`. Code can still read previous scalar revision values for compatibility.
2. A large seed exceeded the normal query timeout and disconnected. The seed's temporary SQL settings now use `query_timeout=300`; application defaults were not globally increased for every request.
3. `SqlServerStore.transaction` now preserves the original failure if rollback itself fails on a dead connection; the dead connection is closed instead of returned to the pool.
4. Bulk seed reads preload lazy views to avoid thousands of one-record SQL lookups. In `SqlServerStore`, `.values()` loads a view, while repeated membership checks on an unloaded lazy view can incur one SQL query per code.
5. Document keys for final results/revision groups are hashed (`SRES-...`, `SGR-...`) to stay within existing record-code length limits.
6. `validate_record` forbids unknown contract fields. The linked seed validates canonical fields first and deliberately attaches known seed metadata/extras separately; it does not weaken generic CRUD validation.

### Course curriculum insert

`backend/tools/seed_course_curricula.py --sql-host 150.241.246.34 --apply` was run successfully earlier. It populated missing starter plans for **131 existing courses**, with **3,278 curriculum links**: 2,454 theory entries and 824 practical/lab entries. A read-only count during handover still returned 3,278 total links. Existing curricula are preserved on rerun; a subsequent preview found no missing plans.

These are generated institution-review **starter drafts**, not researched/accredited Intermediate-board or university syllabi. Credits are initial defaults (typically theory 3 / lab 1) and need institutional review. Do not present the drafts as official approved content.

## Demo identities and linked records

Seed: `backend/tools/seed_linked_academics.py`. Run registry: `linked-academics-2026-v1`. Identifiable record prefix: `D26-`. The seed reuses the existing course codes; it does not create duplicate course master records.

| Demo academic year | Course / code | Entry–graduation | Current semester on 2026-10-31 | Students |
|---|---|---|---:|---:|
| `D26-AY1` | Intermediate BPC / `INT-BPC` | 2026–2028 | 1 | 12 |
| `D26-AY2` | Intermediate MPC / `INT-MPC` | 2025–2027 | 3 | 12 |
| `D26-AY3` | BCA / `DEG-BCA` | 2024–2027 | 5 | 12 |
| `D26-AY4` | B.Com General / `DEG-B-COM-GENERAL` | 2025–2028 | 3 | 12 |

Current-semester figures are date-dependent and will change as calendar dates pass. The login report is a seed-time snapshot; use the API/calendar for current status.

### Canonical inserted demo records, verified read-only at handover

| Table | Inserted `D26-` rows |
|---|---:|
| `academic_years` | 4 |
| `batches` | 4 |
| `semesters` | 20 |
| `sections` | 20 |
| `employees` | 26 |
| `teachers` | 25 |
| `rooms` | 40 |
| `students` | 48 |
| `parents` | 48 |
| `student_parents` | 48 |
| `student_enrollments` | 144 |
| `student_subjects` | 756 |
| `subject_offerings` | 116 |
| `timetable_slots` | 600 |
| `fee_heads` | 1 |
| `fee_structures` | 20 |
| `student_fee_charges` | 240 |
| `payments` | 128 |
| `payment_allocations` | 128 |
| `notifications` | 96 |

In addition to canonical rows, the verified document counts are:

| Namespace | Demo documents |
|---|---:|
| `academic_demo_runs` | 1 |
| `academic_batch_curricula` | 4 |
| `semester_calendar_reviewed` | 4 |
| `timetables` | 20 published plans |
| `attendance_registers` | 320 |
| `semester_results` | 482 final attempt records, including passing reattempts |
| `assessments` | 8 |
| `assignment_records` | 8 |
| `assignment_submissions` | 48 |

Result-group revision documents also persist but their hashed keys were not included in the prefix-based aggregate count. The counts above are a snapshot, not invariants after user edits or new marks/payments.

### Seed content and identity behavior

- Students, parents, employees/teachers, offerings and enrollment relationships are linked in the real SQL database. UI runtime data is not hardcoded to these names or counts.
- Synthetic deterministic names, `example.invalid` email addresses and fictional contact information distinguish this dataset. No real people's account passwords were changed.
- Four new roles: `D26-ADMIN`, `D26-TEACH`, `D26-STUDENT`, `D26-PARENT`. The admin is an academic/fee demo administrator, not a blanket `system_admin` account.
- Example logins: `demo.admin`; `demo.teacher01`–`demo.teacher25`; `demo.student01`–`demo.student48`; `demo.parent01`–`demo.parent48`.
- `mock_logins.txt` lists names, record identifiers, course/batch, parent/child pairing and faculty subjects. The same requested password applies to these **created demo accounts only**.
- Weekly slots and published timetable documents cover all 20 semesters, Monday–Saturday, five teaching periods. Academic calendar context selects the current-semester view. Canonical allocations are present for the subject/lab plans.
- Seed fee records use demo tuition of ₹15,000 per semester, with completed prior-term payments and a mix of current partial/unpaid balances. These are synthetic demo charges, not alterations to real fee schedules. The existing MPC ₹67,000 example was not overwritten.
- Past final results include passing marks, failing marks and passing reattempts for meaningful backlog/performance displays. There are completed/upcoming assessments and assignments, and historical attendance records.
- The 96 seeded fee notices are stored inbox records for the new demo student/parent accounts. The seed does not send external push/SMS/email. `status=sent` on an in-app row does not prove device delivery.
- No real certificates or private assessment attachments were issued/uploaded by this seed. Sample certificate PDFs are test artifacts only.

### Seed rerun and recovery guidance

```sh
# From backend; preview only:
.venv/bin/python tools/seed_course_curricula.py --sql-host 150.241.246.34
.venv/bin/python tools/seed_linked_academics.py --sql-host 150.241.246.34

# Already executed successfully in this session; do not run just to deploy code:
.venv/bin/python tools/seed_course_curricula.py --sql-host 150.241.246.34 --apply
.venv/bin/python tools/seed_linked_academics.py --sql-host 150.241.246.34 --apply
```

The linked seed is transaction-backed. Its registry prevents duplicate people/accounts; an existing run may backfill only missing demo timetable documents and rewrite the login report. Existing edited demo records are retained. If a `D26-` prefix exists without its run registry, the seed refuses rather than guessing whether it is safe to replace records.

Do not delete the run registry to force reseeding. There is no implemented automatic cleanup/rollback command for the final successful dataset. Any future cleanup must be a reviewed dependency-aware removal of only identified demo records, never a table truncate or deletion by common human name.

`EDUNEXA_DEMO_PASSWORD` can override the seed's initial password. **It does not rotate accounts on an existing run.** Rerunning with a different value would rewrite a misleading login-report password while preserving existing hashes; keep the original value unless deliberately implementing a password reset. The report is replaced only after SQL commit, by an atomic file rename.

## Modified files

The complete 220-entry historical/current inventory is in [file-inventory.md](docs/handover/2026-10-31/file-inventory.md). It distinguishes modified tracked files from untracked new files and older committed changes. The following are the primary continuation points.

| File | State at capture | Change / responsibility |
|---|---|---|
| `admin-dashboard/src/components/colleges/AcademicProgressWorkspace.tsx` | New (untracked) | New semester dashboard, home summary, role-scoped graphs/results/calendar/fee UI and timetable attendance drawer. |
| `admin-dashboard/src/components/colleges/AssessmentWorkspace.tsx` | Modified | Select current semester from options for new assessment context. |
| `admin-dashboard/src/components/colleges/AssignmentWorkspace.tsx` | Modified | Default subject from current-semester options. |
| `admin-dashboard/src/components/colleges/AttendanceWorkspace.tsx` | Modified | Accept scheduled initial class and preserve slot identity for saving. |
| `admin-dashboard/src/components/colleges/CertificateWorkspace.tsx` | Modified | Display template paper-size metadata. |
| `admin-dashboard/src/components/colleges/CollegePortal.tsx` | Modified | Route academics to shared progress screen and add dashboard summary. |
| `admin-dashboard/src/components/colleges/ConnectedPortal.tsx` | Modified | Academic/results routing, home summary, dedicated custom fee-head drawer/create-edit entry. |
| `admin-dashboard/src/components/colleges/CourseCards.tsx` | Modified | Use common insights/semester workspace rather than a duplicate curriculum drawer. |
| `admin-dashboard/src/components/colleges/CourseInsightsPanel.tsx` | Modified | Embed new semester curriculum/faculty workspace. |
| `admin-dashboard/src/components/colleges/CourseSemesterWorkspace.tsx` | New (untracked) | New semester subject/lab breakdown, inline add/edit and faculty allocation. |
| `admin-dashboard/src/components/colleges/FeeHeadManager.tsx` | New (untracked) | New custom head/category form plus searchable existing-head CRUD table, schema/form metadata and reference protection. |
| `admin-dashboard/src/components/colleges/FeeStructureManager.tsx` | Modified | Custom fee-head manager, canonical course duration/batch filtering and explicit semester basis. |
| `admin-dashboard/src/components/colleges/FeeStructures.tsx` | Modified | Consistent saved fee cards, semester labels and direct custom-head manager entry. |
| `admin-dashboard/src/components/colleges/PersonalPortal.tsx` | Modified | Family academic/results routing and overview summary. |
| `admin-dashboard/src/components/colleges/academic-progress.css` | New (untracked) | New responsive academic cards, charts, tabs, tables and editor styles. |
| `admin-dashboard/src/components/colleges/course-semester-workspace.css` | New (untracked) | New semester curriculum/inline edit/faculty layout. |
| `admin-dashboard/src/components/colleges/fee-head-manager.css` | New (untracked) | New fee-head drawer form/table/gutter/responsive styling. |
| `admin-dashboard/src/lib/colleges/fees.ts` | Modified | Remove fabricated percentage-based fee-head fallback. |
| `admin-dashboard/src/services/api/consts.ts` | Modified | Optional duration/level/program metadata in lookup options. |
| `admin-dashboard/src/services/api/modules/academic-progress/service.ts` | New (untracked) | New typed academic overview/results/calendar API client. |
| `admin-dashboard/src/services/api/modules/assessments/service.ts` | Modified | Course workspace types/inline edit/add/faculty methods and current semester options. |
| `admin-dashboard/src/services/api/modules/assignments/service.ts` | Modified | Current-semester options typing. |
| `admin-dashboard/src/services/api/modules/attendance/service.ts` | Modified | Scheduled slot_code request typing. |
| `admin-dashboard/src/services/api/modules/certificates.ts` | Modified | Optional certificate paper_size metadata. |
| `backend/app/core/academic_progress.py` | New (untracked) | New shared IST timeline/final results/backlogs/analytics/classes/fees/calendar and deduplicated fee-reminder service. |
| `backend/app/core/assessment_workspace.py` | Modified | Expose current semester in scoped options. |
| `backend/app/core/assignment_workspace.py` | Modified | Expose current semester in scoped options. |
| `backend/app/core/attendance_workspace.py` | Modified | Resolve scheduled class/subject/semester; reject unallocated scheduled periods and future class start. |
| `backend/app/core/certificate_design.py` | New (untracked) | New branded ReportLab certificate renderer with five formats, logo/seal/signatory/QR. |
| `backend/app/core/certificate_workspace.py` | Modified | Paper-format metadata; generic academic/fee push route payload fields. |
| `backend/app/core/curriculum_workspace.py` | Modified | Stable inline subject edits, add, faculty allocation, batch snapshot integration and current personal subjects. |
| `backend/app/core/settings.py` | Modified | semester_reminders_enabled setting. |
| `backend/app/core/sqlserver.py` | Modified | Preserve original failure and close dead SQL connections when rollback fails. |
| `backend/app/main.py` | Modified | Register progress router and persistent-server reminder lifespan worker. |
| `backend/app/modules/administration/workspace/api.py` | Modified | Add course duration/level and academic-year course metadata to lookups. |
| `backend/app/modules/documents/files/api.py` | Modified | Delegate certificate PDF rendering to new design module; retain issue/sign/download workflow. |
| `backend/app/modules/master_data/onboarding/api.py` | Modified | Validate course/batch/semester fee scope and separate annual/full-course/semester matching. |
| `backend/app/modules/master_data/onboarding/schemas.py` | Modified | Allow explicit semester fee basis. |
| `backend/app/modules/mobile/workspace/api.py` | Modified | Expose academic progress screen/summary contracts for mobile role navigation. |
| `backend/assets/pragathi-logo.jpg` | New (untracked) | New deployment-local brand asset for backend PDF rendering. |
| `backend/docs/ASSESSMENT_WORKSPACE.md` | Modified | Assessment/curriculum deployment notes and SQL Mac-vs-Windows connection runbook. |
| `backend/docs/SEMESTER_ACADEMICS.md` | New (untracked) | New architecture/data/fee-head/reminder/deployment guide. |
| `backend/tests/conftest.py` | Modified | Disable automatic reminder worker in test settings. |
| `backend/tests/test_academic_progress.py` | New (untracked) | Timeline, published attempt/backlog, privacy, calendar, attendance period and fee-reminder tests. |
| `backend/tests/test_certificate_design.py` | New (untracked) | Poppler-based one-page/branding/image/link checks for all certificate families. |
| `backend/tests/test_course_semester_workspace.py` | New (untracked) | Stable inline subject identity, duplicate/bounds/revision, faculty assignment and permission tests. |
| `backend/tests/test_linked_academic_seed.py` | New (untracked) | Linked seed idempotence/no-overwrite/logins and four-role API integration tests. |
| `backend/tests/test_master_data.py` | Modified | Fee-basis separation and course/batch mismatch regression tests. |
| `backend/tools/seed_course_curricula.py` | Modified | Temporary SQL host override; safe missing-plan seeding. |
| `backend/tools/seed_linked_academics.py` | New (untracked) | New idempotent linked demo seed, SQL JSON-object metadata, long bulk timeout and private login report. |
| `mobile-apps/admin_teachers/lib/app/edunexa_client.dart` | Modified | Register academic progress part and navigation icon. |
| `mobile-apps/admin_teachers/lib/screens/academics/academic_progress.dart` | New (untracked) | New role-aware semester dashboard, subjects/faculty, class attendance, results/reattempt editor, calendar and fee/payment views. |
| `mobile-apps/admin_teachers/lib/screens/assessments/assessment_workspace.dart` | Modified | Current-semester default for new work; retained role-specific assessment behavior. |
| `mobile-apps/admin_teachers/lib/screens/assignments/assignment_workspace.dart` | Modified | Await list/detail API Futures before decoding; current-semester default subject. |
| `mobile-apps/admin_teachers/lib/screens/attendance/attendance_workspace.dart` | Modified | Accept initial timetable class and attach slot identity only while context matches. |
| `mobile-apps/admin_teachers/lib/screens/workspace/mobile_workspace.dart` | Modified | Use AcademicHub for academics/results, add home overview and academic notification routing. |
| `mobile-apps/admin_teachers/lib/services/api_service.dart` | Modified | New semester overview/result/calendar API methods. |
| `mobile-apps/admin_teachers/test/academic_progress_test.dart` | New (untracked) | Phone semester/subject/backlog/fee interactions including narrow enlarged-text case. |
| `mobile-apps/admin_teachers/test/assignment_loading_test.dart` | New (untracked) | Regression tests for asynchronous assignment list and detail decoding. |
| `mobile-apps/admin_teachers/test/workspace_features_test.dart` | Modified | Update expected results-screen title to Academic progress. |
| `mobile-apps/parent_student/lib/app/edunexa_client.dart` | Modified | Register academic progress part and navigation icon. |
| `mobile-apps/parent_student/lib/screens/academics/academic_progress.dart` | New (untracked) | New role-aware semester dashboard, subjects/faculty, class attendance, results/reattempt editor, calendar and fee/payment views. |
| `mobile-apps/parent_student/lib/screens/assessments/assessment_workspace.dart` | Modified | Current-semester default for new work; retained role-specific assessment behavior. |
| `mobile-apps/parent_student/lib/screens/assignments/assignment_workspace.dart` | Modified | Await list/detail API Futures before decoding; current-semester default subject. |
| `mobile-apps/parent_student/lib/screens/attendance/attendance_workspace.dart` | Modified | Accept initial timetable class and attach slot identity only while context matches. |
| `mobile-apps/parent_student/lib/screens/workspace/mobile_workspace.dart` | Modified | Use AcademicHub for academics/results, add home overview and academic notification routing. |
| `mobile-apps/parent_student/lib/services/api_service.dart` | Modified | New semester overview/result/calendar API methods. |
| `mobile-apps/parent_student/test/academic_progress_test.dart` | New (untracked) | Phone semester/subject/backlog/fee interactions including narrow enlarged-text case. |
| `mobile-apps/parent_student/test/assignment_loading_test.dart` | New (untracked) | Regression tests for asynchronous assignment list and detail decoding. |
| `mobile-apps/parent_student/test/workspace_features_test.dart` | Modified | Update expected results-screen title to Academic progress. |

Earlier committed UI coverage includes `SideDrawer.tsx`, `SearchField.tsx` / `search-field.css`, `tab-interactions.css`, admission/enrollment wizard changes, shared table/icon components, calendar/syllabus/staff search consumers, `AcademicYearForm.tsx`, `CourseCurriculum.tsx`, initial assessment/attendance web/mobile workspaces and their tests. See the historical manifest for exact paths and commit membership.

## Verification and build artifacts

Tests were run throughout implementation. The evidence directory preserves final relevant logs; the table describes scope rather than claiming one final whole-repository CI run.

| Verification | Observed result | Evidence / limits |
|---|---|---|
| Focused backend academics suite | 54 passed | `final-academic-tests.log`: progress, attendance, curriculum/faculty, assessments, certificate PDFs, linked seed/API tests. |
| Fee/master-data suite | 26 passed | `fee-backend-tests.log`: fee heads, fee plans and onboarding, including separate fee bases/course validation. |
| TypeScript | No errors | `final-typecheck.log`; command `npx tsc --noEmit`. Empty output is success, not a missing log. |
| Scoped ESLint | No reported issues | `final-lint.log`; only edited principal workspace components, not a claim that every repository lint target ran. |
| Dart analyzer, changed academic/attendance/assessment files | No issues found | `academic-mobile-analyze.log`; not a full all-file analyzer result. |
| Web academic workflow | Passed at 1440px / 390px | Actual component + browser, mocked HTTP: semester switching, result save payload, dates drawer, contained responsive layout. |
| Web course workflow | Passed at 1440px / 390px | Actual component + mocked HTTP: semester counts, inline edit/add, faculty assignment payload/scope. |
| Web fee-head workflow | Passed at 1440px / 390px | Actual component + mocked HTTP: custom head/category, edit, delete, metadata exclusion and responsive table. |
| Admin/teacher and family navigation | 8 passed in each project | `academic-admin-navigation-tests.log`, `academic-family-navigation-tests.log`; all-role fixture tests. |
| Assignment/assessment/academic family tests | 5 passed | `final-family-academic-tests.log`; awaited assignment loading and selected academic/assessment flows. Mirrored admin/teacher focused run also passed earlier. |
| Narrow/enlarged-text academics | 2 passed | `academic-accessibility-tests.log`: 390px normal and 320px at text scale 1.8. A real chart overflow was fixed; below-viewport tests use normal scrolling. |
| Real SQL-backed API verification | Four role checks passed | `linked-sql-verification.log`: new logins and actual SQL, using the local updated backend code. 20 saved demo timetable plans verified. This is not proof of remote deployment. |
| Certificate PDFs | Five one-page templates passed checks | Included in backend tests; Poppler text/layout inspection, image/verification-link presence; attendance/achievement renders visually inspected. |
| Android builds | Both debug APKs built | `academic-admin-apk.log`, `academic-family-apk.log`; Android Kotlin/SDK XML compatibility warnings remain nonfatal. |

A broad Flutter run initially found three assertions per project still expecting the old results-screen titles. The navigation assertions were updated to the intentional Academic progress screen title, and the affected navigation suites passed. The entire mobile suite was not rerun as one final invocation after all last edits. There was no final full backend suite, production Next build, signed release build, actual-device push test, or iOS build recorded.

The real SQL-backed verification observed the admin demo's 48 students, teacher demo's 12 allocated students, and a single authorized student in the student/parent checks. Admin overview included existing non-demo batches as well; the captured 11-batch/13-backlog figures were mixed live database totals at verification time, not seeded-only constants.

Re-run relevant tests from each project root:

```sh
# backend
.venv/bin/python -m pytest tests/test_academic_progress.py tests/test_linked_academic_seed.py tests/test_attendance_workspace.py tests/test_course_semester_workspace.py tests/test_assessment_workspace.py tests/test_certificate_design.py -q
.venv/bin/python -m pytest tests/test_fee_heads.py tests/test_fee_plans.py tests/test_master_data.py -q

# admin-dashboard
npx tsc --noEmit
npx eslint src/components/colleges/AcademicProgressWorkspace.tsx src/components/colleges/CourseSemesterWorkspace.tsx src/components/colleges/FeeHeadManager.tsx src/components/colleges/FeeStructureManager.tsx src/components/colleges/FeeStructures.tsx

# In EACH Flutter project
flutter test test/academic_progress_test.dart test/assignment_loading_test.dart test/assessment_workspace_test.dart test/attendance_workspace_test.dart test/workspace_features_test.dart --reporter compact
flutter build apk --debug --no-pub
```

The browser harness builders/checkers are archived alongside evidence. They are ad hoc local harnesses, not a repository Playwright test suite; run from `admin-dashboard` with its installed Next compiled webpack / Playwright dependencies and Google Chrome. They currently write/build under `/private/tmp` and assume the original Mac Chrome path. Adapt paths before using on another machine. Their API is mocked; preserve this distinction in future reports.

### Artifacts

| Artifact | Location / state |
|---|---|
| Admin/teacher APK | `mobile-apps/admin_teachers/build/app/outputs/flutter-apk/app-debug.apk`, 224,707,362 bytes at handover; debug, not signed distribution. |
| Parent/student APK | `mobile-apps/parent_student/build/app/outputs/flutter-apk/app-debug.apk`, 203,182,507 bytes at handover; debug, not signed distribution. |
| Demo login report | `mock_logins.txt`, local Git-ignored file; keep private. |
| Certificate samples | `docs/handover/2026-10-31/SAMPLE-certificate-*.pdf`; fabricated test student and verification destination. |
| UI screenshots | Academic desktop/phone, course phone, fee heads phone, attendance/achievement certificate PNGs under the evidence directory. |
| SQL snapshot | `docs/handover/2026-10-31/database-counts.json`; aggregate counts only, no credentials. |

Build directories may be deleted by `flutter clean` and APKs are not a source backup. Install these debug APKs for testing only; changing Firebase settings later requires rebuilding the apps with their platform configuration. The source change to fix the screenshot error is present in both projects regardless of whether an old APK remains installed on a phone.

## Deployment and notification setup still required

### Priority fix discovered during handover

**Faculty-allocation revision storage needs the same JSON-object correction already applied to semester revisions.** This was discovered while checking the handover against source; it has not been repaired in this documentation-only pass.

- `backend/app/core/curriculum_workspace.py`, `assign_faculty`, currently ends with `revisions[code] = body.revision + 1` (line 314 at handover).
- `course_workspace` exposes `allocation_revision` via a direct `.get(code, 0)` (around line 187), and `assign_faculty` compares the stored value directly (around line 283).
- The same SQL Server `ISJSON` object/array constraint previously rejected scalar document writes during the demo seed. Therefore a real faculty allocation POST/PUT can fail/roll back even though the local JSON tests and mocked browser flow passed. This is a source-verified compatibility finding; no live faculty-save write was performed to reproduce it during the handover.
- Fix the write to an object such as `{"revision": n}`. Normalize reads/comparisons back to an integer, supporting existing scalar values for local/legacy compatibility, and keep the HTTP `allocation_revision` field numeric.
- Add an actual SQL Server assignment/reassignment regression test in an isolated test database/schema or reviewed rollback transaction. Verify the canonical offering/student links and returned revision. Do not blindly overwrite real faculty allocations to test it.
- The demo seed inserted faculty allocations directly into canonical tables, so it did not exercise this UI/API revision-document write. The four-role real-SQL verification was read-oriented and did not prove this write path.

### 1. Preserve and deploy source

Review/stage the modified and new source files; do not include credentials, `.env`, `mock_logins.txt`, unreviewed `mock_logins.html`, giant APKs or unrelated personal files. Include the new backend asset and new untracked modules/tests. No new commit was made automatically. The manifest is an inventory, not a blanket instruction to commit every historical file listed in it.

Deploy the updated backend and dashboard together. Windows deployment support exists at `backend/deploy/windows/`; the service XML runs `python -m uvicorn app.asgi:app --host 0.0.0.0 --port 8010 --workers 1`. The configured service is `EduNexaBackend`. Use the server's actual installation path and established deployment procedure. An earlier runbook used `C:\edu portal\backend`; it is an example, not a remotely reverified path.

After copying/deploying source, install dependencies from the existing requirements/lock files as needed, build the dashboard with the production configuration, and restart the Windows backend/service through the normal authorized deployment process. Include `backend/assets/pragathi-logo.jpg`. Keep Windows SQL host settings appropriate to that machine.

Check `/health` and `/openapi.json`; verify the semester route and the extended curriculum routes are present. Then test actual remote requests, not only local TestClient calls. A missing route is a deployment issue, not a reason to rerun seeds or recreate the DB. No remote deployment/restart has been performed in this session.

### 2. Mobile installation, iOS signing and device acceptance

Install updated APKs; remove confusion with previously installed builds. Test admin, teacher, student and parent roles against the updated server. The current debug base URL defaults to the HTTP test API. Production release configuration requires HTTPS according to the existing mobile runbooks.

The iOS apps still need the owner's Apple team/provisioning and a signed build. No iOS binary was generated or installed during this work. Physical-device assessment attachment downloads, timetable attendance, result publishing and family fee/payment history should be checked after deployment. Actual payment-provider end-to-end behavior was not newly verified in this session.

### 3. Firebase and APNs — owner deferred configuration

The owner asked whether SQL/local APIs alone can deliver while the app is closed. The answer given was: the existing DB/API can store and display an inbox while the app is active/reopened; reliable new remote OS alerts require platform push delivery. The owner will create/provide configuration later. Do not block source/data work on this or claim device delivery already works.

Use one Firebase project, with these four app registrations:

| Flutter application | Android package | iOS bundle ID |
|---|---|---|
| Admin/Teacher | `com.edunexa.edunexa_admin` | `com.edunexa.edunexaAdmin` |
| Parent/Student | `com.edunexa.edunexa_parent` | `com.edunexa.edunexaParent` |

Apple Developer setup must register both iOS app IDs, enable Push Notifications and supply a valid APNs authentication key / Key ID / Team ID in Firebase. Configure the app signing capabilities/provisioning accordingly. Register each platform using the exact existing identifier; do not accidentally register RunnerTests identifiers.

Only Cloud Messaging is needed for the discussed push integration. The project does not need to move SQL data, authentication, fees, storage or hosting to Firebase. This does not imply other Firebase products have been enabled or billed.

Existing mobile build-time configuration in `lib/constants/api_config.dart` / `mobile-apps/README.md`:

- `FIREBASE_API_KEY`
- `FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_IOS_BUNDLE_ID` for the appropriate iOS app

Each app/platform uses its own registration values. Platform app configuration is not a server private service-account key. Do not embed private provider/signing credentials in Flutter defines or chat.

The backend currently expects a configured HTTPS push adapter using `EDUNEXA_PUSH_ADAPTER_URL` and `EDUNEXA_PUSH_ADAPTER_TOKEN`. Both were absent in the local configured settings checked during this session. Merely creating Firebase or uploading its mobile config does not complete the server sender. The adapter must authenticate, accept the existing idempotent payload, deliver OS-visible Android/APNs notifications through the chosen provider and report acceptance. It may use server-side Firebase credentials stored securely. The existing hook is implemented; this sender/service configuration and actual delivery remain to be completed/verified.

The apps already expose Inbox → Enable device alerts, authenticated device registration/renewal and sign-out removal. Notification-tap navigation was extended for the academic/fee screens. After configuration, test foreground, background and normally closed-app delivery, per-role broadcasts, individual payment/reminder notifications, token renewal/sign-out, duplicates, denied notification permission and platform restrictions. Provider acceptance is not proof that a phone displayed/read the alert; force-stop/OS restrictions are separate cases.

Reference setup: [Firebase Flutter Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/flutter/get-started), [Apple APNs authentication tokens](https://developer.apple.com/help/account/capabilities/communicate-with-apns-using-authentication-tokens). Links were checked during the session; recheck official documentation when configuring the accounts.

### 4. Content and policy review

Confirm actual semester dates, accredited subject/lab names, credit values, faculty allocations, real fee schedules and institutional promotion/backlog policy. Generated curricula and demo results/fees are for demonstration, not policy decisions. The date-based current-semester indicator does not promote a failing student, register them in a new class, automatically schedule a backlog exam, or waive a charge.

## Known limits and review decisions

- Source implementation, deployed server, actual SQL data and installed phone binaries are distinct states. The first and third were verified; the deployed new API and physical-device flows still require rollout/testing.
- The notification adapter and Firebase/APNs configuration are pending. In-app rows and reminder generation exist; closed-app device delivery has not been activated.
- Calendar progression is display/context logic, not an automatic promotion/enrollment engine. Ensure next-term enrollments/sections and faculty allocations exist when a new semester begins. Ambiguous dates should be fixed by an administrator, not guessed from age.
- Analytics cover published available records and the role's authorized roster. Pending marks are not backlogs; incomplete results are not a whole-cohort pass rate. Semester/year labels follow stored course plans, even where Intermediate institutions might use annual curricula in reality; review against the institution's convention.
- New document-backed attendance/final results/assessments must not be assumed visible in every older SQL-only report/export that queries only canonical legacy tables. Verify/update each required legacy report separately if it must include these records.
- Demo timetable documents mirror canonical slots so the timetable editor shows data. Test the institution's real overlapping-room/faculty rules when publishing or editing real schedules; the seed is not an accredited academic timetable.
- Certificate logo/seal is explicitly Pragathi-branded as requested. A configurable multi-institution stamp/signature-image editor was not implemented. Samples are not valid issued certificates.
- The custom fee-head manager is a web administration feature. Parent/student mobile has fee breakdown/payment displays; a separate new mobile custom-head CRUD screen was not added.
- The MPC layout was generalized, not its financial values. Courses without saved itemization intentionally do not display fabricated eight-head breakdowns. Configure their actual heads/amounts using the manager.
- Existing annual/shared academic years remain compatible. Do not automatically convert a saved annual fee to a full-course amount; these are different financial scopes.
- The reminder worker runs automatically on a persistent SQL-backed server lifespan, including immediately after startup. Review deployment timing/notification audience if it will act on existing real unpaid charges. No live automatic run against real accounts was performed during verification; verification explicitly disabled it.
- For serverless hosting, an always-running lifespan worker is insufficient; configure an external scheduler for the authorized reminder endpoint. Multiple persistent workers rely on transaction/deduplication, not independent guaranteed push queues.
- Ad hoc browser mocks establish UI/payload behavior, not live server/phone correctness. No final whole-repo CI verdict is claimed.
- An untracked login HTML file may contain credentials. It was not created/audited by this handover work. Keep it separate from the shareable evidence package.

## Resume checklist

1. Read this document, `git status`, the current diff and the new-file inventory. Preserve uncommitted/user changes. Do not reset, clean or blindly reseed.
2. Fix and SQL-test the `course_faculty_revisions` scalar JSON issue documented above before considering the allocation write path production-ready.
3. Confirm whether the server has since been updated: health, OpenAPI routes and authenticated demo login. The deployment status recorded here is a dated observation.
4. Review and commit the intended source/assets/tests/runbooks; exclude local credentials/login reports/build binaries.
5. Deploy backend/dashboard together using the established Windows process; ensure the logo is included. Database data already exists.
6. Install updated Android builds; arrange Apple signing/iOS builds. Perform the role acceptance scenarios below against the actual remote API.
7. Review curricula/calendar and financial heads; do not copy demo amounts into real course schedules.
8. When the owner supplies Firebase/APNs project details, configure the mobile registrations and backend sender securely, rebuild, and verify closed-app alerts. Do not ask for private keys in chat.
9. Re-run relevant checks for any new changes, record evidence and update this handover/status rather than asserting old logs prove new code.

Acceptance scenarios:

- Admin: course details → semester subjects/labs → inline edit/add → faculty allocation by batch/section; verify canonical identity and stale edit protection.
- Admin: main student/admission table and Add forms; social/ad platform reference; search/dropdown and panel spacing.
- Admin: Academic progress → course/batch/semester comparisons → backlog students and subject details → publish a final result/reattempt → family view reflects authorized marks.
- Teacher: allocated current class at its scheduled time → attendance preset → save period marks; reject another teacher's class/future period and stale revision.
- Parent/student: own child/student only → current subjects/classes → prior semester backlog → semester fee/payment/due view → notification inbox; reject foreign student access.
- Assessment: publish future scoped work with private image/PDF → current/upcoming/completed classification → completed marks → intended recipients only.
- Finance: create custom training head/category → existing-head table edit/delete → use on a course → same saved breakdown layout → linked deletion refused; annual/full-course/semester schedules remain separate.
- Certificates: issue through the normal authorization flow → correct logo/page format/signatory → PDF download and real signature/verification check. Do not use sample PDF verification URLs.
- Push, after credentials: targeted payment notice and scoped broadcast → correct device, closed-app tray display and tap destination, no cross-role data leakage.

## Suggested prompt for the next session

> Continue the EduNexa/Pragathi work in `/Users/sconex.ios.dev/Leads porjects/edunexa-college`. Read `SESSION_HANDOVER_2026-10-31.md`, the file manifest and current Git status first. The latest features are uncommitted above HEAD `98dce33` on `Chaitu_dev`; preserve them. SQL Server `Edu Admin` on `150.241.246.34` already contains the 131 starter curricula and the linked `D26-` demo dataset; do not recreate or overwrite it. The last checked remote API lacked the semester-workspace route. First fix and SQL-test the faculty-allocation scalar revision document noted in the handover, then verify current deployment and finish backend/dashboard rollout and physical-device acceptance. Firebase/APNs and the server push adapter were deferred until I provide configuration. Keep credentials/private keys out of chat and Git. Do not claim local mocked browser tests prove live deployment or push delivery.
