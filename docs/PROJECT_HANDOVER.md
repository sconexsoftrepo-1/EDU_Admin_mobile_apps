# EduNexa / Edu-Pragathi — complete project handover

Prepared: 18 November 2026. Source baseline: `main`, commit `fb0b8926ed8a5fc85fc73063a01b8b8cd02053cb`.

Purpose: give a new maintainer, college stakeholder, or document/presentation author a single source for understanding the application. Read this with [the complete screen and resource inventory](PROJECT_INVENTORY.md) and [the stage/development implementation instructions](STAGE_AND_DEVELOPMENT_CODEX_INSTRUCTIONS.md).

## 1. Evidence and interpretation

This handover is based on the current repository, source contracts, configuration classes, workflows, test source, and selected non-secret local environment settings. No Azure resources, production records, GitHub settings, DNS records, or running applications were changed or queried for this handover. No application test suite was executed during this documentation task. Existing tests and archived screenshots provide verification material, not a new acceptance result.

Use these distinctions throughout:

- **Implemented:** an identifiable code path exists; it still needs environment-specific acceptance testing.
- **Configuration dependent:** requires working credentials, provider services, permissions or deployment settings.
- **Catalog resource:** a schema/API or descriptor-driven screen exists; this does not establish a polished, fully accepted workflow for every business operation.
- **Proposed:** future environment/release design, not deployed infrastructure.
- **Locally configured:** observed in a developer configuration file; not proof of Azure's live setting.

`CLAUDE_HANDOVER.md`, `SESSION_HANDOVER_2026-10-31.md`, and parts of `backend/README.md` describe earlier states. Some refer to deferred SQL, four separate apps, Supabase, Vercel, Windows servers, disabled file storage, missing certificate generation, and earlier test failures. Do not carry those claims into new material without checking current source. The project now has two Flutter projects, SQL Server support, Azure Blob support, email OTP, certificate PDFs, and additional business workspaces. Old completion percentages are not measured acceptance coverage.

## 2. Product overview and highlights

EduNexa is a college management platform branded for Pragathi College / Pragathi Educational Institutions. It connects administration, finance, academic staff, students and parents to one backend and authorized business records.

The platform comprises:

1. A responsive Next.js web application with public-facing pages, admissions intake, login, administrative workspaces, personal workspaces, reports and certificate verification.
2. A FastAPI backend for authentication, access control, business transactions, files, reporting, academic operations and mobile APIs.
3. **EduDesk**, the staff Flutter application in `mobile-apps/admin_teachers/`, with Admin and Teacher login modes and scoped clerk/lab experiences.
4. **EduNest**, the family Flutter application in `mobile-apps/parent_student/`, with Parent and Student login modes.
5. Database schemas, import collection workbooks, deployment scripts, CI/CD workflows, tests and operational guides.

Highlights suitable for a stakeholder presentation:

- A shared college record system across browser and mobile experiences.
- Individual logins, configurable roles, screen permissions and scoped personal access.
- Admissions through enrollment, linked guardians, documents and student records.
- Courses, batches, semesters, sections, faculty assignments and timetables.
- Attendance, leave, assignments, syllabus/resources, assessments and published academic progress.
- Fee structures and ledgers, collections, receipts, cash custody and clerk deposits.
- HR records, salary components, payroll workflows, payslips and tax document access.
- Private uploads, certificate request/approval/issuance and public authenticity verification.
- Communication, calendars, notifications, messaging and optional native push.
- Azure deployment automation with separate backend and frontend packages.

Do not describe the product as audited accounting software, a statutory payroll engine, a government-approved digital signature service, or a fully verified live payment gateway. Those claims require separate evidence.

## 3. Architecture and request walkthrough

```text
Web browser
  -> Next.js web app /portal and /api/college/* proxy
  -> FastAPI /api/v1/*
       -> SQL Server / Azure SQL: records, accounts, permissions, sessions, audit, metadata
       -> Private Azure Blob: uploaded document/photo/attachment bytes
       -> Azure Communication Services Email: codes and notices
       -> Firebase Cloud Messaging or push adapter: native notifications
       -> Optional SMS / payment bridge: provider integrations

EduDesk and EduNest (Android / iOS)
  -> HTTPS FastAPI directly, with role-specific client policy

GitHub main
  -> backend tests -> backend ZIP -> production API App Service
  -> Next.js build -> standalone ZIP -> production web App Service
```

The browser uses the same-origin Next proxy. The proxy holds authentication tokens in HttpOnly cookies and forwards authorized requests to Python; normal web JavaScript does not need the bearer tokens. Mobile clients call the backend directly and manage refresh sessions using native secure storage. The server, rather than a selected UI role or hidden button, decides what records and actions a person may access.

