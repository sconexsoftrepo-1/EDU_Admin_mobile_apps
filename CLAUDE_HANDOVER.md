# EduNexa College — Claude Agent Handover

Snapshot: 22 October 2026. Development paused at the user's request. This file records implementation state, verification limits, and the next work; it does not certify production readiness.

## 0. Current database (supersedes the SQL notes below)

- Persistence is PostgreSQL on Supabase (`EDUNEXA_STORAGE_BACKEND=postgres`, connection in the ignored `backend/.env`; see `backend/.env.example`). The earlier SQL Server target is no longer used.
- Schema: `database/` holds only `edunexa_schema_postgresql.sql` (complete schema, versions 001-006, installed in `public` with `backend/tools/apply_schema.py`) and `edunexa_schema_mysql.sql` (MySQL 8 edition, verified on MySQL with the same 145 tables, keys, checks, triggers and views). Later changes: a temporary `database/migrations/NNN_*.sql` applied with `backend/tools/migrate.py`, then folded into both files. Version 006 enables row level security on every table (Supabase Data API sees nothing; the backend connects as owner).
- Module SQL in each `api.py` is regenerated with `backend/tools/generate_module_sql.py`. See `backend/README.md`, "Storage and integration status".
- The Supabase project is in ap-southeast-2 (Sydney); from India each round trip is ~0.4 s, so requests take seconds. Hosting the backend in the same region (or moving the project closer) is the main performance lever.

## 1. Read this first

- Project root: `/Users/sconex.ios.dev/Leads porjects/edunexa-college`.
- Backend must remain in `backend/`. The original chat workspace was a different project, `dental clinic 6 tempelate`; do not implement there by mistake.
- The user requested Python services/APIs for all admin portal screens and all four Flutter apps: Admin, Teacher, Parent, Student.
- Keep each endpoint and its related active persistence/query functions together in its module/screen `api.py`. Do not introduce separate `queries.sql` files.
- SQL connection and schema deployment were explicitly deferred. Do not connect to the remote database, run schema tools, create tables, or apply migrations without renewed authorization.
- Current runtime uses local JSON persistence. SQL-oriented reference contracts are not a working SQL adapter.
- Database credentials were shared in chat; they are deliberately omitted here. Do not embed credentials in source or documentation.
- Work is uncommitted. The whole `backend/` directory and several new frontend/shared mobile files are currently untracked. Preserve all current changes and inspect Git status before editing.
- Do not replace the actual project with older temporary copies. Temporary generation scripts are not reliably idempotent and can overwrite newer fixes.

## 2. Completion estimate and interpretation

The last communicated estimate was approximately **75% complete / 25% remaining for the current development scope with SQL deferred**. This was a judgment estimate, not measured acceptance coverage. Do not present it as production completion or a guarantee that every screen is verified.

Most API and connected UI code exists. Important verification, business-rule gaps, provider configuration, documentation refresh, and production persistence remain. Live SQL, real SMS/payment provisioning, and officially authorized certificate signing are separate pending integration work.

## 3. Product requirements to preserve

### Web portal

Admin/institution/campus setup; role creation, edit, deletion and screen permissions; employee-to-role assignment; individual login creation; courses, sections, subjects and mappings; configurable forms; admissions and collected documents; student/parent records; accounts and finance; HR, leave and payroll; certificates; hostel; reports; imports; calendar/events. Principal and other staff need appropriate role-based access.

### Finance priority

Student total fee, payments, balances, discounts, scholarships, installments and due dates; separate internal fees from university/examination/external amounts; receipts, cash book, invoices, expenses, salaries, remittances and auditor-friendly downloads; parent fee reminders with cut-off dates; payment integration. Never mark an online payment collected based only on a browser redirect.

### Admissions and certificates

Enquiry/source tracking through admission, enrollment and relieving; student/guardian details, document collection and verification; consent-aware communications. Certificate requests require roll-number validation and administrative approval; student download, authenticity verification, signing and download audit.

### Four apps

- Admin: high-level collections, outstanding amounts, reports and operational summaries.
- Teacher: timetable, attendance, assignments, syllabus/resources, marks, swaps, leave, payslips and Form 16.
- Parent: linked children, fees, reminders, payment, attendance, performance and related updates.
- Student: personal academic data, timetable, assignments/submissions, syllabus, results, fees, certificate requests/downloads, hostel and related services.

Other earlier requirements: remove unrelated Skyline branding; no dashboard “back to main home” bar; responsive text without overflow; professional client import workbooks in separate files, not one giant workbook. Existing workbook/design assets were not fully re-audited during the latest backend work.