An admission example: the officer opens Admissions, saves an application, records guardians and documents, reviews the application, then enrolls the accepted applicant. Backend transactions create/link the student and guardians and validate enrollment constraints. The new student appears in authorized web/mobile views once their records, enrollments and access have been established.

A collection example: an authorized user selects the student, reviews charges and balance, records a manual payment with an idempotency key, and generates a receipt. The backend updates the ledger atomically. A payment provider redirect alone never proves that money was collected.

## 4. Repository ownership map

| Location | Responsibility |
|---|---|
| `admin-dashboard/src/app/(campus)/portal/[[...slug]]/page.tsx` | Current portal route |
| `admin-dashboard/src/app/api/college/[...path]/route.ts` | Browser/API proxy, cookies, forwarding and refresh |
| `admin-dashboard/src/components/colleges/` | Connected administration, personal portals, feature editors and UI |
| `admin-dashboard/src/services/api/` | Web API clients, module services and workspace catalog |
| `admin-dashboard/src/lib/colleges/` | Role navigation, access mapping, finance/academic/report helpers |
| `backend/app/asgi.py`, `backend/app/main.py` | ASGI entry, application creation, middleware, routes and reminder lifecycle |
| `backend/app/core/` | Security, persistence, files, academic/finance/HR workspaces and integrations |
| `backend/app/modules/<domain>/<screen>/` | Resource API, schemas, service bindings and workflows |
| `backend/app/contracts/` | Screens, resources, schema catalog, module hubs and import contracts |
| `backend/tools/` | Bootstrap, database tools, role creation, seed tools and reference generation |
| `backend/tests/` | Backend rules, authentication, workflows, storage and regression tests |
| `backend/docs/` | API and technical domain references; check age against source |
| `mobile-apps/admin_teachers/` | Independent EduDesk Flutter project |
| `mobile-apps/parent_student/` | Independent EduNest Flutter project |
| `database/` | PostgreSQL/MySQL reference schemas and SQL Server changes |
| `client-data/initial-data-entry/` | Collection templates, workbook instructions and import mapping contract |
| `deploy/azure/` | Settings generation, packaging, deployment and existing operational notes |
| `.github/workflows/` | GitHub Actions deployment definitions |
| `docs/handover/2026-10-31/`, `docs/verification/` | Historical evidence and screenshots |

Other website/showcase templates remain in the frontend source because of shared assets/dependencies. Their presence is not evidence that hotels, restaurants or clinics are Edu-Pragathi ERP features.

## 5. Technical specifications

| Layer | Specification from source |
|---|---|
| Web | Next.js 16 range (`^16.0.0`), React 19 range, TypeScript, App Router; exact installed versions come from `package-lock.json` |
| Web packaging | `output: "standalone"`; Linux CI build; `node server.js`; pipeline Node 24 |
| API | Python >=3.12; production workflow Python 3.12; FastAPI, Uvicorn, Pydantic settings |
| API entry/start | `app.asgi:app`; Azure `sh startup.sh`; one Uvicorn worker |
| Persistence | `sqlserver`, `postgres`, or `local-json` selected by `EDUNEXA_STORAGE_BACKEND` |
| SQL Server client | `pymssql`, encrypted connection, parameterized values, configurable schema (`dbo` default) |
| Files | `azure`, `s3`, `supabase`, or `local` selected independently by `EDUNEXA_FILE_STORAGE` |
| Security | Argon2 hashes, signed JWT access tokens, rotating opaque refresh tokens, server-side session checks |
| PDFs / spreadsheet work | ReportLab, openpyxl, cryptography; PDF, CSV, XLSX exports in relevant workflows |
| Mobile | Two self-contained Flutter/Dart projects; Dart SDK constraint `^3.12.0`; Android and iOS project files |
| Native integrations | Secure storage, file selection, PDF viewing, sharing, camera/image selection, audio recording/playback, Firebase and local notifications |
| API route prefix | `/api/v1`; health endpoint `/health`; interactive docs when enabled `/docs`, `/redoc`, `/openapi.json` |
| Current contracts | 141 resource entries; 98 web screen descriptors; 14 module hubs; see generated inventory for interpretation |

The API applies a 1,048,576-byte request-body limit. The ordinary private upload endpoint accepts 1–650,000 decoded bytes, with base64 input capped at 900,000 characters. A document type may impose an additional lower limit/type restriction. Do not market this as unrestricted large-file storage.

## 6. Login types, roles and access

### 6.1 Login surfaces and client policies

| User / mode | Surface | API client policy | Access basis |
|---|---|---|---|
| Super Admin and authorized office users | Web `/portal/login` | `admin-web` | Assigned roles, screens, actions, scope and extra grants |
| Administrator | EduDesk Admin | `admin-mobile` | Administrative mobile permissions |
| Faculty / teaching staff | EduDesk Teacher | `teacher-mobile` | Employee identity and assigned teaching records |
| Cash clerk | EduDesk staff flow | Staff client with clerk-specific screen selection | Cash custody assignments and own employee records |
| Lab in-charge | EduDesk staff flow | Staff client with lab-specific screen selection | Assigned labs/sessions and own employee records |
| Student | EduNest Student | `student-mobile` | Own student records and enrollments |
| Parent / guardian | EduNest Parent | `parent-mobile` | Explicitly linked children only |

There are **two installable projects and four main mobile client policies**, not four independently maintained applications. The five total client identifiers include web.

### 6.2 Staff email OTP

Implemented in `backend/app/core/otp_login.py`. Staff submit their login ID or account email and the chosen client/role. A valid active staff account with an email receives a six-digit code through configured email delivery. The request returns a neutral response to avoid revealing whether an account exists.

- Code lifetime: 5 minutes; one successful use.
- Up to 5 wrong code attempts before invalidation.
- Resend interval: 60 seconds; up to 5 sends per hour per login.
- IP-based throttling also applies.
- Stored code material is an HMAC, not the plain code.
- Verification checks client and selected role before issuing a session.

`EDUNEXA_STAFF_PASSWORD_LOGIN=false` disables ordinary staff password sign-in. That is the locally observed setting; `Settings` defaults it to true, so deployment settings matter. Parent/student password sign-in remains separate. Email OTP proves access to the mailbox; do not label it password-plus-code MFA.

### 6.3 Student/parent setup and ongoing access

`family_access.py` implements first-time setup with the student login/admission identity and a registered matching email. Parent setup checks the guardian linked to that student. The setup flow sends a six-digit email verification code, valid for 10 minutes, with five tries and resend controls; verification establishes the relevant family account/password.

The setup password requires at least 8 characters with letters and numbers. Administrative password reset/change contracts use a 12-character minimum. These are different existing paths; do not document one uniform password policy that source does not enforce. Welcome/access emails are implemented and configuration dependent; never publish actual credentials in training material.

### 6.4 Roles and permission model

The web role templates include Super Admin, Principal, Accounts Manager, Admission Officer, Certificate Officer, Hostel Warden, Faculty, Student, Parent, HR Manager, Payroll Officer, Procurement Officer, Inventory Manager, Transport Manager, Driver and Master Data Entry. Current code also supports built-in Cash Clerk and Lab In-charge roles. Roles can be created/edited, so this is not a fixed list of every role in the live database.

Permissions combine resource actions (`view`, `create`, `edit`, `delete`, `approve`, `export`), allowed workspace screens, client allowlists, role scopes (`college`, `teaching`, `self`) and account-specific extra access. The UI offers View, Add & edit and Full levels. A Full level does not bypass workflow rules or the web approval/delete restrictions.

Typical responsibilities, subject to actual grants:

| Role group | Typical work |
|---|---|
| Super Admin | Access administration, sensitive changes, approval review and deletion |
| Principal | Oversight, college reports, academics and approvals configured for the role |
| Accounts / cash roles | Fees, receipts, cashbook, clerk transfers/deposits and finance reports |
| Admissions / data entry | Enquiries, applications, student/staff onboarding and approved imports |
| Faculty | Assigned classes, attendance, learning work, marks, personal leave and salary documents |
| HR / payroll | Employee records, attendance/leave, pay components and payroll |
| Certificate / hostel | Certificate lifecycle or rooms/allocations/permissions |
| Procurement / inventory | Vendors, purchases, expenses, stock and assets |
| Transport / driver | Vehicles, routes, allocations, manifests and assigned operations |
| Student / parent | Own/linked academic, financial, attendance and service information |

Role names and role selection are not authorization. A role being present in frontend templates does not establish that the live database has provisioned it.

## 7. Account management and governance

### 7.1 Create and maintain a login

1. Create or identify the employee/student/parent business record first. Teaching, clerk and lab accounts need the correct employee link to resolve their workspaces.
2. Open Administration → Users & logins / account management, or the person's login action.
3. Supply a unique login ID; select the person; supply an email for staff; select authorized roles and allowed clients. Add individual extra screen access only where needed.
4. Confirm the account is active. For staff, test email OTP with the intended role/client. For family accounts, test the matching-email setup flow and correct child linkage.
5. Verify a permitted action and a forbidden action; hiding navigation alone is insufficient verification.
6. When responsibilities change, revise roles/client permissions/extra grants; deactivate access when the person leaves.