## 4. Repository map

```text
edunexa-college/
  CLAUDE_HANDOVER.md                     This snapshot
  admin-dashboard/                      Next.js admin/public portal
    src/app/api/college/[...path]/route.ts  Browser-to-Python proxy and auth cookies
    src/components/colleges/
      ConnectedPortal.tsx               Active authenticated admin workspace
      ConfigurationEditor.tsx           Role/account/form configuration UI
      PersonalPortal.tsx                Scoped employee/parent/student web workspace
      connected-portal.css              Connected workspace styles
      CollegePortal.tsx                 Default exports connected portal; legacy source retained
      CollegePage.tsx                    Public/authenticated routing and verification
      CollegePublic.tsx                 Public enquiry/admission forms
    src/data/colleges/index.ts           Navigation and public template configuration
  backend/
    app/main.py                         Router registration and middleware
    app/core/                           Auth, contracts, storage, validation, integrations
    app/contracts/                      Resource/screen/schema/import descriptors
    app/modules/<module>/<screen>/
      api.py                            Endpoints and related active query functions
      schemas.py                        Input/output definitions
      service.py                        Resource service bindings
    tests/                              Backend tests
    tools/                              Local setup/bootstrap/demo plus deferred SQL tools
    docs/                               Existing generated docs; refresh required
  mobile-apps/
    admin_teachers/                   Self-contained Admin / Teacher Flutter app
    parent_student/        Self-contained Parent / Student Flutter app
      lib/src/edunexa_client.dart        App-local authenticated client and screens
      lib/src/mobile_design.dart        App-local theme and styled components
      test/                             App, client, role and layout tests
  database/edunexa_schema_postgresql.sql Complete PostgreSQL schema (live on Supabase)
  database/edunexa_schema_mysql.sql      Same schema for MySQL 8
  client-data/                          Existing client data-entry assets
```

## 5. Backend implemented

### Contracts, resources and local persistence

FastAPI with Pydantic input validation and atomic locked local JSON transactions. Current catalog contains 141 resource/table contracts: 126 from the reference schema plus 15 explicitly local extension contracts. Administrative screen descriptors cover approximately 94 screens; mobile descriptors cover approximately 62 across the four clients. Counts describe registered descriptors, not independent completed business workflows.

Relevant contracts:

- `app/contracts/schema-catalog.json`
- `app/contracts/resources.json`
- `app/contracts/screens.json`
- `app/contracts/schema-extensions.json`
- `app/contracts/client-import-contract.json`

Generic resource APIs implement query/list/get/save/delete in their resource `api.py`, permission checks, required/type/reference validation and selected business rules. Managed financial/document/workflow records restrict generic writes. Display rows retain supported imported/custom field extras after authorization.

The 15 local extensions are purchase_requests, purchase_orders, asset_register, vehicle_trips, vehicle_maintenance, vehicle_fuel, vehicle_seats, passenger_seats, transport_attendance, timetable_swap_requests, payroll_adjustments, college_invoices, notification_templates, notification_campaigns and expense_payment_entries. No corresponding remote tables were created.

### Authentication and access control

- Short-lived JWT access tokens; rotating opaque refresh tokens stored hashed server-side.
- Refresh replay revokes the token family; client binding, expiration and logout revocation.
- Argon2 password hashing, login throttling and session revocation after password changes/reset.
- Live role permissions and college/teaching/self scope checks.
- Role CRUD, employee-linked account creation, role/client assignments, password reset and delegated grant checks.
- Protected system administrator role; bootstrap account can be linked to an employee before college transactions.
- Individual account credentials belong to people; avoid shared passwords per role.

Main files: `app/core/security.py`, `app/modules/access_control/authentication/api.py`, `app/modules/access_control/role_management/api.py`, `app/modules/access_control/forms/api.py`.

### Administrative workspace and configurable forms

`app/modules/administration/workspace/api.py`: permission-filtered screens, lookup data, typed forms, resource saves and custom form revision checks. Bound custom values and entity changes save atomically. Existing custom submission values can be loaded during edit. Forms support ordered fields, required values and configurable options. This is a descriptor-driven form system; arbitrary visual workflow building is not established.

### Finance and operational workflows

`app/modules/finance/transactions/api.py` and `app/modules/operations/workflows/api.py` implement manual collection, receipts, balances, discounts, scholarships, refunds, external remittances, admission transitions/enrollment/document review/relieving, leave approvals, expense actions, payroll component calculation/publishing/payment status, stock movements, purchase workflows, library issue/return, result publication, timetable swaps and transport seat allocation/release.