Source enforces case-insensitive login uniqueness, one ordinary login per linked person, and uniqueness checks for supplied login email/mobile contacts. System accounts without a person link are restricted to Super Admin creation; a system login cannot replace an employee-linked teaching account.

### 7.2 Protected access and offboarding

- Protected system administrator role cannot be casually edited/deleted.
- Users cannot grant/manage permissions beyond their own grants.
- A non-Super Admin cannot change administrator logins.
- Self-deactivation and self-removal of the admin role are blocked.
- At least one active Super Admin must remain.
- Assigned/protected roles cannot simply be deleted.
- Password changes/resets revoke sessions. Logout and logout-all are supported.
- Account deletion has reference/history handling; prefer deactivation for routine offboarding and review effects before deletion.
- Bootstrap/linking tools exist for establishing the first administrator; no shared/default production password is provided by this handover.

### 7.3 Change requests

`edit_approvals.py` intercepts selected non-Super Admin **admin-web** changes. Creates generally proceed through the endpoint's own checks; supported changes can be queued for Super Admin acceptance/rejection. Non-Super Admin web deletion is blocked. The gate has explicit exceptions for authentication, mobile, chat, push, public and change-request paths, plus route-specific behavior; it is not a universal approval system for every mobile/API action.

Reviewers inspect proposed changes and stale fields, accept or reject with appropriate context, and the backend records the outcome. An approved request is replayed under the accepting Super Admin's rights after requester permission checks. Demonstrations should show a pending change separately from an already committed change.

## 8. Feature and screen walkthrough

### 8.1 Home and management oversight

Web workspaces expose authorized navigation, dashboard summaries, campus analytics, pending changes, reports and operational shortcuts. Mobile home presents role-specific academic or finance information, today's classes, events and published updates where data exists. Empty states are legitimate when records have not been entered; no fictional balances should be presented as live college data.

### 8.2 Admissions and enrollment

Public enquiries/applications and internal review cover sources, cycles, applications, guardians, qualifications, documents, reviews/statuses and enrollment. Enrollment checks course/section references, capacity and student identity constraints and transfers relevant document links in a transaction. Admission numbering has course/year/branch logic; review `backend/docs/ADMISSION_NUMBERS.md` before altering it.

Walkthrough: create enquiry → application/guardian details → upload and verify required documents → review/offer → enroll into the correct academic structure → confirm student, guardians, checklist and fee setup → issue welcome/access instructions. Test rejected/incomplete enrollment to establish rollback behavior.

### 8.3 Students, parents and master data

Student enrollment and directories support personal/academic details, linked guardians, photos/documents, course enrollment and status history. Master-data onboarding APIs write related records atomically. Teaching/non-teaching onboarding creates the relevant employee/profile relationships. Courses and batches must exist before dependent academic activity is useful.

The collection package contains 13 workbook contracts. The special Master Data Entry role can be limited to onboarding screens and specified import files; the existing helper focuses on workbook access 01–06. A workbook contract/mapping is not evidence that every real client workbook has passed acceptance.

### 8.4 Courses, academic structure and faculty

Manage departments, programs/courses, academic years, batches, semesters, sections, subjects, curriculum and subject offerings. Academic progress and course/semester workspaces connect these structures to student enrollments and faculty. Lab staff and lab sessions have dedicated scoped operations.

Walkthrough: create/verify course → academic year/batch → semester/subjects → section → enroll students → assign faculty/offerings → inspect class/subject views on teacher and student accounts. Avoid duplicate master records during imports.

### 8.5 Timetable and calendar

Timetable code includes templates, daily schedules, generation and period swap workflows. Calendars/events and announcements appear according to permissions/audience. Faculty timetable depends on correct employee and offering links.

Walkthrough: select course/section/period structure → assign subjects/faculty/rooms → save/review timetable → open faculty view → submit and process a permitted swap → confirm updated schedule. Check conflicts and publication behavior in acceptance; do not assume generation optimizes every scheduling constraint.

### 8.6 Attendance and student leave

Dedicated student attendance and leave workspaces complement staff attendance/leave. Teachers work with their assigned class scope; students/parents view own/linked attendance. Requests can have review states. Verify date/session/section selection and first-save versus later-edit approval behavior.

Walkthrough: teacher selects assigned class/date → records attendance → saves → authorized reviewer checks any change request → parent opens the same child's attendance → student/parent submits leave → approver reviews it.

### 8.7 Assignments, syllabus and resources

Assignments include creation, student submissions, review/grading and related performance. Syllabus/resources support course learning materials and progress. Feature screens exist in both Flutter projects alongside descriptor-driven modules. Uploaded materials and ownership remain subject to the common storage/security limits.

Walkthrough: teacher publishes an assignment for an offering → student reads/submits → teacher reviews/grades → student and linked parent inspect available results. Verify dates, permissions and file downloads using separate identities.

### 8.8 Assessments and academic progress

Assessment, exam, marks/result and academic-progress code provides assessment setup, scoped mark entry and result visibility/publication workflows. A subject offering, student enrollment and relevant exam setup are prerequisites.

Walkthrough: configure assessment → assign eligible students/subjects → enter marks as the permitted faculty member → review/publish → inspect student and parent views. Do not describe draft marks as published results or imply external university synchronization.

### 8.9 Finance and fees

Dedicated code covers fee heads, structures/plans, student charges, installments/due dates, discounts/waivers, scholarships, late fees, collections, allocations, refunds, external remittances and summaries. Money workflows use decimal arithmetic and INR support. Workflow-managed financial records cannot be safely treated as ordinary editable table rows.

Manual collection walkthrough: choose student → inspect ledger/heads and amounts → record correct payment mode/reference → submit once with idempotency protection → verify payment allocation, remaining balance and receipt → download report. Inspect correction/approval rules rather than deleting a financial row to reverse a payment.

Cash custody is a separate workflow: transfer collected cash to a clerk → clerk acknowledges collection → submit bank deposit/proof → review deposit → track outstanding custody/returns. A receipt, physical cash handover and bank deposit are distinct events.

Late fees and semester reminders have their own logic/settings. Online checkout uses an optional HTTPS adapter with callback signature, amount/currency and deduplication checks. Live gateway settlement/reconciliation is configuration dependent and was not verified here.

### 8.10 HR, payroll and expenditure

HR covers employee directories, teaching/non-teaching profiles, employment types, employee attendance, leave and salary components. Payroll includes runs, payslip lines, adjustments, bonuses/reimbursements, publishing and payment-status actions. Teacher/staff clients can read their authorized published payslips and uploaded tax documents.

Walkthrough: employee onboarding → pay components → attendance/leave review → payroll run → review adjustments → publish → employee downloads payslip. Form 16 is an uploaded issued document, not proof of a statutory tax generation engine. Payroll calculation/status is not proof of bank salary disbursement.

Expenses/procurement include vendors, invoices, purchase requests/orders, utilities, equipment, maintenance, travel and additional expenditure. Inventory movement and asset records are linked catalog/workflow capabilities. Full audit/accounting reconciliation requires business acceptance.

### 8.11 Certificates and documents

Certificate requests, administrative approval, PDF generation, Ed25519 signatures, public verification, revocation and download audit are implemented. Existing evidence includes study, conduct, course completion, achievement and attendance certificate samples; authoritative available types come from the configured system.

Walkthrough: student requests an eligible certificate → officer verifies identity/details and approves → issue the document → student downloads → open verification link/QR where supplied → check revocation behavior in stage. Signing key and public URLs are essential to continuity. A cryptographic signature is not a claim of an officially authorized CA/e-sign integration.

Private documents cover admission evidence, photos, employee/tax files, bank/deposit proofs, certificate and other supported attachments. Type limits and authorization are enforced per route. Never make the Blob container public to fix a download problem.

### 8.12 Hostel, transport, library and placements

Hostel: rooms/beds, allocation, provisions and permission/pickup/departure/return workflows. Parents/students access only relevant hostel requests.

Transport: vehicles/buses, drivers, routes/stops, passenger/faculty allocation, seats, trips, manifests, attendance, fuel, maintenance and reports. Catalog and dedicated allocation paths exist; live GPS tracking or a third-party fleet integration was not established by this review.

Library: book/copy/loan catalog and issue/return workflows. Placements: companies, drives and applications through module resources. These should be shown as the actual available screens and actions, without inventing an advanced library or recruitment integration.

### 8.13 Communication, inbox and alerts

Announcements, templates/campaign records, notifications, payment reminders, calendar and messaging are represented. Chat code includes direct/group conversations, unread tracking, read actions and controlled image/audio/PDF attachments. Native push is opt-in; devices register against an authenticated account and unregister on logout.

Firebase service-account configuration can send push directly; a separate HTTPS push adapter is also supported. In-app notifications can operate without native push. Provider acceptance does not mean the phone displayed the alert or the user read it. SMS adapter delivery is optional, not proven configured.

### 8.14 Reports, imports and configurable forms

Reports cover available finance, outstanding amounts, collections/cash book, expenses, remittances, payroll, admissions and other operational views. Relevant endpoints export PDF/CSV/XLSX, with permissions, filters and download auditing. Always inspect accounting scope/date filters before treating an export as a final ledger.