These are implemented paths requiring further end-to-end accounting review. In particular, payroll payment status does not establish a complete salary disbursement ledger; invoice settlement/allocation needs review. Do not infer statutory payroll/tax compliance from component calculation.

### Mobile-specific APIs

`app/modules/mobile/workspace/api.py`: screen descriptors, scoped screen reads and actions. Student, guardian-child and teacher-offering ownership rules limit records. Includes attendance, assignments/submissions/grading, marks/results, learning resources, leave, hostel requests, certificate requests, messaging, profile/password change, payslip/Form 16 references and admin finance summaries. Parent selection is restricted to linked children. Web users with personal scopes reuse these APIs.

### Documents and certificates

`app/modules/documents/files/api.py`:

- Private PDF/PNG/JPEG uploads, currently about 650 KB per file within a 1 MiB request limit.
- Admission document revisions/verification and employee tax document uploads.
- Real receipt/payslip PDF output and authorized private downloads.
- Certificate PDF generation, development Ed25519 signing/hash, public verification token, revocation and download audit.
- Form 16 is uploaded/downloaded as an issued document, not generated through a statutory tax engine.

The local development signer is not an officially approved college/CA digital-signature integration. Validate the actual verification URL in generated PDFs before demo.

### Reports

`app/modules/reports/downloads/api.py`: JSON/CSV/XLSX/PDF reports for finance/outstanding, collections/cash book, expenses, external remittances, payroll and admissions, with date filters and CSV injection protection. Router must remain registered after generic resource routers to avoid path shadowing.

### Excel imports

`app/modules/imports/excel/api.py`: contract-based XLSX preview, validation, staged rows and atomic commit; formula rejection, exact headers, size/row limits and repeat-commit protection. Mapping code covers the existing 13 workbook contracts and retains additional imported data.

Only the leave-type workbook path has an explicit completed end-to-end import test in the latest work. All 13 mappings, related rows, fee allocations and import error reporting still require systematic verification. Some financial adjustments intentionally require approved workflows rather than direct import. Do not promise that every workbook can already be imported without review.

### Public intake

`app/modules/admissions/public_intake/api.py`: configured courses/sources, public applications and contact/visit enquiries, required consent and active-cycle validation. Public endpoints do not expose student records. Review throttling behind the Next proxy: upstream requests can share the proxy IP.

### External integration code

`app/core/integrations_api.py`: configurable HTTPS bridge contracts for consent-aware SMS and payment checkout; signed HMAC callbacks, amount/currency checks, event deduplication, and receipt creation after verified callback. Unconfigured services fail explicitly rather than simulating success.

Real adapters/provider accounts, credentials, webhook deployment and delivery/reconciliation testing are pending. SMS acceptance is not delivery confirmation. This code is a generic bridge contract, not an already provisioned gateway SDK integration.

## 6. Admin web implementation

Active portal is now API-connected and descriptor-driven, with role-based navigation, resource tables/forms, lookups, filtering/pagination, workflow actions, imports, document upload/download, reports and role/account/form configuration. Personal web sessions use owned/scoped mobile-backed screens. Public application/contact forms call Python through the Next proxy.

`src/app/api/college/[...path]/route.ts` stores auth tokens in HttpOnly/SameSite cookies; JavaScript receives account data, not bearer tokens. Includes automatic refresh, local process single-flight refresh, origin checks for writes, validated proxy paths and explicit unavailable responses.

Production multi-instance refresh coordination, secure production cookie behavior and full CSRF/session integration need deployment-level testing. Browser cookies use `/api/college` path. The latest frontend typecheck and targeted ESLint run passed, but a full latest production build and live browser acceptance run are pending.

The old portal component source remains as a legacy named component; default export uses ConnectedPortal. Consider extracting retained legacy source if it unnecessarily enters the bundle. Do not blindly delete the established design assets.

## 7. Flutter implementation

Two self-contained apps provide role toggles at login: `admin_teachers/` (Admin / Teacher) and `parent_student/` (Parent / Student). Each app owns its client, screens, styling and tests in its own project. There is no shared package. Implemented: login, session restoration, native secure refresh-token storage, serialized refresh, role-based server screens, error/empty states, parent child selection, dynamic action forms, downloads/share, and HTTPS payment launch.

Native refresh storage uses platform Keychain/Keystore through flutter_secure_storage. Browser sessions use memory rather than persistent browser token storage. Release clients reject insecure HTTP; debug local networking is configured. Android emulator must use `10.0.2.2` instead of host `127.0.0.1`.