Excel import implements preview/validation, staged rows and commit, with header/formula/size/row checks and repeat-commit protection. Walkthrough: download the correct template → enter clean data → preview → resolve errors → commit once → verify related records. Test all required workbook paths with representative staging data before operational rollout.

Forms support ordered sections/fields, types, labels, required flags, choices, publish/revisions and submissions, with some business form bindings. This does not mean arbitrary schema changes or a universal no-code workflow builder.

## 9. Mobile user walkthrough and release considerations

Both projects have app shell, feature screens, shared widgets, services, models, constants, themes, utilities and splash layers. There is no shared package between the two apps; fixes to duplicated layers must be reviewed in both.

| Mode | Main tabs | Representative tasks |
|---|---|---|
| Admin | Home, Finance, Calendar, Inbox, More | Dues, collections, cash, reports, employees/students, approvals |
| Teacher | Home, Classes, Calendar, Inbox, More | Classes, timetable, attendance, assignments, grading, leave, payslips |
| Parent | Home, Fees, Calendar, Inbox, More | Select linked child, fees, attendance, results, requests and messages |
| Student | Home, Study, Calendar, Inbox, More | Timetable, study work, marks, attendance, fees and certificates |

Start app → select role → sign in → review home → open a module or searchable More → perform an authorized action → inspect notifications → sign out. Secure restoration remembers role/session. Empty, loading, error, refresh, pagination, record details, forms and downloads are handled in app code.

Android minimum SDK is documented as 24; iOS setup is documented as 15+ and requires the team's signing/provisioning/APNs configuration. Verify actual platform build settings and device compatibility before distribution. Store publication, signing custody and release acceptance were not confirmed here.

**Source/readme discrepancy:** `ApiConfig.allowInsecureHttp` currently defaults to **true**, despite README statements about HTTPS-only releases. Build stage/production with `--dart-define=ALLOW_INSECURE_HTTP=false` and verify Android/iOS networking settings. The default backend points to a production Azure hostname; every non-production build must supply its own `API_BASE_URL`. Separate package/bundle IDs, names, Firebase registrations and storage namespaces are recommended for side-by-side stage/dev installs; they are future implementation work.

## 10. Storage: what is stored and where

| Storage class | Content | Key operational rule |
|---|---|---|
| SQL Server / Azure SQL | Business rows, relationships, accounts, roles, sessions, audit, file metadata, document/workflow state | Durable relational persistence; independent DB/user per environment |
| Azure private Blob | Uploaded bytes: photos, documents, proofs and supported attachments | Private container, authorized API access / short-lived read SAS |
| App Service `/home/data/edunexa` | Supporting persistent local artifacts where used | Not a substitute for SQL/Blob; explicit signing secret avoids accidental new signer |
| Local JSON `var/` | Offline/test data when explicitly selected | Development only; not a production data strategy |
| Browser | HttpOnly session cookies; role/navigation preferences as implemented | Browser storage is not the college system of record |
| Native secure storage | Refresh/session information via Keychain/Keystore | Environment-specific installs/namespaces must avoid mixed sessions |
| GitHub artifacts | Packaged application code, retention currently 7 days for frontend build artifacts | Not DB backups and not a long-term rollback archive |
| Secrets stores / ignored local files | DB credentials, JWT/signing/provider keys | Never embed in user guides, frontend bundles or mobile builds |

`files.py` supports Azure, S3, Supabase and local backends; current local configuration selects Azure. Azure metadata includes provider/container/blob reference; ordinary file inventory contains original filename, MIME, byte size, SHA-256 and timestamps. Azure download links can be read-only SAS links, normally 5 minutes. File metadata and corresponding bytes must remain consistent across backups/clones.

Local non-secret observations: SQL server `pragathiedu.database.windows.net`, DB `eduadmin`, schema `dbo`; Blob account `pragathiedu`, container `edu`, prefix `uploads`. These are **candidate current targets**, not verified live Azure inventory. Older deploy notes name `edupragathi` / `edu-dev` and regions that differ from mobile URLs. Resolve actual live settings before provisioning or migration.

Database size, Blob consumption, Azure SKU/region, retention, recovery point/time targets, budget and user limits were not measured. They must be recorded from actual resources rather than invented. Back up SQL, Blob and signing secrets together as a documented recovery set; test restoration in an isolated environment.

## 11. Azure services and operational configuration