These apps use a common descriptor-rendered screen system. Bespoke visual layouts for every screen, store-ready release packaging, push notifications and full device acceptance are not established. Recent additions include url_launcher and payment/report actions; dependency lock updates, formatting, analysis and tests must be repeated for the final state.

## 8. Verification snapshot — honest current state

No implementation changes or new test runs were performed while preparing this handover. Results below are the last known execution results from the paused work.

| Area | Last known result | Remaining caveat |
| --- | --- | --- |
| Backend pytest | 32 passed, 2 failed | Latest run is not green; failures below |
| Backend screen coverage | Descriptor reads and representative workflow tests exist | Not every business action or provider path is accepted |
| Next TypeScript + targeted lint | Last run passed | Final production build/live browser checks pending |
| Four Flutter apps | Earlier analysis and 3 login/layout tests per app passed | Re-run after latest shared changes/dependencies |
| Shared Flutter client | Earlier 3 auth tests passed | Add actual workspace/action widget tests |
| Live SQL | Intentionally disabled | No remote verification or deployment |
| SMS/payment | Unconfigured failure behavior tested | Configured adapter/callback/security tests pending |
| Excel | Leave-type preview/commit tested | Other workbook paths need verification |
| Responsive/browser flows | Not completed for latest connected implementation | Must test representative flows and narrow widths |

### Two known failing backend tests

1. `tests/test_auth.py::test_roles_accounts_and_permissions`: creating a teacher account for E1 returns 409 “Person already has an account”.
2. `tests/test_screen_workflows.py::test_scoped_message_thread_and_parent_performance`: a parent-to-ADMIN message expected to be forbidden returns 201.

Likely shared fixture cause: `tests/conftest.py` creates ADMIN linked to ADMIN-EMP initially, but the `seeded` fixture replaces record collections and then changes ADMIN.person_code to E1 (currently around line 115). E1 is also the teacher employee. This confounds account uniqueness and permitted contacts.

Next agent should verify the diagnosis, keep ADMIN linked to a distinct coherent ADMIN-EMP record in every affected fixture, remove the reassignment to E1, and rerun both tests plus the full suite. Ensure the additional employee does not accidentally participate in payroll for the tested campus. Do not weaken account uniqueness or message ownership checks just to pass tests.

A previous privilege test was changed to permit a legitimate root-created delegated role. Add explicit negative tests for a limited delegate granting stronger permissions, resetting stronger accounts or taking over protected roles.

## 9. Prioritized remaining development and checks

### Priority 1 — establish a trustworthy baseline

1. Fix the fixture identity issue and get the whole backend suite green.
2. Add limited-delegate escalation/takeover tests and employee identity checks for financial/document actors.
3. Test configured SMS/payment adapters with mocked HTTP: consent refusal, ownership, amount validation, invalid signature, duplicate callback, callback amount mismatch, exactly-once receipt creation.
4. Test demo seed validation and refusal to overwrite existing business data.
5. Inspect the most recent mobile custom-form bindings: protected password/payment actions should not advertise unsupported configurable fields. Verify enriched display rows are actually written back to result items.

### Priority 2 — end-to-end demo acceptance

Run a temporary seeded backend and current Next server. Use all four identities to verify:

- Public admission -> admin document review -> enrollment -> student/guardian visibility.
- Fee setup -> collection -> receipt -> updated outstanding -> discount/scholarship/refund -> cash/report consistency.
- Parent/student separation and teacher class scope; attempted direct unauthorized API reads/writes must fail.
- Role create/edit/delete, assigned employee list, account creation/reset, screen permission updates.
- Form creation/binding, required-field validation, revision mismatch and edit prefill.
- Teacher attendance/homework/marks; student submission; parent performance.
- Payroll calculation/publication, actual payslip download and employee-only Form 16 access.
- Certificate request/approval/PDF/verification/revocation/download audit.
- Hostel warden approval, pickup relationship, departure and return.
- Report download formats and applicable date filters.
- All screen navigation without request failures; narrow widths 320/390 and desktop without text overflow.
- Browser tokens absent from localStorage and login response bodies; HttpOnly cookies and logout expiry correct.

### Priority 3 — complete business-rule gaps

- Review payroll-paid cash-book/disbursement entries and invoice settlement allocations. Verify financial reversals and reporting agree.
- Review expense category-specific screen filters; aliases currently can point to the same underlying table.
- Verify all 13 import contracts, dependency ordering, duplicated records, historic receipts/allocations, charges/discount/scholarship workflow boundaries, error exports and rollback.
- Validate generated certificate verification link, file ownership, upload security and lifecycle.
- Define statutory payroll/tax/Form 16 generation scope rather than implying existing compliance.
- Confirm user-configurable forms affect all intended screens; this is not yet proof that every form can be freely redesigned.

### Priority 4 — mobile and web release verification

- Run Flutter dependency resolution, dart format, analyze and tests for shared package and all apps after url_launcher changes.
- Add shared UI tests loading screens and submitting actions; previous per-app tests cover login/layout only.
- Run current web production build, targeted lint and browser integration tests.
- Test real Android/iOS devices including file sharing, session restore, expired refresh, offline errors and payment return/reconciliation.
- Review shared UI usability for finance summaries and long records; not all screens have bespoke UI designs.

### Priority 5 — documentation and deferred integrations

- Regenerate `backend/requirements.lock`; it predates newly added PDF/Excel/crypto/HTTP dependencies. Current requirements still include psycopg even though SQL is disabled; decide/document intended future adapter instead of implying compatibility.
- Regenerate OpenAPI, API inventory, folder tree, workflow/auth docs and validation report. Existing `backend/docs/` and root documentation can describe an earlier implementation and must not be treated as authoritative completion evidence.
- Produce a screen -> endpoint -> permission -> test -> SQL-reference coverage matrix from actual contracts.
- Reconcile the 15 local extensions, local state-enum additions and adapter metadata with a future approved SQL schema. Do not execute the SQL tools now.
- Provision actual SMS/payment bridge and deployment URLs when authorized/configured; test webhook/reconciliation and SMS delivery status.
- Establish authorized certificate signing, production private-file storage, backup/restore, secrets rotation, audit retention and multi-instance persistence/session coordination before production acceptance.

## 10. Local start/check instructions

Use project files as authoritative if flags differ. Run these from the specified directories. Do not use any SQL setup/apply commands.

```sh
# backend directory; create an isolated environment if needed
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
# Supply EDUNEXA_JWT_SECRET as a private random value of at least 48 characters.
# Supply EDUNEXA_DATA_DIR to a disposable local directory for demo/test data.
# Inspect seed_demo.py and bootstrap_admin.py help before choosing one setup path.
.venv/bin/python tools/seed_demo.py --help
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8010

# admin-dashboard directory
# Set EDUNEXA_API_URL=http://127.0.0.1:8010 for the Next server.
npm run typecheck
npx eslint src/components/colleges src/app/api/college src/data/colleges
npm run dev -- --port 3013
npm run build

# mobile shared package, then each of admin/parent/student/teacher
flutter pub get
flutter analyze
flutter test
# Use appropriate app directory and target device:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8010
```

For a different Next port configure backend `EDUNEXA_CORS_ORIGINS` if direct browser calls are needed, plus `EDUNEXA_PUBLIC_PORTAL_URL` for PDF verification URLs. BFF calls originate server-side. `EDUNEXA_PUBLIC_API_URL` must be reachable by a real provider before callbacks are enabled.

Existing reusable local tools at pause: `/private/tmp/edunexa-api-venv`, Flutter `/opt/homebrew/bin/flutter`, and Playwright under admin-dashboard/node_modules. These are machine-local conveniences and may disappear; they are not portable project dependencies.

Demo seed prompts for a chosen password and creates demo.admin, demo.teacher, demo.parent and demo.student with linked local data. Never publish a shared demo password as a production default. Demo seed should run only against an isolated empty store; review its implementation first.

## 11. Important implementation cautions

- Do not rerun `/private/tmp/edunexa-completion/apply.py`, build_registry.py or bulk-copy staging directories. Actual project files contain newer fixes and formatting.
- No provider credentials are configured by this handover. Never turn an unconfigured integration into a success message.
- Local enum extensions include payroll and hostel workflow states; review against future database constraints.
- Local JSON atomicity does not provide production multi-server database semantics.
- Next installed version has breaking changes; read admin-dashboard/AGENTS.md and relevant installed node_modules/next/dist/docs guides before Next changes.
- Keep unrelated user changes. No commit or push was made as part of this pause/handover.

## 12. Suggested first instruction to Claude

> Read CLAUDE_HANDOVER.md in the Edunexa project root, then inspect the current code and Git status. Continue from the actual files without regenerating the project. Keep SQL disabled and keep endpoint-related queries in each api.py. First resolve the two backend test failures without weakening security, add missing authorization/provider tests, then verify the admission-to-finance-to-certificate/hostel demo and all four mobile clients. Report verified completion separately from unconfigured integrations and unfinished business rules.