| Component | Evidence / responsibility |
|---|---|
| Azure Linux App Service API | Workflow target `edunexa-api-pragathi`; Python source ZIP, Azure dependency build, `sh startup.sh` |
| Azure Linux App Service frontend | Workflow target `edunexa-admin-pragathi`; standalone Node ZIP, `node server.js` |
| App Service plan | Shared plan described in existing docs; actual SKU/region/capacity unverified |
| Azure SQL Database | SQL Server runtime; exact deployed server/database must be discovered |
| Azure Storage / private Blob | Implemented adapter and local Azure file settings |
| Azure Communication Services Email | `EDUNEXA_EMAIL_CONNECTION_STRING`, sender and sender-name settings for codes/notices |
| DNS and TLS | User identifies production at `edu.pragathinews.org`; bindings/certificates were not queried |
| GitHub Actions | Current deployment automation; GitHub secrets hold deployment credentials |
| Firebase | External to Azure; direct FCM service-account or push-adapter path |

API settings include `EDUNEXA_JWT_SECRET` (minimum 48 characters), storage selection, `EDUNEXA_MSSQL_HOST/PORT/NAME/USER/PASSWORD/DB_SCHEMA/ENCRYPTION`, Azure file settings, public API/portal URLs, JSON CORS origins, certificate signing key, email settings, staff-password policy, API docs and reminder settings. See the environment runbook for a complete classified configuration map.

The backend runs an in-process hourly reminder worker when enabled and using remote storage. Keep one worker and one API instance until scheduling/deduplication is redesigned; scaling to multiple workers/instances can duplicate jobs. Stage/dev must disable reminders unless testing a controlled recipient set.

`/health` reports configuration status, storage backend, file adapter and signer configuration. **It does not execute a DB query or Blob round-trip**, so HTTP 200 alone cannot prove the data plane is working. Add authorized record and upload/download checks to acceptance.

## 12. Current CI/CD and hazards to resolve

| File | Trigger / behavior |
|---|---|
| `.github/workflows/backend-azure.yml` | `main`, filtered to backend/workflow changes; Python tests → backend-only ZIP → API deployment → `/health` polling |
| `.github/workflows/admin-azure.yml` | `main`, filtered to frontend/workflow changes; Node 24 install/build → standalone/static/public ZIP → frontend deployment → login polling |
| `.github/workflows/main_edunexa-admin-pragathi.yml` | All `main` pushes; generated workflow uploads repository as artifact and deploys to the same frontend, without the curated standalone build |

The third workflow overlaps the curated frontend workflow and has no shared concurrency lock. It can redeploy the same production target independently and on documentation-only pushes. Its existence is a source finding; whether it is currently enabled in GitHub was not checked. Audit and consolidate it before creating environment workflows. Do not silently edit or disable production CI while preparing stage instructions.

Additional hazards:

- Current production workflows allow manual dispatch without an explicit `main` guard; a dispatch from another ref can still use production targets. Protect both push and manual paths.
- `make_backend_settings.py` reads **`backend/.env`**, copies all `EDUNEXA_*` values, may reuse/create a signing key, and writes a single ignored output. It has no environment-input option. Blind reuse can point stage at production data/providers.
- `deploy.sh` reads one shared settings artifact and derives the API default hostname. Backend public URLs/CORS and frontend upstream must agree; explicit environment artifacts are needed.
- Deployment checks test HTTP response, not record access, DB identity, upload isolation or payment safety.
- Tests/builds do not run migrations; there is no complete stage/dev pipeline or automated SQL Server migration lifecycle shown by these workflows.
- PostgreSQL/MySQL schemas are reference assets; never send them directly to Azure SQL as a new SQL Server installation script.

## 13. Development and validation reference

Run from the appropriate project directory with an isolated configuration. Do not let local smoke tests use production DB/email/push/payment credentials.

```bash
# backend/ — after configuring a private local/test environment
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn app.asgi:app --host 127.0.0.1 --port 8010

# admin-dashboard/
npm ci
npm run typecheck
npm run lint
npm run build
npm run dev

# each Flutter app directory
flutter pub get
flutter analyze --no-pub --no-fatal-infos
flutter test --no-pub
flutter run --dart-define=API_BASE_URL=https://YOUR-NONPRODUCTION-API --dart-define=ALLOW_INSECURE_HTTP=false
```

Backend default pytest fixtures explicitly use temporary local-json/file storage and disable real email/FCM; SQL integration tests are separately opt-in and require review before use. Frontend Playwright tests are in `admin-dashboard/tests/`. Flutter tests exist independently under both projects. A test filename describes intended coverage, not proof it passes at the handover commit.

A handover acceptance session should exercise: Super Admin and delegated staff login; family first-time setup; role/client denials; unrelated-child denial; enrollment; fees/receipt; clerk deposit proof/review; attendance; assignment; assessment publication; certificate issuance/verification; private upload/download denial; payroll/payslip; import preview/commit; notifications; session expiry/logout; mobile physical-device login and downloads; deployment isolation and rollback.

No fresh test-pass total, uptime percentage, concurrent-user capacity, completion percentage or production-readiness certification is asserted by this document.

## 14. Known gaps, dependencies and owner decisions

| Item | Required next evidence/action |
|---|---|
| Live Azure topology differs across historic files | Record actual resource IDs, default hostnames, custom domains, region, plan and deployed settings |
| Duplicate frontend deployment definition | Confirm enabled state, then consolidate with a reviewable change |
| Production/manual-dispatch branch isolation | Add explicit environment/ref guards and restricted credentials |
| Stage/development do not yet exist in this review | Execute the separate instructions and capture proof |
| Mobile HTTP fallback | Enforce HTTPS in release configuration and platform manifests |
| Payments/SMS | Establish provider, sandbox, callback/delivery tests and reconciliation |
| Email/push | Validate real configured services with allowlisted test recipients; do not assume local keys prove delivery |
| Imports | Accept required real workbook paths, mappings, references and duplicate handling |
| SQL lifecycle | Build a reproducible SQL Server schema/migration procedure and stage-first rehearsals |
| Finance/payroll compliance | Obtain institution/accountant sign-off on required calculations and reconciliation |
| Backups/recovery | Set retention/RPO/RTO, protect signing keys and prove isolated restore |
| App distribution | Confirm Android/iOS signing custody, store registrations, APNs and physical-device acceptance |
| Performance and scaling | Measure actual workloads; address single-process scheduling before scale-out |

Ownership to assign at handover: institution product owner, finance approver, academic administrator, application maintainer, Azure/subscription owner, DNS owner, database/backup owner, email/push provider owner, mobile release/signing owner and incident responder. Store contacts and credential retrieval procedures privately; do not invent names.

## 15. Instructions for Codex to turn this into a document and presentation

Use this file as the narrative source and `PROJECT_INVENTORY.md` as the detailed appendix. Keep technical operations in a maintainer appendix; write ordinary user workflows in plain language. Preserve all implemented/configuration-dependent/proposed distinctions and the date/baseline.

Suggested document structure: product purpose → application surfaces → role/access guide → everyday walkthroughs → module features → mobile guide → storage/privacy → technical architecture → operations/support → limitations → screen appendix. Suggested presentation (18 slides):

1. Edu-Pragathi purpose and audiences.
2. Web + EduDesk + EduNest ecosystem.
3. Highlights and institutional benefits.
4. Role/login/access matrix.
5. Staff OTP and family setup.
6. Dashboard/navigation walkthrough.
7. Admissions-to-enrollment journey.
8. Academic setup/timetable.
9. Attendance/leave.
10. Assignments/assessments/progress.
11. Fees, collections and receipts.
12. Cash custody and clerk deposits.
13. HR/payroll/documents.
14. Certificates/verification and private storage.
15. Hostel/transport/library/procurement.
16. Communication and mobile walkthroughs.
17. Architecture, Azure and release flow.
18. Current dependencies, training and next steps.

Capture fresh screenshots in an isolated stage environment using fictional records. Existing screenshots under `docs/handover/2026-10-31/` may help identify views but must be labeled historical. Never fabricate screenshots, payment confirmations, deployment success or live service claims. Separate any internal security/CI findings from an ordinary end-user training deck. Use the supplied institution emblem only as an approved branding asset; its presence does not authorize new public publishing.

## 16. Further technical reading

- `backend/docs/AUTHENTICATION.md`, `API_ENDPOINTS.md`, `API_REFERENCE.txt` — cross-check current route source.
- `backend/docs/ATTENDANCE_WORKSPACE.md`, `ASSESSMENT_WORKSPACE.md`, `SEMESTER_ACADEMICS.md`.
- `backend/docs/ADMISSION_NUMBERS.md`, `STUDENT_ENROLLMENT_UI.md`.
- `backend/docs/UPLOAD_DATABASE_AND_S3_MAP.md` — useful ownership/table map; its S3 branding predates current Azure local selection.
- `docs/AZURE_EMAIL_SETUP.md`, `docs/OTP_EMAIL_AND_SMS_SENDER_GUIDE.md`, `docs/FIREBASE_PUSH_SETUP.md` — provider setup background, subject to verification.
- `deploy/azure/README.md`, `CICD.md` — existing deployment mechanism; server/DB/region examples conflict with newer local settings.
- `mobile-apps/README.md` and each app README — client setup; source overrides outdated HTTPS claims.
